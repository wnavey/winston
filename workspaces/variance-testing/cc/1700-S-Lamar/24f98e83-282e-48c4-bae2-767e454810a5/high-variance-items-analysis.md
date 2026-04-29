# 1700 S. Lamar runs=10 — High-Variance Items: Per-Item Analysis

**Review:** `24f98e83-282e-48c4-bae2-767e454810a5` · 10-run completeness-check (`runs=10`) · checklist `v2.5-trimmed` · 2026-04-28T23:33Z

This report deep-dives the top 10 highest-entropy refs from the runs=10 baseline, sorted by closeness-to-tied (entropy descending). For each ref I pull the v2.5-trimmed checklist text, read every run's `tools_used`, `evidenceLocations`, `observation`, and `reasoning`, and form a hypothesis for *why* the runs disagreed.

---

## TL;DR — Five distinct mechanisms produce the top-10 splits

After reading 100 per-run agent traces (10 refs × 10 runs), the top-10 disagreements decompose into **five distinct mechanisms**, each requiring a different remediation:

| Mechanism | Items | Remediation |
|---|---|---|
| **A. Vision-tool nondeterminism** — the same image returns different content on different calls | `cc-13:AW-23`, `cc-13:AW-27`, `cc-22:CC-22-14`, `cc-23:CC-23-01` | Tool-side fix: deterministic vision, or majority-vote across N vision calls per question |
| **B. Genuine checklist/methodology ambiguity** — the deficiency text or validation methodology is open to multiple defensible readings | `cc-23:CC-23-07`, `cc-13:AW-45`, `cc-1:CC-1-26` | Checklist text edits |
| **C. Source-data conflict** — `facts.md` itself contains contradictory information | `cc-24:CC-24-15` | Fix the upstream facts pipeline |
| **D. Substantive-vs-semantic equivalence judgment** — runs disagree on whether a textual difference matters | `cc-3:CC-3-18` | Tighten validation methodology with concrete examples |
| **E. Sampling/attention variance** — runs sampled different sheets and missed evidence others found | partial contributors to `cc-1:CC-1-26`, `cc-22:CC-22-15` | Tighten validation methodology to require specific sheet-set coverage |

**The most actionable finding is Mechanism A (vision nondeterminism).** Four of the top 10 high-variance refs are dominated by it. In each case, runs are looking at the same image (e.g., Sheet 19 wastewater plan view) and asking the same question (e.g., "are flow direction arrows present?"), yet some runs' vision-tool calls report "yes, arrows are clearly shown" while others report "no arrows visible." This is not interpretation variance — it's tool-output variance on identical inputs. **Reducing this alone would resolve a substantial fraction of split-verdict items at any N.**

---

## Per-item deep-dives (sorted by entropy desc)

### 1. `cc-23:CC-23-07` — entropy **1.486** (3-way: 5 n/a / 3 pass / 2 fail)

**v2.5 deficiency text:**
> CC-23-07: Signage and striping plan not provided for new or modified roadway in ROW (RDW-03)
> Condition: *If new roadway construction or work in ROW*

**Mechanism:** **B — checklist ambiguity.** The deficiency text and condition both turn on terms that are not defined in the checklist:
- "work in ROW" — does this include behind-the-curb improvements (sidewalks, curbs, ADA ramps), or only roadway pavement work?
- "roadway" — narrowly the travel way (lanes, pavement), or broadly the full ROW?
- "Signage and striping plan" — is Sheet 13's "Paving & Striping Plan" sufficient, even though most of its striping is for internal site features?

**How the 10 runs split:**

| Verdict | Runs | Tools | Their reading |
|---|---|---|---|
| not-applicable (5) | 1, 2, 4, 6, 8 | vision (+ semantic-search on run-1) | "Work in ROW = sidewalks + driveway aprons. The roadway itself is not modified, so this item doesn't apply." |
| pass (3) | 3, 5, 7 | vision | "Sheet 13 is titled 'Overall Site & Paving & Striping Plan' and shows striping for ROW work (parallel parking on Collier, crosswalks, fire lanes). Plan is provided." |
| fail (2) | 9, 10 | vision | "Striping IS shown for ROW work, but signage is NOT shown. The deficiency requires both signage AND striping." |

All 10 runs examined the same Sheet 13 evidence. The split is purely interpretive: 5 runs say "no roadway, no requirement"; 3 runs say "Sheet 13 provides the plan"; 2 runs say "incomplete plan = fail."

**This same ref was the only 3-way split in the runs=3 baseline** (entropy 1.585 then). With 10 votes the entropy dropped to 1.486 — *not because the model is converging*, but because the n/a interpretation now has a clear plurality.

**Recommendation:** This is the canonical example of a checklist-text bug. More N will not resolve it. The checklist should:
1. Define "work in ROW" explicitly (e.g., "modifications to roadway pavement, lane configuration, or median — excludes sidewalks, curbs, and ADA ramps").
2. Specify what counts as the required deliverable (e.g., "a plan sheet showing pavement markings AND vertical signs within the ROW"; or "Sheet 13 satisfies if striping is shown — vertical signs are reviewed separately").

---

### 2. `cc-13:AW-45` — entropy **1.000** (perfect 5-5 split)

**v2.5 deficiency text:**
> AW-45: Street address not shown for all existing structures on the lot(s)
> Condition: *Always*

**Methodology note in cc-13.md:** *"AW-45: Recordation numbers (volume/page) are only expected for existing easements…"* (this is actually for AW-27; AW-45 has no special methodology beyond the deficiency text)

**Mechanism:** **B — methodology ambiguity.** Site has 3 parcel addresses: 1700 S Lamar, 1401 Collier, 1509 Collier. Existing structures on multiple parcels. Validation methodology elsewhere in the prompt says "cover sheet sufficient for single-address site" — but is this site single-address or multi-address?

**How the 10 runs split:**

| Verdict | Runs | Tools | Reasoning |
|---|---|---|---|
| fail (5) | 1, 3, 5, 6, 9 | vision | "Site has multiple parcel addresses (1700 S Lamar, 1401 Collier, 1509 Collier). Existing buildings on Sheet 8 are labeled '1 STORY WOOD AND FRAME RESIDENCE TO BE REMOVED' and '14,889 SQ. FT. BUILDING FOUNDATION TO BE REMOVED' but **not with their specific addresses**. Multi-parcel site requires per-structure addresses." |
| pass (5) | 2, 4, 7, 8, 10 | vision (run-10 used no tools) + semantic-search | "Cover sheet shows '1700 SOUTH LAMAR' as primary address. The proposed development is a single mixed-use building. Per validation methodology, cover-sheet address sufficient for single-address site. Existing parcels are being consolidated." |

Note that **runs 1, 3, 6 all ran vision on Sheet 8** (the existing conditions plan) and saw the unlabeled structures. Runs 2, 4, 7, 8 sampled Sheet 1 (cover) instead and saw the primary address only. **The split is partially driven by which sheet each run chose to sample** — runs that sampled Sheet 8 noticed missing per-structure addresses; runs that sampled Sheet 1 saw the primary address and concluded sufficient.

**Run-7's reasoning is particularly revealing:** "*This is single consolidated development with one address (1700 South Lamar), not multiple structures with separate addresses.*" Run-7 explicitly framed this as "single proposed building." Other passes (run-2, 4, 8, 10) used similar logic.

**Recommendation:** This is **B + E mixed**. The methodology has a real gap: it doesn't say what to do for a multi-parcel site with a single proposed structure. A clarification like *"For multi-parcel sites being consolidated into a single development, the proposed-building address is sufficient. For sites with multiple existing structures at different addresses (e.g., demolition lots with historical addresses), label each existing structure with its address."* would resolve this. The 5/5 split won't move at higher N until the methodology is tightened.

---

### 3. `cc-24:CC-24-15` — entropy **1.000** (5 fail / 5 not-applicable)

**v2.5 deficiency text:**
> CC-24-15: Plans not submitted or referenced for AULCC when excavations exceed 25 LF in DAPCZ or 300 LF outside DAPCZ (ROW-02)
> Condition: *If excavations exceed AULCC thresholds*

**Mechanism:** **C — source data conflict.** The condition turns on whether the site is in the DAPCZ (Downtown Austin Project Coordination Zone). The site's `facts.md` contains **two contradictory statements**:
- "Downtown Austin: Not in downtown district" (one line)
- "Downtown Project Coordination Zone: South sector" (another line)

Different runs picked different statements as authoritative.

**How the 10 runs split:**

| Verdict | Runs | Reading of facts.md | Conclusion |
|---|---|---|---|
| fail (5) | 1, 5, 6, 7, 9 | "Downtown Project Coordination Zone: South sector" → site IS in DAPCZ | 25 LF threshold applies. ~70-100 LF in ROW exceeds it. Sheet 6 says AULCC required but UCC# is "pending" → fail. |
| not-applicable (5) | 2, 3, 4, 8, 10 | "Not in downtown district" → site NOT in DAPCZ | 300 LF threshold applies. ~95-200 LF estimated in ROW does not exceed → condition not met. |

**This is striking.** All 10 runs measured ROW excavation lengths in roughly the same range (~70-200 LF). The split is purely about which `facts.md` field they treated as authoritative for "DAPCZ status." **The variance lives in the data, not in the model.** Notably:
- Run-9 used `Read` and `Grep` on facts.md text directly (only run to do so) and concluded fail.
- Run-7 cited the DAPCZ legal definition (Code § 14-11-161(7)) — bounded by MLK / Mopac / Chicon / Oltorf — and reasoned that the site is south of Oltorf, hence outside DAPCZ. This is technically the most rigorous read.

**Run-7's reasoning is a key insight:** *"DAPCZ is bounded by MLK/Enfield (N), Loop 1/Mopac (W), Chicon St (E), Oltorf/Barton Skyway (S). Site is at 1700 S Lamar Blvd, Council District 9, not within these boundaries."* If facts.md correctly reflected the DAPCZ legal boundary, all 10 runs would have agreed.

**Recommendation:** Fix the facts pipeline. The two facts.md fields are actually consistent — "Downtown Project Coordination Zone" is a different administrative concept from "Downtown Austin / DAPCZ" — but they sound similar enough that the model can't reliably distinguish. Either rename the fields, or flag the DAPCZ boundary explicitly with the bounding streets.

---

### 4. `cc-13:AW-23` — entropy **0.971** (6 fail / 4 pass)

**v2.5 deficiency text:**
> AW-23: Wastewater flow direction not indicated on plan views
> Condition: *Always*

**Mechanism:** **A — vision-tool nondeterminism.** All runs called vision on Sheet 18 (Overall Utility Plan) or Sheet 19 (Water & Wastewater PNP) with the same question. The vision tool gave **opposite answers across runs on identical images.**

**How the 10 runs split:**

| Verdict | Runs | Vision tool reported |
|---|---|---|
| fail (6) | 1, 2, 3, 7, 8, 10 | "No flow direction arrows visible on wastewater lines" (Sheet 18 and/or 19) |
| pass (4) | 4, 5, 6, 9 | "Flow direction arrows are clearly shown" (Sheet 18 or 19) |

Sample contradictions on the **same Sheet 19**:
- Run-3: *"vision analysis reported: 'No, flow direction arrows are not visible on the wastewater lines'"*
- Run-5: *"vision analysis confirmed: 'directional arrows are drawn along the main pipe line indicating flow from left to right'"*

Sample contradictions on the **same Sheet 18**:
- Run-7: *"vision of Sheet 18 found NO flow arrows on wastewater lines"*
- Run-9: *"vision analysis confirmed: 'Yes, flow direction arrows are clearly shown on the wastewater lines'"*

**This is not interpretation variance.** Both runs used vision and the visual content didn't change between calls. The vision LLM's response varied.

Run-2 did *not* use vision (only `semantic-search-blocks` on the legend) and concluded fail because *"the legend does not show a flow direction arrow symbol."* That's a defensible inference but not direct evidence.

**Recommendation:** This is the highest-leverage finding from the variance experiment so far. Vision-tool nondeterminism on simple visual questions ("are arrows present?") accounts for a substantial fraction of split-verdict items. Mitigations:
1. Reduce temperature on the vision LLM (or use deterministic mode if available).
2. Cache vision responses per (documentId, sheetNumber, prompt-hash) so runs share the same answer.
3. For high-stakes binary visual questions, run vision N times and majority-vote *within a single agent task*.

---

### 5. `cc-13:AW-27` — entropy **0.971** (4 fail / 6 pass)

**v2.5 deficiency text:**
> AW-27: Recorded easement recordation numbers (volume/page) not shown for existing easements, or proposed easement limits not indicated
> Condition: *Always*

**Mechanism:** **A — vision-tool nondeterminism**, same pattern as AW-23.

All 10 runs agree on:
- Proposed easements appropriately use blank "DOC NO. ___" placeholder (per validation methodology) ✓
- Per facts.md, existing easements include 7.5' PUE (Doc 76/388), 5' PUE, etc.

The disagreement is whether **existing easements** are labeled with their recordation numbers on the utility plan sheets:

| Verdict | Runs | Vision result for "existing easement recordation on Sheet 18" |
|---|---|---|
| fail (4) | 1, 2, 6, 7 | No volume/page callouts visible on utility plans for existing easements |
| pass (6) | 3, 4, 5, 8, 9, 10 | Volume/page references found, e.g. "*15' PUBLIC UTILITY EASEMENT DOC. NO. 2002130382, EXISTING 5' P.U.E. (VOL. 50, PG. 81), EXISTING 15' WATER EASEMENT VOL. 8, PG. 135*" (run-9 quote) |

Run-3 explicitly quotes vision: *"Existing easements use the Volume/Page format (e.g., '10' P.U.E. VOL. 55, PG. 61' and '10' P.U.E. VOL. 76, PG. 388'). Proposed easements utilize the acceptable document number placeholder suffix format."*

Run-7 also using vision says: *"Vision analysis did not reveal volume/page callouts on utility plan sheets for existing easements."*

Same sheet, same question, opposite vision answers.

**Recommendation:** Same as AW-23. This is the second clearest case of vision-tool nondeterminism in the top 10.

---

### 6. `cc-1:CC-1-26` — entropy **0.971** (4 fail / 6 pass)

**v2.5 deficiency text:**
> CC-1-26: One or more sheets not sealed by active TX PE, or missing dated signature or engineering firm registration number (INT-26)
> Condition: *Always*

**Mechanism:** **B + E — checklist ambiguity + sampling variance.** The deficiency text says "all sheets sealed by active TX PE." The plan set has 52 sheets including engineering, architectural, and landscape sheets. Different professions seal different work. Run sampling and interpretation both vary.

**How the 10 runs split:**

| Verdict | Runs | Sheets sampled | Reasoning |
|---|---|---|---|
| fail (4) | 1, 2, 5, 10 | 35-52 (architectural + landscape) | Literal reading: "all sheets need PE seal." Landscape sheets have LA seals only; arch sheets 35-41 have no seal at all (run-2, 10). |
| pass (6) | 3, 4, 6, 7, 8, 9 | 1-25 mostly (civil) | Standard practice: each discipline seals its own work. PE seals on civil sheets is sufficient. |

Two distinct issues conflated:
1. **Should landscape sheets have PE seals or LA seals?** Standard practice is LA seals; literal checklist reading says PE seals. This is interpretive (Mechanism B).
2. **Architectural sheets 35-41 have NO seal** (per run-2 and run-10 vision). This is a real deficiency that 6 of 10 runs missed because they sampled civil sheets only. Run-2's vision: *"Sheet 37 (Building Plan Level 1, architectural): NO PE seal, NO architect seal, firm is 'ktgy'"* — this is the substantive find.

Notably: run-10 was the only run that sampled both arch sheets (35-41) AND landscape sheets (42-52) and caught both issues. Most other runs sampled either civil sheets (passes) or just landscape (fails on the seal-type question without noticing the missing arch seals).

**Recommendation:** This split is partially a real deficiency that the merged pass result is masking. A reasonable resolution:
1. Tighten the methodology to require sampling architectural sheets explicitly.
2. Clarify that sheets sealed by appropriate registered professional (PE for engineering, LA for landscape, RA for architectural) is sufficient — but a sheet with NO professional seal is a fail.

---

### 7. `cc-22:CC-22-14` — entropy **0.971** (6 fail / 4 pass)

**v2.5 deficiency text:**
> CC-22-14: Adjacent driveways within 300 feet not shown on plans (DRV-04)
> Condition: *Always*

**Mechanism:** **A — vision-tool nondeterminism**, same pattern as AW-23 and AW-27.

All 10 runs called vision on Sheet 13 with essentially the same question ("are adjacent driveways visible on neighboring properties?"). The vision tool's answers split:

| Verdict | Runs | Vision result |
|---|---|---|
| fail (6) | 2, 3, 5, 6, 7, 8 | "No driveways for adjacent properties depicted" |
| pass (4) | 1, 4, 9, 10 | "Adjacent driveways visible on neighboring properties" |

Sample contradictions on **same Sheet 13**:
- Run-3: *"vision analysis: 'Adjacent driveways on neighboring properties are not shown on this plan…'"*
- Run-1: *"vision tool confirmed adjacent driveways are depicted graphically on the plan… directly across Collier Street to the north."*
- Run-9: *"vision tool confirmed that existing driveways on neighboring properties are visible on the plan, particularly across Collier Street serving the Rogers Wilson Subdivision properties."*

Run-6 showed an interesting middle position: *"one existing driveway IS shown for adjacent South Lamar Business Park property … but does not show driveways on other adjacent properties to the north, east, or west."* That partial-detection read is more nuanced than the binary fail/pass and might be the most accurate ground truth.

**Recommendation:** Same as AW-23 — vision nondeterminism. Plus a methodology fix: explicitly require the plan to show driveways on **all four adjacent street frontages** within 300 ft, not just any adjacent driveway.

---

### 8. `cc-23:CC-23-01` — entropy **0.971** (6 fail / 4 pass)

**v2.5 deficiency text:**
> CC-23-01: Existing ROW width not shown or not dimensioned (GRD-01)
> Condition: *Always*

**Mechanism:** **B — interpretive split** with one **vision misread (Mechanism A)**.

All runs see the same evidence on Sheets 8-9: Collier Street labeled "(50' R.O.W.)", Evergreen Avenue "(50' R.O.W.)", S. Lamar / Kinney / Nash labeled "(R.O.W. VARIES)" (no specific dimension).

| Verdict | Runs | Reasoning |
|---|---|---|
| fail (6) | 2, 3, 6, 7, 8, 9 | "VARIES" without numerical dimensions does not satisfy "shown or dimensioned" — the primary frontage (S. Lamar) lacks a width. |
| pass (4) | 1, 4, 5, 10 | "VARIES" + dimensions where applicable count as "shown" — text labels are an acceptable form of dimensioning. |

**Plus one vision misread:** Run-10's vision reported *"South Lamar Boulevard labeled as '(100' R.O.W.)'"* — but every other run that examined the same sheet saw "(R.O.W. VARIES)". This is likely a vision hallucination (the model invented a dimension that isn't on the page).

**Recommendation:** The interpretive split (6 vs 4 minus the misread vision = 6 vs 3 + 1 misread) suggests the literal-reading ("VARIES is not a dimension") wins. Tighten the methodology: *"`VARIES` is acceptable only when accompanied by representative width dimensions at multiple stations (e.g., '60' to 80' VARIES'). Bare 'VARIES' without numerical context is insufficient."*

---

### 9. `cc-3:CC-3-18` — entropy **0.971** (6 fail / 4 pass)

**v2.5 deficiency text:**
> CC-3-18: Verbatim Ordinance Requirements notes missing or incomplete on cover sheet (9 required notes per Notes and Templates DOCX) (CVR-18)
> Condition: *Always*

**Mechanism:** **D — substantive vs semantic equivalence judgment.**

All 10 runs found the 9 Ordinance Requirements notes on Sheet 5 (Block 16). Note 1 has a textual deviation:
- **Reference:** *"Any additional improvements will require a site plan amendment."*
- **As written on Sheet 5:** *"ANY ADDENDA, AMENDMENTS WILL REQUIRE A SITE PLAN EXEMPTION."*

Runs split on whether this is a substantive error or semantic-equivalence variation:

| Verdict | Runs | Reasoning |
|---|---|---|
| fail (6) | 1, 2, 3, 6, 7, 10 | "*Site plan amendment* and *site plan exemption* are different regulatory processes (amendment modifies, exemption waives). Substantive alteration, not semantic equivalence." |
| pass (4) | 4, 5, 8, 9 | Treated as semantic equivalence; some explicitly noted *"minor wording variation"*. |

**The fail runs are correct.** "Site plan amendment" and "site plan exemption" are distinct legal terms in COA's site plan code — an amendment modifies an approved site plan; an exemption is a waiver from site-plan filing requirements. Calling out this difference as "substantive" is the right read.

**Bonus finding:** Run-3 also flagged a *separate* issue not caught by other runs: *"note #7 contains unedited template instruction text: 'WATER AND WASTEWATE…'"*. That's a real deficiency the merged result doesn't surface.

**Recommendation:** Tighten the validation methodology with a concrete example: *"The 90% semantic-match threshold does not apply to specific legal/procedural terms (e.g., 'amendment' vs 'exemption' vs 'waiver'). These are distinct regulatory processes; substituting one for another is a substantive failure."* This would close the 4 false-passes.

---

### 10. `cc-22:CC-22-15` — entropy **0.922** (8 fail / 1 not-applicable / 1 pass)

**v2.5 deficiency text:**
> CC-22-15: Offsets from opposing driveways not dimensioned on undivided street frontage (DRV-05)
> Condition: *If site fronts undivided street*

**Mechanism:** **E — sampling/attention variance** — not really a high-variance ref. 8 of 10 runs reach the same fail conclusion. The 2 dissenters made discrete factual errors:

| Verdict | Runs | Notes |
|---|---|---|
| fail (8) | 1, 2, 3, 5, 6, 8, 9, 10 | Site fronts undivided streets (Collier 2U, S. Lamar 5U). No offset dimensions shown. |
| not-applicable (1) | 4 | "*No driveways proposed on S Lamar*" — but ignored Collier Street, which is *also* undivided and DOES have proposed driveways. **Attention error.** |
| pass (1) | 7 | Vision reported *"South Lamar Blvd is shown as a divided street… A physical median (solid lines forming an island with a rounded nose) is clearly drawn"* — but other 9 runs and facts.md confirm S. Lamar is currently 5U-undivided. **Vision hallucination.** |

**Recommendation:** Bug 1 (vision hallucination on run-7) is part of Mechanism A. Bug 2 (run-4's attention slip on Collier) suggests a methodology line: *"Check ALL undivided street frontages, not just the primary frontage."* But the merged fail result is correct — this ref is more "noisy 8-1-1 consensus" than genuine ambiguity.

---

## Cross-cutting observations

After reading all 100 traces:

### Vision-tool nondeterminism is the single largest variance source

Mechanism A drives 4 of the top 10 high-variance refs (AW-23, AW-27, CC-22-14, CC-23-01). In each case the agent is asking a simple binary visual question ("are arrows present?", "is recordation labeled?", "is there an adjacent driveway?") and the vision tool gives different answers across runs on the same image.

The fixes are straightforward and high-leverage: deterministic vision, response caching by `(documentId, sheetNumber, prompt-hash)`, or in-task majority voting. Any one of these would reduce variance on a substantial fraction of the split-verdict refs without requiring changes to the model, prompt, or checklist.

### Checklist text bugs are the next-largest source

Mechanism B drives 3 of the top 10 (CC-23-07, AW-45, CC-1-26). These are the items where the checklist text or validation methodology genuinely permits multiple defensible readings. Higher N will not resolve them. The remediation is checklist-authoring: tighter definitions, explicit examples, and methodology lines that anticipate multi-parcel / multi-discipline scenarios.

### Source-data conflicts (`facts.md`) are an underestimated variance source

CC-24-15's split came entirely from `facts.md` having two superficially contradictory fields ("Not in downtown district" vs "Downtown Project Coordination Zone: South sector"). This is a single bad row in a single file, but it caused a perfect 5/5 split on a `warn`-severity item that affects AULCC compliance.

It's worth scanning `facts.md` for similar near-duplicate field names that could trigger contradictory readings — DAPCZ vs DPCZ, EARZ vs Edwards Aquifer, Floodplain vs FEMA Zone, etc.

### Substantive-vs-semantic-equivalence is poorly specified

CC-3-18 shows a 6-4 split on whether "exemption" vs "amendment" is a substantive failure. The validation methodology says "~90% semantic matching" but doesn't flag specific regulatory terms as exempt from that fuzzy match. Similar issues likely lurk on other verbatim-notes items (CC-3-19 through CC-3-22).

### `tools_used` is a useful diagnostic

For every variance class except A, the `tools_used` field reveals real differences in agent behavior:
- Run-9 used `Read` + `Grep` on facts.md text directly (CC-24-15) — only run to do so, and reached the most rigorous conclusion.
- Run-3 used `vision` consistently and surfaced unedited template text on CC-3-18 that other runs missed.
- Runs that used vision on architectural sheets (CC-1-26 fails) found real missing seals; runs that sampled only civil sheets did not.

The richer the tool trace, the easier it is to discriminate "this run did the work" from "this run took a shortcut." Worth surfacing tool-usage diversity in the merged review for human reviewers to triage.

---

## How this informs the next experiment

1. **Fix vision-tool nondeterminism first.** Mechanism A drives ~40% of the top 10 splits. A deterministic-or-cached vision tool is the highest-leverage intervention available without prompt or checklist changes.
2. **Treat the 6-4 verdict-disagreement refs as candidates for checklist-text edits**, not statistical noise. Higher N will sharpen the curve but won't move the threshold case.
3. **Surface `tools_used` and `evidenceLocations` in the merged review.** A reviewer triaging an "8/10 fail with 2 dissents" finding can quickly check whether the dissents used different evidence (potentially missed) or different interpretation (genuine disagreement).
4. **Consider a `runs=10` experiment with vision caching enabled** as a follow-up to confirm the variance drops on the four Mechanism-A refs above. Predicted result: AW-23, AW-27, CC-22-14, CC-23-01 collapse from ~6-4 splits to either unanimous or close-to-unanimous, depending on which cached answer the cache settles on.
