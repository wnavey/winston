# Diligence-Report Skill Execution in field-agent

> **Status (2026-06-03):** Phase 2-A.2 **built and merged** — field-agent
> [#8](https://github.com/noetic-inc/field-agent/pull/8) (`invoke.ts` + in-process
> runner, fire-and-handoff), [#9](https://github.com/noetic-inc/field-agent/pull/9)
> (observability / `run-summary.json`), [#11](https://github.com/noetic-inc/field-agent/pull/11)
> (intake-attachment download for vision). **In validation:**
> [#10](https://github.com/noetic-inc/field-agent/pull/10) (minimal kickoff — the
> fan-out fix) is under test against a real run. This doc is now the **as-built
> design + findings from the first real runs**, not a forward design.
>
> **Scope:** how field-agent runs the real `noetic-tools:diligence-report` skill
> headlessly to produce the Site Intelligence Report + Research Appendix,
> replacing the dummy renderer shipped in 2-A.1.
>
> **Companion docs:** [`implementation-plan.md`](./implementation-plan.md)
> (overall field-agent roadmap), and cityhall
> `docs/feasibility-research-runner.md` (the canonical cross-repo feature spec).

---

## TL;DR

field-agent does **not** clone or reimplement the diligence-report skill. It
**invokes the shared skill in place** via `@anthropic-ai/claude-agent-sdk`,
loading the `noetic-tools` plugin and pointing it at a per-run working
directory. field-agent owns the **harness** — assembling inputs from the
feasibility intake, configuring paths/env, driving the SDK session, and handing
the produced PDFs to the existing upload/insert pipeline. The skill remains the
single source of truth in claude-plugins, used by both interactive (dsd) and
headless (field-agent) callers.

---

## Architecture decision: invoke the shared skill (Model A)

Three models were considered:

| Model | Description | Verdict |
|---|---|---|
| **A — invoke in place** | Load the claude-plugins `noetic-tools` plugin via the SDK and trigger `/diligence-report`. Skill stays one copy. | ✅ **Chosen** |
| B — clone & own | Vendor the skill into field-agent and own it outright. | ❌ Rejected — the skill is large (28 prompts + references + templates) and actively evolving; a fork would drift and double maintenance. |
| C — shared + headless overlay | Model A plus a field-agent "headless harness" that pre-resolves human-gates. | ➡️ A naturally trends toward this; the harness lives in field-agent, the skill body stays shared. |

**Why A:** the skill's value is the research methodology, not something to fork.
field-agent's job is the harness. The path-configurability work (claude-plugins
[#9](https://github.com/noetic-inc/claude-plugins/pull/9)) is what makes one
skill serve both callers — and it also cleaned up the interactive setup's
hardcoded paths as a bonus. Model B only wins if field-agent's diligence
behavior must *intentionally diverge* from the interactive skill; it does not.

---

## How invocation works

### The SDK call

`@anthropic-ai/claude-agent-sdk@0.2.74`'s `query({ prompt, options })` returns an
async iterable of messages. As built in `src/skill/`:

- **`runner.ts`** — an in-process semaphore (`enqueueDiligenceRun`, default
  concurrency `1`). The Inngest function acks and hands off here; the runner is
  the real throughput gate (see the long-step ADR).
- **`invoke.ts`** — `runDiligenceSession(runId)`: dup-guard (skip if the row
  isn't `queued`) → download attachments (best-effort, vision-gated) → mark
  `running` → `query()` → collect deliverables → reuse `upload.ts`/`insert.ts` →
  terminal status → write `run-summary.json`. Never throws.

```ts
const q = query({
  prompt: buildKickoffPrompt(intake, paths),          // kickoff.ts (minimal — see below)
  options: {
    plugins: [{ type: 'local', path: paths.noeticToolsPlugin }],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    cwd: paths.workdir,                                // field-agent/workspace/<runId>
    maxTurns: 400,                                     // runaway guard (env-overridable)
    env: buildSessionEnv(paths),                       // ← default-deny allowlist, NOT process.env
  },
});
```

> ⚠️ **`env` is a default-deny allowlist, not a `process.env` spread.** An
> earlier draft (and an earlier version of this doc) spread all of `process.env`
> into the session — which leaks `SUPABASE_SERVICE_ROLE_KEY`, `INNGEST_SIGNING_KEY`,
> etc. into a `bypassPermissions` agent that can read them via shell. PR #8's
> review caught this. `buildSessionEnv` (in `paths.ts`) passes **only** an
> operational allowlist (`PATH`, `HOME`, locale, `CLAUDE_CONFIG_DIR`,
> `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) + the resolved `NOETIC_*` paths. Host
> secrets are withheld. The `NOETIC_*` vars are load-bearing for the skill's
> shell commands — see Paths below.

`cwd`, `plugins`, `permissionMode: 'bypassPermissions'`, `allowDangerouslySkipPermissions`,
`maxTurns`, and `env` are all real `0.2.74` fields. **Pin the SDK to `0.2.74`** —
the API is pre-1.0 and the public docs lag the installed types.

### SDK message shapes (learned from spikes)

- **init** (`type:'system', subtype:'init'`) exposes `skills[]`, `plugins[]`,
  `slash_commands[]`, `tools[]`, `mcp_servers[]`, `agents[]` — the authoritative
  "what loaded" signal.
- **assistant** messages carry `message.content[]`; `tool_use` blocks have
  `.name` (`Bash`, `Write`, `Agent`/Task, `WebFetch`, …) + `.input` — useful for
  progress logging / heartbeats.
- **result** message has `.result` (final terminal text), `.subtype`, and
  `total_cost_usd` — capture the latter onto `diligence_runs` for cost
  observability (a full run is token-heavy).
- `listSubagents` / `getSubagentMessages` — *unconfirmed against 0.2.74 types;
  verify before relying on them.* Non-load-bearing (fan-out inspection only).

### Auth

Spike A confirmed the SDK *will* authenticate via the host's logged-in `claude`
CLI credentials with **no `ANTHROPIC_API_KEY`**. That works locally, but it
depends on interactive login state (brittle on a headless VM) and Anthropic's
published guidance is to use API-key auth for SDK use.

**Current decision: stay on CLI-credential auth for now** (explicitly deferred
`ANTHROPIC_API_KEY` — the real runs are on a logged-in dev box). The
recommendation for Phase 3 stands: set `ANTHROPIC_API_KEY` on the always-on
worker (ToS-clean, no dependency on interactive CLI login). `buildSessionEnv`
already passes `ANTHROPIC_API_KEY` through if set. See
[`diligence-report-skill-execution-host-provisioning.md`](./diligence-report-skill-execution-host-provisioning.md#auth-prefer-an-explicit-api-key).

### Kickoff prompt — keep it MINIMAL (the single-threaded finding)

**The biggest lesson from the first real run.** `kickoff.ts` (`buildKickoffPrompt`)
assembles three things only:
1. the captured intake facts (`load-intake.ts` → `document_section` rows),
2. the run's **actual** bureau/surveyor paths + working root, and
3. one **autonomy directive** ("no human — never pause; record unknowns as
   data-gaps").

It deliberately does **nothing else** — it lets the skill's own
`SKILL.md`/`pipeline.md` drive orchestration.

**Why:** the first real run (`8ac7…`) **completed but ran single-threaded** — `0`
`Task` subagents, a flat `intermediate/research-findings.md` instead of the
8 `phase2-research/` + 10 `phase3-disciplines/` + `synthesis/` outputs, and a
13pp SIR vs. the 25–40pp spec. A diagnostic confirmed the `Task` tool **was
available** under our exact config (119 tools in the init list) — so the cause
was our **kickoff over-constraining**: framing like "Tier 1 — address-only, skip
Phase 1, degrade to data-gap, no attachments" told the model to do *less*, and
it skimmed inline instead of fanning out. PR #10 strips that suppressive framing
to the minimum above. (Validation of the fix is in flight.)

**Two parts of the kickoff are load-bearing and must stay:**
- The **autonomy directive** — the skill has human-gates ("ask the user",
  "escalate"); headless, it must be told not to wait or it stalls. This governs
  human-gates, not orchestration depth.
- The **bureau/surveyor absolute paths.** The `NOETIC_*` env vars only resolve
  the skill's *shell* commands (`${NOETIC_SURVEYOR_DIR:-…}`). The model's own
  `Read`/`Glob` of external dirs takes a *literal* path — it won't expand
  `$NOETIC_BUREAU_DIR`, and the skill's `~/noetic` default doesn't exist on
  field-agent — so the actual paths must be stated or the model can't find the
  feasibility-guides. (Removing this block briefly was a mistake; restored.)

**General rule for porting skills to a headless SDK driver:** supply inputs +
autonomy, then get out of the way. Suppressive/efficiency framing reads as
"do less" and collapses the skill's intended fan-out.

### Output handoff — reuses 2-A.1

The skill writes `workdir/sir/deliverable/{site-intelligence-report,research-appendix}.pdf`.
`collect-artifacts.ts` reads those into Buffers (the **SIR is required** — throws
if missing) and reuses the **existing** `src/artifacts/upload.ts` + `insert.ts`.
Only the *source* of the PDFs changes (real skill vs. dummy renderer) — the
upload/insert/sign/UI loop is unchanged. Surfacing the skill's copied
`supporting-documents/*.pdf` as `supporting_document_copy` artifacts is
**deferred** (needs the `diligence_artifacts` unique index to move from
`(run_id, kind)` → `(run_id, storage_path)` since a run can have several).

### Attachments & vision (PR #11)

When the intake conversation has attachments (concept plan, plats),
`attachments.ts` downloads the vision-relevant ones (`.pdf/.png/.jpg`) via
`chat_message → chat_message_attachment → document_version` into
`workdir/sir/source-pdfs/` so the skill's Phase 1 vision + §9 run. **Gated on
`visionReady()`** — `pdftoppm`/`magick` on PATH **and** `GEMINI_API_KEY` set
(Phase 1 hard-fails without them). If the host can't do vision, or the step
errors, it's **recorded as a note in `run-summary.json` and the run proceeds
without local Phase 1** — never blocked (the intake already extracted those docs
once). The whole step is best-effort. No kickoff change is needed — populating
`source-pdfs/` is enough; the skill discovers it.

### Observability (PR #9)

`run-summary.json` in the run's workdir captures, on success **and** failure:
`session_id` (→ the SDK transcript at `~/.claude/projects/<cwd>/<id>.jsonl`),
`result_subtype`, `num_turns`, `total_cost_usd`, `usage`, a **tool-use
histogram**, `deliverables`, and `notes[]`. This is what surfaced the
single-threaded finding (the histogram showed `0` `Task` calls). It's run-level
only — per-subagent attribution + a filesystem phase-inventory are open
follow-ups.

---

## Paths & environment model

The skill resolves all durable locations from env vars (claude-plugins
[#9](https://github.com/noetic-inc/claude-plugins/pull/9)), defaulting to
`~/noetic/*` when unset. field-agent sets them explicitly.

| Variable | field-agent value | Skill default (interactive) |
|---|---|---|
| `$NOETIC_DILIGENCE_DIR` | `field-agent/workspace/<diligenceRunId>` (the `cwd`) | `~/noetic/diligence/<property-slug>` |
| `$NOETIC_BUREAU_DIR` | `../bureau` (resolved abs) | `~/noetic/bureau` |
| `$NOETIC_SURVEYOR_DIR` | `../surveyor` (resolved abs) | `~/noetic/surveyor` |
| `$NOETIC_PDF_DIR` | `../claude-plugins/plugins/noetic-tools/noetic-pdf` | same under `~/noetic` |

Two resolution paths, **both** needed:
- **Prose references** in the skill (`Load $NOETIC_BUREAU_DIR/...`) are resolved
  by the agent via the documented convention + the kickoff prompt.
- **Executed shell commands** use `${VAR:-$HOME/noetic/...}` expansion, so they
  need the **real env var exported** to override the default. → field-agent
  must pass `env` (or set `process.env`) on the SDK session, not just mention
  paths in the prompt.

### Working directory

- `field-agent/workspace/<diligenceRunId>/` — per-run root, **gitignored**
  (`workspace` added to `field-agent/.gitignore`). It's the untracked output of
  runs; the deliverables are uploaded to Supabase, not committed.
- bureau / surveyor / claude-plugins are assumed to be **sibling checkouts** of
  field-agent (`../bureau`, etc.) — no hardcoded absolute paths.

---

## What the spikes proved (2026-06-02)

All run headless against the host's `claude` CLI auth, loading the real
`noetic-tools` plugin. Throwaway scripts lived in `/tmp/diligence-spike/`.

| Spike | Validated | Result |
|---|---|---|
| **A** | SDK loads the plugin headless; discovers `diligence-report`; clean terminal message; `bypassPermissions` works; auth via CLI creds (no API key). | ✅ |
| **B** | Parallel `Agent`/Task subagents headless; `Bash` shell-out (surveyor repo reachable); web I/O (`WebFetch`). | ✅ |
| **C** | A **real minimal skill invocation**: cwd path-override holds (writes to workdir, **no `~/noetic` leak**); Phase 0 runs headless; a real discipline subagent fans out and writes a well-formed output. | ✅ |

**Conclusion:** the SDK mechanics the skill depends on — plugin/skill discovery,
parallel subagents, Bash shell-out, web I/O, cwd-scoped output — all work
headless. The port is de-risked at the orchestration level.

### What the spikes did NOT prove (open risks)

1. **agent-browser** isn't installed on the dev host (only Chrome.app). The
   skill's Phase 2 web research uses it (`npm i -g agent-browser && agent-browser
   install`). `WebFetch` worked as a *proxy*; agent-browser proper is unvalidated.
2. **No real surveyor run** (15–30 min, live county sites) — only confirmed the
   repo + Bash shell-out. surveyor also isn't checked out on every host yet.
3. **No full pipeline run** — spikes prove mechanics, not a 30–60 min, token-heavy
   end-to-end producing real PDFs.

---

## The skill's pipeline (recap)

6 phases the SDK session orchestrates internally (detail:
cityhall `docs/feasibility-research-runner.md` + the skill's own `pipeline.md`):

0. **Jurisdiction & feasibility-guide bootstrap** — detect jurisdiction; ensure
   `$NOETIC_BUREAU_DIR/jurisdictions/<slug>/feasibility-guides/` exist (derive/generate if not).
1. **Vision extraction** *(skip if no PDFs)* — dual-model (Gemini + Opus) over uploaded drawings.
2. **Research** — 8 parallel subagents incl. the **surveyor** shell-out (property records) + 7 web/research agents (agent-browser).
3. **Discipline analysis** — 10 parallel subagents (el, eptp, fire, fwp, park, sde, sduf, ta, wwp, zlu), each applying its feasibility-guide lens.
4. **Synthesis & gap recovery** — issue matrix; Bucket A/B/C gap classification.
5. **Render** — hand-author SIR `.tsx` + appendix → render via noetic-pdf → scrub pass → verify.

Communication substrate is the **filesystem** under `$NOETIC_DILIGENCE_DIR`
(each subagent reads/writes markdown). Outputs land in `sir/deliverable/`.

---

## Worker-host dependencies

Full provisioning detail, install commands, and a preflight verification script
live in
[`diligence-report-skill-execution-host-provisioning.md`](./diligence-report-skill-execution-host-provisioning.md).
Summary by run tier:

- **Tier 1 — address-only full run (first real-run target):** Node 22.4+,
  `ANTHROPIC_API_KEY`, `claude-plugins` + `bureau` checkouts, built `noetic-pdf`,
  pinned `claude-agent-sdk@0.2.74`. surveyor/web-dependent disciplines land as
  `data-gap` — an acceptable, honest first deliverable (confirmed in Spike C).
- **Tier 2 — full-fidelity / attachments (fast-follow):** surveyor checkout +
  creds, global `agent-browser` + Chrome, poppler/ImageMagick, Gemini key.

**Tier-2 tooling is explicitly a fast-follow, not a blocker for the first real
run.** One sharp edge to respect: the **§9 Concept Plan Review path needs
poppler/ImageMagick *and* a Gemini key** — when an attachment is present, Phase 1
renders pages to PNG and calls Gemini, and if either is missing it **fails
rather than degrading to a data-gap**. So Tier 1 must exclude attachments, and
the trigger should refuse/strip attachments until Tier 2 is provisioned.

---

## Open decisions & risks (before/during `invoke.ts`)

1. **Inngest long-running step — RESOLVED.** The Inngest function is a thin
   **ack** (validate → mark `running` → hand off → return); the 30–60 min skill
   session runs **outside Inngest step memoization** in the persistent worker
   process, and completion is tracked via `diligence_runs.status` + Supabase
   realtime (no completion event required). Consequences — in-process
   concurrency limit (Inngest `concurrency` no longer gates the heavy work) and a
   stuck-run reconciler (fast-follow). Full rationale + alternatives:
   [`diligence-report-long-step-adr.md`](./diligence-report-long-step-adr.md).
2. **Human-in-the-loop gates → autonomous policy.** The skill escalates to a
   human on multi-jurisdiction, ambiguous use, surveyor failures, contradictions,
   etc. Mitigations: (a) the intake chat gates the trigger on Tier-1 completeness
   (handles ambiguous-use upstream); (b) lean on the skill's own Bucket B
   ("verify at title / engineer to confirm") as the autonomous fallback.
3. **Attachment download — DONE (PR #11).** `intake_attachment` files are fetched
   into `workdir/sir/source-pdfs/`, vision-gated; see "Attachments & vision".
4. **Stuck-run reconciler — OPEN (fast-follow).** Fire-and-handoff trades away
   Inngest retry, so a crash/sleep mid-run leaves a row stuck `running`. Need a
   startup-reconcile + age-sweeper (per the ADR). Today it's a manual one-liner.
5. **Tool allowlist — OPEN.** The session inherits ~90 unrelated host MCP tools
   (Gmail/Slack/Supabase/Vercel/Noetic — 119 tools total). Restrict via
   `allowedTools` for a leaner/cheaper/safer autonomous surface.
6. **Per-subagent observability — OPEN (gated on the fan-out fix).** Hook-based
   (`PostToolUse`/`SubagentStart`) per-subagent tool attribution + labels; only
   meaningful once subagents actually fan out (PR #10 validating).
7. **Progress/status during the long run — OPEN.** The UI sits at `running` for
   30–60 min; stream `tool_use`/phase markers to a `diligence_runs` column.
8. **`supporting_document_copy` artifacts — DEFERRED.** Unique-index move from
   `(run_id, kind)` → `(run_id, storage_path)` before surfacing copied
   supporting-docs as artifacts.
9. **agent-browser / surveyor headless robustness** — still unexercised in a full
   real run; validate during the Tier-2 build-out.

---

## Build plan / status (Phase 2-A.2)

1. ✅ **Pre-flight** — Spikes A/B/C.
2. ✅ **Inngest long-step** — ack-and-handoff + in-process semaphore ([ADR](./diligence-report-long-step-adr.md), PR #8).
3. ✅ **`src/skill/invoke.ts` + `runner.ts`** — query → collect deliverables → reuse `upload.ts`/`insert.ts` → terminal status (PR #8).
4. ✅ **Wired behind `if (full_run)`** in `diligence-run.ts`; `else` keeps the 2-A.1 dummy renderer (PR #8).
5. ✅ **Observability** — `run-summary.json` + session id + result capture (PR #9).
6. ✅ **Attachment download** for Phase 1/§9, vision-gated (PR #11).
7. 🟡 **Minimal kickoff (fan-out fix)** — PR #10, **in validation** (the single-threaded finding).
8. ⬜ **Full-fidelity smoke** on a Tier-2 host (surveyor + agent-browser + vision), then flip `fullFeasibilityRunEnabled` default.
9. ⬜ **Fast-follows:** stuck-run reconciler, tool allowlist, per-subagent observability, `diligence/completed` emission (deferred until a consumer exists).

---

## Cross-refs

- Long-step decision: [`diligence-report-long-step-adr.md`](./diligence-report-long-step-adr.md)
- Host provisioning: [`diligence-report-skill-execution-host-provisioning.md`](./diligence-report-skill-execution-host-provisioning.md)
- field-agent roadmap: [`implementation-plan.md`](./implementation-plan.md)
- Canonical feature spec: cityhall `docs/feasibility-research-runner.md`
- Path-config PR: [noetic-inc/claude-plugins#9](https://github.com/noetic-inc/claude-plugins/pull/9)
- The skill: `claude-plugins/plugins/noetic-tools/skills/diligence-report/`
- The renderer: `claude-plugins/plugins/noetic-tools/noetic-pdf/`
