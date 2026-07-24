# CRC UI — Filter by Parsed Comment-Response Believed Status

**Status:** Draft v1
**Date:** 2026-07-24
**Repos touched:** `substation` (new `GET /api/crc/comment-responses` endpoint + service), `cityhall` (concurrent fetch on the CRC review page, client-side join, new dropdown filter)
**Repos NOT touched:** `bureau`, `conductor`, `claude-plugins` (the `parse-crc-comment-response-pdf` skill and its output schema are unchanged), the existing `GET rest/v1/review_comments` / Supabase PostgREST path (deliberately left alone — see §2)

## Problem

The CRC review page in cityhall lets a reviewer filter comments by our **agent verdict** (`resolved` / `uncertain` / `failed`, plus `not-applicable`). It has no way to filter by what the **submitting firm believes** — the `believedStatus` we already parse out of the Comment Response letter (`resolved` / `pending` / `contested` / `deferred` / `unclear` / `no-response`) via the `parse-crc-comment-response-pdf` skill.

That believed-status data exists and is uploaded per submission version, but today it is consumed only at PDF render time. The **Comment Response Review PDF** joins it against verdicts in `substation/src/pdf/crv-report-data.ts` → `buildCrvComparison` (`substation/src/pdf/crv-report-logic.ts:281`). Nothing surfaces it in the interactive review UI.

Reviewers want to slice the comment list by the firm's claim — e.g. "show me every atomic item where the firm claims **resolved** but our agent says **failed**" (the false-confidence set), or "show me everything the firm **contested**". This is a triage accelerator.

### Verified facts this spec builds on

**The parsed data + its storage layout** (`crc-comment-responses` bucket):
- Path: `projects/{projectId}/submissions/{submissionId}/{submittedWithVersionNumber}/{generation}/comment-responses.json` — consumers take the **max generation**.
- Each entry: `{ commentId, dept, commentNumber, originalCommentText, responseText, believedStatus, rationale, pageNumbers, matchStatus }` (schema: `claude-plugins/.../parse-crc-comment-response-pdf/references/output-format.md`).
- `believedStatus ∈ { resolved, pending, contested, deferred, unclear, no-response }`; `matchStatus ∈ { parsed, inferred, unmatched }`.
- Concrete instance verified in prod (Lamar + Collier, project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, submission `cf1201c2-2e8b-4034-9a5e-a70b6317e39a`): 227 entries at both `…/6/0/` and `…/7/0/`; tally 152 resolved / 65 pending / 6 contested / 1 deferred / 3 unclear; 3 `unmatched`, 2 `inferred`, rest `parsed`.

**The existing join** (`substation/src/pdf/crv-report-data.ts`):
- Version is resolved from the review, not passed in: `reviews.submission_version_id` → `submission_version.{version_number, submission_id}` (lines ~110–128).
- `basePath = projects/{projectId}/submissions/{submissionId}/{versionNumber}`, `.list()` the prefix, `Math.max(...)` the generation folder names, download `…/{gen}/comment-responses.json` (lines 154–197). Zero generations → `no_comment_response` error.
- Verdict side: `review_comments.output_json.crc.parentCommentId` + `crc.atomicItemId`, verdict via `effectiveVerdict(status, verdict_override)` (line 231+).
- **Join key**: `normalizeCommentId()` (`crv-report-logic.ts:210`) applied to BOTH `entry.commentId` and `parentCommentId`: uppercase → strip non-alphanumerics → strip leading zeros on the trailing number group. So `"TPW 6"`, `"TPW-06"`, `"tpw6"` all collapse to `TPW6`.
- `unmatched` entries are dropped from the join (class-(c), `crv-report-logic.ts:301`).

**The existing CRC UI** (`cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/`):
- `review_comments` are fetched **client-side via the Supabase JS client (PostgREST)** in `+page.ts:604–610` (legacy path — all CRC reviews use it): `.from('review_comments').select('id, comment_number, output_schema, output_json')`. There is **no** substation call for comment rows.
- `output_json.crc.parentCommentId` is parsed into `comment.crc.parentCommentId` (`+page.ts:771–780`, type `CRCInfo` in `review/types.ts:63–69`) and is available client-side today.
- Filter state = Svelte 5 `$state` runes (`+page.svelte:888–904`): `ccStatusTab: CcCrcTab`, plus boolean/select filters. Predicate `ccMatchesActiveFilter` (`+page.svelte:1031–1074`) is applied purely client-side in `ccFilteredComments = $derived(...)` (`+page.svelte:1089–1091`). CRC status tabs are a pill bar (`+page.svelte:958–970`, 2288–2305).
- Reusable dropdown: `src/lib/ui/nav/HeaderMenu.svelte` (`trigger` + `children` snippets, bindable `isOpen`, `align`/`valign`; click-outside close). No Radix/Headless dependency exists.
- Browser → substation: `PUBLIC_SUBSTATION_URL` (`$env/dynamic/public`, prod default `https://substation.noeticbuild.com`) + `Authorization: Bearer ${session.access_token}` (the user's Supabase JWT). Pattern already used at `+page.svelte:237–244`, 414, 464.

## Goals

1. A **new, decoupled** substation endpoint returning the parsed believed statuses for a CRC review, keyed by `commentId` + `dept` (+ a pre-normalized join key).
2. cityhall fetches it **concurrently** with the existing `review_comments` load, does the **same `normalizeCommentId` join** client-side to attach a `believedStatus` to each review comment, and exposes a **single clickable dropdown filter menu** listing all N believed-status options (multi-select), sitting alongside the existing agent-verdict pill bar.
3. Graceful degradation: reviews with no uploaded comment-response (`available:false`) simply don't show the new filter; a slow/failed fetch never blocks the comment list.

## Non-goals

- **No changes to the `review_comments` fetch path.** It stays a Supabase PostgREST call. The believed-status API is a second, independent request — not a widening of the comment query (spec constraint from Will).
- **No server-side join / no server-side filtering.** The API returns the believed-status set; cityhall merges and filters in-memory (reuses the reader's existing client-side filter model).
- **No new PDF behavior.** `crv-report-data.ts` / `buildCrvComparison` are untouched; this is a UI-only consumer of the same underlying data.
- Not changing the parse skill, its schema, or storage layout.
- Surfacing a per-row believed-status **badge** is out of core scope (see Q4) — the deliverable is the filter.

## Architecture

```
 cityhall CRC review page  ── +page.ts PageLoad ─┐
                                                 │  Promise.all (concurrent)
   ┌─────────────────────────────────────────────┴──────────────────────────────┐
   │                                                                              │
   ▼ (existing, unchanged)                                     ▼ (NEW)
 Supabase PostgREST                                   substation
 .from('review_comments')                             GET /api/crc/comment-responses?reviewId=…
   → rows w/ output_json.crc.parentCommentId            → { available, generation,
                                                             submittedWithVersionNumber,
                                                             entries[{commentId,normalizedId,
                                                                      dept,believedStatus,
                                                                      matchStatus}], counts }
   │                                                                              │
   └───────────────► client-side join in +page.ts ◄──────────────────────────────┘
             believedByKey: Map<normalizedId, {believedStatus, dept, commentId}>
             for each comment: normalizeCommentId(comment.crc.parentCommentId) → believedStatus | null
                                          │
                                          ▼
              ccComments: FlatComment[] gain `believedStatus` (or null = "no response")
                                          │
                                          ▼
      HeaderMenu dropdown (multi-select, N options) → $state Set<believedStatus|'none'>
                                          │
                                          ▼
             ccMatchesActiveFilter() extended → ccFilteredComments $derived
```

## §1 — New substation endpoint

### Route

`GET /api/crc/comment-responses?reviewId={uuid|rv_uuid}`

Registered next to the other reviewId-keyed CRC endpoints in `substation/src/index.ts` (the `/crc/source-map`, `/crc/source-pdfs`, `/crc/redline-pdf` cluster, ~lines 210–232). Rationale is identical: **cityhall holds the `reviewId`, not the `projectId`** — the version + project are resolved internally. `authMiddleware` already covers `/api/*`.

Thin handler mirrors `src/routes/crc-source-pdfs.ts`: validate `reviewId`, delegate to a service, set cache headers, `handleError`. New files:
- `src/routes/crc-comment-responses.ts` (handler)
- `src/services/crc-comment-responses.ts` (resolution + LRU)

### Response shape

```jsonc
// Degraded — old review, non-CRC review, no upload for this version, or malformed JSON.
{ "available": false }

// Happy path.
{
  "available": true,
  "generation": 0,
  "submittedWithVersionNumber": 7,
  "entries": [
    {
      "commentId": "TPW6",          // faithful ID as parsed (display)
      "normalizedId": "TPW6",       // normalizeCommentId(commentId) — the join key
      "dept": "TPW",                // department prefix ("Department ID")
      "believedStatus": "resolved",
      "matchStatus": "parsed"       // parsed | inferred (unmatched excluded — see below)
    }
    // …
  ],
  "counts": {                        // over the returned entries
    "resolved": 152, "pending": 65, "contested": 6,
    "deferred": 1, "unclear": 3, "no-response": 0, "total": 227
  }
}
```

- **`normalizedId` is computed server-side** so cityhall doesn't have to normalize the response side. cityhall still normalizes the `parentCommentId` side (see §2, `normalizeCommentId` port).
- **`unmatched` entries are excluded** from `entries` (they carry synthetic IDs like `AE`/`AWPE` that never collide with any `review_comments.parentCommentId`, exactly the class-(c) drop in `buildCrvComparison`). `counts` reflects the returned set; an `excludedUnmatched` integer is added for transparency. See Q2.
- `originalCommentText` / `responseText` / `rationale` / `pageNumbers` are **omitted** — the filter needs only status + IDs, and these are large. (A future "hover to see the firm's response" affordance can add them behind a query flag; deferred, Q4.)

### Service resolution pipeline (`src/services/crc-comment-responses.ts`)

Mirror `getSourcePdfsForReview` structure, but resolve the version/generation the way `crv-report-data.ts` does (this data is version-keyed, not stored as a `metadata.crcGuides.prefix`):

1. `stripPrefix(reviewId)` (accept `rv_<uuid>` and raw UUID).
2. `reviews` lookup: `id, project_id, review_type, submission_version_id`.
3. **Authorize first** (before branching on type — no existence/type leak): `requireProjectAccess(review.project_id, user.id, 'read')` unless `isServiceRole`. (`read` bar matches the sibling CRC endpoints and lets External-Contractor read-grant users use the filter.)
4. `review_type !== 'crc'` → `{ available: false }`.
5. `submission_version` lookup by `submission_version_id` → `{ version_number, submission_id }`. Missing → `{ available: false }`.
6. List `crc-comment-responses` at `projects/{projectId}/submissions/{submissionId}/{version_number}/`; parse generation folder names; `Math.max`. Zero → `{ available: false }` (**not** an error — unlike the PDF path, the UI must degrade quietly).
7. Download `…/{gen}/comment-responses.json`; zod-parse; on 404 / malformed / unexpected `skillVersion` major → `{ available: false }`.
8. Project entries → the subset above; drop `matchStatus === 'unmatched'`; recompute `counts` + `normalizedId`.

**LRU cache** keyed on `(bucket, basePath)`, TTL ~60 min, max ~256 — same rationale as `crc-source-pdfs` (files are immutable per generation prefix; TTL is a memory bound). Response `Cache-Control: private, max-age=60, stale-while-revalidate=600` — short, because a re-parse (new generation) or a fresh port (as happened for `…/7/0/`) should surface within a page reload or two. (The verdict side is already fetched fresh each load.)

### Errors

- Missing `reviewId` → `validation_error / missing_param` (400).
- `review_not_found` (404) only for a genuinely absent review. Everything else "not available" is a **200 `{available:false}`**, never a throw — the UI degradation contract.

## §2 — cityhall integration

### 2.1 Concurrent fetch (`+page.ts`)

In the CRC branch of the `PageLoad`, fire the new request **concurrently** with the existing Supabase `review_comments` query via `Promise.all`. The believed-status fetch is non-blocking-critical: wrap it so a rejection/timeout resolves to `{ available: false }` and the page still renders comments.

```ts
const substationUrl = env.PUBLIC_SUBSTATION_URL ?? 'http://localhost:3001';
const token = session?.access_token ?? '';
const believedPromise = fetch(
  `${substationUrl}/api/crc/comment-responses?reviewId=${encodeURIComponent(params.reviewId)}`,
  { headers: { Authorization: `Bearer ${token}` } }
).then(r => (r.ok ? r.json() : { available: false }))
 .catch(() => ({ available: false }));

const [commentsQuery, believed] = await Promise.all([commentsQuery /* existing */, believedPromise]);
```

### 2.2 The join (`+page.ts`)

Reuse the exact normalization. `normalizeCommentId` currently lives only in substation (`crv-report-logic.ts:210`). **Port it verbatim** into `cityhall/src/lib/crc/normalize-comment-id.ts` (a 4-line pure function) with a **shared test vector** duplicated in both repos (Q3) so the two implementations can't drift. The API already returns `normalizedId` for the response side, so cityhall only normalizes the `parentCommentId` side:

```ts
const believedByKey = new Map<string, {believedStatus: string; dept: string; commentId: string}>();
if (believed.available) for (const e of believed.entries) believedByKey.set(e.normalizedId, e);

// when building each FlatComment:
const parent = comment.crc?.parentCommentId ?? '';
const hit = parent ? believedByKey.get(normalizeCommentId(parent)) : undefined;
comment.believedStatus = hit?.believedStatus ?? null;  // null ⇒ firm did not address / no data
```

`believedStatusAvailable = believed.available` is threaded into page data to gate the filter's visibility.

### 2.3 Filter state + predicate (`+page.svelte`)

- New rune: `let ccBelievedFilter = $state<Set<string>>(new Set())` — **empty = no filtering** (all pass), matching how `ccStatusTab='all'` behaves. A `'none'` sentinel member matches comments with `believedStatus === null`.
- Extend `ccMatchesActiveFilter(c)` with one clause: if `ccBelievedFilter.size > 0`, require `ccBelievedFilter.has(c.believedStatus ?? 'none')`. Composes AND-wise with the existing agent-verdict tab and the other filters — so "firm says resolved AND agent says failed" falls out naturally.
- No change to `ccFilteredComments = $derived(...)` beyond the predicate it already calls.

### 2.4 The dropdown menu (UX)

A **single** `HeaderMenu` trigger button labeled `Firm status ▾` (or `Believed status ▾`), placed in the filter row next to the agent-verdict pills. Rather than 6–7 always-visible pills eating horizontal space, one button opens a checklist:

```
┌ Firm status ▾ ─────────────┐
│ ☑ Resolved            152  │   ← counts computed client-side over the
│ ☑ Pending              65  │     joined review_comments (not raw entries),
│ ☑ Contested             6  │     so they reflect what filtering will show
│ ☑ Deferred              1  │
│ ☑ Unclear               3  │
│ ☑ No response           0  │   ← canonical 'no-response' ∪ client 'none'
│ ─────────────────────────  │
│  Select all   Clear        │
└────────────────────────────┘
```

- Multi-select checkboxes; the six canonical `believedStatus` values plus **No response** (which unions the canonical `no-response` status with the client `'none'` bucket for comments whose parent wasn't in the response set — semantically "the firm didn't address this").
- Options with a zero post-join count render disabled/greyed (still visible, so the taxonomy is legible).
- The trigger shows an active-count badge when `ccBelievedFilter.size > 0` (e.g. `Firm status · 2`), mirroring how the reviewer can see a filter is engaged.
- Order = severity-ish reading order: resolved, pending, contested, deferred, unclear, no-response.

### 2.5 Degradation / gating

- `believedStatusAvailable === false` → the `Firm status` menu is **not rendered** (or rendered disabled with a tooltip "No parsed comment response for this version"). The existing agent-verdict filter is unaffected.
- Fetch still in flight when the page renders → menu shows a disabled/loading state; comment list is fully interactive meanwhile.
- Non-CRC reviews (CC) → endpoint returns `available:false` and the menu is CRC-gated anyway (`isCRC`).

## Edge cases

- **Atomic vs parent.** `review_comments` are atomic (`TPW-6.1`, `TPW-6.2`); each inherits its parent's single `believedStatus`. Filtering therefore operates at the atomic-row level with the parent's claim — expected and matches the PDF's model.
- **Comment with no parent** (`crc.parentCommentId` empty) → `believedStatus = null` → **No response** bucket.
- **Parent not in response set** (informational/FYI comments the guides dropped, or a review whose comment-response was never parsed) → `null` → **No response** bucket. In the verified Lamar run coverage was 186/186 so this bucket is empty there, but it must exist defensively.
- **Version divergence** (the `…/7/0/` port case): the endpoint resolves the version from the review, so a v7 CRC review reads `…/7/…`; if only `…/6/…` exists, it degrades (`available:false`) — consistent with the PDF path having no cross-version fallback (documented behavior).
- **Simplified-schema path** (`review_comment_index` RPC, `+page.ts:404`): CRC currently uses the legacy path with full `output_json`, so `parentCommentId` is present. If CRC ever moves to the simplified path, the index RPC must expose `parent_comment_id` (it already maps `checklist_id → parent_comment_id` for the source-map) — noted as a forward dependency, not in scope now.

## Testing

- **substation unit** (service): non-CRC → `available:false`; zero generations → `available:false`; max-generation selection across `0..N`; malformed JSON → `available:false`; `unmatched` excluded; `normalizedId`/`counts` correct; auth denied without `read` grant (non-service). Reuse the fixtures pattern from `crc-source-pdfs` tests.
- **substation parity**: a `normalizeCommentId` test vector shared with cityhall (Q3).
- **cityhall unit** (join): map build + `null` bucketing; `believedFilter` predicate composition with the agent-verdict tab (the "claims resolved / agent failed" case); empty-set = pass-through.
- **cityhall integration**: `Promise.all` degrades to `available:false` on fetch reject without blocking comment render; menu hidden when unavailable.

## Rollout

Additive and independently deployable:
1. Ship substation endpoint first (no consumer yet).
2. Ship cityhall behind the natural gate (`available` + `isCRC`); no flag strictly required since it self-hides, but a `PUBLIC_FEATURE_CRC_BELIEVED_FILTER` flag is cheap insurance (Q5).
No DB migrations. No storage changes. No change to any existing request.

## Open questions

- **Q1.** Endpoint path: `/api/crc/comment-responses` (chosen, matches the `/crc/*` reviewId-keyed cluster) vs. nesting under `/projects/:projectId/...`. Recommend the former for symmetry with `/crc/source-pdfs` and because cityhall holds only the reviewId.
- **Q2.** Return `unmatched` entries or exclude them? Recommend **exclude** (they never join; keeps the payload = the join-eligible set, identical to the PDF). Expose `excludedUnmatched` count for observability.
- **Q3.** `normalizeCommentId` duplication: port a copy into cityhall with a shared test vector vs. extract a tiny shared package. Recommend **port + shared test vector** (no build/tooling cost; the function is 4 lines and stable). Revisit if a third consumer appears.
- **Q4.** Should the API also return `responseText`/`rationale` so the UI can show the firm's actual response on hover/expand? Recommend **defer**; add behind `?include=text` later. Keeps the default payload small.
- **Q5.** Feature flag or rely on self-hiding (`available` + `isCRC`)? Recommend **self-hiding**, with an optional `PUBLIC_FEATURE_CRC_BELIEVED_FILTER` kill switch.
- **Q6.** "No response" filter option: merge canonical `no-response` with the client `null` bucket under one label (recommended — same meaning to a reviewer), or keep them distinct? If kept distinct, the menu grows to 7 real options.
- **Q7.** Menu counts: over joined `review_comments` (recommended — reflects what the filter yields) vs. over raw response entries (matches the PDF's per-parent tally). These differ because one parent = many atomic rows.
