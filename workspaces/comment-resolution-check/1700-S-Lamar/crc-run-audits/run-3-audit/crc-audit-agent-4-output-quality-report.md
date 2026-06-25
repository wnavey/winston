# CRC Output-Quality Audit — Review a8d07d22-19e6-4a1f-a12d-a4371c1dbd19

**Mode:** no-triage
**Calibration condition:** submissionVersionId == crcGuidesSubmissionVersionId == `6b9b85ed-e992-4906-a222-b24ee836910c`
**Audit date:** 2026-06-25
**Auditor:** Agent 4 (output quality)

## TL;DR

- Total checklist verdicts: **234**
- `resolved`: **32** | `not-applicable`: **12** | `failed` (excluded from audit): **190**
- Triage rows available: **0** (no-triage mode — collapse to single bucket)
- Candidate agent failures (resolved + NA): **44** = **18.8%**
- **Verdict:** **DEGRADED** (per thresholds: ≤5% HEALTHY, 5–15% NOTES, 15–35% DEGRADED, ≥35% FAILED)

Calibration invariant: the guides were generated from the same submission version being reviewed, so the ground-truth status for every item is `failed`. Any `resolved` or `not-applicable` is, by construction, an agent error. The 44 candidates were investigated one-by-one in `per-case/` files.

## Failure bucket breakdown

| Bucket | Count |
|---|---|
| un-triaged-resolved-or-na | 44 |

(No triage rows in `comment_triage` for this reviewId — single bucket per the no-triage protocol.)

## Top failure patterns

| Rank | Pattern tag | Count | Example refs | Per-case files |
|---|---|---|---|---|
| 1 | `mention-vs-demonstration` | 13 | crc-f:F-7, crc-sp:SP-12, crc-pr:PR-3, crc-pr:PR-4, crc-f:F-1.2, crc-f:F-4 | 002, 004, 005, 021, 023, 024, 026, 027, 028, 029, 030, 043, 044 |
| 2 | `na-under-defended` | 12 | crc-wq:WQ-11 through WQ-14.2, crc-tpw:TPW-6 through TPW-11, crc-f:F-1.1, crc-sp:SP-29 | 011-015, 036, 037, 038, 039, 040, 041, 042 |
| 3 | `label-formatting-missed` | 7 | crc-sp:SP-45.4, crc-sp:SP-45.9, crc-tpw:TPW-1, crc-ev:EV-01, crc-ev:EV-02, crc-awrr:AWRR-2.1, crc-sp:SP-45.1 | 006, 007, 008, 016, 019, 020, 031 |
| 4 | `self-uncertainty-not-escalated` | 6 | crc-de:DE-4, crc-de:DE-22, crc-ev:EV-07, crc-wq:WQ-7, crc-wq:WQ-2, crc-wq:WQ-8 | 010, 017, 018, 022, 033, 034 |
| 5 | `term-conflation` | 4 | crc-sp:SP-9, crc-wq:WQ-3.2, crc-wq:WQ-1, crc-tpw:TPW-1 | 003, 008, 009, 032 |
| 6 | `any-vs-most-quantifier` | 3 | crc-ca:CA-17, crc-wq:WQ-7, crc-wq:WQ-2 | 001, 010, 033 |
| 7 | `show-on-all-sheets-partial` | 2 | crc-sp:SP-44, crc-pb:PB-1 | 005, 025 |
| 8 | `vision-dimensional-misread` | 1 | crc-wq:WQ-9 | 035 |
| 9 | `atomization-incomplete` | 1 | crc-ca:CA-17 | 001 |

(Some cases carry two pattern tags so totals sum to >44.)

## Cross-cutting patterns

**1. The agent has a strong "passable-on-its-face" bias.** Five of the top six patterns (`mention-vs-demonstration`, `label-formatting-missed`, `self-uncertainty-not-escalated`, `term-conflation`, `any-vs-most-quantifier`) share a common failure mode: when something on the plan set superficially answers the city's comment, the agent accepts it as resolution without rigorously checking that the *demonstrating artifact* (a dimensioned drawing, a calculation result, a verbatim note, an exhaustive enumeration) actually exists. In the calibration condition where every comment must fail, this surfaces as 30 of 44 candidate failures (68%). Concretely:

- `mention-vs-demonstration` (13): the agent finds a plan note that states a rule and stops. Examples: F-1.2 (note says "14 ft clearance required" — agent doesn't check the access road profile demonstrates 14 ft); SP-12 (note says "density bonus is required" — agent doesn't check DB90 is actually authorized); PR-3 / PR-4 (agent confirms inputs but never the dedication line item).
- `label-formatting-missed` (7): required verbatim text exists with small but real deviations — "A URBAN" vs "an Urban", "APPROVAL FROM" vs "approval of", "POTABLE BACK-UP NP METER" vs "Potable Back-up to OWRS (NP Meter)". Agent rationalized each as substantively equivalent. The validation methodology in `crc-ev.md` is explicit that paraphrase fails — the agent ignored the methodology block.
- `self-uncertainty-not-escalated` (6): the agent's own reasoning admits an evidence gap ("I cannot confirm…", "While X spans multiple requirements…", "wye angle is not explicitly dimensioned") and then returns `resolved` anyway. This is the most diagnostic class — the agent literally writes down the reason it should escalate and then doesn't.

**2. `not-applicable` is being used as a unilateral override of the city's premise.** All 12 NA verdicts share a structural problem: the city wrote the comment knowing the design (this is calibration — same submission produced the comments and is being reviewed), but the agent decided NA because it inferred the conditional rule's trigger is absent. Five WQ items (WQ-11 through WQ-14.2) were NA'd because the agent classified the system as sed/fil rather than retention/irrigation. Five TPW items (TPW-6 through TPW-11) were NA'd because no on-street parking is drawn — even though the agent simultaneously noted that the parking table on Sheet 16 references 15 on-street spaces. In a calibration run an NA decision should require the agent to also rule out "the city wrote this comment because something is missing or inconsistent" — which is the entire point of the calibration condition.

**3. The verbatim-note checklist items are particularly fragile.** 7 of 44 (16%) are agent errors on items where the rule is literally "this exact string of text must appear on this sheet." The agent has a learned heuristic that "substantive equivalence is good enough" — but several of these items (EV-01, EV-02, SP-45.4, SP-45.9, SP-45.1, TPW-1, AWRR-2.1) explicitly require literal text matches per the validation methodology blocks in the guide files. The fix is mechanical: a regex/normalized-string equality check should be a hard gate before `resolved` is allowed.

**4. The error mass concentrates in a few groupings.** Of 44 failures: WQ contributes 11, SP contributes 11, TPW contributes 7, EV contributes 4, CA contributes 4. AW, AW-redlines, CM, IW, LDE, OWB had zero candidate failures — those groupings' agent verdicts were universally `failed` (consistent with calibration ground truth). This suggests the problem is concentrated in specific guide structures (lots of conditional NA triggers, lots of verbatim-note items, lots of multi-clause requirements) rather than a uniform agent defect across all departments.

## Prioritized remediations

| Rank | ID | Name | Covers | Effort | Category |
|---|---|---|---|---|---|
| 1 | R-2 | Calibration/strict-CRC prompt: require demonstrating artifact, not just a stating note/label | 13 | medium | agent-prompt-change |
| 2 | R-6 | Calibration-strict NA gate: forbid NA unless agent enumerates exhaustive sheet-by-sheet search + city hasn't authored a contradicting comment | 12 | medium | agent-prompt-change |
| 3 | R-4 | Verbatim-text enforcement: literal-string check before allowing `resolved` on verbatim-note items | 7 | medium | agent-prompt-change |
| 4 | R-5 | New schema field `evidence_gaps[]` + hedge-marker linter that downgrades to `unclear` when reasoning admits uncertainty | 6 | medium | schema-change |
| 5 | R-3 | Inject term glossary distinguishing legally-distinct terms (separate-table vs row; detention vs filtration; green-infra vs sed-fil) | 3 | low | checklist-text-edit |
| 6 | R-1 | Atomize multi-clause checklist items into per-clause sub-items | 1 | low | atomization |
| 7 | R-8 | Vision protocol: for dimensional reads, require literal dimensioned callout text + the section/profile it comes from | 1 | medium | vision-protocol |
| 8 | R-7 | Vision protocol: multi-sheet verification mandated when requirement says "across plans"/"on plan set"/"on all sheets" | 1 | high | vision-protocol |

**R-2 — applicable refs**: crc-f:F-7, crc-sp:SP-42, crc-sp:SP-44, crc-ev:EV-05.1, crc-f:F-1.2, crc-f:F-4, crc-pr:PR-3, crc-pr:PR-4, crc-sp:SP-12, crc-sp:SP-36.1, crc-sp:SP-36.2, crc-ca:CA-17.1, crc-ca:CA-21.1.

**What**: Inject a system-prompt rule for the CRC review agent: *"Before returning `resolved` for any checklist item, identify a specific dimensioned drawing, calculation result, or completed exhibit on the plan set that demonstrates the rule is satisfied. A general plan note that re-states the rule, or a label that declares compliance, is NOT sufficient. If only a stating note exists, escalate to `unclear`."* Calibrate against the per-case files for R-2 — every one of those 13 cases shows the agent stopping at a note/label.

**Where**: `conductor/workspace/bureau/jurisdictions/austin/workflows/comment-resolution-check/` review prompt.

**R-6 — applicable refs**: crc-wq:WQ-11, WQ-12, WQ-13, WQ-14.1, WQ-14.2, crc-tpw:TPW-6, TPW-7, TPW-8, TPW-9, TPW-11, crc-f:F-1.1, crc-sp:SP-29.

**What**: System-prompt rule: *"To return `not-applicable`, you must (1) enumerate every sheet on which the conditional trigger could appear and confirm absence, AND (2) confirm no other plan element references the conditional trigger (e.g. tables, notes, calculations). If any plan element references the conditional or you cannot exhaustively confirm absence, return `failed` with the gap as the deficiency."* TPW-11 is the canonical failure: agent saw 15 on-street parking spaces in the table, no parking drawn on plans, and called NA instead of failed.

**Where**: CRC review prompt + per-grouping guide validation methodology block.

**R-4 — applicable refs**: crc-sp:SP-45.4, SP-45.9, SP-45.1, crc-tpw:TPW-1, crc-ev:EV-01, EV-02, crc-awrr:AWRR-2.1.

**What**: When a checklist item's requirement contains a colon-quoted verbatim note (regex: `:\s*"[^"]+"`), the agent must produce a normalized-text comparison block in the explanation field. Resolution is only allowed if the comparison is exact (case-insensitive, whitespace-normalized, abbreviation-normalized per explicit aliases). If non-exact, return `failed` with the verbatim diff.

**Where**: Agent prompt + a small post-processor script before the consolidated-findings.json is finalized.

**R-5 — applicable refs**: crc-de:DE-4, DE-22, crc-ev:EV-07, crc-wq:WQ-7, WQ-2, WQ-8.

**What**: Add `evidence_gaps[]: string[]` to the output schema. Augment the prompt with: *"If your reasoning contains any of the following hedge markers — 'I cannot verify', 'I cannot confirm', 'though X is not explicitly', 'while X spans multiple requirements', 'typically', 'is standard' — list each gap in `evidence_gaps[]` and return `unclear`. Hedge markers are incompatible with `resolved`."* Post-step linter rejects any `resolved` with non-empty `evidence_gaps[]`.

**Where**: Output JSON schema + agent prompt + a CRC consolidator validator.

## Novel patterns proposed

The 12 canonical patterns covered every case I audited; no novel `other:*` tag was needed. Two refinements worth considering as future canonicals:

- **`stated-but-not-authorized`** — a sub-class of `mention-vs-demonstration` where the plan contains an *acknowledgement that something is required* (e.g. "a density bonus is required to authorize this FAR") but no evidence of authorization. SP-12 is the clearest example. Currently bundled into `mention-vs-demonstration`.
- **`calibration-NA-override`** — a sub-class of `na-under-defended` that is *specific to calibration runs*, where the agent decides a conditional rule does not apply even though the city wrote the comment against this exact plan set. This was used 12 times in this audit. Worth promoting if calibration-run audits become routine.

## Data sources & limitations

- Primary: `RUN_DIR/output/consolidated-findings.json` — winningFinding contained `observation`, `reasoning`, `explanation`, `resolution`, `tools_used`, `evidenceLocations`, plus `status` and `checklistItemId`. Did NOT contain `output_json.agentTrace` as the brief speculated; the surface fields above proved sufficient. Per-run findings under `output/runs/run-N/findings/` were available but not needed.
- Secondary: `RUN_DIR/output/review-comments.json` — provided `commentNumber`, `parentCommentId`, `citation`, `requirement`, `evidenceExpected` for every audited case.
- Guides: `GUIDES_DIR/crc-<dept>*.md` — table-format checklist with one line per item; lookup by ID worked cleanly across split files (sp-1..sp-4, de-1/2, ca-1/2, tpw-1/2).
- No DB triage rows (confirmed zero per the brief).
- Vision-tool sub-analysis was NOT performed — for cases tagged `vision-dimensional-misread` (WQ-9) and where the agent claimed vision verification, I did not re-run vision against the underlying PDF; the hypothesis is based on logical reading of the agent's own reasoning. A deeper vision-protocol audit (Agent 3's lane) would refine the WQ-9 classification.
- The agent's reasoning is the *post-hoc* reasoning written into the structured output, not the live tool-call trace. A live trace audit might surface tool-call-vs-reasoning inconsistencies invisible from the JSON. (Out of scope here.)

## Pointer to per-case detail

44 per-case files in `per-case/001.md` through `per-case/044.md`. Each contains: verbatim requirement, verbatim observation, verbatim reasoning, verbatim explanation, evidence locations, hypothesis, and remediation mapping.

- High-confidence resolved (most diagnostic): 001–010
- High-confidence NA: 011–015
- Medium-confidence resolved: 016–035
- Medium-confidence NA: 036–042
- Low-confidence resolved: 043–044
