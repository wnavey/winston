# Agent 3 — `apply-forced-outcomes` audit

**Review:** `ae7cb127-6103-48d2-9107-a320155b5436`
**Run label:** `2026_07_07_ROW_fix_take_1`
**Step index / wall:** 2 / 674 ms (`workflow/run-log.json` L513–519)
**Verdict:** `HEALTHY` (no-op, correctly — no `forceOutcomes` input on this run)

---

## Step purpose

`apply-forced-outcomes` reads a TSV of jurisdiction-authored overrides (`checklist_id \t status \t explanation`), joins by composite ID `{grouping}:{itemId}`, calls an AI model to synthesize a natural narrative, and overwrites the per-grouping finding under `output/findings/*.json` with `forced=true`, `forcedReason`, `forcedStatus`, `organicStatus` metadata. When no TSV is provided the step is a no-op and touches nothing. See `apply-forced-outcomes.ts:263–398`.

Important framing correction to the calling brief: this step does **not** implement the "Fail Status / Warn Status" policy clamp described in the user's charge. That clamp lives in `checklist-policy.ts:221` (`clampStatus`) and is called by the consolidator (`cross-run-consolidate-cc.ts`) BEFORE the majority vote. `apply-forced-outcomes` is only for TSV-driven human overrides. The 6 warn / 4 fail statuses in `consolidated-findings.json` therefore reflect the consolidator's per-vote clamp against each item's `Fail Status` column — not this step. That is Agent 2's territory; this report is scoped to `apply-forced-outcomes` proper.

## What happened (evidence)

1. **Inputs contract.** `status.json` L5–27 shows the run's input map — `forceOutcomes` is absent. The workflow yaml renders the arg template unconditionally: `forceOutcomesFile: "{{ WORKSPACE_PATH }}/bureau/{{ input.checklistsDir }}/{{ input.forceOutcomes }}"` (`workflow.yaml:198`).

2. **Rendered command (from `logs/completeness-check.log:29045`):**
   ```
   npx tsx …/apply-forced-outcomes.ts \
     --forceOutcomesFile='/vercel/sandbox/workspace/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/{{ input.forceOutcomes }}' \
     --findingsDir='/vercel/sandbox/workspace/output/findings' \
     --checklistsDir='/vercel/sandbox/workspace/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed' \
     --model='claude-haiku-4-5-20251001'
   ```
   The `{{ input.forceOutcomes }}` literal is **UNRENDERED** — conductor left the mustache in place because the input was absent. This is the failure signature (a) called out in the caller's pointed facts, and here it is benign: the resulting path does not exist, so the `existsSync` guard fires and the script exits early.

3. **Guard fires as designed.** `apply-forced-outcomes.ts:280–287`:
   ```ts
   if (!forceOutcomesFile || !fs.existsSync(forceOutcomesFile) || !fs.statSync(forceOutcomesFile).isFile()) {
     console.log('No forced outcomes file provided or file not found — skipping.');
     return;
   }
   ```
   That `console.log` stdout is discarded by conductor (only step start / step completed / duration are logged), so the observability of the no-op is limited to the 674 ms wall time in `run-log.json:513`.

4. **No mutations.** Grep of `output/findings/*.json` for `forced`, `forcedReason`, `forcedStatus`, `organicStatus` returns zero matches. Grep of `output/consolidated-findings.json` for the same → zero. No file was patched.

5. **No cross-project contamination.** The bureau checklist dir does contain a stale foreign TSV — `/Users/winston/noetic/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/1700-s-lamar-forced-outcomes.tsv` — belonging to a different project (this run's `projectId` is `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`). Because the yaml requires the filename to be explicitly passed via `input.forceOutcomes`, and this run did not pass it, the wrong file was NOT loaded. Correct outcome — but the *mechanism* (existsSync-fails-on-unrendered-mustache) is a happy accident, not a designed defense (see remediations).

## Root-cause analysis

The step behaved correctly. There is no root-cause because there is no defect on this run's execution. The user's charge described a scenario in which fail/warn discrimination happened at this step (the 6/4 split); that split was actually produced upstream by the consolidator's pre-vote clamp using `checklist-policy.ts` — I confirmed this by inspecting individual warn/fail entries in `consolidated-findings.json` (e.g. `cc-1:CC-1-32` at L2998, where `winningFinding.status = "warn"` matches five `warn` run votes with per-run explanations that explicitly cite the `Fail Status` policy — evidence the clamp is the consolidator's, not this step's).

## What went right

- **Guard works.** The three-part guard (missing arg / not-exists / not-a-file, `apply-forced-outcomes.ts:280–287`) correctly caught the unrendered mustache.
- **Idempotence.** With no forced items, re-running is trivially idempotent: no writes occur, `pass`, `not-applicable`, `warn`, `fail`, and `uncertain` items are all left untouched.
- **Composite-ID lookup.** Even had this run applied forcings, the join key is composite (`{grouping}:{itemId}` — `apply-forced-outcomes.ts:126–131` and lookup at `L313`), not bare, so the "flat bare-ID lookup" failure signature (c) is not applicable to this script. The consolidated statuses of this run are all bare IDs (per shared context), so a bare↔composite mismatch could not occur here.
- **Cross-project contamination avoided.** The stale `1700-s-lamar-forced-outcomes.tsv` did not leak in.
- **Script scope is narrow.** It only mutates finding entries it patches, and writes back only the `affectedGroupings` set (`apply-forced-outcomes.ts:389–395`). No file is overwritten unless something was patched.

## What went wrong

- Nothing at runtime. The step correctly no-op'd. Below are latent risks that this audit only surfaces because the caller asked for known-failure-signature checks; none of them fired on this run.

## Observability gaps & remediations

1. **Unrendered mustache in stdout is silently swallowed.** The rendered `--forceOutcomesFile='…/{{ input.forceOutcomes }}'` mustache literal only survives because I grep'd the raw command log line. Conductor discards script stdout, so the "No forced outcomes file provided or file not found — skipping." log line is lost. Remediation: (i) conductor should refuse to execute a command line containing an unrendered `{{ … }}` (fail-fast); AND (ii) the script's no-op log should include a structured JSON line (`{event: 'apply-forced-outcomes', decision: 'no-op', reason: 'file-not-found', path: '<rendered>'}`) written to a dedicated jsonl under `output/`, not stdout — so downstream audits can distinguish "no override intended" from "override intended but file missing/typo'd".
2. **Yaml arg template has no `if:` gate.** `workflow.yaml:194` runs the step unconditionally. Consider `if: "{{ input.forceOutcomes }}"` so the step is skipped by conductor rather than relying on the script's runtime guard. Belt-and-braces with #1.
3. **existsSync is a silent fallback disguised as a guard.** The current guard cannot distinguish "operator meant not to force" from "operator typo'd the filename" from "template render bug." Remediation: require `forceOutcomes` to be either absent (explicit no-op) or resolvable to a real file — a rendered path containing a mustache literal, a directory, or a missing file should be a hard error, not a silent skip.
4. **Stale foreign TSV in shared checklist dir.** `1700-s-lamar-forced-outcomes.tsv` lives alongside `cc-*.md`. Nothing prevents a future operator from typo-triggering (e.g. `forceOutcomes: 1700-s-lamar-forced-outcomes.tsv` in the wrong project's inputs). Remediation: move forced-outcomes TSVs to a per-project location (e.g. under the project's own directory), or scope the filename via a project-ID prefix that must match the run's `projectId`.
5. **No agent-trace record of the no-op decision.** `run-log.json` shows only step start/end/duration. There is no artifact anyone downstream can inspect to confirm the no-op was intentional. Pairs with #1.
6. **Post-fact reviewer confusion risk.** Because the calling brief conflated this step with the consolidator's Fail-Status clamp, it would help to add a top-of-script comment cross-linking to `checklist-policy.ts:221` clarifying that Fail/Warn Status column policy is applied upstream in the consolidator, and this script is ONLY for human TSV overrides.

---

**Verdict: HEALTHY.** Step 2 executed in 674 ms and correctly did nothing. No mutations to `output/findings/*.json`; no `forced*` metadata anywhere; no accidental cross-project TSV loaded. The 6-warn / 4-fail policy discrimination the caller pointed at happened upstream in the consolidator, not here. Recommend hardening the no-op path (items 1–3 above) to convert a happy-accident guard into an engineered one.
