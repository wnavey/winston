# 1700 S. Lamar — Gap (Detection-Variance) Items: Per-Item Analysis

**Review:** `6ec3acdf-737b-47b2-8191-49b376ea3404` · 3-run completeness-check (`runs=3`) · checklist `v2.5-trimmed` · 2026-04-28T17:29Z

> **Update (post-log-investigation):** This report originally hypothesized that run-2 was using "cached older-checklist knowledge from training data". The hypothesis turned out to be only partially right. After tracing the conductor logs ([`run-2-drift-root-cause.md`](./run-2-drift-root-cause.md)), the actual mechanism is:
>
> Run-2 successfully emitted the **correct 37-item v2.5 findings** in StructuredOutput call #2. A harness `Stop hook` then force-prompted it to emit again; context compaction kicked in mid-recovery; **post-compaction**, the model reconstructed findings (drawing in part on training-data knowledge of older AW checklists) and emitted a 45-item drifted payload as StructuredOutput call #3. The orchestrator persisted the *last* call as canonical, overwriting the correct one.
>
> The per-item hypotheses below remain accurate descriptions of *what* drifted; the section "Cross-cutting hypotheses" is superseded by the root-cause doc. Read the root-cause doc first if you want the mechanism.

This report covers **all 18 items** with detection variance — i.e., refs where `runCount < totalRuns` (some run produced no finding for the ref). For every item, we pull the checklist text from `bureau/jurisdictions/austin/completeness-check/v2.5-trimmed/cc-13.md` (or note its absence), read the agent traces from the run(s) that *did* produce findings, and form hypotheses about why the other run(s) skipped it.

---

## TL;DR — Detection variance is a single deterministic bug, not stochastic noise

After examining all 18 items, **the entire detection-variance signal in this review reduces to one observation**:

> **Run-2 evaluated a different checklist scope than runs 1 and 3.**
>
> - 13 items were evaluated **only by run-2** (1/3 detection rate). All 13 are items the v2.5-trimmed checklist either explicitly *removed/consolidated* or never contained.
> - 5 items were evaluated **by runs 1 and 3 but not run-2** (2/3 detection rate). All 5 are items the v2.5-trimmed checklist contains.

Runs 1 and 3 evaluated **exactly** the v2.5-trimmed scope (37 items in cc-13). Run-2 evaluated **45 items** — adding 13 stale/fabricated items and dropping 5 real ones. Detection variance = 13 + 5 = 18.

This is **not** "the model sometimes forgets to evaluate a row". It's "run-2 is operating on a different checklist". The remediation is structural (fix run-2's checklist loading), not statistical (raise N).

The same root cause likely explains the **Class A** items in [`high-variance-items-analysis.md`](./high-variance-items-analysis.md) — three cc-13 items where run-2 evaluates a *different deficiency text* under the same item ID. Scope drift and item-text drift are two faces of the same checklist-loading issue.

---

## Verification: scope diff vs v2.5-trimmed

Items in v2.5-trimmed cc-13 (37 total): `AW-01,02,03,05,06,07,08,10,11,12,13,14,16,18,19,20,21,22,23,25,27,28,29,30,31,32,33,36,37,38a,38b,39,41,45,46,49,53`.

| Run | Items evaluated | Δ vs v2.5-trimmed |
|---|---:|---|
| run-1 | 37 | identical |
| run-2 | 45 | +`AW-09,15,17,24,26,34,35,42,43,44,50,51,52`; −`AW-19,38a,38b,39,49` |
| run-3 | 37 | identical |

The cc-13.md file itself contains a **Note on ID numbering** that explicitly states some IDs were removed/consolidated:

> "AW-04, AW-09, AW-15, AW-17, AW-26, AW-35, AW-40, AW-43, and AW-44 were removed or consolidated (AW-04 → AW-03, AW-09 → AW-08, AW-15 → AW-02; AW-17 and AW-40 dropped as out-of-scope for completion check). The gaps in numbering are intentional."

Run-2 ignored this note and evaluated 7 of the explicitly-removed items anyway (`AW-09, 15, 17, 26, 35, 43, 44`), plus 6 items not even mentioned in the note (`AW-24, 34, 42, 50, 51, 52`).

---

## Section A — The 13 items only run-2 evaluated (1/3 detection)

These split into two groups: items the v2.5 cc-13.md explicitly removed (7 items), and items not mentioned anywhere in the v2.5 file (6 items).

### A.1 — Items v2.5-trimmed says were removed/consolidated (7 items)

For each, run-2 evaluated a deficiency that *is plausibly an Austin Water concern* but was deliberately scoped out of completeness check.

#### `AW-09` — run-2: pass
**v2.5 status:** "AW-09 → AW-08" (consolidated into AW-08).
**Run-2 evaluated:** "LUE Tracking Table is complete with file number, case status, proposed LUEs, and notes." — Sheet 6, Block 3.
**Hypothesis:** Run-2 reverted to a pre-consolidation AW-09 (LUE Tracking Table check) that v2.5 folded into AW-08. The model has knowledge of the older numbering and ignored the consolidation note.

#### `AW-15` — run-2: pass
**v2.5 status:** "AW-15 → AW-02" (consolidated into AW-02).
**Run-2 evaluated:** Hydrant Flow Test Report completeness — Sheet 7, Block 2.
**Hypothesis:** AW-15 in an older version covered hydrant-flow-test data; v2.5 either folded that into AW-02 (template completeness) or the existing AW-11/AW-12 (fire-flow). Run-2 evaluated the older, narrower deficiency.

#### `AW-17` — run-2: pass
**v2.5 status:** "AW-17 dropped as out-of-scope for completion check".
**Run-2 evaluated:** "Plan and profile (PNP) views for water and wastewater infrastructure" — Sheets 18-20.
**Hypothesis:** AW-17 in an older version was P&P presence; v2.5 explicitly dropped it because it overlaps with AW-18 (which checks profile views *and* the plan-on-top layout per UCM 2.5.1.E.3). Run-2 still ran the older check.

#### `AW-26` — run-2: pass
**v2.5 status:** Listed as removed.
**Run-2 evaluated:** "Profile views show pipe slopes and sizes" — Sheet 19.
**Hypothesis:** AW-26 in an older version covered profile-content (slopes, sizes); v2.5 either dropped it or rolled it into AW-18. Run-2 surfaced the older deficiency.

#### `AW-35` — run-2: not-applicable
**v2.5 status:** Listed as removed.
**Run-2 evaluated:** "Refer to UCM Section 3.0 (General Requirements for Storm Drainage Plan Preparation) for additional technical criteria."
**Hypothesis:** AW-35 in an older version was a *reference/informational pointer* (no specific deficiency, just a "see UCM"). Run-2 marked it n/a because there's no discrete check — but ran-2 still emitted a finding for it. v2.5 cleaned these up by deleting the reference-only items entirely.

#### `AW-43` — run-2: not-applicable
**v2.5 status:** Listed as removed.
**Run-2 evaluated:** "Reclaimed/OWRS meter demand sheets" — Sheet 7.
**Hypothesis:** AW-43 in an older version covered reclaimed/OWRS meter demand calculations; v2.5 dropped it (likely because OWRS isn't routinely applicable). Run-2 evaluated, found N/A (no reclaimed proposed), reported.

#### `AW-44` — run-2: pass
**v2.5 status:** Listed as removed.
**Run-2 evaluated:** "Project Information table on AW General Info Sheet — total impervious cover and impervious cover %" — Sheet 6 vs Sheet 15.
**Notable:** Run-2's reasoning is *internally contradictory*. It observes that Sheet 6 shows "N/A" for impervious cover but the data exists on Sheet 15, then concludes pass. This is the deficiency described — data not entered into the AW Sheet 6 template. Run-2 essentially evaluated correctly and got the wrong answer. v2.5 likely dropped AW-44 because the impervious-cover check is redundant with other items.
**Hypothesis:** older AW-44 was an impervious-cover transfer check between Sheet 15 and Sheet 6. v2.5 dropped it. Run-2 reverted to the old check and made an inconsistent finding.

### A.2 — Items v2.5-trimmed never mentions (6 items)

These items aren't in any version of cc-13.md I can locate — they're either hallucinated or pulled from a markedly older / pre-bureau checklist version.

#### `AW-24` — run-2: pass
**Run-2 evaluated:** "Profile views show existing and finished grade lines" — Sheet 19.
**Hypothesis:** Plausible older AW item (grade-line presence on profiles). Likely subsumed into AW-18 in v2.5 alongside the plan/profile layout check. Source: pre-bureau AW checklist drafts.

#### `AW-34` — run-2: not-applicable
**Run-2 evaluated:** "Refer to UCM Section 2.0 / 2.5 for additional technical criteria."
**Hypothesis:** Same shape as AW-35 — an informational pointer item from an older version that v2.5 deleted. Run-2 still emits it, marks n/a.

#### `AW-42` — run-2: not-applicable
**Run-2 evaluated:** "Reclaimed Water Service Extension Request (SER) documentation" — Sheet 7.
**Hypothesis:** AW-42 covered reclaimed-water SER (separate from regular SER which is AW-13/AW-16 in v2.5). Likely dropped because reclaimed-water-specific SERs are unusual.

#### `AW-50` — run-2: pass
**Run-2 evaluated:** "Austin Water review block/stamp area is present on the AW General Info Sheet" — Sheet 6, Block 2.
**Hypothesis:** This may be a fabricated check. The "review block" is a passive template element — every AW General Info Sheet has it. The model appears to have *read template elements off the page and reverse-engineered checklist deficiencies for them*, then assigned the next available AW-XX number.

#### `AW-51` — run-2: pass
**Run-2 evaluated:** "Expiration stamp/notice on AW General Info Sheet (18-month expiration)" — Sheet 6.
**Hypothesis:** Same as AW-50. The expiration stamp is a static template element. Model fabricated a checklist item for it.

#### `AW-52` — run-2: pass
**Run-2 evaluated:** "Utility coordination notes on plan and profile sheets (AULCC notification, verify existing utilities, protect during construction)" — Sheet 19, Block 11.
**Hypothesis:** The AULCC notification element is already covered by AW-10 in v2.5 (AULCC Requirement checkbox). Run-2 may have fabricated AW-52 as a "utility coordination notes" item on the P&P sheets, which is real-world AW concern but not a v2.5 deficiency.

### Summary of Section A

The pattern is consistent across all 13 "1/3" items:

- **Run-2 has access to a richer/older AW checklist mental model** that includes ~13 deficiencies the v2.5-trimmed version intentionally omits.
- **The v2.5 cc-13.md "Note on ID numbering" explicitly tells the model 7 of these IDs were removed.** Run-2 ignored it.
- **For AW-50, 51, 52, run-2 may be reverse-engineering checklist items from observed template elements.** This is the most worrying behavior — it's not "older version cached", it's "fabricate a deficiency to match what's on the page".

The verdicts run-2 produced (9 pass, 4 n/a) don't add real findings to the merged review (they're either passes or non-applicable). But:
- They inflate the appearance of coverage. The merged review reports "120 pass" when really 13 of those passes are non-existent items.
- They burn tool calls and tokens evaluating things that don't matter.
- Worst case, a future run could *fail* one of these fabricated items, propagating a false positive to a downstream city reviewer.

---

## Section B — The 5 items run-2 missed (2/3 detection)

These are real v2.5-trimmed items that runs 1 and 3 evaluated but run-2 omitted. The merged review's verdict for each is therefore based on 2 votes instead of 3.

For each, the v2.5 deficiency text + run-1 and run-3 findings are below.

### `AW-19` — Location map / Grid / Mapsco

**v2.5 text:** "General location map missing, or Grid number and Mapsco Page number not shown" (Always)

| Run | Status | Finding |
|---|---|---|
| 1 | pass | "Location map present on cover sheet with Mapsco Grid 614Q clearly shown" — Sheet 1, vision-tool confirmation. |
| 3 | pass | "Location map present on cover sheet with Mapsco Grid reference (614Q/614G) clearly shown" — Sheet 1, vision-tool confirmation. (Notes a discrepancy between vision result and block description — 614Q vs 614G.) |
| 2 | — | not evaluated |

**Hypothesis on why run-2 skipped:** AW-19 in older AW versions likely had different content (e.g. "AW-19 Service line valve schedule", or similar — historical AW checklists shuffled IDs around heavily). Run-2's older checklist may have either had a different AW-19 that wasn't applicable, or omitted AW-19 entirely. The five missed items as a set (`AW-19, 38a, 38b, 39, 49`) suggest the older checklist run-2 used **didn't track location-map / floodplain / drain-field / project-title items as discrete cc-13 line items** — those are general-submittal concerns that an older AW checklist may have left to other groupings (cc-3 cover sheet, cc-15 drainage, etc.).

### `AW-38a` — Floodplain / CWQZ / erosion hazard zones

**v2.5 text:** "Floodplain (25-yr/100-yr per ATLAS 14), CWQZ, or erosion hazard zones not shown on plans" (If site is in a floodplain)

| Run | Status | Finding |
|---|---|---|
| 1 | n/a | Site is FEMA Zone X (minimal flood hazard), outside 100-year floodplain. Condition not met. |
| 3 | n/a | FEMA Zone X, outside 100-year floodplain, no CWQZ. Condition not met. |
| 2 | — | not evaluated |

**Hypothesis on why run-2 skipped:** Floodplain overlay checks have moved between groupings across checklist versions (drainage vs utility vs cover sheet). Run-2's older cc-13 may not have included this conditional. Note that runs 1 and 3 both correctly resolved n/a using `facts.md` — this is a clean evaluation when run.

### `AW-38b` — Storm sewers / easements / watercourses

**v2.5 text:** "Storm sewers, easements, or watercourse centerlines not shown on plans" (Always)

| Run | Status | Finding |
|---|---|---|
| 1 | pass | Storm sewers shown on Sheet 18 with pipe sizes and manhole locations; legend defines storm-drain symbology. |
| 3 | pass | Sheet 18 shows existing 54″ and 18″ storm drain lines, curb inlets, junction boxes with elevations. Easements shown with dashed lines. No watercourses on site. |
| 2 | — | not evaluated |

**Hypothesis on why run-2 skipped:** AW-38b is split off from AW-38a in v2.5 — the older checklist may have had a single AW-38 with a different scope (or none). Run-2's checklist may have had no AW-38b at all.

### `AW-39` — Drain field for non-City sewer

**v2.5 text:** "Drain field not delineated on plans for property not on City sewer system" (If not on City sewer system)

| Run | Status | Finding |
|---|---|---|
| 1 | n/a | Site connects to City wastewater system via 12″ service line. Condition not met. |
| 3 | n/a | Site is City of Austin full-purpose, on City sewer. Condition not met. |
| 2 | — | not evaluated |

**Hypothesis on why run-2 skipped:** AW-39 is rarely-applicable (most COA sites are on City sewer). Run-2's older checklist may have omitted it as out-of-scope or merged it into a general "septic/private system" check elsewhere. Both runs that evaluated it correctly resolved to n/a.

### `AW-49` — Project title / dates on AW plan sheets

**v2.5 text:** "Project title, date of plans, or revision dates missing from Austin Water plan sheets (BAS-16)" (Always)

| Run | Status | Finding |
|---|---|---|
| 1 | pass | Sheets 6-7 show project title "1700 SOUTH LAMAR", template date Feb 7 2025, PE seal date 04/23/2026. |
| 3 | pass | Sheets 6-7 have complete title blocks: project title, template date, case number, sheet numbers, PE seal dates. |
| 2 | — | not evaluated |

**Hypothesis on why run-2 skipped:** AW-49 references "BAS-16" — a cross-reference to a "Basics" group of general-requirements checks. v2.5 added these BAS-* style references to make cross-grouping dependencies explicit. Run-2's older checklist likely didn't have these BAS items at all (they're a v2.5 addition), so it had no AW-49.

### Summary of Section B

The 5 missed items have a coherent pattern: they're items that v2.5 added or relocated into cc-13 (location map, floodplain overlay, storm sewers/easements, drain field, project-title). An older AW checklist would have these items in *different* groupings or not at all. Run-2's mental model of cc-13 doesn't include them.

For 1700 S. Lamar specifically, missing these doesn't change the merged verdict — all 5 resolved to pass or n/a in runs 1 and 3, and run-2 not voting still leaves a clear 2-0 majority. **But the coverage failure would matter on a different site:** if AW-19 or AW-49 were a `fail` on a project, run-2 missing it would shift the merged verdict from `2 fail / 1 missing` to `2 fail / 1 absent` — same result here, but at `runs=10` with one bad-actor run consistently missing the item, the math changes.

---

## Cross-cutting hypotheses on the root cause

After examining all 18 gap items together:

1. **Run-2 is using a stable but-different checklist scope.** It's not random — the items added (13) and items dropped (5) look like a *coherent older version of the AW checklist*, not random forgetting. Same story emerges in the high-variance report's Class A items: AW-23, AW-30, AW-32 all evaluate to *older deficiency texts* in run-2. This is one bug with two faces.

2. **The model has cached AW-checklist knowledge from training data.** v2.5-trimmed is a recent revision (the file's note implies a pre-trimmed version with AW-04, AW-09, AW-15, AW-17, AW-26, AW-35, AW-40, AW-43, AW-44 in scope). The model knows that older checklist. When loading v2.5, run-2 *blended* the loaded scope with model-internal knowledge — adding back items the file says were removed and dropping items the older version didn't have.

3. **The "Note on ID numbering" warning was insufficient to suppress the cached knowledge.** The cc-13.md file *explicitly tells the agent which IDs are out of scope*. Run-2 ignored it and evaluated 7 of those 9 explicitly-removed items anyway. The instruction is in narrative prose; the agent prompt may not be giving it operational weight.

4. **Why only run-2?** Two sub-hypotheses:
   - **Run-position dependence.** Run-2 might be the run with the most cache hits / highest-temperature output / most attention drift. If true, this would replicate at `runs=10` (e.g., runs 2/5/8 might all drift while 1/3/4/6/7/9/10 stay scope-correct). Worth instrumenting.
   - **Random model state.** Run-2's drift may be a stochastic outlier — at `runs=10` the rate would be ~33%/3 ≈ 11% per-run, so most items would stay unanimous and only a few would ghost-evaluate. Lower bar to cause a problem in production.
   - These are testable: at `runs=10`, the fraction of runs that evaluate `AW-09` (a known stale item) directly answers which sub-hypothesis is right.

5. **AW-50, 51, 52 are the most concerning behavior.** These aren't "model used cached older checklist". These are checklist items that don't appear to exist in any prior version, fabricated by reverse-engineering deficiency descriptions from observed template elements (review block, expiration stamp, utility-coordination notes). If this happens on cc-13, it can happen on any grouping with structured forms.

## Recommended actions

1. **Verify the root cause at `runs=10`.** Specifically check whether AW-09, AW-50, AW-51, AW-52 are evaluated at the same rate per run (deterministic by run-position) or randomly distributed (stochastic). The answer determines remediation.

2. **Strengthen the "removed/consolidated" suppression.** The narrative note in cc-13.md isn't enough. Consider:
   - Move the removed-IDs list into a structured field the prompt can read.
   - Add an explicit instruction to the review prompt: "Evaluate ONLY the IDs in the Checklist Items table. Do not evaluate any AW-XX item not present in that table, even if you believe it's a standard AW concern."
   - Or pre-filter the agent's output: any finding for a checklistItemId not in the loaded table gets dropped before consolidation.

3. **Treat detection-variance as a data-quality signal, not a measurement to vote on.** When `runCount < totalRuns`, the merged verdict is built on partial data. The current pipeline silently votes with whoever produced findings. A safer default: surface detection-variance items to a human reviewer, since `1/3 pass` is much weaker than `3/3 pass`.

4. **Re-validate the merged review.** For 1700 S. Lamar specifically, the merged review reports findings for AW-09, AW-15, AW-17, AW-24, AW-26, AW-34, AW-35, AW-42, AW-43, AW-44, AW-50, AW-51, AW-52 — none of which are v2.5 items. Those should be filtered out of the comments shown to the city reviewer.
