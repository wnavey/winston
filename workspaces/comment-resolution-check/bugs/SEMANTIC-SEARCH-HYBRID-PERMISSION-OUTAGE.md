# Semantic-search hybrid mode silently dead on cloud runs: `workflow_run` role lacks USAGE on schema `extensions`

> **Status**: Diagnosed 2026-07-16, fix NOT implemented. Root cause lives in **substation's DB migrations** (a missing one-line grant), not in the search script, the RPC, or the CRC workflow — it presents as a "semantic search returns nothing" tool bug; it isn't one. Discovered by the `audit-crc-run` skill (Agent 3) on the v5 game-day run: review `ed5e7ba9-ba03-4000-abb4-1021ebec0631`, workflow_run `87370792-9453-4dbd-8141-8b812f29717a`, project 1700 S Lamar (`23301a8a-4cdb-4751-ac0c-93b97f0f5c12`), 2026-07-14. Audit reports: `workspaces/comment-resolution-check/1700-S-Lamar/crc-run-audits/run-6-audit/` (see `crc-audit-agent-3-observability-report.md`). Related: bureau#574 (Sec Wave 9 Round 1), winston#166 (run-token flag spec).

## Summary

On every **cloud** CRC run since 2026-07-11, the `semantic-search-blocks` tool's hybrid (vector + keyword) search mode fails on 100% of calls with the Postgres error `permission denied for schema extensions`, silently falls back to keyword-only search, and the keyword fallback returns **zero results ~95% of the time** because agent queries are written for embedding similarity, not literal keyword match. On the v5 game-day run, all 482 semantic-search calls across 140 checklist items ran in this degraded mode; the review agents were never told anything failed — they saw empty result lists and compensated with ~2.8× more vision calls (2.89M vision tokens, ~5× the prior baseline).

What is working correctly, and should not be touched: the `search_content_blocks_hybrid` RPC itself (correct SQL, correctly pinned `search_path`), the script's fallback logic and its sidecar logging (which is precisely what recorded the outage), the keyword RPC, substation's run-token minting, and the RLS policies. The consolidation, voting, and DB save downstream all worked exactly as designed on degraded evidence.

Root cause in one sentence: **two individually-correct security migrations two days apart** — 2026-07-09 moved the `vector` extension out of `public` into the `extensions` schema; 2026-07-11 created the new `workflow_run` Postgres role with `GRANT USAGE ON SCHEMA public` only — and nobody granted the new role USAGE on `extensions`, so the SECURITY INVOKER hybrid RPC cannot resolve its own `search_path` when called by a cloud run.

## The bug in one diagram

```
CLOUD RUN (substation → Vercel Sandbox → conductor → agent cell)
────────────────────────────────────────────────────────────────
 substation mints short-lived JWT ──── role claim: workflow_run          ✓ by design (Sec Wave 9)
        │
        ▼
 semantic-search-blocks.ts  (bureau/workflows/comment-resolution-check/scripts/)
        │  createRunScopedClient()            ✓ correct (bureau#574)
        │  OpenAI embedding generated         ✓ works (OPENAI_API_KEY present)
        ▼
 supabase.rpc('search_content_blocks_hybrid', {...})
        │
        ▼  PostgREST executes as role: workflow_run
 ┌──────────────────────────────────────────────────────────────┐
 │ search_content_blocks_hybrid                                 │
 │   SECURITY INVOKER  (runs as caller = workflow_run)          │
 │   SET search_path = public, extensions                       │
 │                              └────────┐                      │
 │   workflow_run USAGE on public     ✓  │                      │
 │   workflow_run USAGE on extensions ✗ ◄┘  ← THE BUG           │
 │   → ERROR: permission denied for schema extensions           │
 └──────────────────────────────────────────────────────────────┘
        │
        ▼  script catches error, logs sidecar event, falls back   ✓ by design — but SILENT
 supabase.rpc('search_content_blocks_keyword', {...})
        │   SET search_path = public   → no extensions needed   ✓ succeeds
        ▼
 keyword match on embedding-style NL queries → 0 results 95.4%   ✗ useless output
        │
        ▼
 agent sees "[]"  — no error, no warning                          ✗ silent degradation
 agent compensates with vision tool (2.8× calls, 5× tokens)
 verdicts produced on vision-only evidence                        ⚠ quality unquantified

LOCAL RUN (conductor/.env workaround: service_role JWT as run token)
────────────────────────────────────────────────────────────────
 role: service_role → USAGE on extensions ✓ → hybrid works ✓     ← why 07-13 baseline masked it
```

## Symptom (as observed)

On review `ed5e7ba9` (runLabel `2026-07-14-v5-crc-game-day-run-1`, 5 runs × 24 dept guide files, sonnet-4-6, first customer-facing CRC run):

- `output/semantic-search-blocks-log.jsonl` (1,446 lines): 482 `:start` events, **482 `:hybrid-error` events** (100%), 482 `:result` events all with `"mode": "keyword"`.
- **460/482 results (95.4%) had `resultCount: 0`.** Only 22 calls across 15 items returned anything, and only where the query contained a distinctive literal string (e.g. `AW-RL-6` "Austin Water meter abandonment detail" → 3 blocks; `CA-22` "Appendix P-2 tree protection plan note" → 1 block).
- 140 distinct checklist items used the tool; **125 got zero results on every call they made**, including heavy users `CM-4` (11 calls), `LDE-1` (10), `EV-18` (9), `CA-21` (8), `OWB-2` (8), `SP-32.3` (8), `F-4` (8), and redline items `AW-RL-1` (3), `AW-RL-9` (1).
- Vision sidecar shows the compensation: 676 vision calls (vs ~240-equivalent baseline rate), 2.89M tokens.

Tempting-but-wrong first guesses, eliminated by the data:

- *"OPENAI_API_KEY missing → keyword fallback"* — no; that path logs `OPENAI_API_KEY not set` to stderr and never emits `:hybrid-error`. The 482 hybrid-error events prove the embedding was generated and the RPC was reached.
- *"The RPC is broken / bad migration to the function"* — no; the same RPC succeeds when called as `service_role` (all local runs) and `authenticated`/`anon` (both hold the `extensions` grant). Only `workflow_run` fails.
- *"Transient DB incident during the run"* — no; 482/482 over the full 79-minute span, and the grant is verifiably absent from the live catalog today (see Evidence 4).

## Evidence chain

1. **Every hybrid call failed with the same Postgres error.** `semantic-search-blocks-log.jsonl` contains exactly 482 events `{"event":"semantic-search-blocks:hybrid-error", ..., "error":"permission denied for schema extensions"}` — one per `:start`, across all 5 runs and all guide files. **A 100% failure rate over 79 minutes is a permission state, not a flake.**

2. **The fallback executed and is the source of the empty results.** All 482 `:result` events carry `"mode":"keyword"`; 460 have `resultCount: 0`. The keyword RPC never errored (`:keyword-error` count: 0). **The tool "worked" mechanically while being semantically dead.**

3. **The failing RPC needs the `extensions` schema and runs as the caller.** Live catalog (app project `mgxqsrjutswbciyrltwd`):
   `search_content_blocks_hybrid` → `security_definer: false`, `config: ["search_path=public, extensions"]`, owner `postgres`.
   `search_content_blocks_keyword` → `security_definer: false`, `config: ["search_path=public"]`.
   **SECURITY INVOKER + `extensions` on the search_path means the caller's role must hold USAGE on `extensions`; the keyword RPC doesn't need it — exactly matching the observed fail/succeed split.**

4. **`workflow_run` is the only role missing the grant.** Live catalog query (2026-07-16):

   | role | USAGE on `extensions` | USAGE on `public` |
   |---|---|---|
   | anon | ✓ | ✓ |
   | authenticated | ✓ | ✓ |
   | service_role | ✓ | ✓ |
   | postgres | ✓ | ✓ |
   | **workflow_run** | **✗** | ✓ |

   **The role the cloud run authenticates as is the single role that cannot see pgvector's schema.**

5. **Cloud runs execute as `workflow_run`.** `bureau/workflows/shared/run-scoped-supabase.ts:43-59` (`createRunScopedClient`) sends the substation-minted `SUPABASE_RUN_TOKEN` as the Authorization bearer; its own header comment documents that "the run token carries the `workflow_run` … role + tenant-scope claims". The CRC script adopted this client in bureau commit `fbd70c1cb` (#574). **The caller identity changed on 2026-07-11; the RPC and its grants did not.**

6. **Every prior CRC run was clean — and each for a reason the timeline explains.** Sidecars/audits of run-2 (`3703349c`), run-3 (`a8d07d22`), run-5 (`d1ff47e7`, ran 06-30), and run-4 (`bfb4f256`, 07-13) all show `mode: "hybrid"` and zero hybrid-errors. Runs before 07-11 predate the client switch (service_role key). The 07-13 baseline ran **locally** with the documented workaround (service_role JWT as `SUPABASE_RUN_TOKEN` in `conductor/.env`, applied 2026-07-13), so it executed as `service_role` and sailed through. **The 07-14 game day was the first cloud run after #574 — the first execution ever as the real `workflow_run` role.**

## Timeline

| Date | Event | Broke the invariant? |
|---|---|---|
| 2026-06-20 | CRC copy of `semantic-search-blocks.ts` created, `hybrid-error` sidecar event included from day one | no — observability in place |
| 2026-07-09 | substation migration `20260709130003_function_search_path_and_vector.sql`: relocates `vector` extension `public` → `extensions`, pins `search_path=public, extensions` on the hybrid RPC | no — anon/authenticated/service_role all hold the `extensions` grant |
| 2026-07-09 | CRC run `47eca23e` (cloud, block-ids run) — script still uses service_role key | worked |
| 2026-07-11 | substation migration `20260711000000_workflow_run_role_and_rls.sql`: `CREATE ROLE workflow_run NOLOGIN NOINHERIT` + `GRANT USAGE ON SCHEMA public TO workflow_run` (line 78) — **no `extensions` grant** | **yes — latent** |
| 2026-07-11 | bureau `fbd70c1cb` (#574): CRC/CC scripts switch to `createRunScopedClient()` | arms the trigger |
| 2026-07-13 | CRC run `bfb4f256` (run-4 baseline) — **local**, service_role-JWT workaround | masked |
| 2026-07-14 | CRC run `ed5e7ba9` (v5 game day) — **first cloud run as real `workflow_run` role** | **fires: 482/482** |
| 2026-07-16 | Diagnosed via `audit-crc-run` Agent 3 | — |

Corollaries: the bug is **deterministic** for every cloud run from 2026-07-14 onward until the grant lands; it is **not a regression in the search code** (no bureau change between the clean 07-13 run and the dead 07-14 run touches the script); and the 07-13 baseline audit could not have caught it because the local workaround changes the caller identity the bug keys on.

## Root cause

`substation/supabase/migrations/20260711000000_workflow_run_role_and_rls.sql:65-78`:

```sql
    CREATE ROLE workflow_run NOLOGIN NOINHERIT;
...
GRANT workflow_run TO authenticator;

GRANT USAGE ON SCHEMA public TO workflow_run;   -- ← the only schema granted
```

The migration grants the new role USAGE on `public` and per-table SELECTs, but never `extensions` — the schema that `20260709130003` had moved pgvector into two days earlier. The missing invariant, precisely: **every role that can invoke a SECURITY INVOKER function must hold USAGE on every schema in that function's pinned `search_path`.** The 07-09 migration created the `search_path=public, extensions` requirement; the 07-11 migration created a caller that can't satisfy it.

The consuming code path (working as designed, included for orientation):

`bureau/workflows/comment-resolution-check/scripts/semantic-search-blocks.ts:222-240`:

```ts
if (queryEmbedding) {
    const { data, error } = await supabase.rpc('search_content_blocks_hybrid', {
      target_project_id: projectId,
      search_query: query,
      query_embedding: JSON.stringify(queryEmbedding),
      max_results: maxResultsNum,
    });
    if (error) {
      logEvent('semantic-search-blocks:hybrid-error', { queryId, checklistItemId, error: error.message });
      console.error(`[semantic-search-blocks] Hybrid RPC failed, falling back to keyword: ${error.message}`);
    } else {
      mode = 'hybrid';
```

Irony/near-miss: the sidecar recorded the outage perfectly on all 482 calls — the observability shipped in winston#163 did its job — but nothing reads `:hybrid-error` at runtime, the agent's tool result contains no hint of degradation, and no alert or workflow warning exists, so a fully-instrumented total outage ran to completion unnoticed.

## Sample request/response models

Real event triple from the incident (queryId `74882154-6b5e-438f-b41c-af892567ec76`, item `RW-1`, run-1 — the AULCC case-number check):

```jsonc
// 1. :start — the agent's query (written for EMBEDDING search)
{"event":"semantic-search-blocks:start","timestamp":1784049530314,"runIndex":"run-1",
 "guideFile":"crc-RW.md","queryId":"74882154-6b5e-438f-b41c-af892567ec76",
 "checklistItemId":"RW-1","projectId":"23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
 "query":"AULCC Austin Utility Coordination Committee case number","maxResults":15}

// 2. :hybrid-error — the Postgres schema-permission failure   ← THE BUG FIRING
{"event":"semantic-search-blocks:hybrid-error","timestamp":1784049532115, ...,
 "error":"permission denied for schema extensions"}

// 3. :result — silent keyword fallback, nothing found          ← what the agent received
{"event":"semantic-search-blocks:result","timestamp":1784049532515, ...,
 "mode":"keyword","resultCount":0,"results":[],"elapsed_ms":2201}
```

Contrast: one of only 22 fallback hits, where the query happened to contain a literal phrase present in block text (`AW-RL-6`, run-2): `"query":"Austin Water meter abandonment detail"` → `"mode":"keyword","resultCount":3` (blocks `bd8a20e5…`, `2b1f6706…`, `db1521ac…` on sheets 8/9/6). The 4.6% hit rate is the keyword engine working as designed on input written for a different engine.

## Impact

| Consumer / surface | Status | Mechanism |
|---|---|---|
| **CRC cloud runs** (every one from 2026-07-14 until fixed) | **affected** | 100% hybrid failure → keyword fallback → ~95% empty results; agents evidence-gather via vision only |
| CRC review verdicts on run `ed5e7ba9` | ⚠ **partially affected, unquantified** | 125 items did all their semantic searching into a void. Vision compensation (2.8× calls) may have fully covered — vote agreement actually *improved* vs baseline — but text-heavy checks (case numbers, notes, legal descriptions, e.g. `RW-1` AULCC) are exactly where vision is weakest. No per-item ground truth exists to measure it (real review, not calibration). |
| Run cost/latency | affected | 2.89M vision tokens (~5× baseline); part of the 1.75× compute growth in the run-6 perf audit |
| **CC (completeness-check) cloud runs** | ⚠ **affected on next cloud run** | `bureau/workflows/completeness-check/scripts/semantic-search-blocks.ts` is an identical copy that also adopted `createRunScopedClient` in #574 — same grant, same failure, not yet observed only because no cloud CC run has happened since |
| Any other bureau script calling an `extensions`-dependent RPC as the run token | ⚠ latent | same missing grant; audit `supabase/functions/*.sql` for other `search_path`s including `extensions` (e.g. the other `*_hybrid` functions in conductor's type map: `search_aw_redline_comments_hybrid`, `search_bureau_documents_hybrid`, `search_bureau_hybrid`, `search_ig_eval_data_hybrid` — check which roles call them) |
| Local runs (service_role-JWT workaround per `conductor/.env`) | unaffected | caller is `service_role`, which holds the grant |
| City Hall UI semantic search | unaffected | authenticates as `authenticated`/`anon`, both granted |
| Keyword RPC, RLS policies, consolidation/voting/DB save | unaffected | keyword search_path is `public`-only; downstream pipeline consumed degraded-but-valid tool output faithfully |

Deterministic: yes — 100% of hybrid calls as `workflow_run` fail until the grant exists. Logged: sidecar `:hybrid-error` only; **nothing fails, warns, or alerts** — the worst part of the impact is the silence. Cheap detector for the worst case: `grep -c '"event": "semantic-search-blocks:hybrid-error"' output/semantic-search-blocks-log.jsonl` on any run — any nonzero count is an outage.

## Fix directions (not yet implemented — directions, not a mandate)

1. **The invariant fix (one line, substation migration):**
   ```sql
   GRANT USAGE ON SCHEMA extensions TO workflow_run;
   ```
   Matches what anon/authenticated/service_role already hold. Function/operator EXECUTE in `extensions` defaults to PUBLIC, so schema USAGE is the only gate (the live error message confirms it's the schema check failing). Consider granting to `library_workflow` too if the Library project mirrors the pattern, and adding a comment in `20260711000000`'s successor noting why.
2. **Guard against recurrence:** a substation CI check (or a test in the migration suite) asserting that every role named in a `GRANT ... TO <role>` policy set can resolve the pinned `search_path` of every SECURITY INVOKER function it can execute. Cheaper variant: a post-migration smoke query that calls each `*_hybrid` RPC via `SET ROLE workflow_run`.
3. **Make the degradation loud:** (a) have `semantic-search-blocks.ts` include a `degraded: "keyword-fallback"` marker in the tool result the agent sees, so the model knows evidence quality dropped; (b) alert/telemetry on hybrid-fallback rate and zero-result rate per run (the run-6 audit's P0 recommendation); (c) optionally fail the run outright if 100% of hybrid calls error in the first N calls — a full outage is a config bug, not a condition to average over.
4. **Repair pass for run `ed5e7ba9`:** none required for the artifacts (they're valid records of what happened), but consider a targeted human spot-check of the 125 all-zero-result items' verdicts — start with resolved/uncertain verdicts among `RW-1`, `CM-4`, `LDE-1`, `EV-18`, `CA-21` — before treating run-6 quality metrics as the go-forward baseline. Hazard: re-running CRC after the grant lands changes two variables (grant + plan data freshness) — if measuring the fix's effect, re-run against the same submission version.

## Reproduction / verification recipe

Cold verification (read-only, <5 min):

1. **The grant is missing** (app project `mgxqsrjutswbciyrltwd`):
   ```sql
   SELECT has_schema_privilege('workflow_run', 'extensions', 'USAGE');  -- expect: false (bug present)
   ```
2. **The RPC requires it:**
   ```sql
   SELECT proname, prosecdef, proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE proname LIKE 'search_content_blocks_%';
   -- hybrid: prosecdef=f, search_path=public, extensions   keyword: prosecdef=f, search_path=public
   ```
3. **The incident data:** storage bucket `workflow-runs`, path `comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-07-14-183605/output/semantic-search-blocks-log.jsonl`. Expect 482 `:hybrid-error` lines, all `permission denied for schema extensions`; all `:result` lines `mode:"keyword"`; 460 with `resultCount:0`. Unambiguous single case: queryId `74882154-6b5e-438f-b41c-af892567ec76` (the RW-1 triple quoted above).
4. **Direct repro of the failure** (safe, read-only RPC):
   ```sql
   SET ROLE workflow_run;
   SELECT * FROM public.search_content_blocks_hybrid(
     '23301a8a-4cdb-4751-ac0c-93b97f0f5c12'::uuid, 'water meter', ('[' || repeat('0,', 1535) || '0]'), 5);
   -- expect: ERROR permission denied for schema extensions
   RESET ROLE;
   ```
   (If the role can't be SET from the SQL editor's session user, calling the RPC through PostgREST with a substation-minted run token reproduces it identically.)
5. **Acceptance test for the fix:** after `GRANT USAGE ON SCHEMA extensions TO workflow_run;`, step 4 returns rows instead of erroring, and the next cloud CRC/CC run's sidecar shows `mode:"hybrid"` with zero `:hybrid-error` events. The step-1 query flips to `true`.
