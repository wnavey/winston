# CRC Output-Quality Audit — Review d1ff47e7-7c77-4a54-9d1c-4d6bae26046e

**Mode:** no-triage
**Calibration condition:** submissionVersionId == crcGuidesSubmissionVersionId == 6b9b85ed-e992-4906-a222-b24ee836910c
**Audit date:** 2026-07-01 (retagged 2026-07-01 — see §Correction)
**Project:** Lamar + Collier (projectId 23301a8a-4cdb-4751-ac0c-93b97f0f5c12)
**Config:** 5 runs × 17 groupings, 291 checklist items, crcGenerationNumber = 6

---

## Correction (2026-07-01) — retiring `self-uncertainty-not-escalated`

The first pass of this audit classified 21 of 61 candidate failures under a pattern I called `self-uncertainty-not-escalated` — the theory being that the per-run review agent had hedged in `reasoning` while emitting a `uncertain`-flavored verdict, and the fix was a per-run "reasoning-verdict consistency gate" (R-03). **That was based on a misunderstanding of the CRC pipeline** and has been retired.

The system actually works like this:

- **Per-run review agents emit only `resolved` or `failed`.** They cannot produce `uncertain`.
- The `uncertain` status is set by the cross-run consolidator (`bureau/workflows/comment-resolution-check/scripts/cross-run-consolidate-crc.ts`) when the winning share of the N per-run votes drops at or below `1 − uncertainThreshold` (default 0.35, with runCount ≥ 3). This is **by design**, per `crc-workflow/uncertain-status/DESIGN-SPEC.md` §5 — the consolidator's whole job on split votes is to surface real dispute rather than pick a side.
- When the aggregated status is `uncertain`, the consolidator picks a `winningFinding` from the per-run entry whose status matches `tentativeStatus`. So the `reasoning` this audit read was one specific per-run agent's rationale — usually the majority-side one — and its wording bears no necessary relationship to the aggregate `uncertain` verdict.

**Consequence**: R-03 (reasoning-verdict consistency gate) is no longer a valid remediation and has been removed. The 21 affected cases have been split by which side won:

- **`tentativeStatus == resolved` (10 cases)** — the audit read the resolved-side per-run agent's reasoning. That agent was on the WRONG side on calibration, so its co-occurring pattern tags (`mention-vs-demonstration`, `scope-misinterpretation`, `any-vs-most-quantifier`, `vision-feature-hallucinated`) legitimately apply. Just dropped the false `self-uncertainty-not-escalated` tag; remediation now points to R-04.
- **`tentativeStatus == failed` (11 cases)** — the audit read the failed-side per-run agent's reasoning. That agent voted correctly. The actual failure lives on the resolved-side per-run findings that this audit did not systematically examine. Retagged these as a new pattern **`dispute-resolved-side-not-audited`** with a new remediation **R-05** (audit the losing-side per-run findings for disputed items).

Per-case markdown files for all 21 affected cases were regenerated with a "Corrected interpretation" hypothesis section. Their original observations + agent-quoted reasoning remain intact.

The headline failure rate (21.0 % / 61 candidates) is unchanged — the retag is a classification correction, not a rescoping.

---

## TL;DR

- Total checklist verdicts audited (candidates): **61** (35 `resolved` + 26 `uncertain`)
- `resolved`: 35 | `uncertain`: 26 | `not-applicable`: 0 | `failed` (excluded from audit): 230
- Triage rows available: 0 (no-triage mode — every non-`failed` verdict is a candidate agent failure under the calibration invariant)
- Candidate agent failures / total: **61 / 291 = 21.0 %**
- **Verdict: DEGRADED** (thresholds: ≤5 % HEALTHY / 5–15 % NOTES / 15–35 % DEGRADED / ≥35 % FAILED)

**Why `uncertain` items are audited alongside `resolved`.** On calibration, every checklist item should be `failed`. An `uncertain` aggregate means at least one per-run agent voted `resolved` (wrongly, since ground truth is `failed`). The failure is at the per-run level, not at the consolidator level — the consolidator is doing exactly what it should. But when the winning side ended up `failed` (11 of the 26 `uncertain` cases), this audit's read of `winningFinding.reasoning` picks up the CORRECT reasoning and can't diagnose the underlying pattern; a follow-up audit that reads the losing-side per-run findings is required (see R-05).

## Failure bucket breakdown

No triage exists for this reviewId, so every candidate lives in a single bucket, further split by aggregate status:

| Bucket | Count | Notes |
|--------|-------|-------|
| `un-triaged-resolved-or-na` — `resolved` (unanimous 5-0 wrong) | 35 | Every per-run agent voted `resolved`; under calibration every one of these is presumptively wrong. |
| `un-triaged-resolved-or-na` — `uncertain`, tentativeStatus=`resolved` | 10 | Winning side voted `resolved`; per-run pattern visible in the audited `winningFinding.reasoning`. |
| `un-triaged-resolved-or-na` — `uncertain`, tentativeStatus=`failed` | 11 | Winning side voted `failed` (correct on calibration); actual failure lives on the unaudited resolved-side per-run findings. Retagged `dispute-resolved-side-not-audited`. |
| **Total candidate failures** | **61** | 21.0 % of 291 verdicts |

## Top failure patterns (post-retag)

| Pattern tag | Cases | Refs (representative) |
|-------------|-------|-----------------------|
| `mention-vs-demonstration` | **39** | AW-1.2, CA-04.3, CM-11, DE-4/28.2/30/36.1, EV-01/02/03/05.1/05.4/05.5/06.6/07.1/08.1/12/13/14, SP-4/11.1/21/23.1/23.2/24/30.1/30.2/30.3/31.2/32.2/36.1/36.2/36.4/42/43/44, TPW-1/20.1/20.3 |
| `scope-misinterpretation` | 13 | AW-1.1, CA-13.2/16.2, EV-03/05.4, F-2.2, SP-11.1/15.2/23.2/26.3/29/32.1/32.2 |
| `dispute-resolved-side-not-audited` (new) | 11 | AW-1.4, CA-16.1, DE-14.1/23/27.2/31, SP-41/48, TPW-8, WQ-1/8.1 |
| `any-vs-most-quantifier` | 6 | AW-1.2, DE-28.2/31, EV-05.2, PB-1, SP-43 |
| `vision-feature-hallucinated` | 4 | AW-1.2, IW-1.2, PB-1, SP-36.4 |
| `term-conflation` | 4 | CM-11, DE-30, SP-21, SP-23.2 |
| `label-formatting-missed` | 3 | CA-04.3, SP-21, SP-24 |
| `other:vacuous-satisfaction` | 2 | AW-1.1, F-2.2 |
| `na-under-defended` | 2 | SP-26.3, SP-29 |
| `vision-dimensional-misread` | 1 | F-7 |
| `other:agent-editorializing-around-code` | 1 | CM-8 |
| `other:agent-arithmetic-around-code` | 1 | F-7 |

Full case-by-case in `crc-audit-agent-4-failure-cases.tsv`.

## Cross-cutting patterns

**`mention-vs-demonstration` is now the largest single failure pattern by a wide margin (39 / 61 = 64 % of candidates).** This is the classical calibration-test failure mode: the per-run agent finds *something* on the plan (a note, a symbol, a table entry, a dimension callout) that lexically or topically matches the requirement and votes `resolved` without checking whether the artifact actually *demonstrates* code compliance. Under calibration, presence-of-note alone can never resolve an item; the reviewer's original concern (wording, placement, cross-reference, or supporting element) has to be independently reproduced. Examples span the whole severity spectrum: EV-01/02 (verbatim watershed and EARZ notes on the cover sheet — the notes exist, but the U0 reviewer flagged them anyway, so verbatim presence isn't sufficient); TPW-1 (SIF note verbatim); EV-06.6 (curb-and-gutter detail present but not verified against City std 430S-1); SP-30.1/30.2/30.3 (Key Note 7 labelled "PROPOSED BUILDING ENTRANCE" treated as proof of a customer-facing principal-street entrance connected to the sidewalk).

**`scope-misinterpretation` (13 cases)** is the per-run agent narrowing a requirement to fit the evidence it found. Clearest example: SP-23.2 — rule text says "no vertical structures are located within the 25-ft compatibility buffer," agent finds a perimeter fence at the property line and writes "a perimeter fence at the property line is not the type of vertical structure prohibited by LDC § 25-2-1062(B)." That exclusion is not in code. Case 022 (EV-05.4) does the same to "single, overall ESC sheet" — agent rewrites the rule as "the intent is that all controls are shown in a single consolidated location" to accommodate a two-sheet ESC plan. This is per-run agents legislating their own compliance criteria.

**`dispute-resolved-side-not-audited` (11 cases)** is not a failure pattern in the usual sense — it's an audit-scope limitation. These are `uncertain` items where the winning `tentativeStatus` was `failed`, so this audit's read of `winningFinding.reasoning` saw the correct reasoning and couldn't classify the underlying error. The real failure lives in the resolved-side per-run findings for these refs, which need their own scan (R-05). Preview based on which refs appear here: many look like tight `mention-vs-demonstration` (DE-23 legibility judgment, SP-41 amenity labelling, SP-48 courtyard plan) — but rather than guess, R-05 asks the follow-up to actually classify them.

**A distinct sub-pattern is `other:vacuous-satisfaction` (2 cases: AW-1.1 and F-2.2).** The atomization pipeline is splitting a compound parent MCR comment ("AW-1" → AW-1.1/1.2/1.3/1.4) into narrower sub-items whose applicability preconditions can then be trivially defeated by the applicant. Once AW-1.1 is narrowed to "portrait-orientation standard drawings ≤ 8 per sheet" and the applicant moves all details to landscape sheets, the portrait sub-gate becomes vacuously satisfied — but the parent comment (Sheet 34/35/36 detail density) is not. The atomization step needs a back-check that a `not-applicable`-ish sub-item's parent concern still has coverage elsewhere in the split. See R-01.

**`vision-feature-hallucinated` and `vision-dimensional-misread` (5 cases combined)** show a smaller but consequential class where the per-run agent trusts a vision-tool assertion that carries too much semantic weight. Case 002 (AW-1.2): vision claims "details fill the entire sheet with no notable whitespace" — a subjective utilization judgment vision is not qualified to make. Case 031 (F-7): agent chains arithmetic across three datums (Level 1 = 543 ft, Collier grade ~545 ft, Level 6 = 68' 3⅜") to conclude the high-rise threshold isn't crossed, and cites the applicant's own "HIGH-RISE: NO" declaration on the cover sheet as corroboration. Applicant-declared regulatory classifications should never be treated as evidence of compliance.

## Prioritized remediations (post-retag)

| ID | Name | Category | Effort | Cases | Priority |
|----|------|----------|--------|-------|----------|
| **R-04** | **Tighten the "mention-vs-demonstration" guard in the per-run review prompt.** Add a two-step decision: (1) *have you found the artifact the checklist asks for?* (2) *does the artifact you found substantively demonstrate the code criterion, or does it merely mention the topic?* Only pass at step 2. Require the agent to quote the specific plan text/dimension/callout that satisfies the requirement, not the general presence of a document. | agent-prompt-change | medium | **40** | **1 (top)** |
| **R-05** | **Follow-up audit: read the resolved-side per-run findings for disputed items.** For each of the 11 refs currently tagged `dispute-resolved-side-not-audited` (and, structurally, for every future audit of a calibration-test run), run an Agent-4-style pass with prompt scope extended to include *losing-side* per-run findings, not only `winningFinding`. Then classify the resolved-side agents' reasoning using the standard pattern taxonomy so those cases roll into R-04 / R-01 / R-06 etc. as appropriate. Also update `prompts/agent-4-output-quality.md` (in the audit-crc-run skill) so future runs on `uncertain` items automatically pull from both cohorts. | investigation | medium | 11 | 2 |
| **R-06** | **Universal-quantifier and vision-feature-hallucination guard.** Bundle two closely-related mistakes: (a) *any-vs-most-quantifier* — rule requires universal compliance ("at any point", "every", "all") but agent reasoning used "most" / "substantially" / "broadly"; (b) *vision-feature-hallucinated* — reported features the plan doesn't actually contain. Add a prompt clause: when the rule uses a universal quantifier, an "on Sheet X the callout appears" observation is insufficient; the agent must enumerate the cases and confirm each. For vision claims, require corroboration by a text-side observation (block or note text) before treating as evidence of presence. | agent-prompt-change | medium | 6 | 3 |
| **R-01** | **Add a non-vacuous-N/A rule to atomization + review prompt.** When a checklist item's applicability precondition is not met (e.g., "no portrait sheets → item vacuously satisfied"), require the agent to check whether the parent MCR comment's underlying concern is covered by a sibling atomized item. If not, escalate to `failed` with an atomization-gap note. Also revisit the atomization prompt to prefer disjunctive-preserving splits over conjunctive ones. | atomization | medium | 4 | 4 |
| **R-02** | **Restrict vision-only positive verdicts on presence/dimension claims.** Vision may confirm negative findings ("no supplemental zone found on sheets 14/15/48") but positive presence/dimension claims should require corroborating text (a labeled dimension in `blocks.md`, a callout in the semantic-search index). "Continuous silt fence along the entire upslope LOC" is not something vision can verify universally on a single sheet crop. | vision-protocol | medium | 3 | 5 |
| **R-07** | **Forbid the agent from reasoning around explicit checklist thresholds.** When a rule states "current tax certificate showing all taxes paid through 2026," the agent must not invent Texas property-tax timing arguments to justify accepting a certificate showing only 2025. Explicit thresholds are non-negotiable at the review-agent layer. | agent-prompt-change | low | 1 | 6 |
| **R-08** | **Require independent verification of applicant-declared regulatory classifications.** Applicant's "HIGH-RISE: NO," "EARZ: NO," "WATERSHED: URBAN," etc. are claims to be verified, not evidence of compliance. Add an explicit review-prompt step: if the requirement asks the agent to verify a regulatory classification and the plan itself asserts the answer, the agent must independently verify from primary sources (site facts, external data, third-party arborist letter, engineering calculations). | agent-prompt-change | medium | 1 | 7 |

**Why R-04 is the top now.** It covers 40 of 61 candidate failures directly (65 %) — including all `mention-vs-demonstration` primaries and the co-tagged mention-vs-demonstration items in the retagged `uncertain` set. Effort is medium: it's a per-run review-prompt edit, not a schema/pipeline change. Testing surface is contained (re-run one CRC review post-edit and re-audit).

**Why R-05 matters even though it doesn't fix code.** It closes the audit's own methodological gap. Without R-05 we don't know whether the 11 `dispute-resolved-side-not-audited` cases fall under R-04 (probably most of them do — cheap follow-up), R-01 (a couple might), or a novel pattern. Cheap to run once, and it improves the fidelity of every future calibration-test audit.

Full remediation ↔ case mapping in `crc-audit-agent-4-remediations.tsv`.

## Novel patterns proposed

The following `other:` tags emerged from the classification pass and should be promoted (or, in the case of the one retired below, expressly not):

1. **~~`other:agent-reasoning-contradicts-verdict`~~** — **RETIRED as of the 2026-07-01 correction.** This tag was based on the same misunderstanding as `self-uncertainty-not-escalated` and has been removed from every affected case.
2. **`dispute-resolved-side-not-audited`** — new pattern (11 cases). Not a per-run agent failure pattern per se; it's a **flag that the audit's own read of `winningFinding.reasoning` looked at the correct-side agent and can't classify the actual failure**. Should be a canonical audit-methodology tag rather than an agent failure pattern.
3. **`other:vacuous-satisfaction`** (2 direct hits: AW-1.1, F-2.2; related to `na-under-defended`). Distinct sub-pattern where an *atomized* sub-item has trivially non-triggering applicability but the parent MCR comment concern is genuine. Promote to **`vacuous-N/A-from-atomization`**.
4. **`other:agent-editorializing-around-code`** and **`other:agent-arithmetic-around-code`** (1 case each: CM-8 and F-7). Distinct pattern where the agent invents a legal, statutory, or arithmetic argument to reason around the plain checklist text. Promote to **`review-agent-legal-editorializing`**.

## Data sources & limitations

- **Primary input**: `_run_artifacts/output/consolidated-findings.json` (291 rows). All 61 candidate cases were extracted from this file.
- **Guide text**: Fetched via `mcp__claude_ai_Noetic__storage_read_text` from bucket `crc-guides`, path prefix `23301a8a-4cdb-4751-ac0c-93b97f0f5c12/cf1201c2-2e8b-4034-9a5e-a70b6317e39a/4/6/`. 15 guide files spanning 11 departments (AW, CA-1/2/3, CM, DE-1/2, EV-1/2, F, IW, PB, SP-1/2/3, TPW-1/2, WQ).
- **Triage rows**: 0 rows in `comment_triage` for this reviewId; entire audit runs in no-triage mode using the calibration invariant as ground truth.
- **Schema note**: The consolidated-findings schema differs from what the audit prompt described — the reasoning/observation live under `winningFinding.{observation,reasoning}` rather than `output_json.agentTrace.*`. All extraction was done against the actual schema.
- **Not audited**: `failed` verdicts (230 cases) — correct on calibration and excluded per the audit charter. Also not audited: resolved-side per-run findings on the 11 `dispute-resolved-side-not-audited` cases (see R-05).
- **Not audited (out of scope)**: performance, cost, vote variance across runs, tool-usage metrics — those are the remit of Audit Agents 1, 2, and 3.
- **Correction (2026-07-01)**: 21 cases originally tagged `self-uncertainty-not-escalated` were retagged after the operator pointed out that `uncertain` is a consolidator-produced status by design, not a per-run agent hedge. Full retag log in `_retag_log.json`. Failure-cases TSV, remediations TSV, agent-traces JSONL, and per-case markdown files were all regenerated.

## Pointer to per-case files

All 61 per-case files are under `per-case/`. Each file follows the template: agent verbatim observation + reasoning + guide checklist item verbatim + hypothesis + remediation mapping. The 21 retagged cases now carry a "Corrected interpretation (2026-07-01)" hypothesis section that supersedes the original.
