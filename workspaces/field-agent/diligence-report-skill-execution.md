# Diligence-Report Skill Execution in field-agent

> **Status:** Architecture landed + de-risked via spikes (2026-06-02). The
> `invoke.ts` implementation (Phase 2-A.2) is **not built yet** — this doc is
> the design it will follow.
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

`@anthropic-ai/claude-agent-sdk`'s `query({ prompt, options })` returns an async
iterable of messages. field-agent's `src/skill/invoke.ts` (to be built) does:

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';

const workdir = `${REPO_ROOT}/workspace/${diligenceRunId}`; // field-agent/workspace/<id>

const q = query({
  prompt: kickoffFromIntake(intake, { workdir, bureauPath, surveyorPath }),
  options: {
    plugins: [{ type: 'local', path: NOETIC_TOOLS_PATH }], // ../claude-plugins/plugins/noetic-tools
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,                 // real optional flag (sdk 0.2.74)
    cwd: workdir,                                          // skill writes outputs here
    env: {                                                 // passes through to Bash subprocesses
      ...process.env,
      NOETIC_DILIGENCE_DIR: workdir,
      NOETIC_BUREAU_DIR: bureauPath,      // ../bureau
      NOETIC_SURVEYOR_DIR: surveyorPath,  // ../surveyor
      NOETIC_PDF_DIR: noeticPdfPath,      // ../claude-plugins/plugins/noetic-tools/noetic-pdf
    },
  },
});

for await (const msg of q) {
  if (msg.type === 'system' && msg.subtype === 'init') { /* assert plugin/skill loaded */ }
  if (msg.type === 'assistant') { /* observe tool_use for progress/logging */ }
  if (msg.type === 'result') { /* terminal — run finished */ }
}
// then: read workdir/sir/deliverable/*.pdf → reuse src/artifacts/upload.ts + insert.ts
```

> ✅ **`env` passthrough confirmed** against the installed
> `@anthropic-ai/claude-agent-sdk@0.2.74` types: `env?: Record<string, string |
> undefined>` and **defaults to `process.env`** — so the spread above replaces
> the child environment and the `NOETIC_*` vars *do* reach the Bash tool's
> subprocesses (including the surveyor shell-out). `cwd`, `plugins`,
> `permissionMode: 'bypassPermissions'`, and `allowDangerouslySkipPermissions`
> are all real fields in 0.2.74. **Pin the SDK to `0.2.74`** — the API is pre-1.0
> and the public docs lag the installed types (a docs-only check claimed `env`
> only accepts `API_TIMEOUT_MS` and that `allowDangerouslySkipPermissions`
> doesn't exist; both are wrong against 0.2.74). The env vars are
> **load-bearing** — see Paths below.

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

**Recommendation: set `ANTHROPIC_API_KEY` explicitly on the worker host.** It's
ToS-clean, survives the Phase 3 move to an always-on box, and removes a hidden
dependency on CLI login. CLI-credential inheritance stays a dev-convenience
fallback only. See
[`diligence-report-skill-execution-host-provisioning.md`](./diligence-report-skill-execution-host-provisioning.md#auth-prefer-an-explicit-api-key).

### Kickoff prompt

Assembled by field-agent from the intake (`src/artifacts/load-intake.ts`
already loads the `document_section` rows): the property address, intended use,
and any downloaded attachment paths. It also restates the working-root + path
overrides (belt-and-suspenders with the env vars). Spike C confirmed the agent
honors a cwd/path override given in the prompt.

### Output handoff — reuses 2-A.1

The skill writes `workdir/sir/deliverable/{site-intelligence-report,research-appendix}.pdf`
(+ `supporting-documents/*.pdf`). field-agent reads those into Buffers and reuses
the **existing** `src/artifacts/upload.ts` + `insert.ts`. Only the *source* of
the PDFs changes (real skill vs. dummy renderer) — the upload/insert/sign/UI
loop is unchanged. Supporting-document copies become `supporting_document_copy`
artifacts, which is when the `diligence_artifacts (diligence_run_id, kind)`
unique index must move to `(diligence_run_id, storage_path)` (a run can have
several).

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
3. **Progress/status during the long run** — stream `tool_use` / phase markers to
   `diligence_runs` so the cityhall UI shows more than "running".
4. **Attachment download** — fetch `intake_attachment` files into
   `workdir/sir/source-pdfs/` before invoking (enables Phase 1 + §9 Concept Plan Review).
5. **agent-browser / surveyor headless robustness** — unexercised in a real run.
   **Fast-follow, not a blocker:** Tier-1 address-only runs don't need them (the
   dependent disciplines land as `data-gap`). Validate during the Tier-2
   build-out. See
   [host-provisioning](./diligence-report-skill-execution-host-provisioning.md).
6. **`supporting_document_copy` artifacts** — unique-index move from
   `(run_id, kind)` to `(run_id, storage_path)`. Must land **before** the
   supporting-doc download path (commit 8) or multi-doc runs conflict on insert.

---

## Build plan for `invoke.ts` (Phase 2-A.2)

1. **2-A.2 pre-flight** *(done — Spikes A/B/C)*.
2. **Inngest long-step approach** *(decided — ack-and-handoff; see
   [ADR](./diligence-report-long-step-adr.md))*. Refactor `diligence-run.ts` to
   ack + hand off to an in-process runner with a concurrency-`1` semaphore.
3. **`src/skill/invoke.ts`** — assemble kickoff prompt from intake; download
   attachments into `source-pdfs/`; `query()` with `plugins` + `cwd` + `env`;
   stream messages (log phases); on `result`, return the deliverable PDF paths.
4. **Wire behind `if (full_run)`** in `diligence-run.ts`; the `else` keeps the
   2-A.1 dummy renderer. Feed `invoke.ts`'s output PDFs to the existing
   `upload.ts` / `insert.ts`.
5. **Emit `diligence/completed`** after success.
6. **Real full-run smoke test** on a fully-provisioned host (surveyor +
   agent-browser), then flip the `fullFeasibilityRunEnabled` flag default.

---

## Cross-refs

- Long-step decision: [`diligence-report-long-step-adr.md`](./diligence-report-long-step-adr.md)
- Host provisioning: [`diligence-report-skill-execution-host-provisioning.md`](./diligence-report-skill-execution-host-provisioning.md)
- field-agent roadmap: [`implementation-plan.md`](./implementation-plan.md)
- Canonical feature spec: cityhall `docs/feasibility-research-runner.md`
- Path-config PR: [noetic-inc/claude-plugins#9](https://github.com/noetic-inc/claude-plugins/pull/9)
- The skill: `claude-plugins/plugins/noetic-tools/skills/diligence-report/`
- The renderer: `claude-plugins/plugins/noetic-tools/noetic-pdf/`
