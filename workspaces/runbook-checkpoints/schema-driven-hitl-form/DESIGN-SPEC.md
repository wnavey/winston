# Schema-driven HITL answer form — the gate step dictates the card

**Status:** Draft v1.1
**Date:** 2026-09-23

> **Revision note (v1.1, same day).** Folded the cityhall#700 review: one `variants` construct instead of `variants` + `discriminated` (D2); the no-schema fallback is a synthesized schema through the same form (D6); `--allow-freeform` means an optional notes box (D5); `--schema-json` named (D5). substation's `SEAT_GATE_SCHEMA` gains `notes` so its "revise with a note" prompt has a field to receive it (PR 4).
**Repos touched:** `cityhall` (render the answer form from the gate row's `schema`; post the schema's own shape), `bureau` (`runbook_hitl_cli.py ask` emits a schema from `--options`; `answer` writes `status`; `captain.py` forwards the step's schema; `decision.schema.json` generated from each gate contract's zod, with a CI drift check; `review/steps/3.12-deliver` gets its missing schema), `claude-plugins` (conductor skill §6: options are rendered, drop the notes-box workaround), `substation` (retire the `choice` → `status` translation once cityhall posts `status`)
**Repos NOT touched:** `conductor2` (already ferries `decision.schema.json` to the gate row on both lanes — nothing to change), `dsd`, `inspector-general`
**Builds on:** `../DESIGN-SPEC.md` (runbook checkpoints v2, the `schema` column and ajv arm), `../data-model-spec.html` tab 07 (winston#259, as-built findings on the six statements of the answer shape), `../cloud-captain/DESIGN-SPEC.md` (D9: every captain question is a row), `../agentic-hitl/DESIGN-SPEC.md`

## Problem

A `runner: none` gate step already dictates what a valid answer looks like. It ships a `decision.schema.json` beside its `step.yaml`; conductor's callback reads it at park (`conductor2/src/callback.rs:228 schema_for`) and sends it on the gate; substation stores it in `runbook_hitl_questions.schema` and validates every console answer against it with ajv before writing (`substation/src/lib/decide-controller.ts:150`). Verified on prod (`mgxqsrjutswbciyrltwd`, 2026-09-23): since the per-ask RPC landed on 09-18, **27 gate rows carry a non-null schema** — 22 on preprocessing-v4 local runs, 4 on smoke cloud runs, 1 sir. The plumbing is done end to end except for the last link.

**The console ignores it.** `cityhall/src/routes/(app)/runbook-runs/[runId]/+page.server.ts:51` selects twelve columns from the row and `schema` is not one of them. `RunbookHITLQuestion.svelte` hardcodes a `decision` card as Approve, Request revision, a notes box, and a proceed/report-back radio. It posts `{ choice: 'approved' | 'revise', notes? }`, and substation's `projectDecision` (`src/lib/decision.ts:25`) rewrites `choice` into the contract's `status`.

That fixed pair is wrong for every gate that is not smoke:

| gate | status enum in its schema | what the console can produce |
|---|---|---|
| `smoke/steps/2.3-hitl` | `approved`, `revise` | both |
| `preprocessing-v4/steps/3.3-hitl` | `approved`, `approved_unpublished`, `revise` | two of three — `approved_unpublished` is unreachable |
| `sir/steps/3.10-deliver` | `approved` (requires a nested `publish` plan: organization, project, versioning, label), `revise` | Approve posts no `publish` object → ajv 400 every time; only `revise` can succeed |
| `review/steps/3.12-deliver` | `approved` (+ `publish`), `approved_unpublished`, `revise` | as sir, and no `decision.schema.json` exists at all so the door accepts anything |

Consequence for preprocessing-v4 in the cloud (the runbook's README default is `publish.allowed: false`): its `3.3-hitl` contract has a `[BLOCKING]` assertion that refuses `approved` when publishing is not allowed (`contract.test.ts:33`). The only legal finish is `approved_unpublished`, which the card cannot post. A cloud test run parks at 3.3-hitl with no legal move. Locally the `/conductor` session can record the answer from chat with `answer --choice approved_unpublished`; in the cloud there is no captain able to.

Consequence for sir in the cloud: a delivery gate that cannot be approved from the console. Every sir delivery so far was answered in chat (`channel='session'`), which is why nobody has hit the 400.

**Two parallel vocabularies for the same thing.** The captain's `ask --options '[{value,label}]'` and `--allow-freeform` (`bureau/runbooks/lib/runbook_hitl_cli.py:512`) put a choice list in the payload that nothing renders either. The conductor skill tells the captain to work around the card: "give each option a short single-word `value`, list those values in `--prompt`, and ask the person to type their pick in the notes box" (`claude-plugins/plugins/noetic-tools/skills/conductor/SKILL.md:203`). On sir run `5ba85168…` four of five questions carried structured `options`; the humans typed `buy`, `decline`, `pass-only` into a free-text box and the captain parsed them back out.

**The answer shape is stated six times and enforced twice** (winston#259 as-built): contract zod, `decision.schema.json`, substation `projectDecision`, bureau `project_decision_json` (`app_client.py:696`), the hardcoded cityhall form, and adjudication prose. Only ajv at the door and the contract zod at re-advance enforce anything, and they disagree: smoke's zod has `notes` optional on revise while its JSON schema requires it. Session-lane answers (`answer --choice`) bypass ajv entirely and write `choice` raw into `decision` — the projection to `status` happens only when `await-answer` writes `decision.json`.

## Design

**The card is what the step says it is.** A gate step authors three things, and the console renders exactly those and nothing of its own:

| the step author writes | where | the card renders it as |
|---|---|---|
| `desc:` | `step.yaml` | the prompt (already so, conductor2#106) |
| `readout:` (+ `inputs:` outputs as attachments, captain lane) | `step.yaml` | the reference material (already so) |
| the `Decision` zod in `contract.test.ts` → `decision.schema.json` | step folder | **the answer form** (this spec) |

### D1 — The answer form is rendered from the gate row's `schema`

`+page.server.ts` selects `schema`. `RunbookHITLQuestion.svelte` hands it to a new `DecisionForm.svelte` that renders a JSON Schema 2020-12 object as a form and produces the answer object in the schema's own shape. The prompt, readout and attachments above the form are untouched. The `Then: Proceed / Report back` radio stays where it is: `next_action` is a control-plane directive on the row, not part of the decision (see Q2).

### D2 — Supported constructs, and the escape hatch

Structured where understood, raw JSON where not, ajv at the door as the backstop for anything the client did not enforce.

| construct | rendering |
|---|---|
| top-level `type: object` with `properties` | the form; `required` marks fields |
| `string` with `enum` | one button per value; label = the matching `oneOf[{const, title}]` title when the property carries one, else the value; the property `description` under the buttons |
| `string` (no enum) | textarea; `minLength` shown as a hint and enforced client-side |
| `number` / `integer` / `boolean` | input / checkbox |
| `const` | not rendered; stamped into the answer |
| nested `object` | a fieldset, recursively (sir's `publish` plan) |
| `oneOf` / `anyOf` of objects (sir's `organization: by id \| by name`; what zod emits for a `discriminatedUnion`, D7) | one `variants` construct: a button per branch, titled by the branch's `title`, else its sole string `const` (so a zod union reads "approved / revise"), else "Option n"; the chosen branch's fields render below and its consts are stamped. A discriminated union is a variants list whose consts differ, not a second construct |
| `if` / `then` and `allOf[{if, then}]` at the object level whose `if` is a single-property `const` | conditional `required` (+ `minLength` overrides) applied when that property holds that value |
| anything else (`array`, `$ref`, `patternProperties`, `not`, …) | a raw JSON textarea for that property, labelled with the property's title, validated as parseable JSON only |

Submit is disabled until every client-known requirement is met. A 400 from the door (`decision_schema_violation`) is rendered verbatim under the form; the message already names the failing path.

### D3 — Server-stamped fields are never rendered

`schema_version` and `decided_by` are omitted from the form and from the posted answer. Substation's `projectDecision` already stamps both on the pass-through branch (`schema_version: 1`, `decided_by` from the signed-in member). The renderer treats them as a fixed `SERVER_STAMPED` set. The schema still lists them so the door and the run-dir contract keep enforcing them.

### D4 — The `choice` vocabulary is retired

The console posts `{ status, notes?, publish?, … }` — the schema's shape. `projectDecision` and `project_decision_json` shrink to the pass-through branch (stamp `schema_version` and `decided_by`, nothing else). The bureau `answer` verb takes `--status` and writes `status` into the row's `decision` (a `--choice` alias is kept one release, warning on stderr), so a session-lane row and a console row finally hold the same shape and `followup_notice` reads one field.

**Deploy order is load-bearing.** cityhall first (its form posts `status`; substation's current pass-through branch accepts it today). substation's removal of the translation last, after cityhall is live — the other way round every Approve from the old card 400s.

### D5 — The captain's `ask --options` emits a schema

`_build_payload` keeps writing `options` / `allow_freeform` into the payload (older consoles, and the `runbook_hitl_ask` idempotency compare), and `cmd_ask` additionally derives a schema when `--schema-file` is not given and the kind is `decision`:

```json
{ "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "schema_version": { "type": "number", "const": 1 },
    "status": { "title": "Decision", "type": "string",
                "enum": ["buy", "decline"],
                "oneOf": [ { "const": "buy", "title": "You pay the $5 day pass in the headed browser…" },
                           { "const": "decline", "title": "I record declined; the report discloses…" } ] },
    "decided_by": { "type": "string", "minLength": 1 },
    "notes": { "title": "Notes", "type": "string" } },
  "required": ["status", "decided_by"] }
```

`--allow-freeform` adds an optional `notes` property ("allow" reads as optional; without it the card is a pure pick). With neither `--options` nor `--schema-file`/`--schema-json` the schema stays null and the console falls back (D6). `--schema-json` is the inline twin of `--schema-file`, for a shape the captain improvises on the spot: no schema is ever mandatory. `captain.py park()` passes the step's `decision.schema.json` through `ask --schema-file` when the file exists, so a captain-authored card at a declared gate keeps the gate's form.

### D6 — Fallbacks for rows that carry no schema

When `schema` is null: if the payload carries `options`, the console synthesizes the D5 shape client-side; otherwise it synthesizes `{status: enum[approved, revise], notes, if revise then notes required}` — today's pair, expressed as a schema. Both render through the same `DecisionForm`, so there is one decision UI and one set of rules; a legacy row gives up one-click Approve for it (the same trade schema rows make). Every row already in prod stays answerable. Superseded and answered cards render the same form read-only, filled from the recorded decision (cityhall#699's toggle).

### D7 — `decision.schema.json` is generated from the contract zod

Each gate's `contract.test.ts` `Decision` export becomes the single statement. A new `runbooks/lib/decision-schema.mjs --write | --check` imports every `runner: none` step's contract that exports `Decision`, emits `z.toJSONSchema(Decision, { target: 'draft-2020-12', io: 'input' })` (zod 4.5 is what the contracts already import), and writes or diffs `decision.schema.json`. `--check` runs in bureau CI beside the existing lib suites, so a contract and its card cannot drift.

Two consequences for the contracts, both intended:

- Conditional rules move from `superRefine` (which `toJSONSchema` cannot express) to `z.discriminatedUnion('status', […])`, one branch per status. The emitted schema is a `oneOf` of objects sharing `status: { const }`, which D2 renders as the choice buttons plus the chosen branch's fields.
- Titles and descriptions move into `.meta({ title, description })` on the union and its fields, so the generated file carries the same operator-facing text the hand-written ones do.
- The zod gets stricter where it was looser than its JSON schema: smoke and preprocessing-v4 now require `notes` on `revise` in the contract too. Ajv already required it at the door; this only closes the session lane's bypass.

`review/steps/3.12-deliver` gets its first `decision.schema.json` from the generator. Generation is checked in, not done at compile time (Q1).

### D8 — Other kinds are unchanged

`operator`, `hands` and `clarification` keep their fixed forms. Their answer shapes (`{void_step, findings}`, `{hands_done}`, `{question}`) are tiny and have one producer each. Schema-izing them is a later spec if the captain ever needs to vary them.

## Implementation order (five PRs)

As opened on 2026-09-23: 1 = cityhall#700 (merged), 2 = bureau#1693, 3 = claude-plugins#284, 4 = substation#298, 5 = bureau#1694. All reviewed by the agentic reviewer; every code suggestion was aligned with this spec and folded in place.


| # | repo | change | deploy constraint |
|---|---|---|---|
| 1 | cityhall | select `schema`; `DecisionForm.svelte` (D1–D3); D6 fallbacks; post `status`; browser tests over the four real schemas | first |
| 2 | bureau | `ask --options` → schema (D5); `answer --status` (D4, alias kept); `captain.py` forwards `decision.schema.json`; `project_decision_json` → pass-through | after 1 is live (its `answer` writes `status`; today's `await-answer` reads either) |
| 3 | claude-plugins | conductor skill §6 rewrite: options render, no notes-box workaround; `answer --status` | with 2 |
| 4 | substation | `projectDecision` → pass-through; tests | **last**, after 1 is live |
| 5 | bureau | `decision-schema.mjs` + CI check; four contracts → `discriminatedUnion` + `.meta`; regenerate the three schemas; add review's | independent of the rest |

Adjacent, not in these five: the cloud captain's `parked_steps` parser never matches conductor's `waiting:` block (zero captain-authored questions on any cloud run), and the callback's 16 KB inline readout head will truncate preprocessing-v4's readout. Both were surfaced in the same session and are tracked separately.

## Acceptance

- A preprocessing-v4 cloud run with `publish.allowed: false` can be finished from the console with `approved_unpublished`. (A: renders three buttons; B: the door accepts the post; C: `4.1-publish` writes `published: false`.)
- A sir run can be approved from the console with a publish plan entered in the nested fieldset, and `4.1-upload` receives it.
- Smoke behaves exactly as today from the operator's chair, with the form now sourced from the schema.
- A captain `ask --options` question renders its options as buttons and the chosen value lands in `decision.status`, not `notes`.
- `bureau` CI fails when a contract's `Decision` and its `decision.schema.json` disagree.
- No row in prod becomes unanswerable: rows with null schema and `options` render buttons; rows with neither render the old pair.

## Open questions

- **Q1** Generate `decision.schema.json` at `conductor setup` (compile.py shelling to node) instead of checking it in? Checked-in is reviewable and needs no node at compile; compile-time cannot drift. Draft v1 checks in with a CI guard. Revisit if a runbook ever ships a schema that changes per run.
- **Q2** Should `next_action` join the schema as a property so a runbook can hide or default it? Today it is a row column with `allow_report_back` in the payload. Draft v1 leaves it outside the schema.
- **Q3** `hands` and `operator` forms from a schema (D8)? Deferred.
- **Q4** Enum value titles use the `oneOf[{const,title}]` convention (rjsf-compatible). Alternative: `x-enum-titles`. Draft v1: `oneOf`, because zod's `discriminatedUnion` output is already that shape at the branch level.
- **Q5** After D4, should `decision.json` on disk drop `schema_version` too, since the schema is the version? Out of scope; every contract reads it today.
