#!/usr/bin/env python3
"""
Scan test-script and experiment-run directories under runs/ and emit a
manifest.json the viewer can consume. Browsers can't list directories,
so we pre-compute this.

Supported layouts:
  1. test-fixture runs: runs/*-test-fixture-*/{input,output}/<case-id>/measure-distance-calls/<callId>/
  2. experiment runs:   runs/experiment-run*/measure-distance-calls/<callId>/  (flat, callId encodes run+item)

Usage:
  ./build-manifest.py                # scans all matching dirs, writes ./manifest.json
  ./build-manifest.py --run test-1   # narrow to one test-script run

Output shape:
  {
    "generatedAt": ISO-timestamp,
    "runs": [
      {
        "id": "test-1",
        "source": "test-script" | "experiment",
        "fixturePath": "...",
        "cases": [
          {
            "id": "run-1-item-2-1",
            "inputs": { projectId, documentId, sheetNum, objectA, objectB, scaleInchesPerFoot },
            "reasoning": "...",                  # agent reasoning (experiment runs only)
            "applicableChecklistItems": [...],   # agent-declared checklist items
            "likelyChecklistItems": [...],       # post-hoc mapped checklist items
            "provenance": {...},                 # from fixture, if present
            "croppedJpegPath": "runs/.../cropped.jpg",  # relative to workspace root
            "debugPngPath": "runs/.../debug.png" | null,
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
RUNS_DIR = ROOT / 'runs'


def relpath(p: Path) -> str:
    """Path relative to the workspace root (measure-distance-tool/)."""
    return str(p.relative_to(ROOT))


def load_json(p: Path) -> dict | None:
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


# ── Shared: extract case dict from a call-dir ────────────────────────────

def _case_from_call_dir(call_dir: Path | None, case_id: str,
                        fixture_case: dict | None) -> dict:
    """Assemble one case entry from a call-dir + its fixture definition."""
    out: dict = {
        'id': case_id,
        'inputs': {},
        'reasoning': None,
        'applicableChecklistItems': [],
        'likelyChecklistItems': [],
        'provenance': None,
        'callDirPath': None,
        'croppedJpegPath': None,
        'debugPngPath': None,
        'sheetJpegPath': None,
        'sheetPdfPath': None,
        'promptPath': None,
        'responsePath': None,
        'legendPath': None,
        'eventsPath': None,
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
        out['reasoning'] = fixture_case.get('reasoning') or None
        out['applicableChecklistItems'] = fixture_case.get('applicableChecklistItems', [])
        out['likelyChecklistItems'] = fixture_case.get('likelyChecklistItems', [])
        out['provenance'] = fixture_case.get('_provenance')

    if call_dir and call_dir.exists():
        # Pull reasoning + checklist items from metadata if not already set by fixture
        meta_for_reasoning = load_json(call_dir / 'metadata.json') or {}
        if not out['reasoning']:
            out['reasoning'] = meta_for_reasoning.get('reasoning') or None
        if not out['applicableChecklistItems']:
            out['applicableChecklistItems'] = meta_for_reasoning.get('applicableChecklistItems', [])

        out['callDirPath'] = relpath(call_dir)
        debug = call_dir / 'debug.png'
        sheet_jpg = call_dir / 'tmp' / 'sheet.jpg'
        sheet_pdf = call_dir / 'tmp' / 'sheet.pdf'
        legend = call_dir / 'legend.txt'
        events = call_dir / 'events.jsonl'
        out['debugPngPath'] = relpath(debug) if debug.exists() else None
        out['sheetJpegPath'] = relpath(sheet_jpg) if sheet_jpg.exists() else None
        out['sheetPdfPath'] = relpath(sheet_pdf) if sheet_pdf.exists() else None
        out['legendPath'] = relpath(legend) if legend.exists() else None
        out['eventsPath'] = relpath(events) if events.exists() else None

        # Detect two-call vs single-call artifact pattern.
        # Two-call: call1-cropped.jpg, call1-localization.json, call2-cropped.jpg, etc.
        # Single-call (legacy): cropped.jpg, localization.json, prompt.txt, etc.
        has_two_calls = (call_dir / 'call1-localization.json').exists() or \
                        (call_dir / 'call2-localization.json').exists()

        if has_two_calls:
            out['twoCallMode'] = True
            for prefix in ('call1', 'call2'):
                step: dict = {
                    'croppedJpegPath': None,
                    'promptPath': None,
                    'responsePath': None,
                    'localization': None,
                }
                cropped = call_dir / f'{prefix}-cropped.jpg'
                prompt = call_dir / f'{prefix}-prompt.txt'
                response = call_dir / f'{prefix}-response.txt'
                loc = call_dir / f'{prefix}-localization.json'
                step['croppedJpegPath'] = relpath(cropped) if cropped.exists() else None
                step['promptPath'] = relpath(prompt) if prompt.exists() else None
                step['responsePath'] = relpath(response) if response.exists() else None
                step['localization'] = load_json(loc)
                out[prefix] = step

            # The "final" localization used by compute-distance is whichever
            # call won — prefer call2, fall back to call1.
            out['localization'] = (out.get('call2') or {}).get('localization') \
                               or (out.get('call1') or {}).get('localization')
            # The "final" cropped image is the one compute-distance used
            out['croppedJpegPath'] = (out.get('call2') or {}).get('croppedJpegPath') \
                                  or (out.get('call1') or {}).get('croppedJpegPath')
            out['promptPath'] = (out.get('call2') or {}).get('promptPath') \
                             or (out.get('call1') or {}).get('promptPath')
            out['responsePath'] = (out.get('call2') or {}).get('responsePath') \
                               or (out.get('call1') or {}).get('responsePath')
        else:
            out['twoCallMode'] = False
            cropped = call_dir / 'cropped.jpg'
            prompt = call_dir / 'prompt.txt'
            response = call_dir / 'response.txt'
            out['croppedJpegPath'] = relpath(cropped) if cropped.exists() else None
            out['promptPath'] = relpath(prompt) if prompt.exists() else None
            out['responsePath'] = relpath(response) if response.exists() else None
            out['localization'] = load_json(call_dir / 'localization.json')
        meta = load_json(call_dir / 'metadata.json') or {}
        out['metadata'] = {
            'callId': meta.get('callId'),
            'startedAt': meta.get('startedAt'),
            'strategy': meta.get('strategy'),
            'optionB': meta.get('optionB'),
            'assets': {
                'drawingBbox': (meta.get('assets') or {}).get('drawingBbox'),
                'legendSource': (meta.get('assets') or {}).get('legendSource'),
                'bucket': (meta.get('assets') or {}).get('bucket'),
                'pdfStoragePath': (meta.get('assets') or {}).get('pdfStoragePath'),
                'jpegStoragePath': (meta.get('assets') or {}).get('jpegStoragePath'),
            },
            'error': meta.get('error'),
            'elapsedMs': meta.get('elapsedMs'),
        }

    # measure-distance.json lives in the case dir for test-script runs,
    # but doesn't exist for experiment runs (result is inside metadata).
    # Check the call_dir parent for test-script layout.
    final_result = None
    if call_dir and call_dir.exists():
        # test-script layout: measure-distance.json is sibling to measure-distance-calls/
        case_parent = call_dir.parent.parent  # up from <callId>/ -> measure-distance-calls/ -> case-dir/
        final_json = case_parent / 'measure-distance.json'
        if final_json.exists():
            final_result = load_json(final_json)
        # experiment layout: result is embedded in metadata
        if not final_result:
            meta = load_json(call_dir / 'metadata.json') or {}
            r = meta.get('result')
            if r and r.get('distanceFeet') is not None:
                final_result = {
                    'distanceFeet': r.get('distanceFeet'),
                    'distanceInches': r.get('distanceInches'),
                    'confidence': r.get('confidence'),
                    'method': r.get('method'),
                }

    if final_result:
        out['finalResult'] = final_result

    # Determine outcome
    if out['finalResult']:
        out['outcome'] = 'success'
    elif out['metadata'] and out['metadata'].get('error'):
        out['outcome'] = 'compute_error'
    elif out['metadata'] and not (out['metadata'].get('optionB') or {}).get('success'):
        out['outcome'] = 'gemini_failed'
    elif not call_dir or not call_dir.exists():
        out['outcome'] = 'no_calldir'
    else:
        out['outcome'] = 'unknown'

    return out


# ── Test-script runs ─────────────────────────────────────────────────────

def build_case_testscript(case_dir: Path, fixture_case: dict | None) -> dict:
    """Assemble one case entry from a test-script case-dir."""
    calls_root = case_dir / 'measure-distance-calls'
    call_dir = None
    if calls_root.exists():
        subs = sorted([d for d in calls_root.iterdir() if d.is_dir()])
        if subs:
            call_dir = subs[0]
    return _case_from_call_dir(call_dir, case_dir.name, fixture_case)


def build_run_testscript(run_dir: Path) -> dict:
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
            cases.append(build_case_testscript(case_dir, fx))

    return {
        'id': run_dir.name,
        'source': 'test-script',
        'fixturePath': relpath(fixture_path) if fixture_path else None,
        'fixtureDescription': (fixture or {}).get('description'),
        'cases': cases,
    }


# ── Experiment runs ──────────────────────────────────────────────────────

def build_experiment_run(exp_dir: Path) -> list[dict]:
    """Build manifest runs from an experiment directory.

    An experiment dir has:
      measure-distance-calls/<callId>/   (flat, callId suffix = run-N-M)

    We also look for a matching fixture in replay/fixtures/ to get
    the agent's reasoning and applicable_checklist_items.
    """
    calls_root = exp_dir / 'measure-distance-calls'
    if not calls_root.exists():
        return []

    # Try to find a matching fixture
    fixture_dir = ROOT / 'replay' / 'fixtures'
    fixture = None
    fixture_path = None
    exp_name = exp_dir.name  # e.g. experiment-run2-2026-04-16
    if fixture_dir.exists():
        for p in sorted(fixture_dir.glob('*.json')):
            if exp_name in p.stem:
                fixture = load_json(p)
                fixture_path = p
                break

    fixture_by_id = {}
    if fixture:
        for tc in fixture.get('testCases', []):
            fixture_by_id[tc.get('id')] = tc

    # Group call dirs by suffix (run-N-M) to build per-calldir cases
    call_dirs = sorted([d for d in calls_root.iterdir() if d.is_dir()])

    # Build a case for each fixture test case, matching to call dirs
    # The fixture is ordered by time (matching tool_use order), so we
    # consume call dirs in order per suffix group.
    suffix_queues: dict[str, list[Path]] = {}
    for cd in call_dirs:
        parts = cd.name.split('-')
        suffix = '-'.join(parts[-3:])  # run-N-M
        suffix_queues.setdefault(suffix, []).append(cd)

    cases = []
    if fixture:
        used_call_dirs = set()
        for tc in fixture.get('testCases', []):
            case_id = tc['id']
            prov = tc.get('_provenance', {})
            captured = prov.get('capturedOutcome', {})
            expected_cd = captured.get('callDir')

            call_dir = None
            if expected_cd:
                cd_path = calls_root / expected_cd
                if cd_path.exists():
                    call_dir = cd_path
                    used_call_dirs.add(expected_cd)

            cases.append(_case_from_call_dir(call_dir, case_id, tc))
    else:
        # No fixture: build cases directly from call dirs that have metadata.
        # Skip session dirs (shared-setup containers with just legend.txt) —
        # they don't have metadata.json and aren't individual measurements.
        for cd in call_dirs:
            meta = load_json(cd / 'metadata.json')
            if not meta:
                continue  # session dir — no measurement here
            inputs = meta.get('inputs', {})
            fake_fixture = {
                'projectId': inputs.get('projectId'),
                'documentId': inputs.get('documentId'),
                'sheetNum': str(inputs.get('sheetNum', '')),
                'objectA': inputs.get('objectA', ''),
                'objectB': inputs.get('objectB', ''),
                'scaleInchesPerFoot': str(inputs.get('scaleInchesPerFoot', '')),
                'reasoning': meta.get('reasoning'),
                'applicableChecklistItems': meta.get('applicableChecklistItems', []),
            }
            cases.append(_case_from_call_dir(cd, cd.name, fake_fixture))

    return [{
        'id': exp_dir.name,
        'source': 'experiment',
        'fixturePath': relpath(fixture_path) if fixture_path else None,
        'fixtureDescription': (fixture or {}).get('description'),
        'cases': cases,
    }]


# ── Main ─────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--run', help='Limit to a single run id (e.g. test-1)')
    parser.add_argument('--output', default=str(Path(__file__).resolve().parent / 'manifest.json'),
                        help='Where to write the manifest')
    args = parser.parse_args()

    all_runs: list[dict] = []

    # 1. Scan *-test-fixture-* directories (e.g., run1-test-fixture-1/)
    #    These have input/ and output/ directly inside.
    for tf_dir in sorted(RUNS_DIR.glob('*-test-fixture-*')):
        if not tf_dir.is_dir():
            continue
        if args.run and tf_dir.name != args.run:
            continue
        all_runs.append(build_run_testscript(tf_dir))

    # 2. Scan experiment-run* directories (e.g., experiment-run1/, experiment-run2/)
    for exp_dir in sorted(RUNS_DIR.glob('experiment-run*')):
        if not exp_dir.is_dir():
            continue
        if args.run and exp_dir.name != args.run:
            continue
        all_runs.extend(build_experiment_run(exp_dir))

    if not all_runs:
        print('no runs found under runs/', file=sys.stderr)
        return 1

    manifest = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'runs': all_runs,
    }

    output_path = Path(args.output)
    output_path.write_text(json.dumps(manifest, indent=2))
    total_cases = sum(len(r['cases']) for r in manifest['runs'])
    print(f'wrote {output_path} — {len(manifest["runs"])} run(s), {total_cases} case(s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
