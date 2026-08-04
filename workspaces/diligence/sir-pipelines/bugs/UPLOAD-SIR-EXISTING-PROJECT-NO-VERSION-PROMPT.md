# `upload-sir` never offers to version an existing SIR — the existing-project branch silently attaches a parallel v0 when the project already holds a near-identical report

> **Status:** Diagnosed 2026-08-04, fix NOT implemented. Root cause is in the **`upload-sir` skill** (`claude-plugins/plugins/noetic-tools/skills/upload-sir/SKILL.md` §3 "Choose the project" + § "Re-run & versioning", and its reader `scripts/publish.ts`). Discovered on the Hutton / Louisville car-wash SIR run `~/noetic/working/sir/hutton/car-wash-louisville-ky/2026-08-01-083311` — publishing that run created a **second `current_version = 0` SIR** under a project that **already contained a v0 SIR for the same site**, with no prompt to the operator. Sibling of [[ROLLUP-REQUIRES-DOWNSTREAM-PUBLISH-GATE]] and [[LOUISVILLE-EL-FEASIBILITY-GUIDE-DISCIPLINE-SWAP]]. **Presents as "the operator (me) should have version-bumped" — it isn't operator error: the skill has no branch that surfaces the choice, and no reader that could even detect the duplicate.**

## Summary

The `upload-sir` skill decides *create-a-new-SIR* vs. *bump-an-existing-SIR-to-the-next-version* on exactly one signal: the presence of **`sir-publishing-record.json` at the root of the run being published** (§ "Re-run & versioning": *"No record file → first publish (create, version = 0)."*). That record is a **local, per-run-dir sidecar** written only by `publish.ts`, only after a successful publish (§ "The record file"). So the versioning authority is a file that (a) does not exist until the *first* publish of *that specific run dir*, and (b) cannot be seen from any other run dir or any other machine.

The org/project selection layer, by contrast, **works correctly and is not the bug**: the existing-org / existing-project branch (§3) fuzzy-matched "Hutton", the operator reused the existing Hutton org, and reused the existing "Car Wash - Louisville, KY" project. That is exactly what should happen. The defect is the *seam between the two layers*: once an **existing project** is chosen and the local run has **no record file**, the skill jumps straight to *create, version = 0* — even when the chosen project **already contains an SIR whose title/site is the same or nearly the same**. It never pauses to ask the one question a human would ask: *"there's already a Car Wash · Louisville SIR in this project — do you want to iterate on it as v1, or publish a separate v0?"*

It cannot ask that question because it cannot see the answer. `publish.ts` exposes read subcommands `preflight, orgs, projects, project, check-slug, resolve-user, sir` — **there is no "list the SIRs under a project" reader**. `sir <sirId>` re-queries a *known* id (the one recorded in the sidecar); with no sidecar there is no id, so nothing looks at the project's existing SIRs at all.

**Root cause, one sentence:** `upload-sir` keys its create-vs-version decision on a local per-run sidecar file rather than on the shared DB, and its existing-project branch has no step (and `publish.ts` no reader) to detect that the chosen project already holds a same-site SIR and prompt the operator to version it — so every fresh run dir, every second operator, and every second machine forks a new `v0` instead of continuing a version lineage.

## The bug in one diagram

```
UPLOAD-SIR DECISION FLOW (as built)                        WHAT SHOULD HAPPEN
──────────────────────────────────────                    ──────────────────────────────────
 §2 choose org                                              §2 choose org        ✓ (reused Hutton)
   fuzzy-match "Hutton" → reuse existing        ✓ WORKS       ▼
   ▼                                                        §3 choose project    ✓ (reused project)
 §3 choose project                                            ▼
   projects <orgId> → operator reuses           ✓ WORKS     ┌─ project already has an SIR
   "Car Wash - Louisville, KY"                              │  for this site?  (NEW: sirs <projectId>
   ▼                                                        │  + title/address match)
 §Re-run: is there a sir-publishing-record.json             │     │ yes
          in THIS run dir?                                  │     ▼
   ▼ no  ───────────────────────────────────┐              │  PROMPT operator:
 → "first publish" → sir.action = create     │  ✗ THE SEAM  │   [iterate → version = n+1]  vs
   sir.version = 0                            │              │   [separate fresh v0]
   ▼                                          │              │     │
 publish.ts inserts a SECOND v0 SIR   ◄───────┘              │     ▼
   under a project that already had a v0                     └─ act on the operator's choice
                                                                (default-suggest version bump)
 RESULT: project 02a3a7c7 now holds
   73329e87  v0   (created 2026-07-31)   ← earlier run
   caac753c  v0   (created 2026-08-04)   ← this run     ✗ two parallel v0s, no lineage, no prompt
```

The `✗ THE SEAM` is the whole bug: existing-project + no-local-record drops straight to `create v0`, skipping the "does this project already hold this SIR?" question — and there is no reader wired up that could answer it.

## Symptom (as observed)

- **Run:** `~/noetic/working/sir/hutton/car-wash-louisville-ky/2026-08-01-083311`, published 2026-08-04 at the `5.8 Publish` gate via `upload-sir` (`bun scripts/publish.ts publish`).
- **Org/project:** existing Hutton org `9acd2fee-0758-41ab-8505-8986d72c749d`; existing project **"Car Wash - Louisville, KY"** `02a3a7c7-a283-4605-becc-a125b8112127`. Both correctly reused.
- **DB after publish** — the project holds **two v0 SIRs with identical titles**:

  | SIR id | title | current_version | created_at |
  |---|---|---|---|
  | `73329e87-a2d1-43bf-8183-0ad9bfb74f5d` | `Car Wash - Louisville, KY` | **0** | 2026-07-31T17:23:00Z (updated 2026-08-03) |
  | `caac753c-128b-4311-8d10-2480be0268eb` | `Car Wash - Louisville, KY` | **0** | 2026-08-04T17:24:34Z |

- **What the operator saw:** a clean publish, no warning. The skill never surfaced that `73329e87` existed. In the app this presents as two identically-titled "Car Wash - Louisville, KY" cards under Hutton, each at v0, with no indication one supersedes the other.
- **Tempting-but-wrong first read:** *"the operator should have picked version-bump."* There was no version-bump option to pick — §3's existing-project branch only offers *reuse project* / *create new project*, and the version decision (§ Re-run) had already been silently resolved to "create v0" the moment it found no local record. Nothing put `73329e87` in front of the operator.

## Evidence chain

1. **The versioning decision keys solely on a local per-run sidecar.** `SKILL.md:256-257`: *"No record file → first publish (`create`, `version = 0`). Record present → before offering anything, `sir <recorded_id>` …"*. The *only* branch to "version" requires the record file to already be present in the run dir being published. **No record ⇒ create v0, unconditionally — the project's existing contents are never consulted.**

2. **That sidecar is written only by `publish.ts`, only after a successful publish, and lives in the run dir.** `SKILL.md:271-272`: *"Writer: `publish` only, once per successful publish, append-only over `publishes`. A missing file = 'first publish.'"* Confirmed on disk: the file's mtime is **2026-08-04 12:24** (the publish moment; it did not exist beforehand) and its `publishes` array has **length 1**. **A brand-new run dir — the normal case — always starts with no record, so the versioning logic can only ever say "first publish."**

3. **The existing-project branch attaches without any duplicate check.** `SKILL.md:159-161`: *"Existing-org branch: run `projects <orgId>`, present the list + 'Create a new project' … Picking an existing project just attaches the SIR — **N SIRs per project is expected, no uniqueness check.**"* **"No uniqueness check" is the design choice that lets a same-site duplicate slip in silently.** (N-per-project is legitimately desirable — a project may hold genuinely distinct SIRs — which is *why* the right answer is a prompt, not an auto-merge.)

4. **`publish.ts` has no reader that could detect the duplicate.** Its subcommands are `preflight, orgs, projects, project, check-slug, resolve-user, sir, publish` (`publish.ts:392`). `projects(sb, orgId)` (`publish.ts:75`) lists *projects*, not the SIRs inside one; `sir(sb, sirId)` (`publish.ts:126`) re-queries a *single, already-known* id. **There is no `sirs <projectId>` — so even if §3 wanted to prompt, it has no way to enumerate the project's existing SIRs to prompt about.**

5. **The two SIRs came from two different run dirs, so two different sidecars — the multi-run/multi-box blind spot.** `73329e87` was published from an earlier Louisville run; `caac753c` from `…/2026-08-01-083311`. Each run dir got its own record naming its own SIR; neither can see the other. **The same failure occurs across machines: operator A publishes on box 1 (record local to box 1), operator B runs the same site on box 2, box 2's run dir has no record ⇒ "first publish" ⇒ a second v0.** A local file cannot carry versioning state across run dirs or hosts — but the DB can.

6. **Deterministic.** Any publish where (existing project chosen) ∧ (run dir has no `sir-publishing-record.json`) produces a fresh v0, regardless of what the project already contains. Since a first publish of any run dir *always* lacks the record, **the only way the version path is ever taken is re-publishing the exact same run dir** — which multi-operator, multi-box, or even "same person, new run dir for a re-analysis" all sidestep.

## Root cause

Two cooperating gaps in `upload-sir`:

- **Wrong source of truth for versioning.** `SKILL.md:256-257` makes the local `sir-publishing-record.json` the authority for create-vs-version. It is a fine *idempotency/replay* aid (it lets `publish.ts` heal a partial write and remember what a given run dir published), but it is the wrong key for "does a version lineage for this site already exist?" — that fact lives in the **DB** (`site_intelligence_report` rows under the project), which every operator and box shares.

- **Missing detect-and-prompt step (and the reader it needs).** `SKILL.md:159-161`'s existing-project branch attaches with "no uniqueness check," and `publish.ts` exposes no `sirs <projectId>` reader (`publish.ts:392` command list). So the skill neither looks for, nor is able to look for, an existing same-site SIR before deciding to create v0.

The intent is already written down and simply not enforced: §4 titles an SIR `"{use} - {city, state}"`, and §3 knows the concept of "collision" (it disambiguates *project* names on the same `"{use} - {city, state}"` string). **The same collision notion, applied one level down to SIRs within the chosen project, is exactly the missing check — and because title-similarity is a judgment call (two real, distinct car-wash studies could share a title), the resolution must be an operator prompt, not an auto-merge.**

## Impact

- **Versioning integrity (primary, deterministic).** ⚠️ Any second publish of a site into an existing project — different run dir, second operator, or second machine — forks a parallel `v0` instead of advancing the lineage. The app shows duplicate identically-titled SIRs with no supersession signal; a reader cannot tell which is current. **Silent: no warning fires (evidence #6), so the operator has no cue to reconcile.**
- **Cross-box / cross-operator collaboration (the motivating case).** The local-sidecar key means versioning *cannot* work when the analyst who re-runs a site isn't on the same box (or same run dir) as whoever published it first. This is the normal team workflow, not an edge case.
- **`current_version` semantics.** With two v0s, `current_version` is meaningless as "latest" — both claim 0. Anything that surfaces "the current SIR for this project/site" (app cards, future API) has no deterministic answer.
- **Correctly-working, explicitly exonerated:** org fuzzy-match + reuse (§2), project fuzzy-match + reuse (§3) — both did the right thing on this run. `publish.ts`'s write path, idempotency, and the record file *as a replay aid* are all fine. The record file is not "wrong to exist" — it is only wrong to be the *versioning authority*.
- **Data already produced by this bug:** the `73329e87` + `caac753c` pair under project `02a3a7c7`. A repair (below) can fold `caac753c` into `73329e87` as v1, but note the hazard: any link already handed out to `caac753c` would dangle if it is deleted.
- **Cheap detector:** `select project_id, title, count(*) from site_intelligence_report group by project_id, title having count(*) > 1` — any group is a candidate silent fork.

## Fix directions (not yet implemented — directions, not a mandate)

1. **Key versioning on the DB, and add the detect-and-prompt step (most principled).** On the existing-project branch, after the project is chosen, enumerate the project's SIRs (needs a new reader, below) and match each against the SIR about to be created on `title` and/or `address`/`parcel_ids`. On a same-or-similar match with **no local record**, **prompt the operator** (`AskUserQuestion`): *"Project X already contains SIR '{title}' (v{n}, published {date}). Iterate on it as **v{n+1}**, or publish a **separate new v0**?"* Default-suggest the version bump; on "iterate", set `sir.action = version, sir.id = <matched>, sir.version = current_version + 1` and prompt for a `versioningLabel`. Keep the local sidecar as a fast-path/idempotency hint, but let the DB be the authority.
2. **Add the missing reader.** `publish.ts` needs `sirs <projectId>` → `[{id, title, address, current_version, updated_at}]` (mirror `projects` at `publish.ts:75`). Without it, direction #1 has nothing to match against. (Interim: the skill could call this via a raw `site_intelligence_report?project_id=eq.<id>&select=…` read, but a first-class subcommand matches the existing pattern.)
3. **Match precision.** Exact `title` equality is the high-precision signal (both here are byte-identical `"Car Wash - Louisville, KY"`). Add `address`/`parcel_ids` overlap as a secondary signal to catch title drift ("Carwash" vs "Car Wash"). Because it is fuzzy, **never auto-version — always confirm** (this is a prompt-the-user case by design, per the incident that motivated it).
4. **Backstop guard (cheap, even without #1).** At minimum, before a `create` insert, count existing SIRs in the project with the same title; if ≥1, surface them and require an explicit "yes, separate v0" from the operator rather than proceeding silently. Strictly inferior to #1 but closes the silent-fork window immediately.
5. **Repair the existing pair (data already forked).** Optionally fold `caac753c` (this run) into `73329e87` as **v1**: re-publish this run with `sir.action = version, sir.id = 73329e87…, sir.version = 1`, then delete the orphan `caac753c` row + its `sir/caac753c…/v0/` storage. Hazard: any link already issued to `caac753c` dangles — check before deleting.

## Reproduction / verification recipe

1. **Confirm the versioning key is the local sidecar:** `sed -n '256,257p;271,272p' claude-plugins/plugins/noetic-tools/skills/upload-sir/SKILL.md` → "No record file → first publish (create, version = 0)" and "Writer: `publish` only … A missing file = 'first publish.'"
2. **Confirm the existing-project branch has no uniqueness check:** `sed -n '154,161p' …/SKILL.md` → "Picking an existing project just attaches the SIR — N SIRs per project is expected, no uniqueness check."
3. **Confirm no SIRs-in-project reader exists:** `grep -n "case '" …/upload-sir/scripts/publish.ts` → commands are `preflight|orgs|projects|project|check-slug|resolve-user|sir|publish`; there is no `sirs`.
4. **Confirm the forked pair in prod:**
   ```sql
   select id, title, current_version, created_at
   from site_intelligence_report
   where project_id = '02a3a7c7-a283-4605-becc-a125b8112127'
   order by created_at;
   -- expect 73329e87 (v0, 2026-07-31) and caac753c (v0, 2026-08-04), same title
   ```
5. **Reproduce cold:** take any run dir with a built deliverable and **delete its `sir-publishing-record.json`**, then publish into a project that already holds a same-titled SIR → observe a second v0 inserted with no prompt and no warning.
6. **Acceptance test for the fix:** with directions #1–#2 in place, publishing a run (no local record) into a project that already holds a same-site SIR **prompts** iterate-vs-fresh; choosing "iterate" writes `v{n+1}` under the existing SIR id and advances `current_version`; choosing "fresh" writes a new v0 only after explicit confirmation. A genuinely distinct SIR (different title/address) still creates a v0 with no false prompt.
