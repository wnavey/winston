# 03 — Open Questions & Brainstorming Hooks

Things I can't answer from the code alone. Ranked by how much they'd
shape a proposal.

## A. What's the actual pain?

Before proposing interventions, we need to know what problem we're
solving. Candidates:

1. **Recall** — we miss real deficiencies the ensemble should catch.
2. **Precision / false-fail rate** — the ensemble flags too much noise
   that graders reject.
3. **Cost / latency** — 24 Haiku agents + retries is fine but we want
   fewer/cheaper.
4. **Inconsistency run-to-run** — same submission, different outputs on
   re-run; erodes trust.
5. **Wording quality** — findings are accurate but the human-facing
   comment is bad.
6. **Citation accuracy** — `codeCitations` wrong often enough that the
   prompt already dedicates a whole section to it.
7. **Partial-failure brittleness** — one item's 5 retries kills the step.
8. **Opacity / debuggability** — we can't tell why the ensemble
   disagreed on a grouping.

The intervention space is radically different for (1) vs. (5) vs. (7).
Worth picking one or two before we go deep.

## B. Design questions about `review-runs` specifically

- **Is 3 the right N?** Is there evidence 5 recovers meaningfully more
  deficiencies, or 2 would suffice? The experiments dir
  (`bureau/.../review/experiments/`) hints at prior sweeps — worth
  checking numbers there.
- **Is Haiku the right model?** The prompt has a lot of "do X carefully"
  hedging that reads like it was tuned to work around Haiku blind spots.
  Would a single Sonnet/Opus run outperform 3 Haiku runs at same cost?
- **Why does the prompt carry the nav tutorial?** ~50 of 165 lines teach
  file layout. Could we pre-process that into a "relevant sheets for
  grouping X" file and inject via `inject:`? Smaller prompt × 24 = real
  token savings.
- **Should pass/n-a be in the output?** Right now silence is ambiguous.
  If we required an exhaustive per-item status, consolidation could
  distinguish "missed" from "agreed pass".
- **Would adaptive runs work?** Run 2, if they disagree run a 3rd (or
  5th). Conductor currently fixes `runs` at launch — would need an
  orchestrator change.

## C. Observability investments worth scoping

- Per-agent transcript persistence (opt-in) — write the conversation to
  `workspace/output/runs/{runIndex}/transcripts/{checklistItem}.jsonl`.
  Small change in `agent/runner.ts`, big payoff for prompt iteration.
- Token/cost tracking in `run-log.json`. SDK exposes usage on messages;
  we're dropping it.
- Vision tool call log — at minimum one line per call (doc, sheet,
  question, duration). Right now it's a black box.
- Item-keyed Logtail filters — naming convention would let us
  reconstruct "all logs for run-2 grouping-5" easily.

## D. Resilience ideas

- `allowPartial: N` on the step → tolerate up to N failed items, pass a
  manifest of failures to consolidation. Ensembles were built for this.
- Decouple retry backoff from worker slot — schedule retries on a timer
  rather than holding a slot via `await sleep()`.
- Graceful degradation: if a grouping fails all retries in N-1 of N
  runs, mark findings as "low-confidence unverified" rather than
  dropping.

## E. Things I haven't looked at yet

- Prior experiment results under `bureau/.../review/experiments/`.
- `cross-run-consolidate.ts` — how exactly confidence tiers are assigned.
  Might constrain what per-run changes are useful.
- `cityhall` rendering — what does a reviewer see, and which fields
  actually surface in the UI?
- Measure-distance tool (`review-4.3`/ruler) — is it being used in
  current flows, and is it a lever for precision on spatial deficiencies?

---

**Next iteration — pick a direction:**

1. "Let's nail down the pain point" → skim recent reviews + grader
   feedback, rank A1–A8.
2. "Let's add observability first" → scope C items, land them as a
   prereq for any prompt/model work.
3. "Let's prototype a prompt/model swap" → set up a parallel experiment
   with a chosen variable held fixed.
4. "Let's make the step failure-tolerant" → design `allowPartial` and
   the downstream contract.

I'd lean toward (2) before (3) — hard to iterate on prompts blind. But
(1) is the real question.
