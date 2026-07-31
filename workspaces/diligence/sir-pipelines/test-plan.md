# SIR Pipeline — Cold-Start Test Runbook

**Status:** Draft v1
**Date:** 2026-07-31
**For:** a fresh Claude Code agent with **zero prior context**, tasked with validating that the
new bureau SIR pipeline actually runs on a local machine.
**Companion to:** `architecture-overview.html` (read Tab 3 first for how the pipeline is shaped).

---

## Mission (one paragraph)

The new SIR pipeline (`bureau/pipelines/sir/`, 19 steps, §1.1→5.7) is **merged to `bureau/main`
and statically valid** — `validate sir` passes. It has run end-to-end **exactly once** (the
Circle-K / Odessa pilot, on Jason's machine). Your job is **not** to produce a customer SIR. It is
to answer, cheaply and in order: *does the runner drive real steps on this machine, are the
external couplings wired, and where does it break?* You escalate from zero-token static checks to
read-only verification to a single cheap re-run, and you **stop at the gate** before anything that
costs real money or a full run — a human authorizes that, not you.

---

## 0. Ground rules — read before touching anything

1. **`bureau` is a nested, gitignored repo.** `git` from `~/noetic` shows you nothing about the
   pipeline. Always `cd ~/noetic/bureau` first. Confirm you're on `main` and clean.
2. **⛔ No firing without a green light.** Tiers T0–T3 are read-only / near-free and you run them
   yourself. **T4 (single-step re-run) and T5 (fresh run) consume real subscription capacity
   and/or metered spend and MUST NOT start until the operator says "go" on the specific step.**
   Never kick off a run to "see what happens."
3. **Never mutate the pilot run tree.** If you re-run a step against pilot data, do it against a
   **copy** (`cp -r`). The pipeline's own discipline is patch-never-wipe (`_superseded-*` +
   `corrections[]`); honor it — preserve originals, never overwrite in place.
4. **Model discipline.** Sub-agents inherit the parent model. Name the model explicitly at every
   spawn. Steps declare their own tier (`list sir` shows it: 1.1=sonnet, most =opus); don't
   override without reason.
5. **You are driving the runner directly, as a single session.** You do **not** need the Mayor
   fleet harness to test — the Mayor only matters for parallel multi-session orchestration. One
   agent + `pipeline_runner.py --step-through` is the right test rig.
6. **Record as you go** (see §7). A cold successor should be able to pick up from your findings
   file alone.

---

## 1. Orientation — read these first (in order)

| # | File | Why |
|---|------|-----|
| 1 | `bureau/docs/pipelines/sir.md` | The human-authored pipeline spec — the §1–§7 topology and contracts. |
| 2 | `bureau/pipelines/sir/KICKOFF.md` | **How a run is started** — the operator entry point. Read this for how to seed step 1.1 and where run trees live. |
| 3 | `bureau/pipelines/sir/master-plan.md` | The build/run narrative for the pipeline. |
| 4 | `architecture-overview.html` (this workspace), Tab 3 | Visual of the step chain + runner model + what's built/left. |

Then get the runner's own view:

```bash
cd ~/noetic/bureau/pipelines
python3 lib/pipeline_runner.py --help          # subcommands: validate list verify checkpoint ack reconcile run
python3 lib/pipeline_runner.py list sir        # every step: model, prompt, declared outputs+schemas, requires, health
```

---

## 2. The fork that decides your whole run: is a completed run tree available?

`~/noetic/working/` **does not exist on a fresh machine** — there are no run trees locally,
including the pilot. This determines your path:

- **Scenario A — you can obtain the pilot tree.** Ask the operator to copy Jason's pilot run
  (`~/noetic/working/sir/circle-k/university-w-odessa-tx/2026-07-20-075843/`) to this machine, or
  point you at a shared copy. **Strongly preferred:** it makes T3 (read-only verify) and T4 (cheap
  re-run) possible without paying for a fresh §1–§4. Confirm the copy has each step's
  `output/<step>/_health.json`.
- **Scenario B — no pilot tree obtainable.** You skip to T5 (a fresh run), which is expensive and
  fully gated. Do **not** treat "no pilot tree" as license to start a fresh run on your own — it
  raises the authorization bar, it doesn't lower it.

**Report which scenario you're in before proceeding past T2.**

---

## 3. The tiered plan

### T0 — Static validation (zero tokens, do immediately)
```bash
cd ~/noetic/bureau && git status -sb                     # on main, clean
cd pipelines
python3 lib/pipeline_runner.py validate sir              # expect: OK: sir (19 step(s) valid)
python3 lib/pipeline_runner.py list sir                  # eyeball step models, requires lineage, outputs
```
**Pass =** `validate` clean, 19 steps, only `6.1` shows as planned. **This is already known to
pass** — if it doesn't, your checkout or Python env is wrong; fix that before anything else.

### T1 — Environment & coupling preflight (near-zero tokens)
The runner and step prompts reference these env vars — confirm each points at a real dir on this
machine:

| Env var | Points at | Needed for |
|---|---|---|
| `NOETIC_BUREAU_DIR` | the `bureau` repo | everything |
| `NOETIC_DSD_DIR` | the `dsd` repo (RDS renderers) | §5 render (5.3 PDF, 5.5 DOCX) |
| `NOETIC_SURVEYOR_DIR` | the `surveyor` repo | 3.3 surveyor |
| `NOETIC_CLAUDE_PLUGINS_DIR` / `NOETIC_SKILLS_DIR` | `claude-plugins` + skills | parcel-geo (1.2), shared research |
| `NOETIC_RENDER_PDF` / `NOETIC_RENDER_DOCX` / `NOETIC_PHASE_LOG` | render + log hooks | §5 |

Also verify: **subscription Claude accounts** are configured (the pipeline is subscription-first);
**Gemini access** for 2.1 vision (the one metered exception); the **MCP tools** the steps expect
are reachable. Grep the step prompts for hard dependencies rather than assume:
```bash
grep -rhoE "NOETIC_[A-Z_]+" ~/noetic/bureau/pipelines/sir/ | sort -u
```
**Pass =** every referenced repo/tool resolves. Missing couplings here are the most likely reason a
real step fails later — record them now, don't discover them mid-run.

### T2 — Locate / obtain a run tree
Execute the §2 fork. If Scenario A, get the pilot copied and confirm `_health.json` per step. If
Scenario B, stop and escalate for T5 authorization.

### T3 — Read-only verify against the pilot (Scenario A only, zero new tokens)
`verify` asserts a completed step produced what it declared — it reads, never regenerates.
```bash
PILOT=~/noetic/working/sir/circle-k/university-w-odessa-tx/2026-07-20-075843   # or wherever the copy landed
cd ~/noetic/bureau/pipelines
for s in 1.1 1.2 2.1 3.3 3.4 4.1 4.2 5.7; do
  echo "── verify $s ──"
  python3 lib/pipeline_runner.py verify --step "$s" --run-dir "$PILOT" sir
done
```
**Pass =** each step verifies green against the pilot's own artifacts. **This is the cheap
rehearsal the pipeline PLAN asks for before any live run** — several upstream gates (retention,
geometry sidecar) were added *after* the pilot and have never fired in anger; this is where you
learn which are newly fatal. Record every non-green verdict with the exact step + message.

### T4 — Single-step re-run against a COPY of the pilot ⛔ (needs operator "go")
Pick **one cheap, read-heavy step** to prove the runner actually drives an agent step end-to-end —
e.g. a §4 audit/synthesis step or a §5 scrub, **not** a fan-out. Never against the live pilot:
```bash
cp -r "$PILOT" ~/noetic/working/sir/_TEST-COPY-$(date +%s)      # work on the copy
# then, ONLY after the operator authorizes the specific step:
python3 lib/pipeline_runner.py run --step <id> --run-dir <the copy> --step-through sir
```
`--step-through` makes it pause for your `ack` (go/stop) rather than barreling ahead. **Pass =** the
step runs, writes its `output/<step>/` + `_health.json`, and `verify` on it is green — proving the
runner spawns the right model, the couplings work, and the health contract closes. Preserve the
original via the copy; do not touch the pilot.

### T5 — Fresh end-to-end run ⛔⛔ (needs explicit operator authorization + a chosen site)
Only if the operator wants a true cold run. This is the real test of §1–§4 (unre-run since the
pilot) and the two HITL gates. Choose a **small, simple site** (the operator picks it). Drive it
**step-through**, watching §1–§4 rather than treating it as hands-off:
```bash
python3 lib/pipeline_runner.py run --step 1.1 --step-through sir   # seed per KICKOFF.md (--input …)
# advance one step at a time; at 3.2 (HITL1) and 4.4 (HITL2) the runner stops for a human decision:
python3 lib/pipeline_runner.py checkpoint --step 3.2 --run-dir <dir> --decision <…> sir
```
**Pass =** reaches a packaged §5.7 deliverable (PDF + DOCX + supporting-documents/) with each step
verify-green, or a clearly-diagnosed stop with the failing step + reason. **Expect to babysit
§3–§4** and to hit at least one newly-fatal gate; that's the point of the exercise.

---

## 4. Success criteria (what "the pipeline works locally" means)

| Tier | Claim it proves | Green looks like |
|---|---|---|
| T0 | The pipeline is structurally valid on this checkout | `validate sir` OK, 19 steps |
| T1 | The external couplings are wired | every `NOETIC_*` repo + Gemini + MCP resolves |
| T3 | The completed pilot artifacts satisfy every current contract | all `verify` green against pilot |
| T4 | The runner drives a real agent step + closes its health contract | one step re-run green on a copy |
| T5 | §1–§4 re-run clean and the gates fire correctly | a fresh deliverable, or a diagnosed stop |

You do **not** need T5 to declare a useful result. **T0–T3 green + T4 green on one step** already
answers "is the merged pipeline executable and wired on this machine" — which is the actual
question. T5 is the stretch goal and the most expensive.

---

## 5. What to record, and where

Write findings to **`working/sir-pipeline-local-test-findings.md`** in this same winston workspace
(`workspaces/diligence/sir-pipelines/`), landed via the same PR flow. Capture:

- Which **scenario** (A/B) and why.
- **T0/T1 results:** validate output; the full `NOETIC_*` resolution table with ✓/✗ per coupling.
- **T3 verify matrix:** step → green/amber/red → exact message for any non-green.
- **T4:** which step, the command, the `_health.json` verdict, anything that surprised you.
- **T5 (if run):** the site, per-step outcome, where it stopped, the deliverable path + page count.
- A blunt **"is it executable locally?" verdict** with the top 1–3 blockers if not.

Keep it terse and machine-parseable where you can — a successor reads it cold.

---

## 6. Known traps (from the pipeline PLAN/FACTS — don't re-learn these)

- **Nested repo:** git from `~/noetic` is blind to bureau. Always `cd bureau` first.
- **Metered path is a trap:** a bare model alias gets a 200K window and **fails every 4.1 pass**
  (guides alone exceed it). The pipeline is subscription-first for a reason — don't route a step
  through a metered bare-alias to "make it work."
- **`--model opus` must be explicit** on any session/sub-agent you spawn; a bare invocation
  inherits Fable (~3× drain).
- **Steps are re-runnable but lineage is enforced:** `run` refuses a step until its `requires:` are
  complete/skipped. `skip_when` supports exactly one predicate (`empty_array`) — partial runs are
  lineage edits, not ad-hoc skips.
- **`verify` ≠ a clean run.** Verify only asserts a completed step's declared outputs exist and
  satisfy their schema/health contract; it does not prove the step would re-run green.
- **Contamination guard:** discipline/research steps carry a rule barring certain jurisdiction
  tools (e.g. a city's comment-report endpoint) — don't disable it to unblock a step.

---

## 7. Verified command reference (confirmed working 2026-07-31)

```bash
cd ~/noetic/bureau/pipelines
python3 lib/pipeline_runner.py validate sir                              # → OK: sir (19 step(s) valid)
python3 lib/pipeline_runner.py list sir                                  # step catalog
python3 lib/pipeline_runner.py verify --step <id> --run-dir <dir> sir    # read-only assertion
python3 lib/pipeline_runner.py run   --step <id> [--run-dir <dir>] [--runs-root <root>] \
        [--jurisdiction <j>] [--input K=V] [--step-through] [--disciplines <csv>] sir
python3 lib/pipeline_runner.py checkpoint --step <id> --run-dir <dir> --decision <…> sir   # close a HITL gate
python3 lib/pipeline_runner.py ack --step <id> --run-dir <dir> sir       # go/stop in a step-through run
```
Subcommands available: `validate · list · verify · checkpoint · ack · reconcile · run`.
(Exact `run`/`checkpoint` flags: confirm against `--help` and `KICKOFF.md` before T5 — the seed
inputs for 1.1 come from KICKOFF, not from this doc.)
