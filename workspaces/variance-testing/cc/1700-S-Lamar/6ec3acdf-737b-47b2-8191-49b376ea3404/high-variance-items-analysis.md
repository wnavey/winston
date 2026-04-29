# 1700 S. Lamar — High-Variance Items: Per-Item Analysis

**Review:** `6ec3acdf-737b-47b2-8191-49b376ea3404` · 3-run completeness-check (`runs=3`) · checklist `v2.5-trimmed` · 2026-04-28T17:29Z

This report deep-dives the **top 10 highest-variance refs** in the run, pulls the checklist text from `bureau/jurisdictions/austin/completeness-check/v2.5-trimmed/`, reads the per-run agent traces (`observation`, `reasoning`, `tools_used`, `evidenceLocations`), and forms hypotheses for each.

---

## TL;DR — Three classes of variance

The 10 items break cleanly into **three distinct failure modes**:

| Class | What's happening | Items | Remediation |
|---|---|---|---|
| **A. Checklist drift in run-2** | Run-2 is using a *different* checklist than runs 1 & 3 — same item ID, different deficiency text. The variance is essentially `run-2 vs everything else`. | `cc-13:AW-23`, `cc-13:AW-30`, `cc-13:AW-32` | Investigate how run-2 loaded its checklist (see [`gap-items-analysis.md`](./gap-items-analysis.md) for the matching scope drift). |
| **B. Same deficiency, different evidence judgement** | All runs evaluate the same checklist text but reach different conclusions because they read the data differently — different sheets, different vision-tool calls, different cross-references. | `cc-13:AW-05`, `cc-13:AW-18`, `cc-22:CC-22-20`, `cc-1:CC-1-02` | Tighten the agent's evidence protocol (which sheets to consult, when to cross-reference, what counts as "complete"). |
| **C. Same deficiency, different interpretation** | All runs read the same evidence but disagree on whether the deficiency *applies* given that evidence. The checklist text is genuinely ambiguous. | `cc-23:CC-23-07` (3-way), `cc-23:CC-23-01`, `cc-22:CC-22-15` | Clarify checklist text — especially conditional clauses ("If site fronts undivided street") and term definitions ("roadway" vs "ROW"). |

**Class A is the most actionable finding.** It implies a single root cause (checklist loading) and resolving it would automatically eliminate ~30% of split-verdict items in cc-13, plus the entire detection-variance category. Class B and C remain after Class A is fixed and represent the *true* model variance to study at `runs=10`.

---

## Class A — Run-2 Checklist Drift

For these items, **runs 1 and 3 evaluate the v2.5 deficiency text; run-2 evaluates something else**. The cc-13.md grouping file in `v2.5-trimmed` carries one definition; run-2 acts on a different one. Same item ID, different question.

### `cc-13:AW-23` — pattern `fail,pass,pass`, winning `pass` (medium conf), entropy 0.918

**v2.5 checklist text:**
> AW-23: Wastewater flow direction not indicated on plan views (Always)

| Run | Verdict | What run actually evaluated | Tools | Evidence sheets |
|---|---|---|---|---|
| 1 | **fail** | Wastewater flow direction arrows | vision | 18, 19 |
| 2 | pass | "10:1 vertical exaggeration on profile views" — *different question* | — | 19 |
| 3 | pass | Wastewater flow direction arrows | vision | 18, 19 |

**Run-1 reasoning:** vision-tool inspection found flow arrows on Sheet 19 plan views but **no flow arrows on Sheet 18 (Overall Utility Plan)**. Failed because "best practice is to show flow direction on all plan views".

**Run-3 reasoning:** vision tool found flow arrows on **both** Sheet 18 and Sheet 19. Passed.

**Run-2 reasoning:** evaluated whether profile scales use H 1″=40′ / V 1″=4′ vertical exaggeration. They do. Passed. **This is not the AW-23 deficiency in v2.5.**

**Hypothesis.** Run-2 is checking AW-23 from an older version of cc-13 where AW-23 was about profile-scale vertical exaggeration. v2.5-trimmed renumbered/replaced that item with the flow-direction check. Runs 1 and 3 received the v2.5 deficiency; run-2 received a stale version.

The remaining run-1-vs-run-3 disagreement (fail vs pass) is real and worth noting: same vision tool, different prompt → different conclusion about whether flow arrows are present on Sheet 18. Vision-tool nondeterminism, not checklist drift.

---

### `cc-13:AW-30` — pattern `fail,pass,pass`, winning `pass` (medium conf), entropy 0.918

**v2.5 checklist text:**
> AW-30: TCEQ crossing compliance details not shown where W/WW/reclaimed mains cross each other (Always; warn)

| Run | Verdict | What run actually evaluated | Tools | Evidence sheets |
|---|---|---|---|---|
| 1 | **fail** | TCEQ crossing compliance details (correct) | vision | 19 |
| 2 | pass | "AULCC notification note present" — *different question* | — | 18 |
| 3 | pass | TCEQ crossing compliance details (correct) | vision, semantic-search | 18, 19, 20 |

**Run-1 reasoning:** Sheet 19 has a "CAUTION! UTILITY CROSSING!" callout and an encasement detail box, but no explicit TCEQ-compliance language or specific separation distances. Marked fail.

**Run-3 reasoning:** Sheet 18 references profile sheets 19-20 for crossing details rather than callouts on the plan. TCEQ vertical separation is "likely on profile sheets". Marked pass — "for a warn item, this level of documentation may be acceptable".

**Run-2 reasoning:** found the AULCC notification note ("contact AULCC at 512-472-2677") on Sheet 18. Passed. **AULCC is unrelated to TCEQ crossings.**

**Hypothesis.** Same as AW-23: run-2 is acting on an older AW-30 (about AULCC notes) while v2.5 redefined AW-30 as TCEQ crossings. The genuine run-1-vs-run-3 disagreement is real — interpretation of "warn" leniency: run-1 wants explicit callouts; run-3 accepts cross-references to profile sheets.

---

### `cc-13:AW-32` — pattern `not-applicable,pass,not-applicable`, winning `not-applicable` (medium conf), entropy 0.918

**v2.5 checklist text:**
> AW-32: Typical cross sections not provided for private streets/easements with multiple utilities (If private streets or easements with multiple utilities)

| Run | Verdict | What run actually evaluated | Tools | Evidence sheets |
|---|---|---|---|---|
| 1 | n/a | Private streets cross sections (correct) | — | — |
| 2 | pass | "Site plan application form included" — *different question* | — | — |
| 3 | n/a | Private streets cross sections (correct) | vision | — |

**Run-1 / Run-3 reasoning:** site only has public streets (S Lamar, Collier, Kinney, Nash). No private streets means the conditional doesn't apply. Marked n/a.

**Run-2 reasoning:** "The checklist item requires a completed site plan application form to be included in the submittal package. The README shows a 'Consolidated Site Plan Application' document." **Site plan application is a cc-1 item, not a cc-13 AW-32 item.**

**Hypothesis.** Run-2 hallucinated AW-32 entirely. The "site plan application form" content is not even in the older AW checklist as far as we can tell — it's in cc-1. This is a more severe drift than AW-23/AW-30: not just an old version, but cross-grouping contamination.

---

## Class B — Same deficiency, different evidence judgement

These are real model variance: every run evaluated the same v2.5 deficiency and reached different conclusions because they consulted different evidence or weighted it differently.

### `cc-13:AW-05` — pattern `fail,pass,pass`, winning `pass` (medium conf), entropy 0.918

**v2.5 checklist text:**
> AW-05: AW Infrastructure Information table incomplete (missing product type, length, size, or services for W/WW/reclaimed) (Always)

All three runs read **the exact same table on Sheet 6, Block 11**: a Wastewater Main row with `NA` in length and size columns.

| Run | Verdict | Reasoning |
|---|---|---|
| 1 | **fail** | The Key Terms section says "N/A is never acceptable in numeric columns — use 0." The wastewater main row violates this. |
| 2 | pass | All rows have entries; "the use of 'NA' for wastewater main is appropriate when none is proposed". |
| 3 | pass | "'NA' is listed as 'NA' in the product type column itself, indicating the product is not applicable rather than a zero value. The table is complete for all applicable infrastructure." |

**Hypothesis.** This is a checklist-vs-key-terms tension. The Key Terms section explicitly states `N/A` is never acceptable in numeric columns. Run-1 honored that rule; runs 2 and 3 applied a "no infrastructure proposed" carve-out that's not in the checklist text. The checklist itself is the source of ambiguity — it embeds a hard rule in Key Terms that doesn't appear in the deficiency text or the validation methodology.

**Action.** This is a *real* checklist-clarity bug, not model variance. Either:
- Strengthen the deficiency text to say "must show 0 (not N/A) in numeric columns when none of that infrastructure is proposed", OR
- Add a Validation Methodology line clarifying that `NA` in product-type column is acceptable when truly inapplicable.

Run-1 is arguably *more correct*; the merged `pass` is reached by majority vote, which is masking a real deficiency.

---

### `cc-13:AW-18` — pattern `fail,pass,pass`, winning `pass` (medium conf), entropy 0.918

**v2.5 checklist text:**
> AW-18: Profile view missing for public water/reclaimed/wastewater mains, or plan view not at top half of sheet per UCM 2.5.1.E.3 (Always)

| Run | Verdict | Decisive evidence | Tools |
|---|---|---|---|
| 1 | pass | Vision tool: plan views top, profile bottom, scales correct | vision |
| 2 | **fail** | Cross-referenced AW Infrastructure table (44 LF of 12″ water main on Sheet 6) against Sheet 19 contents (only services, no public main extension) → "missing profile for 44 LF main"; *also* claimed plan/profile layout is reversed | vision |
| 3 | pass | Vision tool: plan top, profile bottom; "shows profiles for the proposed public water and wastewater infrastructure" | vision |

**Hypothesis.** Three different things are going on here:

1. **Cross-reference rigor.** Only run-2 cross-referenced the Infrastructure Information table (Sheet 6, Block 11) against the actual P&P sheets (19-20). That cross-reference uncovered an apparent missing main extension. Runs 1 and 3 only inspected sheets 19-20 in isolation and saw correct plan/profile layout.
2. **Vision-tool nondeterminism.** Run-2's vision call returned "plan above profile, layout reversed", whereas runs 1 and 3 got the opposite reading. The exact image being analyzed was the same.
3. **Conflicting truths.** Run-2's "44 LF main missing" finding may actually be correct — if the AW Infrastructure table lists 44 LF of public water main, but the P&P sheets only show service lines, that's a real deficiency. The merged `pass` may be hiding a real fail.

**Action.** This is the most operationally interesting Class B item. It suggests two improvements:
- Force every run to cross-reference the Infrastructure table against the P&P sheets (currently optional).
- Consider weighting vision-tool outputs by confidence; the run-1/run-3 vision results contradict run-2's — that conflict alone should trigger reviewer attention rather than getting voted away.

---

### `cc-22:CC-22-20` — pattern `fail,pass,fail`, winning `fail` (medium conf), entropy 0.918

**v2.5 checklist text:**
> CC-22-20: Parking aisle widths or internal driveway widths not dimensioned (PRK-04) (Always)

| Run | Verdict | Decisive evidence |
|---|---|---|
| 1 | fail | Vision: "no dimension lines or text indicating widths of drive aisles between parking rows" |
| 2 | **pass** | Found "24'-0″ TYP (MIN)" in the Sheet 37 *symbol legend* |
| 3 | fail | Same vision finding as run-1; saw the legend's 5'-0" accessible aisle but not the 24'-0" |

**Hypothesis.** Same image, different attention. Run-2's vision call surfaced a "24'-0″ TYP (MIN)" annotation in the symbol legend. Runs 1 and 3 either didn't surface that text or judged "in legend ≠ dimensioned on plan". The disagreement is over what counts as "dimensioned": (a) any dimension referenced in any legend, or (b) dimension lines on the actual plan view.

The merged `fail` is probably right — a typical-condition note in a legend is weaker evidence than a dimensioned plan view, and that's how a city reviewer would read it.

**Action.** Add a Validation Methodology line: "Aisle/driveway dimensions must appear on the plan view itself, not only as typical-condition notes in a legend or symbol table."

---

### `cc-1:CC-1-02` — pattern `fail,fail,pass`, winning `fail` (medium conf), entropy 0.918

**v2.5 checklist text:**
> CC-1-02: CC Application has incomplete or missing required fields in Sections 1-11 (INT-02) (Always)

| Run | Verdict | Decisive evidence |
|---|---|---|
| 1 | fail | Vision saw blank Small Project checkboxes (Section 1) and blank School District field (Section 6) |
| 2 | **pass** | Vision claimed all required fields populated, including project name "1700 South Lamar" |
| 3 | fail | Saw placeholder text "the project" in Section 1 fields, unanswered Small Project question, owner name "SL the project, LP" |

**Hypothesis.** This is the only Class B item where I suspect **vision-tool output drift between calls**. Run-2's vision claimed concrete project name "1700 South Lamar" was visible in Section 1; run-3's vision claimed Section 1 had placeholder text "the project". Both are reading the same PDF page. Two possibilities:
1. The pre-processed text version was anonymized ("the project") but the original PDF has the real name. Runs 1 and 3 read the pre-processed text; run-2 used vision and saw the original.
2. Vision-tool nondeterminism / different framing of the question.

If (1) is the case, run-2 is correct and the merged `fail` is wrong. If (2), the verdict is genuinely ambiguous.

**Action.** Worth a manual spot-check. The pre-processing pipeline may be anonymizing form fields that the vision tool can still read on the source image — if so, the agent should be told which is canonical for completeness checks.

---

## Class C — Same deficiency, different interpretation

These are the items where the model variance reflects a genuine ambiguity in the checklist text or in the underlying evidence — not a bug.

### `cc-23:CC-23-07` — pattern `fail,not-applicable,pass`, winning `fail` (low conf), entropy 1.585 (max)

**v2.5 checklist text:**
> CC-23-07: Signage and striping plan not provided for new or modified roadway in ROW (RDW-03) (If new roadway construction or work in ROW)

This is the only **3-way split** in the entire review. Maximum-entropy disagreement.

| Run | Verdict | Reasoning summary |
|---|---|---|
| 1 | pass | "Work in ROW exists (parking bays, sidewalks, driveways). Sheet 13 is titled 'PAVING & STRIPING PLAN' and shows striping for ROW improvements (parking stalls, crosswalks). The deficiency does NOT exist." |
| 2 | fail | "Work in ROW IS proposed (sidewalks, driveways, parallel parking). But vision found NO proposed signage or roadway striping within the public ROW. Sheet 13's striping is internal site striping, not ROW roadway striping." |
| 3 | n/a | "Work in ROW is limited to behind-the-curb improvements (sidewalks, curbs, ADA ramps). 'Roadway' refers to the traveled way (pavement, lanes, shoulders), not the full ROW. The project's ROW work does not modify the roadway itself, so a roadway signage and striping plan is not required." |

**Hypothesis — checklist text is genuinely ambiguous.** The deficiency hinges on three terms that are not defined in cc-23.md:

1. **"Work in ROW"** — does this include behind-the-curb work (sidewalks, ADA ramps), or only roadway pavement work?
2. **"Roadway"** — defined narrowly as travel lanes (run-3's interpretation) or broadly as anything in the public ROW (run-2's interpretation)?
3. **"Signage and striping plan"** — does Sheet 13's "Paving & Striping Plan" satisfy this even though it primarily shows internal site striping (run-1's interpretation), or is a separate ROW-specific plan required (run-2)?

Each run picked a defensible reading of these terms. The merged `fail` was decided by entropy 1.585 — a **literal coin flip**.

**Action — checklist text fix.** Tighten three things:
- Define "roadway" explicitly (TXDOT/COA standard: travel way, not full ROW).
- Specify what triggers the conditional: e.g., "If new pavement, lanes, or travel-way modifications proposed in ROW (excludes sidewalks, curbs, ramps, ADA improvements)".
- Specify what counts as a "signage and striping plan": dedicated sheet or component of paving plan? Pavement markings only or vertical signs too?

Until this is fixed, this item will continue to produce noise at any N. **Treat the merged verdict as unreliable — manual reviewer triage required.**

---

### `cc-23:CC-23-01` — pattern `fail,fail,pass`, winning `fail` (medium conf), entropy 0.918

**v2.5 checklist text:**
> CC-23-01: Existing ROW width not shown or not dimensioned (GRD-01) (Always)

| Run | Verdict | Decisive evidence |
|---|---|---|
| 1 | fail | All streets labeled `(R.O.W. VARIES)`. No specific dimensions. |
| 2 | pass | Found `(50' R.O.W.)` for Collier on Sheet 8; Kinney/Nash say `VARIES`. "VARIES is still informative, ROW info is documented." |
| 3 | fail | Found `(50.0' R.O.W.)` for Collier on Sheet 8 (same as run-2!), but failed because Kinney and Nash still show `VARIES` without specific dimensions. |

**Hypothesis.** Runs 2 and 3 saw the same evidence (Collier dimensioned, Kinney/Nash labeled `VARIES`) but interpreted the deficiency differently:
- Run-2: "ROW info is documented for any reasonable interpretation → pass"
- Run-3: "Some streets are dimensioned, some aren't → fail"

Run-1 missed the Collier dimension entirely (didn't drill into Sheet 8 deeply enough or vision returned a less complete reading), so its evidence is incomplete.

**Action.** Clarify the checklist: must *every* fronting street's ROW be dimensioned, or is it sufficient that the dimensioned ones provide enough context? Add a Validation Methodology line.

The interesting meta-observation: this is a "the model agrees on facts but disagrees on the rule" case. Different from the AW-30 case where they disagree on facts. Both produce 2-1 splits but their remediation is different.

---

### `cc-22:CC-22-15` — pattern `fail,fail,not-applicable`, winning `fail` (medium conf), entropy 0.918

**v2.5 checklist text:**
> CC-22-15: Offsets from opposing driveways not dimensioned on undivided street frontage (DRV-05) (If site fronts undivided street)

| Run | Verdict | Reasoning |
|---|---|---|
| 1 | fail | Site fronts undivided streets; offset dimensions not shown. |
| 2 | fail | Site fronts undivided S Lamar; no opposing driveways shown, no offset dimensions. "Even if opposing driveways don't currently exist, the plans should show the existing condition across the street to demonstrate there are no opposing driveways." |
| 3 | n/a | Site fronts undivided street, but **no opposing driveway exists**. Therefore there is no offset to dimension. |

**Hypothesis.** Genuine interpretive split on what the deficiency requires when no opposing driveway exists:
- Runs 1 & 2: the deficiency is "offsets not dimensioned" → if no offset shown, it's a fail (the plan should affirmatively demonstrate no opposing driveway exists).
- Run-3: the deficiency only triggers when there's an offset to dimension. No opposing driveway → no offset → not applicable.

Both are defensible. The checklist text supports run-3 literally ("offsets from opposing driveways" presupposes opposing driveways exist), but completeness-check practice often expects affirmative evidence (runs 1 & 2's reading).

**Action.** Tighten checklist text. Either:
- "Where opposing driveways exist on the undivided street, offset dimensions must be shown" (run-3's reading), OR
- "Plans must demonstrate either offset dimensions to opposing driveways or affirmative confirmation that no opposing driveway exists" (runs 1 & 2's reading).

---

## Cross-cutting hypotheses

After looking at all 10 items together:

1. **Class A (~30% of split-verdict items in cc-13) is a deterministic bug, not stochastic variance.** Run-2 is consistently the odd one out, on items where the v2.5 deficiency text was changed from an older version. This points squarely at a checklist-loading or context-management issue specific to that run. See the gap-items report for the matching scope-drift evidence.

2. **Vision-tool calls are a real source of variance even on identical inputs.** AW-23, AW-18, CC-22-20, CC-1-02 all show vision-tool calls on the same image producing different surfaced details. Two implications: (a) vision queries should be tightly scoped per checklist item, and (b) when vision results conflict across runs, that conflict is a *signal* worth surfacing, not noise to vote away.

3. **Several "splits" are actually checklist-text bugs surfacing as model variance.** AW-05 (NA-vs-0 rule buried in Key Terms), CC-23-07 (undefined "roadway"), CC-22-15 (presuppositional condition) — fixing the checklist eliminates the variance. The variance test is doing double duty as a checklist-quality test, which is useful but worth being explicit about.

4. **Variance ≠ wrong.** On AW-05 and AW-18, the *minority* verdict (1 of 3 fails) appears to be the more rigorous read. Majority voting is masking real deficiencies. At `runs=10`, weight by reasoning quality (e.g., "did the run cross-reference the Infrastructure table?") rather than raw majority.

5. **All three classes will behave differently as N increases.** At `runs=10`:
   - Class A items: run-2's drift may either persist (if it's deterministic per-run-position) or disappear (if it was random model state). Worth instrumenting.
   - Class B items: entropy will sharpen; either the rigorous reading dominates or the lenient one does, but the result becomes statistically meaningful.
   - Class C items: entropy will *stay high*. Genuine ambiguity is genuine ambiguity. These are the items that won't be fixed by more samples — they need checklist edits.
