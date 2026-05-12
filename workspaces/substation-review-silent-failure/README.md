# Substation review-workflow silent failure

**Status:** identified but not investigated. Tracked here so it doesn't
get lost; high priority but **scope-independent** from the
vision-tool-orchestration Phase 1 work.

## The problem

The Substation Inngest function `Substation-workflow-run` — the
production deployment path that fires review workflows in the cloud —
**hangs silently** on review runs. The function reports "Completed" in
~50 ms with no output. No LLM activity. No error surfaced. The
workflow just doesn't run.

This was first observed on `el-md-exp` var-2 runs during Phase 1 of
the vision-tool-orchestration initiative. Two cloud attempts hung:

- **RUN_4** (cloud, 2026-05-08-ish)
- **RUN_5** (cloud, 2026-05-08-ish)

Both runs had identical inputs to the locally-executed RUN_6 + RUN_7 +
RUN_9 + RUN_10 that all succeeded. We pivoted to local conductor
execution for the entire phase to unblock the metrics work. **We've
never actually run var-2 (or any post-Phase-1 review workflow) on the
production deployment path.**

## Why it's important

The production deployment path is how customer-facing reviews actually
ship. Until this is reproduced + diagnosed:

1. Var-2 cannot go customer-facing. No matter how good the
   architecture proves out locally, the cloud delivery mechanism is
   broken.
2. Phase 1 metrics, while real, are local-execution-only. We don't
   know if the cloud path would produce identical numbers, or if
   there are environment-specific issues that surface in production.
3. **This may also affect ctrl-baseline / var-1 cloud runs** — we
   don't know if the failure is var-2-specific or path-general. That
   matters because production reviews are running on the ctrl
   variant *today*; if those are at risk too, this isn't just a
   "future deployment" concern.

## Why it's scope-independent from Phase 1

This is almost certainly a **Substation infra issue**, not a
vision_check/conductor/bureau issue. Symptoms:

- 50 ms "completed" with no output — looks like the function exited
  before doing any real work.
- No LLM activity — the agent never even started running.
- Local conductor on the same inputs works cleanly.

The diagnostic surface is in Substation (Inngest function definition,
sandbox provisioning, environment variable plumbing, etc.), not in
the vision-tool-orchestration code. Worth a separate workspace + a
separate owner if needed.

## What we know

- **When it happened:** two specific cloud runs (RUN_4 + RUN_5) on
  `el-md-exp` review workflow with `--experiment=vision-check`,
  early May 2026.
- **What we saw:** Substation's `Substation-workflow-run` Inngest
  function "Completed" in ~50 ms, no logs of agent activity, no
  workflow output files written.
- **What we didn't see:** any error message, stack trace, or warning
  surfaced anywhere. Failure was silent.
- **What we ruled in (or didn't rule out):** the same inputs run
  cleanly on local conductor. So the workflow definition is sound,
  the bureau prompts are sound, the conductor binary is sound.
  Something at the Substation→sandbox boundary fails.

## What we don't know

- Whether the failure is **deterministic** (every cloud run hangs)
  or **flaky** (some succeed, some hang). Two-out-of-two is
  suggestive but not conclusive. **Hasn't been re-tested.**
- Whether the failure is **var-2 specific** (e.g. something about
  the `--experiment=vision-check` overlay loading that doesn't
  reproduce on ctrl) or **path-general** (all current cloud reviews
  are at risk). **Not investigated.**
- Whether the silent-50ms-completion is the actual failure point,
  or if something earlier in the Inngest chain (sandbox
  provisioning, image pull, env injection) is the real cause.
- Whether this regressed at a specific date / Substation version,
  or if it's been broken silently for a while.

## Suggested first investigation steps

1. **Confirm reproducibility.** Fire a fresh cloud run with the same
   inputs as RUN_10 (Valley View v1, el-md-exp, vision-check
   overlay). See if it hangs the same way.
2. **Test other variants in cloud.** Fire ctrl-baseline + var-1 in
   the cloud on the same submission. If those also hang, this is a
   path-general issue. If only var-2 hangs, look at overlay loading.
3. **Inspect Substation logs at the right altitude.** The "Completed
   50 ms, no output" is a *symptom* — somewhere in Substation's
   sandbox-provisioning / image-pull / env-injection chain
   something is failing or returning early. Need to look one layer
   deeper than the Inngest function dashboard.
4. **Compare git history.** Identify the last known-good cloud
   review run (any workflow, any submission). Compare Substation
   commits between that and now.
5. **Check sandbox lifecycle.** Vercel Sandboxes have memory /
   timeout / image constraints. Is the sandbox actually being
   provisioned? Is the conductor binary getting installed? Look at
   sandbox-level logs (not Inngest-level).

## What's blocked on this

- Customer-facing var-2 rollout (path-to-core gate #3 in the
  [Phase 1 finalization plan](../vision-tool-orchestration/phase-1-finalization-plan.md)).
- Cloud-based reproducibility of all Phase 1 metrics.
- Possibly: silently-broken production reviews on the ctrl variant,
  if the failure is path-general. **This bullet alone elevates this
  from "Phase 2 deployment work" to "investigate-now".**

## Suggested ownership

The diagnostic surface lives in the Substation repo. Whoever owns
Substation's Inngest workflow runner is the right person to drive
this. The vision-tool-orchestration team can supply test inputs +
expected behavior; we can't fix it from this side.

## Cross-references

- [Phase 1 finalization plan](../vision-tool-orchestration/phase-1-finalization-plan.md) — lists this as gate #3 for path-to-core.
- `winston/workspaces/vision-tool-orchestration/source-runs/el-md-exp/var-2/` — the canonical successful run (RUN_10_LOCAL); identical inputs to the failed cloud runs.
- RUN_4 / RUN_5 — the two specific cloud failures; identifiers (Inngest event IDs, workflow_runs.id) need to be pulled from the original kickoff records if needed for forensics.
