# Tool attribution is agent-supplied and unvalidated: phantom parent checklist IDs in vision tags, and `tools_used` self-reports that diverge from sidecar ground truth

> **Status:** Diagnosed 2026-07-16, fix NOT implemented. Root cause lives in **how tool→item attribution is produced** (the model volunteers `checklistItemIds[]` on vision calls and `tools_used[]` in findings; no layer validates either against the guide's atomic item list or the tool-call ledger) — it presents as inconsistencies in audit TSVs and per-item tool analytics; verdicts are NOT affected. Discovered on review `ed5e7ba9-ba03-4000-abb4-1021ebec0631` (v5 game day). This is a data-fidelity bug in the observability layer that winston#163 built — the capture is now excellent; the *labeling* is the weak link. Audit detail: run-6 `crc-audit-agent-3-observability-report.md` §Traceability, recs #4.

## Summary

Two related defects, one missing invariant:

**(a) Phantom parent IDs.** Agents tag vision calls with `checklistItemIds[]`. On the game-day run, 6 of those tags name **parent** IDs that exist in no guide and no consolidated output: `TPW-7` (×4), `TPW-10` (×1), `TPW-13` (×1) — the real atomic items are their children (`TPW-7.1`, `TPW-10.1/.2/.3`, …). Any consumer that joins tool calls to atomic items by ID silently drops these calls. (The audit agent initially also flagged `WQ-14`; re-verification shows `WQ-14` *is* a real consolidated item — the confirmed phantoms are the three TPW parents. That an auditor mis-flagged one is itself a symptom: nothing authoritative says which IDs are valid.)

**(b) Self-report divergence.** `findings[].tools_used` is the model describing its own behavior. Reconciled against the sidecar logs (ground truth), 6 items over-report and 3 under-report tool usage this run. That's 3–6× better than the run-4 baseline (19 over / 8 under — the winston#163 prompt work helped), but the residual is irreducible as long as the field is self-reported: 247 of 257 "no tools" item-runs are blank self-reports, not verified absences.

What is working: the capture layer is the best it's ever been — vision logs prompt+response with `checklistItemIds` and `runIndex` on 676/676 calls, semantic search logs `checklistItemId`+`runIndex` on 482/482 (server-stamped via env, can't be forgotten), and vision has a per-call `tool-calls/*.json` store. **The ground truth to derive attribution from now exists; nothing consumes it.**

Root cause in one sentence: **attribution flows from the model's memory instead of from the tool-call ledger the system already writes, and no validator rejects IDs that don't exist in the guide's atomic item list.**

## The bug in one diagram

```
                         THE GUIDE (authoritative atomic item list)
                         crc-TPW-1.md: TPW-7.1, TPW-10.1, TPW-10.2, … 
                                │
                                │  (nothing checks against this ✗)
                                │
 agent session ─────────────────┼──────────────────────────────────────────
   │                            │
   ├─ crc_vision_check({ checklistItemIds: ["TPW-7"] , … })   ← model volunteers
   │        │                                  ▲ PARENT ID — no such atomic item
   │        ▼                                                        ✗ unvalidated
   │   vision-log.jsonl / tool-calls/*.json   (faithful capture ✓ of a bad label)
   │
   └─ StructuredOutput findings[]:
        { checklistItemId: "TPW-10.1", tools_used: ["vision"] , … } ← model recalls
                                              ▲ self-report            ✗ unverified
                                                (6 items over, 3 under vs sidecar)
────────────────────────────────────────────────────────────────────────────
 consumers join on atomic checklistItemId:
   audit TSVs (tool-usage per item)      → TPW-7 rows match nothing, calls DROPPED ✗
   IG analytics / per-item tool costs    → same silent loss                        ✗
   consolidated perRunFindings.tools_used→ carries the self-report divergence      ✗

 the fix that's already half-built:
   tool-calls/*.json ledger (vision) ──► derive tools_used_measured server-side ✓
   (semantic search not yet covered by the ledger ✗)
```

## Symptom (as observed)

Run `ed5e7ba9`, 291 items × 5 runs = 1,455 item-runs:

- **Phantom tags:** joining every `vision-log.jsonl` `checklistItemIds[]` entry against the 291 consolidated item IDs leaves exactly 6 unmatched tags: `TPW-7` ×4, `TPW-10` ×1, `TPW-13` ×1. All are parents of real atomic items in the crc-TPW guides.
- **Self-report vs sidecar:** 6 items over-report (claim a tool the sidecar never saw them use) and 3 under-report (sidecar shows calls the finding doesn't claim). Baseline run-4: 19 over / 8 under.
- **Blank ≠ verified none:** 257 item-runs (17.7%) report no tools; 247 of those are empty self-reports with no ledger cross-check possible for semantic search (no per-call store) — only vision could be verified today.
- Consolidated headline rates (vision 75.5% of item-runs, semantic search 18.4%) are **self-report-based** in `consolidated-findings.json.perRunFindings[].tools_used`; the sidecar ground truth is 676 vision + 482 semantic-search calls.

## Evidence chain

1. **The phantoms are real and enumerable.** `jq` join of vision-sidecar tags vs consolidated `checklistItemId`s → exactly `{TPW-7: 4, TPW-10: 1, TPW-13: 1}` unmatched (verified directly, 2026-07-16). **Six vision calls are unattributable to any atomic item by exact join.**
2. **The parents are prompt-plausible, which is why the model produces them.** The guide's rows derive from MCR comments numbered TPW-7, TPW-10… whose *atomic* decomposition appended suffixes. A model reading "comment TPW-10" naturally tags `TPW-10`. **The ID scheme invites parent-level tags; only a validator can catch them** (and could even auto-expand a parent to its children).
3. **Self-report divergence persists across runs and models.** 19/8 on run-4 (haiku), 6/3 here (sonnet + winston#163 prompts). Better prompting shrank it; it did not close it. **A model attesting to its own tool usage is a memory task, and memory tasks have an error floor.**
4. **The ground truth already exists for vision.** `output/runs/run-*/tool-calls/*.json` files carry `toolUseId`, inputs (incl. `checklistItemIds`), response, usage, timing — 676 calls' worth. `semantic-search-blocks-log.jsonl` carries server-stamped `checklistItemId`+`runIndex` on all 482 calls. **Deriving per-(item×run) tool usage server-side is a pure join over data already on disk** — no model involvement.
5. **Nothing orchestrator-side does attribution today.** Zero occurrences of any "Applied tool attribution" event in the 96,460-line main log; `tools_used` passes from the model's emit straight into findings and consolidation. (Agent 3 §Traceability, point 2.)

## Root cause

Two absent checks, same invariant:

- `crc-vision-check` accepts `checklistItemIds[]` verbatim (`conductor/src/tools/crc-vision-check/index.ts` — the values flow into the sidecar and tool-call files with no lookup against the guide's item list).
- The review step accepts `findings[].tools_used` verbatim from StructuredOutput (schema requires the field but any strings pass; consolidation copies it into `perRunFindings[].tools_used`).

Missing invariant, precisely: **every checklist-item reference attached to a tool call or a finding must exist in the guide's atomic item set, and per-item tool usage must be derived from (or at minimum reconciled against) the tool-call ledger rather than trusted from the model.** Near-miss irony: winston#163 built exactly the ledger needed to compute the truth — the self-reported field survives out of inertia, not necessity.

## Impact

| Consumer / surface | Status | Mechanism |
|---|---|---|
| Review verdicts / consolidation | **unaffected** | `tools_used` and vision tags are metadata; voting ignores them |
| Audit TSVs (tool-usage per item, run-over-run tallies) | **affected** | phantom-tagged calls drop out of exact joins; self-report noise pollutes the per-item counts the tallies aggregate |
| IG vision analytics / any per-item cost accounting | **affected** | same joins, same silent loss; cross-run comparisons inherit each run's divergence |
| Future audits & agents | affected | each auditor re-derives validity by hand (and can err — the WQ-14 mis-flag); no authoritative valid-ID surface exists at analysis time |
| ⚠ Worst case | latent | as tool-attribution data starts driving decisions (e.g. "which items never get vision → guide gap analysis"), phantom-dropped calls and blank self-reports masquerade as coverage gaps that aren't real |

Deterministic: no — depends on model tagging behavior per run. Logged: the raw material is fully logged; the *defect* (unmatched IDs, divergence) surfaces only when an audit joins the data.

## Fix directions (not yet implemented — directions, not a mandate)

1. **Validate at the tool boundary:** `crc-vision-check` (and the semantic-search CLI) resolve the guide's atomic item list (it's in the guide file / findings schema context) and reject unknown `checklistItemIds` with an actionable message — or better, **auto-expand a parent ID to its children** (`TPW-10` → `TPW-10.1/.2/.3`) and note the expansion in the record.
2. **Derive, don't ask:** an orchestrator step (post-review, pre-consolidation) computes `tools_used_measured` per (item × run) from the tool-call ledger + semantic-search sidecar, stamps it into findings alongside the model's list renamed `tools_claimed`. Consumers migrate to `_measured`; divergence between the two becomes a free per-run health metric.
3. **Close the ledger gap:** extend the per-call `tool-calls/*.json` capture to semantic search (same shape: callId, inputs, results, elapsed, error) so fix #2 has uniform ground truth. (Run-6 audit rec #3.)
4. Cheap interim: add the phantom-ID join (evidence #1's jq) to the audit skill's standard checks so regressions are caught per-run.

## Prior art

- `semantic-search-blocks.ts`'s env-stamped attribution (`RUN_INDEX`/`CHECKLIST_ITEM` from the conductor tool env, "can't be forgotten by the model" — its own comment, bureau `workflows/comment-resolution-check/scripts/semantic-search-blocks.ts:86-91`) — the server-stamps-what-it-knows pattern fix #2 generalizes.
- The winston#163 tool-call ledger (`tool-calls/*.json`) — the ground-truth store fix #2 reads.
- Run-4 → run-6 self-report improvement (19/8 → 6/3) — evidence that prompting helps but cannot close it.

## Reproduction / verification recipe

1. **Phantoms:** from storage prefix `comment-resolution-check/23301a8a…/2026-07-14-183605/`, join `output/vision-log.jsonl` tags vs `output/consolidated-findings.json` IDs:
   ```bash
   jq -r '.checklistItemIds[]?' vision-log.jsonl | sort | uniq -c | sort -rn > tags.txt
   jq -r '.[].checklistItemId' consolidated-findings.json | sort -u > valid.txt
   # expect exactly: TPW-7 (4), TPW-10 (1), TPW-13 (1) unmatched
   ```
2. **Divergence:** for any item, compare `perRunFindings[].tools_used` against sidecar calls filtered by that `checklistItemId`+`runIndex` — the run-6 audit's `crc-audit-agent-3-tool-usage-current.tsv` (columns `used_vision`/`used_semantic_search`) vs the sidecar counts reproduces the 6-over/3-under set.
3. **Valid-ID authority:** the guide files under crc-guides bucket prefix `23301a8a…/cf1201c2…/4/6/` — the atomic item rows are the canonical list any validator should load.
4. **Acceptance test:** after fixes 1–2, a run has (a) zero unmatched tag IDs (or all expansions logged), (b) findings carrying both `tools_claimed` and `tools_used_measured` with divergence reported as a metric, and (c) the audit skill's Part A TSVs built from `_measured` with no manual reconciliation caveats.
