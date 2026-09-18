# Agentic HITL — the agent's inputs and outputs at a runbook gate

**Status:** Draft v1
**Date:** 2026-09-18
**Repos touched:** none (as-built architecture record; the reduction it recommends is spec'd elsewhere)
**Repos read:** `conductor2`, `bureau`, `substation`, `cityhall`, `claude-plugins`
**Companion:** `agentic-hitl.html` — the diagrams (two lanes, side by side)

## Problem

The HITL schema thread (winston#259) is about reducing how many times "what a decision
looks like" is stated. Before cutting anything, one question had no written answer: **what
does the agent actually do at a gate?** The natural assumption — that an agent reads the
gate, reasons about it, and emits a decision matching a schema it was given — is wrong in
three separate ways, and each wrong part suggests a different cut.

This spec is an as-built record, verified against the code on 2026-09-18. It makes no
proposal of its own beyond §6.

## 1. A gate is a step that runs nothing

A HITL gate is a step whose `step.yaml` says `runner: none`:

```yaml
# bureau/runbooks/smoke/steps/2.3-hitl/step.yaml
desc: 'HITL (eng, optional): does the digest read true to the briefs?'
runner: none
readout: 2.2-digest/digest.md
inputs: [2.2-digest]
outputs: [decision.json, decision.md]
```

`runner: none` means no harness is launched, no model is called, and no tokens are spent.
The step's contract simply fails until the declared outputs exist on disk, and `conductor
advance` exits **75** ("waiting") for the whole pass. The gate is a hole in the graph that
something outside the graph must fill.

So: **no agent runs at a gate.** Whatever agency exists is in the *driver* — the session or
the loop that notices the 75 and goes to find a person.

Three files sit in the step's source folder, and they are the whole vocabulary:

| File | Who wrote it | What it is | Who reads it |
|---|---|---|---|
| `adjudication.md` | a human, in bureau | the criteria — what "approve" means | a person, and the captain agent |
| `contract.test.ts` | a human, in bureau | the zod `Decision` object — the real definition of a valid answer | `node`, at re-advance |
| `decision.schema.json` | a human, in bureau | the same shape again, as JSON Schema | ajv, on the cloud lane only (§4) |

None of the three is generated. `decision.schema.json` is a hand-maintained duplicate of
the zod in `contract.test.ts` sitting beside it.

## 2. The agent's three roles — and none of them is "decide the schema"

There is an agent in this picture, but it is the **captain**: the `/conductor` Claude Code
session driving a local run (`claude-plugins/plugins/noetic-tools/skills/conductor/SKILL.md`
§5–§6). Its I/O at a gate:

**Role A — produce the readout (the *upstream* agent, not the gate).**
The gate's `readout:` points at another step's artifact (`2.2-digest/digest.md`). That file
was written by an ordinary agent step. This is the only agent-authored *content* on the
card, and it is prose — nothing types it, nothing validates it against the gate.

**Role B — publish the question (the captain).**
- **Reads:** `advance` stdout (parked step id + readout path), the readout file,
  `adjudication.md`, the step's `contract.test.ts`, `$RUN/runbook-run-id.txt`.
- **Writes:** one shell call —
  `runbook_hitl_cli.py ask --gate <step> --kind decision --prompt "<one line>" --readout <path>`.
- **The only thing the agent authors is `--prompt`: a one-line free-text restatement of
  what the gate is asking.** Everything else on the card is structural — `kind` comes from
  a flag, `readout_storage_path` from an upload, `allow_report_back` from a flag
  (`_build_payload`, `runbook_hitl_cli.py:76`).
- It does **not** pass `--schema-file`. The flag exists (`runbook_hitl_cli.py:230`) and
  nothing in any repo passes it (§4).

**Role C — decide, but only when licensed (the captain).**
The run's `request.json` may carry `directives.decide: string[]` — a list of waiting-step
ids the driver is permitted to close without a human
(`bureau/runbooks/smoke/steps/1.1-inputs/contract.test.ts`, the `Request` zod). When the
parked step is named there *and* its folder holds written criteria, the captain decides it
itself against `adjudication.md`, records the answer with `--decided-by` naming the
session, and cites the directive (SKILL.md §5). Otherwise it publishes and blocks on
`await-answer`.

**What the agent never does:** author, choose, generate, validate against, or even read
`decision.schema.json`. The agent writes an answer whose shape it learns from
`adjudication.md` prose and the zod it can read in `contract.test.ts` — the same way a
human would. The schema file is invisible to it.

## 3. The two lanes are structurally different

**Local lane** (an operator's machine, `conductor init` + a captain session):
the captain is the publisher *and* the writer. `ask` INSERTs the gate row through PostgREST
and parks the run (`cmd_ask`, `runbook_hitl_cli.py:121`); `await-answer` polls until the row
is terminal, projects `decision.json` + `decision.md` into the step folder, flips the row to
`applied`, unparks the run, and prints `{answer, next_action, kind, status}` so the captain
can branch (`cmd_await_answer`, `:157`).

**Cloud lane** (Vercel Sandbox): **there is no agent in the loop at all.** conductor2's
binary reports the park over the callback (`gates_for`, `callback.rs:228`), substation
INSERTs the rows (`runs.ts:575-577`), and the reconcile loop writes `decision.json` into the
sandbox filesystem from the decided row (`reconcile-loop.ts:377-395`). Nobody reasons about
anything; the card is assembled structurally and the file is written mechanically.

This is the asymmetry that matters for §4: the two lanes register gates through **different
code paths**, and only one of them knows the schema exists.

## 4. Where the schema is, and why it is almost never there

`schema_for` (`callback.rs:141`) reads `decision.schema.json` beside the step's `step.yaml`
and ships it verbatim in the callback. It is reached from exactly one place: `gates_for`, in
the `EXIT_WAITING` arm of an `advance` pass — and the callback is only sent when both a URL
and a run id are present:

```rust
// conductor2/src/verbs.rs:2554
if let (Some(url), Some(id)) = (callback, run_id) {
    crate::callback::send(url, id, *reported, cost, &gates, seat.as_ref());
}
```

`--callback` is a cloud-lane flag. **A local run never sends it**, so on a local run
`schema_for` is never called, and the gate row's `schema` is whatever `ask` put there —
`null`, because nothing passes `--schema-file`.

Verified in prod (`mgxqsrjutswbciyrltwd`, `runbook_hitl_questions`, 2026-09-18):

| | count |
|---|---|
| gate rows, all time | **11** |
| rows with a non-null `schema` | **1** |
| that row's status | still `open` — never answered |

So **the ajv arm in `decide-controller.ts:150` has never validated a real answer.** Every
decided gate took the `schema IS NULL` accept-anything path. `smoke` and
`smoke-schemaless-hitl` (bureau PR #1623) are behaviorally identical today: the schemaless
variant is a copy of a runbook whose schema was already not reaching the database.

## 5. One shape, stated six times

| # | Statement | Where | Enforced? |
|---|---|---|---|
| 1 | zod `Decision` | `smoke/steps/2.3-hitl/contract.test.ts` | **yes** — at re-advance |
| 2 | JSON Schema | `smoke/steps/2.3-hitl/decision.schema.json` | **yes** — ajv, cloud lane only, 1 row ever |
| 3 | prose | `smoke/steps/2.3-hitl/adjudication.md` | no — read by humans and the captain |
| 4 | `projectDecision` | `substation/src/lib/decision.ts` | no — a translator |
| 5 | `project_decision_json` | `bureau/runbooks/lib/app_client.py:438` | no — the mirror of #4 |
| 6 | hardcoded form | `cityhall/.../RunbookHITLQuestion.svelte` | no — and it never SELECTs `schema` |

Plus a fourth vocabulary: the console speaks `choice`, the contract speaks `status`, and #4/#5
exist only to translate between them.

## 6. What this says about reducing it

Ordered by what the as-built justifies, not by ambition:

1. **`decided_by` from the session.** *Shipped* — substation#265 + cityhall#678. The field
   was stated twice (column and decision object) and fed from the session only once, which
   is the only reason the console demanded a signed-in human type their own name.
2. **Retire the `choice` vocabulary.** Have the console post `status` directly; #4 and #5
   collapse to `{schema_version: 1, ...answer}` and stop being translators.
3. **Close the local-lane gap before judging the schema.** Either teach the local
   registration path to read `decision.schema.json` (pass `--schema-file`, or move the read
   into `ask`), or delete `schema_for` and the ajv arm. Today the column is dead weight that
   *looks* live.
4. **Then pick a floor.** With the gap closed, one calibration run makes the choice
   observable rather than theoretical: either the per-step schema earns its keep, or
   `contract.test.ts` becomes the single definition and #2 is deleted outright.

Nothing here argues for generating schemas from the agent, because no agent is near them.

## Open questions

- **Q1** — Is a gate's `schema` meant to be a *validation* contract (ajv at the door) or a
  *rendering* contract (generate the console form)? It is declared as the first and used as
  neither; the console's form is hardcoded. If rendering is the goal, `payload` already
  exists for render content and the two should not both be structural.
- **Q2** — Should `ask` read `decision.schema.json` itself rather than taking
  `--schema-file`? The file's location is derivable from the gate id, so the flag pushes a
  path decision onto an agent that has no reason to make it.
- **Q3** — `gate_kind` classifies by declared output filenames (`callback.rs:120`), so
  `1.1-inputs` (outputs `request.json`) would report as an `operator` gate. Harmless today
  because it is satisfied before the first advance — but is filename-inference the right
  classifier, or should `step.yaml` declare a `gate:` key?
- **Q4** — `directives.decide` is honored entirely by agent instruction-following (SKILL.md
  §5); no code reads it. Should conductor enforce it, or is prose the right level for a
  license that only an agent can exercise?
- **Q5** — The cloud lane has no captain, so there is no `directives.decide` path there at
  all. Is agent self-decision meant to be a local-only capability?
