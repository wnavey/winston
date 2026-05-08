#!/usr/bin/env python3
"""
Measure Distance — Python Implementation

Pure computation module for PDF vector extraction, distance measurement,
and debug image generation. No Supabase queries or LLM calls — those are
handled by the TypeScript orchestrator (measure-distance.ts).

Two modes:
  --mode=option-a   Attempt vector path matching on a PDF
  --mode=compute-distance   Compute distance from a localization result
"""

# `from __future__ import annotations` makes every annotation lazy-evaluated
# as a string, so PEP 604 union syntax (e.g. `str | None`) parses fine even
# on Python 3.9. Keeps the source readable while staying compatible with the
# conductor workspace venv (observed running 3.9 on 2026-04-15), which
# otherwise crashes at import with
# `TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'`.
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from typing import Any, Optional

import fitz  # PyMuPDF
from PIL import Image, ImageDraw

# ============================================================================
# CONFIGURATION
# ============================================================================

MIN_PATHS_FOR_VECTOR_MATCH = 5
BBOX_PADDING = 0.05  # 5% padding around bounding boxes
DEBUG_DPI = 150

# ============================================================================
# LOGGING
# ============================================================================

_log_entries: list[dict] = []


def log_event(event: str, **kwargs: Any) -> None:
    """Log a structured event to stderr."""
    entry = {"event": event, "timestamp": time.time(), **kwargs}
    _log_entries.append(entry)
    print(json.dumps(entry), file=sys.stderr)


# ============================================================================
# VECTOR PATH EXTRACTION
# ============================================================================


def extract_vector_paths(pdf_path: str, bbox: Optional[dict] = None) -> list[dict]:
    """
    Extract vector drawing paths from a PDF page using PyMuPDF.
    Optionally filter to paths within a bounding box.

    Note on rotation: PyMuPDF's page.rect and get_drawings() both operate in
    display space (post-rotation), so bounding boxes in visual/display coordinates
    (normalized 0-1) can be directly scaled by page.rect dimensions.
    """
    doc = fitz.open(pdf_path)
    page = doc[0]

    rotation = page.rotation
    if rotation != 0:
        log_event("measure-distance:pdf-rotation", rotation=rotation,
                  mediabox=list(page.mediabox), rect=list(page.rect))

    drawings = page.get_drawings()

    if bbox is None:
        doc.close()
        return drawings

    page_rect = page.rect
    x0 = (bbox["x0"] - BBOX_PADDING) * page_rect.width
    y0 = (bbox["y0"] - BBOX_PADDING) * page_rect.height
    x1 = (bbox["x1"] + BBOX_PADDING) * page_rect.width
    y1 = (bbox["y1"] + BBOX_PADDING) * page_rect.height
    filter_rect = fitz.Rect(x0, y0, x1, y1)

    filtered = []
    for d in drawings:
        in_bounds = False
        for item in d.get("items", []):
            for pt in item[1:]:
                if hasattr(pt, "x") and filter_rect.contains(pt):
                    in_bounds = True
                    break
            if in_bounds:
                break
        if in_bounds:
            filtered.append(d)

    doc.close()
    return filtered


def cluster_paths(paths: list[dict], page_rect: fitz.Rect) -> list[dict]:
    """Cluster nearby paths into candidate shapes using spatial proximity."""
    if not paths:
        return []

    path_rects = []
    for d in paths:
        rect = d.get("rect")
        if rect:
            path_rects.append({"rect": fitz.Rect(rect), "path": d})

    if not path_rects:
        return []

    clusters: list[list[dict]] = []
    used = set()

    for i, pr in enumerate(path_rects):
        if i in used:
            continue
        cluster = [pr]
        used.add(i)
        expanded = True
        while expanded:
            expanded = False
            cluster_rect = fitz.Rect()
            for c in cluster:
                cluster_rect |= c["rect"]
            padded = cluster_rect + (-5, -5, 5, 5)
            for j, pr2 in enumerate(path_rects):
                if j in used:
                    continue
                if padded.intersects(pr2["rect"]):
                    cluster.append(pr2)
                    used.add(j)
                    expanded = True
        clusters.append(cluster)

    result = []
    for cluster in clusters:
        cluster_rect = fitz.Rect()
        for c in cluster:
            cluster_rect |= c["rect"]
        result.append({
            "rect": cluster_rect,
            "path_count": len(cluster),
            "normalized_bbox": {
                "x0": cluster_rect.x0 / page_rect.width,
                "y0": cluster_rect.y0 / page_rect.height,
                "x1": cluster_rect.x1 / page_rect.width,
                "y1": cluster_rect.y1 / page_rect.height,
            },
        })

    return result


# ============================================================================
# OPTION A: VECTOR MATCHING
# ============================================================================


def attempt_vector_matching(
    pdf_path: str,
    object_a: str,
    object_b: str,
    drawing_bbox: Optional[dict] = None,
) -> Optional[dict]:
    """
    Attempt to locate objects using vector path extraction and pattern matching.
    Returns localization result or None if matching fails.
    """
    doc = fitz.open(pdf_path)
    page = doc[0]
    page_rect = page.rect

    paths = extract_vector_paths(pdf_path, drawing_bbox)
    log_event(
        "measure-distance:option-a",
        totalPaths=len(page.get_drawings()),
        filteredPaths=len(paths),
    )

    if len(paths) < MIN_PATHS_FOR_VECTOR_MATCH:
        doc.close()
        log_event(
            "measure-distance:option-a-result",
            success=False,
            failureReason=f"Too few paths ({len(paths)}) - likely rasterized PDF",
        )
        return None

    clusters = cluster_paths(paths, page_rect)
    log_event(
        "measure-distance:option-a",
        clusterCount=len(clusters),
    )

    # For v1, vector matching is experimental — we log what we find but
    # don't attempt sophisticated symbol recognition yet.
    # TODO: Implement pattern matching against known symbol signatures
    doc.close()
    log_event(
        "measure-distance:option-a-result",
        success=False,
        failureReason="Pattern matching not yet implemented (v1 - experimental)",
    )
    return None


# ============================================================================
# DISTANCE COMPUTATION
# ============================================================================


def compute_distance(
    localization: dict,
    pdf_path: str,
    scale_inches_per_foot: float,
    drawing_bbox: Optional[dict] = None,
) -> dict:
    """Compute real-world distance between two localized objects."""
    doc = fitz.open(pdf_path)
    page = doc[0]
    page_rect = page.rect

    obj_a = localization["objectA"]
    obj_b = localization["objectB"]
    method = localization.get("method", "vision")

    def gemini_to_pdf_points(normalized_yx: list, bbox: Optional[dict]) -> tuple:
        # Gemini returns all coordinates in [y, x] order (same convention as
        # bboxes — see gemini_bbox_to_normalized which unpacks y0, x0, y1, x1).
        ny, nx = normalized_yx[0] / 1000.0, normalized_yx[1] / 1000.0
        if bbox:
            x = (bbox["x0"] + nx * (bbox["x1"] - bbox["x0"])) * page_rect.width
            y = (bbox["y0"] + ny * (bbox["y1"] - bbox["y0"])) * page_rect.height
        else:
            x = nx * page_rect.width
            y = ny * page_rect.height
        return (x, y)

    # Use the bbox from inside the localization if available — it matches the
    # crop Gemini actually saw. The CLI drawing_bbox is the original full-drawing
    # crop, which is wrong for call 2 in the two-call pipeline (call 2 sees a
    # refined sub-crop at higher DPI, so its coordinates are relative to that
    # smaller region, not the full drawing).
    effective_bbox = localization.get("drawingBbox", drawing_bbox)
    pt_a = gemini_to_pdf_points(obj_a["nearestPoint"], effective_bbox)
    pt_b = gemini_to_pdf_points(obj_b["nearestPoint"], effective_bbox)

    # Vector refinement is disabled (v1). The previous implementation found
    # the minimum distance between ANY two vector paths in the two bbox
    # regions, which latched onto irrelevant overlapping paths (text labels,
    # dimension lines, etc.) and produced near-zero distances. Gemini's
    # nearestPoints, while approximate, at least point at the right objects.
    #
    # TODO: Re-enable once object-specific path identification exists —
    # cluster paths within each bbox, identify which cluster represents the
    # target object, then snap nearestPoint to that cluster's boundary.
    refined = False

    dist_points = math.sqrt((pt_a[0] - pt_b[0]) ** 2 + (pt_a[1] - pt_b[1]) ** 2)
    dist_inches_on_paper = dist_points / 72.0
    # scaleInchesPerFoot = drawing inches per real foot (e.g., 0.05 for 1"=20')
    # real_feet = paper_inches / scaleInchesPerFoot
    dist_feet = dist_inches_on_paper / scale_inches_per_foot
    dist_inches_real = dist_feet * 12.0

    doc.close()

    return {
        "distanceFeet": round(dist_feet, 1),
        "distanceInches": round(dist_inches_real, 1),
        "vectorRefined": refined,
        "pointA": list(pt_a),
        "pointB": list(pt_b),
        "distPdfPoints": round(dist_points, 2),
    }


# ============================================================================
# DEBUG IMAGE
# ============================================================================


def generate_debug_image(
    pdf_path: str,
    localization: dict,
    measurement: dict,
    output_dir: str,
    sheet_num: int,
    scale_label: str,
    call_dir: str | None = None,
) -> str:
    """Generate an annotated debug image showing the measurement.

    When call_dir is provided, writes to <call_dir>/debug.png so every
    invocation gets its own non-overwritten artifact. Otherwise falls
    back to the legacy shared location at <output_dir>/measure-distance/
    for backward compatibility with older callers.
    """
    doc = fitz.open(pdf_path)
    page = doc[0]
    pix = page.get_pixmap(dpi=DEBUG_DPI)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    draw = ImageDraw.Draw(img)

    sx = pix.width / page.rect.width
    sy = pix.height / page.rect.height

    pt_a = measurement["pointA"]
    pt_b = measurement["pointB"]
    px_a = (int(pt_a[0] * sx), int(pt_a[1] * sy))
    px_b = (int(pt_b[0] * sx), int(pt_b[1] * sy))

    draw.line([px_a, px_b], fill="green", width=3)

    r = 8
    draw.ellipse([px_a[0] - r, px_a[1] - r, px_a[0] + r, px_a[1] + r], fill="blue")
    draw.ellipse([px_b[0] - r, px_b[1] - r, px_b[0] + r, px_b[1] + r], fill="red")

    mid = ((px_a[0] + px_b[0]) // 2, (px_a[1] + px_b[1]) // 2 - 15)
    label = f"{measurement['distanceFeet']} ft"
    confidence = "vector-refined" if measurement["vectorRefined"] else "vision-estimate"
    draw.text(mid, f"{label} ({confidence})", fill="green")
    draw.text((10, 10), f"Scale: {scale_label}", fill="white")
    draw.text((10, 30), f"Method: {localization.get('method', 'unknown')}", fill="white")

    if call_dir:
        os.makedirs(call_dir, exist_ok=True)
        debug_path = os.path.join(call_dir, "debug.png")
    else:
        debug_dir = os.path.join(output_dir, "measure-distance")
        os.makedirs(debug_dir, exist_ok=True)
        debug_path = os.path.join(debug_dir, f"sheet-{sheet_num}-measurement.png")
    img.save(debug_path)
    doc.close()
    return debug_path


# ============================================================================
# MAIN
# ============================================================================


def main():
    parser = argparse.ArgumentParser(description="Measure distance — Python computation module")
    parser.add_argument("--mode", required=True, choices=["option-a", "compute-distance"])

    # Option A args
    parser.add_argument("--pdfPath")
    parser.add_argument("--objectA")
    parser.add_argument("--objectB")
    parser.add_argument("--drawingBbox", default="null")
    parser.add_argument("--outputPath")

    # Compute-distance args
    parser.add_argument("--localization", default="null")
    parser.add_argument("--scaleInchesPerFoot", type=float)
    parser.add_argument("--sheetNum", type=int)
    parser.add_argument("--legendSource")
    # Per-call artifact directory (new, optional). When set, debug.png
    # is written inside this dir instead of the legacy shared location.
    parser.add_argument("--callDir", default=None)

    args = parser.parse_args()

    drawing_bbox = json.loads(args.drawingBbox) if args.drawingBbox != "null" else None

    if args.mode == "option-a":
        result = attempt_vector_matching(
            args.pdfPath, args.objectA, args.objectB, drawing_bbox
        )
        output = {"success": result is not None}
        if result:
            output["localization"] = result
        print(json.dumps(output))

    elif args.mode == "compute-distance":
        localization = json.loads(args.localization)
        scale_label = f'1" = {args.scaleInchesPerFoot}\''

        measurement = compute_distance(
            localization, args.pdfPath, args.scaleInchesPerFoot, drawing_bbox
        )

        # Determine confidence
        method = localization.get("method", "unknown")
        if method == "vector":
            confidence = "high"
        elif measurement["vectorRefined"]:
            confidence = "high"
        elif args.legendSource in ("cross-sheet", "same-sheet"):
            confidence = "medium"
        else:
            confidence = "low"

        # Debug image
        debug_path = generate_debug_image(
            args.pdfPath,
            localization,
            measurement,
            os.path.dirname(args.outputPath),
            args.sheetNum,
            scale_label,
            call_dir=args.callDir,
        )

        result = {
            "distanceFeet": measurement["distanceFeet"],
            "distanceInches": measurement["distanceInches"],
            "confidence": confidence,
            "localization": {
                "method": method,
                "fallbackUsed": method == "vision",
                "legendSource": args.legendSource,
            },
            "scaleUsed": scale_label,
            "objectA": {
                "description": args.objectA,
                "found": True,
                **{k: v for k, v in localization.get("objectA", {}).items() if k != "found"},
            },
            "objectB": {
                "description": args.objectB,
                "found": True,
                **{k: v for k, v in localization.get("objectB", {}).items() if k != "found"},
            },
            "debugImagePath": debug_path,
            "warnings": [],
        }

        os.makedirs(os.path.dirname(args.outputPath), exist_ok=True)
        with open(args.outputPath, "w") as f:
            json.dump(result, f, indent=2)

        print(json.dumps(result))


if __name__ == "__main__":
    main()
