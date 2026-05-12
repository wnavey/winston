#!/usr/bin/env python3
"""Build manifest.json for the vision-tool-orchestration debug UI.

Scans the canonical var-2 source-run layout

    source-runs/<set>/var-2/output/runs/run-N/vision-check-calls/<callId>/

and emits a single manifest.json the static HTML viewer consumes.
Browsers can't list directories, so we pre-compute the index here.

Per-(item × run) entries capture:
  - classifier inputs (item, question, document, sheet)
  - classifier output (problemType, reasoning, confidence, fallbackUsed)
  - dispatch outcome (specialistCalled, success, fallbackReason)
  - specialist-extract-measurement-pairs sub-call (cropped, prompt,
    response, returned pairs)
  - specialist-measure-distance per-pair sub-calls (call1+call2
    cropped/prompt/response, localization.json, distance output)

Default scan target: every set+variant under
`source-runs/<set>/var-2/`. Pass --source-set / --source-variant to
narrow.

Usage:
    ./build-manifest.py
    ./build-manifest.py --source-set el-md-exp
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).parent.resolve()
WORKSPACE = HERE.parent.resolve()  # …/vision-tool-orchestration
SOURCE_RUNS_ROOT = WORKSPACE / "source-runs"
OUT_PATH = HERE / "manifest.json"


def _read_json(p: Path) -> dict[str, Any] | None:
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError as e:
        print(f"  warn: {p.relative_to(WORKSPACE)} — JSON decode error: {e}")
        return None


def _read_text(p: Path, *, max_chars: int | None = None) -> str | None:
    if not p.exists():
        return None
    try:
        text = p.read_text(errors="replace")
    except OSError:
        return None
    if max_chars is not None and len(text) > max_chars:
        return text[:max_chars] + "\n…[truncated]"
    return text


def _rel(p: Path) -> str:
    """Path relative to vision-tool-orchestration/, with forward
    slashes — what the HTML viewer fetches against the web root."""
    try:
        return p.resolve().relative_to(WORKSPACE).as_posix()
    except ValueError:
        return p.as_posix()


def _scan_extract_pairs(specialist_dir: Path) -> dict[str, Any] | None:
    """Read specialist-extract-measurement-pairs/ for one vision_check call."""
    if not specialist_dir.exists():
        return None
    output = _read_json(specialist_dir / "output.json") or {}
    sub_calls = []
    calls_root = specialist_dir / "extract-measurement-pairs-calls"
    if calls_root.exists():
        for sc in sorted(calls_root.iterdir()):
            if not sc.is_dir():
                continue
            cropped = sc / "cropped.jpg"
            sub_calls.append({
                "id": sc.name,
                "cropped": _rel(cropped) if cropped.exists() else None,
                "prompt": _rel(sc / "prompt.txt") if (sc / "prompt.txt").exists() else None,
                "response": _rel(sc / "response.txt") if (sc / "response.txt").exists() else None,
                "metadata": _rel(sc / "metadata.json") if (sc / "metadata.json").exists() else None,
            })
    return {
        "callDir": _rel(specialist_dir),
        "output": output,
        "pairs": output.get("pairs") if isinstance(output, dict) else None,
        "explanation": output.get("explanation") if isinstance(output, dict) else None,
        "subCalls": sub_calls,
    }


def _scan_measure_distance(specialist_dir: Path) -> dict[str, Any] | None:
    """Read specialist-measure-distance/ for one vision_check call. Each
    sub-call corresponds to one extract-measurement-pair fed in. Per-pair
    final results live in the specialist's output.json as
    `measurements[]`, keyed by callId — we index in via the sub-call's
    dir name."""
    if not specialist_dir.exists():
        return None
    output = _read_json(specialist_dir / "output.json") or {}
    final_by_call: dict[str, Any] = {}
    if isinstance(output, dict):
        for m in output.get("measurements") or []:
            cid = m.get("callId")
            if cid:
                final_by_call[cid] = m
    sub_calls: list[dict[str, Any]] = []
    calls_root = specialist_dir / "measure-distance-calls"
    if calls_root.exists():
        for sc in sorted(calls_root.iterdir()):
            if not sc.is_dir():
                continue
            # Skip the session dir (legend.txt only) — per-pair dirs
            # are the ones with metadata.json + call{1,2} assets.
            if not (sc / "metadata.json").exists():
                continue
            meta = _read_json(sc / "metadata.json") or {}
            call1 = {
                "cropped": _rel(sc / "call1-cropped.jpg") if (sc / "call1-cropped.jpg").exists() else None,
                "prompt": _rel(sc / "call1-prompt.txt") if (sc / "call1-prompt.txt").exists() else None,
                "response": _rel(sc / "call1-response.txt") if (sc / "call1-response.txt").exists() else None,
                "legendImage": _rel(sc / "call1-legend-0.jpg") if (sc / "call1-legend-0.jpg").exists() else None,
                "localization": _read_json(sc / "call1-localization.json"),
            }
            call2 = {
                "cropped": _rel(sc / "call2-cropped.jpg") if (sc / "call2-cropped.jpg").exists() else None,
                "prompt": _rel(sc / "call2-prompt.txt") if (sc / "call2-prompt.txt").exists() else None,
                "response": _rel(sc / "call2-response.txt") if (sc / "call2-response.txt").exists() else None,
                "legendImage": _rel(sc / "call2-legend-0.jpg") if (sc / "call2-legend-0.jpg").exists() else None,
                "localization": _read_json(sc / "call2-localization.json"),
            }
            final = final_by_call.get(sc.name)
            sub_calls.append({
                "id": sc.name,
                "objectA": meta.get("inputs", {}).get("objectA") if isinstance(meta, dict) else None,
                "objectB": meta.get("inputs", {}).get("objectB") if isinstance(meta, dict) else None,
                "scaleInchesPerFoot": meta.get("inputs", {}).get("scaleInchesPerFoot") if isinstance(meta, dict) else None,
                "reasoning": meta.get("reasoning") if isinstance(meta, dict) else None,
                "call1": call1,
                "call2": call2,
                "finalResult": final,
                "debugImage": _rel(sc / "debug.png") if (sc / "debug.png").exists() else None,
                "legendText": _read_text(sc / "legend.txt", max_chars=4000),
            })
    return {
        "callDir": _rel(specialist_dir),
        "measurements": output.get("measurements") if isinstance(output, dict) else None,
        "subCalls": sub_calls,
    }


def _scan_vision_check_call(call_dir: Path, run_index: str) -> dict[str, Any] | None:
    meta = _read_json(call_dir / "metadata.json")
    if meta is None:
        return None
    entry: dict[str, Any] = {
        "callId": call_dir.name,
        "runIndex": run_index,
        "startedAt": meta.get("startedAt"),
        "completedAt": meta.get("completedAt"),
        "inputs": meta.get("inputs") or {},
        "classifier": meta.get("classifier") or {},
        "dispatch": meta.get("dispatch") or {},
        "phase": meta.get("phase"),
    }
    iid = entry["inputs"].get("checklistItemId") or ""
    entry["itemIdShort"] = iid.split(":", 1)[-1] if ":" in iid else iid

    # Specialist sub-directories (only present for measurement classifications)
    extract = _scan_extract_pairs(call_dir / "specialist-extract-measurement-pairs")
    md = _scan_measure_distance(call_dir / "specialist-measure-distance")
    if extract:
        entry["specialistExtract"] = extract
    if md:
        entry["specialistMeasureDistance"] = md
    return entry


def _scan_run(run_dir: Path) -> list[dict[str, Any]]:
    out = []
    calls_root = run_dir / "vision-check-calls"
    if not calls_root.exists():
        return out
    run_index = run_dir.name  # e.g. "run-1"
    for cd in sorted(calls_root.iterdir()):
        if not cd.is_dir():
            continue
        entry = _scan_vision_check_call(cd, run_index)
        if entry:
            out.append(entry)
    return out


def _scan_variant(variant_dir: Path) -> dict[str, Any] | None:
    """variant_dir = source-runs/<set>/var-2."""
    metadata = _read_json(variant_dir / "run-metadata.json") or {}
    runs_root = variant_dir / "output" / "runs"
    if not runs_root.exists():
        print(f"  skip {_rel(variant_dir)}: no output/runs/")
        return None
    calls: list[dict[str, Any]] = []
    run_dirs = []
    for rd in sorted(runs_root.iterdir()):
        if rd.is_dir() and rd.name.startswith("run-"):
            run_dirs.append(rd.name)
            calls.extend(_scan_run(rd))
    return {
        "set": metadata.get("set") or variant_dir.parent.name,
        "variant": metadata.get("variant") or variant_dir.name,
        "runLabel": metadata.get("runLabel"),
        "submission": metadata.get("submission"),
        "model": metadata.get("model"),
        "bureauCommit": metadata.get("bureauCommit"),
        "conductorPr": metadata.get("conductorPr"),
        "startedAt": metadata.get("startedAt"),
        "completedAt": metadata.get("completedAt"),
        "runs": run_dirs,
        "calls": calls,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-set", default=None,
                        help="Only scan this experiment set (e.g. el-md-exp). Default: all sets that have a var-2/ dir.")
    parser.add_argument("--source-variant", default="var-2",
                        help="Variant directory name to scan. Default: var-2.")
    args = parser.parse_args()

    variant_dirs: list[Path] = []
    if args.source_set:
        candidate = SOURCE_RUNS_ROOT / args.source_set / args.source_variant
        if candidate.exists():
            variant_dirs.append(candidate)
    else:
        for set_dir in sorted(SOURCE_RUNS_ROOT.iterdir()):
            if not set_dir.is_dir():
                continue
            candidate = set_dir / args.source_variant
            if candidate.exists():
                variant_dirs.append(candidate)

    if not variant_dirs:
        print(f"No variant dirs found under {_rel(SOURCE_RUNS_ROOT)}.")
        return

    sources: list[dict[str, Any]] = []
    total_calls = 0
    for vd in variant_dirs:
        print(f"scanning {_rel(vd)}")
        scanned = _scan_variant(vd)
        if scanned is not None:
            sources.append(scanned)
            total_calls += len(scanned["calls"])
            print(f"  → {len(scanned['calls'])} vision_check calls "
                  f"across {len(scanned['runs'])} runs")

    manifest = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "totalCalls": total_calls,
        "sources": sources,
    }
    OUT_PATH.write_text(json.dumps(manifest, indent=2))
    print(f"\nwrote {_rel(OUT_PATH)} ({total_calls} calls, {len(sources)} source(s))")


if __name__ == "__main__":
    main()
