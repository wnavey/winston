# CRC Audit — Agent 4: Output Quality (calibration test)

- **Review ID:** `bfb4f256-27a2-4adc-8443-b942e3b4aa79` (crcGenerationNumber 6, 3 runs × 17 departments)
- **Mode:** **NO-TRIAGE** — 0 `comment_triage` rows exist for this review; every `resolved`/`not-applicable` verdict was audited as a candidate failure, all bucketed `un-triaged-resolved-or-na`.
- **Calibration condition:** CONFIRMED — `crcGuidesSubmissionVersionId == submissionVersionId` (`6b9b85ed-e992-4906-a222-b24ee836910c`). The guides were generated from the very submission under review, so the implicit ground truth for every checklist item is `failed`. Any `resolved`/`not-applicable` is a candidate failure of the review agent.
- **Audit date:** 2026-07-14
- **Guides:** `/Users/wnavey/noetic/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/cf1201c2-2e8b-4034-9a5e-a70b6317e39a/4/6`

## TL;DR

| Metric | Value |
|---|---|
| Total consolidated verdicts audited | **294** |
| failed | 235 (79.9%) |
| resolved | **56** (19.0%) |
| uncertain | 3 (1.0%) |
| not-applicable | 0 |
| Triage rows | 0 (no-triage mode) |
| Candidate failures (resolved + NA) | **56 / 294 = 19.0%** |

**Verdict: DEGRADED** (15–35% band). 56 of 294 items that should all read `failed` came back `resolved`. Notably, 21 of the 56 were **unanimous 3-0 resolved at high confidence** — majority voting did not save these; the remaining 35 were 2-1 splits where a dissenting run had the correct `failed` verdict and was outvoted.

A meaningful minority of the 56 (the 10 `atomization-incomplete` cases, ~18%) are arguably **not review-agent failures at all**: the checklist item as atomized is verbatim-satisfied by the submission (e.g. the exact required cover-sheet note exists). Those point upstream at `generate-crc-guides`. Excluding them, the pure review-agent failure rate is 46/294 = 15.6% — still DEGRADED, at the band edge.

## Failure bucket breakdown

| Bucket | Count |
|---|---|
| `un-triaged-resolved-or-na` | 56 (100%) |

(No triage exists for this review; bucketing is degenerate by design. Prioritize via pattern tags below.)

## Top failure patterns

Tags are non-exclusive (a case can carry two). 56 cases carry 75 tags total.

| Pattern tag | Count | Departments touched | Representative cases | All cases |
|---|---|---|---|---|
| `mention-vs-demonstration` | 22 | AW, CA, CM, DE, EV, SP, TPW, WQ | [073](per-case/073.md) (index trusted its own "01 OF 52" footer; set has 57 sheets), [131](per-case/131.md) ("SEE STANDARD 430S-1" callout = "included by incorporation"), [231](per-case/231.md) (legend linetype + acreage note ≈ drawn LOC boundary) | 4, 56, 73, 79, 84, 86, 91, 97, 125, 131, 132, 141, 184, 222, 223, 229, 231, 235, 273, 277, 278, 283 |
| `self-uncertainty-not-escalated` | 14 | CA, DE, EV, F, SP, WQ | [152](per-case/152.md) (computed 1,404 < 1,500 GPM fire flow, resolved at HIGH confidence), [133](per-case/133.md) (observed 52-vs-54 sheet discrepancy, resolved anyway), [123](per-case/123.md) ("requires visual confirmation" → resolved) | 56, 57, 84, 86, 88, 94, 97, 122, 123, 132, 133, 152, 184, 278 |
| `atomization-incomplete` | 10 | CA, EV, SP, TPW | [117](per-case/117.md) (watershed note exists verbatim-ish), [134](per-case/134.md) (LDC 25-2-984 owner-maintenance note exists verbatim), [187](per-case/187.md) (table shows exactly the required 95%) | 35, 117, 118, 134, 141, 142, 143, 187, 238, 274 |
| `term-conflation` | 7 | AW, DE, EV, TPW, WQ | [003](per-case/003.md) (DPW 508S-3 storm details counted as AW details), [115](per-case/115.md) (sed/fil pond maintenance plan ≠ SUBSURFACE pond plan), [279](per-case/279.md) (one filtration-basin hatch double-counted for the detention basin) | 3, 88, 91, 115, 121, 273, 279 |
| `any-vs-most-quantifier` | 6 | AW, DE, EV, SP, WQ | [005](per-case/005.md) (plat exists ≠ covers ALL lots), [090](per-case/090.md) (verified SD-02 labels, claimed consistency for SD-4A–D), [228](per-case/228.md) ("across multiple sheets" ≈ "every sheet") | 5, 90, 94, 122, 228, 277 |
| `scope-misinterpretation` | 5 | CA, EV, F, PB, WQ | [275](per-case/275.md) (changes-since-last-update clause explicitly waived), [124](per-case/124.md) ("single, overall ESC sheet" reinterpreted to accept a 2-sheet split), [166](per-case/166.md) (ROW-crossing exception invented for "anywhere") | 57, 124, 152, 166, 275 |
| `vision-dimensional-misread` | 3 | DE, SP, WQ | [112](per-case/112.md) (SD-03 flowline rises toward discharge — uphill flow unread), [286](per-case/286.md) (gabion height 5.35 vs 6.07 ft depending on datum choice) | 112, 223, 286 |
| `na-under-defended` | 3 | EV, SP | [207](per-case/207.md)/[209](per-case/209.md) (supplemental zone declared not-proposed from one sheet's vision check) | 119, 207, 209 |
| `show-on-all-sheets-partial` | 2 | EV, SP | [119](per-case/119.md) (Q1/Q2 absence claimed from sheets 23–30 only) | 119, 228 |
| `other:system-metadata-as-evidence` | 1 | DE | [078](per-case/078.md) (pipeline's own "Changes from Prior Version" diff metadata cited as the applicant's change description) | 78 |
| `label-formatting-missed` | 1 | SP | [178](per-case/178.md) (metes/bounds taken from the plat sheet, not the Site Plan sheet) | 178 |
| `vision-feature-hallucinated` | 1 | SP | [214](per-case/214.md) (vision "found" Figure 34 at a specific location; dissenting run and ground truth say absent) | 214 |

## Cross-cutting patterns

**The dominant failure is treating claims as demonstrations.** In 22 of 56 cases the agent resolved on evidence that merely *states* or *points to* compliance: legend entries, "SEE STANDARD X" callouts, self-reported sheet totals, adoption stamps, standard-spec references ("WW-614 typically includes these requirements"), engineer blanket statements ("sized to treat all the flows"), and calculation tables standing in for drawn features. The agent has no internalized distinction between attestation and demonstration, and the guides' "Evidence expected / Evidence form" columns (which often name the demonstrating artifact) were not enforced as gates.

**The agent knows when it is wrong and resolves anyway.** The 14 `self-uncertainty-not-escalated` cases are the most fixable: the hedge is *in the trace* ("cannot be confirmed from text descriptions alone", "requires visual confirmation", "may be insufficient if they are public lines", "creates ambiguity"), and in the worst cases the agent computed the violation itself — case 152 derived available fire flow 1,404 GPM against a 1,500 GPM requirement, labeled it "marginal non-compliance", and returned `resolved` at high confidence, unanimously. A purely mechanical post-hoc lint on hedge markers would have flipped most of these to uncertain.

**Majority voting mitigates but does not cure.** 35 of 56 failures were 2-1 votes where the dissenting run had the correct `failed` verdict with a specific, checkable reason (uphill flow on SD-03, 1-ft hatch setback vs required 5 ft, 57 actual sheets vs 52 claimed, DPW detail on the AW sheet). The consolidation step discards the dissent's *content* — a "minority-report" pass that re-examines dissents citing concrete counter-evidence would recover many of these. But 21 failures were unanimous, concentrated in the boilerplate/attestation patterns, so voting depth alone cannot get below ~7% here.

**A distinct upstream cluster: self-satisfying checklist items.** In 10 cases the required artifact demonstrably exists verbatim in the submission (cover-sheet notes EV-01/EV-02/EV-08.1/TPW-1, the 95% coverage table SP-13, streetyard boundary/calcs EV-13/EV-14, bike-rack details TPW-20.3). Under the calibration invariant these must be failures, but no review agent can fail them as written — the atomization step turned "add/verify note X" comments into items the same submission satisfies, losing whatever the reviewer actually objected to. These inflate the calibration failure rate and, in production, would generate false "resolved" signals for comments that are not resolved. This needs a generation-time back-check, not an agent fix.

## Prioritized remediations

Ranked by failure coverage × inverse effort. Full machine-readable version in `crc-audit-agent-4-remediations.tsv`.

| Rank | ID | Name | Covers | Effort | Category |
|---|---|---|---|---|---|
| 1 | R-2 | Demonstration-over-attestation evidence rule | 14 primary (22 incl. secondary) | Low | agent-prompt-change |
| 2 | R-1 | Hedge/uncertainty escalation gate | 12 primary (14 incl. secondary) | Low | agent-prompt-change |
| 3 | R-5 | Atomization back-check against source submission | 9 | Med | atomization |
| 4 | R-8 | Key-term guards in guide generation | 7 | Med | checklist-text-edit |
| 5 | R-4 | Clause-complete literal evaluation gate | 6 | Low | agent-prompt-change |
| 6 | R-3 | Dimensional/spatial vision verification protocol | 4 | Med | vision-protocol |
| 7 | R-6 | Enumerated-absence protocol for conditional/removal items | 3 | Low | checklist-text-edit |
| 8 | R-7 | Ban system diff metadata as evidence | 1 | Low | agent-prompt-change |

### R-1 — Hedge/uncertainty escalation gate (agent-prompt-change, Low effort, Low risk)
- **Applicable items:** CA-16.2, CA-17, DE-9, DE-17, DE-20.1, EV-05.2, EV-05.3, EV-07.1, EV-07.2, F-4, SP-11.1, WQ-3.1 (cases 56, 57, 86, 94, 97, 122, 123, 132, 133, 152, 184, 278; also secondary on 84, 88).
- **What:** Hard rule in the CRC review agent prompt: hedge markers in the agent's own trace ("appears", "cannot confirm", "requires visual confirmation", "may be insufficient", "creates ambiguity", "partial compliance"), any self-computed threshold breach, or any self-observed numeric discrepancy caps the verdict at `uncertain` (or forces `failed` when the hedge concerns the operative clause). Add a post-hoc lint flagging `resolved` verdicts whose reasoning contains these markers.
- **Failures covered:** 12–14. **Risk:** Low — worst case is more `uncertain` verdicts, which is the correct direction in CRC.

### R-2 — Demonstration-over-attestation evidence rule (agent-prompt-change, Low effort, Low–Med risk)
- **Applicable items:** AW-1.4, CM-9, DE-1, DE-8.1, EV-05.5, EV-06.6, EV-12, SP-4, SP-36.1, SP-42, SP-44, SP-48, WQ-2, WQ-8.1 (cases 4, 73, 79, 84, 125, 131, 141, 178, 222, 229, 231, 235, 277, 283; secondary on 8 more).
- **What:** Prompt rule: notes, legends, cross-reference callouts, self-reported totals, stamps, spec references, and engineer statements are claims, not evidence. `resolved` requires the demonstrating artifact itself (drawn boundary, dimension read, reproduced detail, entrance symbol, per-area tracing), located on the sheet type the item names. Enforce the guide's Evidence-form column as a gate where present.
- **Failures covered:** 14 primary / 22 total — the single largest pattern. **Risk:** Medium-low — could increase vision-tool usage and cost; mitigate by scoping to items whose Evidence-form column names an artifact.

### R-3 — Dimensional/spatial vision verification protocol (vision-protocol, Med effort, Med risk)
- **Applicable items:** DE-32, SP-31.2, SP-36.2, WQ-9 (cases 112, 214, 223, 286).
- **What:** (a) conveyance items: verify monotonic invert fall in flow direction; (b) minimum-dimension items: require an actual dimension read or scaled measurement — never derive from area with an assumed aspect ratio; (c) elevation-difference thresholds: anchor to the correct datum pair from the section view and return `uncertain` within a 10% margin; (d) figure-presence items with reference images: describe what is at the claimed location *before* comparing to the reference, and re-check with a crop when runs disagree.
- **Failures covered:** 4 (each high-severity: uphill storm drain, hallucinated required figure). **Risk:** Medium — vision cost; hallucination fix (d) needs prompt-injection care.

### R-4 — Clause-complete literal evaluation gate (agent-prompt-change, Low effort, Low risk)
- **Applicable items:** AW-2, DE-13, EV-05.4, PB-1, SP-41, WQ-0 (cases 5, 90, 124, 166, 228, 275; secondary on 94, 122, 152, 277).
- **What:** Evaluate the checklist text as written, clause by clause. Universal quantifiers ("all", "every", "entire", "anywhere", "single") require enumerated member-by-member verification. Agents may not import unstated exceptions (case 166's ROW carve-out), waive clauses via their own code reading (case 275), or narrow an item to its artifact-presence prong (case 152).
- **Failures covered:** 6 primary / 10 total. **Risk:** Low.

### R-5 — Atomization back-check against source submission (atomization, Med effort, Low risk)
- **Applicable items:** CA-04.3, EV-01, EV-02, EV-08.1, EV-13, EV-14, SP-13, TPW-1, TPW-20.3 (cases 35, 117, 118, 134, 142, 143, 187, 238, 274; secondary on 141).
- **What:** In `generate-crc-guides`, after drafting each checklist item, evaluate it against the *source* submission. If it would resolve as satisfied, the item failed to encode the reviewer's objection — re-atomize with the specific observed delta (wording, placement, tract, sheet) or mark the parent comment boilerplate/informational so calibration runs can exclude it.
- **Failures covered:** 9. **Risk:** Low — generation-time only; also directly improves calibration-test signal quality.

### R-6 — Enumerated-absence protocol (checklist-text-edit + prompt, Low effort, Low risk)
- **Applicable items:** EV-03, SP-26.3, SP-29 (cases 119, 207, 209).
- **What:** For "if X is proposed" and "X is removed" items: guides state where X would appear; the agent may resolve via absence only with an enumerated search across those locations (sheets listed in the observation) plus reconciliation of any note referencing X (case 119's "Q1 TABLES ARE NOT REQUIRED FOR SUBURBAN WATERSHEDS" note on an urban-watershed project went unreconciled).
- **Failures covered:** 3. **Risk:** Low.

### R-7 — Ban system diff metadata as evidence (agent-prompt-change / schema, Low effort, Low risk)
- **Applicable items:** DE-0 (case 78; WQ-0 case 275 is adjacent).
- **What:** Sheet-guide "Changes from Prior Version" sections and similarity percentages are Noetic-generated reading aids, not submission content. Applicant-deliverable items (change narratives, updated reports, response letters) can only be satisfied by artifacts inside the submission. Consider a schema-level `source: system|submission` marker on guide sections.
- **Failures covered:** 1 (but the confusion class is dangerous — the agent citing our own tooling as the applicant's compliance). **Risk:** Low.

### R-8 — Key-term guards in guide generation (checklist-text-edit, Med effort, Low risk)
- **Applicable items:** AW-1.3, DE-11, DE-14.1, DE-36.1, EV-05.1, TPW-20.2, WQ-3.2 (cases 3, 88, 91, 115, 121, 273, 279).
- **What:** Extend the Key Terms section emitted by `generate-crc-guides` with distinguishing definitions for the confusable pairs observed here: AW vs DPW standard-detail numbering; drainage easement vs drainage area; inlet drainage area map vs drainage area map; subsurface-pond vs sed/fil maintenance plan; comment response letter vs engineer's summary letter; long-term vs short-term bicycle parking; filtration vs detention basin (one hatch cannot satisfy two basin items). State explicitly that evidence for one term cannot resolve items about the other.
- **Failures covered:** 7. **Risk:** Low.

## Novel patterns proposed

1. **`system-metadata-as-evidence`** (1 confirmed case, 78; adjacent behavior in 275). The agent cited the CRC pipeline's own sheet-diff annotations ("Changes from Prior Version", similarity %) as the applicant-provided change description the item requires. Distinct from `mention-vs-demonstration` because the "mention" isn't even in the submission — it is our tooling's output. Proposed as a canonical tag because any system-generated context block (reading guides, facts.md, semantic-search summaries) is a candidate for this confusion, and it will get worse as more derived context is injected.
2. **`already-satisfied-guide-item`** (observed as the 10 `atomization-incomplete` cases; proposed as a calibration-specific refinement rather than a new agent-failure tag). In calibration runs, an item the *source* submission verbatim-satisfies cannot fail, so it measures guide generation rather than the review agent. Tagging these separately would let calibration scoring split "agent judged wrong" from "item was unfailable," which this report had to do by hand (19.0% raw vs 15.6% agent-only failure rate).

## Data sources & limitations

- **Primary:** `RUN_DIR/output/consolidated-findings.json` (294 items; per-run findings, vote breakdown, winning observation/reasoning). Comment numbers and titles cross-checked against `review_comments` (294 rows, project `mgxqsrjutswbciyrltwd`) and `RUN_DIR/output/review-comments.json`.
- **Guides:** checklist rows extracted verbatim from the gen-6 guide files (all 56 items located, incl. split files crc-CA-1/2/3, crc-DE-1/2, crc-EV-1/2, crc-SP-1/2/3, crc-TPW-1/2).
- **Limitations:** (1) No human triage exists — pattern classification and hypotheses are LLM-judged from traces + guide text, not verified against the plan PDFs; where the two resolved runs and one failed run disagree on a matter of visual fact (e.g. 214, 274, 4), I inferred which side erred from the calibration invariant plus trace specificity, which can misattribute. (2) The calibration invariant itself is imperfect: for boilerplate "add note X" comments the ground truth "failed" may not reflect a real deficiency in the plan, only in the guide (see novel pattern 2). (3) The 3 `uncertain` verdicts were out of scope per the audit charter (candidates were resolved/NA only). (4) Dissent explanations are per-run one-liners; full dissenting observations were not re-examined case by case.
- **Per-case files:** `per-case/003.md` … `per-case/286.md` (56 files, named by DB comment_number).
