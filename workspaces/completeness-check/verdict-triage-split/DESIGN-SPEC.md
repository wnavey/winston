# CC Verdict / Triage Split and Appeal

**Status:** Draft v1
**Date:** 2026-10-05
**Repos touched:** `cityhall-new` (declarative schema: one trigger, one RPC, two columns; `set-triage` split; `TriageCard`; CC landing; CC PDF)
**Repos NOT touched:** `cityhall` (old app), `substation`, `bureau`, `conductor2`, `inspector-general`, `dsd` (no new RDS component)

Builds on [verdict-override-refactor](../verdict-override-refactor/DESIGN-SPEC.md), which split one 5-value `triage_status` into two axes on `comment_triage`: `verdict_override` (what the correct status is) and `triage_status` (what the customer is doing about it). That spec gave both axes to the same people. This one gives them to different people.

---

## 1. Problem

On a completeness check (CC), anyone with write access to the project can do two different things to an item: correct its verdict (Pass / Fail / Warn / Uncertain), and triage it (To fix / Formal note + a note). One RLS policy covers both, so a customer org admin can overturn the agent's verdict on their own plan set, and a Noetic reviewer can write the customer's triage.

The wanted split:

| | Verdict override | Customer triage |
|---|---|---|
| Noetic member (`is_noetic_member`) | ✅ only them | ❌ |
| Customer with write access | ❌ | ✅ only them |
| Automated writers (service_role, `workflow_run`, postgres) | ✅ | ✅ |

And for CC, the customer's triage choices become **Formal note** and a new **Appeal**, both carrying a comment, both offered only on a non-passing verdict. Appeal is how a customer disputes a verdict now that they can't change it themselves, so it must show up for Noetic in the UI and in the CC PDF.

### 1.1 Verified facts

**Schema** (`cityhall-new/supabase/schemas/public/tables/comment_triage.sql`)
- Columns: `triage_status text NOT NULL DEFAULT 'new'`, `triage_sub_status`, `triage_note`, `verdict_override` (all nullable text), `updated_at`. `UNIQUE (review_comment_id)`. **No CHECK constraints** on any of the three status columns; allowed values live only in the column comment (L72). Adding `'appeal'` needs no constraint change.
- No `updated_by` / audit column, and no history table: who wrote an existing override is unknowable.
- One trigger: `set_comment_triage_updated_at` (L24-27).
- RLS: INSERT/UPDATE need `get_user_project_access_level ∈ (write, admin)` (L39-48); `workflow_run` has its own INSERT/SELECT/UPDATE policies scoped to its claimed project (L50-64).
- `get_user_project_access_level` returns `admin` for `is_noetic_admin` only (`functions/get_user_project_access_level.sql:19-21`). **A plain Noetic member (role `member`) has no write access to a customer project**, so they cannot pass the existing write policy today.
- `is_noetic_member` = any role in org slug `noetic`; `is_noetic_admin` = owner/admin only (`functions/is_noetic_member.sql`, `functions/is_noetic_admin.sql`). The app's `isStaff` is `is_noetic_member` (`src/lib/auth.ts:61`).
- `workflow_run` is a real Postgres role; its JWT has no `sub`, so `auth.uid()` is NULL (`substation/src/inngest/lib/run-token.ts:159-167`). service_role is detected as `auth.role() = 'service_role'` elsewhere (`tables/submission_version.sql:32`).
- cityhall-new owns prod migrations; schema is declarative (`AGENTS.md:111-125`): edit `supabase/schemas/**`, generate with `npx supabase@2.119.0 db schema declarative sync --no-apply -f <name>`, never hand-write a schema migration, list SECURITY DEFINER functions callable by `authenticated` in `supabase/definer-acl-allowlist.txt`. Jason pushes migrations.

**Writers.** In cityhall-new there is exactly one: server action `submitTriage` (`src/app/project/[projectId]/review/[reviewId]/actions.ts:27-44`) → `setTriage` (`src/lib/operations/set-triage.ts`), running as the signed-in user. `setTriage` **always** upserts `triage_status`, `triage_sub_status`, `triage_note`, and adds `verdict_override` only when a verdict was sent (L124-153). `TriageCard` sends status + note on every save, verdict only when changed (`triage-control.tsx:105-112`). No bulk triage exists. No bureau/conductor code writes `comment_triage` (`bureau/workflows/comment-resolution-check/README.md:54`).

**Masquerade.** `requireUser`/`createClient` become the customer (`src/lib/auth.ts:20-27`, `src/lib/supabase/server.ts:20-27`), so `auth.uid()` is the customer and `is_noetic_member` is false. An admin viewing as a customer gets the customer's side of this split for free.

**UI.** One control, `TriageCard` (`triage-control.tsx`), mounted in three places, each gated on `user_has_project_access(..., 'write')`:
- CC checklist landing `src/components/reviews/checklist-landing.tsx:184-194` (`offered = triageFor(review)`, `choices = verdictChoices(review)` at 143-144; N/A items get no verdict row, 193).
- `[discipline]/page.tsx:266-276` and `sheets/page.tsx:277-287`, used by CRC and formal (CC also reachable by URL).
- `triageFor` (`set-triage.ts:55-65`): post-cutover CC → `new`/`to-fix`/`formal-note`, `onlyAt: ["critical","major"]` (= fail, warn; `CC_VERDICT_OF`, `adapters/checklist.ts:94-99`). Everything else gets all five statuses and `onlyAt: null`.
- The verdict row draws only when `verdictChoices` is non-null: CC and CRC after their cutovers (`registry.ts:213-230`). Formal formats (`2026-04-simplified`, `2026-08-*`, `legacy`) have no verdicts.

**CC PDF.** Rendered by cityhall-new itself from `src/pdf` (`.../pdf/[kind]/route.ts:5-13,40-46`), as the signed-in user; substation's copy only serves the old app. The PDF reads all four columns (`cc-report-data.ts:160-182`). On post-cutover checks, `getNewSideAnnotations` (`cc-report-logic.ts:231-276`) prints an override line, then a disposition line only on fail/warn, only for values in `CC_DISPOSITION_VALUES = {to-fix, formal-note}` (175). **An unknown status such as `appeal` is silently dropped** today. The single `triage_note` is printed once, on the override line if overridden, otherwise on the disposition line (249-251).

**Prod data** (project `mgxqsrjutswbciyrltwd`, 2026-10-05):

| CC era (`completed_at` vs `2026-07-07T21:00Z`) | Reviews | Triage rows | Overrides | To-fix / formal-note | Overrides with a note |
|---|---|---|---|---|---|
| Before cutover | 42 | 142 | 0 | 57 | 0 |
| After cutover | 8 | 14 | 13 | 0 | 3 |

The post-cutover CC surface this spec changes is 8 reviews and 14 rows. CRC: 15 reviews, 545 overrides (415 with notes). Formal (`review`/`formal`): ~318 reviews, 0 overrides.

---

## 2. Decisions

**D1. Scope: post-cutover CC only.** Every rule in this spec applies to a `comment_triage` row whose review has `review_type = 'completeness_check'` and `completed_at > '2026-07-07T21:00:00Z'` (the same instant as `CC_VERDICT_TRIAGE_CUTOVER_AT`). Pre-cutover CC, CRC and every formal format behave exactly as today. Formal has no verdict to split, and pre-cutover CC is corrected through triage (`incorrect`/`na`), so splitting either would remove someone's only correction tool. CRC is deferred (Q1): customers use its override heavily (545 rows) and we can't tell who wrote them.

**D2. "Noetic" means `is_noetic_member`,** matching the app's `isStaff`. Under masquerade it's false (§1.1), which is what we want.

**D3. Verdict writes go through a SECURITY DEFINER RPC, not the table policy.** `public.set_cc_verdict_override(p_review_comment_id uuid, p_verdict text, p_note text)`:
- Refuses unless `is_noetic_member(auth.uid())`.
- Resolves the review from the comment (never from the caller), refuses unless it is in D1's scope.
- Validates `p_verdict ∈ {pass, fail, warn, uncertain, not-applicable}` or NULL (NULL = clear the override; the app sends NULL when the pick equals the agent's verdict, as `setTriage` does today).
- Upserts on `review_comment_id`, writing only `verdict_override`, `verdict_override_note`, `verdict_override_by = auth.uid()`, `verdict_override_at = now()`.
- Added to `definer-acl-allowlist.txt`, `EXECUTE` revoked from `anon`/`PUBLIC` and granted to `authenticated` only.

This avoids widening the INSERT/UPDATE policies to all Noetic members, which would also hand them write access to formal reviews. A plain Noetic member can correct a CC verdict without gaining any other write on the project.

**D4. A trigger enforces the split on direct table writes.** `public.enforce_cc_verdict_triage_split()`, `BEFORE INSERT OR UPDATE` on `comment_triage`, SECURITY INVOKER:
0. **Always** (every writer, every review type): if a triage column changed, set `NEW.triage_updated_at = now()` (D7).
1. **Bypass** the checks below when `auth.uid() IS NULL` or `current_user IN ('postgres', 'service_role', 'workflow_run', 'supabase_admin')`. This covers automated writers, migrations and the D3 RPC (definer → `current_user` is the owner).
2. **Out of scope** (D1) → return NEW unchanged. The review lookup goes through a small SECURITY DEFINER helper `cc_split_applies(review_id uuid) returns boolean`, so the check can't be hidden by `reviews` RLS.
3. **Verdict columns** (`verdict_override`, `verdict_override_note`, `verdict_override_by`, `verdict_override_at`) changed (`IS DISTINCT FROM` OLD, or from NULL on INSERT) → raise `42501` "Only Noetic can change a completeness check verdict." The RPC is the only authenticated path.
4. **Triage columns** (`triage_status`, `triage_sub_status`, `triage_note`) changed (vs OLD, or vs the defaults `'new'`/NULL/NULL on INSERT) and `is_noetic_member(auth.uid())` → raise `42501` "Noetic can't triage a customer's completeness check."
5. Customer triage on CC must use the CC vocabulary (D6): `triage_status ∈ {new, formal-note, appeal}`, else raise `22023`. Existing pre-split values on a row (none exist post-cutover, §1.1) are left alone unless the write changes them.

The comparisons are by value, so an upsert that rewrites unchanged columns (today's `setTriage`) passes. The trigger name sorts before or after `set_comment_triage_updated_at`; either order is harmless.

**D5. The verdict gets its own note.** New nullable columns `verdict_override_note text`, `verdict_override_by uuid` (FK `auth.users`, no cascade: `ON DELETE SET NULL`), `verdict_override_at timestamptz`. Today one `triage_note` serves both axes (`cc-report-logic.ts:249-250`); once two different people write the two axes, sharing it would let each overwrite the other's words. Customer text stays in `triage_note`; Noetic's reason goes in `verdict_override_note`.
- Data step: for the 3 post-cutover CC rows that have an override and a note, copy `triage_note` → `verdict_override_note` and clear `triage_note` (their `triage_status` is `new`, so the note was the override's). Shipped as a separate data migration after the declarative one. CRC rows are not touched (D1).

**D6. CC customer triage vocabulary: `new` / `formal-note` / `appeal`.**
- `to-fix` is no longer offered on CC (it still renders where it exists; none exist post-cutover).
- The formal-note sub-status (Need to escalate / Will fix later) is dropped on CC for new writes (Q3).
- **Both require a non-empty note.** `setTriage` refuses an empty note for `formal-note`/`appeal` on CC ("Add a comment to file an appeal.").
- **Offered only on a non-passing verdict:** fail, warn, uncertain (`onlyAt: ["critical","major","minor"]`). This widens today's fail/warn to include uncertain, which is where a customer most needs to push back. Not offered on pass or N/A (Q4).
- `'appeal'` is added to the `TriageStatus` union and to a CC-only list. The generic five-value `TRIAGE_STATUSES` that formal and CRC render is **not** extended, so their menus, filters and badges are unchanged.

**D7. What an appeal means.** A customer saying "we think this verdict is wrong, and here's why." It's a request to Noetic, not a state change on the verdict. Noetic answers it by setting (or declining to set) a verdict override with a `verdict_override_note`.
- New column `triage_updated_at timestamptz`, stamped by the D4 trigger whenever a triage column changes (`updated_at` can't serve: the verdict RPC moves it too).
- **Open appeal** = `triage_status = 'appeal'` AND (`verdict_override_at IS NULL` OR `verdict_override_at < triage_updated_at`). **Answered** = `verdict_override_at >= triage_updated_at`.
- If Noetic overrides to pass, the item becomes passing, D6 hides the triage tabs, and the appeal shows as **upheld** (read-only). If Noetic leaves the verdict and writes a note, the appeal shows as **answered**; the customer can edit and re-appeal, which reopens it.
- No notification in v1 (Q5).

**D8. `TriageCard` renders one side per viewer.** It gets an `actor: "staff" | "customer"` prop.
- **Staff** (`isStaff`, already read by all three pages): the verdict row + a "Reason" note (writes `verdict_override_note`) + Save, via a new `setVerdict` operation → `set_cc_verdict_override` RPC. Below it, the customer's triage shown read-only: "Appealed: *note*" or "Formal note: *note*", with the open/answered marker. No triage tabs.
- **Customer:** the verdict shown read-only (agent verdict, or "Noetic changed this from Fail to Pass" + the reason), then the triage tabs `Formal note` / `Appeal` + required Comment + Save. No verdict row.
- **Mount gate:** staff mount on `isStaff` (not on write access, which plain Noetic members lack); customers keep the `canTriage` write-access gate. Out-of-scope reviews (D1) keep today's card unchanged.

**D9. `setTriage` is split in two.**
- `setTriage` loses its `verdict` input. On CC it validates the D6 vocabulary and note rule.
- New `setVerdict(supabase, { reviewCommentId, verdict, note })` calls the RPC and maps `42501` to "Only Noetic can change this verdict."
- `submitTriage` stays the customer action; a new `submitVerdict` server action is the staff one. Both call `requireUser()` + `createClient()`, so the DB is the only permission check, as today.

**D10. CC landing shows appeals.**
- A row badge "Appealed" (warning tone) and "Appeal answered" (neutral) next to the item, from the existing badge slot (`checklist-landing.tsx:300-320`).
- The landing's "Notes" filter menu (built from the offered statuses, 265-272) gains Appeal automatically from D6's list; for staff add an "Open appeals" filter.
- A header count for staff: "N open appeals". Exact placement is left to iteration.

**D11. CC PDF.** Post-cutover only, in `cc-report-logic.ts`:
- Add `'appeal'` to `CcTriageStatus` (117) and `CC_DISPOSITION_VALUES` (175).
- The disposition gate (247) widens from fail/warn to fail/warn/uncertain, matching D6.
- New annotation: `Appealed by applicant: <triage_note>`, plus, when answered, `Noetic response: <verdict_override_note>`.
- The override line reads `verdict_override_note` instead of the shared `triage_note`: "The Noetic agent marked this Fail; a Noetic reviewer determined the correct status is Pass. Reason: …". The wording "a human reviewer" becomes "a Noetic reviewer" since only Noetic can now write it.
- No new count, section or RDS component. Appeals are annotations on the finding, as formal notes are. If we want an "Items under appeal" summary chip later, that's an RDS `StatusCount` change (Q6).
- `cc-report-data.ts:160-182` selects the new columns.

**D12. Known gaps accepted.**
- **Old cityhall app and substation's `POST comment-triage` route.** The route writes as **service_role** (`substation/src/lib/supabase.ts:14`), so it bypasses D4 entirely, and it lets read-level users write (it only checks `read`, L23-25). No current caller found in cityhall-new, IG or claude-plugins. Out of scope per Will (cityhall-new only); file the route as a separate bug and retire it.
- Existing CC overrides (13 rows) and CRC data are not reattributed or cleared; `verdict_override_by` stays NULL on them.

---

## 3. Changes by file (cityhall-new)

| Area | File | Change |
|---|---|---|
| Schema | `supabase/schemas/public/tables/comment_triage.sql` | + `verdict_override_note`, `verdict_override_by`, `verdict_override_at`, `triage_updated_at`; + `CREATE TRIGGER enforce_cc_verdict_triage_split`; column comment lists `appeal` |
| Schema | `supabase/schemas/public/functions/enforce_cc_verdict_triage_split.sql` | new, SECURITY INVOKER (D4) |
| Schema | `supabase/schemas/public/functions/cc_split_applies.sql` | new, SECURITY DEFINER, STABLE |
| Schema | `supabase/schemas/public/functions/set_cc_verdict_override.sql` | new, SECURITY DEFINER (D3) |
| Schema | `supabase/definer-acl-allowlist.txt` | + the two definer functions |
| Migration | generated by `declarative sync`; + one data migration (D5 backfill, 3 rows) | |
| Types | `src/types/database.types.ts` | regenerate |
| Ops | `src/lib/operations/set-triage.ts` | drop `verdict`; CC vocabulary + required note; `triageFor` CC list `new/formal-note/appeal`, `onlyAt` + `minor` |
| Ops | `src/lib/operations/set-verdict.ts` | new (D9) |
| Actions | `src/app/project/[projectId]/review/[reviewId]/actions.ts` | + `submitVerdict` |
| UI | `.../[reviewId]/triage-control.tsx` | `actor` prop, two renderings (D8); `SHORT_LABEL` + Appeal |
| UI | `src/components/reviews/checklist-landing.tsx` | pass `actor`, staff mount gate, appeal badges + filter + count (D10) |
| UI | `.../[discipline]/page.tsx`, `.../sheets/page.tsx` | pass `actor` only when the review is in D1 scope; otherwise unchanged |
| UI | `src/components/reviews/issue-table.tsx` | `TRIAGE_VARIANT` + `appeal` (CC reachable by URL) |
| Read model | `src/lib/reviews/rows.ts`, `adapters/checklist.ts` | carry `verdictOverrideNote`, `triageUpdatedAt`, `verdictOverrideAt` → `appeal: "open" \| "answered" \| null` on the view |
| PDF | `src/pdf/cc-report-logic.ts`, `cc-report-data.ts` | D11 |

## 4. Tests

- **DB** (`pnpm test:db`, `tests/db/roles.test.ts` role matrix + a new `tests/db/cc-verdict-triage-split.test.ts`), on a post-cutover CC row, a pre-cutover CC row, a CRC row and a formal row:
  - customer admin: triage ✅, direct `verdict_override` write ❌, RPC ❌
  - Noetic admin: triage ❌, direct verdict ❌, RPC ✅
  - Noetic plain member: RPC ✅ (no project grant)
  - `workflow_run` and service_role: both ✅
  - CRC, pre-cutover CC and formal rows: today's behaviour for every role (the regression guard for "don't break formal")
  - re-upsert of unchanged triage by Noetic passes; `appeal` on a formal row is refused by nothing in the DB but never offered by the app
- **Unit:** `set-triage.test.ts` (vocabulary, required note, no verdict), new `set-verdict.test.ts`, `cc-report-logic.test.ts` (appeal annotation, uncertain gate, `verdict_override_note` on the override line, open vs answered), `adapters/checklist.test.ts` (appeal state).
- **E2E:** extend `e2e/flows.spec.ts:94`: staff sees verdict row and no tablist; customer sees tablist with two tabs and no verdict row.

## 5. Rollout

One cityhall-new PR. Order: Jason pushes the declarative migration, then the D5 data migration, then the app deploys. Between the migration and the deploy, the running app's CC card hits the trigger on exactly the writes this spec forbids (a customer's verdict save, a Noetic triage save) and shows the refusal message; everything else keeps working. With 8 post-cutover CC reviews in prod, that window is acceptable. Deploy within the hour.

## 6. Open questions

- **Q1. CRC.** Apply the same split to CRC (customers lose the verdict override they've used 545 times), or keep CRC as is? Recommend: keep, revisit with usage data, which `verdict_override_by` will start producing if the RPC is widened to CRC.
- **Q2. "Noetic"** = any Noetic member (D2) or admins only? Spec assumes members.
- **Q3. Formal-note sub-status** (Need to escalate / Will fix later) on CC: drop (D6) or keep?
- **Q4. N/A items.** Can a customer appeal a not-applicable verdict? Spec says no (non-passing = fail/warn/uncertain).
- **Q5. Notification.** Should an appeal notify Noetic (email/Slack), or is the landing count enough for v1?
- **Q6. PDF summary.** Is an annotation per item enough, or does the cover/summary need an "Items under appeal" count (RDS change)?
- **Q7. Does the appeal belong in the PDF at all** before Noetic answers it? The CC PDF goes to the applicant and may be shared with the City; an open appeal arguably shouldn't print. Spec prints both open and answered.
- **Q8. Re-appeal** after an answer: allowed (spec), or one appeal per item?
