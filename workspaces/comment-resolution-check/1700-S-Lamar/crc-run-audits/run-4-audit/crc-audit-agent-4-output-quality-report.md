# CRC Audit Agent 4 — Output Quality Report

- **Run**: `1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8`
- **Project**: Lamar + Collier (`23301a8a-4cdb-4751-ac0c-93b97f0f5c12`)
- **Submission version (and CRC guides version)**: `6b9b85ed-e992-4906-a222-b24ee836910c` — **calibration condition confirmed (same version both sides)**
- **CRC generation**: 5
- **Config**: 5 runs × 21 dept guide files
- **Mode**: NO-TRIAGE (no rows in `comment_triage` for this review_id)

## TL;DR — Verdict: **HEALTHY WITH NOTES**

- 33 candidate failures (32 resolved + 1 not-applicable) out of 229 total verdicts → **14.4%**
- Of the 32 `resolved`, **22 were emitted with `high` confidence** under calibration conditions where the implicit ground truth is `failed` for every item. This is the most concerning subset.
- 10 `resolved` were `medium`-confidence (4-of-5 majority vote across runs, with one dissenting `failed` vote — system saw the signal but didn't escalate).
- Raw candidate-failure rate of 14.4% falls in the HEALTHY-WITH-NOTES band (5–15%). However, the high-confidence resolved verdicts (22 of 32) under calibration conditions indicate the agent's confidence calibration is poor — the system reports high certainty on items that *must* be failed by construction. Downgrade-risk: degrade to DEGRADED if the high-confidence false-resolve subset (22/229 ≈ 9.6%) is taken as the headline rate.

## Failure bucket breakdown

In no-triage mode all candidates go in one bucket:

| Bucket | Count |
|--------|-------|
| `un-triaged-resolved-or-na` | 33 |

## Top failure patterns (by tag frequency across 33 cases)

| Pattern | Count | Share |
|---------|-------|-------|
| `scope-misinterpretation` | 22 | 67% |
| `self-uncertainty-not-escalated` | 7 | 21% |
| `mention-vs-demonstration` | 6 | 18% |
| `term-conflation` | 1 | 3% |
| `watermark-disclaimer-missed` | 1 | 3% |
| `na-under-defended` | 1 | 3% |


## Failure distribution by department

| Grouping | Candidate failures |
|----------|--------------------|
| `crc-SP` | 15 |
| `crc-EV` | 7 |
| `crc-CA` | 2 |
| `crc-F` | 2 |
| `crc-TPW` | 2 |
| `crc-WQ` | 2 |
| `crc-AW` | 1 |
| `crc-AWRR` | 1 |
| `crc-DE` | 1 |


## Cross-cutting patterns

### 1. Site-Plan group is the dominant failure surface (15/33 = 45%)

The crc-SP grouping (organizational/format requirements like sheet labeling, plan-set structure, naming conventions) accounts for most false-resolves. These checks rely heavily on the agent verifying that a *plan note* or *label* exists. Under calibration conditions, the agent reads the note (which the historical reviewer flagged as inadequate or wrong-formatted), accepts it as evidence, and resolves. This is the canonical **mention-vs-demonstration** pattern.

### 2. Environmental (crc-EV) shows 7/33 false-resolves — almost all `high`-confidence

EV items appear to be especially susceptible to the agent accepting compliance notes at face value, even though the original reviewer flagged the same plan content. Suggests the checklist row may not capture *what was wrong* — only *what should be present*. Atomization back-check likely needed.

### 3. High-confidence false-resolves are the most dangerous failure mode

22 of 32 resolved verdicts (69%) were emitted with `high` confidence, with unanimous 5-of-5 votes across runs. This means the system is *consistently* and *confidently* wrong — not a sampling-variance issue. The vote breakdowns of {resolved: 5} indicate model-systematic error, not noise. Remediation must change the *prompt or evidence rubric*, not aggregation.

### 4. Self-uncertainty in reasoning is not propagated to status

Several cases contain hedge markers in the reasoning ("blank placeholder", "for reference only", "states that", "though") that should have demoted the verdict to `uncertain`, but the schema/agent permits a `resolved` + `high` self-contradiction. See R-03.

### 5. Calibration test exposes asymmetric severity

Because every item in the submission has been previously flagged and not changed, any `resolved` verdict is by definition incorrect. But the agent appears to anchor on positive evidence (the presence of a note, a plat, a label) without ever asking "would the reviewer have flagged this again?" The agent has no notion of "this was flagged before; show me what changed."

## Prioritized remediations

### R-02: Add 'do not narrow the rule' rubric to review-agent prompt; require enumeration of all rule sub-clauses before resolving (rank 1, covers 21 cases, effort: medium, category: `agent-prompt-change`)

- **Sample cases**: 002, 003, 004, 006, 008
- **Sample refs**: crc-AWRR:AWRR-2, crc-CA:CA-17, crc-CA:CA-21, crc-EV:EV-01, crc-EV:EV-03

### R-01: Strengthen 'evidence form' requirement: demand a drawing/dimension/callout, not a plan note (rank 2, covers 6 cases, effort: low, category: `checklist-text-edit`)

- **Sample cases**: 007, 021, 024, 025, 029
- **Sample refs**: crc-EV:EV-02, crc-SP:SP-42, crc-SP:SP-45.2, crc-SP:SP-45.3, crc-SP:SP-47

### R-03: Auto-downgrade resolved→uncertain when reasoning contains hedge tokens (may/appears/likely/though unclear) (rank 3, covers 4 cases, effort: medium, category: `schema-change`)

- **Sample cases**: 005, 009, 017, 018
- **Sample refs**: crc-DE:DE-34, crc-EV:EV-05, crc-SP:SP-11, crc-SP:SP-12

### R-08: Add glossary of legally-distinct-but-similar terms (manhole≠junction box, recorded≠approved) to agent prompt (rank 4, covers 1 cases, effort: medium, category: `agent-prompt-change`)

- **Sample cases**: 001
- **Sample refs**: crc-AW:AW-2

### R-04: Require N/A verdicts to enumerate the search space and explain why each scenario is inapplicable (rank 5, covers 1 cases, effort: medium, category: `agent-prompt-change`)

- **Sample cases**: 031
- **Sample refs**: crc-TPW:TPW-17

## Novel patterns proposed

- **`other:calibration-false-resolve`** — Default tag for cases where no specific canonical pattern matches but the verdict is wrong by construction. Suggests the *root* root-cause is **the absence of an "I have seen this submission before" memory** in the CRC agent. Future work: feed the prior cycle's review comments as context so the agent can detect "this content matches the prior failure verbatim, therefore not resolved."
- **`anchoring-on-positive-evidence`** — A meta-pattern where the agent treats *any* artifact that mentions the rule's topic as evidence of compliance, without asking whether the artifact *resolves the specific deficiency* flagged in the parent MCR comment. This is structurally distinct from mention-vs-demonstration: even when the artifact is a drawing (not a note), the agent does not check that the drawing *fixes the prior reviewer's specific complaint*.
- **`placeholder-as-evidence`** — Saw 1 explicit case (AW-2) where a "FOR REFERENCE ONLY" sheet was accepted as plat evidence. Worth a dedicated check (overlaps with `watermark-disclaimer-missed`).

## Data sources & limitations

### Sources
- Primary: `/Users/wnavey/noetic/crc-audits/1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8/_run/output/consolidated-findings.json` (229 verdicts).
- Checklist guides: `/Users/wnavey/noetic/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/cf1201c2-2e8b-4034-9a5e-a70b6317e39a/4/5/` (21 files).
- Vote breakdown: 5 runs each, voting consolidated by majority.

### Limitations
- **No-triage mode**: implicit ground truth is "every item should be failed". This is correct *by calibration construction* but does not distinguish "the agent is uniformly bad" from "some items genuinely don't apply but the calibration condition forces them to be failed". Real triage would distinguish these.
- **Parent MCR comment not in consolidated-findings**: per-case detail files include the checklist row only. To compare against the original city comment, the auditor must cross-reference `comment_resolution_check_review` rows or the MCR pdf.
- **Vision tool outputs not directly audited**: cases tagged `vision-dimensional-misread` / `vision-feature-hallucinated` are inferred from the agent's *self-reported* vision activity. Without re-running the vision tool the auditor cannot verify the actual misread.
- **Pattern classification is LLM-judged but rule-assisted**: I used heuristics over reasoning + checklist text. Some cases may carry the wrong tag; the per-case detail files contain the full reasoning so a human reviewer can adjudicate.
- **Out of scope**: performance, vote-variance across runs, tool-usage analytics, infrastructure issues. Other audit agents cover those.

## Pointer to per-case detail

All 33 per-case files live in `/Users/wnavey/noetic/crc-audits/1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8/per-case/` and are named `001.md` through `033.md`. Each file includes the verbatim agent observation, reasoning, the matched checklist row, and a hypothesis + remediation pointer.
