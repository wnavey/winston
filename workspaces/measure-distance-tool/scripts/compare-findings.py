#!/usr/bin/env python3
"""
Phase 1 metrics: compare baseline vs experiment findings.

Computes:
  1. Invocation recall — of eligible items, how often did the agent call MD?
  2. Completion rate — of MD invocations, how often did the pipeline produce a result?
  3. Finding conversion rate — baseline not-verifiable → experiment pass/fail?

Usage:
  ./compare-findings.py
  ./compare-findings.py --baseline ../runs/baseline-2026-04-15 --experiment ../runs/experiment-run2
  ./compare-findings.py --output ../analysis/phase-1-pilot-metrics.md
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # measure-distance-tool/


def load_classification(path: Path) -> dict:
    """Load item classification JSON. Returns {deficiencyId: {classification, ...}}."""
    data = json.loads(path.read_text())
    return data['items']


def load_findings(run_dir: Path) -> dict:
    """Load findings across all runs/items. Returns {(run, item): {deficiencyId: finding}}."""
    results = {}
    for run_path in sorted(run_dir.glob('run-*/findings')):
        run_name = run_path.parent.name  # "run-1", "run-2", "run-3"
        for f in sorted(run_path.glob('*.json')):
            item_name = f.stem  # "1.md", "2.md", "13.md"
            data = json.loads(f.read_text())
            findings_by_id = {}
            for finding in data.get('findings', []):
                did = finding.get('deficiencyId')
                if did:
                    findings_by_id[did] = finding
            results[(run_name, item_name)] = findings_by_id
    return results


def load_md_invocations(run_dir: Path) -> dict:
    """Parse review.log for measure-distance tool_use events.
    Returns {(runIndex, item): [list of invocation dicts]}."""
    log_path = run_dir / 'logs' / 'review.log'
    invocations = defaultdict(list)
    if not log_path.exists():
        return invocations
    for line in log_path.read_text().splitlines():
        try:
            e = json.loads(line)
        except Exception:
            continue
        msg = e.get('message') or {}
        if msg.get('role') != 'assistant':
            continue
        for c in (msg.get('content') or []):
            if c.get('type') == 'tool_use' and 'measure_distance' in c.get('name', ''):
                key = (e.get('runIndex'), e.get('item'))
                inp = c.get('input') or {}
                args = inp.get('args') if isinstance(inp.get('args'), dict) else inp
                invocations[key].append({
                    'tool_use_id': c.get('id'),
                    'sheetNum': args.get('sheetNum'),
                    'objectA': (args.get('objectA') or '')[:80],
                    'objectB': (args.get('objectB') or '')[:80],
                })
    return invocations


def load_call_dir_results(run_dir: Path) -> dict:
    """Parse measure-distance-calls for completion status.
    Returns {callDir_name: {has_result, distanceFeet, confidence, error}}."""
    calls_root = run_dir / 'measure-distance-calls'
    results = {}
    if not calls_root.exists():
        return results
    for d in sorted(calls_root.iterdir()):
        if not d.is_dir():
            continue
        meta_path = d / 'metadata.json'
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        result = meta.get('result') or {}
        results[d.name] = {
            'has_metadata': meta_path.exists(),
            'has_result': bool(result.get('distanceFeet') is not None),
            'distanceFeet': result.get('distanceFeet'),
            'confidence': result.get('confidence'),
            'error': bool(meta.get('error')),
        }
    return results


def compute_metrics(
    classification: dict,
    baseline_findings: dict,
    experiment_findings: dict,
    md_invocations: dict,
    call_dir_results: dict,
) -> dict:
    """Compute all Phase 1 metrics."""

    # ── Invocation recall ──
    # For each (run, item) agent in the experiment, count eligible items
    # and how many had at least one MD call that targeted them.
    eligible_opportunities = 0
    eligible_with_invocation = 0
    eligible_without_invocation = []
    items_per_agent = defaultdict(lambda: {'eligible': 0, 'invoked': 0})

    for (run, item), findings in experiment_findings.items():
        agent_invocations = md_invocations.get((run, item), [])
        for did, finding in findings.items():
            cls = classification.get(did, {})
            if cls.get('classification') != 'horizontal':
                continue
            eligible_opportunities += 1
            items_per_agent[(run, item)]['eligible'] += 1
            # Did the agent invoke MD at all for this agent session?
            # (We can't attribute a specific invocation to a specific deficiency ID
            # without agent tracing — so we use agent-level: ≥1 MD call for this
            # agent means all eligible items in that session "had access" to the tool)
            if agent_invocations:
                eligible_with_invocation += 1
                items_per_agent[(run, item)]['invoked'] += 1
            else:
                eligible_without_invocation.append({
                    'run': run, 'item': item, 'deficiencyId': did,
                    'status': finding.get('status'),
                })

    invocation_recall = eligible_with_invocation / eligible_opportunities if eligible_opportunities else 0

    # ── More granular: agent-level invocation rate ──
    agents_total = len(experiment_findings)
    agents_with_md = sum(1 for k in experiment_findings if md_invocations.get(k))
    agents_without_md = agents_total - agents_with_md

    # ── Completion rate ──
    total_invocations = sum(len(v) for v in md_invocations.values())
    total_call_dirs = len(call_dir_results)
    completed_with_result = sum(1 for v in call_dir_results.values() if v['has_result'])
    completed_with_error = sum(1 for v in call_dir_results.values() if v['error'])
    completion_rate = completed_with_result / total_invocations if total_invocations else 0

    # ── Finding conversion rate ──
    # For each eligible item, compare baseline status to experiment status
    conversions = Counter()
    conversion_details = []
    total_paired = 0

    for (run, item), exp_findings in experiment_findings.items():
        base_findings = baseline_findings.get((run, item), {})
        for did in exp_findings:
            cls = classification.get(did, {})
            if cls.get('classification') != 'horizontal':
                continue
            base_status = base_findings.get(did, {}).get('status', 'missing')
            exp_status = exp_findings[did].get('status', 'missing')
            total_paired += 1
            conversions[f'{base_status} → {exp_status}'] += 1

            if base_status == 'not-verifiable' and exp_status in ('pass', 'fail'):
                conversion_details.append({
                    'run': run, 'item': item, 'deficiencyId': did,
                    'baseline': base_status, 'experiment': exp_status,
                    'comment': exp_findings[did].get('comment', '')[:200],
                })

    nv_total = sum(v for k, v in conversions.items() if k.startswith('not-verifiable'))
    nv_converted = sum(v for k, v in conversions.items()
                       if k.startswith('not-verifiable') and ('pass' in k or 'fail' in k))
    conversion_rate = nv_converted / nv_total if nv_total else 0

    return {
        'invocation_recall': {
            'eligible_opportunities': eligible_opportunities,
            'eligible_with_invocation': eligible_with_invocation,
            'recall': invocation_recall,
            'agents_total': agents_total,
            'agents_with_md': agents_with_md,
            'agents_without_md': agents_without_md,
            'note': 'Agent-level attribution: an eligible item counts as "invoked" if its agent made ≥1 MD call. Without per-finding tracing, we cannot attribute specific invocations to specific items.',
        },
        'completion': {
            'total_invocations': total_invocations,
            'total_call_dirs': total_call_dirs,
            'completed_with_result': completed_with_result,
            'completed_with_error': completed_with_error,
            'completion_rate': completion_rate,
        },
        'finding_conversion': {
            'total_paired_eligible': total_paired,
            'conversions': dict(conversions),
            'nv_baseline_count': nv_total,
            'nv_converted_count': nv_converted,
            'conversion_rate': conversion_rate,
            'conversion_details': conversion_details,
        },
    }


def format_report(metrics: dict, baseline_name: str, experiment_name: str) -> str:
    """Generate markdown report."""
    inv = metrics['invocation_recall']
    comp = metrics['completion']
    conv = metrics['finding_conversion']

    lines = [
        '# Phase 1 — Pilot Metrics: Measure-Distance Tool Validation',
        '',
        f'Baseline: `{baseline_name}` · Experiment: `{experiment_name}`',
        f'Scope: EL guides 1, 2, 13 (101 items, 51 horizontal-eligible) × 3 runs = 9 agents',
        '',
        '---',
        '',
        '## 1. Invocation recall',
        '',
        'Of eligible (horizontal-distance) items, how often did the agent have',
        'access to MD tool results?',
        '',
        f'| Metric | Value |',
        f'|--------|------:|',
        f'| Eligible item × run opportunities | {inv["eligible_opportunities"]} |',
        f'| Opportunities where agent invoked MD ≥1 time | {inv["eligible_with_invocation"]} |',
        f'| **Invocation recall** | **{inv["recall"]:.1%}** |',
        f'| Agents that called MD (of {inv["agents_total"]}) | {inv["agents_with_md"]} |',
        f'| Agents that never called MD | {inv["agents_without_md"]} |',
        '',
        f'> **Note**: {inv["note"]}',
        '',
        '## 2. Completion rate',
        '',
        'Of MD invocations, how often did the pipeline produce a measurement?',
        '',
        f'| Metric | Value |',
        f'|--------|------:|',
        f'| Total MD invocations (from review.log) | {comp["total_invocations"]} |',
        f'| Call-dirs created (reached script) | {comp["total_call_dirs"]} |',
        f'| Completed with a result | {comp["completed_with_result"]} |',
        f'| Completed with an error | {comp["completed_with_error"]} |',
        f'| **Completion rate** | **{comp["completion_rate"]:.1%}** |',
        '',
        '## 3. Finding conversion rate',
        '',
        'Of eligible items that were `not-verifiable` in the baseline, how many',
        'converted to `pass` or `fail` in the experiment?',
        '',
        f'| Transition | Count |',
        f'|-----------|------:|',
    ]
    for k, v in conv['conversions'].items():
        if v > 0:
            lines.append(f'| {k.replace("_", " ")} | {v} |')
    lines.extend([
        '',
        f'| Metric | Value |',
        f'|--------|------:|',
        f'| Baseline not-verifiable (eligible items) | {conv["nv_baseline_count"]} |',
        f'| Converted to pass or fail | {conv["nv_converted_count"]} |',
        f'| **Conversion rate** | **{conv["conversion_rate"]:.1%}** |',
        '',
    ])

    if conv['conversion_details']:
        lines.extend([
            '### Converted findings (not-verifiable → pass/fail)',
            '',
            '| Run | Item | Deficiency | New status | Comment (excerpt) |',
            '|-----|------|-----------|-----------|-------------------|',
        ])
        for d in conv['conversion_details']:
            comment = d['comment'].replace('|', '/').replace('\n', ' ')[:120]
            lines.append(f'| {d["run"]} | {d["item"]} | {d["deficiencyId"]} | {d["experiment"]} | {comment} |')
        lines.append('')

    lines.extend([
        '---',
        '',
        '## Summary',
        '',
        f'- **Invocation recall: {inv["recall"]:.1%}** — {inv["eligible_with_invocation"]} of '
        f'{inv["eligible_opportunities"]} eligible opportunities had an agent that called MD.',
        f'- **Completion rate: {comp["completion_rate"]:.1%}** — {comp["completed_with_result"]} of '
        f'{comp["total_invocations"]} invocations produced a measurement.',
        f'- **Finding conversion rate: {conv["conversion_rate"]:.1%}** — {conv["nv_converted_count"]} of '
        f'{conv["nv_baseline_count"]} not-verifiable baseline findings converted to pass/fail.',
        '',
        '## Methodology notes',
        '',
        '- Item classification source: `analysis/item-classification.json` (parsed from',
        '  `analysis/items-requiring-distance-measurement.md`).',
        '- Invocation recall uses **agent-level** attribution: if an agent made ≥1 MD call,',
        '  all eligible items in that agent session count as "invoked." This overstates recall',
        '  since the agent may not have measured every eligible item. Per-finding attribution',
        '  requires Review 5.0 agent tracing (Phase 3).',
        '- Finding conversion pairs baseline and experiment by (run-index, item-file,',
        '  deficiency-ID). Items present in experiment but missing from baseline are skipped.',
        '- "Horizontal" classification means the item requires plan-view distance measurement',
        '  that the tool CAN perform. "Vertical-or-mixed" items are excluded from eligible',
        '  counts but tracked separately.',
    ])

    return '\n'.join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description='Phase 1 pilot metrics')
    parser.add_argument('--baseline', default=str(ROOT / 'runs' / 'baseline-2026-04-15'))
    parser.add_argument('--experiment', default=str(ROOT / 'runs' / 'experiment-run2'))
    parser.add_argument('--classification', default=str(ROOT / 'analysis' / 'item-classification.json'))
    parser.add_argument('--output', default=str(ROOT / 'analysis' / 'phase-1-pilot-metrics.md'))
    parser.add_argument('--json-output', default=str(ROOT / 'analysis' / 'phase-1-pilot-metrics.json'))
    args = parser.parse_args()

    baseline_dir = Path(args.baseline)
    experiment_dir = Path(args.experiment)
    cls_path = Path(args.classification)

    if not baseline_dir.exists():
        print(f'error: baseline dir not found: {baseline_dir}', file=sys.stderr)
        return 1
    if not experiment_dir.exists():
        print(f'error: experiment dir not found: {experiment_dir}', file=sys.stderr)
        return 1
    if not cls_path.exists():
        print(f'error: classification file not found: {cls_path}', file=sys.stderr)
        return 1

    classification = load_classification(cls_path)
    baseline_findings = load_findings(baseline_dir)
    experiment_findings = load_findings(experiment_dir)
    md_invocations = load_md_invocations(experiment_dir)
    call_dir_results = load_call_dir_results(experiment_dir)

    print(f'Loaded: {len(classification)} classified items, '
          f'{len(baseline_findings)} baseline agents, '
          f'{len(experiment_findings)} experiment agents, '
          f'{sum(len(v) for v in md_invocations.values())} MD invocations, '
          f'{len(call_dir_results)} call-dirs')

    metrics = compute_metrics(
        classification, baseline_findings, experiment_findings,
        md_invocations, call_dir_results,
    )

    # Write JSON
    json_out = Path(args.json_output)
    json_out.write_text(json.dumps(metrics, indent=2))
    print(f'Wrote {json_out}')

    # Write markdown
    md_out = Path(args.output)
    report = format_report(metrics, baseline_dir.name, experiment_dir.name)
    md_out.write_text(report)
    print(f'Wrote {md_out}')

    # Print summary
    inv = metrics['invocation_recall']
    comp = metrics['completion']
    conv = metrics['finding_conversion']
    print(f'\n=== Phase 1 Summary ===')
    print(f'  Invocation recall:     {inv["recall"]:.1%} ({inv["eligible_with_invocation"]}/{inv["eligible_opportunities"]})')
    print(f'  Completion rate:       {comp["completion_rate"]:.1%} ({comp["completed_with_result"]}/{comp["total_invocations"]})')
    print(f'  Finding conversion:    {conv["conversion_rate"]:.1%} ({conv["nv_converted_count"]}/{conv["nv_baseline_count"]})')

    return 0


if __name__ == '__main__':
    sys.exit(main())
