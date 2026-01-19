#!/usr/bin/env python3
"""
Generate thumbnails into photos_thumb/ mirroring photos/ folder structure.

Requires:
  pip install pillow

Usage:
  python3 scripts/generate_thumbnails.py --photos-dir photos --out-dir photos_thumb --max-size 900 --quality 80
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--photos-dir", default="photos")
    ap.add_argument("--out-dir", default="photos_thumb")
    ap.add_argument("--max-size", type=int, default=900)
    ap.add_argument("--quality", type=int, default=80)
    args = ap.parse_args()

    photos_dir = Path(args.photos_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for folder in [p for p in photos_dir.iterdir() if p.is_dir()]:
        dest = out_dir / folder.name
        dest.mkdir(parents=True, exist_ok=True)
        for img_path in folder.iterdir():
            if not img_path.is_file() or img_path.suffix.lower() not in IMG_EXTS:
                continue
            try:
                im = Image.open(img_path).convert("RGB")
                im.thumbnail((args.max_size, args.max_size))
                out_path = dest / (img_path.stem + ".jpg")
                im.save(out_path, format="JPEG", quality=args.quality, optimize=True, progressive=True)
            except Exception as e:
                print(f"Skip {img_path}: {e}")
    print(f"Done. Thumbnails in: {out_dir}")

if __name__ == "__main__":
    main()
