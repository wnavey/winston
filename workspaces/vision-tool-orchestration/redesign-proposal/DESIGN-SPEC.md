# Tool Architecture Redesign — Standard Contract + Decoupling from Conductor

> **Status:** Draft / RFC · **Date:** 2026-06-26 · **Owner:** Winston
> **Scope:** How agent-facing tools (vision, semantic-search, measure-distance, …) are defined, hosted, observed, and tested across the site-plan-review, completeness-check, and comment-resolution-check workflows.

## TL;DR

We have three different "shapes" of agent tool, no shared contract between them, and fragmented per-tool observability. This proposal argues the decision that matters is **adopting one standard tool contract (MCP interface + a context envelope + a telemetry record)** and **decoupling tool implementations from Conductor**, so Conductor stays a pure runtime and tools can evolve into independently-deployed, independently-benchmarked, potentially-agentic services.

Recommended first move: stand up a **unified vision service** behind MCP as the pilot — it proves the contract, fixes the observability gap uniformly, and delivers the shared-vision-abstraction-layer goal in one stroke.

---

## 1. Motivation

Two findings from the 1700 S Lamar Run 3 CRC audit triggered this:

1. The CRC vision tool (`crc-vision-check`) had almost no structured logging — response text, tokens, model, latency, and per-item attribution were all dropped — while the formal review's experimental `vision_check` already captures most of it. Three vision tools had silently diverged.
2. The bureau **script tools** (e.g. `semantic-search-blocks`) shell out via `execSync` from Conductor, and that boundary loses observability in ways that are structural, not incidental.

Stepping back, the real issue isn't any single tool — it's that **there is no standard for what a tool is**, and the implementations are entangled with the orchestration runtime.

---

## 2. Current state

### 2.1 Three coexisting tool shapes

| Shape | Examples | Where it lives | Pros | Cons |
|---|---|---|---|---|
| **In-process MCP tool** | `vision`, `vision-check`, `crc-vision-check`, `validate-checklist`, `progress` | compiled into Conductor (`conductor/src/tools/*`) | full local access (FS, Supabase client, gateway), best telemetry potential | bloats the runtime; couples tool releases to Conductor deploys; tools fork and diverge |
| **Shell-out script tool** | `semantic-search-blocks`, `measure-distance`, `inspect-drawing`, `extract-measurement-pairs` | bureau (`bureau/workflows/**/scripts/*.ts`), run via `execSync` inside the sandbox (`conductor/src/tools/script.ts`) | versions with the prompt/workflow in bureau; no Conductor redeploy to change | process-boundary observability loss; no shared contract; `NODE_PATH` hacks to borrow Conductor's `node_modules`; 10-min `execSync` cap |
| **Agentic tool (emergent)** | `vision_check` (classifier → dispatch → specialists) | Conductor, but its specialists **shell out to bureau scripts** | richest telemetry today (per-call `metadata.json`); a real multi-step loop | experimental; in-process → `execSync` → subprocess is the worst path to trace |

These are wired per-workflow in `workflow.yaml` `tools:` lists. Production review/completeness-check use the plain `vision` tool; CRC uses `crc-vision-check`; `vision_check` is gated behind `experiment=vision-check`.

### 2.2 Observability is fragmented and lossy

**Script tools** (using `semantic-search-blocks` as the worked example):

- **Input is captured** — `script.ts` logs the full command (`--query=… --maxResults=…`) to pino as `"Executing script tool"`.
- **Output reaches the agent** — stdout + the output file are returned, so results land in the agent-message stream (the ~95 MB pino log).
- **A script-authored sidecar exists** — `semantic-search-blocks.ts` *chooses* to write `semantic-search-blocks-log.jsonl` (`:start` with query/maxResults; `:result` with mode/resultCount/`elapsed_ms`).
- **But the boundary drops things:**
  - **stderr on success is discarded.** The script logs events via `console.error` (stderr); `execSync` returns only stdout, so on success Conductor never sees them — they survive only in the sidecar the script chose to write.
  - **No cost/token capture** for the internal OpenAI embedding call (raw `fetch`; errors → stderr → lost on success).
  - **No attribution** — sidecar has no `checklistItemId`, `runIndex`, or `callId`.
  - **No standard** — this sidecar exists only because *this* script hand-rolled it. Conductor itself records only the command string + (on failure) a truncated error.

**Vision tools** have the analogous gap (see the CRC audit): `crc-vision-check` had dropped response/usage/model/latency entirely; only the experimental `vision_check` captures a structured per-call record (`metadata.json`).

> **Takeaway:** logging isn't *lost*, but the architecture makes consistent observability structurally hard — each tool reinvents (or skips) it, and the shell-out boundary silently drops stderr/cost/internal-trace. Conductor, which should own cross-cutting concerns, owns almost none of the per-tool telemetry.

### 2.3 `vision_check` is already ~80% of the target shape

It has a typed input (incl. `checklistItemId`), a per-call telemetry record (`metadata.json`: callId, inputs, classifier metadata, dispatch trace, timestamps), and a real agentic loop (classifier → dispatch → specialists). The standard we want already half-exists in our best tool; the work is to extract it, move it behind a clean boundary, and standardize the telemetry sink.

---

## 3. Goals / non-goals

**Goals**
- One standard tool contract across all workflows: typed I/O, a uniform context envelope, and a uniform telemetry record.
- Decouple tool *implementations* from Conductor; Conductor becomes a pure runtime that connects to tools, not one that contains them.
- Make every tool independently **integration-tested and benchmarked**.
- Allow tools to grow into multi-step agentic loops without bloating the runtime or fighting the `execSync` boundary.
- Fix the observability gap **uniformly**, not tool-by-tool.

**Non-goals**
- Rewriting all tools at once. This is an incremental migration with a single pilot first.
- Moving trivial deterministic helpers (e.g. `extract-scale`) — keep a script escape hatch for those.
- Changing workflow authoring ergonomics in bureau beyond pointing `tools:` at endpoints.

---

## 4. Proposed standard tool contract

The boundary that matters is **MCP** (the agent SDK already speaks it). A "tool" is anything that satisfies this contract, regardless of where it runs:

### 4.1 Input = typed params + a standard context envelope

Conductor injects the envelope once for *every* tool call, so attribution stops being per-tool retrofitting:

```jsonc
{
  // tool-specific, typed params (validated against the tool's JSON Schema)
  "query": "…",            // e.g. semantic-search
  "documentId": "…",       // e.g. vision

  // standard context envelope (injected by the runtime)
  "_ctx": {
    "callId": "…",
    "parentCallId": "…",
    "checklistItemIds": ["SP-2.13"],
    "runIndex": "run-3",
    "workflowRunId": "…",
    "projectId": "…",
    "submissionVersionId": "…"
  }
}
```

### 4.2 Output = typed result + a standard telemetry record

Emitted to a **central sink** (not a per-tool sidecar each tool reinvents):

```jsonc
{
  "result": { /* typed, schema-validated */ },
  "_telemetry": {
    "callId": "…", "checklistItemIds": ["SP-2.13"], "runIndex": "run-3",
    "tsStart": 0, "tsEnd": 0, "elapsedMs": 0,
    "models": [{ "name": "…", "inputTokens": 0, "outputTokens": 0, "costUsd": 0 }],
    "subCalls": [ /* internal LLM/API/sub-tool trace for agentic tools */ ],
    "ok": true, "errorClass": null
  }
}
```

This is a generalization of `vision_check`'s `metadata.json` and the CRC audit's "unified tool-call JSONL" recommendation — promoted to a contract every tool honors.

### 4.3 Transport = MCP

- Remote: MCP over HTTP/SSE. Local dev: MCP over stdio.
- Conductor connects to whatever MCP endpoints the workflow declares; it no longer *contains* tool logic.

### 4.4 Testability is a first-class requirement

Each tool ships:
- **Integration tests** against real backends (or recorded fixtures).
- **A benchmark harness** with golden inputs + quality scoring (ties into the vision eval suite).

Living behind a clean boundary is what makes both natural — you can exercise the tool standalone.

---

## 5. Deployment topology

Tools live on a spectrum; pick per tool:

| Topology | When | Telemetry | Notes |
|---|---|---|---|
| In-process (today's native) | trivial, latency-critical, pure-local | good (in-process) | keep for `progress`, maybe `validate-checklist` |
| Shell-out script | trivial deterministic helpers | poor (boundary loss) | keep as an escape hatch; don't grow these |
| **Remote MCP service** | LLM-backed / multi-step / benchmarkable | best (owns its own pipeline) | **the target for "real" tools** |

For the tools that matter (the three vision tools, semantic-search, measure-distance, inspect-drawing), the **remote MCP service** is the right target:
- Keeps Conductor a pure runtime.
- Lets each tool own a proper telemetry pipeline → fixes the logging gap **uniformly**.
- Lets tools become agentic loops (`vision_check` already is) without bloating Conductor or fighting `execSync`.
- Enables independent deploy / version / scale (a slow vision tool scales separately from the orchestrator).

### 5.1 Where does it live?

The **MCP boundary is the real decision; the host is secondary.** Substation is a reasonable home (it already triggers workflows via Inngest/Vercel Sandboxes, and the vision eval suite is slated there). But consider a **dedicated tools/vision service** so tool evolution isn't coupled to the trigger layer. Make it a deliberate choice, not a default.

---

## 6. Pilot: a unified vision service

Best first move because it kills three birds:

1. **Proves the contract** end to end (envelope + telemetry + MCP + benchmark).
2. **Consolidates the divergence** — `crc-vision-check` is a regressed fork of plain `vision`; `vision_check` is the richer experimental one. One service, three behaviors reconciled (incl. `referenceImages`, which only CRC has today, and the classifier/dispatch routing, which only `vision_check` has).
3. **Delivers the shared-vision-abstraction-layer goal** directly.

Migration steps (incremental, low-risk):

1. Define the contract + telemetry envelope (§4). Codify the per-call telemetry record (extends `vision_check`'s `metadata.json`).
2. Stand up the unified vision service as a remote MCP server, with integration + benchmark tests.
3. Point **one** workflow's `tools:` at the remote endpoint instead of the in-process/script tool. Verify parity.
4. Roll to the other workflows; then apply the pattern to `semantic-search`, `measure-distance`, `inspect-drawing`.
5. Conductor keeps only true-runtime concerns (`progress`, MCP client plumbing) + becomes the pure execution engine.

---

## 7. Constraints & risks (so we don't oversell it)

- **Artifact access is the real migration cost.** Remote tools can't see the sandbox FS. Sheet loads already come from Supabase (`getFileContent`), but `crc-vision-check`'s `referenceImages` are local files staged from `crc-guides/` — those must move to object storage / signed URLs. **Inputs-by-reference becomes a hard requirement.**
- **Latency is a non-issue** for the tools that matter — they're LLM-backed (vision tail runs to ~77 min; search ~700 ms). A network hop is rounding error. Don't promote ultra-cheap deterministic helpers; keep them as scripts.
- **Prompt ↔ tool-contract coordination** gets harder across decoupled repos (cf. the cross-repo `checklistItemIds` rollout). Mitigate with **versioned MCP tool schemas**.
- **Don't rip everything out at once.** One pilot, one workflow, prove telemetry + benchmark, then expand.
- **Secrets centralize** in the service (Supabase / OpenAI / gateway) instead of being sprayed into sandbox env — a net positive, but a migration item.

---

## 8. Open questions

- **Remote-MCP wiring in the agent SDK.** Conductor currently builds in-process tools via `tool()`. The exact `@anthropic-ai/claude-agent-sdk` mechanism for connecting to *remote* MCP servers (HTTP/SSE) — and how the per-call context envelope is injected at that boundary — needs to be confirmed before committing to the transport detail.
- **Central telemetry sink.** Where do `_telemetry` records land (Better Stack? a Supabase table? object storage JSONL)? The CRC audit assumed a per-run JSONL; a service can do better.
- **Service granularity.** One tools service vs. per-domain services (vision, search, geometry). Lean per-domain so blast radius and scaling are independent.
- **Versioning/compat.** How workflows pin a tool schema version, and how breaking changes roll out across bureau prompts + the service.

---

## 9. Appendix — key code references

- Script-tool shell-out + boundary behavior: `conductor/src/tools/script.ts` (`execSync`, stdout-only capture).
- Script-authored sidecar (the only structured log): `bureau/workflows/comment-resolution-check/scripts/semantic-search-blocks.ts` (`logEvent` → stderr + `semantic-search-blocks-log.jsonl`).
- Tool registration switch (native vs `script:` prefix): `conductor/src/tools/index.ts`.
- Best-in-class telemetry today: `conductor/src/tools/vision-check/index.ts` (per-call `metadata.json`).
- Shared file resolution (UUID-keyed, Supabase): `conductor/src/shared/vision-file.ts`.
- Prior context: CRC Run 3 audit (`workspaces/comment-resolution-check/1700-S-Lamar/crc-run-audits/run-3-audit/`).
