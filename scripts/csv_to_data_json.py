#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Convert parts CSV into data.json for the static site.

Features:
- Single source of truth: CSV.
- Availability filtering via column `Наличие` (TRUE/FALSE-like).
- Attach photos from photos_index.json produced by generate_photos_index.py.
- Create stable internal id `_id` (prefers `Номер`).
- Build `_search` string with RU+HY text to make search reliable.
- Prints sanity-check warnings before writing output.

Example:
  python3 scripts/csv_to_data_json.py \
    --csv "4runner_parts_hy_iter32_1to326.csv" \
    --photos photos_index.json \
    --out data.json \
    --only-available

"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd


def load_config(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def derive_s3_base(bucket: str, region: str) -> str:
    bucket = (bucket or "").strip()
    region = (region or "").strip()
    if not bucket or not region:
        return ""
    return f"https://{bucket}.s3.{region}.amazonaws.com"


def prefix_if_relative(urls: List[str], s3_base: str) -> List[str]:
    if not s3_base:
        return urls
    s3_base = s3_base.rstrip("/")
    out: List[str] = []
    for u in urls:
        u = str(u)
        if u.startswith("http://") or u.startswith("https://"):
            out.append(u)
        else:
            out.append(f"{s3_base}/{u.lstrip('/')}" )
    return out


TEXT_COLS_RU = [
    "Номер",
    "Номер запчасти",
    "Название",
    "Есть повреждения",
    "Нормализованное название",
    "Раздел",
    "Детальная категория",
    "Каталожное название",
    "Описание",
    "Тюнинг",
]

TEXT_COLS_HY = [
    "Название_hy",
    "Есть повреждения_hy",
    "Нормализованное название_hy",
    "Раздел_hy",
    "Детальная категория_hy",
    "Каталожное название_hy",
    "Описание_hy",
]


def to_bool(v: Any) -> Optional[bool]:
    if v is None:
        return None
    s = str(v).strip().lower()
    if s == "":
        return None
    if s in {"1", "true", "t", "yes", "y", "да", "д", "есть"}:
        return True
    if s in {"0", "false", "f", "no", "n", "нет", "н"}:
        return False
    return None


def normalize_id(v: Any) -> str:
    """Make routing/search IDs stable.

    Common issue: spreadsheets export integers as "118.0".
    We normalize such values to "118".
    """
    s = "" if v is None else str(v).strip()
    if s.endswith(".0") and s.replace(".0", "").isdigit():
        return s[:-2]
    return s


def clean_val(v: Any) -> Any:
    # Read CSV as strings; still guard against NaN.
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    return v


def norm_str(v: Any) -> str:
    v = clean_val(v)
    return str(v).strip()


def concat_text(fields: Dict[str, Any], cols: List[str]) -> str:
    parts: List[str] = []
    for c in cols:
        if c not in fields:
            continue
        s = norm_str(fields.get(c, ""))
        if s:
            parts.append(s)
    return " | ".join(parts)


def load_photos_index(path: Optional[Path], s3_base: str = "") -> Dict[str, Dict[str, List[str]]]:
    if not path:
        return {}
    if not path.exists():
        print(f"[WARN] photos index not found: {path}")
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[WARN] failed to read photos index: {path} ({e})")
        return {}

    out: Dict[str, Dict[str, List[str]]] = {}

    # Accept both formats:
    # 1) { "250": ["photos/250/a.jpg", ...] }
    # 2) { "250": {"full": [...], "thumb": [...] } }
    for k, v in (data or {}).items():
        sid = str(k)
        if isinstance(v, list):
            out[sid] = {"full": prefix_if_relative([str(x) for x in v], s3_base), "thumb": []}
        elif isinstance(v, dict):
            full = v.get("full")
            if isinstance(full, list):
                thumbs = v.get("thumb")
                out[sid] = {
                    "full": prefix_if_relative([str(x) for x in full], s3_base),
                    "thumb": prefix_if_relative([str(x) for x in thumbs], s3_base) if isinstance(thumbs, list) else [],
                }
    return out


def load_thumbs_index(path: Optional[Path], s3_base: str = "") -> Dict[str, List[str]]:
    """Optional separate thumbnails index.

    Format: {"250": ["photos_thumb/250/1.jpg", ...]}
    """
    if not path:
        return {}
    if not path.exists():
        print(f"[WARN] thumbs index not found: {path}")
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[WARN] failed to read thumbs index: {path} ({e})")
        return {}
    out: Dict[str, List[str]] = {}
    for k, v in (data or {}).items():
        if isinstance(v, list):
            out[str(k)] = prefix_if_relative([str(x) for x in v], s3_base)
    return out


def sanity_checks(df: pd.DataFrame, photos: Dict[str, Dict[str, List[str]]]) -> None:
    required = ["Номер", "Название", "Раздел", "Детальная категория", "Каталожное название", "Описание"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        print(f"[WARN] missing expected columns: {missing}")

    # Duplicate numbers
    if "Номер" in df.columns:
        nums = [normalize_id(x) for x in df["Номер"].tolist() if normalize_id(x)]
        dup = [k for k, cnt in Counter(nums).items() if cnt > 1]
        if dup:
            print(f"[WARN] duplicate Номер values (may break routing): {dup[:20]}" + (" ..." if len(dup) > 20 else ""))

    # Availability values quality
    if "Наличие" in df.columns:
        raw = [norm_str(x) for x in df["Наличие"].tolist() if norm_str(x)]
        bad = [v for v in raw if to_bool(v) is None]
        if bad:
            sample = sorted(set(bad))[:20]
            print(f"[WARN] unrecognized Наличие values (won't filter): {sample}")

    # HY coverage (optional)
    hy_cols = [c for c in TEXT_COLS_HY if c in df.columns]
    if hy_cols:
        # count rows where all HY fields are empty
        empty_rows = 0
        for _, row in df.iterrows():
            if all(norm_str(row.get(c, "")) == "" for c in hy_cols):
                empty_rows += 1
        if empty_rows:
            print(f"[INFO] rows with empty HY fields: {empty_rows} / {len(df)}")

    # Photos without parts
    if photos and "Номер" in df.columns:
        part_ids = set(norm_str(x) for x in df["Номер"].tolist() if norm_str(x))
        orphan = [pid for pid in photos.keys() if pid not in part_ids]
        if orphan:
            print(f"[WARN] photos folders with no matching Номер in CSV: {orphan[:20]}" + (" ..." if len(orphan) > 20 else ""))


def build_items(
    df: pd.DataFrame,
    photos: Dict[str, Dict[str, List[str]]],
    thumbs: Dict[str, List[str]],
    only_available: bool,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    has_avail = "Наличие" in df.columns

    for idx, row in df.iterrows():
        fields: Dict[str, Any] = {c: clean_val(row.get(c, "")) for c in df.columns}

        # Normalize common numeric artifacts (e.g. "118.0" -> "118")
        if "Номер" in fields:
            fields["Номер"] = normalize_id(fields.get("Номер"))

        part_no = normalize_id(fields.get("Номер", ""))
        _id = part_no if part_no else str(idx + 1)

        # Availability filtering
        available: Optional[bool] = None
        if has_avail:
            available = to_bool(fields.get("Наличие"))
            if available is None:
                # unknown value: do not filter it out (safe choice)
                pass
            else:
                if only_available and available is False:
                    continue

        # Photos
        full = (photos.get(_id) or {}).get("full", [])
        thumb = (photos.get(_id) or {}).get("thumb", [])
        # If photos_index.json has no thumbs, but separate thumbs_index.json exists, use it.
        if not thumb:
            thumb = thumbs.get(_id, [])

        has_photo = True if full else False

        # Provide a consistent boolean flag for the UI
        fields["Есть фото"] = "TRUE" if has_photo else "FALSE"

        # Search blob
        search_blob = concat_text(fields, TEXT_COLS_RU)
        search_blob_hy = concat_text(fields, TEXT_COLS_HY)
        merged = " | ".join([x for x in [search_blob, search_blob_hy] if x])

        item: Dict[str, Any] = {
            "_id": _id,
            "_row": int(idx),
            "_search": merged,
            "images_full": full,
            "images_thumb": thumb,
            **fields,
        }

        if available is not None:
            item["available"] = available

        items.append(item)

    meta = {
        "count": len(items),
        "only_available": bool(only_available),
        "has_availability": bool(has_avail),
        "has_photos_index": bool(bool(photos)),
        "has_thumbs_index": bool(bool(thumbs)) or any((v.get("thumb") for v in photos.values() if isinstance(v, dict))),
    }

    return items, meta


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate site data.json from a single parts CSV")
    ap.add_argument("--csv", required=True, help="Path to parts CSV")
    ap.add_argument("--photos", default=None, help="Path to photos_index.json (optional)")
    ap.add_argument("--thumbs", default=None, help="Path to thumbs_index.json (optional). Use if photos_index.json has no thumb list")
    ap.add_argument("--config", default="config.json", help="Optional site config with S3 bucket/region/base_url")
    ap.add_argument("--bucket", default=None, help="S3 bucket name (optional)")
    ap.add_argument("--region", default=None, help="S3 region (optional)")
    ap.add_argument("--s3-base", default=None, help="S3 base URL (optional) e.g. https://BUCKET.s3.REGION.amazonaws.com")
    ap.add_argument("--out", default="data.json", help="Output data.json path")
    ap.add_argument("--only-available", action="store_true", help="Exclude rows where Наличие is FALSE")
    ap.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = ap.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    cfg = load_config(Path(args.config))
    cfg_s3 = (cfg or {}).get("s3", {}) if isinstance(cfg, dict) else {}

    bucket = (args.bucket or cfg_s3.get("bucket") or "").strip()
    region = (args.region or cfg_s3.get("region") or "").strip()
    s3_base = (args.s3_base or cfg_s3.get("base_url") or "").strip()
    if not s3_base:
        s3_base = derive_s3_base(bucket, region)
    if s3_base:
        print(f"Using S3 base: {s3_base}")

    photos = load_photos_index(Path(args.photos) if args.photos else None, s3_base=s3_base)
    thumbs = load_thumbs_index(Path(args.thumbs) if args.thumbs else None, s3_base=s3_base)

    # Read as strings to avoid weird type conversions
    df = pd.read_csv(csv_path, dtype=str, encoding="utf-8-sig").fillna("")

    sanity_checks(df, photos)

    items, meta = build_items(df, photos, thumbs, only_available=args.only_available)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "meta": {
            "source_csv": csv_path.name,
            **meta,
        },
        "items": items,
    }

    with out_path.open("w", encoding="utf-8") as f:
        if args.pretty:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        else:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print(f"OK: wrote {meta['count']} items -> {out_path}")


if __name__ == "__main__":
    main()
