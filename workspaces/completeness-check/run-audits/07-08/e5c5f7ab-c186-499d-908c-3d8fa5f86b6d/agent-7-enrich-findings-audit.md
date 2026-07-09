# Agent 7 — `enrich-findings` Step Audit

**Review**: `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d` (runLabel `2026_07_08_run_2_vision_exp`, 2026-07-08, runs=5, checklist v2.7-trimmed)
**Step window**: 16:22:23.228Z → 16:22:23.680Z (452 ms, completed)
**Verdict**: **HEALTHY**

---

## Step purpose

`enrich-findings` is the join step between raw agent output and human-facing rendering. It:

1. Reads the per-grouping findings JSONs (`output/findings/cc-*.md.json` — post-consolidation winningFindings).
2. Parses every checklist markdown file in the checklist dir and joins grouping **title** + per-item **itemText / condition / requirementSource / sourceType / failStatus** onto each finding.
3. Applies the Fail Status policy clamp as a **backstop** (the real clamp already ran pre-vote in `cross-run-consolidate-cc`; a clamp firing here on runs>1 signals clamp-rule drift).
4. Stamps the cross-run consolidated truth — `consolidatedStatus` (5-state incl. `uncertain`), `tentativeStatus`, `voteBreakdown` — onto every **non-forced** finding from `output/consolidated-findings.json`.
5. Writes `output/enriched-findings.json` (grouped, with per-grouping and total counts bucketed on the *displayed* status) plus a machine-readable sidecar `output/enrich-summary.json`.

`apply-forced-outcomes` was SKIPPED this run (no forced outcomes), so zero findings carried `forced: true` and every finding was eligible for both the clamp backstop and the consolidated stamp.

## Script logic (as-ran)

Script: `RUN_DIR/workflow/scripts/enrich-findings.ts`; shared policy module: `RUN_DIR/workflow/scripts/checklist-policy.ts`.

- **Lookup structure — grouping-scoped, exact-string.** Checklist files are parsed into `titlesByGrouping[groupingId]` and `itemsByGrouping[groupingId][itemId]` (`enrich-findings.ts:158-170`), where `groupingId` is the checklist file basename (`cc-2`) and `itemId` is the raw first table cell (`CC-2-24`). The join is `itemLookup[f.checklistItemId]` (`:195`) — exact string match, scoped to the finding file's `grouping` field. The table parser (`checklist-policy.ts:45-125`) handles 8/7/5/4-column formats; Fail Status is only read in the 8-column form (`:92-101`), defaulting to `'fail'` for shorter forms or unrecognized values.
- **On lookup miss — silent per-finding fallback, counted in the sidecar.** A miss pushes the ref to `joinMissRefs` (`:199`) and degrades: `itemText` ← raw `checklistItemId`, `condition`/`requirementSource` ← `''`, `sourceType` ← `'citation'`, and — the hazard — **`failStatus` ← `'fail'`** (`:200`, `meta?.failStatus || 'fail'`). For a true-warn item that misses, the clamp at `:211` would then rewrite an agent-emitted `warn` → `fail` (the warn-policy inversion). The step never fails on misses; the count is only visible in `enrich-summary.json` and stdout.
- **Consolidated stamping key** — the composite ref `` `${groupingId}:${f.checklistItemId}` `` (`:223`), looked up in a flat `Map` built from `consolidated-findings.json` (`:129-134`). Same construction the consolidator used, so it matches iff item IDs are clean (no fragmentation, no embedded `:` beyond the separator). Non-forced only (`:224`); a drift check warns if a non-uncertain `consolidatedStatus` disagrees with the post-clamp enriched status (`:225-237`).
- **Counting** buckets on the displayed status `consolidated?.status ?? status` (`:241-246`), so uncertain items count as uncertain rather than their tentative verdict.
- **ID normalization note**: `checklist-policy.ts:139-148` exports `normalizeChecklistItemId` (strips a redundant `{grouping}:` prefix — the 50a1a78d fragmentation fix), but `enrich-findings.ts` does **not** call it; it relies on upstream (consolidate) having already normalized IDs. Fine this run (zero fragmentation), but it means enrich has no self-defense against composite IDs arriving in `output/findings/`.

## What happened (evidence, counts)

Log: `RUN_DIR/logs/completeness-check.log:33734-33737`. Command executed with all four args, including `--consolidatedFile` (multi-run path). Duration 452 ms, zero stderr.

**enrich-summary.json** (`RUN_DIR/output/enrich-summary.json`) — the step's own scorecard:

| Metric | Value |
|---|---|
| totalIn / totalOut | **194 / 194** — zero dropped |
| statusCounts | pass 99 / fail 7 / warn 4 / uncertain 19 / n-a 65 — **exact match to pre-scan** |
| failStatusCounts | fail 177 / warn 10 / fail-or-warn 7 (sums to 194) |
| checklistJoinMisses | **0** (empty refs list) |
| backstopClamps | **0** — no clamp-rule drift vs the pre-vote clamp |
| clampDriftWarnings | **0** |

**enriched-findings.json** direct verification (`RUN_DIR/output/enriched-findings.json`):

- 14 groupings, 194 findings; per-grouping `counts.total` all consistent with findings arrays. Raw input (`output/findings/`, 14 files) also totals 194 — nothing dropped or duplicated.
- **Stamping: 194/194 findings carry `consolidatedStatus` + `voteBreakdown`** (0 forced, 0 unstamped). `consolidated-findings.json` has exactly 194 entries with the same status distribution; every ref has exactly one `:`.
- **Zero degraded enrichment**: no finding has missing `itemText` or `itemText == checklistItemId`; no grouping title is `'Unknown'`; `condition`/`requirementSource`/`sourceType` present on all 194.
- All 19 uncertain findings carry a `tentativeStatus`. Tentative-shaped raw statuses reconcile: raw `status` dist pass 104 / fail 18 / n-a 68 / warn 4 vs displayed 99/7/65/4+19-uncertain — the deltas (5 pass, 11 fail, 3 n-a) are exactly the 19 uncertain items' tentative verdicts.
- Single degraded vote confirmed and correctly carried through: `cc-2:CC-2-24` `voteBreakdown {pass: 4, missing: 1}` — the known run-2 missing vote; consolidated to `pass` (4/5), correctly *not* uncertain.
- **Checklist ground truth**: re-parsing v2.7-trimmed with the script's exact parser semantics yields **194 items, zero duplicate IDs, zero IDs containing `:`** — the join universe is 1:1 with the findings universe.
- **Fail-Status inversion exposure this run: 0 findings.** With zero join misses, no item's `failStatus` was defaulted. (Had misses occurred on the 10 `warn` / 7 `fail-or-warn` items — 17/194 ≈ 9% of the checklist — those would have silently become blocking-`fail` policy.)

## Diagnostics on stdout — NOT lost this run

The charge anticipated conductor discarding script stdout. **This run's conductor captured it**: `logs/completeness-check.log:33736` (`event: step.script.completed`) embeds the full stdout —

```
Loaded consolidated findings: 194 items from .../consolidated-findings.json
Enriched findings: 14 groupings, 194 items
Written to: .../enriched-findings.json
Summary sidecar: .../enrich-summary.json
```

— and `stderr: ""`. So the conductor#212 stdout-capture remediation was live for this run. Diagnostics that *would* have printed but didn't (because nothing was wrong): `CLAMP:` lines (`enrich-findings.ts:215`) and `WARNING: ... clamp-rule drift?` lines (`:234-236`). Belt-and-suspenders, the sidecar persists the same counters regardless of log capture.

## What went right

1. **Perfect join**: 194-in → 194-out, 0 lookup misses, 0 degraded titles/itemText, against a checklist that parses to exactly 194 unique colon-free IDs. The pre-scan instruction "verify rather than assume degradation" is satisfied — the joins are provably clean, not merely presumed.
2. **Complete consolidated stamping**: every finding stamped (no forced exemptions in play); status totals bucketed on displayed status match the consolidator's output exactly; all 19 uncertains carry tentativeStatus for honest downstream rendering.
3. **Zero backstop clamps / zero drift warnings** — the pre-vote clamp in `cross-run-consolidate-cc` and this script's policy are in agreement (parent spec R1 holds).
4. **Self-observability**: the `enrich-summary.json` sidecar exists, is machine-readable, and its numbers independently reconcile with the output file — this is the pattern the other CC scripts should copy.
5. Missing-vote handling (`cc-2:CC-2-24`) flowed through intact in `voteBreakdown` rather than being flattened.

## What went wrong

Nothing operationally this run. Latent (code-level, not run-level) notes:

1. **`failStatus` defaults to `'fail'` on a join miss** (`enrich-findings.ts:200`). Combined with the clamp at `:211`, a miss on a `warn`-policy item converts an agent's correct advisory `warn` into a blocking `fail` — a policy inversion that would look like a legitimate deficiency downstream. Miss count was 0 here, so exposure was 0, but the failure mode is silent-per-finding by design.
2. **No fail-loud threshold on misses**: even 194/194 misses would complete the step successfully with fully degraded output (titles `'Unknown'`, itemText = raw IDs).
3. **`normalizeChecklistItemId` is exported but unused here** — enrich trusts upstream ID hygiene; a fragmented ID reaching this step would both miss the checklist join *and* miss the consolidated stamp (unstamped finding renders its tentative-shaped raw status as confident).
4. The 4-column parser branch feeds `Regulation` into `requirementSource` and infers `sourceType` heuristically (`checklist-policy.ts:112-120`) — not exercised by v2.7-trimmed (8-col), but a format regression would silently change sourceType semantics rather than erroring.

## Handoff contract (blast radius for synthesis — not audited here)

- **format-reports** renders grouping `title` and per-finding `itemText` (plus condition/requirementSource) in the consolidated report, and relies on `consolidatedStatus ?? status` for honest uncertain display. This run hands it **fully clean inputs**: every title real, every itemText real, every finding stamped. Any report-level rendering defect downstream is format-reports' own, not an enrichment artifact. On a hypothetical miss, the report would show the raw ID (`CC-2-24`) where prose belongs and an `'Unknown'` grouping header — visible but non-blocking degradation.
- **build-review-comments** uses `itemText` as the comment-title fallback. Clean here — no comment can inherit a bare checklist ID as its title from this run's data. The 7 fail + 4 warn + 19 uncertain findings it consumes all carry correct failStatus policy (`fail` 177 / `warn` 10 / `fail-or-warn` 7), so no warn/fail severity misclassification originates in this step.

## Observability gaps & remediations

1. **Lookup-miss fail-loud threshold**: the sidecar counts misses but the step never fails. Add `if (joinMissRefs.length > 0) process.exitCode = 1` (or a tolerance arg, e.g. fail when misses > 0 on a known-clean checklist version). Today a wholly broken checklist path degrades every finding and still reports "Step completed".
2. **Never default `failStatus` on a miss**: on a join miss, either fail the step or mark `failStatus: null` + skip the clamp for that finding, so a missing row can't invert warn-policy into blocking-fail. The current `meta?.failStatus || 'fail'` conflates "column says fail" with "we have no idea".
3. **Assert no `:` in item IDs at ingest**: cheap invariant in `extractChecklistItems` (and on `f.checklistItemId` at `:193`) — throw on embedded colons — since the composite `grouping:item` ref is the stamping key and a colon-bearing ID silently breaks both joins. Alternatively, call the already-exported `normalizeChecklistItemId` here as a second line of defense.
4. **Machine-readable step summary: already done** (`enrich-summary.json`) — the remediation the other CC scripts need is to adopt this pattern. One improvement: include the checklist dir path + parsed-item count in the sidecar so a wrong `--checklistsDir` (version mismatch, e.g. v2.6 vs v2.7) is diagnosable from the artifact alone; today a stale dir with overlapping IDs would join "successfully" with wrong item text and zero misses.
5. **Stamp-coverage counter**: the sidecar counts join misses but not consolidated-map misses (findings with no `consolidatedStatus` on a runs>1 path). Add `unstampedNonForced` — this run it's 0, but a nonzero value is exactly the "tentative status rendered as confident" bug the uncertain-status spec exists to prevent.

---

**Verdict: HEALTHY** — 194/194 findings enriched with zero join misses, zero clamps, zero drift, full consolidated stamping, and status totals identical to the consolidator's. The step also demonstrated the observability pattern (sidecar + captured stdout) the rest of the pipeline should standardize on.
