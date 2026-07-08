# Vision-Tool Comparison: Run A (b38e2619, vanilla `vision`) vs Run B (e5c5f7ab, `vision_check` experiment)

Same site plan (1700 S Lamar, project `23301a8a`), same checklist (`jurisdictions/austin/completeness-check/v2.7-trimmed`, verified in both `workflow/status.json` files), same 14 groupings × 5 runs = 70 cells, run ~1.5 h apart on 2026-07-08.

- **Run A**: review `b38e2619-91e4-4585-8e92-2fd32bbb9653`, stock prompt + vanilla `vision` tool. Downloaded to `/Users/wnavey/noetic/cc-audit/b38e2619-91e4-4585-8e92-2fd32bbb9653/cc-run-output` ("`A/`" below). Review step 14:26:51 → 14:38:41 UTC (~12 min, `A/workflow/run-log.json` step 0).
- **Run B**: review `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d`, `vision-check` overlay prompt + `vision_check` tool (classifier → generic-vision or inspect-drawing). At `/Users/wnavey/noetic/cc-audit/e5c5f7ab-c186-499d-908c-3d8fa5f86b6d/cc-run-output` ("`B/`"). Review step 15:20:50 → ~16:19 UTC (~58 min, wall-clock set by the cc-13 run-2 outlier cell).

## Summary

1. **Call volume: 150 → 279 (+129, +86%).** Exact counts: Run A made **exactly 150** vanilla vision calls (150 lines in `A/output/vision-log.jsonl`; 150 `"Calling vision tool"` lines in `A/logs/completeness-check.log`). The delta is **concentrated, not broad-based**: three groupings account for +98 of +129 — the two transportation groupings cc-22 (+34) and cc-23 (+31), whose Run B calls routed 80–87% to the new `inspect-drawing` specialist, and cc-13 (+33), which is almost entirely **one outlier cell** (run-2, 36 calls; cc-13's other four runs made 11, vs Run A's 14 across all five). Two groupings actually *dropped* (cc-1 and cc-20, −5 each). Retry-after-failure explains at most 9 of the 279 (Run A had zero failures, hence zero failure retries).
2. **Failure rate: 0/150 → 42/279 (all 42 on the generic path, 34% of its 124 calls).** This is **not a plumbing design difference** — vanilla `vision` and `vision_check`'s generic path call the *same* `getFileContent()` helper (`conductor/src/shared/vision-file.ts`), which does 2 Supabase DB queries + a storage download per call over the network. The failures are a ~23-minute degradation (15:31–15:54 UTC) of the fetch layer *inside the long-lived conductor process*: 36/36 network failures completed inside that window, hanging 3–16 minutes before dying in synchronized cohorts (18 at exactly 15:52:07). Meanwhile `inspect-drawing` — which downloads the *same* bucket per call but from a **fresh subprocess** — completed successfully 3–5×/minute through every failure minute (155/155). So: bad luck triggered it (Run A's identical plumbing pushed 150 calls at up to 28/min with zero failures an hour earlier), but the generic path's design **amplified** it (no fetch timeout, no retry, no local fallback, shared in-process connection pool).

---

## 1. Call-volume decomposition

### Counting methodology

- Run A: `grep '"msg":"Calling vision tool' A/logs/completeness-check.log` → 150 lines, each pino JSON with `item`, `runIndex`, `sheetNum`, `prompt` (e.g. line format at `A/logs/completeness-check.log`, first hit at ts 1783520865870). Cross-checked against `A/output/vision-log.jsonl` (150 entries, sidecar written by `conductor/src/tools/vision/index.ts:63-74`).
- Run B: 279 `metadata.json` dirs under `B/output/runs/run-*/vision-check-calls/`, cross-checked against 279 `"vision_check tool invoked"` log lines in `B/logs/completeness-check.log` (which carry `item` + `runIndex`).

### Per run-index

| runIndex | Run A (vanilla) | Run B (vision_check) | Δ |
|---|---|---|---|
| run-1 | 23 | 46 | +23 |
| run-2 | 30 | **100** | +70 |
| run-3 | 31 | 50 | +19 |
| run-4 | 31 | 32 | +1 |
| run-5 | 35 | 51 | +16 |
| **total** | **150** | **279** | **+129** |

Run A's five runs are tightly clustered (23–35). Run B's run-2 = 100 is inflated by the cc-13 run-2 cell (36 calls); without it run-2 = 64 — still the highest but in family with run-5's 51.

### Per grouping

| grouping | Run A | Run B | Δ | Run B routing (drawing_inspect / generic) |
|---|---|---|---|---|
| cc-22 Transportation Core (driveways/parking/ADA) | 22 | 56 | **+34** | 48 / 8 |
| cc-23 Transportation Infrastructure & Construction | 23 | 54 | **+31** | 42 / 12 |
| cc-13 Austin Water — General (37 items) | 14 | 47 | **+33** | 16 / 31 |
| cc-24 | 7 | 19 | +12 | 7 / 12 |
| cc-3 Cover Sheet Notes | 10 | 20 | +10 | 0 / 20 |
| cc-6 | 8 | 17 | +9 | — |
| cc-5 | 12 | 17 | +5 | — |
| cc-19 | 6 | 8 | +2 | — |
| cc-15 | 4 | 5 | +1 | — |
| cc-10 | 13 | 14 | +1 | — |
| cc-2 | 15 | 15 | 0 | — |
| cc-21 | 0 | 1 | +1 | — |
| cc-1 Intake & Core Submittal | 8 | 3 | **−5** | — |
| cc-20 Water Quality & Drainage Eng. | 8 | 3 | **−5** | — |

Top cells: Run A max cell = 6 calls (cc-2 run-3/run-4, cc-23 run-5). Run B: cc-13 run-2 = **36**, cc-23 run-2 = 16, cc-22 run-2 = 15, cc-22 run-5 = 13 — Run B's top 8 cells are all cc-22/cc-23/cc-13.

Breadth vs depth: cells using vision — A **54/70**, B **52/70** (essentially identical breadth). Average calls per vision-using cell: A **2.8**, B **5.4**. The doubling is *depth per cell in specific groupings*, not more cells reaching for the tool.

### Mechanism attribution of the +129

| Mechanism | Calls | Share | Evidence |
|---|---|---|---|
| Drawing-heavy transportation groupings adopting per-item `inspect-drawing` micro-questions (cc-22 + cc-23) | +65 | 50% | 90/110 of their Run B calls routed to `drawing_inspect`; Run A served the same groupings with 45 broad generic calls |
| cc-13 run-2 single outlier agent (loop-y evidence gathering; also the run's wall-clock driver, 3,499 s) | +33 | 26% | cc-13: A=14; B run-2 alone=36, B other 4 runs=11 ≈ A's rate |
| Broad remainder (cc-3 +10, cc-24 +12, cc-6 +9, cc-5 +5, others; net of cc-1/cc-20 −10) | +31 | 24% | table above |
| — of which failure-driven re-asks (unique to B; A had 0 failures) | ≤9 | ≤7% | 9/42 failed calls followed by a later successful call for the same (run, item); only 5 exact (run,item,question) duplicates in all 279 |

Question granularity confirms the classifier-invites-smaller-questions effect: Run B's 279 calls target **241 distinct (run, item) pairs** (274 distinct question strings) — i.e., ~1 narrow question per checklist item, as the tool's required `checklistItemId`/`checklistItemText` params encourage. Run A's vanilla tool has no item parameter, and its prompts are broad multi-part sweeps (e.g. the first Run A call, cc-24 run-1 sheet 53: a single prompt covering ROW plantings across *three* street frontages — `A/logs/completeness-check.log` ts 1783520865870).

### Fail-leaning (warn machinery dropped in overlay)

Run B failed more and warned less at the per-run finding level: **A = 548 pass / 57 fail / 29 warn / 336 n-a; B = 525 pass / 91 fail / 17 warn / 336 n-a** (both 969–970 findings, computed from `output/runs/run-*/findings/*.json` in each). In Run B, items that ended **fail got 0.80 vision calls per finding vs 0.32 for pass and 0.11 for n/a** (73 calls on fail items, 169 on pass, 36 on n/a, 1 warn) — so fail-leaning evaluation did pull disproportionate vision effort. But 61% of all Run B calls still landed on items that ended pass, so fail-leaning is a secondary contributor; the transportation/inspect-drawing granularity effect and the cc-13 outlier dominate.

---

## 2. Prompt comparison

Stock, Run A — `A/workflow/prompts/review.md:9-16` ("Using the Vision Tool"):

> * You have access to a vision tool for visual analysis of site plan sheets.
> * This tool is slow because it uses an LLM to analyze the source image. **Be judicious with its use.**
> * Every document and sheet in the primary site plan has already been run through the vision tool. If you just need to know what content is available, **read the existing output in the … site-plans folder first.**
> * Call the vision tool when existing visual analysis is not specific enough — when you have a targeted question that can only be answered by looking at the source content again.

Overlay, Run B — `B/workflow/experiments/vision-check/review.md:9-23` ("Using the Vision Check Tool"):

> * **For ANY question requiring visual inspection of a site plan sheet — measurements, drawing inspection, label reads, table reads, note-presence checks — call `vision_check`.** (line 11)
> * `vision_check` is slow … Be judicious with its use. (line 12)
> * … `checklistItemId`: the item ID exactly as it appears in your grouping file's checklist table … (line 16)
> * **Returns:** `{ answer, evidence, confidence, … }`. **Branch on `confidence` first; treat low-confidence answers as unclear rather than guessing.** (line 23)

Wording differences that plausibly change call frequency:

1. **Leading mandate vs leading availability.** The overlay's *first* bullet is an affirmative universal instruction ("For ANY question requiring visual inspection … call `vision_check`") placed *before* the "be judicious" and "read pre-processed data first" bullets. Stock leads with "you have access to" and puts judiciousness second. An instruction-following agent reads the overlay as "visual question ⇒ tool call," and the enumerated categories ("measurements, drawing inspection, label reads, table reads, note-presence checks") map ~1:1 onto checklist-item types — especially cc-22/cc-23's dimensional/geometry items.
2. **Per-item parameters shape per-item calls.** Requiring `checklistItemId` + verbatim `checklistItemText` per call (lines 16–17) frames the tool as a per-checklist-item verifier; Run B produced 241 distinct (run,item) targets. Vanilla's schema (`documentId`, `prompt`, `sheetNum` — `conductor/src/tools/vision/index.ts:83-100`) invites batched multi-item prompts, which is what Run A did.
3. **Confidence branching invites follow-ups** (line 23): treat low-confidence as unclear → ask again/differently. Contributes to the 38 extra calls beyond the first per (run,item) (34 multi-call pairs, of which only 11 involved a failure).
4. **Warn machinery dropped** in the overlay (fail-leaning: 91 vs 57 fails). Assessed above: real but secondary (~26% of calls went to eventual-fail items at 2.5× per-item intensity vs pass).

---

## 3. Plumbing comparison (code)

**The hypothesis "vanilla reads locally-provisioned images, generic-vision fetches over the network" is FALSE — they share the identical fetch path.**

- Vanilla `vision` (`conductor/src/tools/vision/index.ts:101-123`): handler calls `getFileContent({ documentId, sheetNum })` then `generateText` against `google/gemini-3.1-pro-preview` (line 131).
- `vision_check` generic path (`conductor/src/tools/vision-check/dispatch.ts:238-270`, `callGenericVision`): calls the *same* `getFileContent` (line 248), same model (line 282), same vision instructions.
- Shared helper `conductor/src/shared/vision-file.ts:33-101` (header, lines 3-6: "Used by `tools/vision/` and `tools/vision-check/dispatch.ts`"). Per call, at call time, over the network from inside the long-lived conductor node process:
  1. DB query `plan_set_version` (lines 41-47) → 2. DB query `sheet_version.thumbnail_storage_path` (lines 54-59) → 3. `supabase.storage.from('submission-data').download(thumbPath)` (lines 68-73) → base64 JPEG. Documents: `document_version` lookup + signed URL (lines 79-98).
  - **No timeout, no retry, no local cache** anywhere in this path. A hung storage fetch hangs the tool call (observed: 3–16 min).
- `inspect-drawing` specialist: subprocess-invoked bureau script (`conductor/src/tools/vision-check/dispatch.ts:814-887` → `runBureauScript`, spawning `npx tsx`). The script `bureau/workflows/completeness-check/scripts/inspect-drawing.ts` *also* downloads per call from the same `submission-data` bucket (`downloadAsset`, lines 385-397; sheet PDF download at line 807) — no cache either. The operative difference is **process isolation**: every call gets a fresh node process and therefore fresh TCP/TLS connections, bypassing whatever went wrong in the parent process's pooled fetch layer.

The only "local-first" vision tool in the codebase is `vision_local` (`conductor/src/tools/vision-local.ts`, reads a workspace file path) — used by surveyor-style workflows, not by either of these runs (Run A's review step tools: `A/workflow/workflow.yaml:160-162` — `vision` + `script:semantic-search-blocks` only).

---

## 4. Failure analysis

### Run A: zero failures, confirmed

- `A/logs/completeness-check.log` (29,291 lines): **0** `"level":50` lines, **0** `fetch failed` matches.
- `A/output/vision-log.jsonl`: 150/150 `"success":true` (`vision:result`); zero `vision:error`.
- `A/logs/completeness-check-error.log` has exactly 1 line — an unrelated level-40 `run_semantic_search_blocks` arg error (cc-13 run-4).
- All 150 calls fired in a **9-minute window (14:27–14:36 UTC), peaking at 28 calls/min** — heavier instantaneous fetch pressure through the same `getFileContent` singleton than Run B ever produced, with zero failures. So concurrency alone does not break this path.

### Run B: 42 failures, all on the generic path (34% of 124)

Breakdown from `dispatch.errorMessage` across the 279 `metadata.json` files:

| class | n | messages |
|---|---|---|
| network fetch | **36** | 30× "Failed to download sheet thumbnail: fetch failed", 4× "DB error fetching plan_set_version: TypeError: fetch failed", 1× "DB error fetching document_version…", 1× "Failed to create signed URL: fetch failed" |
| gateway 5xx | 4 | 3× GatewayInternalServerError (after 3 attempts), 1× non-retryable GatewayResponseError |
| agent misuse | 2 | wrong ID passed: `No plan set version found for plan_set_id: 777f2782…` (cc-20 run-5 passed the *project* ID); `No document version found for document_id: 908ffab5…` (plan-set ID passed without `sheetNum`, so it took the document branch) |

Note Run A also made 4 calls with the same wrong ID `777f2782` (log msgs "Calling vision tool: 777f2782-… (undefined)") — vanilla logged them as successes only because that misuse class returns the "File could not be loaded" text; per `A/output/vision-log.jsonl` all 150 were `success:true`, meaning those 4 resolved (they queried with no sheetNum → document branch may have found a document_version for that ID). Agent-misuse is a shared, minor issue in both runs.

**Timing (per-call `startedAt`/`completedAt`):**

- All 36 network failures **started** 15:23–15:50 and **completed** 15:34:31–15:54:24 — a single ~23–31 min degradation window. Zero network failures before 15:31 or after 15:54:31.
- Failed calls hung **3–16 minutes** before erroring (failed durations: min 179 s, median 398 s, max 960 s; successful generic median 191 s) and died in **synchronized cohorts**: 5 at 15:41:09–11, 18 at exactly **15:52:07** (starts spread 15:44:34–15:48:48), 5 at 15:54:24. That signature — long hangs, batch aborts — is stale/hung pooled connections (undici keep-alive sockets inside the conductor process) collapsing together, not independent request-level flakes.
- **The sandbox network was fine for fresh connections the whole time**: `inspect-drawing` subprocesses completed successfully 3–5 per minute in *every* failure-window minute (15:31 ×4, 15:41 ×3, 15:52 ×3, 15:54 ×3 …), each performing its own Supabase DB lookups + storage download. And the generic path itself recovered completely at 15:55 — 53 consecutive successes, 0 network failures, 15:55–16:16.
- The 4 gateway 5xx (15:31–15:39 completions, 9–16 min durations) plausibly share the same in-process cause.

**Structural vs luck:**

- *Not* an inherent fetch-path design difference: identical `getFileContent` code in both tools. Had Run A executed at 15:45Z in that sandbox, its 150 calls would have hit the same wall — and conversely, Run B's generic path ran clean (53/53 network-wise) once the window passed.
- *But* the generic path is **structurally more exposed** than inspect-drawing, and the design amplified the bad luck: no fetch timeout (calls hang 16 min), no retry (33/42 failures were never re-asked; only 9 recovered via the agent spontaneously re-calling), no local fallback, and a single shared in-process connection pool as a failure domain for all 124 generic calls. One transient network event → 23 minutes × every in-flight generic call poisoned, while the subprocess-per-call specialist sailed through 155/155.
- Quantified: **failures inside the 15:31–15:54 completion window: 42/42 (network: 36/36). Outside: 0.**
- One degraded vote reached findings (run-4 CC-3-17, per the review audit) — failures are otherwise invisible in outputs.

---

## 5. Recommendations

1. **Timeout + retry-with-backoff in `getFileContent`** (`conductor/src/shared/vision-file.ts`): wrap the two DB queries and the storage download in an `AbortSignal.timeout(~30s)` and retry ×3 with jittered backoff. The observed 3–16-minute hangs mean there is effectively no timeout today; a 30 s abort + retry on a fresh connection would likely have converted most of the 36 network failures into slow successes (fresh-connection traffic succeeded throughout, per inspect-drawing).
2. **Local-first sheet imagery.** Sheet thumbnails are small, pre-processed, and enumerable at provisioning time; stage them into the sandbox workspace during resource prep (alongside `site-plans/`), and have `getFileContent` prefer the local file, falling back to network. Run B touched only ~50 distinct sheets — trivial to pre-stage. Precedent already exists in-tree (`conductor/src/tools/vision-local.ts` reads local paths). This removes the DB round-trips per call too (the plan-set→version→sheet resolution is static per run).
3. **Isolate or refresh the fetch layer.** If pre-staging is deferred: use a dedicated undici `Agent` (or `fetch` with `dispatcher`) for vision fetches so a poisoned pool can be torn down and rebuilt on failure — or subprocess the generic fetch the way `inspect-drawing` subprocesses everything (proven immune here, 155/155).
4. **Tool-level auto-retry + finding-level visibility.** On `success:false`, retry once inside `dispatch.ts` before returning; stamp a `degradedEvidence` marker into the returned payload and require it be reflected in `observation`. 33/42 failures were silently absorbed with no re-attempt.
5. **Call-budget guidance in the overlay prompt** (`bureau/workflows/completeness-check/experiments/vision-check/review.md`): restore the stock ordering (pre-processed-data-first and "be judicious" *before* the capability mandate), soften "For ANY question requiring visual inspection … call `vision_check`" to "when pre-processed data can't answer it," and add an explicit budget ("typically ≤1 `vision_check` per checklist item; batch related questions about the same sheet"). cc-13 run-2's 36-call loop also set the step's 58-minute wall-clock — a per-cell cap (~15) is cheap insurance.
6. **Rebase the overlay onto the current stock prompt to restore warn machinery** (already flagged in the review audit). The fail-leaning shift (57 → 91 per-run fails) both distorts outcomes and feeds extra evidence-gathering (fail items drew 0.80 calls/finding vs 0.32 for pass).
7. **Keep inspect-drawing** — the volume it added is concentrated exactly where a measurement specialist should be used (cc-22/cc-23 dimensional items), it ran 155/155, and its per-call cost profile (median 67 s vs generic 147–191 s) is favorable. The "extra" calls are mostly smaller, cheaper, better-targeted questions, not waste; the budget guidance above is about the loop/outlier tail, not the specialist.

## Appendix: key artifact paths

- Run A log: `/Users/wnavey/noetic/cc-audit/b38e2619-91e4-4585-8e92-2fd32bbb9653/cc-run-output/logs/completeness-check.log`
- Run A vision sidecar: `.../cc-run-output/output/vision-log.jsonl` (150 entries, 0 failures)
- Run A stock prompt: `.../cc-run-output/workflow/prompts/review.md` (vision section lines 9–16)
- Run B call artifacts: `/Users/wnavey/noetic/cc-audit/e5c5f7ab-c186-499d-908c-3d8fa5f86b6d/cc-run-output/output/runs/run-*/vision-check-calls/*/metadata.json` (279)
- Run B overlay prompt: `.../cc-run-output/workflow/experiments/vision-check/review.md` (vision_check section lines 9–23)
- Shared fetch helper: `/Users/wnavey/noetic/conductor/src/shared/vision-file.ts:33-101`
- Vanilla tool: `/Users/wnavey/noetic/conductor/src/tools/vision/index.ts:101-131`
- Generic specialist: `/Users/wnavey/noetic/conductor/src/tools/vision-check/dispatch.ts:238-325`
- inspect-drawing script: `/Users/wnavey/noetic/bureau/workflows/completeness-check/scripts/inspect-drawing.ts:385-397,807`
