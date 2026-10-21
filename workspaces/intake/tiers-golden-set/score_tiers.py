"""Score intake-prospecting runs against golden-set.json (CLASSIFY-LOOP-SPEC.md D7, §3.5, §3.7).

Reads each run's 1.4-classify/classification.json (or basis.json for a run from before the change)
and writes scorecard.md + scorecard.json into the pass dir (the runs' common parent, or --out):

    python3 -I score_tiers.py --runs ~/noetic/working/intake-prospecting/tiers/p00/*
    python3 -I score_tiers.py --runs ~/noetic/working/intake-prospecting/el-paso --out /tmp/x

- the gate confusion matrix (truth yes/no x predicted yes/no/unknown)
- Tier 1 vs Tier 2 on gated cities only
- every miss with its predicted gate, tier, quotes and rationale, and the diagnosis from the pass
  dir's diagnoses.json ({id: {kind: discovery|judgment|key, note}}) once one is written
- per-run list $ and minutes, and the pass's 5h / 7d window use from usage.jsonl

A run that failed before 1.4 wrote its output is a tool failure: listed, never scored as a miss.
The bar (D11) is judged only for a full (F) pass over all 15 core cities.
"""
import argparse, json, os, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tiers  # noqa: E402

ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
ap.add_argument('--runs', nargs='+', required=True, help='run dirs (non-run entries such as scorecard.md are skipped)')
ap.add_argument('--out', help='where scorecard.{md,json} go (default: the runs\' common parent)')
args = ap.parse_args()

G = tiers.golden()
runs = [os.path.abspath(r) for r in args.runs if os.path.isdir(os.path.join(r, '0-request'))]
if not runs:
    raise SystemExit('no run dirs (a run dir holds 0-request/)')
out_dir = os.path.abspath(args.out or os.path.commonpath([os.path.dirname(r) for r in runs]))
P = tiers.pass_info(out_dir)
diagnoses = tiers.read_json(os.path.join(out_dir, 'diagnoses.json'), {}) or {}


def cost(run, since):
    """List $ and step minutes for the front half, from the run's ledger. A replay counts only
    the rows written after it started (its ledger carries the full run's rows too)."""
    usd = ms = 0.0
    for r in tiers.jsonl(os.path.join(run, 'ledger.jsonl')):
        if r.get('pending') or r.get('step') not in tiers.FRONT:
            continue
        if since and (tiers.ts(r.get('ts')) or 0) < since:
            continue
        usd += r.get('seat_usd') or r.get('usd') or 0
        ms += r.get('ms') or 0
    return round(usd, 2), round(ms / 60000, 1)


def wall_minutes(run, since):
    ev = [e for e in tiers.jsonl(os.path.join(run, 'events.jsonl')) if (tiers.ts(e.get('ts')) or 0) >= (since or 0)]
    starts = [tiers.ts(e['ts']) for e in ev if e.get('kind') == 'step.start']
    ends = [tiers.ts(e['ts']) for e in ev if e.get('kind') == 'park' and e.get('step_path') == '1.5-scope'] or \
           [tiers.ts(e['ts']) for e in ev if e.get('kind') == 'step.exit' and e.get('step_path') == '1.4-classify']
    return round((min(ends) - min(starts)) / 60, 1) if starts and ends else None


def had_prospector(run, slug):
    """Seeds from prospector, or a jurisdictions/<slug>/ folder in the run's worktree (spec §4 risk)."""
    seeds = tiers.read_json(os.path.join(run, '1.1-inputs', 'seeds.json'), {}) or {}
    wt = os.path.join(run, '1.0-worktree', 'worktree', 'jurisdictions', slug)
    return {'seeds': len(seeds.get('seeds') or []), 'folder': os.path.isdir(wt)}


rows, unmapped = [], []
for run in sorted(runs):
    req = tiers.read_json(os.path.join(run, '0-request', 'request.json'), {}) or {}
    jur = req.get('jurisdiction', {})
    gid = tiers.id_for(jur.get('slug'), jur.get('state'))
    if not gid:
        unmapped.append(run)
        continue
    truth = G[gid]
    info = dict(P.get('runs', {}).get(gid, {}), kind=P.get('kind'))
    state = tiers.run_state(run, info)
    pred = tiers.classify_output(run)
    since = info.get('started_epoch') if P.get('kind') == 'R' else None
    usd, step_min = cost(run, since)
    row = {'id': gid, 'run': run, 'set': truth['set'], 'state': state,
           'truth': {'gate': truth['gate'], 'tier': truth['tier']},
           'pred': pred, 'usd': usd, 'step_minutes': step_min, 'wall_minutes': wall_minutes(run, since),
           'prospector': had_prospector(run, jur['slug']), 'resumed': bool(info.get('resumed')),
           'diagnosis': diagnoses.get(gid)}
    if pred and state not in ('running', 'set-up'):
        g = pred['gate']
        row['gate_result'] = 'unmeasured' if g == 'n/a' else 'unknown' if g in ('unknown', None) else \
            'right' if g == truth['gate'] else 'wrong'
        if truth['gate'] == 'yes':
            row['tier_result'] = 'right' if pred['tier'] == truth['tier'] else \
                'unmeasured' if g == 'n/a' else 'wrong'
    rows.append(row)

scored = [r for r in rows if 'gate_result' in r]
gate = Counter(r['gate_result'] for r in scored)
gated = [r for r in scored if r['truth']['gate'] == 'yes']
tier_right = sum(r.get('tier_result') == 'right' for r in gated)
matrix = {t: Counter() for t in ('yes', 'no')}
for r in scored:
    matrix[r['truth']['gate']][r['pred']['gate'] or 'unknown'] += 1
tier_matrix = {t: Counter() for t in (1, 2)}
for r in gated:
    if r['truth']['tier'] in tier_matrix:
        tier_matrix[r['truth']['tier']][str(r['pred']['tier'])] += 1

core = [i for i, e in G.items() if e['set'] == 'core']
core_scored = {r['id'] for r in scored if r['set'] == 'core'}
full_core = P.get('kind', 'F') == 'F' and set(core) <= core_scored
bar = None
if full_core:
    c = [r for r in scored if r['set'] == 'core']
    cg = Counter(r['gate_result'] for r in c)
    cgated = [r for r in c if r['truth']['gate'] == 'yes']
    bar = {'gate_wrong': cg['wrong'], 'gate_unknown': cg['unknown'] + cg['unmeasured'],
           'tier_right_on_gated': sum(r.get('tier_result') == 'right' for r in cgated), 'gated': len(cgated)}
    bar['met'] = bar['gate_wrong'] == 0 and bar['gate_unknown'] <= 1 and bar['tier_right_on_gated'] == bar['gated']

# Window use per batch: the change between a batch's before and after records (usage.jsonl).
usage = tiers.jsonl(os.path.join(out_dir, 'usage.jsonl'))
batches = {}
for u in usage:
    batches.setdefault(u.get('batch'), {})[u.get('phase')] = u
window = []
for b, ph in sorted(batches.items(), key=lambda kv: str(kv[0])):
    if 'before' in ph and 'after' in ph:
        d = {}
        for w in ('five_hour', 'seven_day'):
            before, after = ph['before'].get(w), ph['after'].get(w)
            if before is None or after is None:
                continue
            reset = (ph['after'].get(w + '_resets_at') or 0) > (ph['before'].get(w + '_resets_at') or 0) + 60
            d[w] = after if reset else after - before   # a reset mid-batch: count what the new window shows
            d[w + '_reset'] = reset
        window.append({'batch': b, 'runs': ph['before'].get('runs', []), **d})
used_5h = sum(w.get('five_hour', 0) for w in window)
used_7d = sum(w.get('seven_day', 0) for w in window)
probe = next((w for w in window if str(w['batch']) == '1'), None)
per_run = None
if probe and probe['runs']:
    per_run = {'five_hour': round(probe.get('five_hour', 0) / len(probe['runs']), 2),
               'seven_day': round(probe.get('seven_day', 0) / len(probe['runs']), 2)}

summary = {
    'pass': P.get('pass') or os.path.basename(out_dir), 'head': P.get('head'), 'kind': P.get('kind'),
    'cities': len(rows), 'scored': len(scored),
    'gate': {'right': gate['right'], 'wrong': gate['wrong'], 'unknown': gate['unknown'], 'unmeasured': gate['unmeasured']},
    'tier_right_on_gated': tier_right, 'gated': len(gated),
    'states': dict(Counter(r['state'] for r in rows)),
    'tool_failures': [r['id'] for r in rows if r['state'] == 'failed'],
    'resumed': [r['id'] for r in rows if r['resumed']],
    'batches': len(window), 'window_used': {'five_hour': used_5h, 'seven_day': used_7d}, 'probe_per_run': per_run,
    'list_usd': round(sum(r['usd'] for r in rows), 2),
    'step_minutes': round(sum(r['step_minutes'] for r in rows), 1),
    'bar': bar,
}
card = {'summary': summary, 'gate_matrix': {k: dict(v) for k, v in matrix.items()},
        'tier_matrix_gated': {str(k): dict(v) for k, v in tier_matrix.items()}, 'window': window,
        'runs': rows, 'unmapped': unmapped}
tiers.write_json(os.path.join(out_dir, 'scorecard.json'), card)


# ── scorecard.md ──────────────────────────────────────────────────────────────────────────────
def cell(s):
    return str(s if s is not None else '–').replace('|', '\\|').replace('\n', ' ')


def quote(q, n=220):
    q = ' '.join((q or '').split())
    return q if len(q) <= n else q[:n] + '…'


L = [f"# Scorecard {summary['pass']}", '',
     f"Head `{cell(summary['head'])}` · kind {cell(summary['kind'])} · {summary['cities']} cities, {summary['scored']} scored",
     '']
if bar:
    L += [f"**Bar (D11): {'MET' if bar['met'] else 'not met'}** — gate wrong {bar['gate_wrong']} (0 allowed), "
          f"unknown {bar['gate_unknown']} (≤ 1), tier right on gated {bar['tier_right_on_gated']}/{bar['gated']}", '']
else:
    L += ['Bar (D11): not judged — only a full (F) pass over all 15 core cities counts.', '']

L += ['## Pass row (§3.7)', '',
      '| pass | head | kind | cities | gate right / wrong / unknown | tier right on gated | batches | 5h / 7d window used | list $ | minutes | what changed next |',
      '|---|---|---|---|---|---|---|---|---|---|---|',
      f"| {summary['pass']} | {cell((summary['head'] or '')[:10])} | {cell(summary['kind'])} | {summary['scored']}/{summary['cities']} "
      f"| {gate['right']} / {gate['wrong']} / {gate['unknown'] + gate['unmeasured']} | {tier_right}/{len(gated)} "
      f"| {summary['batches']} | {used_5h}% / {used_7d}% | {summary['list_usd']} | {summary['step_minutes']} | |", '']
if summary['tool_failures'] or summary['resumed']:
    L += [f"Tool failures (not scored): {', '.join(summary['tool_failures']) or 'none'} · resumed after the usage limit: "
          f"{', '.join(summary['resumed']) or 'none'}", '']
if per_run:
    L += [f"Probe (batch 1): {per_run['five_hour']}% of the 5-hour window and {per_run['seven_day']}% of the 7-day window per run.", '']

L += ['## Gate', '', '| truth \\ predicted | yes | no | unknown | n/a (schema 1 none_found) |', '|---|---|---|---|---|']
for t in ('yes', 'no'):
    m = matrix[t]
    L.append(f"| {t} | {m['yes']} | {m['no']} | {m['unknown']} | {m['n/a']} |")
L += ['', '## Tier 1 vs Tier 2 (gated cities only)', '', '| truth \\ predicted | 1 | 2 | 3 | null |', '|---|---|---|---|---|']
for t in (1, 2):
    m = tier_matrix[t]
    L.append(f"| {t} | {m['1']} | {m['2']} | {m['3']} | {m['None']} |")

L += ['', '## Every city', '',
      '| id | set | state | truth gate / tier | predicted gate / tier | basis | gate | tier | list $ | step min | wall min | prospector seeds / folder |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|']
for r in rows:
    p = r['pred'] or {}
    L.append(f"| {r['id']} | {r['set']} | {r['state']} | {r['truth']['gate']} / {r['truth']['tier']} "
             f"| {cell(p.get('gate'))} / {cell(p.get('tier'))} | {cell(p.get('basis'))} | {cell(r.get('gate_result'))} "
             f"| {cell(r.get('tier_result'))} | {r['usd']} | {r['step_minutes']} | {cell(r['wall_minutes'])} "
             f"| {r['prospector']['seeds']} / {'yes' if r['prospector']['folder'] else 'no'} |")

misses = [r for r in scored if r['gate_result'] != 'right' or r.get('tier_result') == 'wrong']
L += ['', f'## Misses ({len(misses)})', '']
for r in misses:
    p = r['pred']
    d = r['diagnosis'] or {}
    L += [f"### {r['id']} — truth gate {r['truth']['gate']} / Tier {r['truth']['tier']}, predicted gate {p['gate']} / Tier {p['tier']}", '',
          f"- **Diagnosis:** {d.get('kind', '_not yet diagnosed_')}{' — ' + d['note'] if d.get('note') else ''}",
          f"- basis `{p['basis']}`, application type: {cell(p.get('application_type'))}, content items {cell(p.get('content_items'))}, "
          f"why no list {cell(p.get('why_no_list'))}",
          f"- prospector seeds {r['prospector']['seeds']}, jurisdiction folder {'yes' if r['prospector']['folder'] else 'no'}",
          f"- run: `{r['run']}`", '', '**Gate evidence**', '']
    for e in p['gate_evidence'] or []:
        L.append(f"- `{e.get('kind')}` {e.get('source')}: “{quote(e.get('quote'))}”")
    L += ['', '**Rationale**', '', '> ' + quote(p['rationale'], 1800), '']

if window:
    L += ['## Window use by batch', '', '| batch | runs | 5h used | 7d used |', '|---|---|---|---|']
    for w in window:
        L.append(f"| {w['batch']} | {', '.join(w['runs'])} | {cell(w.get('five_hour'))}{' (reset)' if w.get('five_hour_reset') else ''} "
                 f"| {cell(w.get('seven_day'))}{' (reset)' if w.get('seven_day_reset') else ''} |")
    L.append('')
if unmapped:
    L += ['## Runs with no golden-set id', ''] + [f'- `{u}`' for u in unmapped] + ['']

with open(os.path.join(out_dir, 'scorecard.md'), 'w') as f:
    f.write('\n'.join(L))
print(f"{summary['pass']}: gate {gate['right']} right / {gate['wrong']} wrong / {gate['unknown']} unknown"
      f"{' / ' + str(gate['unmeasured']) + ' unmeasured' if gate['unmeasured'] else ''}; tier {tier_right}/{len(gated)} on gated; "
      f"bar {'MET' if bar and bar['met'] else 'not met' if bar else 'not judged'} → {out_dir}/scorecard.md")
