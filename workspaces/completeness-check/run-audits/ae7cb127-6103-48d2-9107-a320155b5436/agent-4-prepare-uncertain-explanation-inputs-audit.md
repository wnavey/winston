# Agent 4 — `prepare-uncertain-explanation-inputs` audit

**Review:** `ae7cb127-6103-48d2-9107-a320155b5436` — 2026_07_07_ROW_fix_take_1
**Step wall:** 0.5 s (log: `logs/completeness-check.log:29049` `duration:455 ms`)
**Verdict:** **HEALTHY**

---

## Step purpose

Partition `output/consolidated-findings.json` on `status === 'uncertain'`, drop items already overridden by an `apply-forced-outcomes` write, and join per-item checklist context (`itemText`, `condition`, `failStatus`, `validationMethodology`) so the downstream `explain-uncertain` fan-out has a stand-alone JSON per finding. One input file per uncertain, file-safe-slugged (`:` → `__`), keyed by `refSlug(ref)` (script `prepare-uncertain-explanation-inputs.ts:60-63`).

The script is a no-op when `explainUncertain=false`, when `runs<3` (no consolidated file — the runs=1 passthrough at line 82-86), or when `uncertain` is empty (line 91-94).

## What happened

- Wall 0.5 s, exit clean, no errors emitted to `logs/completeness-check.log`. Conductor discards script stdout so `SKIP (forced)` / summary lines are not surfaced.
- Consolidated uncertain count: **16** (`jq '[.[]|select(.status=="uncertain")]|length' consolidated-findings.json` = 16).
- Input files written: **16/16** in `output/uncertain-explanation-inputs/`. `diff` of `refs → refSlug(ref)` against `ls` = empty set. **Exact 1:1 mapping, nothing extra, nothing missing.**
- Forced overlap: 0 items in `output/findings/cc-*.md.json` have `forced === true`, so `skippedForced = 0`. The `forcedRefs` set (script `:98-104`) was built and consulted correctly (built from `${grouping}:${checklistItemId}`, matching `item.ref` shape); it simply had no members to filter.
- All 16 refs are BARE (`grouping:ID`, single colon) — matches the pre-scan finding that there is zero checklist-ID fragmentation. `refSlug` handled all 16 without collision.

Refs written:

```
cc-10:AE-01, cc-13:AW-05, cc-13:AW-14, cc-13:AW-23, cc-13:AW-28,
cc-13:AW-30, cc-13:AW-32, cc-15:CC-15-08, cc-2:CC-2-14, cc-21:CC-21-01,
cc-22:CC-22-14, cc-22:CC-22-15, cc-22:CC-22-20, cc-23:CC-23-07,
cc-23:CC-23-08, cc-23:CC-23-10
```

## Checklist-join integrity

Ran a full sweep (`jq` over all 16 files, `[.ref,.checklistItemId,.itemText,.failStatus,.condition,(.validationMethodology!=null)]`):

- `itemText`: all 16 have a real English item description; **zero degraded stubs** (`itemText ?? checklistItemId` fallback at script `:139` did not fire on any file).
- `condition`: all 16 populated (`Always` or a real conditional — e.g. `cc-15:CC-15-08` = `If within Edwards Aquifer Recharge Zone…`). Empty-string fallback at `:140` did not fire.
- `failStatus`: 15/16 = `fail`, 1/16 = **`warn`** (`cc-13:AW-30`), 1/16 = **`fail-or-warn`** (`cc-21:CC-21-01`). The default-`'fail'` fallback at `:141` was **not** silently masking those two — they came through as the real bureau-authored policy. No misclassified severities.
- `validationMethodology`: all 16 present (script `:142` — conditional spread. None of the four surfaced groupings (`cc-2, cc-10, cc-13, cc-15, cc-21, cc-22, cc-23`) hit the "no Validation Methodology section" NOTE log at `:117-119`).
- `voteBreakdown` + `perRunFindings`: preserved verbatim from consolidated. **All 16 files carry exactly 5 perRunFindings entries; `totalRuns=5` for all; no info loss.** This matches the pre-scan "0/16 uncertains have any missing votes" — every explain-uncertain agent will get complete evidence from all five runs.

Sample-3 spot check (per brief):
- `cc-13:AW-05` (pass=3/fail=2, tentative=`pass`) — rich itemText, `Always`, `fail`, methodology with the AW-05 rubric and 7 other AW-specific handling notes. All 5 perRunFindings present with `explanation/observation/reasoning/evidenceLocations`.
- `cc-22:CC-22-14` (pass=2/fail=3, tentative=`fail`) — includes the DRV-04 rubric and the cc-22 validation methodology, which contains an explicit CC-22-14 handling note ("look for two wide, flat-bottomed U-shapes…"). Good.
- `cc-2:CC-2-14` (pass=3/fail=2, tentative=`pass`) — BAS-05, seal/signature/date rubric with cross-reference to CC-1. All 5 runs' evidence carried through.

**Missing from input files (by design, per the current schema):**
- No `confidence` field (consolidated has it as `medium` for every uncertain — the explain agent could benefit).
- No prior-review context (`priorReviewId` mapping) — the explain-uncertain agent must obtain it via workflow inputs, not from this input file.
- No submission context (documentId, planSetId, projectId) — same story; not embedded per-item, agent pulls from workflow-level inputs.

None of these are silent fallbacks — they are absent by contract. Whether the downstream agent has them is Agent 5's concern.

## Threshold semantics

`uncertainThreshold = 0.35` is a **dissent floor**, not a confidence floor. The consolidate script fires uncertain when `winnerShare <= 1 - uncertainThreshold` (`consolidate-logic.ts:100`), i.e. `winnerShare <= 0.65` at 0.35. So:

- runs=5: `3/5 = 0.60 ≤ 0.65` → **uncertain**; `4/5 = 0.80 > 0.65` → not uncertain.
- All 16 uncertains on this run have max-status count = 3/5 (verified via `voteBreakdown`), consistent with this semantic.

Naming nit: the input label `uncertainThreshold` reads like "trigger below this confidence" but the math is "trigger when winner share drops to (1 - threshold) or below" — i.e. threshold is a *disagreement fraction*, not a *consensus fraction*. `1 - uncertainThreshold` is the actual consensus gate. See `consolidate-logic.ts:29-30, :96-100`. Not a bug on THIS run; a doc/spec clarity issue.

Also: the gate is inclusive at the boundary (`<=`, `:100`) — matches the design spec comment "exact threshold share IS uncertain". No off-by-one.

## Silent fallbacks — audit sweep

| Site | Line | Fired on this run? |
|---|---|---|
| `!fs.existsSync(consolidatedFile)` runs=1 passthrough | `:83-86` | No (runs=5, file present) |
| `uncertain.length === 0` early exit | `:91-94` | No (16 uncertains) |
| `itemText ?? checklistItemId` degraded stub | `:139` | **No** (0/16 files) |
| `condition ?? ''` empty condition | `:140` | **No** (0/16 files) |
| `failStatus ?? 'fail'` policy default | `:141` | **No** (0/16 files) |
| `methodologyByGrouping[…] ?? null` → omit key | `:133, :142` | **No** (all 7 touched groupings have Validation Methodology) |
| `NOTE: <file> has no Validation Methodology…` log | `:117-119` | Not observed in logs |

Bare-ID checklist lookup risk (`itemsByGrouping[grouping][checklistItemId]` at `:132`): safe here because pre-scan confirms all IDs bare and all groupings on-disk match consolidated `grouping` values (`cc-2, cc-10, cc-13, cc-15, cc-21, cc-22, cc-23` all exist in `austin/completeness-check/v2.7-trimmed/`). If a run ever emitted a `grouping:ID`-prefixed checklistItemId, the lookup would silently fall through to the degraded stub at `:139-141` — this is the failure mode to worry about on future runs, but it did not occur here.

No `{{ input.* }}` templating on this step — it's a plain `parseArgs` CLI script (`:66-74`), not template-rendered. All four `--consolidatedFile / --findingsDir / --checklistsDir / --outputDir` were required and passed correctly (script would have thrown at `:77-80` otherwise; it did not).

## What went right

- 1:1 mapping between the 16 consolidated uncertains and 16 written input files, zero drift.
- Zero silent fallbacks fired: every input file carries real bureau checklist metadata, not defaults.
- Full 5-run `perRunFindings` and `voteBreakdown` propagated verbatim to every input file — the explain-uncertain agent has complete evidence to reason from.
- Both non-`fail` policy statuses (`warn` for AW-30, `fail-or-warn` for CC-21-01) were carried through faithfully — no severity flattening.
- File-safe slugging (`:` → `__`) works and the resulting basenames are unambiguous for the `{{ checklistItem }}` fan-out.
- Consistent with the design contract: forced-vs-uncertain arbitration is done here (before explain-uncertain is spawned), so forced items don't burn Sonnet cells. Zero forced items on this run means the branch didn't exercise, but the ordering is correct.

## What went wrong

Nothing operational. Two latent risks the run happened not to hit:

1. **Silent degradation on grouping/ID mismatch.** If `grouping` in consolidated ever doesn't match a `.md` filename in `checklistsDir`, or if `checklistItemId` is fragmented, the lookup at `:132` returns `undefined` and the input file gets `itemText = checklistItemId` (the raw ref), `condition = ''`, `failStatus = 'fail'`. Nothing is logged, nothing throws. Downstream Sonnet then reasons off the ID string alone. **This did not happen here (0/16)** but the check is invisible.
2. **`failStatus` default masks policy.** The `?? 'fail'` fallback at `:141` will misclassify a `warn`-policy item as `fail` if the join misses. `cc-13:AW-30` (warn) and `cc-21:CC-21-01` (fail-or-warn) prove the field carries non-default values on this run, so any future join miss on such an item would silently change downstream severity.
3. **Naming: `uncertainThreshold`.** Reads as consensus floor but implemented as dissent floor (see Threshold semantics above). Cosmetic on this run.

## Observability gaps & remediations

- **[Gap]** Script stdout is discarded by conductor; the `Uncertain-explanation inputs: 16 written…` / `SKIP (forced): …` / `NOTE: cc-XX has no Validation Methodology…` lines exist only in-process. **Fix:** replace `console.log` with the shared pino logger (used by other CC scripts) and emit structured events `{step, written, skippedForced, groupingsWithoutMethodology}`. Then this audit could confirm counts from logs alone without re-`ls`.
- **[Gap]** No hard error on join miss. **Fix:** add an explicit `checklistJoin: 'complete' | 'degraded'` flag on every input file — set `degraded` when `meta` is undefined; write a warning line and (optionally) fail the step if any input is `degraded`. This turns a silent fallback into a first-class signal for downstream and for future audits.
- **[Gap]** Prefix-normalize at the join. **Fix:** strip any accidental `grouping:` prefix from `checklistItemId` before the lookup at `:132`, then also try the bare ID. Cheap insurance against future ID fragmentation.
- **[Gap]** `uncertainThreshold` naming. **Fix:** rename to `uncertainDissentThreshold` in workflow inputs (or document inline that "0.35 = uncertain when winner share ≤ 0.65"). Doc-only, no runtime cost.
- **[Nice-to-have]** Propagate `confidence` from consolidated into the input JSON — it's already computed, and the explain-uncertain prompt could use "medium" vs "low" to modulate how aggressively it seeks a resolution.

---

**Verdict:** **HEALTHY.** The step did exactly what it was supposed to do: 16 uncertains → 16 fully-hydrated input files, zero degraded joins, zero silent fallbacks fired, forced-overlap filter correctly evaluated (empty), full 5-run vote breakdown and per-run findings preserved. All identified issues are latent (would-be silent on a different run) rather than active on this run.
