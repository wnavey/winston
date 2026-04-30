#!/usr/bin/env python3
"""Build manifest.json for the inspect-drawing debug viewer.

Scans run directories under `runs/` and emits one entry per call dir
under `<run>/.../inspect-drawing-calls/<callId>/`. Browsers can't list
directories, so the viewer reads this manifest at load time.

Supported layouts (mirrors measure-distance-tool's conventions):
  1. test-fixture runs:
        runs/<id>-test-fixture/output/<case-id>/inspect-drawing-calls/<callId>/
        runs/<id>-test-fixture/input/<fixture>.json
  2. experiment runs (flat):
        runs/<id>/inspect-drawing-calls/<callId>/  (or .../output/inspect-drawing-calls/...)

Usage:
  ./build-manifest.py                # scans runs/, writes ./manifest.json
  ./build-manifest.py --run <id>     # narrow to a single run
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # inspect-drawing-tool/
RUNS_DIR = ROOT / "runs"


def relpath(p: Path) -> str:
    return str(p.relative_to(ROOT))


def load_json(p: Path) -> dict | None:
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def case_from_call_dir(
    call_dir: Path | None, case_id: str, fixture_case: dict | None
) -> dict:
    out: dict = {
        "id": case_id,
        "inputs": {},
        "expectedAnswer": None,
        "expectedEvidence": None,
        "provenance": None,
        "callDirPath": None,
        "croppedJpegPath": None,
        "promptPath": None,
        "responsePath": None,
        "eventsPath": None,
        "metadata": None,
        "result": None,
        "outcome": "no_calldir",
    }

    if fixture_case:
        out["inputs"] = {
            k: fixture_case.get(k)
            for k in (
                "projectId",
                "documentId",
                "sheetNum",
                "question",
                "expectedAnswerType",
                "cropMode",
                "regionHint",
            )
            if fixture_case.get(k) is not None
        }
        out["expectedAnswer"] = fixture_case.get("expectedAnswer")
        out["expectedEvidence"] = fixture_case.get("expectedEvidence")
        out["provenance"] = fixture_case.get("_provenance")

    if call_dir and call_dir.exists():
        out["callDirPath"] = relpath(call_dir)
        for fname, key in (
            ("cropped.jpg", "croppedJpegPath"),
            ("prompt.txt", "promptPath"),
            ("response.txt", "responsePath"),
            ("events.jsonl", "eventsPath"),
        ):
            p = call_dir / fname
            if p.exists():
                out[key] = relpath(p)

        meta = load_json(call_dir / "metadata.json") or {}
        if meta:
            # Trim metadata to viewer-relevant fields.
            inputs = meta.get("inputs", {})
            if not out["inputs"]:
                out["inputs"] = {
                    k: inputs.get(k)
                    for k in (
                        "projectId",
                        "documentId",
                        "sheetNum",
                        "question",
                        "expectedAnswerType",
                        "cropMode",
                        "regionHint",
                    )
                    if inputs.get(k) is not None
                }
            out["metadata"] = {
                "callId": meta.get("callId"),
                "cropResolution": meta.get("cropResolution"),
                "renderResult": meta.get("renderResult"),
                "timing": meta.get("timing"),
                "inputs": inputs,
            }
            out["result"] = meta.get("result")

    # Outcome bucketing — what the viewer pill should say.
    r = out.get("result") or {}
    if not call_dir or not call_dir.exists():
        out["outcome"] = "no_calldir"
    elif r.get("unanswerable") is True:
        out["outcome"] = "unanswerable"
    elif r.get("classification") in ("yes", "no", "partial") or isinstance(
        r.get("count"), int
    ):
        out["outcome"] = "answered"
    elif r.get("answerText"):
        out["outcome"] = "answered"
    else:
        out["outcome"] = "unknown"
    return out


def discover_call_dirs(run_dir: Path) -> list[Path]:
    """Find all inspect-drawing-calls/<callId>/ subdirs under a run dir.

    Tries direct, output/, and output/runs/<runIdx>/ layouts.
    """
    candidates = [
        run_dir / "inspect-drawing-calls",
        run_dir / "output" / "inspect-drawing-calls",
    ]
    found = []
    for c in candidates:
        if c.exists():
            for d in sorted(c.iterdir()):
                if d.is_dir():
                    found.append(d)
    # Per-run-index layout (output/runs/<n>/inspect-drawing-calls/<callId>/)
    runs_subdir = run_dir / "output" / "runs"
    if runs_subdir.exists():
        for run_idx_dir in sorted(runs_subdir.iterdir()):
            if not run_idx_dir.is_dir():
                continue
            calls = run_idx_dir / "inspect-drawing-calls"
            if calls.exists():
                for d in sorted(calls.iterdir()):
                    if d.is_dir():
                        found.append(d)
    return found


def build_run_testfixture(run_dir: Path) -> dict:
    """A run dir under runs/ that has input/<fixture>.json + output/<case-id>/inspect-drawing-calls/."""
    input_dir = run_dir / "input"
    fixture = None
    fixture_path: Path | None = None
    if input_dir.exists():
        for p in sorted(input_dir.glob("*.json")):
            fixture = load_json(p)
            fixture_path = p
            break

    fixture_by_id = {}
    if fixture:
        for tc in fixture.get("testCases", []):
            fixture_by_id[tc.get("id")] = tc

    cases: list[dict] = []
    output_dir = run_dir / "output"
    if output_dir.exists():
        for case_dir in sorted(output_dir.iterdir()):
            if not case_dir.is_dir():
                continue
            calls_root = case_dir / "inspect-drawing-calls"
            call_dir = None
            if calls_root.exists():
                subs = sorted([d for d in calls_root.iterdir() if d.is_dir()])
                if subs:
                    call_dir = subs[0]
            cases.append(
                case_from_call_dir(call_dir, case_dir.name, fixture_by_id.get(case_dir.name))
            )

    return {
        "id": run_dir.name,
        "source": "test-fixture",
        "fixturePath": relpath(fixture_path) if fixture_path else None,
        "fixtureDescription": (fixture or {}).get("description"),
        "cases": cases,
    }


def build_run_flat(run_dir: Path) -> dict:
    """A run dir whose calls live directly in inspect-drawing-calls/ (experiment layout)."""
    call_dirs = discover_call_dirs(run_dir)
    cases = []
    for cd in call_dirs:
        cases.append(case_from_call_dir(cd, cd.name, None))
    return {
        "id": run_dir.name,
        "source": "experiment",
        "fixturePath": None,
        "fixtureDescription": None,
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", help="Limit to a single run id")
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parent / "manifest.json"),
        help="Where to write the manifest",
    )
    args = parser.parse_args()

    runs: list[dict] = []
    if RUNS_DIR.exists():
        for run_dir in sorted(RUNS_DIR.iterdir()):
            if not run_dir.is_dir() or run_dir.name.startswith("."):
                continue
            if args.run and run_dir.name != args.run:
                continue
            # Heuristic: input/ + output/ → test-fixture layout; else flat.
            has_input = (run_dir / "input").exists()
            has_output_with_cases = (run_dir / "output").exists() and any(
                (run_dir / "output").iterdir()
            )
            if has_input and has_output_with_cases:
                runs.append(build_run_testfixture(run_dir))
            else:
                if discover_call_dirs(run_dir):
                    runs.append(build_run_flat(run_dir))

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runs": runs,
    }
    output_path = Path(args.output)
    output_path.write_text(json.dumps(manifest, indent=2))
    total_cases = sum(len(r["cases"]) for r in manifest["runs"])
    print(
        f"wrote {output_path} — {len(manifest['runs'])} run(s), {total_cases} case(s)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
