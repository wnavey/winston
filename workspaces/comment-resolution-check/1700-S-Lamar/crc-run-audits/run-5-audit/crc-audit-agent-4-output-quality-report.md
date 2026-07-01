# CRC Output-Quality Audit — Review d1ff47e7-7c77-4a54-9d1c-4d6bae26046e

**Mode:** no-triage
**Calibration condition:** submissionVersionId == crcGuidesSubmissionVersionId == 6b9b85ed-e992-4906-a222-b24ee836910c
**Audit date:** 2026-07-01
**Project:** Lamar + Collier (projectId 23301a8a-4cdb-4751-ac0c-93b97f0f5c12)
**Config:** 5 runs × 17 groupings, 291 checklist items, crcGenerationNumber = 6

## TL;DR
- Total checklist verdicts audited (candidates): **61** (35 `resolved` + 26 `uncertain`)
- `resolved`: 35 | `uncertain`: 26 | `not-applicable`: 0 | `failed` (excluded from audit): 230
- Triage rows available: 0 (no-triage mode — every non-`failed` verdict is a candidate agent failure under the calibration invariant)
- Candidate agent failures / total: **61 / 291 = 21.0 %**
- **Verdict: DEGRADED** (thresholds: ≤5 % HEALTHY / 5–15 % NOTES / 15–35 % DEGRADED / ≥35 % FAILED)

**Note on `uncertain` inclusion.** `uncertain` is not the same as `resolved`, but on a calibration-test run every checklist item should evaluate to `failed`, so any `uncertain` verdict is by definition a case where the agent failed to reach the correct disposition. The report therefore audits all 61 non-`failed` verdicts as candidate failures, and — importantly — treats `uncertain` verdicts that contain reasoning explicitly concluding "failed" as their own diagnostic sub-class (`self-uncertainty-not-escalated`, 21 cases). See "Cross-cutting patterns" below.

## Failure bucket breakdown

No triage exists for this reviewId, so every candidate lives in a single bucket:

| Bucket | Count | Notes |
|--------|-------|-------|
| `un-triaged-resolved-or-na` — `resolved` | 35 | Agent concluded the submission satisfies the checklist item. Under calibration, every one of these is presumptively wrong. |
| `un-triaged-resolved-or-na` — `uncertain` | 26 | Verdict = `uncertain`, but 21 of 26 cases contain reasoning that explicitly concludes the requirement is *not* met — a status-reasoning misalignment. |
| **Total candidate failures** | **61** | 21.0 % of 291 verdicts |

## Top failure patterns

| Pattern tag | Cases | Refs (representative) | Case #s (sample) |
|-------------|-------|-----------------------|-------------------|
| `mention-vs-demonstration` | 39 | AW-1.2, CA-04.3, CM-11, DE-4, EV-01/02/08.1/12/13/14, SP-4/21/23.1/36.2/42/44, TPW-1/20.1/20.3 | 002, 004, 008, 009, 017, 026, 029, 034, 037, 048, 055 |
| `self-uncertainty-not-escalated` | 21 | AW-1.4, CA-16.1, DE-14.1, DE-23, DE-27.2, DE-31, SP-30.1/30.3/31.2/36.1/36.4/41/43/48, TPW-8/12.3, WQ-1/8.1 | 003, 005, 010, 011, 012, 015, 042, 044, 046, 049, 053, 055, 056, 060, 061 |
| `scope-misinterpretation` | 13 | AW-1.1, CA-16.2, EV-03/05.4, F-2.2, SP-11.1/23.2/26.3/29/32.2 | 001, 006, 019, 022, 030, 035, 040, 041, 045 |
| `any-vs-most-quantifier` | 6 | DE-28.2, DE-31, EV-05.2, EV-05.4, PB-1, SP-43 | 013, 015, 021, 022, 033, 052 |
| `vision-feature-hallucinated` | 4 | AW-1.2, IW-1.2, PB-1, SP-36.4 | 002, 032, 033, 049 |
| `term-conflation` | 4 | CM-11, DE-30, SP-21, SP-23.2 | 008, 014, 036, 038 |
| `other:agent-reasoning-contradicts-verdict` | 3 | AW-1.4, CA-16.1, DE-14.1 | 003, 005, 010 |
| `label-formatting-missed` | 3 | CA-04.3, SP-21, SP-24 | 004, 036, 039 |
| `other:vacuous-satisfaction` | 2 | AW-1.1, F-2.2 | 001, 030 |
| `na-under-defended` | 2 | SP-26.3, SP-29 | 040, 041 |
| `vision-dimensional-misread` | 1 | F-7 | 031 |
| `other:agent-editorializing-around-code` | 1 | CM-8 | 007 |
| `other:agent-arithmetic-around-code` | 1 | F-7 | 031 |

Per-case files live in `per-case/NNN.md`. The failure-cases TSV (`crc-audit-agent-4-failure-cases.tsv`) sorts every candidate by pattern tag.

## Cross-cutting patterns

**The single most consequential finding of this audit is `self-uncertainty-not-escalated` (21 / 61 = 34 % of all candidate failures).** In 20+ cases, the winning finding's `reasoning` field contains an explicit failure conclusion — text like "the requirement is unresolved," "ambiguous evidence collapses to failed," "the burden of positive evidence is on the applicant, and it is not met," or in one case the literal phrase "**Both prongs of AW-1.4 are failed**" (case 003) — yet the aggregated verdict returned by the run is `uncertain` rather than `failed`. This is almost certainly a majority-vote artifact: with `voteBreakdown` distributions where some individual runs voted `resolved` and others `failed`, the consolidation rule appears to be collapsing anything short of a clean majority into `uncertain`. The reasoning text stapled to the winning finding then bears no relation to the final verdict. A downstream reviewer reading only the status column would systematically under-count real failures. **This is a high-leverage, low-cost fix** — see R-03 below.

**The next tier of failures is dominated by `mention-vs-demonstration` (39 cases).** This is the classical calibration-test failure mode: the agent finds *something* on the plan (a note, a symbol, a table entry, a dimension callout) that lexically or topically matches the requirement, and marks it resolved without checking whether the artifact actually *demonstrates* code compliance. Examples span the entire severity spectrum: for high-confidence cases like EV-01/02 (verbatim watershed and EARZ notes on the cover sheet), EV-06.6 (curb-and-gutter detail present), TPW-1 (SIF note verbatim), the agent found the exact required text — but on a calibration-test run those items *did* appear on the U0 MCR, meaning the reviewer flagged them anyway. Under calibration, presence-of-note alone can never resolve an item; the reviewer's original concern (wording, placement, cross-reference, or supporting element) must be independently reproduced.

**`scope-misinterpretation` (13 cases) reflects agents narrowing the requirement to fit the evidence they found rather than reading the checklist text strictly.** The clearest example is case 037 (SP-23.2): rule text says "no vertical structures are located within the 25-ft compatibility buffer," agent finds a perimeter fence at the property line and explicitly writes "a perimeter fence at the property line is not the type of vertical structure prohibited by LDC § 25-2-1062(B)." That exclusion is not in code. Case 022 (EV-05.4) does the same thing to "single, overall ESC sheet" — agent rewrites the rule as "the intent is that all controls are shown in a single consolidated location" to accommodate a two-sheet ESC plan. These are agents legislating their own compliance criteria.

**A distinct sub-pattern is what I've tentatively called `other:vacuous-satisfaction` (2 cases: AW-1.1 and F-2.2).** The atomization pipeline appears to be splitting a compound parent MCR comment ("AW-1" → AW-1.1/1.2/1.3/1.4) into narrower sub-items whose applicability preconditions can then be trivially defeated by the applicant. Once AW-1.1 is narrowed to "portrait-orientation standard drawings ≤ 8 per sheet" and the applicant moves all details to landscape sheets, the portrait sub-gate becomes vacuously satisfied — but the parent comment (Sheet 34/35/36 detail density) is not. The atomization step needs a back-check that a `not-applicable` sub-item's parent concern still has coverage elsewhere in the split. See R-01.

**`vision-feature-hallucinated` and `vision-dimensional-misread` (5 cases combined)** show a smaller but consequential class where the agent trusts a vision-tool assertion that carries too much semantic weight. Case 002 (AW-1.2): vision claims "details fill the entire sheet with no notable whitespace" — a subjective legibility/utilization judgment vision is not qualified to make. Case 031 (F-7): agent chains arithmetic across three datums (Level 1 = 543 ft, Collier grade ~545 ft, Level 6 = 68' 3⅜") to conclude the high-rise threshold isn't crossed, and cites the applicant's own "HIGH-RISE: NO" declaration on the cover sheet as corroboration. Applicant-declared regulatory classifications should never be treated as evidence of compliance.

## Prioritized remediations

| ID | Name | Category | Effort | Cases covered | Priority |
|----|------|----------|--------|---------------|----------|
| **R-03** | **Add reasoning-verdict consistency gate to the agent output pipeline.** Before emitting a verdict of `resolved` / `uncertain`, run a small LLM check: does the free-text `reasoning` field explicitly conclude the requirement is unmet? If yes, coerce the verdict to `failed`. If reasoning is genuinely mixed, keep `uncertain`. Only allow `resolved` when reasoning affirmatively concludes the requirement is met. | agent-prompt-change | low | 20 | **1** |
| **R-04** | **Tighten the "mention-vs-demonstration" guard in the review prompt.** Add a two-step decision: (1) *have you found the artifact the checklist asks for?* (2) *does the artifact you found substantively demonstrate the code criterion, or does it merely mention the topic?* Only pass at step 2. Consider requiring the agent to quote the specific plan text/dimension/callout that satisfies the requirement, not the general presence of a document. | agent-prompt-change | medium | 32 | 2 |
| **R-01** | **Add a non-vacuous-N/A rule to atomization + review prompt.** When a checklist item's applicability precondition is not met (e.g., "no portrait sheets → item vacuously satisfied"), require the agent to check whether the parent MCR comment's underlying concern is covered by a sibling atomized item. If not, escalate to `uncertain` with an atomization-gap note rather than emitting `resolved`. Also revisit the atomization prompt to prefer disjunctive-preserving splits over conjunctive ones. | atomization | medium | 4 | 3 |
| **R-02** | **Restrict vision-only positive verdicts on presence/dimension claims.** Vision may confirm negative findings ("no supplemental zone found on sheets 14/15/48") but positive presence/dimension claims should require corroborating text (a labeled dimension in `blocks.md`, a callout in the semantic-search index). "Continuous silt fence along the entire upslope LOC" is not something vision can verify universally on a single sheet crop. | vision-protocol | medium | 3 | 4 |
| **R-05** | **Forbid the agent from reasoning around explicit checklist thresholds.** When a rule states "current tax certificate showing all taxes paid through 2026," the agent must not invent Texas property-tax timing arguments to justify accepting a certificate showing only 2025. Explicit thresholds are non-negotiable at the review-agent layer. | agent-prompt-change | low | 1 | 5 |
| **R-06** | **Require independent verification of applicant-declared regulatory classifications.** Applicant's "HIGH-RISE: NO," "EARZ: NO," "WATERSHED: URBAN," etc. are claims to be verified, not evidence of compliance. Add an explicit review-prompt step: if the requirement asks the agent to verify a regulatory classification and the plan itself asserts the answer, the agent must independently verify from primary sources (site facts, external data, third-party arborist letter, engineering calculations). | agent-prompt-change | medium | 1 | 6 |

Full remediation ↔ case mapping in `crc-audit-agent-4-remediations.tsv`.

## Novel patterns proposed

Three `other:` tags emerged from the classification pass and should be considered for promotion to the canonical list on the next revision of the audit template:

1. **`other:agent-reasoning-contradicts-verdict`** (3 direct hits, but really a specialization of `self-uncertainty-not-escalated`). Distinct because in these cases the reasoning is not hedged — it explicitly asserts failure — yet the verdict is `uncertain`. Suggests the verdict field is being written from a different code path than the reasoning field. Should be promoted to canonical as **`verdict-reasoning-mismatch`**.
2. **`other:vacuous-satisfaction`** (2 direct hits: AW-1.1, F-2.2; also related to `na-under-defended`). Distinct sub-pattern where an *atomized* sub-item has trivially non-triggering applicability but the parent MCR comment concern is genuine. Consider promoting to **`vacuous-N/A-from-atomization`**.
3. **`other:agent-editorializing-around-code`** and **`other:agent-arithmetic-around-code`** (1 case each: CM-8 and F-7 respectively). Distinct pattern where the agent invents a legal, statutory, or arithmetic argument to reason around the plain checklist text. Should be promoted to **`review-agent-legal-editorializing`**.

## Data sources & limitations

- **Primary input**: `_run_artifacts/output/consolidated-findings.json` (291 rows). All 61 candidate cases were extracted from this file.
- **Guide text**: Fetched via `mcp__claude_ai_Noetic__storage_read_text` from bucket `crc-guides`, path prefix `23301a8a-4cdb-4751-ac0c-93b97f0f5c12/cf1201c2-2e8b-4034-9a5e-a70b6317e39a/4/6/`. Fetched 15 guide files spanning 11 departments (AW, CA-1/2/3, CM, DE-1/2, EV-1/2, F, IW, PB, SP-1/2/3, TPW-1/2, WQ). Requirement text quoted in each per-case file is verbatim from these guides.
- **Triage rows**: 0 rows in `comment_triage` for this reviewId; entire audit runs in no-triage mode using the calibration invariant as ground truth.
- **Schema note**: The consolidated-findings schema differs from what the audit prompt described — the reasoning/observation live under `winningFinding.{observation,reasoning}` rather than `output_json.agentTrace.*`. All extraction was done against the actual schema.
- **Not audited**: `failed` verdicts (230 cases). Under the calibration invariant these are correct and were excluded per the audit charter.
- **Not audited (out of scope)**: performance, cost, vote variance across runs, tool-usage metrics — those are the remit of Audit Agents 1, 2, and 3.
- **Confidence**: Pattern-tag assignments are LLM-judged from reasoning + observation text against the guide's requirement text. In the few cases where the winning finding was the "correct" call *but on a substantive-review basis rather than a calibration-invariant basis*, the audit still tags them as candidate failures — the calibration invariant is the operative ground truth for this run.

## Pointer to per-case files

All 61 per-case files are under `per-case/`. Each file follows the template: agent verbatim observation + reasoning + guide checklist item verbatim + hypothesis + remediation mapping. Files are numbered 001–061 in the order they appear in `consolidated-findings.json`.
