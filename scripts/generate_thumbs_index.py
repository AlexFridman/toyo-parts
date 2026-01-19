#!/usr/bin/env python3
"""Generate thumbs_index.json for GitHub Pages static site.

Walks:
  photos_thumb/<id>/...

Output format:
  { "<id>": ["photos_thumb/<id>/<file>", ...] }

Use this if you already created thumbnails (e.g. with generate_thumbnails.py)
but your photos_index.json was generated without the --thumbs-dir option.

Note:
- The preferred workflow is to generate photos_index.json with thumbnails included:
  python3 scripts/generate_photos_index.py --photos-dir photos --thumbs-dir photos_thumb --out photos_index.json
- This script exists as a fallback.

Usage:
  python3 scripts/generate_thumbs_index.py --thumbs-dir photos_thumb --out thumbs_index.json

S3:
  If your photos live in S3, you can generate absolute URLs:
    python3 scripts/generate_thumbs_index.py --bucket ... --region ... --out thumbs_index.json
  Or set them in ./config.json (s3.bucket/s3.region/s3.base_url).
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List


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


def to_urls(prefix: str, part_id: str, filenames: List[str], s3_base: str) -> List[str]:
    rel = [str(Path(prefix) / part_id / fn).replace("\\", "/") for fn in filenames]
    if s3_base:
        s3_base = s3_base.rstrip("/")
        return [f"{s3_base}/{u}" for u in rel]
    return rel

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def collect_images(folder: Path) -> List[str]:
    files: List[str] = []
    for p in folder.iterdir():
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            files.append(p.name)
    files.sort(key=natural_key)
    return files


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--thumbs-dir", default="photos_thumb", help="Folder with thumbnails (default: photos_thumb)")
    ap.add_argument("--out", default="thumbs_index.json", help="Output JSON path")
    ap.add_argument("--config", default="config.json", help="Optional site config with S3 bucket/region/base_url")
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

    thumbs_dir = Path(args.thumbs_dir)
    if not thumbs_dir.is_dir():
        raise SystemExit(f"thumbs dir not found: {thumbs_dir}")

    index: Dict[str, Any] = {}

    subs = [p for p in thumbs_dir.iterdir() if p.is_dir()]
    subs.sort(key=lambda p: natural_key(p.name))

    for sub in subs:
        part_id = sub.name
        files = collect_images(sub)
        if not files:
            continue
        index[part_id] = to_urls(thumbs_dir.name, part_id, files, s3_base)

    Path(args.out).write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.out} with {len(index)} folders")


if __name__ == "__main__":
    main()
