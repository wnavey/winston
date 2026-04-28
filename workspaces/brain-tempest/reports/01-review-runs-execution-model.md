# 01 — How Conductor Executes `review-runs`

*First-pass research. All file:line references are absolute paths in
`/Users/winston/workspace/`.*

## 1. Spawn shape

`review-runs` is an agent step with three fan-out dimensions: `runs` (N
independent passes), `checklistItems` (glob → M grouping files), and implicit
retries. The orchestrator spawns **N × M** agents total (default 3 × M
groupings in `review-guides/<guideCode>/*.md`). With 8 groupings this is 24
agents per review.

Concurrency is capped per-step by `maxWorkers: 30`
(`conductor/src/orchestrator/step-executor.ts:834`). There is **no global
worker budget** across steps — a workflow that parallelizes two agent steps
could spawn `maxWorkersA + maxWorkersB` agents simultaneously. Not currently
exercised by the review workflow, but a footgun if we later parallelize
steps.

Parallelism is a single-threaded `Promise.race` loop
(`step-executor.ts:856–954`):
1. `checklistManager.claimNext()` is called synchronously until either the
   queue is empty or `maxWorkers` promises are in flight.
2. `Promise.race` picks up whichever agent finishes (or fails) first.
3. The freed slot is refilled by another `claimNext()` on the next tick.

Because claim/release only happens on the orchestrator event loop, there are
no races on `status.json` even though 30 agents are in flight.

## 2. The agent itself

Agents are spawned via the Claude Agent SDK `query()` async generator
(`conductor/src/agent/runner.ts:172`). Each agent gets:

- `prompt`: the rendered `review.md` (see §3). The SDK treats this as one
  complete prompt — there is no separate system vs. user message.
- `model`: rendered from `{{ input.model }}` (default Haiku 4.5).
- `effort`: rendered from `{{ input.effort }}`, dropped unless in
  `{low, medium, high}` (`step-executor.ts:1063`). Haiku doesn't honor this;
  only 4.6+ models do.
- `outputFormat`: `{ type: 'json_schema', schema: review.schema.json }`
  (`step-executor.ts:1045`). The SDK enforces structured output — conductor
  does **not** run AJV on the result.
- `tools`: `[vision]` → registered as an MCP tool named `fetch_pdf`
  (`conductor/src/tools/index.ts:119`). The vision tool proxies to the
  Anthropic SDK `generateText()` call against Supabase-hosted PDFs.
- `abortController`: gives the orchestrator a kill switch on SIGTERM.

Notably the agent **does not have file-system write tools** here. It reads
workspace files (checklist, README, facts, sheet guides/blocks) but its
only output channel is the structured JSON.

## 3. Prompt assembly

`review.md` (165 lines, `bureau/.../review/prompts/review.md`) is loaded as
plain text (`step-executor.ts:1028`) and rendered via `renderTemplate()`
(`conductor/src/orchestrator/template-engine.ts:134`). Substitutions
available:

| Source | Variables |
|---|---|
| Workflow inputs | `{{ input.jurisdiction }}`, `{{ input.guideCode }}`, `{{ input.projectId }}`, `{{ input.submissionVersionId }}`, `{{ input.model }}`, `{{ input.effort }}`, `{{ input.runs }}`, `{{ input.eval }}`, `{{ input.priorReviewId }}` |
| Per-agent context | `{{ checklistItem }}` (filename), `{{ checklistIndex }}` (1-based), `{{ runIndex }}` (`run-1` …) |
| Engine-set | `{{ WORKSPACE_PATH }}`, `{{ WORKFLOW_PATH }}`, `{{ outputPath }}`, `{{ bureauCommitHash }}`, `{{ hasPriorReview }}` (`engine.ts:168`) |
| Clock | `{{ now }}`, `{{ timestamp }}`, `{{ datetime }}` |
| Env | `{{ env.FOO }}` |
| Filters | `| upper`, `| lower` |

`review-runs` does **not** use `inject:` — no file contents are spliced into
the prompt. All evidence reading happens inside the agent via the filesystem
tools the SDK provides (Read/Glob/Grep/Bash). The schema is passed
out-of-band via `outputFormat`, not injected into prompt text.

One gotcha: the prompt references resources the agent has to discover from
the workspace (README.md → per-sheet `guide.md` → `blocks.md`, plus
`facts.md`). The prompt is doing a lot of navigation teaching because the
data layout isn't handed to the agent in-context — it has to be crawled.
Worth flagging as a potential lever.

## 4. Termination

The agent loop terminates when the SDK's async generator returns. Three
normal exits plus several abnormal ones (`agent/runner.ts:185–242`):

**Normal:**
- `result` message with `subtype: 'success'` and `structured_output` set →
  happy path (`runner.ts:214`). The SDK has already validated the JSON
  against `review.schema.json`; conductor just writes it to disk at
  `output/runs/{{ runIndex }}/findings/{{ checklistItem }}.json`
  (`step-executor.ts:1097`).

**Abnormal, retryable (wrapped as `RateLimitError` or generic `Error`):**
- `result.subtype` starts with `error_` (includes schema violations →
  opaque) (`runner.ts:187`).
- Assistant message with `error: 'rate_limit'`, `'unknown'`, or
  `'server_error'` (`runner.ts:222`).
- `stop_reason === 'tool_use'` — agent was interrupted mid-tool-call
  (context window exhaustion is the usual cause) (`runner.ts:201`).

**Abnormal, non-retryable:**
- `authentication_failed`, `billing_error`, `invalid_request`,
  `max_output_tokens`. These throw and fail the item immediately — no
  backoff retry.

The agent has no explicit "I'm done" signal beyond the SDK deciding the
conversation is over and emitting a `result` message. The prompt's "Return
Your Findings" section is what the agent is trying to satisfy; the SDK's
structured-output constraint is what actually gates termination.

## 5. Retry policy

`retries: 5` is **per item (agent)**, not per step
(`step-executor.ts:927`). Six attempts total (1 initial + 5 retries).
Backoff is exponential with jitter
(`step-executor.ts:33`):

- Rate-limit path: base 15s, cap 120s → roughly 15 / 30 / 60 / 120 / 120s.
- Other retryable: base 2s, cap 30s → roughly 2 / 4 / 8 / 16 / 30s.

Important subtlety: during a retry's backoff delay, the tracked promise
sleeps inside the worker slot (`step-executor.ts:886`). That slot is
unavailable to other items for the duration. Good for rate-limit herd
control (sleeping workers ≈ circuit breaker), bad for tail latency — a
120s backoff burns one of 30 slots for two minutes.

## 6. Step and workflow failure semantics

If **any** item exhausts retries, the step returns `success: false`
(`step-executor.ts:960`) and the engine halts the workflow at that step
(`engine.ts:283`). There is no partial-success path — 23 good agents and
1 failed agent = whole step fails. To recover, you re-run with
`--resumeFromStep=review-runs`. No DLQ, no item-level salvage, no
downstream fallback.

This is conservative but wasteful: because `cross-run-consolidate` is
robust to missing runs by design (confidence tiers just shift), a
per-item hard failure could in principle be tolerated. Worth considering
a `allowPartial:` knob or a "failed items list" passed to downstream.

## 7. Observability

Two layers:

**Pino structured logs** (`agent/runner.ts:129, 274`) — `event:
agent.started` / `agent.completed`, plus every SDK message via
`logger.info(message)`. In dispatcher mode these ship to Logtail. Not
written to workspace files. Includes tool-call summaries and reasoning
blocks in dev console (`logReasoning`, `logToolCall`) but **not** full
transcripts.

**`run-log.json`** (`conductor/src/orchestrator/run-logger.ts`) — per
step: status, start/end, error; per item: value, start/end, status,
`retryCount`, error message. Archived to Supabase `workflow-runs`
bucket at end of run.

Not tracked anywhere conductor-side:
- Tokens, cost, request IDs, trace IDs.
- Per-agent transcripts or reasoning.
- Tool-call traces (what the vision tool was asked, what it returned).
- Schema-violation field-level diagnostics (SDK swallows these).

For a 24-agent step this is surprisingly thin. If we wanted to answer
"why do runs disagree on grouping 5?" today, we'd have no transcript to
read. Logtail has the pino stream but it's not item-keyed for easy
filtering.

The `workflow_runs` Supabase row gets: `workflowName`, `inputs`,
`outputs_path`, `results` JSON, final status, Inngest run id, sandbox
id. Not enough for per-agent forensics either.

## 8. Dispatcher vs local

Both paths call the same `runWorkflow()`. Differences:

| | Local CLI | Dispatcher (cloud) |
|---|---|---|
| Workspace | Local disk | Ephemeral Vercel Sandbox |
| Bureau repo | `--bureauPath` (reuse) | Fresh clone per run |
| Logs | Stdout (+ optional file) | Pino → Logtail |
| run-log.json | Local file | Uploaded to Supabase |
| Outputs | Local files | Uploaded to `workflow-runs` bucket |
| Inngest events | Not emitted | Emitted on start/complete/fail |
| Completion webhook | No | Calls dispatcher's `COMPLETION_WEBHOOK_URL` |

Observability is strictly better in dispatcher mode because artifacts are
persisted. Local runs leave the logs ephemeral unless you redirect.

## 9. Things that jumped out

Hooks for the brainstorming phase — not conclusions yet, just things I
think are load-bearing or easily shifted:

1. **Ensemble failure is hard-binary.** One item × 5 retries failing kills
   24 agents' worth of work. Ensembles are supposed to be failure-tolerant;
   this step isn't.
2. **Backoff holds worker slots.** During a rate-limit storm (15s → 120s
   ramp), the whole pool can end up sleeping while new items sit
   unclaimed. The orchestrator is lock-free by design but the retry
   scheduler couples to the worker pool.
3. **No per-agent transcripts.** We don't know what the agents *did*, only
   what they returned. Hard to iterate on the prompt without forensics.
4. **Navigation-heavy prompt.** `review.md` spends ~50 lines teaching the
   agent how to crawl workspace files. That's tokens the agent rereads 24×.
   A pre-computed "sheet relevance" pre-pass might move the needle more
   than prompt-tweaking.
5. **Schema validation is SDK-opaque.** If an agent blows the schema we
   get `error_schema_violation` with no field-level info. Not actionable.
6. **Effort is silently dropped on Haiku.** The YAML accepts `effort` but
   it only does anything on 4.6+ models. Easy to misread the config.
7. **Vision tool is heavy and unobserved.** No log of what the vision
   tool was asked or cost. For a step that calls it repeatedly, this is a
   gap.
8. **`runs` is fixed at launch time.** There's no "run 3 more if
   confidence is low" adaptive policy. The ensemble is set-and-forget.

## Appendix: key file references

- Workflow YAML: `bureau/jurisdictions/austin/workflows/review/workflow.yaml`
- Review prompt: `bureau/jurisdictions/austin/workflows/review/prompts/review.md`
- Output schema: `bureau/.../review/schemas/review.schema.json`
- Orchestrator parallel-agent loop: `conductor/src/orchestrator/step-executor.ts:814–972`
- Backoff: `conductor/src/orchestrator/step-executor.ts:33–39`
- Agent runner: `conductor/src/agent/runner.ts`
- Template engine: `conductor/src/orchestrator/template-engine.ts`
- Run logger: `conductor/src/orchestrator/run-logger.ts`
- Engine `hasPriorReview`: `conductor/src/orchestrator/engine.ts:168`
- Vision tool: `conductor/src/tools/index.ts:119` → `conductor/src/tools/vision/`
