# Report back is a branch of the decision schema — kill the card's hardcoded "Then:" radio

**Status:** Draft v1
**Date:** 2026-09-23
**Repos touched:** `substation` (derive `next_action` from the matched schema branch; stop reading it from the answer body), `cityhall` (delete the Proceed / Report back radio and the `next_action` field of the post), `bureau` (`ask --options` carries a per-option `next_action`; `answer --next-action` and `--no-report-back` retire; smoke's gate gains an `approved_then_pause` branch), `claude-plugins` (conductor skill §6)
**Repos NOT touched:** `conductor2` (`schema_for` already ships the whole `decision.schema.json`; the marker rides in it for free)
**Builds on:** `../schema-driven-hitl-form/DESIGN-SPEC.md` (winston#275, all five PRs merged 2026-09-23). Resolves its **Q2** ("Should `next_action` join the schema?"), which v1.1 left outside.

## Problem

After winston#275 the decision card is drawn from the gate row's `schema`: every button, field and rule on it is the step author's. Except one. Under the schema form the card still renders a hardcoded radio, `Then: ○ Proceed ○ Report back` (`cityhall/src/lib/runbook-runs/RunbookHITLQuestion.svelte:303-310`), and posts its value as a second top-level field beside the answer (`:159`, `{ answer, next_action }`). The step can only suppress it, via `payload.allow_report_back: false`, which the captain sets with `ask --no-report-back` (`bureau/runbooks/lib/runbook_hitl_cli.py:571`) and conductor's callback never sets, so every engine card shows it (`:72`, `allow_report_back !== false`).

That radio is the last piece of decision UI the step does not control, and it is a default-on control for a path almost nobody takes. Verified on prod (`mgxqsrjutswbciyrltwd`, 2026-09-23), every decided `decision` row ever:

| next_action | rows |
|---|---|
| `proceed` | 46 |
| `report_back` | 3 (two Will smoke tests, one Jason sir hands question) |

The directive is real, though, and it works. `report_back` makes the carrier run **one** step and come back: substation's reconcile loop takes the `report_back` path whenever any decided gate carries it (`substation/src/lib/reconcile-loop.ts:463-464`), launches `conductor run-step <gate step>` (`:486`), then re-parks and asks the same gate again as a new question row, attempt 2 (`finishReportBack`, `:908-976`). On the local lane `await-answer` returns `next_action` and the skill tells the captain to branch on it (`SKILL.md:178-191`). Dropping the directive would lose the one place a person genuinely wants to watch a step before committing — sir's acquisition and delivery gates.

**The observation that dissolves the radio.** Report back only means anything with an *approving* status. A `revise` fails the gate's contract, so nothing downstream is ready and there is no step for `report_back` to run; the skill already says so (`SKILL.md:183`, "including for a `report_back`, which has no step to run"). So report back is not orthogonal to the decision. It is a **flavour of approval**: "approve, run one step, ask me again." A flavour of approval is exactly what a branch of the `Decision` union is.

## Design

### D1 — Report back is a branch of the step's `Decision`, marked for the engine

A step that wants the two-part loop declares a branch whose title says what it does and whose meta carries `x-next-action`:

```ts
z.object({ ...common, status: z.literal('approved_then_pause'), notes: z.string().optional() })
  .meta({
    title: 'Approve, run the next step, and ask me again',
    description: 'The graph runs one step and this gate is asked again with that step\'s outcome in hand.',
    'x-next-action': 'report_back',
  }),
```

Verified 2026-09-23: zod 4.5's `toJSONSchema` emits custom meta keys, so the generated `decision.schema.json` branch carries `"x-next-action": "report_back"`. Substation's ajv already compiles with `strict: false` for `x-*` keys (`decide-controller.ts:61-66`). `decision-schema.mjs --check` keeps the file and the zod in step as today.

A `discriminatedUnion` needs a distinct `status` per branch, so the report-back branch has its own status value. That is a feature: the gate's contract, `SATISFYING_DECISION_STATUSES`, and `decision.json` on disk all see plainly that this approval asked for a pause. The value is the step author's to name; `approved_then_pause` is the convention this spec uses.

Absent the marker, a branch means `proceed`. There is no `x-next-action: proceed`; proceed is the default and the only other value.

### D2 — Substation derives `next_action` from the branch the answer matched

`decideGate` (`substation/src/lib/decide-controller.ts`) already has the gate's `schema` and the validated decision. It finds the `oneOf`/`anyOf` branch whose `properties.status.const` equals `decision.status` and reads that branch's `x-next-action`; `report_back` if present, else `proceed`. That value goes into the existing `runbook_hitl_questions.next_action` column exactly as today, so the reconcile loop (`:463`), the re-park (`:908`), `await-answer`, the card's `→ report_back` badge and `gates --answered` are all untouched.

For a schema that is not a union (a hand-written `enum`, the D6 fallback, a captain `--options` schema), the same lookup runs over `properties.status.oneOf[{const, 'x-next-action'}]` — the per-value titling convention from winston#275 D5/Q4 — so a captain option can carry the marker too (D4).

The `/answer` route stops reading `next_action` from the body. For **one deploy** it still accepts and ignores the field, so an already-open old card does not 400 (D6). A's `/gates/:id/decide` alias never took it and is unchanged.

### D3 — The card is the schema form and a Submit button

`RunbookHITLQuestion.svelte` loses `nextAction`, `allowReportBack`, the radio, and the second field of the post body (`submit(formAnswer)` posts `{ answer }`). The answered-card header keeps rendering `→ report_back` from the row column. The frozen view of an answered card needs no change: the recorded `status` picks the branch, and the branch's title says it paused.

### D4 — The captain offers report back as an option, in its own words

`ask --options` entries gain an optional `next_action`:

```json
[{"value":"buy","label":"Buy the $5 day pass and print everything, then continue"},
 {"value":"buy-then-check","label":"Buy the pass, view the instruments, and check back with me before printing","next_action":"report_back"},
 {"value":"decline","label":"No spend; the gaps are disclosed"}]
```

`schema_from_options` writes the marker onto the matching `oneOf` const. The skill's guidance already says to write each option as the action the captain will take when it is chosen; "…and check back with me" is that sentence with a marker on it, instead of a generic radio the person has to relate to the options themselves.

Retired: `--no-report-back` and `payload.allow_report_back` (nothing renders them once D3 lands); `answer --next-action` (the row's `next_action` is derived from the schema branch the `status` matches, by the CLI, the same way substation does it — one rule, two implementations of a ten-line lookup, both tested against the same fixtures). `await-answer` keeps printing `next_action`.

### D5 — Smoke keeps exercising the loop

Smoke's `2.3-hitl` gains the `approved_then_pause` branch (D1), replacing nothing: `approved`, `approved_with_reservations`, `revise` stay. `SATISFYING_DECISION_STATUSES` learns it. The conductor skill's smoke paragraph (`SKILL.md:244`) changes from "Proceed finishes the run; Report back makes the captain run one more step" to naming the two buttons.

### D6 — Deploy order

1. **substation** (D2): derives from the schema; still accepts a body `next_action` and ignores it. Safe with today's card.
2. **bureau** (D4, D5) and **claude-plugins**: the options marker, the smoke branch, the retirements. Safe with either card.
3. **cityhall** (D3): delete the radio. Safe once 1 is live.
4. **substation** follow-up: drop the ignored body field and its zod line.

Rows already in prod are unaffected: `next_action` stays a column with the same two values.

## What this gives up

- A person can no longer ask for a pause on a gate whose author did not offer one. That is the point: the step decides, and today 46 of 49 answers never wanted it.
- Two implementations of the branch lookup (substation, bureau CLI) instead of one radio. Both are a `find` over `oneOf` plus a key read.

## Acceptance

- A cloud smoke run parks at 2.3-hitl showing four buttons and no radio; "Approve, run the next step, and ask me again" runs exactly one step and re-asks as attempt 2; plain "Approve" finishes the run. `runbook_hitl_questions.next_action` reads `report_back` and `proceed` respectively, derived, with the card having posted only `{ answer }`.
- A captain `ask --options` with one `next_action: report_back` entry renders it as a titled button and, chosen, lands `report_back` in the column.
- `RunbookHITLQuestion.svelte` contains no `next_action`, `nextAction`, or `allow_report_back`.
- `decision-schema.mjs --check` passes with the marker present.

## Open questions

- **Q1** Should the branch's status be free-form (`approved_then_pause`, `buy-then-check`) or should the engine also accept a fixed `x-status` so a report-back branch can share `approved` with the plain one? Draft v1: free-form. A distinct status is honest on disk, and `discriminatedUnion` requires it.
- **Q2** `x-next-action` as the key, or a `noetic:` prefix? Draft v1: `x-` (ajv's tolerated vendor prefix; same family as the `x-*` comment in decide-controller).
- **Q3** Should `report_back` be offered by default on sir's delivery gate (watch the upload) and acquisition gate (watch the buy)? Runbook authors' call, one branch each; not in this spec's PRs.
