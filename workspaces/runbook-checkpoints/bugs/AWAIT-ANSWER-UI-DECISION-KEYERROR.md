# `await-answer` crashes with `KeyError: 'choice'` on any gate answered in the cityhall UI

> **Status:** Diagnosed 2026-09-11, fix NOT yet implemented. Root cause is in **bureau** (`runbooks/lib/app_client.py:402` `project_decision_json`). Discovered driving the `smoke` runbook end-to-end through the DB/console HITL lane (run `592eceab-31f7-4546-954e-a9228181de91`, gate `2.3-hitl`, question `fa97767f-6e93-48c4-80da-94040a185e3a`, org noetic). Related: `workspaces/runbook-checkpoints/DESIGN-SPEC.md` §6 (two-part HITL), §5.2 (canonical answer route). The fix already exists, correct and idempotent, in **substation** (`src/lib/decision.ts` `projectDecision`) — this is a Python↔TypeScript drift, not a new design problem.

## Summary

The local-lane HITL client (`runbook_hitl_cli.py await-answer`) blocks a `/conductor` captain session at a `runner: none` gate and polls `runbook_hitl_questions` until the gate is answered — in chat **or** in the cityhall console. When the answer arrives, it projects the stored answer into the `decision.json` / `decision.md` the step's contract reads, marks the question `applied`, and returns `{answer, next_action, kind, status}` so the captain can branch on `next_action`.

That projection, `app_client.project_decision_json`, assumes the stored answer is in the **session/chat vocabulary** — a raw `{choice, decided_by, notes?}` object — and does `answer["choice"]` unconditionally. But the **cityhall UI lane stores an already-projected decision** — `{status, decided_by, schema_version}` — because substation's canonical `/answer` route runs `projectDecision` at the door before persisting. So for a UI-answered gate, `answer["choice"]` is a `KeyError`, `await-answer` dies with a traceback and a non-zero exit, and **no `decision.json` is written**. The gate stays unsatisfied and the run cannot advance.

What is working correctly, and should not be touched: the conductor rust harness (parked correctly at exit 75), substation's answer route and its `projectDecision` (stored exactly the right shape), the cityhall UI (`RunbookHITLQuestion.svelte` sent the right `{choice}` body), the DB row (the decision content — approved, by Will Navey, next_action proceed — is complete and correct), and the run's whole upstream/downstream graph. The failure is entirely inside one 10-line Python function.

**Root cause in one sentence:** `project_decision_json` was written for the session-channel answer shape (`{choice}`) only, and never got the idempotency guard its TypeScript twin `projectDecision` has, so it crashes on the already-projected shape the UI/substation lane stores.

## The bug in one diagram

```
                         gate 2.3-hitl answered
                                   │
        ┌──────────────────────────┴───────────────────────────┐
        │                                                        │
  CHAT / SESSION lane                                     CITYHALL UI lane
  runbook_hitl_cli.py answer                       RunbookHITLQuestion.svelte
        │                                          → POST /api/.../answer
  cmd_answer builds:                               → substation /answer route
    {choice, decided_by, notes?}                   → projectDecision(answer)   ← projects at the door
        │                                                        │
  answer_question_in_session()                     stores decision =
  stores decision =                                  {status, decided_by, schema_version}   ✓ projected
    {choice, decided_by, notes?}   ✗ raw                        │
        │                                                        │
        └───────────────────────────┬───────────────────────────┘
                                     │
                    runbook_hitl_questions.decision (jsonb)
                    ── TWO DIFFERENT SHAPES land here, by channel ──
                                     │
                       await-answer polls, reads `decision`
                                     │
                    project_decision_json(answer):
                        out["status"] = answer["choice"]   ← assumes RAW shape ONLY
                                     │
                ┌────────────────────┴────────────────────┐
        chat answer: has "choice"              UI answer: NO "choice"
              ✓ works                          ✗ KeyError: 'choice'
                                               → traceback, exit 1
                                               → decision.json NEVER written
                                               → gate stays unsatisfied, run stuck
```

The two writers disagree on the stored shape of `decision`, and the poller only understands one of them. The UI lane — the one the whole DB/console HITL feature exists to serve — is the one it doesn't understand.

## Symptom (as observed)

Driving the `smoke` runbook (`/conductor`) to its `2.3-hitl` gate on 2026-09-11:

1. Captain published the gate: `ask` created question `fa97767f-6e93-48c4-80da-94040a185e3a` (exit 0), and started `await-answer --timeout 3600` in the background.
2. Will answered **in the cityhall console** — Approve, decided_by "Will Navey", next_action proceed.
3. `await-answer` unblocked (it correctly saw the gate move to `decided`) but then crashed:

```
auth: run-token
Traceback (most recent call last):
  File ".../runbooks/lib/runbook_hitl_cli.py", line 273, in <module>
    raise SystemExit(main())
  File ".../runbooks/lib/runbook_hitl_cli.py", line 266, in main
    return args.func(creds, args)
  File ".../runbooks/lib/runbook_hitl_cli.py", line 170, in cmd_await_answer
    decision = app_client.project_decision_json(answer)
  File ".../runbooks/lib/app_client.py", line 407, in project_decision_json
    "status": answer["choice"],
KeyError: 'choice'
=== await exit: 1 ===
```

4. `$RUN/2.3-hitl/decision.json` and `decision.md` were both empty/absent; `conductor check 2.3-hitl` still failed (`decision.json is missing`); the run was still parked.

**Tempting-but-wrong first guesses, ruled out below:** (a) "the operator's answer didn't save" — it did, the DB row is complete; (b) "the console sent a malformed body" — it sent the correct `{choice}` body, substation projected it on purpose; (c) "a recent change broke the UI lane" — no, the UI lane never worked through `await-answer`; the Python projection has been choice-only since it was written.

## Evidence chain

**1. The stored decision for the UI-answered gate has no `choice` key — it is already projected.** Pulled live via `app_client.latest_question`:

```json
{
  "id": "fa97767f-6e93-48c4-80da-94040a185e3a",
  "step": "2.3-hitl",
  "kind": "decision",
  "decision": { "status": "approved", "decided_by": "Will Navey", "schema_version": 1 },
  "decided_by": "Will Navey",
  "status": "decided",
  "channel": "ui",
  "next_action": "proceed"
}
```

`decision.status` is present; `decision.choice` is absent. **This is the exact shape `project_decision_json` cannot read.**

**2. The cityhall UI sends `choice`, not `status`.** `cityhall/src/lib/runbook-runs/RunbookHITLQuestion.svelte:80`:

```ts
submit({ choice, decided_by: decidedBy.trim(), ...(notes.trim() ? { notes: notes.trim() } : {}) }, nextAction)
```

So the UI is not the source of the `status` shape — it speaks `choice`, same as the chat lane.

**3. Substation projects `choice → status` at the answer route, on purpose, before persisting.** `substation/src/routes/runbook-hitl-questions.ts:60-68`:

```ts
// The console speaks `choice`; the gate's schema (and the decision.json the step reads)
// speaks `status` + `schema_version`. `projectDecision` ... Idempotent for an
// already-projected answer ...
const decision = projectDecision(answer);
```

**This is why the DB row for a UI answer holds `{status, schema_version}` and not `{choice}`** — the projection is deliberate and canonical for the cloud/UI lane.

**4. The chat/session lane stores the raw `{choice}` shape — no projection.** `runbook_hitl_cli.py cmd_answer` (line ~143) builds `decision = {"choice": args.choice, "decided_by": ...}` and hands it to `app_client.answer_question_in_session`, which writes `decision` verbatim (app_client.py ~318-388). So the stored shape genuinely differs by channel: `{choice,...}` for `channel=session`, `{status,...}` for `channel=ui`.

**5. `project_decision_json` handles only the raw shape and has no guard.** `app_client.py:402-411`:

```python
def project_decision_json(answer: "dict") -> "dict":
    out: "dict[str, object]" = {
        "schema_version": 1,
        "status": answer["choice"],        # ← unconditional; KeyError on the projected shape
        "decided_by": answer["decided_by"],
    }
    if answer.get("notes"):
        out["notes"] = answer["notes"]
    return out
```

**6. Its TypeScript twin already has the exact guard this one is missing.** `substation/src/lib/decision.ts:18-27`:

```ts
export function projectDecision(decision: Record<string, unknown>): Record<string, unknown> {
  if (typeof decision.choice !== 'string') return { schema_version: 1, ...decision };   // ← idempotent
  const out: Record<string, unknown> = {
    schema_version: 1,
    status: decision.choice,
    decided_by: decision.decided_by ?? 'unknown',
  };
  if (decision.notes) out.notes = decision.notes;
  return out;
}
```

Its docstring claims it "**Mirrors bureau's `project_decision_json` (runbooks/lib/app_client.py) exactly, so the two lanes write the same file.**" **That claim is now false** — the TS side gained the `if (typeof decision.choice !== 'string')` idempotency guard and the Python side did not. This is the drift.

## Timeline

| when | event | touched the invariant? |
|---|---|---|
| `965dbac519` "runbook HITL: park the run at a gate, unpark on answer (local lane)" | `project_decision_json` + `await-answer` land, choice-only | introduced the choice-only assumption |
| substation `projectDecision` hardened | TS side gets the `typeof choice !== 'string'` idempotency guard for the already-projected/no-`choice` case | fixed the TS lane; Python not updated → **drift enters here** |
| `51e03413ef` "runbook_hitl_cli: drop run-start" | unrelated (registration ownership) | no |
| 2026-09-11 smoke run | first end-to-end drive of a **UI-answered** gate through `await-answer` | **surfaced** it |

**Corollary:** this is deterministic, not a race and not nondeterministic — *every* UI-answered decision gate hits it. It was latent because prior local runs answered gates in chat (the `{choice}` path, which works), so nothing had exercised `await-answer` against a substation/UI-projected decision until this smoke run, whose whole point is the console lane.

## Impact

- ⚠️ **Every `/conductor` run that routes a decision gate through the cityhall console and blocks on `await-answer` — the entire DB/console HITL lane — is broken.** The operator answers, the answer saves correctly, and the captain's poller crashes without writing `decision.json`, so the run stalls at the gate. This is the headline feature of the runbook control plane (§6) and the reason `smoke` uses `conductor init`.
- **Silent-ish, but not silent:** `await-answer` exits non-zero with a traceback, so a captain watching the output sees it. But nothing in the app or DB reflects the failure — the question shows `decided`, so from the console it looks answered and done. A less careful driver could read "decided" and not notice the run never advanced.
- **`kind=clarification|operator|hands` gates:** unaffected by this specific line — `project_decision_json` only runs when `kind == "decision"` (`cmd_await_answer` guards it). But any of those that carry a decision-shaped payload would share the fragility.
- **Chat/session-answered decision gates:** unaffected — they store `{choice}` and project fine. This is why the bug hid.
- **Downstream steps / contracts:** unaffected in themselves — once a correct `decision.json` exists they pass. The only damage is the missing file.
- **Cheap detector:** any run where `runbook_hitl_questions.channel = 'ui'` and `decision->>'status'` is set but the step folder has no `decision.json` after the poll — i.e. a UI answer that never landed on disk.

## Fix directions (not yet implemented — directions, not a mandate)

1. **Make `project_decision_json` idempotent, mirroring `projectDecision` (the principled fix).** Port the TS guard verbatim: if `answer` has no string `choice`, it is already projected — return `{ "schema_version": 1, **answer }` unchanged; otherwise do the existing `choice → status` mapping. One conditional; restores the "two lanes write the same file" invariant the docstring promises. Add a unit test for both shapes (a `{choice}` answer and a `{status, schema_version}` answer) to `test_runbook_hitl_cli.py` / the app_client tests.
2. **Fix the stale docstring on both sides** so "mirrors exactly" is true again, and note that the projection is idempotent by contract so either lane may call it.
3. **Guard `cmd_await_answer` against a projection that still lacks `status`** (defense in depth): if the projected decision has no `status`, write nothing and exit with a readable message naming the gate, rather than letting a future shape drift crash on a raw `KeyError`.
4. **Detection/repair for an already-stuck run:** none needed structurally — re-running `await-answer` after the fix will re-read the same `decided` row and project it correctly. (The 2026-09-11 smoke run was unblocked by hand: `decision.json`/`decision.md` written from the console answer, question marked `applied`, then `conductor advance` — the run completed clean.)

## Prior art

The correct, idempotent implementation already ships in-house and is the reference for fix #1:

- `substation/src/lib/decision.ts:18-27` — `projectDecision`, with the `if (typeof decision.choice !== 'string') return { schema_version: 1, ...decision }` guard that handles the already-projected shape.
- `substation/src/routes/runbook-hitl-questions.ts:60-68` — where it runs at the answer route "at the door," with the comment explaining the `choice` vs `status`+`schema_version` vocabularies and that it is idempotent.

## Reproduction / verification recipe

Cold repro:

1. `/conductor` a `conductor init`-registered run to any `runner: none` decision gate (the `smoke` runbook's `2.3-hitl` is the canonical fixture; drive with `--runner mechanical=claude/haiku-4.5/low` on the subscription lane).
2. Publish the gate: `python3 $BUREAU/runbooks/lib/runbook_hitl_cli.py ask --run-id $RUNBOOK_RUN_ID --gate 2.3-hitl --kind decision --prompt "..." --readout $RUN/2.2-digest/digest.md`.
3. **Answer it in the cityhall console** at `/runbook-runs/$RUNBOOK_RUN_ID` (Approve). Do NOT answer in chat — the chat path masks the bug.
4. `python3 $BUREAU/runbooks/lib/runbook_hitl_cli.py await-answer --run-id $RUNBOOK_RUN_ID --gate 2.3-hitl --decision-out $RUN/2.3-hitl/decision.json --decision-md-out $RUN/2.3-hitl/decision.md`.

Expected before fix: `KeyError: 'choice'`, exit 1, no `decision.json`. Expected after fix: `decision.json` = `{"schema_version":1,"status":"approved","decided_by":"<name>"}`, exit 0, `await-answer` prints `{answer, next_action, kind, status}`.

Unit-level (no run needed): call `project_decision_json({"status":"approved","decided_by":"x","schema_version":1})` — before fix it raises `KeyError`; after fix it returns the input unchanged (with `schema_version` defaulted). And `project_decision_json({"choice":"approved","decided_by":"x"})` must still return `{"schema_version":1,"status":"approved","decided_by":"x"}`.
