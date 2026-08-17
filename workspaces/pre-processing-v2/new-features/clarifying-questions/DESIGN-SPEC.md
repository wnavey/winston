# Pre-Processing Clarifying Questions — HITL Prompts During File Upload / Triage

**Status:** Draft v1
**Date:** 2026-08-17
**Repos touched:** `substation` (raise a clarifying question when pre-processing hits an ambiguous decision; pause + resume), `cityhall` (surface the question, collect the answer, route it back). Optional new table.
**Repos NOT touched:** `conductor` (not part of the upload/triage path).
**Parent:** `../../DESIGN-SPEC.md` (Pre-Processing v2).
**Spun out of:** `../../bugs/plan-set-storage-pathing/BUGFIX-SPEC.md` §D5 / Q-A. That fix ships **auto-replace** as the interim default for the "second plan set on one version" collision; this spec is the general framework that upgrades that (and several sibling ambiguities) into an explicit user prompt.

> **Why this exists.** Pre-processing makes several irreversible-ish classification calls with no human in the loop — is this a plan set or a supporting document? which of two large-format PDFs in a zip is *the* plan set? is this second upload a replacement or a mistake? Today the system guesses and moves on. When it guesses wrong the user finds out downstream (a tax certificate rasterized as a 200-sheet plan set, or a replaced plan set they meant to keep). A lightweight "ask the user a scoped question, pause, resume on their answer" mechanism turns these silent guesses into a good product moment — and it's reusable across every ambiguous decision the pipeline makes.

---

## Problem

The upload → classify → process pipeline (substation `CLAUDE.md`: `prepare-upload` → PUT → `commit-upload` → Inngest `process-file`) makes classification decisions with **no way to ask the user anything**. Every ambiguous case is resolved by a heuristic or an LLM guess and committed silently. Concrete cases already in the code:

1. **Second plan set on one submission version** (`submissions.ts:786` `handlePlanSetUpload`). With the canonical deterministic key (`plan-set/v{n}/source.pdf`, from the sibling bugfix spec), a second plan-set upload *clobbers the first's slot*. Interim policy is auto-replace; the *right* behavior is to ask: **"File {new} appears to be a plan set, different from {existing}. Replace {existing}, or drop {new}? There can only be one plan set per submission version."**
2. **Which PDF in a zip is the plan set** (`zip.ts` two-pass election, bugfix spec §D4). The winner is chosen by a heuristic (most pages among >11″ PDFs). When two large-format PDFs are close, the user is better placed to say which is the plan set and which is a supporting exhibit.
3. **Plan-set-vs-document boundary** (`classify.ts:19-24`). The `min(short side) > 11″` rule is objective but blunt — e.g. an 11×17 tabloid sheet set classifies as a *document* (short side exactly 11″, see bugfix Appendix A); a large-format cover letter classifies as a *plan set*. Borderline dimensions are a natural "did we get this right?" prompt.
4. **Zip triage group ambiguity** (`zip.ts` LLM triage). The triage LLM already emits a `reason` per group; low-confidence groupings are candidates to confirm rather than assume.

The unifying need: **a scoped, typed question the pipeline can raise at a decision point, that pauses that unit of work, surfaces in the UI, and resumes deterministically on the user's answer** — with a safe default/timeout so nothing hangs forever.

---

## Two execution contexts (this is the crux)

The mechanism has to work in **both** places the pipeline makes decisions, and they have very different difficulty:

### Context 1 — synchronous (`commit-upload`) — **easy**
`commit-upload` is a plain request/response Hono handler (`submissions.ts:564`). Classification and record creation happen inline. To ask a question here, the handler simply **returns a structured "decision needed" response instead of committing**, and the client resolves it with a follow-up call. No durable pause, no new infrastructure.

```
POST commit-upload
  → detects: plan_set already exists on this version
  → 409 { needs_decision: {
            kind: 'plan_set_conflict',
            prompt: 'File "1700 S Lamar (rev).pdf" appears to be a plan set, different from
                     "1700 S Lamar.pdf". Replace the existing plan set, or drop the new file?',
            existing: { plan_set_id, name, version_id },
            staged:   { upload_id, name },
            options: [ {id:'replace', label:'Replace existing'},
                       {id:'drop',    label:'Drop new file'} ] } }
  client renders modal
  → 'replace' → existing POST /plan-sets/:id/replace  (reuses bugfix §D5 delete-then-insert)
  → 'drop'    → new    POST .../uploads/:id/discard    (delete staged object + consume token)
```

The staged object already lives in `uploads/{uploadId}/…` (it was PUT before `commit-upload`), so "drop" is a clean delete and "replace" is the move-into-slot the bugfix already implements. **This slice needs no new table and no Inngest change** — it is the recommended MVP.

### Context 2 — asynchronous (`process-file` / `processZip`) — **moderate**
The zip winner-election and per-group ambiguity happen *inside a running Inngest function* (`zip.ts` `processZip`), after `commit-upload` has already returned 201. There is no open HTTP request to hold. A durable pause is required:

- Inngest natively supports **`step.waitForEvent(name, { match, timeout })`** — the function suspends durably until a matching event arrives or the timeout fires (then it takes a default branch). This is the intended primitive.
- The pipeline writes a **`preprocessing_question` row** (status `open`), then `waitForEvent('preprocessing-answered', { match: 'data.questionId', timeout: '24h' })`.
- cityhall surfaces open questions; the answer endpoint emits `preprocessing-answered` (via Inngest / substation), the function resumes with the answer, and the row flips to `answered`.
- On timeout → the function takes the **safe default** (e.g. the heuristic winner / auto-replace) and marks the row `defaulted`, so nothing hangs and no upload is lost.

---

## Data model (Context 2 only)

`preprocessing_question` (new):

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid fk | scope for RLS / UI list |
| `submission_version_id` | uuid fk | what the question is about |
| `kind` | text | `plan_set_conflict` \| `zip_winner` \| `classification_boundary` \| … |
| `prompt` | text | human-readable question |
| `context` | jsonb | typed payload: candidates, existing/staged refs, thumbnails |
| `options` | jsonb | `[{id,label}]` |
| `status` | text | `open` \| `answered` \| `defaulted` \| `expired` |
| `answer` | jsonb | `{optionId, …}` once answered |
| `default_option` | text | taken on timeout |
| `created_at` / `resolved_at` | timestamptz | |

Sync (Context 1) questions are **stateless** — they live only in the 409 response and are resolved by the follow-up call, so they need no row. (Open Q3: do we want to persist them too, for an audit trail / "you resolved N conflicts" UX? Recommend no for MVP.)

---

## Decisions

- **D1 — Ship Context 1 first (MVP).** The synchronous `plan_set_conflict` prompt (bugfix §D5's real target) delivers most of the value with none of the durable-workflow machinery. It's a structured 409 + a modal + two existing endpoints (`/replace`, a new `/discard`).
- **D2 — Context 2 is a fast-follow, gated on real need.** Build the `preprocessing_question` table + `waitForEvent` loop only once a concrete async prompt is worth it (zip winner-election is the first candidate). Until then, async decisions keep their safe heuristic defaults (bugfix §D4/§D5).
- **D3 — Every question has a safe default + timeout.** No pipeline unit may block indefinitely. Sync questions default by user dismissal (nothing committed → staged object expires with the upload token, `submissions.ts:518` 1-hour TTL); async questions default via `waitForEvent` timeout. This guarantees the feature can never wedge an upload.
- **D4 — Typed `kind` registry.** Questions are a closed enum of kinds, each with a schema for `context`/`options` and a resolver. New ambiguities add a kind; the transport (409 / waitForEvent) is shared.
- **D5 — Reuse existing resolution endpoints.** `plan_set_conflict` resolves through the plan-set `/replace` the bugfix already ships; only `/discard` (delete staged object + consume token) is net-new. Don't invent a parallel commit path.

---

## Scope boundaries

- **In (MVP, Context 1):** structured `needs_decision` 409 from `commit-upload` for `plan_set_conflict`; a `/discard` endpoint; cityhall modal + routing to `/replace` or `/discard`. No table, no Inngest change.
- **In (fast-follow, Context 2):** `preprocessing_question` table; `waitForEvent`-based pause/resume in `processZip`; cityhall pending-questions surface; `zip_winner` as first async kind.
- **Out:** replacing the bugfix's heuristic defaults wholesale (they remain the timeout/default fallbacks); classification-model changes; any non-upload pipeline.

---

## Open questions

- **Q1 — MVP trigger set.** Ship *only* `plan_set_conflict` first, or also the borderline `classification_boundary` prompt (plan-set-vs-document near 11″)? Recommend `plan_set_conflict` only — it's the one with a clean existing resolution path.
- **Q2 — Where do async questions surface in cityhall?** A per-submission "N questions need your input" banner vs. a global inbox. Recommend per-submission banner for MVP (questions are always submission-scoped).
- **Q3 — Persist sync questions?** Add a row for audit even though the 409 is stateless. Recommend no for MVP; revisit if we want conflict analytics.
- **Q4 — Default-on-timeout semantics per kind.** `plan_set_conflict` sync default = "no commit" (safe). Async `zip_winner` default = heuristic winner (bugfix §D4). Confirm each kind's default is the *conservative* choice.
- **Q5 — Multi-file commit UX.** `commit-upload` can carry several files (`submissions.ts:521` loop). If two of them independently need decisions, does the client get one 409 with an array, or resolve serially? Recommend a single 409 carrying an array of `needs_decision` entries.
- **Q6 — Sequencing vs. the bugfix PR.** This depends on the bugfix's canonical key + auto-replace landing first (it defines the collision this prompt replaces). Bugfix ships; this follows.
