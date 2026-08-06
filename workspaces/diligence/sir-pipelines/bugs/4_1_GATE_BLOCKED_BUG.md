# SIR `4.1` gate is hard-blocked (`input_map` fail) whenever `3.4` retains records — the disciplines input map never learned about `retained-records/`

> **Status:** Diagnosed 2026-08-06, **fix IN FLIGHT** (shallow fix = Bureau PR [noetic-inc/bureau#951](https://github.com/noetic-inc/bureau/pull/951); the durable invariant guard is NOT yet implemented). Root cause lives in **Bureau** (`bureau/pipelines/sir/4.1-disciplines/disciplines.json`, the roster's input map), not in the pipeline code. Discovered on the noetic/grocery-atlanta SIR run `~/noetic/working/sir/noetic/grocery-atlanta/2026-08-05-062129` — step **4.1** `check_disciplines.py` returned `input_map: failed`, which forces `contract: failed`, and `checks.input_map: [ok]` is a **hard `health_requires`** for step 4.1 — so `verify` refuses to record 4.1 complete. **This is NOT a degrade like the `el` guide-swap; it is a full gate stop: the run cannot advance past 4.1 without a Bureau edit.** Deterministic on every current SIR run whose 3.4 phase emits its records artifacts (the standard path since bureau #821).

## Summary

SIR step 4.1 fans out ten discipline agents. To keep each agent off a ~1 MB naive full-read of the whole accumulated record, the roster `disciplines.json` carries an **input map** — a three-tier reading protocol (`common_inputs` = every discipline reads it; `<discipline>.primary_inputs` = only that discipline reads it; `out_of_context` = deliberately nobody reads it, with a stated reason). `check_disciplines.py`'s `check_input_map` enforces a completeness invariant: **every artifact in step 3.4's research corpus must be owned by exactly one tier.** An unowned research file fails the check with *"an unowned research file is a file whose evidence reaches nobody."*

Step 3.4 was later taught to retain source documents: bureau #821 added `output/3.4-research-site/retained-records/` (the kept source captures) and `output/3.4-research-site/retained-records-manifest.json` (the census of what was retained vs. left as a named gap). **The 4.1 input map was never updated to own those two artifacts.** So on any run where 3.4 emits them, `check_input_map` finds two corpus children in none of the three tiers and hard-fails.

What is **working correctly**: the check itself. Its docstring explicitly anticipates this exact failure mode — *"3.4 grows a research file (or renames one) that NOBODY owns … is exactly how a whole file's evidence stops reaching any discipline"* — and it fires loudly rather than letting an orphaned research file slip through. The defect is not that the check is wrong; it is that the roster's static input map fell out of sync with 3.4's grown output contract, and nothing re-synchronizes them.

**Root cause, one sentence:** `disciplines.json`'s `out_of_context` list is a hand-maintained enumeration authored before 3.4 produced `retained-records/`, and no invariant forces it to stay a superset of 3.4's declared outputs — so a legitimate new 3.4 artifact became an unowned corpus file that hard-blocks the 4.1 gate.

## The bug in one diagram

```
3.4 OUTPUT CONTRACT (grew over time)              4.1 INPUT MAP (disciplines.json — static, hand-maintained)
──────────────────────────────────────           ─────────────────────────────────────────────────────────
 #767/#769 (2026-07-27)                            out_of_context = [ portal-recipes.md,
   3.4 emits: *.md researcher files,                                  3.4/_spawn/, 4.1/_spawn/ ]
   orientation-reconcile.md, portal-recipes.md  ◄── owns everything 3.4 emitted AT AUTHORING TIME  ✓
   _spawn/ ...

 #821 (2026-07-29, TWO DAYS LATER)
   3.4 ALSO emits:
     retained-records/               ─────────►   (not listed in ANY tier)   ✗ UNOWNED
     retained-records-manifest.json  ─────────►   (not listed in ANY tier)   ✗ UNOWNED

SIR 4.1 close (check_disciplines.py :583 iterates research_dir children; :591 flags orphans)
   check_input_map → "retained-records/ … is in the research corpus but no discipline full-reads it,
                      common_inputs does not carry it and out_of_context does not exclude it"  ✗
        → checks.input_map = failed  → checks.contract = failed
        → pipeline.yaml step 4.1 health_requires `checks.input_map: [ok]` (line 759, NO tolerance)
        → runner `verify` REFUSES to record 4.1 complete   ⛔ GATE BLOCKED
```

The two `✗ UNOWNED` rows are the whole bug. Everything the check does after them is correct behavior on an out-of-date map.

## Symptom (as observed)

- **Run:** `~/noetic/working/sir/noetic/grocery-atlanta/2026-08-05-062129`, step `4.1-disciplines`, at close.
- **What the checker printed** (`check_disciplines.py … --json`):
  ```
  [4.1] contract: failed
  [4.1]   input_map: failed
  [4.1] FAIL: input map: output/3.4-research-site/retained-records/ is in the research corpus but no
        discipline full-reads it, `common_inputs` does not carry it and `out_of_context` does not
        exclude it — an unowned research file is a file whose evidence reaches nobody. Give it to the
        discipline it belongs to, or exclude it and say why
  [4.1] FAIL: input map: output/3.4-research-site/retained-records-manifest.json is in the research
        corpus but no discipline full-reads it …
  ```
  Every other check was green (`finding_fields`, `headlines`, `handoffs` ok; `guide_coverage: mismatch-flagged` and `site_geometry: divergences-flagged` are separately-accepted flags). `input_map` was the **sole** hard failure.
- **Consequence:** `contract: failed`; `verify` cannot record the step, because step 4.1's `health_requires` (`pipeline.yaml:759`) asserts `checks.input_map: [ok]` with no accepted alternate value — unlike `guide_coverage: [ok, mismatch-flagged, partial]` and `site_geometry: [ok, divergences-flagged]`, which tolerate their degraded states. **The run stopped at the 4.1 gate until a Bureau roster edit landed.**
- **Tempting-but-wrong first guess:** "the run produced a stray/garbage file in 3.4." It didn't — `retained-records/` and its manifest are *first-class, schema-defined 3.4 outputs* (`schemas/retained-records-manifest.json`; `prompts/3.4-research-site.md:136-149`). The run did exactly what 3.4 tells it to; the 4.1 map is what is stale.

## Evidence chain

1. **The input map is enforced as a completeness invariant.** `check_disciplines.py:502` `check_input_map`; at `:583` it iterates `research_dir(run_dir).iterdir()` and at `:591` flags any child not covered by `common_inputs`, `out_of_context`, or some discipline's `primary_inputs`. The function docstring names this exact scenario as a known hazard: *"3.4 grows a research file (or renames one) that NOBODY owns … is exactly how a whole file's evidence stops reaching any discipline."*

2. **`retained-records/` + manifest are defined 3.4 outputs, added after the map was authored.** They enter via `git log 99d2d6753` = **#821 `feat(sir 3.4): a document a leg names by number is kept, or is a gap that names it`, dated 2026-07-29**. The input map was authored in **#767 (2026-07-27) / #769 (2026-07-27)** and last touched by #790 / #827 — **none of which added `retained-records`.** So the 3.4 output post-dates the map by two days and the map was never reconciled.

3. **The block is hard, not a degrade.** `pipelines/sir/pipeline.yaml:759` → `checks.input_map: [ok]`. Compare the *tolerant* requirements in the same step: `checks.guide_coverage: [ok, mismatch-flagged, partial]` and `checks.site_geometry: [ok, divergences-flagged]`. `input_map` has no such escape value, and `checks.contract: [ok]` fails whenever any sub-check fails — so `verify` cannot pass.

4. **`verify` reads the recorded health, so the only way through is to make the check genuinely pass.** `lib/pipeline_runner.py` `cmd_verify` (≈:1385/:1402) reads `_health.json` and asserts `health_requires` against the recorded values; it does not re-run the checker. But the recorded `input_map` value has to be legitimately `ok`, i.e. produced by a checker run against a roster that owns the files — you cannot honestly record `ok` while the map is stale.

5. **Older runs did not hit it (control).** The Louisville run `~/noetic/working/sir/hutton/car-wash-louisville-ky/2026-08-01-083311` has **no** `output/3.4-research-site/retained-records*` and never recorded a 4.1 `_health.json` — its 3.4 predates/omits the retained-records artifacts, so the orphan never arose there. The bug surfaces only once a run's 3.4 actually emits the #821 artifacts.

6. **Live `main` still carries the gap (control).** `grep -c retained-records bureau/pipelines/sir/4.1-disciplines/disciplines.json` on `main` = **0**. The fix currently lives only on the PR #951 branch.

## Root cause

`bureau/pipelines/sir/4.1-disciplines/disciplines.json` → `out_of_context` is a hand-maintained enumeration of the 3.4 artifacts no discipline reads. It was authored (#767/#769) to cover 3.4's output set *as it existed then* — `portal-recipes.md`, the `_spawn/` dirs. When #821 grew 3.4's output contract to include `retained-records/` and `retained-records-manifest.json`, the map was not updated, so those two became corpus children owned by no tier.

The missing invariant: **nothing asserts that the 4.1 input map is a superset of 3.4's declared output contract.** The completeness check runs only at 4.1 *run time*, against whatever files a given run happened to produce — so a new 3.4 output ships green through 3.4's own contract check, and only detonates later, at the 4.1 gate of the first run that produces it. The map and the 3.4 schema are two enumerations of the same corpus with no link between them; they drift silently until a run steps on the gap.

This is the structural twin of the `el` guide-swap bug: a per-run stop-flag whose real cause is a **systemic Bureau content/config artifact that no author-time guard defends.** The difference is severity of the stop: the `el` swap *degrades* (loud but non-blocking); this one *hard-blocks* the gate.

## Impact

- **Every current SIR run, at the 4.1 gate (affected, deterministic, blocking).** Any run whose 3.4 emits the retained-records artifacts — the standard path post-#821 — hard-fails `input_map` and cannot `verify` step 4.1 until a Bureau roster edit lands. This is a **full stop**, not a warning: it halts the pipeline mid-run and forces an out-of-band edit to shared Bureau config to proceed.
- **Operator experience (affected).** The failure reads as a run defect ("an unowned research file"), so the natural first move is to hunt for a bad file in the run output — when the actual fix is a two-line addition to shared config in a *different repo*. On grocery-atlanta this cost a full diagnosis detour and a cross-repo PR before 4.1 could close.
- **The `bgIsolation` guard compounds it in background/HITL sessions (affected).** Because the fix is an edit to the git-tracked Bureau checkout, a background agent hits the isolation guard and must spin up a worktree + PR just to unblock a single run — turning a two-line config gap into source-control ceremony on the critical path.
- **Nothing downstream is corrupted (unaffected).** `retained-records/` is a retrieval byproduct; the site facts inside it already reach disciplines through the researcher `.md` syntheses that cite them (and that *are* full-read). The correct resolution is to *exclude* it, so no discipline reading changes and no id/citation shifts. This is a low-blast-radius config fix.

**Deterministic:** yes — fires whenever 3.4 emits the retained-records artifacts. **Logged when it fires:** yes, loudly, at the 4.1 check — but as a run-level "unowned file" error, not as "the shared roster is stale," so the diagnosis burden lands on the operator every time until the root fix ships.

Cheap detector (run against any completed run):
```bash
python3 bureau/pipelines/sir/4.1-disciplines/check_disciplines.py \
  --step-dir <run>/output/4.1-disciplines --run-dir <run> 2>&1 | grep 'input map:.*retained-records'
```

## Fix directions (directions for the implementing agent, not a mandate)

1. **Shallow fix (in flight — Bureau PR #951): own the two artifacts.** Add `output/3.4-research-site/retained-records/` and `output/3.4-research-site/retained-records-manifest.json` to `disciplines.json` `out_of_context`, each with a `why` (they are raw retrieval captures + a records census; the site facts already reach disciplines via the researcher syntheses that cite them; addressed to 4.2 gap recovery and the 4.4 records census). Mirrors how `portal-recipes.md` and the `_spawn/` dirs are already excluded. **No discipline reading changes.** This unblocks the gate but does not stop the *next* 3.4 output from re-opening it.
2. **Durable fix (the missing invariant): make the map track the 3.4 contract at author time.** Add a Bureau lint / `validate` step that asserts the 4.1 input map is a superset of 3.4's declared output set — i.e. for every artifact 3.4's schema/prompt declares it can emit, `disciplines.json` either feeds it (common/primary) or excludes it (`out_of_context`). This converts a run-time-only, first-run-detonates failure into an author-time gate the moment 3.4's output contract grows, so no future 3.4 addition can silently hard-block 4.1. This is the analog of the "author-time `## Domain` lint" recommended for the `el` swap.
3. **Consider a softer default for genuinely-new corpus files.** Optional: rather than hard-fail, `check_input_map` could *degrade* (not block) on an unowned NEW artifact while still demanding it be classified before the gate closes — trading the hard stop for a loud warning the operator resolves at 4.4. Weigh against the check's intent (an unowned file is how evidence silently reaches nobody, which is exactly what it must not allow to pass quietly). Keep the hard stop for `primary`/`common` orphans; the softening, if any, is only for the exclude case.

## Prior art

- **The check already documents this hazard** — `check_input_map`'s docstring calls out "3.4 grows a research file that NOBODY owns" as one of the two ways a map goes wrong. The mechanism was foreseen; only the author-time guard against it is missing.
- **`portal-recipes.md` / `_spawn/` are the reference exclusions.** They are the pattern the retained-records entries follow: real 3.4 artifacts that carry no determination-bearing site fact and are therefore `out_of_context` with a stated reason. Diff PR #951 against those entries to see the intended shape.
- **Sibling bug:** `LOUISVILLE-EL-FEASIBILITY-GUIDE-DISCIPLINE-SWAP.md` (same directory) — same shape (per-run flag, systemic Bureau root cause, missing author-time guard), different severity (degrade vs. hard block).

## Reproduction / verification recipe

Cold-start, no prior context:

1. **Confirm the artifacts are defined 3.4 outputs:**
   `grep -n retained-records bureau/pipelines/sir/prompts/3.4-research-site.md` → the manifest + `retained-records/` are prescribed (≈:136-149); `ls bureau/pipelines/sir/schemas/retained-records-manifest.json` exists.
2. **Confirm the map on `main` omits them:**
   `grep -c retained-records bureau/pipelines/sir/4.1-disciplines/disciplines.json` → **0**.
3. **Confirm the timeline (map predates the output):**
   `git -C bureau log -1 --format='%ci %s' 99d2d6753` (retained-records, 2026-07-29) vs `… eceb61337` (input map, 2026-07-27).
4. **Reproduce the hard fail on a run that has the artifacts:**
   `python3 bureau/pipelines/sir/4.1-disciplines/check_disciplines.py --step-dir <run>/output/4.1-disciplines --run-dir <run>` where `<run>/output/3.4-research-site/retained-records-manifest.json` exists → prints `input_map: failed` + the two `retained-records` FAIL lines, and `contract: failed`.
5. **Confirm the block is non-tolerant:**
   `grep -n 'checks.input_map\|checks.site_geometry\|checks.guide_coverage' bureau/pipelines/sir/pipeline.yaml` in the 4.1 step → `input_map: [ok]` (no alternate) vs. the tolerant values on the other two.

**Acceptance test for the eventual fix:** (a) with PR #951 merged, step 2 prints `2`, and re-running step 4 on the same run returns `input_map: ok` / `contract: ok`; (b) with the durable guard (fix 2) in place, adding a new declared 3.4 output *without* classifying it in `disciplines.json` fails an author-time lint, before any run reaches the 4.1 gate.
