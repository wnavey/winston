# Audit: `prepare-uncertain-explanation-inputs` step

**Review**: `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d` (runLabel `2026_07_08_run_2_vision_exp`, runs=5, uncertainThreshold=0.35)
**Step window**: 2026-07-08 16:19:09.850Z → 16:19:10.315Z (465 ms), completed
**As-ran script**: `RUN_DIR/workflow/scripts/prepare-uncertain-explanation-inputs.ts` (RUN_DIR = `/Users/wnavey/noetic/cc-audit/e5c5f7ab-c186-499d-908c-3d8fa5f86b6d/cc-run-output`)

**Verdict: HEALTHY**

---

## Step purpose

Bridge between cross-run consolidation and the explain-uncertain agent fan-out. Per the script header (lines 1–24) and workflow.yaml lines 216–226:

1. **Select** — read `output/consolidated-findings.json` and keep items with `status === 'uncertain'` (line 89).
2. **Exclude forced** — scan post-forced `output/findings/*.json` for `forced: true` findings; any uncertain ref that was force-overridden is skipped ("a force beats uncertain — nothing to explain", lines 98–104, 127–131).
3. **Join checklist context** — parse every `*.md` in the checklist dir (`bureau/jurisdictions/austin/completeness-check/v2.7-trimmed`) via the shared `extractChecklistItems` / `extractValidationMethodology` from `checklist-policy.ts` (lines 106–120), and attach `itemText`, `condition`, `failStatus`, and the grouping's Validation Methodology to each item.
4. **Emit** — one JSON per item to `output/uncertain-explanation-inputs/{refSlug(ref)}.json` (lines 149–152), where `refSlug` maps `:` → `__` (lines 60–63). These basenames are the fan-out unit for the next step's `{{ checklistItem }}` (workflow.yaml line 241, `checklistItems: .../uncertain-explanation-inputs/*.json`).

**How the lookup works** (the audit's key question): the join is **grouping-scoped exact-string** — `itemsByGrouping[item.grouping]?.[item.checklistItemId]` (line 132). Grouping comes from the checklist file's basename; item ID from column 1 of the table. There is **no prefix normalization at this join** — the script relies on `cross-run-consolidate-cc.ts` having already normalized double-prefixed IDs upstream (`normalizeChecklistItemId`, consolidate lines 253–263, with WARNING logs and a `strippedIdPrefixCount` stat). And there **are silent fallbacks** on lookup miss:

- line 139: `itemText: meta?.itemText ?? item.checklistItemId` — item text silently degrades to the bare ID
- line 140: `condition: meta?.condition ?? ''` — silently empty
- line 141: `failStatus: meta?.failStatus ?? 'fail'` — silently defaults to blocking policy

No log line, no counter, no exit-code consequence fires when `meta` is undefined. (In this run it never was — see below — but the failure mode is real; see Observability.)

## What happened (evidence, counts)

**Log** (`RUN_DIR/logs/completeness-check.log` lines 32127–32130 — exactly 4 lines for this step, no retries, empty stderr):

- 32127: `Executing step`
- 32128: exact command — `--consolidatedFile=.../output/consolidated-findings.json --findingsDir=.../output/findings --checklistsDir=.../bureau/jurisdictions/austin/completeness-check/v2.7-trimmed --outputDir=.../output/uncertain-explanation-inputs`
- 32129: `step.script.completed`, duration_ms 465, `stdout: "Uncertain-explanation inputs: 19 written to /vercel/sandbox/workspace/output/uncertain-explanation-inputs"`, `stderr: ""`
- 32130: `Step completed`

Note: contrary to the working assumption that conductor discards script stdout, the `step.script.completed` event **does capture full stdout/stderr** in the log. The captured stdout is the single summary line — meaning zero `SKIP (forced)` lines and zero `NOTE: <file> has no Validation Methodology` lines were emitted.

**Selection**: `consolidated-findings.json` has 194 items; exactly 19 have `status: 'uncertain'`; all 19 refs are unique (verified programmatically).

**Forced exclusion**: grep for `"forced": true` across `output/findings/*.json` → zero hits, consistent with `apply-forced-outcomes` being SKIPPED this run. `skippedForced` = 0. The exclusion logic itself is sound: it keys on the composite `${data.grouping}:${f.checklistItemId}` ref (line 102), matching the consolidated `ref` format exactly.

**Output**: 19 files in `output/uncertain-explanation-inputs/` — **1:1 with the 19 uncertain items**, refs match exactly:

```
cc-10__AE-01  cc-13__AW-07  cc-21__CC-21-01  cc-21__CC-21-04
cc-22__CC-22-14  cc-22__CC-22-15  cc-22__CC-22-19  cc-22__CC-22-27
cc-23__CC-23-07  cc-23__CC-23-08  cc-24__CC-24-04  cc-24__CC-24-13
cc-24__CC-24-16  cc-3__CC-3-21  cc-3__CC-3-23  cc-3__CC-3-24
cc-5__ADR-01  cc-5__ADR-04  cc-6__CMP-01
```

**Downstream handoff confirmed**: `output/uncertain-explanation-results/` contains 19 files with identical basenames — every fan-out cell fired and landed.

## Checklist-join integrity analysis

All 19 input files inspected field-by-field. **19/19 complete, 0 degraded.**

| Check | Result |
|---|---|
| `itemText` == bare ID (the line-139 fallback signature) | 0 files |
| `condition` empty (line-140 fallback) | 0 files — 12 files say `Always` (a real table value, 6 chars), 7 have substantive conditions (31–124 chars) |
| `validationMethodology` missing | 0 files — present in all 19, lengths 700–9,856 chars |
| `failStatus` | fail ×13, warn ×3, fail-or-warn ×2... see below |

**failStatus provenance verified against source tables** (this is the check that distinguishes "joined" from "defaulted", since `'fail'` is both a real value and the fallback):

- `cc-24:CC-24-04/-13/-16` → `warn` in inputs; source rows in `/Users/wnavey/noetic/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/cc-24.md` lines 58/61/68 carry explicit `| warn |` in the 8th column. Non-default values prove the join resolved real table data.
- `cc-21:CC-21-01/-04` → `fail-or-warn`; matches `cc-21.md` lines 135/138 (`| fail-or-warn |`).
- `cc-6:CMP-01` → `fail`; source row `cc-6.md` line 39 is a **7-column row with no Fail Status column** — `fail` here is the *correct policy default per the parser* (checklist-policy.ts lines 92–101: column-absent → `'fail'`), not a lookup miss. Verified `itemText` and condition also match the source row exactly.
- Spot-check `cc-24:CC-24-04` itemText verbatim-matches the table cell ("License Agreement for street trees, landscaping, or irrigation in ROW not submitted or referenced (LDE-04)").

(Caveat: verification is against the *local* bureau checkout of v2.7-trimmed, not the sandbox snapshot the run used; exact itemText/failStatus matches across all spot-checks indicate no drift for these rows.)

**Vote-payload sanity**: all 19 inputs have `totalRuns: 5`, full `voteBreakdown` (only expected `missing` anywhere in the run is cc-2 run-2, which is not among the uncertain set — all 19 breakdowns sum to 5 with `missing: 0`), a `tentativeStatus`, and populated `perRunFindings`.

## Duplicates

Zero logical duplicates. The 19 consolidated uncertain refs are unique; all `checklistItemId` values are bare (no `cc-N:cc-N:` double-prefix pairs), consistent with the pre-scan finding of zero fragmentation and with consolidate's `strippedIdPrefixCount` normalization having had nothing to strip.

## Filenames / fan-out safety

`refSlug` (script lines 60–63) replaces **all** colons with `__`: `cc-13:AW-07` → `cc-13__AW-07.json`. All 19 basenames are `[A-Za-z0-9_-]+.json` — shell-safe, glob-safe, and template-safe for `{{ checklistItem }}`. The workflow comment (workflow.yaml lines 228–235) documents that `{{ checklistItem }}` includes `.json` and the output template must not re-append an extension; the results dir shows this contract held. The slug is also reversible in practice for these IDs (no item IDs contain `__`), and `collect-uncertain-explanations` doesn't need to reverse it anyway — it cross-checks the embedded `ref` field.

## What went right

- Perfect 1:1 selection: 19 uncertain in → 19 inputs out → 19 results downstream. No drops, no extras, no duplicates.
- Checklist join resolved real context for all 19 items — including non-default `warn` and `fail-or-warn` policies, proving live table lookups rather than fallback defaults.
- Validation Methodology present in every input (all 14 guide files in v2.7-trimmed have the section — no `NOTE:` warnings in stdout).
- Forced-exclusion logic is correctly keyed on the composite ref and correctly found nothing (apply-forced-outcomes skipped).
- Colon-slugging is safe and the fan-out handoff contract (basename = `{{ checklistItem }}`) held end-to-end.
- Fast and clean: 465 ms, no retries, empty stderr, stdout captured in the structured log.

## What went wrong

Nothing in this run. Two latent design risks (did not fire here):

1. **Silent join-miss fallback** (lines 139–141). If a consolidated ref matched no checklist item — e.g., a differently-prefixed fragmented ID (which `normalizeChecklistItemId` deliberately leaves intact when the prefix isn't the cell's own grouping, checklist-policy.ts lines 139–148), a checklist-version mismatch, or a renamed item — the explain-uncertain agent would receive `itemText` equal to the raw ID, an empty condition, and a **wrongly-defaulted `failStatus: 'fail'`** (materially wrong for a warn-policy item: the explanation would frame an advisory item as blocking). No log line, no counter, exit 0.
2. **No join-coverage assertion.** The script asserts nothing about how many items resolved; a 0/19 join (wrong `--checklistsDir`, wrong version) would still exit 0 with a healthy-looking "19 written" summary.

## Observability gaps & remediations

1. **Warn on join miss + emit an explicit flag** — replace the silent `??` chain with:
   ```ts
   const meta = itemsByGrouping[item.grouping]?.[item.checklistItemId];
   if (!meta) console.warn(`WARNING: no checklist item for ${item.ref} in ${checklistsDir} — emitting degraded input`);
   ...
   checklistJoin: meta ? 'resolved' : 'missing',
   ```
   The `checklistJoin` field makes degradation machine-detectable downstream (collect-uncertain-explanations already has a guard framework — lines re: ref cross-check / >50%-null tripwire — that could count these).
2. **Threshold-fail on systemic miss** — mirror the collector's tripwire: if `>50%` (or any, given the tiny volumes) of uncertain items fail the join, `process.exit(1)` with the miss list. A wholesale miss means a misconfigured `checklistsDir`, which should stop the workflow, not degrade 19 agent inputs.
3. **Prefix-normalize at the join as a belt-and-suspenders** — reuse `normalizeChecklistItemId(item.grouping, item.checklistItemId)` before the lookup (import already available from `./checklist-policy`). Consolidate normalizes today, but this script's correctness shouldn't depend on an upstream invariant it never checks.
4. **Summary line should report join stats** — extend line 156's summary to `19 written (19 joined, 0 degraded, 0 forced-skipped)` so the single stdout line captured in `step.script.completed` is diagnostic on its own.
5. **Correction to the audit prior**: conductor does *not* discard script stdout — it lands verbatim in the `step.script.completed` log event (log line 32129). The real gap is that the script prints too little (per-item NOTE/SKIP lines exist, but join misses print nothing), not that printing is pointless.

---

**Verdict: HEALTHY** — 1:1 selection, zero degraded joins (verified against source tables including non-default Fail Status values), zero duplicates, safe slugs, clean 465 ms execution. Remediations above target latent silent-fallback risk, not anything observed in this run.
