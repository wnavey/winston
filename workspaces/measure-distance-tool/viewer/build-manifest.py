#!/usr/bin/env python3
"""
Scan test-script-runs/*/output/ and emit a manifest.json the viewer can
consume. Browsers can't list directories, so we pre-compute this.

Usage:
  ./build-manifest.py                # scans ../test-script-runs/, writes ./manifest.json
  ./build-manifest.py --run test-1   # narrow to one run

Output shape:
  {
    "generatedAt": ISO-timestamp,
    "runs": [
      {
        "id": "test-1",
        "fixturePath": "test-script-runs/test-1/input/<name>.json",
        "cases": [
          {
            "id": "run-1-item-2-1",
            "inputs": { projectId, documentId, sheetNum, objectA, objectB, scaleInchesPerFoot },
            "provenance": {...},                 # from fixture, if present
            "croppedJpegPath": "test-script-runs/.../cropped.jpg",  # relative to workspace root
            "debugPngPath": "test-script-runs/.../debug.png" | null,
            "localization": {...} | null,        # parsed localization.json
            "metadata": {...} | null,            # parsed metadata.json (trimmed)
            "finalResult": {...} | null,         # parsed measure-distance.json
            "outcome": "success" | "compute_error" | "gemini_failed" | "no_calldir"
          }, ...
        ]
      }, ...
    ]
  }
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # measure-distance-tool/
RUNS_DIR = ROOT / 'test-script-runs'


def relpath(p: Path) -> str:
    """Path relative to the workspace root (measure-distance-tool/)."""
    return str(p.relative_to(ROOT))


def load_json(p: Path) -> dict | None:
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def build_case(case_dir: Path, fixture_case: dict | None) -> dict:
    """Assemble one case entry from a case-dir + its fixture definition."""
    cid = case_dir.name
    calls_root = case_dir / 'measure-distance-calls'
    call_dir = None
    if calls_root.exists():
        subs = sorted([d for d in calls_root.iterdir() if d.is_dir()])
        if subs:
            call_dir = subs[0]  # one invocation per test case in test-script

    out: dict = {
        'id': cid,
        'inputs': {},
        'provenance': None,
        'croppedJpegPath': None,
        'debugPngPath': None,
        'localization': None,
        'metadata': None,
        'finalResult': None,
        'outcome': 'no_calldir',
    }

    if fixture_case:
        out['inputs'] = {
            k: fixture_case.get(k)
            for k in ('projectId', 'documentId', 'sheetNum', 'objectA', 'objectB', 'scaleInchesPerFoot')
        }
        out['likelyChecklistItems'] = fixture_case.get('likelyChecklistItems', [])
        out['provenance'] = fixture_case.get('_provenance')

    if call_dir:
        cropped = call_dir / 'cropped.jpg'
        debug = call_dir / 'debug.png'
        out['croppedJpegPath'] = relpath(cropped) if cropped.exists() else None
        out['debugPngPath'] = relpath(debug) if debug.exists() else None
        out['localization'] = load_json(call_dir / 'localization.json')
        meta = load_json(call_dir / 'metadata.json') or {}
        # Trim the metadata: keep only the fields the viewer shows
        out['metadata'] = {
            'callId': meta.get('callId'),
            'startedAt': meta.get('startedAt'),
            'strategy': meta.get('strategy'),
            'optionB': meta.get('optionB'),
            'assets': {
                'drawingBbox': (meta.get('assets') or {}).get('drawingBbox'),
                'legendSource': (meta.get('assets') or {}).get('legendSource'),
                'bucket': (meta.get('assets') or {}).get('bucket'),
            },
            'error': meta.get('error'),
            'elapsedMs': meta.get('elapsedMs'),
        }

    final = case_dir / 'measure-distance.json'
    if final.exists():
        out['finalResult'] = load_json(final)

    # Determine outcome
    if out['finalResult']:
        out['outcome'] = 'success'
    elif out['metadata'] and out['metadata'].get('error'):
        out['outcome'] = 'compute_error'
    elif out['metadata'] and not (out['metadata'].get('optionB') or {}).get('success'):
        out['outcome'] = 'gemini_failed'
    elif not call_dir:
        out['outcome'] = 'no_calldir'
    else:
        out['outcome'] = 'unknown'

    return out


def build_run(run_dir: Path) -> dict:
    # Locate the fixture (one JSON in input/)
    input_dir = run_dir / 'input'
    fixture_path = None
    fixture = None
    if input_dir.exists():
        for p in sorted(input_dir.glob('*.json')):
            fixture_path = p
            fixture = load_json(p)
            break

    fixture_by_id = {}
    if fixture:
        for tc in fixture.get('testCases', []):
            fixture_by_id[tc.get('id')] = tc

    output_dir = run_dir / 'output'
    cases = []
    if output_dir.exists():
        for case_dir in sorted(output_dir.iterdir()):
            if not case_dir.is_dir():
                continue
            fx = fixture_by_id.get(case_dir.name)
            cases.append(build_case(case_dir, fx))

    return {
        'id': run_dir.name,
        'fixturePath': relpath(fixture_path) if fixture_path else None,
        'fixtureDescription': (fixture or {}).get('description'),
        'cases': cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--run', help='Limit to a single run id (e.g. test-1)')
    parser.add_argument('--output', default=str(Path(__file__).resolve().parent / 'manifest.json'),
                        help='Where to write the manifest')
    args = parser.parse_args()

    if not RUNS_DIR.exists():
        print(f'no test-script-runs/ directory at {RUNS_DIR}', file=sys.stderr)
        return 1

    run_dirs = sorted([d for d in RUNS_DIR.iterdir() if d.is_dir()])
    if args.run:
        run_dirs = [d for d in run_dirs if d.name == args.run]
        if not run_dirs:
            print(f'no such run: {args.run}', file=sys.stderr)
            return 1

    manifest = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'runs': [build_run(d) for d in run_dirs],
    }

    output_path = Path(args.output)
    output_path.write_text(json.dumps(manifest, indent=2))
    total_cases = sum(len(r['cases']) for r in manifest['runs'])
    print(f'wrote {output_path} — {len(manifest["runs"])} run(s), {total_cases} case(s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
