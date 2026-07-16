# crc-vision-check: a supporting-document UUID passed WITH `sheetNum` is routed down the plan-set lookup and always crashes — the agent is told only "File could not be loaded."

> **Status:** Diagnosed 2026-07-16, fix NOT implemented. Root cause lives in **conductor's shared vision file resolver** (`src/shared/vision-file.ts`) plus an error-opacity gap in `src/tools/crc-vision-check/index.ts` — it presents as flaky vision-tool failures on specific checklist items; it isn't flakiness. Discovered on review `ed5e7ba9-ba03-4000-abb4-1021ebec0631` (v5 game day, 2026-07-14), 3 failed calls in `crc-SP-1` cells. Successor to the run-4 audit's "filename-as-UUID" error-opacity finding (same class — opaque vision errors hiding an input-shape problem — new costume: last time input validation, this time **document-type routing**). Audit detail: run-6 `crc-audit-agent-3-observability-report.md` §Errors.

## Summary

The vision tool's file resolver branches on **`sheetNum` presence alone**: any call with `sheetNum ≥ 1` is assumed to target the primary plan set and looks up `plan_set_version WHERE plan_set_id = documentId`. When an agent passes a *supporting document's* UUID together with a sheet number — a perfectly natural request ("look at page 1 of the Property Profile Maps") — that lookup finds nothing by construction and throws `No plan set version found for plan_set_id: <uuid>`. The catch block tells the agent only *"File could not be loaded. Are you using a valid documentId?"* — a misleading hint, since the documentId is valid; it's the `sheetNum` that must be dropped. The sidecar error record carries **no reason at all**.

What worked: the same UUID called *without* `sheetNum` resolved fine (3 successes, full property-profile analysis returned), the document-branch code, and the agent itself — which, given zero useful feedback, empirically discovered the workaround 44 seconds later. What's broken is one unguarded routing assumption plus the swallowed exception message.

Root cause in one sentence: **`getFileContent` uses `sheetNum` as a proxy for "this is a plan set" instead of checking what the documentId actually is, and the caller discards the exception detail that would have told the agent (and the sidecar) what went wrong.**

## The bug in one diagram

```
 agent (crc-SP-1, items SP-15.1–15.4: airport/military/industrial proximity)
        │  crc_vision_check({ documentId: e3412be0-…  ← "Austin Property Profile Maps"
        │                     sheetNum: 1,               (SUPPORTING DOCUMENT, not a plan set)
        │                     checklistItemIds: [SP-15.1…], prompt: … })
        ▼
 conductor/src/shared/vision-file.ts  getFileContent()
 ┌───────────────────────────────────────────────────────────────────┐
 │  if (sheetNum != null && sheetNum > 0) {        ← ROUTING BY      │
 │      // "Primary site plan sheet" path            SHEETNUM ALONE ✗│
 │      SELECT id FROM plan_set_version                              │
 │       WHERE plan_set_id = 'e3412be0-…'   ← doc UUID ≠ plan_set_id │
 │      → 0 rows, ALWAYS, by construction                            │
 │      → throw "No plan set version found for plan_set_id: …"       │
 │  }                                                                │
 │  // document branch (signed URL) — NEVER REACHED with sheetNum ✓  │
 └───────────────────────────────────────────────────────────────────┘
        │ throw
        ▼
 crc-vision-check/index.ts:347 catch
   logger.error(real reason)  ──────────► main log ONLY (level 50)      ✓ recorded
   sidecar `crc-vision:error`  ────────► NO reason field                ✗ opaque
   agent sees: "File could not be loaded. Are you using a valid        ✗ misleading —
                documentId?"                                              the ID is valid;
        │                                                                 sheetNum is the problem
        ▼
 agent retries blind → 3 failures (~90 s each) → eventually retries
 WITHOUT sheetNum (44 s later) → SUCCESS ✓  (agent reverse-engineered the fix)
```

## Symptom (as observed)

Run `ed5e7ba9`, guide `crc-SP-1` (items SP-15.1–SP-15.4 — verify site proximity to airports/military/industrial uses against the Austin Property Profile Maps supporting document):

- 3 × `crc-vision:error` in `output/vision-log.jsonl` — all `documentId: e3412be0-07b0-4378-8a60-a38736dbbf60` **with** `sheetNum` (1 or 2): crc-SP-1/run-1 ×2 (17:32:19, 17:33:48Z) and crc-SP-1/run-4 ×1 (17:48:31Z). Error lines carry `success:false` and **no reason**.
- 3 matching level-50 lines in `logs/comment-resolution-check-error.log`: `Error: No plan set version found for plan_set_id: e3412be0-…` at `vision-file.ts:51` via `crc-vision-check/index.ts:347`. Also 5 `Calling crc-vision-check: e3412be0…` attempts incl. 3 with `sheet undefined`.
- The **same documentId without `sheetNum` succeeded 3 times** (runs 1, 3, 5) with full analysis returned.
- Paired tool-call files prove the sequence inside one session: `output/runs/run-1/tool-calls/2026-07-14T17-32-19-834Z-crc_vision_check-204-3vpmoa.json` (sheetNum 1, `response.isError: true`) → `…17-33-03-472Z-…-217-llv1oe.json` (sheetNum null, success), 44 seconds apart.

Tempting-but-wrong first guesses: *"hallucinated UUID"* (no — the UUID is real and resolves on the document branch; contrast with run-4's filename-as-UUID case, which WAS an invalid ID) and *"transient DB/storage failure"* (no — deterministic: 3-for-3 failure with sheetNum, 3-for-3 success without, same run).

## Evidence chain

1. **The failing lookup cannot ever succeed for a document UUID.** `vision-file.ts:39-52`: the `sheetNum` branch queries `plan_set_version.plan_set_id = documentId`. `e3412be0-…` is a `document.id` (the Property Profile Maps supporting doc), not a `plan_set.id` — **zero rows is the guaranteed result, so this is a routing bug, not a data problem.**
2. **The document branch handles the same ID fine.** `vision-file.ts:82-109` resolves `document_version` by `document_id` and returns a signed URL — the 3 sheet-less successes went through it. **The only difference between failure and success is the presence of `sheetNum`.**
3. **The real reason never reaches the agent or the sidecar.** `crc-vision-check/index.ts:347-380`: the catch logs the exception to the main log, then writes a sidecar `crc-vision:error` with no error field and returns `"File could not be loaded. Are you using a valid documentId?"` to the model. **The one actionable fact — "omit sheetNum for supporting documents" — exists only at level 50 in a 112 MB log.**
4. **The agent's blind recovery proves the cost of the opacity.** Same session, 44 s later, the agent retried sheet-less and succeeded (tool-call file pair above). With an actionable error it would have been one turn; instead run-1 burned two failures and run-4 one (~90 s each), and **nothing prevents every future session from re-paying this tax** — the workaround lives in no prompt or guide.

## Root cause

`conductor/src/shared/vision-file.ts:39` — the routing predicate:

```ts
if (sheetNum != null && sheetNum > 0) {
    // Primary site plan sheet — plan_set → latest version → sheet → thumbnail.
    const { data: planSetVersion, error: pvError } = await supabase
      .from('plan_set_version')
      .select('id')
      .eq('plan_set_id', documentId)   // ← documentId assumed to be a plan_set.id
      …
    if (!planSetVersion) {
      throw new Error(`No plan set version found for plan_set_id: ${documentId}`);
```

Missing invariant, precisely: **`sheetNum` is caller-supplied intent, not evidence of document type — the resolver must verify `documentId` is actually a plan set before taking the plan-set path (or fall through to the document path when it isn't).** Compounding gap at `crc-vision-check/index.ts:369/380`: the thrown message is replaced by a generic string, and the sidecar's error record omits a reason entirely (also the run-4 audit's rec #2, still unimplemented). Near-miss irony: the tool's own doc comment ("Plan-set ID (sheets) or document ID (supplementary docs)") states the union type that the code never discriminates.

## Impact

| Surface | Status | Mechanism |
|---|---|---|
| SP-15.x verdicts this run | **partially affected** | run-1/run-4 sessions lost their first vision attempts on the proximity checks; both recovered via the agent's own workaround, findings produced |
| Agent time / cost | affected (small this run) | ~90 s per failed call + retry turns; recurring tax on every future session that tries doc+sheetNum |
| ⚠ Worst case: silent evidence downgrade | **latent** | an agent that does NOT discover the workaround gives up on the document and verdicts on weaker evidence — invisible, since the sidecar records no reason and the finding just cites other sources |
| Any workflow sharing `getFileContent` (`tools/vision/`, `tools/vision-check/` = CC) | **affected, latent** | same resolver, same routing hole — CC's vision path will crash identically on doc+sheetNum |
| Observability / audits | affected | `crc-vision:error` without reason forces every investigation through the main log (this is the second audit in a row to flag it) |

Deterministic: yes, for any (supporting-document UUID, sheetNum≥1) pair. Logged: real reason in main log only. Cheap detector: sidecar error lines where `documentId` joins to `document.id` but not `plan_set.id`.

## Fix directions (not yet implemented — directions, not a mandate)

1. **Type-check the route** in `getFileContent`: when `sheetNum` is present, verify `documentId` is a plan set (the existing `plan_set_version` probe already does this — treat 0 rows as "not a plan set" instead of throwing); if it resolves as a `document.id`, either fall through to the document branch (serve the doc, note the ignored `sheetNum`… only safe if page-level targeting isn't expected) or return a **typed, actionable error**: `"<uuid> is a supporting document — call again without sheetNum to receive the full document."` The typed error is the safer default.
2. **Stop swallowing the reason**: `crc-vision-check/index.ts` should pass the caught message into (a) the agent-visible response, (b) the sidecar `crc-vision:error` record, and (c) the tool-call file's `error` field. (Run-4 audit rec #2; run-6 rec #2 — third time filing it.)
3. **Guide/prompt note** (cheap mitigation until 1 lands): the SP-1 guide's documents-to-review section can state that Property Profile Maps is a supporting document — reference it without `sheetNum`.
4. Apply the same fix to the CC vision path (`tools/vision-check/dispatch.ts` consumes the same resolver).

## Reproduction / verification recipe

1. **Incident data:** storage prefix `comment-resolution-check/23301a8a…/2026-07-14-183605/`. In `output/vision-log.jsonl`, the 3 `crc-vision:error` lines (17:32:19Z, 17:33:48Z, 17:48:31Z) all carry `documentId: e3412be0-07b0-4378-8a60-a38736dbbf60` + a `sheetNum`; in `logs/comment-resolution-check-error.log`, the 3 matching `No plan set version found` stacks.
2. **The discriminating pair:** `output/runs/run-1/tool-calls/2026-07-14T17-32-19-834Z-crc_vision_check-204-3vpmoa.json` (sheetNum 1 → `isError:true`) vs `…17-33-03-472Z-…-217-llv1oe.json` (sheetNum null → success). Same session, same UUID.
3. **Confirm the type mismatch in the DB:** `SELECT id FROM document WHERE id = 'e3412be0-…'` → 1 row (Property Profile Maps); `SELECT id FROM plan_set WHERE id = 'e3412be0-…'` → 0 rows.
4. **Acceptance test for the fix:** invoke `crc_vision_check` with that documentId + `sheetNum: 1` — expect either the document served or an error naming the supporting-document/sheetNum conflict; the sidecar error record (if any) carries the reason string; and a run-over-run grep shows doc+sheetNum calls no longer produce reason-less `crc-vision:error` lines.
