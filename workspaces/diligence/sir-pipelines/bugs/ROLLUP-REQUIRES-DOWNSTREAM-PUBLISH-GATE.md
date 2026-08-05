# SIR rollup (5.6) requires the downstream Publish gate (5.8) to be `confirmed` — a circular dependency that fails every run's rollup

> **Status:** Diagnosed 2026-08-04, fix NOT implemented. Root cause is in the **SIR pipeline** (`bureau/pipelines/sir/5.6-rollup/rollup.py`). Discovered on the Hutton/Louisville SIR run `~/noetic/working/sir/hutton/car-wash-louisville-ky/2026-08-01-083311` — step **5.6 Rollup** exited 1 with `checks.hitl = gates-undecided`, naming gate **5.8** as the undecided one. **Presents as an operator-decision failure ("a gate was skipped!") — it is not one.** All *analysis* gates were decided; the "undecided" gate is a **post-deliverable Publish checkpoint that the pipeline's own lineage places AFTER the rollup**, so it is structurally impossible to decide before the rollup runs. Worked around this run with a recorded operator override on `overrides.checks.hitl`. Sibling of [[LOUISVILLE-EL-FEASIBILITY-GUIDE-DISCIPLINE-SWAP]].

## Summary

The 5.6 Rollup writes the run's manifest — the record that says "this run reached its deliverable legitimately." As part of that, it asserts that **every HITL gate in the pipeline carries a recorded `confirmed` decision** — a genuinely important guard: a run that reached a client deliverable with a *skipped analysis gate* is the exact incident the pipeline was rebuilt to prevent.

The guard enumerates gates by scanning the whole pipeline for checkpoint steps: `[s for s in steps if s.get("checkpoint")]`. There are three — `3.2` (HITL1, regulatory frame), `4.4` (HITL2, acquisition), and `5.8` (**Publish**). The first two gate the analysis and are decided long before the rollup. **`5.8 Publish` is different in kind: it is a *post-deliverable* checkpoint** — its readout asks one question, "publish this SIR to the app?", and on "no" the deliverable simply ships from disk. And by lineage it sits **after** the rollup: `5.6 → 5.7 → 5.8` (`5.7 requires 5.6`, `5.8 requires 5.7`).

So the rollup requires a decision on a gate that cannot be reached until two steps *after* the rollup completes. That is a cycle: **5.6 needs 5.8 decided → 5.8 needs 5.7 done → 5.7 needs 5.6 done.** On a first run the rollup can never satisfy its own check, and the run cannot complete without an operator override every single time.

What is **working correctly**: the guard itself is right to exist, and it fires accurately (5.8 really is undecided). The override mechanism (`overrides.checks.hitl` with approver + reason → the check becomes an auditable NOTE) also works exactly as designed and is what unblocked this run. Nothing downstream is corrupted; the deliverable is sound.

**Root cause, one sentence:** the rollup's gate census counts *all* checkpoints without excluding gates that are downstream of the rollup itself, and the `5.8 Publish` checkpoint — added after the census was written — is downstream of it, so the "all gates decided" invariant is unsatisfiable at rollup time.

## The bug in one diagram

```
PIPELINE LINEAGE (requires-edges)                 5.6 ROLLUP's gate census (rollup.py:655)
─────────────────────────────────                 ────────────────────────────────────────
 3.2  HITL1  ✓ confirmed  ─┐                        gates = every step with `checkpoint:`
 4.4  HITL2  ✓ confirmed  ─┤                              = { 3.2, 4.4, 5.8 }        ← counts 5.8
 5.1 … 5.5                 │                        require: ALL gates `confirmed`
 5.6  ROLLUP  ◄────────────┘  needs ALL gates       decided = { 3.2, 4.4 }           (2 of 3)
      │        confirmed, INCLUDING 5.8  ✗           → 2 < 3 → checks.hitl = gates-undecided → FAIL
      ▼
 5.7  PACKAGE (requires 5.6)                        THE CYCLE:
      ▼                                               5.6 needs 5.8 decided
 5.8  PUBLISH (requires 5.7)  ← undecided,             5.8 needs 5.7 done
      the post-deliverable gate                        5.7 needs 5.6 done   ⟲  unsatisfiable
```

The `✗` is the census counting a gate the rollup's own lineage guarantees is undecided.

## Symptom (as observed)

- **Run:** `.../hutton/car-wash-louisville-ky/2026-08-01-083311`, step `5.6-rollup`.
- **Console:** `[5.6] WARNING: gate(s) ['5.8'] carry no recorded 'confirmed' decision, yet the run reached the deliverable.` → `[5.6] health: failed` → `FAILED: checks.hitl = gates-undecided` → `step 5.6 FAILED (exit 1)`.
- **verify:** `checks.hitl is 'gates-undecided', needs one of ['ok'] (or a recorded override under overrides.checks.hitl)`.
- **Tempting-but-wrong first read:** "an analysis gate was skipped — go decide it." It wasn't. `state/hitl/` shows `gate-3.2.json` and `gate-4.4.json` both `decision: confirmed`. The only undecided gate is `5.8`, which by construction cannot be decided yet.

## Evidence chain

1. **The census counts every checkpoint, unfiltered.** `bureau/pipelines/sir/5.6-rollup/rollup.py:655`: `gates = [s for s in (spec.get("steps") or []) if s.get("checkpoint")]`. **No filter on step id, lineage position, or gate kind** — a Publish checkpoint counts identically to an analysis gate.

2. **It requires all of them decided.** `rollup.py:671,679-682`: `decided = [d for d in decisions if d["decision"] == "confirmed"]`; `if len(decided) < len(gates): … return payload, "gates-undecided", [f"gate(s) {undecided} carry no recorded confirmed decision …"]`. **`gates_declared = 3`, `gates_decided = 2` → fails.**

3. **`5.8 Publish` is a checkpoint, and it is downstream of the rollup.** `pipeline.yaml`: `- id: "5.8"  title: Publish  requires: ["5.7"]  checkpoint: …`; and `- id: "5.7" requires: ["5.6"]`, `- id: "5.6" requires: ["5.5"]`. **The requires-chain is `5.6 → 5.7 → 5.8`, so 5.8 cannot be reached until after 5.6 completes.**

4. **5.8 is post-deliverable and optional — not an analysis gate.** `prompts/5.8-publish.md` (via the step's readout): *"Ask the operator ONE question — 'Publish this SIR to the app?' … On no, the run completes unpublished and the deliverable ships from disk, re-publishable later."* **Its decision changes nothing upstream; it gates *distribution*, not the *deliverable's correctness*** — which is the thing the rollup's guard is actually protecting.

5. **The guard's own rationale is scoped to the deliverable, not to publishing.** `pipeline.yaml` 5.6 comment: *"A run that reached **the deliverable** with an undecided gate is the incident this pipeline was rebuilt to make impossible."* **The intent is "every gate that gates the deliverable is decided" — 5.8 gates what happens *to* the finished deliverable, so it is outside that intent.**

6. **Deterministic across every run.** The census is static over `pipeline.yaml`; `5.8` is a permanent checkpoint. **Every SIR run will fail 5.6 on `gates-undecided` for `5.8` and require an operator override to proceed** — the override is not an exceptional event, it is mandatory on the happy path, which is precisely what trains an operator to rubber-stamp it.

## Root cause

`bureau/pipelines/sir/5.6-rollup/rollup.py:655` builds the gate set as *all* checkpoint steps and (`:679`) requires every one `confirmed`. The missing invariant: **the rollup may only require decisions on gates that its own lineage guarantees are reachable before it runs — i.e. gates upstream of the rollup.** `5.8 Publish` was introduced as a checkpoint after this census was written, and it sits downstream of the rollup, so the census silently acquired an unsatisfiable member. The check has no concept of "a gate that comes after me," so it cannot tell "an analysis gate was skipped" (the real incident) from "the terminal publish gate hasn't happened yet" (structurally normal).

Irony: the pipeline already distinguishes these two situations everywhere else — `5.8`'s own `decision:` prose says a skip "is a finished run, not an invalidation." The rollup just doesn't read that.

## Impact

- **5.6 Rollup (affected, deterministic, every run).** Fails `checks.hitl` on `5.8` on every first run. ⚠ **The only way through is a recorded operator override on `overrides.checks.hitl` — required on the happy path, every run.** An override that must be applied every time is an override nobody reads, which erodes the exact guard it sits on: a genuinely skipped `4.4` would be waved through by the same reflex.
- **5.7 Package (blocked until the override).** Requires 5.6 complete; cannot run until the rollup is forced through.
- **5.8 Publish (unaffected).** Reached and decided normally *after* the override + package.
- **3.2 / 4.4 gate integrity (unaffected).** Both are correctly required and were confirmed; the guard's real job still works.
- **The deliverable (unaffected).** Correctness is untouched; this is a workflow/gating defect, not a content defect.
- **Cheap detector:** a run whose `state/hitl/` contains `gate-3.2.json` + `gate-4.4.json` (both `confirmed`) but whose 5.6 health reads `checks.hitl: gates-undecided` naming only `5.8` — that is this bug, not a skipped analysis gate.

## Fix directions (not yet implemented — directions, not a mandate)

1. **Fix the invariant: census only gates upstream of the rollup.** In `rollup.py`'s gate scan, exclude any checkpoint whose lineage places it at or after the rollup — e.g. drop gates whose `requires`-chain passes through `5.6`/`5.7`, or (simplest and robust to renumbering) only count gates that appear *before* the rollup step in topological order. This makes the guard mean what its own comment says: every gate that gates *the deliverable* is decided.
2. **Or classify gates by kind.** Give checkpoints a `gate_class` (`analysis` vs `distribution`) and have the rollup require only `analysis` gates. More explicit, but adds a schema field the linter must learn.
3. **Cheap stopgap (not a real fix): document the override as expected.** If the census can't be changed immediately, the 5.8-only override should be pre-authored/auto-recorded rather than hand-applied, so a *real* skipped gate still stands out. This keeps the guard legible but is strictly inferior to (1) — a self-applied override defeats the point.

## Reproduction / verification recipe

1. **Confirm the census is unfiltered:** `sed -n '655p' bureau/pipelines/sir/5.6-rollup/rollup.py` → `gates = [s for s in (spec.get("steps") or []) if s.get("checkpoint")]` (no id/lineage filter).
2. **Confirm 5.8 is a downstream checkpoint:** in `bureau/pipelines/sir/pipeline.yaml`, `5.8` has `checkpoint:` and `requires: ["5.7"]`; `5.7 requires 5.6`; `5.6 requires 5.5`.
3. **Reproduce the failure on any run that reached 5.5:** `python3 pipelines/lib/pipeline_runner.py run sir --step 5.6 --run-dir <run>` → exits 1 with `checks.hitl = gates-undecided`, `undecided = ['5.8']`, while `state/hitl/gate-3.2.json` and `gate-4.4.json` are both `confirmed`.
4. **Acceptance test for the fix:** after the census excludes downstream gates, `run --step 5.6` on a run with 3.2 + 4.4 confirmed passes `checks.hitl: ok` with **no override**, and a run that genuinely skipped 4.4 still fails `gates-undecided` naming `4.4`.
