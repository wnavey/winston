# Run-3 grouping-13: Schema-Validation Data-Loss Bug

**Review:** `3509b097-764e-4962-b023-8d8ae8fd7a4c` · workflow run `04252e6b-cf95-43f2-9705-cca869b2ca80` · 2026-04-28T22:36Z

A second harness bug — distinct from the cc-13 stop-hook+compaction drift, but exploiting the same last-call-wins persistence — discarded **34 of 38 findings** that run-3 produced for the EL-13 (Transformer Pad) grouping.

---

## TL;DR

> Run-3 evaluated grouping 13 thoroughly and submitted **38 findings** via `StructuredOutput` at 22:24:15. The schema validator rejected the call because *one* finding (index 37) had an `agentTrace` missing the required `tools_used` field. 13 seconds later, the agent re-emitted with **only the 4 findings whose `agentTrace` already had `tools_used` populated**, dropping 34 valid findings. The orchestrator persisted the second call as canonical (last-call-wins). 34 EL-13 deficiencies that run-3 had documented are absent from the merged review.

---

## Evidence

### Two StructuredOutput calls, ten seconds apart

```bash
$ grep '"runIndex":"run-3"' review.log | grep '"item":"13.md"' \
    | grep '"name":"StructuredOutput"' \
    | jq -c '{time, n: (.message.content[] | select(.type=="tool_use" and .name=="StructuredOutput") | .input.findings | length)}'
{"time":1777415055..., "n":38}
{"time":1777415068..., "n":4}
```

### Validator's rejection of the 38-item call

The `tool_result` block on the first call:

```
Output does not match required schema:
/findings/37/agentTrace: must have required property 'tools_used'
```

Index 37 = the 38th finding in the array. **That single finding was the only validation failure** — the other 37 findings were schema-valid.

### Agent's recovery (the bug behavior)

Between the two calls, the agent's wrap-up text:

> "Let me correct the output format and provide the findings:"

13 seconds later, the second call:

```
deficiency IDs: EL-13.1, EL-13.34, EL-13.37, EL-13.38
```

These 4 IDs are a **strict subset** of the original 38. The agent didn't fix the missing `tools_used` field on finding #37 — it dropped 34 unrelated findings to avoid the validation error.

### Persisted file matches the second call

```bash
$ jq '[.findings[].deficiencyId] | sort' \
     output/runs/run-3/findings/13.md.json
["EL-13.1", "EL-13.34", "EL-13.37", "EL-13.38"]
```

So `runs/run-3/findings/13.md.json` reflects only ~10% of run-3's actual evaluation work. The other 90% lives only in the conductor log.

---

## Counterfactual: variance with the lost data restored

Reconstructing run-3's true 38-item finding set from the conductor log and recomputing detection rates per ref:

| Status | Currently | With run-3 restored | Δ |
|---|---:|---:|---:|
| Refs at 5/5 (unanimous) | 11 | **24** | **+13** |
| Refs at 4/5 | 16 | 18 | +2 |
| Refs at 3/5 | 10 | 13 | +3 |
| Refs at 2/5 | 25 | 22 | -3 |
| Refs at 1/5 | 22 | 14 | -8 |

13 EL-13 items would jump from 4/5 to 5/5 (unanimous). 8 items currently at 1/5 would be at 2/5. The "high-confidence true issue" tier (`>=4/5`) would grow from 27 to 42 refs — **the data-loss bug is hiding 15 items' worth of real consensus.**

Specifically, these 13 items would be unanimous after restoration: `EL-13.10, 13, 21, 22, 23, 25, 27, 28, 31, 32, 33, 35, 36, 7`. All currently appear in the merged review at 4/5 detection (with run-3 missing). With run-3's full data, they'd be at 5/5.

---

## Why the schema validation failed in the first place

The schema declares `tools_used` as required inside `agentTrace`:

```jsonc
{
  "agentTrace": {
    "type": "object",
    "required": ["observation", "reasoning", "tools_used"],
    ...
  }
}
```

Run-3's finding #37 had an `agentTrace` object missing the `tools_used` field. The model populated `observation` and `reasoning` for that finding but forgot to add the `tools_used` array. Why this happened to one finding out of 38 is itself stochastic — likely a model-attention drop on that specific item.

The right behavior on a single missing field would be to fix that one finding, not to drop 34 others. The agent's choice to drop is itself a model behavior; the *harness* design that allows the agent's recovery output to silently overwrite the rejected one is the operational bug.

---

## How this connects to the cc-13 last-call-wins bug

The [cc-13 root-cause analysis](../../../cc/1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/run-2-drift-root-cause.md) identified five harness bugs ranked by leverage. **Bug 1 (idempotent / first-success-wins StructuredOutput) directly addresses both failure modes:**

| Failure mode | cc-13 (run-2) | review (run-3 13.md) |
|---|---|---|
| Trigger | Stop-hook fires post-compaction | Schema validator rejects 1 of 38 findings |
| Recovery | Agent re-emits, drifted scope | Agent re-emits, fewer findings |
| Persistence | Last call wins → drift overwrites correct | Last call wins → fewer overwrites complete |
| Findings affected | 13 added + 5 dropped (cc-13 split) | 34 dropped |

In both cases, the agent's *first* successful StructuredOutput call had the most complete and accurate data. The bug is letting subsequent calls overwrite it.

If the orchestrator made the first valid StructuredOutput canonical:
- cc-13 would have 37 v2.5 items (correct), not 45 (drifted)
- review run-3 13.md would have 38 items (correct), not 4 (lossy)

Same one-line fix, two different workflows, two different trigger conditions, same data corruption.

---

## Other review tasks with multiple StructuredOutput calls (for completeness)

In this review, **4 of 15 agent tasks (27%)** had >1 StructuredOutput call. Three of them were benign (the agent voluntarily added more findings on the second call, with the second call being a strict superset of the first):

| Task | Call #1 | Call #2 | Outcome |
|---|---:|---:|---|
| run-1 13.md | 8 ids | 23 ids (superset) | OK — second call a strict superset |
| run-3 2.md | 7 ids | 15 ids (superset) | OK — second call a strict superset |
| **run-3 13.md** | **38 ids** | **4 ids (strict subset)** | **34 findings lost** |
| run-5 13.md | string-encoded payload (49KB, schema rejected) | 39 ids | OK — string was wrong type, retry succeeded |

The benign cases (run-1 13.md, run-3 2.md) still consume tokens unnecessarily — the agent making a "let me add more" decision after a successful StructuredOutput is itself wasted work that could be eliminated by terminating the task on first success.

The string-encoded-payload case (run-5 13.md) reproduces the same wrong-type bug that occurred in cc-13's first attempt. The agent serialized `findings` as a JSON string instead of a list. A schema validator rejection forced a retry. **This pattern should also be caught client-side** — the StructuredOutput tool wrapper should reject a string-typed `findings` parameter immediately, with a specific error like "findings must be an array of objects, not a JSON-encoded string".

---

## Reproducing this analysis

```bash
# Find tasks with multiple StructuredOutput calls
grep '"name":"StructuredOutput"' review.log \
  | jq -c '{runIndex,item,time,n: (.message.content[] | select(.type=="tool_use" and .name=="StructuredOutput") | .input.findings | (if type=="array" then length else "string("+(length|tostring)+")" end))}' \
  | jq -s 'group_by([.runIndex,.item]) | map(select(length > 1))'

# For each multi-SO task, diff the call payloads
# (extract findings IDs and compare sets)

# Schema rejection messages
grep '"runIndex"' review.log | grep -i 'does not match required schema'
```

The grep recipes from the cc-13 root-cause doc (Stop-hook, compaction, multiple-StructuredOutput detection) all generalize to review and any other workflow that uses the same Claude Code agent harness.

---

## Recommendation

The fix is the same as for cc-13: **make StructuredOutput idempotent at the orchestrator level**. The first valid (schema-passing) StructuredOutput call for an agent task is canonical; subsequent calls are no-ops or hard errors. Single-line orchestrator change.

This is already tracked in beads `workspace-925` (inspector-general timeline + drift detection). The IG side flags `outputDriftSuspected=true` so downstream consumers know the persisted findings file may be incomplete or wrong; the conductor-side fix prevents the drift from happening in the first place.
