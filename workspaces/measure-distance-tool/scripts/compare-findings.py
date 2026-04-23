#!/usr/bin/env python3
"""
Phase 1 metrics: compare baseline vs experiment findings.

Computes:
  1. Invocation recall — of eligible items, how often did the agent call MD?
  2. Completion rate — of MD invocations, how often did the pipeline produce a result?
  3. Finding conversion rate — baseline not-verifiable → experiment pass/fail?

Usage:
  ./compare-findings.py
  ./compare-findings.py --baseline ../runs/v5.0/baseline-el-md-exp --experiment ../runs/experiment-run2
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
    # Computed for three scopes: distance-only, distance-plus, all-horizontal.
    # Primary metric uses distance-only (items where distance alone can resolve).
    scopes = {
        'distance-only': lambda c: c.get('classification') == 'horizontal' and c.get('subClassification') == 'distance-only',
        'distance-plus': lambda c: c.get('classification') == 'horizontal' and c.get('subClassification') == 'distance-plus',
        'all-horizontal': lambda c: c.get('classification') == 'horizontal',
    }

    invocation_by_scope = {}
    for scope_name, scope_filter in scopes.items():
        eligible_opportunities = 0
        eligible_with_invocation = 0
        for (run, item), findings in experiment_findings.items():
            agent_invocations = md_invocations.get((run, item), [])
            for did, finding in findings.items():
                cls = classification.get(did, {})
                if not scope_filter(cls):
                    continue
                eligible_opportunities += 1
                if agent_invocations:
                    eligible_with_invocation += 1
        recall = eligible_with_invocation / eligible_opportunities if eligible_opportunities else 0
        invocation_by_scope[scope_name] = {
            'eligible': eligible_opportunities,
            'with_invocation': eligible_with_invocation,
            'recall': recall,
        }

    # Primary: distance-only
    eligible_opportunities = invocation_by_scope['distance-only']['eligible']
    eligible_with_invocation = invocation_by_scope['distance-only']['with_invocation']
    invocation_recall = invocation_by_scope['distance-only']['recall']

    # ── More granular: agent-level invocation rate ──
    agents_total = len(experiment_findings)
    agents_with_md = sum(1 for k in experiment_findings if md_invocations.get(k))
    agents_without_md = agents_total - agents_with_md

    # ── Completion rate ──
    # Use call-dirs with metadata (excludes parent batch-orchestrator dirs) as
    # the denominator. This gives a meaningful rate even with objectPairs batching
    # where one MCP invocation fans out into multiple call-dirs.
    total_invocations = sum(len(v) for v in md_invocations.values())
    total_call_dirs = len(call_dir_results)
    call_dirs_with_metadata = sum(1 for v in call_dir_results.values() if v['has_metadata'])
    completed_with_result = sum(1 for v in call_dir_results.values() if v['has_result'])
    completed_with_error = sum(1 for v in call_dir_results.values() if v['error'])
    completion_rate = completed_with_result / call_dirs_with_metadata if call_dirs_with_metadata else 0

    # ── Finding conversion rate ──
    # Computed for each scope. Primary uses distance-only.
    #
    # IMPORTANT: Missing experiment findings = implicit pass. The review workflow
    # only emits findings for non-compliant items. If the baseline had a
    # not-verifiable finding but the experiment has NO finding for that item,
    # the agent evaluated it and determined it was compliant.
    #
    # We iterate over BASELINE findings (not just experiment), so we catch both:
    #   - baseline NV → experiment fail/nv (explicit finding in both)
    #   - baseline NV → experiment missing (implicit pass)
    conversion_by_scope = {}
    conversion_details = []

    for scope_name, scope_filter in scopes.items():
        conversions = Counter()
        total_evaluated = 0

        for (run, item), base_findings in baseline_findings.items():
            exp_findings_for_agent = experiment_findings.get((run, item), {})
            for did, base_finding in base_findings.items():
                cls_item = classification.get(did, {})
                if not scope_filter(cls_item):
                    continue
                base_status = base_finding.get('status', 'missing')
                exp_finding = exp_findings_for_agent.get(did)
                # Missing from experiment = implicit pass (agent found it compliant)
                exp_status = exp_finding['status'] if exp_finding else 'pass (implicit)'
                total_evaluated += 1
                conversions[f'{base_status} → {exp_status}'] += 1

                if base_status == 'not-verifiable' and (
                    exp_status in ('pass', 'fail') or exp_status == 'pass (implicit)'
                ):
                    conversion_details.append({
                        'run': run, 'item': item, 'deficiencyId': did,
                        'baseline': base_status,
                        'experiment': exp_status,
                        'subClassification': cls_item.get('subClassification'),
                        'additionalRequirements': cls_item.get('additionalRequirements', []),
                        'comment': (exp_finding.get('comment', '')[:200] if exp_finding
                                    else '(no finding — item passed)'),
                    })

            # Also catch experiment findings for items NOT in baseline
            # (new items the experiment agent found)
            for did in exp_findings_for_agent:
                if did in base_findings:
                    continue  # already handled above
                cls_item = classification.get(did, {})
                if not scope_filter(cls_item):
                    continue
                exp_status = exp_findings_for_agent[did].get('status', 'missing')
                total_evaluated += 1
                conversions[f'missing → {exp_status}'] += 1

        nv_total = sum(v for k, v in conversions.items() if k.startswith('not-verifiable'))
        nv_converted = sum(v for k, v in conversions.items()
                           if k.startswith('not-verifiable') and
                           ('pass' in k or 'fail' in k))
        conversion_rate = nv_converted / nv_total if nv_total else 0

        # Also compute explicit-only rate for comparison
        nv_explicit = sum(v for k, v in conversions.items()
                          if k.startswith('not-verifiable') and
                          ('fail' in k and 'implicit' not in k))
        nv_implicit_pass = sum(v for k, v in conversions.items()
                               if k.startswith('not-verifiable') and 'implicit' in k)

        conversion_by_scope[scope_name] = {
            'total_evaluated': total_evaluated,
            'conversions': dict(conversions),
            'nv_total': nv_total,
            'nv_converted': nv_converted,
            'nv_to_fail': nv_explicit,
            'nv_to_pass_implicit': nv_implicit_pass,
            'rate': conversion_rate,
        }

    # Primary scope for backward-compatible fields
    conv_primary = conversion_by_scope['distance-only']
    nv_total = conv_primary['nv_total']
    nv_converted = conv_primary['nv_converted']
    conversion_rate = conv_primary['rate']
    conversions = Counter(conv_primary['conversions'])
    total_paired = conv_primary['total_evaluated']

    return {
        'invocation_recall': {
            'eligible_opportunities': eligible_opportunities,
            'eligible_with_invocation': eligible_with_invocation,
            'recall': invocation_recall,
            'agents_total': agents_total,
            'agents_with_md': agents_with_md,
            'agents_without_md': agents_without_md,
            'by_scope': invocation_by_scope,
            'note': 'Primary metric uses distance-only items (where distance alone resolves the verdict). Agent-level attribution: counts as "invoked" if agent made ≥1 MD call.',
        },
        'completion': {
            'total_invocations': total_invocations,
            'total_call_dirs': total_call_dirs,
            'call_dirs_with_metadata': call_dirs_with_metadata,
            'completed_with_result': completed_with_result,
            'completed_with_error': completed_with_error,
            'completion_rate': completion_rate,
        },
        'finding_conversion': {
            'total_paired_eligible': conv_primary['total_evaluated'],
            'conversions': dict(conversions),
            'nv_baseline_count': nv_total,
            'nv_converted_count': nv_converted,
            'conversion_rate': conversion_rate,
            'conversion_details': conversion_details,
            'by_scope': conversion_by_scope,
        },
    }


def format_report(metrics: dict, baseline_name: str, experiment_name: str) -> str:
    """Generate markdown report."""
    inv = metrics['invocation_recall']
    comp = metrics['completion']
    conv = metrics['finding_conversion']

    inv_scopes = inv.get('by_scope', {})
    conv_scopes = conv.get('by_scope', {})
    conv_do = conv_scopes.get('distance-only', {})

    lines = [
        '# Phase 1 — Pilot Metrics: Measure-Distance Tool Validation',
        '',
        f'Baseline: `{baseline_name}` · Experiment: `{experiment_name}`',
        f'Scope: EL guides 1, 2, 13 (101 items: 36 distance-only, 15 distance-plus, 28 not-applicable, 22 vertical)',
        '',
        '---',
        '',
        '## 1. Invocation recall',
        '',
        'Of distance-only items (where distance alone resolves the verdict),',
        'how often did the agent have access to MD tool results?',
        '',
        f'| Metric | Value |',
        f'|--------|------:|',
        f'| Distance-only opportunities | {inv["eligible_opportunities"]} |',
        f'| Opportunities where agent invoked MD ≥1 time | {inv["eligible_with_invocation"]} |',
        f'| **Invocation recall (distance-only)** | **{inv["recall"]:.1%}** |',
        f'| Agents that called MD (of {inv["agents_total"]}) | {inv["agents_with_md"]} |',
        f'| Agents that never called MD | {inv["agents_without_md"]} |',
        '',
        '### By item scope',
        '',
        '| Scope | Eligible | Invoked | Recall |',
        '|-------|--------:|--------:|-------:|',
    ]
    for scope_name in ['distance-only', 'distance-plus', 'all-horizontal']:
        s = inv_scopes.get(scope_name, {})
        lines.append(f'| {scope_name} | {s.get("eligible", 0)} | {s.get("with_invocation", 0)} | {s.get("recall", 0):.1%} |')
    lines.extend([
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
        f'| Call-dirs created | {comp["total_call_dirs"]} |',
        f'| Call-dirs with metadata (denominator) | {comp["call_dirs_with_metadata"]} |',
        f'| Completed with a result | {comp["completed_with_result"]} |',
        f'| Completed with an error | {comp["completed_with_error"]} |',
        f'| **Completion rate** (results / call-dirs with metadata) | **{comp["completion_rate"]:.1%}** |',
        '',
        '## 3. Finding conversion rate',
        '',
        'Of **distance-only** items that were `not-verifiable` in the baseline,',
        'how many converted to `pass` (implicit or explicit) or `fail`?',
        '',
        'Missing experiment finding = **implicit pass** (agent evaluated the item',
        'and found it compliant — the review workflow only emits findings for',
        'non-compliant items).',
        '',
        f'| Transition | Count |',
        f'|-----------|------:|',
    ])
    for k, v in conv['conversions'].items():
        if v > 0:
            lines.append(f'| {k.replace("_", " ")} | {v} |')
    lines.extend([
        '',
        f'| Metric | Value |',
        f'|--------|------:|',
        f'| Baseline not-verifiable (distance-only) | {conv["nv_baseline_count"]} |',
        f'| → explicit fail | {conv_do.get("nv_to_fail", 0)} |',
        f'| → implicit pass (no finding in experiment) | {conv_do.get("nv_to_pass_implicit", 0)} |',
        f'| → still not-verifiable | {conv["nv_baseline_count"] - conv["nv_converted_count"]} |',
        f'| **Total converted (fail + implicit pass)** | **{conv["nv_converted_count"]}** |',
        f'| **Conversion rate** | **{conv["conversion_rate"]:.1%}** |',
        '',
    ])

    # Scope comparison
    lines.extend([
        '',
        '### Conversion by item scope',
        '',
        '| Scope | NV baseline | To fail | To pass (implicit) | Still NV | Converted | Rate |',
        '|-------|----------:|---------:|-------------------:|---------:|----------:|-----:|',
    ])
    for scope_name in ['distance-only', 'distance-plus', 'all-horizontal']:
        s = conv_scopes.get(scope_name, {})
        nv = s.get('nv_total', 0)
        to_fail = s.get('nv_to_fail', 0)
        to_pass = s.get('nv_to_pass_implicit', 0)
        still_nv = nv - s.get('nv_converted', 0)
        converted = s.get('nv_converted', 0)
        rate = s.get('rate', 0)
        lines.append(f'| {scope_name} | {nv} | {to_fail} | {to_pass} | {still_nv} | {converted} | {rate:.1%} |')
    lines.append('')

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
        f'{comp["call_dirs_with_metadata"]} call-dirs with metadata produced a measurement.',
        f'- **Finding conversion rate: {conv["conversion_rate"]:.1%}** — {conv["nv_converted_count"]} of '
        f'{conv["nv_baseline_count"]} not-verifiable baseline findings resolved '
        f'({conv_do.get("nv_to_fail", 0)} to fail, '
        f'{conv_do.get("nv_to_pass_implicit", 0)} to implicit pass).',
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
    parser.add_argument('--baseline', default=str(ROOT / 'runs' / 'v5.0' / 'baseline-el-md-exp'))
    parser.add_argument('--experiment', default=str(ROOT / 'runs' / 'v5.0' / 'experiment-run5'))
    parser.add_argument('--classification', default=str(ROOT / 'analysis' / 'guides' / 'el-md-exp' / 'item-classification.json'))
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
    print(f'  Completion rate:       {comp["completion_rate"]:.1%} ({comp["completed_with_result"]}/{comp["call_dirs_with_metadata"]} call-dirs)')
    do = conv.get('by_scope', {}).get('distance-only', {})
    print(f'  Finding conversion:    {conv["conversion_rate"]:.1%} ({conv["nv_converted_count"]}/{conv["nv_baseline_count"]}) — {do.get("nv_to_fail", 0)} fail + {do.get("nv_to_pass_implicit", 0)} implicit pass')

    return 0


if __name__ == '__main__':
    sys.exit(main())
