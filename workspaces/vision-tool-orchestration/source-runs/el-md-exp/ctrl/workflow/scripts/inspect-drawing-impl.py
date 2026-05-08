#!/usr/bin/env python3
"""inspect-drawing — Python helper.

Phase 1 only renders a region of a sheet PDF to JPEG via PyMuPDF. Future
phases may add cropping helpers, debug-image rendering, etc.

CLI:
    inspect-drawing-impl.py --mode=render-region \
        --pdfPath=path/to/sheet.pdf \
        --bbox='{"x0":0.05,"y0":0.05,"x1":0.95,"y1":0.95}' \
        --outPath=path/to/cropped.jpg \
        --dpi=150

Bbox is normalized 0-1 page-relative {x0,y0,x1,y1}.

Stdout: JSON {"width": <int>, "height": <int>}.
"""
from __future__ import annotations

import argparse
import json
import sys

import fitz  # PyMuPDF
from PIL import Image


def render_region(pdf_path: str, bbox: dict, out_path: str, dpi: int) -> dict:
    doc = fitz.open(pdf_path)
    try:
        page = doc[0]
        rect = page.rect
        clip = fitz.Rect(
            rect.x0 + bbox["x0"] * rect.width,
            rect.y0 + bbox["y0"] * rect.height,
            rect.x0 + bbox["x1"] * rect.width,
            rect.y0 + bbox["y1"] * rect.height,
        )
        pix = page.get_pixmap(dpi=dpi, clip=clip)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img.save(out_path, "JPEG", quality=92)
        return {"width": pix.width, "height": pix.height}
    finally:
        doc.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=["render-region"])
    parser.add_argument("--pdfPath", required=True)
    parser.add_argument("--bbox", required=True, help="JSON: {x0,y0,x1,y1} normalized 0-1")
    parser.add_argument("--outPath", required=True)
    parser.add_argument("--dpi", type=int, default=150)
    args = parser.parse_args()

    if args.mode == "render-region":
        bbox = json.loads(args.bbox)
        result = render_region(args.pdfPath, bbox, args.outPath, args.dpi)
        sys.stdout.write(json.dumps(result))
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
