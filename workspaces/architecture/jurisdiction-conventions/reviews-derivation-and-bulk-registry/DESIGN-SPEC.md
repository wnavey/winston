# Reviews Derive Jurisdiction + Bulk Registry Population

**Status:** Draft v1 (Part A implemented — substation#185 + bureau#845 open)
**Date:** 2026-07-30
**Sibling of:** `workspaces/architecture/jurisdiction-conventions/DESIGN-SPEC.md` (winston#185).

> **Correction (2026-07-30, during Part A impl).** D39's workflow set was wrong. Verified against the bureau YAMLs: the in-scope set is **`review`, `review-anchored`, `completeness-check`** — `review-anchored` globs `bureau/jurisdictions/{{ input.jurisdiction }}/review-guides/...` (belongs in scope; was omitted), and the austin-scoped `jurisdictions/austin/workflows/completeness-check-anchored` has **no** `jurisdiction` input (it is directory-scoped and `checklistsDir`-driven, so the derivation/hard-fail must NOT apply — it was wrongly listed). D36/D39/Phases updated below. No other decision changed. This spec extends that body of work; decisions continue that spec's numbering (parent ends at **D35**; this spec starts at **D36**). Parent decisions/assumptions are cited as "parent D30", "parent A1", etc.
**Repos touched:** `bureau` (flip `jurisdiction` input to optional on `review` + `review-anchored` + `completeness-check` workflow.yaml; ~53 new `conventions.yaml` registry stubs), `substation` (resolve + validate jurisdiction at workflow kickoff in `workflow-run.ts`; drop the silent `'austin'` default for the in-scope workflows)
**Repos NOT touched:** `cityhall` (creation dropdown + registry validation already shipped in parent Phase 4b), `conductor` (receives a fully-resolved slug unchanged — see D40 for the deliberate local-run carve-out), app-DB schema (no migration — `jurisdictions` / `jurisdiction_departments` / the `project.jurisdiction_slug` FK all exist from parent Phases 1–2; stubs flow in via the existing sync Action), the CRC workflow (already derives its slug from the project per parent D30)

## Problem

Two gaps remain after parent Phases 1–6, both blocking "the jurisdiction attached to a project is the jurisdiction its reviews run against":

### Gap 1 — review + completeness-check ignore `project.jurisdiction_slug`

Parent **D30** wired the CRC workflow to derive its slug from `project.jurisdiction_slug` (via `projectId`) and removed CRC's dead `jurisdiction` input. **review and completeness-check were not touched.** They still declare `jurisdiction` as a **required** input:

- `bureau/workflows/review/workflow.yaml:24-27` — `jurisdiction` `required: true`, "Jurisdiction slug (e.g., 'austin')".
- `bureau/workflows/completeness-check/workflow.yaml:35-38` — `jurisdiction` `required: true`.

That input is consumed **only as a filesystem path segment** into the cloned Bureau repo — nothing reads the registry:

- review: `bureau/jurisdictions/{jurisdiction}/review-guides/{guideCode}/*.md` (checklist items), `.../guidance/{guideCode}.md`, and the `cross-run-consolidate` `guideDir` (`review/workflow.yaml:148,150,188`).
- completeness-check: `conductor/src/orchestrator/engine.ts:121-141` computes `checklistsDir = jurisdictions/{jurisdiction}/completeness-check/{CURRENT_VERSION}`.

The value is threaded caller → substation → conductor with a **silent `'austin'` default at every hop**:

- `substation/src/inngest/functions/workflow-run.ts:61` — `const jurisdiction = eventData.jurisdiction || (inputs.jurisdiction as string) || 'austin'`. **Substation never reads `project.jurisdiction_slug`.**
- `conductor/src/index.ts:237` — `values.jurisdiction || process.env.JURISDICTION || 'austin'`.

Consequences:
1. **The jurisdiction a user selected on the project has no bearing on its review/CC runs** unless whoever fires the Inngest event happens to pass the same slug in the payload.
2. **A missing/omitted slug silently becomes `austin`** — a wrong-jurisdiction review with no error.
3. **No validation.** `conductor`'s `validateInputs` (`workflow-loader.ts:154-208`) only does `String(value)` for a `string` input — no allowlist, no registry check, no path-existence check. A typo'd slug resolves to a Bureau path that doesn't exist, the `checklistItems` glob matches **zero files**, and the run produces an empty review rather than failing.

This also silently violates parent **A1** ("a project never changes jurisdiction"): nothing stops a review being run under a slug that differs from the project's own.

### Gap 2 — most jurisdictions aren't in the registry, so they can't be selected

Parent **D33** made `conventions.yaml` presence the registry marker and chose **lazy** authoring — v1 authored only `austin` (full) + `cedar-park` (stub), later + `fort-lauderdale` (parent #816). Bureau has **56 jurisdiction dirs**; only **3** have a `conventions.yaml`:

```
HAS:     austin, cedar-park, fort-lauderdale
MISSING: albuquerque, atlanta, benbrook, bend, boston, boulder, charleston,
         charlotte, charlotte-county, chicago, dallas, denver, dripping-springs,
         ector-county, fort-worth, fulton-county, georgetown, gwinnett-county,
         haines-city, harris-county, hays-county, houston, jarrell, katy,
         lakeway, lancaster-county, lewisville, los-angeles, loudoun-county,
         louisville, miami, millington, minneapolis, new-orleans, new-york,
         odessa, pearland, phoenix, portland, punta-gorda, raleigh, round-rock,
         san-antonio, san-diego, san-francisco, santa-fe, seattle, south-fulton,
         travis-county, waxahachie, webster, west-lake-hills, west-sacramento,
         woodward
         (+ pseudo/variant dirs: federal, texas, txdot, austin-arm-c, austin-arm-r)
```

Because `GET /jurisdictions` only returns registry rows, the cityhall project-creation dropdown (`cityhall/src/routes/(app)/project/create/+page.svelte:110-122`, fed by `listJurisdictions` → substation `GET /jurisdictions`) offers **only those 3**. A user cannot attach a project to any other jurisdiction, and substation's `assertJurisdictionSlug` (`substation/src/routes/projects.ts:19-31`) correctly rejects the slug as `invalid_jurisdiction_slug` if they try via the API.

**Good news — the plumbing is already done.** The dropdown, the `listJurisdictions` load, the `POST /projects` `jurisdiction_slug` body field (`substation/src/schemas/projects.ts:9`), registry validation, and the merge-to-main sync Action (`bureau/.github/workflows/sync-conventions.yml` + `bureau/tooling/src/cli/sync-conventions.ts`) all shipped in parent Phases 2/4b. **The only thing missing is the data** — the stub files that make each jurisdiction a registry row.

---

## Design

### Part A — reviews derive jurisdiction (Gap 1)

Make `jurisdiction` **optional** on review + completeness-check, and resolve the authoritative value at **workflow kickoff in substation**, before a sandbox is created.

**D36 — `jurisdiction` becomes an optional input.** Flip `required: true` → `required: false` on the `jurisdiction` input in `review/workflow.yaml`, `review-anchored/workflow.yaml`, and `completeness-check/workflow.yaml` (the three workflows that declare it and consume it as a path segment — see the Correction note). **No `default:` is added** — a default would re-introduce the silent-`austin` footgun and mask the derivation. The input is retained as an explicit **override / fallback**, not the source of truth. Conductor still receives a concrete slug on every run (substation guarantees it — D37), so conductor's path-building is unchanged.

**D37 — resolve + validate in substation `workflow-run.ts`, pre-sandbox.** Replace the `|| 'austin'` computation at `workflow-run.ts:61` with a resolver that runs for the **jurisdiction-input workflows** (D39). It reads `project.jurisdiction_slug` using the same project lookup `deriveRunScope` already performs (`substation/src/inngest/lib/run-token.ts:79-140`: `projectId` from `inputs.projectId`, else derived `submissionVersionId → submission → project`). Precedence, with the mismatch guard the ask calls for:

| `project.jurisdiction_slug` | input (`eventData.jurisdiction` / `inputs.jurisdiction`) | Result |
|---|---|---|
| set | absent | **use project slug** |
| set | present, **equal** | use it (no-op) |
| set | present, **differs** | **hard-fail** `NonRetriableError` — enforces parent A1 |
| null | present | use input slug |
| null | absent | **hard-fail** — jurisdiction required, no silent default |

The `'austin'` fallback is **deleted**. Fail-fast (`NonRetriableError`, before `setUpSandbox` at `workflow-run.ts:78`) so a misconfigured run never pays for a sandbox/clone/install. The resolved slug is passed onward exactly as today — set as `jurisdiction`, flows to conductor via the `JURISDICTION` env var (`workflow-run.ts:146` → `buildEnvVars`), skipped as a CLI arg (`:125`). Minimal diff: only the computation at `:61` changes plus one helper.

**D38 — validate the resolved slug against the registry.** After resolution, call `getJurisdiction(slug)` (`substation/src/lib/jurisdictions.ts:63`) and hard-fail if it returns nothing — the same check `assertJurisdictionSlug` already applies at project creation, now applied at review kickoff. DB-sourced slugs are FK-guaranteed valid (parent Phase 1 FK), so this primarily guards **input-provided** slugs and closes the typo → empty-glob failure. This is why Part A and Part B compose: once Part B populates the registry, "slug is registered" is a meaningful gate for every jurisdiction, not just the 3 onboarded ones.

**D39 — the jurisdiction-input workflow set.** The resolver applies only to workflows that declare a `jurisdiction` input AND consume it as a Bureau path segment: **`review`, `review-anchored`, `completeness-check`** (`JURISDICTION_INPUT_WORKFLOWS` in `substation/src/inngest/lib/resolve-jurisdiction.ts`). Exempt by construction: **`comment-resolution-check`** (parent D30 — derives internally, no input) and the austin-scoped **`completeness-check-anchored`** (no `jurisdiction` input; directory-scoped, `checklistsDir`-driven — subjecting it to the hard-fail would wrongly gate it). Named distinctly from the existing `JURISDICTION_SCOPED_WORKFLOWS` (`run-token.ts:45` — a different concept: tenant-scope-exempt training workflows `train`/`adaptive-train`). Workflows outside the set are passed through unchanged and, in the implementation, **keep** the caller's `'austin'` fallback for now — the global-default removal is deferred to Q3 (proposal: pass no `JURISDICTION` env at all rather than a bogus default) to avoid destabilizing CRC/training before an audit of who reads `JURISDICTION`.

**D40 — substation-only; local conductor runs keep the operator flag (accepted gap).** The authoritative resolve+validate lives in **one** place — substation, the sole production trigger path (`workflow/run` Inngest event). Local `conductor` CLI runs (the `local-run` skill, dev) retain `--jurisdiction` and are **not** given a second copy of the derivation logic — duplicating it is the exact drift failure mode this spec family exists to kill. The tradeoff: a local run can still be fired with a mismatched/absent slug. Accepted for v1 — local runs are operator-driven and dev-only. (Removing conductor's own `'austin'` default is out of scope to avoid breaking existing local-run muscle memory; flagged as Q1.)

**D41 — no auto-backfill of `project.jurisdiction_slug` in v1.** When the project slug is null and an input slug is used, substation resolves and validates it but does **not** write it back to the project. A project's jurisdiction is set deliberately via the cityhall creation/settings dropdown (Part B enables this for every jurisdiction). Auto-backfill-on-first-review is posed as Q2, not adopted.

### Part B — bulk-populate registry stubs (Gap 2)

**D42 — amend parent D33: bulk-author minimal registry stubs; keep the profile lazy.** Author a `conventions.yaml` for every real jurisdiction dir so it is registry-present and selectable at project creation. This **refines** (does not overturn) parent D33: D33's stated concern was inventing *department names + conventions* before a jurisdiction is trained — a minimal stub carries **neither**. Departments (`jurisdiction_departments`) and long-tail `conventions` JSONB stay **empty**, authored lazily at onboarding exactly as D33 intended (via `generate-crc-guides` HITL, then ratified back). What we bulk-author is only the **registry identity** (`name`, `short_name`, `status`) — cheap, derivable from the slug, and the thing the dropdown needs. The schema already blesses this: `bureau/tooling/src/lib/conventions/schema.ts` requires only a non-empty `name`; `short_name`/`status` are optional (status defaults `prospect`). Stub shape (matches the existing `cedar-park` file):

```yaml
# bureau/jurisdictions/<slug>/conventions.yaml — minimal registry stub
name: City of <Name>
short_name: <Name>
# status defaults to 'prospect'; departments + conventions authored lazily at onboarding
```

**D43 — stub `name`/`short_name` are a generated draft, ratified in PR review.** Names are derived from the slug by title-casing with heuristics (`*-county` → "X County"; otherwise "City of X" / short "X"). Heuristics misfire on real cases (`new-york` → "City of New York" vs "New York City"; multi-word counties; ambiguous small towns), so the generated set is a **draft Will ratifies in the PR** — the same governance parent D21/Q1 used for Austin's department names. A wrong `name` here is low-blast-radius (a display label on a `prospect` jurisdiction with no reviews yet) and trivially fixed by editing the file + re-sync, but ratifying at author time is the discipline. **All new stubs are `status: prospect`** — none are trained/active. The 3 existing files (`austin` active, `fort-lauderdale` active, `cedar-park` prospect) are **not touched**. Will promotes specific slugs to `active` later as they earn regulations (parent D8).

**D44 — dirs that get a stub, and the exclusions (Will ratifies).** Recommended v1 set = **53 stubs** — every MISSING dir above **except**:
- **`federal`, `texas`, `txdot`** — not user-selectable permitting AHJs (a country-level catch-all, a state, a state DOT). Pseudo-dirs parent D33 explicitly said "never earn a file."
- **`austin-arm-c`, `austin-arm-r`** — Austin variants (likely internal ARM training variants, not distinct selectable jurisdictions). **Flagged for Will (Q4)** — trivially included if they should be selectable.

**No code changes for Part B.** Merge → the existing `sync-conventions.yml` Action upserts the rows → `GET /jurisdictions` returns them → the creation dropdown lists them → `assertJurisdictionSlug` accepts them on `POST /projects`. Consistent with parent D33's "unfiltered `GET /jurisdictions` in v1". Sync never deletes registry rows (parent D31/D33), so this is purely additive.

### How the two parts compose

Part B makes the registry complete → Part A's D38 registry-validation is meaningful for every jurisdiction (not just the 3 onboarded) → a user selects any jurisdiction at creation → `project.jurisdiction_slug` is set → Part A derives that exact slug for every review/CC run and refuses to run under a different one. The end state is the invariant the asks want: **the jurisdiction on the project is the jurisdiction its reviews run against, or the run fails loudly.**

---

## Scope boundaries (deliberately deferred)

- **Empty-guide guard.** A `prospect` jurisdiction with no `review-guides/` can be selected and a review fired; today that yields an empty-glob (no findings). D38 validates registry *presence*, not *guide presence*. Gating review on `status == 'active'` (parent D8) is a clean follow-up but risks over-blocking if statuses aren't maintained — posed as Q5, not adopted in v1. The empty review is a visible, non-corrupting failure mode.
- **conductor's own `'austin'` default** (`index.ts:237`) is left in place for local-run ergonomics (Q1).
- **Review-run department vocabulary** (parent D22/Q4) — untouched.
- **Auto-backfill** of `project.jurisdiction_slug` (Q2) — not in v1.

## Phases

1. **substation (Part A):** add the resolver + registry validation in `workflow-run.ts`, delete the `'austin'` default, add the D39 workflow set + one helper. Ship with tests for the D37 precedence table (esp. the mismatch hard-fail and the null/null hard-fail). *(Deploy note: substation runs on Vercel; merged ≠ deployed. Part A is inert until deployed.)*
2. **bureau (Part A):** flip `jurisdiction` to `required: false` on `review`, `review-anchored`, and `completeness-check`. *(Safe to land before or with Phase 1 — the input staying present-but-unused is harmless; the behavior change is entirely substation-side.)*
3. **bureau (Part B):** the 53 stub files in one PR (ratify names + the `arm`/pseudo exclusions in review). Merge → sync Action populates the registry → dropdown fills. No app deploy needed.

Phases are independent and can land in any order; Part A Phase 1+2 should ship together so the input-optionality and the resolver match.

## Open Questions

- **Q1.** Should `conductor`'s `index.ts:237` `'austin'` default also be removed (universal no-silent-default), accepting that local runs must then always pass `--jurisdiction`? **Recommendation: leave it (v1)** — local runs are dev-only and operator-owned; removing it is churn for the non-production path.
- **Q2.** When the project slug is null and an input slug is used, should substation backfill `project.jurisdiction_slug`? **Recommendation: no (v1)** — jurisdiction is set deliberately via the dropdown; silent writes fight parent A1's "set once" model.
- **Q3.** For workflows *outside* the D39 set that currently ride the `'austin'` default (if any fire through `workflow-run.ts` needing `JURISDICTION`), what should they get once the default is gone? **Recommendation:** pass no `JURISDICTION` env for non-jurisdiction workflows; audit which workflows actually read it before deleting the default globally. *(Auditor: confirm no non-review workflow silently depends on `JURISDICTION=austin`.)*
- **Q4.** Include `austin-arm-c` / `austin-arm-r` as selectable jurisdictions, or exclude as internal variants? Same question for whether `federal`/`texas`/`txdot` should ever be selectable. **Recommendation: exclude all five in v1.**
- **Q5.** Gate `review` (and CC) on `jurisdiction.status == 'active'` (parent D8) so a bare `prospect` stub can't produce an empty review? **Recommendation: defer** — empty-glob is a visible failure and status maintenance is not yet reliable.
- **Q6.** Placement of the resolver: substation (fail-fast, cloud-only — D40) vs. conductor kickoff (universal incl. local runs, but post-sandbox and reads via the `workflow_run` token). **Recommendation: substation**, single implementation, per D40. Flagging because it's the one architectural fork.

## How to audit this spec

- **Codebase claims:** verify the file:line refs in Problem (esp. `workflow-run.ts:61`, `conductor/index.ts:237`, `run-token.ts:79-140`, `schema.ts` required-field set, `project/create/+page.svelte:110-122`, `projects.ts:19-31`). Confirm CRC really has no `jurisdiction` input (parent D30) so D39's exemption is correct.
- **Design claims:** the biggest is **D42 amends parent D33** — confirm a minimal stub genuinely carries no department/convention data (so the "keep the profile lazy" reconciliation holds) and that parent D33's "sync never deletes registry rows" makes bulk-add purely additive.
- **Data claims:** the MISSING list + the 53-count (run the enumeration against `bureau/jurisdictions/`). Sanity-check the drafted names (D43) against real jurisdiction names.
- **Open questions:** Q1, Q4, Q5, Q6 are the live forks for Will.
