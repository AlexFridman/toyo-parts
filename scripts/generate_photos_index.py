#!/usr/bin/env python3
"""
Generate photos_index.json for GitHub Pages static site.

Walks:
  photos/<id>/...
and optionally:
  photos_thumb/<id>/...

Output:
- Without thumbs: { "<id>": ["photos/<id>/<file>", ...] }
- With thumbs:    { "<id>": {"full":[...], "thumb":[...]} }

Usage:
  # relative paths (default)
  python3 scripts/generate_photos_index.py --photos-dir photos --out photos_index.json

  # with thumbs
  python3 scripts/generate_photos_index.py --photos-dir photos --thumbs-dir photos_thumb --out photos_index.json

  # generate S3 URLs (preferred when photos are not in repo)
  python3 scripts/generate_photos_index.py \
    --photos-dir photos --thumbs-dir photos_thumb \
    --bucket alex-4runner-parts-photos --region eu-central-1 \
    --out photos_index.json

  # or explicit base URL
  python3 scripts/generate_photos_index.py --s3-base https://BUCKET.s3.REGION.amazonaws.com

Config:
  If present, reads ./config.json (fields s3.bucket / s3.region / s3.base_url).
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import List, Dict, Any


def load_config(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def derive_s3_base(bucket: str, region: str) -> str:
    bucket = bucket.strip()
    region = region.strip()
    if not bucket or not region:
        return ""
    # Virtual-hosted style URL
    return f"https://{bucket}.s3.{region}.amazonaws.com"

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]

def collect_images(folder: Path) -> List[str]:
    files = []
    for p in folder.iterdir():
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            files.append(p.name)
    files.sort(key=natural_key)
    return files

def rel_urls(base_dir_name: str, part_id: str, filenames: List[str]) -> List[str]:
    return [str(Path(base_dir_name) / part_id / fn).replace("\\", "/") for fn in filenames]


def to_urls(prefix: str, part_id: str, filenames: List[str], s3_base: str | None) -> List[str]:
    rel = rel_urls(prefix, part_id, filenames)
    if s3_base:
        s3_base = s3_base.rstrip("/")
        return [f"{s3_base}/{p}" for p in rel]
    return rel

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--photos-dir", default="photos")
    ap.add_argument("--thumbs-dir", default=None)
    ap.add_argument("--out", default="photos_index.json")
    ap.add_argument("--config", default="config.json", help="Optional site config with S3 bucket/region")
    ap.add_argument("--bucket", default=None, help="S3 bucket name (optional)")
    ap.add_argument("--region", default=None, help="S3 region (optional)")
    ap.add_argument("--s3-base", default=None, help="S3 base URL (optional)")
    args = ap.parse_args()

    cfg = load_config(Path(args.config))
    cfg_s3 = (cfg or {}).get("s3", {}) if isinstance(cfg, dict) else {}
    bucket = (args.bucket or cfg_s3.get("bucket") or "").strip()
    region = (args.region or cfg_s3.get("region") or "").strip()
    s3_base = (args.s3_base or cfg_s3.get("base_url") or "").strip()
    if not s3_base:
        s3_base = derive_s3_base(bucket, region)
    if s3_base:
        print(f"Using S3 base: {s3_base}")

    photos_dir = Path(args.photos_dir)
    if not photos_dir.is_dir():
        raise SystemExit(f"photos dir not found: {photos_dir}")

    thumbs_dir = Path(args.thumbs_dir) if args.thumbs_dir else None
    if thumbs_dir is None:
        auto = photos_dir.parent / "photos_thumb"
        if auto.is_dir():
            thumbs_dir = auto

    index: Dict[str, Any] = {}

    subs = [p for p in photos_dir.iterdir() if p.is_dir()]
    subs.sort(key=lambda p: natural_key(p.name))

    for sub in subs:
        part_id = sub.name
        full_files = collect_images(sub)
        if not full_files:
            continue
        full_urls = to_urls(photos_dir.name, part_id, full_files, s3_base)

        if thumbs_dir and (thumbs_dir / part_id).is_dir():
            tsub = thumbs_dir / part_id
            thumb_files = collect_images(tsub)
            thumb_set = {Path(f).stem for f in thumb_files}
            # Prefer matching by stem (because thumbnails are usually .jpg)
            thumbs_ordered = []
            for fn in full_files:
                stem = Path(fn).stem
                if stem in thumb_set:
                    thumbs_ordered.append(stem + ".jpg")
            thumb_urls = to_urls(thumbs_dir.name, part_id, thumbs_ordered, s3_base) if thumbs_ordered else to_urls(thumbs_dir.name, part_id, thumb_files, s3_base)
            index[part_id] = {"full": full_urls, "thumb": thumb_urls}
        else:
            index[part_id] = full_urls

    Path(args.out).write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.out} with {len(index)} folders")

if __name__ == "__main__":
    main()
