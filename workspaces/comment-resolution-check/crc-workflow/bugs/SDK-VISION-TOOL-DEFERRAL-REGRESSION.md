# CRC vision tool goes nearly unused after a claude-agent-sdk upgrade — tools get deferred behind "tool search" and the review agent never calls them

> **Status:** Diagnosed 2026-09-17. **Stopgap fix shipped** as conductor **PR #295** (pin `@anthropic-ai/claude-agent-sdk` to `0.3.214`). Root cause lives in the **conductor ⇄ claude-agent-sdk tool-registration boundary**, exposed by an SDK version bump (`^0.3.235` → `^0.3.258`, conductor #288, 2026-09-10). Discovered while auditing CRC review `1eeddd0a-880d-4698-9fe6-93acb53c93c3` (workflow_run `e9fc8220-6692-4214-ade3-79d4a5e7c8a2`, Lamar+Collier svn8/U1, project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`). **Presents as a "the model stopped using vision" quality regression — it is actually a tool-availability/registration regression in the SDK.** A verified fix-forward (§10) exists but is deliberately deferred; the pin is the verified path.

---

## Plain-English summary (shareable)

**Between claude-agent-sdk `0.3.214` and `0.3.258`, the SDK changed how in-process tools are surfaced to the model.** Newer versions default to **deferring tools behind a "tool search" step** — instead of listing every tool in the prompt, the model is handed a `ToolSearch` handle and is expected to *search* for a tool, *load* it, and only then *call* it.

Conductor registers its `crc-vision-check` and `semantic-search-blocks` tools as in-process SDK tools. Under the newer SDK, the CRC review agents can no longer see those tools directly — they issue `ToolSearch` queries looking for them but never complete the *discover → load → invoke* handshake. **The practical result: vision-based checks silently stopped happening.** In the last audited cloud run, the vision tool fired **4 times across all 95 review cells** (and even those weren't attributed to a run), versus **dozens** in the comparable run two months earlier. Every check that needs to *look at the drawing* (spatial takeoffs, ceiling heights, storefront glazing, fence coverage, dashed-vs-solid line reads) quietly degraded to text-only, with no error raised.

We **verified this by re-running the exact same review under each SDK version**: on `0.3.214` the model called vision **7/7 successfully** with clean run attribution; on `0.3.258` it just emitted `ToolSearch` queries and moved on. **Pinning the SDK back to `0.3.214` restores vision immediately** (that's the shipped fix). The durable fix is to tell the SDK to always load conductor's tools (a one-line `alwaysLoad: true`), but that's unverified and tracked as follow-up here — we shipped the empirically-proven pin first.

> One honest caveat (see §5): `ToolSearch` was observed on `0.3.214` **too**, so "deferral was introduced in `0.3.258`" is not yet proven at the commit level. What *is* proven is the empirical A/B: `0.3.214` works, `0.3.258` does not. The deferred-tool mechanism is the leading hypothesis and the basis for the fix-forward.

---

## The bug in one diagram

```
                 CRC "review" step spawns one agent per department guide
                                   │
                                   ▼
        conductor/src/tools/index.ts  getTools()
        ┌──────────────────────────────────────────────────────────┐
        │ createSdkMcpServer({ name:'conductor_tools',              │
        │                      tools:[crc-vision-check,             │
        │                             semantic-search-blocks,...] })│   ← no `alwaysLoad`
        │ allowedTools:['mcp__conductor_tools__crc_vision_check',…] │
        └──────────────────────────────────────────────────────────┘
                                   │  query({ options:{...toolsConfig} })   runner.ts:285
                                   ▼
                       @anthropic-ai/claude-agent-sdk
                                   │
        ┌───────────── 0.3.214 (good) ─────────────┐   ┌───────────── 0.3.258 (bad) ─────────────┐
        │ crc-vision-check listed in the prompt.    │   │ crc-vision-check DEFERRED behind tool    │
        │ Model calls it directly.                  │   │ search. Model only gets a ToolSearch     │
        │                                           │   │ handle.                                  │
        │  → mcp__…__crc_vision_check(sheet 61 …)   │   │  → ToolSearch query=select:crc-vision-…  │
        │  ✓ 7/7 vision calls, runIndex=run-1       │   │  → ToolSearch query=vision check sheet…  │
        │                                           │   │  ✗ (no follow-through invoke)            │
        └───────────────────────────────────────────┘   │  4 calls / 95 cells, runIndex=null,      │
                                   │                      │  17 cells report "tool not in my list"   │
                                   ▼                      └──────────────────────────────────────────┘
                    vision evidence gathered                          │
                                                                       ▼
                                                    vision-gated checks silently go text-only
                                                    (no error, no log line, verdicts still emitted)
```

The corruption point is the SDK's tool-advertisement layer. Everything downstream (the vision tool itself, the review agent, consolidation, the DB save) works exactly as designed — it just never gets a vision result to work with.

---

## Symptom (as observed)

Auditing CRC review `1eeddd0a-880d-4698-9fe6-93acb53c93c3` (2026-09-17, 5 runs × 19 department cells = 95 review cells):

- **`output/vision-log.jsonl` — 4 vision calls total, across all 95 cells**, all with `"runIndex": null`: CA-18.1 (sheet 61), CA-20.2 (sheet 71), SP-36.1/.2 (sheet 46), SP-36.3/.4 (sheet 55).
- **17 distinct department×run cells emitted "no vision tool" disclaimers** in their findings — e.g. *"no vision-analysis tool is available in this session,"* *"`crc-vision-check` … tools are not present in my actual tool list,"* *"no MCP tools matching that name are exposed to me."*
- **One cell (`crc-wq` run-3) hallucinated vision** — it stamped `crc-vision-check` in `tools_used` for 5 items and cited two sidecar files that do not exist and are absent from the tool-call manifest.

**Tempting-but-wrong first guesses, and why they don't survive the data:**
- *"The new model (sonnet-5) just chooses to call vision less."* — A model declining an *available* tool would not say the tool is **absent from its tool list**. The disclaimers report unavailability, not disinterest.
- *"Registration is just flaky."* — The `→ ToolSearch query=select:crc-vision-check,…` console lines show the agent actively *searching* for the tool by name (so it's aware of it) but not receiving it as a directly-callable tool.
- *"It's the gateway tag error we saw."* — That's a **separate** secondary bug (§9) triggered only by an over-long run label; the cloud run's label was short and its 4 vision calls succeeded.

---

## Evidence chain

1. **Baseline: vision used to fire far more, with run attribution.** The comparable prior run (v7 game-day, 2026-07-24, workflow_run `f972c1ad-968c-4413-b07e-0d39b2e73060`, SDK pin `^0.3.214`) has a **56.7 KB `vision-log.jsonl`** with **`"runIndex": "run-1"` / `"run-2"` populated** (≥20 successful calls in just the truncated head — a lower bound). **The regressed run has 4 calls, all `runIndex: null`.** Both the *volume* and the *run attribution* regressed together.

2. **Controlled A/B bisect isolates the SDK.** Same review, same inputs (Lamar+Collier svn8/U1, department `crc-CA`, `runs=1`, `maxWorkers=1`, model `claude-sonnet-5`, `--step=review`), only the SDK version changed:
   | | `0.3.214` | `0.3.258` |
   |---|---|---|
   | Vision calls | **7 / 7 success** | tools not reached |
   | `runIndex` | **`run-1` stamped** | n/a (`null` in cloud run) |
   | "no vision tool" reports | **0** | present |
   | Console | `→ mcp__conductor_tools__crc_vision_check(...)` | `→ ToolSearch query=select:crc-vision-check,…` then no call |
   **On `0.3.214` the model calls the tool directly; on `0.3.258` it only searches for it.** This is the load-bearing result.

3. **The SDK exposes an explicit opt-out for exactly this behavior.** In `0.3.258`'s type defs, `CreateSdkMcpServerOptions` has `alwaysLoad?: boolean`, documented: *"When true, all tools from this server are always included in the prompt and **never deferred behind tool search**. Applied via `_meta['anthropic/alwaysLoad']` on each tool. Equivalent to `defer_loading: false` on the API."* The SDK also adds a `'tool_deferred'` stop reason and `SDKDeferredToolUse` / `deferredBuiltinTools` types. **The SDK now has a first-class notion of deferring tools behind search; conductor never opts out, so its tools are eligible for deferral.**

4. **Conductor registers the tools without opting out.** `conductor/src/tools/index.ts:323` calls `createSdkMcpServer({ name:'conductor_tools', tools: toolList })` with **no `alwaysLoad`**, and exposes them via `allowedTools:['mcp__conductor_tools__crc_vision_check', …]` (`index.ts:330`). The tool itself is a normal in-process SDK tool (`crc-vision-check/index.ts:247`, `tool('crc_vision_check', …)`).

5. **Honest limit of the evidence.** `ToolSearch` was observed in the `0.3.214` console output as well, so the difference is **not** simply "tool search exists vs. doesn't." The proven claim is the empirical A/B (item 2). The precise SDK change that flips these tools from *directly-callable* to *deferred-only* between `0.3.214` and `0.3.258` has **not** been bisected to a commit. Two confounds in the local repro (macOS local vs. Linux sandbox; `maxWorkers=1` vs. `35`) were present yet did **not** mask the difference. This is why we shipped the **pin** (verified) and left `alwaysLoad` as a **fix-forward to verify** (§10).

---

## Timeline

| Date | Event | SDK pin | Vision behavior |
|---|---|---|---|
| 2026-07-14 | v5 CRC game-day | `^0.3.207` | works |
| 2026-07-23/24 | v6/v7 CRC game-days | `^0.3.214` | **works** (≥20 calls, runIndex stamped) |
| 2026-07-27 → 08-24 | dependabot bumps | `.220 → .222 → .228 → .235` | (untested) |
| **2026-09-10** | **conductor #288 bump** | **`^0.3.235` → `^0.3.258`** | — |
| 2026-09-16 / 17 | CRC run1 / run2 (audited) | `^0.3.258` | **broken** (4 calls/95 cells, runIndex null, disclaimers) |
| 2026-09-17 | local A/B bisect | pinned `0.3.214` vs `0.3.258` | 0.3.214 works, 0.3.258 fails |

**Both September runs are the first CRC runs on the new SDK line, and both regressed.** The floating caret `^0.3.258` means the sandbox resolves the actual version at `npm ci` time, so the exact installed version wasn't even captured per run (§9.3).

---

## Root cause

`conductor/src/tools/index.ts:322`:
```ts
if (toolList.length > 0) {
  mcpServers.conductor_tools = createSdkMcpServer({
    name: 'conductor_tools',
    tools: toolList,
    // ← no `alwaysLoad: true`  → tools are eligible for the SDK's tool-search deferral
  });
}
```

The missing invariant: **conductor never tells the SDK "always load these tools."** Under a claude-agent-sdk version whose default is to defer in-process MCP tools behind tool search, `crc-vision-check` and `semantic-search-blocks` become discover-then-load-then-call instead of directly callable, and the review agents don't complete that handshake. The `allowedTools` allow-list (`index.ts:330`) grants *permission* to call the tools but does not force them to be *loaded into the prompt*.

---

## Sample payloads (real, from the incident)

**Good — `0.3.214` local run, `output/vision-log.jsonl`:**
```json
{"event":"crc-vision:result","checklistItemIds":["CA-18.1"],"documentId":"908ffab5-…","sheetNum":61,
 "runIndex":"run-1","success":true,"model":"google/gemini-3.1-pro-preview","responseText":"…1324 chars…"}
```
(7 such lines; `runIndex` populated on every one; coverage spans CA-18.1, CA-03/04/05.x/06.x/07.x/01.2 across sheets 8–12, 61.)

**Bad — `0.3.258`, console during the review agent's turn:**
```
→ ToolSearch query=select:crc-vision-check,semantic-search-blocks, max_results=5
→ ToolSearch query=vision check site plan sheet, max_results=10
→ ToolSearch query=semantic search blocks plan set, max_results=10
   (…no subsequent mcp__conductor_tools__crc_vision_check call…)
```

**Bad — cloud run finding text (`output/runs/*/findings/*.json`):**
```
"…no vision-analysis tool is available in this session to make that determination."
"crc-vision-check … cannot be invoked because it was never registered/available in this environment."
```

**SDK contract (`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`, `CreateSdkMcpServerOptions`):**
```
alwaysLoad?: boolean;
// "When true, all tools from this server are always included in the prompt and never
//  deferred behind tool search. … Equivalent to `defer_loading: false` on the API."
```

---

## Impact

- ⚠️ **Every vision-gated CRC check on the newer SDK silently degrades to text-only** — spatial takeoffs, ceiling/floor-to-floor heights, storefront glazing, CRZ fence coverage, dashed-vs-solid line reads, dimension read-offs. The verdict is still produced (often `uncertain` or an over-cautious `failed`), with **no error and no log line** recording that vision was unavailable. This is the silent-data-loss worst case.
- **Affects all CRC cloud runs since ~2026-09-10** (the `^0.3.258` bump), including audited reviews `939634c7…` (run1) and `1eeddd0a…` (run2).
- **`semantic-search-blocks` is the same shape** and is deferred by the same mechanism — its usage is likely suppressed too (harder to see because text-search has weaker signals than a vision call).
- **Secondary, run-attribution:** the 4 calls that *did* land carry `runIndex: null`, so even when vision fires you can't tell which of the N runs made it.
- **Determinism:** intermittent — some cells still reached vision (the audited run got 4 through). Not an all-or-nothing failure, which is why it wasn't caught immediately.
- **Cheap detector:** for any CRC run, `wc -l output/vision-log.jsonl` and grep findings for `"no vision tool"` / `"not in my tool list"` / `ToolSearch`. A healthy full run should have **dozens** of vision entries with `runIndex` populated, and **zero** unavailability disclaimers.

---

## Fix directions

**Shipped (verified) — the pin:**
- **conductor PR #295** — pin `@anthropic-ai/claude-agent-sdk` to exact `0.3.214` (+ regenerated lockfile so the sandbox `npm ci` honors it). Restores vision now. Deliberate stopgap; loses ~2 months of other SDK fixes, so it should be temporary.

**Fix-forward (NOT yet implemented — directions for the implementing agent; most principled first):**

1. **Opt conductor's tools out of tool-search deferral — the real fix.** In `conductor/src/tools/index.ts:323`:
   ```ts
   mcpServers.conductor_tools = createSdkMcpServer({
     name: 'conductor_tools',
     tools: toolList,
     alwaysLoad: true,   // keep conductor tools in the prompt; never defer behind tool search
   });
   ```
   Then un-pin the SDK (back to `^0.3.258` or latest). **This must be verified before shipping** — re-run the §12 A/B on `0.3.258` *with* `alwaysLoad: true` and confirm vision returns to `0.3.214`-level frequency with `runIndex` stamped. (An `alwaysLoad: true` edit was prepared this session but intentionally **not** validated — the pin was chosen as the verified path under time pressure.) If a whole-server flag is too broad, the per-tool `tool({ alwaysLoad })` form exists and is OR'd with the server flag.

2. **Bisect the exact regressing SDK version** (`0.3.214 → 0.3.258`) so the un-pin can target the newest-good version instead of rolling all the way back, and so the SDK-side behavior change is documented. Resolves the §5 open question.

3. **Add "declared vs. actually-registered tools" telemetry per review cell.** The agent already logs an intended `tools` array at spawn; add a companion event capturing the tools the SDK *actually* exposed, and alert on drift. This entire class of regression is currently invisible in telemetry — it only surfaces as free-text prose inside findings.

4. **Fix the reproducibility gap** (§9.3): the SDK pin is a floating caret and the repo's lockfiles are inconsistent (`bun.lock` still resolves `0.2.74` while `package.json` says `^0.3.258`). Commit to one lockfile and record the resolved SDK version in each run's artifacts, so "what SDK did this run actually use?" is answerable.

---

## Secondary bugs found during this investigation

1. **Gateway tag-length breaks all vision calls when the run label is long.** `crc-vision-check` stamps a `label:<runLabel>` tag on every gateway call (`conductor/src/shared/gateway-metadata.ts:26`), and the Vercel AI Gateway rejects any tag > 64 chars. A 70-char run label produced `GatewayInvalidRequestError: tag exceeds 64 characters` on *every* vision call. **Fix:** truncate/hash the `label:` tag to ≤ 64 chars in `gateway-metadata.ts`. (Deterministic; independent of the SDK bug.)
2. **`runIndex: null` on vision calls under `0.3.258`.** `crc-vision-check/index.ts:297` stamps `runIndex: runIndex ?? null`; the value is populated on `0.3.214` (`run-1`) but null in the cloud `0.3.258` run. Likely the same tool-context plumbing affected by the deferral path — worth confirming once §10.1 lands.
3. **Observability gaps** (from the parent audit): the `semantic-search-blocks` sidecar log is written to transient scratch and not persisted on cloud runs; self-reported `tools_used` is unreliable in both directions (undercounts real calls; one cell fabricated a vision call). See the CRC-run audit for `1eeddd0a…`.

---

## Reproduction / verification recipe

Local, `~/noetic/conductor`, workspace symlinked to bureau, `.env` configured:

1. **Stage one department's guides** (any vision-relevant dept; `crc-CA` used here):
   ```
   npm run conduct -- --workflow=comment-resolution-check --step=fetch-crc-guides --clean --skip-upload \
     --project-id=23301a8a-4cdb-4751-ac0c-93b97f0f5c12 \
     --submission-version-id=7fe4352b-e745-4d3b-90fe-d16c1eab9439 \
     --crc-guides-submission-version-id=0e308099-7304-42e2-93a3-e5007af2e73c --crc-generation-number=1
   # then keep only crc-CA-*.md in workspace/crc-guides/
   ```
2. **Run the review step under each SDK version** (short run label to avoid the §9.1 gateway bug; hold model constant at `claude-sonnet-5`, `runs=1`, `maxWorkers=1`):
   ```
   npm install @anthropic-ai/claude-agent-sdk@0.3.214 --save-exact   # then run --step=review …
   npm install @anthropic-ai/claude-agent-sdk@0.3.258 --save-exact   # then run --step=review … (control)
   ```
3. **Compare** `workspace/output/vision-log.jsonl` (call count + `runIndex`) and grep `workspace/output/runs/*/findings/` for `"no vision tool"` / `ToolSearch`.
   - **`0.3.214`:** ~6–7 successful vision calls, `runIndex` stamped, zero disclaimers. *(Verified 2026-09-17: 7/7.)*
   - **`0.3.258`:** tools deferred, `ToolSearch` queries with no follow-through invoke.
4. **Acceptance test for §10.1:** repeat step 2's `0.3.258` run *with* `alwaysLoad: true` on the `conductor_tools` server — vision should match the `0.3.214` result.
