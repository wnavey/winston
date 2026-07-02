# Design Spec: First-Class `warn` Status via the Fail Status Column

**Status:** Implemented — bureau [#496](https://github.com/noetic-inc/bureau/pull/496), completion-officer [#19](https://github.com/noetic-inc/completion-officer/pull/19)
**Date:** 2026-07-02
**Scope:** Completeness-check workflow (bureau `workflows/completeness-check/` + jurisdiction guides), with a port of guide changes to completion-officer

> **Revision note (same day):** during implementation the design was tightened beyond the original text: the legacy fail→warn overlay at the DB-write boundary (`build-review-comments.ts`) is **deleted outright** rather than retained as a fallback, and `apply-forced-outcomes.ts` now writes forced warns **natively** instead of downgrading them to `fail` for downstream re-derivation. Fresh runs have exactly one policy-enforcement point: the enrich-findings clamp. Sections 3 and 5 below reflect this.

## Problem

The completeness-check agent's findings schema accepts only `pass` / `fail` / `not-applicable`. But the product needs a `warn` status — "deficient, but not a completeness blocker" — and today it is manufactured through two separate bolt-on workarounds:

1. **The Fail Status overlay.** Guides cc-5, cc-13, and cc-24 carry an 8th checklist column, `Fail Status` (`fail` | `warn`). The agent never acts on it — it emits plain `fail`, and `scripts/enrich-findings.ts` (and the anchored workflow's `finalize-cc-re-review.ts`) demote the fail to a displayed `warn` after the fact. Effectively these items have status vocabulary {pass, warn, n/a}, but the raw agent output says `fail`.

2. **The `[ACKNOWLEDGED DEVIATION]` marker (cc-21).** The new DCM 1.2.2 guide's Acknowledged Open Item Protocol resolves a technical fail to warn when the applicant has specifically acknowledged the deficiency, stated a remediation path, and shown active City engagement. Because the schema has no warn, the guide currently instructs the agent to emit `pass` with an `[ACKNOWLEDGED DEVIATION]` prefix in the explanation text — semantics smuggled through a string field.

Both workarounds exist because `warn` is not first-class. This spec makes it first-class and deletes both.

## Design

### One per-item status policy: the Fail Status column

The existing `Fail Status` column becomes the single source of truth for what status a deficiency produces. It gains a third value:

| Fail Status value | Deficiency produces | Eligible statuses | Used by |
|---|---|---|---|
| `fail` (default; also applies to guides/tables without the column) | fail | pass / fail / n-a | all other items |
| `warn` | warn — always; the item cannot block | pass / warn / n-a | existing cc-5/13/24 warn items (unchanged) |
| `fail-or-warn` (new) | fail, **unless** the guide's methodology defines conditions under which it resolves to warn | pass / fail / warn / n-a | cc-21-01…04, cc-21-08…10 (Acknowledged Open Item Protocol) |

Rationale for reusing the column rather than adding a new flag: it already exists in the guides, already carries exactly this meaning ("status emitted when the check fails"), and `enrich-findings.ts` already parses it (8-col format, `cells[7]`).

Two distinct meanings of a warn result from this design:
- **Advisory warn** (`Fail Status: warn`): the item is structurally non-blocking — e.g., a UCC# that is expected to be "pending" at completeness stage.
- **Acknowledged-deviation warn** (`Fail Status: fail-or-warn`): a blocking requirement is technically failed, but the submission documents a qualifying acknowledgment (see cc-21's protocol: specific acknowledgment + stated remediation path + active City engagement).

Same status value, different weight. The distinction stays human-readable via explanation conventions (acknowledged-deviation warns lead with the deficiency and quote the acknowledgment). If it ever needs to be machine-readable, add a `warnReason: 'advisory' | 'acknowledged-deviation'` field to the finding — explicitly deferred, not built now.

### Changes by component

**1. Schemas** (`bureau/workflows/completeness-check/schemas/`)

- `completeness.schema.json` and `completeness.emit.schema.json`: add `"warn"` to the `status` enum.
- `resolution` field semantics: required for `fail` (unchanged), **optional for `warn`** — an advisory warn has a natural next step worth stating; an acknowledged deviation's resolution is the applicant's own stated path. Null stays valid for pass/not-applicable.

**2. Agent prompt** (`prompts/review.md`)

Add a status-policy section to Step 4:

- Default status set is pass / fail / not-applicable.
- If the checklist table has a `Fail Status` column and an item's value is `warn`: a present deficiency is reported as `warn`, never `fail`.
- If the value is `fail-or-warn`: report `fail`, unless the grouping's Validation Methodology defines the conditions for resolving to `warn` (e.g., cc-21's Acknowledged Open Item Protocol) and those conditions are met — quote the qualifying evidence.
- Guardrail: emitting `warn` for an item whose Fail Status is absent or `fail` is an error; do not soften blocking failures.

**3. Enforcement clamp** (`scripts/enrich-findings.ts`, plus `finalize-cc-re-review.ts` in the anchored workflow)

The per-item policy is enforced by code rather than prompt compliance, at exactly one point per pipeline. For fresh runs that point is `enrich-findings.ts` (the step that parses the guides and first sees raw agent findings); the legacy fail→warn overlay downstream in `build-review-comments.ts` is deleted — the DB-write boundary passes statuses through untouched. The anchored re-review keeps its own clamp in `finalize-cc-re-review.ts` because that pipeline has no enrich step; the finalize script is its policy-application point.

Clamp rules:

- Item `failStatus=warn`, agent emitted `fail` → clamp to `warn`. (Preserves today's behavior exactly; these items can never surface a fail.)
- Item `failStatus=fail` (or column absent), agent emitted `warn` → clamp to `fail`. (Closes the agreeable-agent loophole once warn is schema-legal.)
- Item `failStatus=fail-or-warn`: both `fail` and `warn` pass through untouched — the agent's protocol determination is authoritative.
- Every clamp is logged with item ID, emitted status, and clamped status, so drift between prompt behavior and policy is visible in run output.

**4. cc-21 guide rework** (`jurisdictions/austin/completeness-check/v2.6-trimmed/cc-21.md`, mirrored in completion-officer)

- Add the `Fail Status` column: `fail-or-warn` on CC-21-01, -02, -03, -04, -08, -09, -10; `fail` on CC-21-05, -06, -07.
  - 05 (G eligibility) and 06 (G.4 certification letter) are fixed facts / prescribed submittal artifacts — no coordination narrative changes them.
  - 07 (current rainfall criteria) is deliberately blocking: wrong rainfall criteria is wrong.
- Acknowledged Open Item Protocol: the status-resolution table emits `warn` natively.
- **Delete** the "Runtime status mapping" paragraph and all `[ACKNOWLEDGED DEVIATION]`-marker instructions. Evidence conventions remain: a protocol warn's observation carries the verbatim acknowledgment quote with document name and page/sheet.

**5. Consumer sweep**

- `scripts/build-review-comments.ts`: organic `warn` in counts and rendering; the `isWarnOverlay`/`isForcedWarn` demotion logic and the `warnFromFailCount` count reconciliation are removed — statuses pass through as-is.
- `scripts/generate-reports.ts`, `scripts/cross-run-consolidate-cc.ts`: handle organic `warn` in counts, filtering, and rendering (consolidation tie-break severity: fail > unclear > warn > n/a > pass).
- `scripts/apply-forced-outcomes.ts`: writes forced warns natively (`status: 'warn'`). Previously it downgraded a forced warn to `status: 'fail'` and relied on the boundary overlay to re-derive warn — that was the last dependency on the overlay. Merge precedence unchanged: forced outcomes still override organic findings, and forced findings are exempt from the clamp.
- `prompts/format-reports.md`: warn rendering guidance.
- Anchored workflow (`jurisdictions/austin/workflows/completeness-check-anchored/`): same clamp semantics in `finalize-cc-re-review.ts`.
- **Out of repo scope, needs owner notification:** City Hall UI status rendering — organic warns will start flowing where previously warn only arrived via overlay demotion or forced outcomes.

### What is preserved, exactly

- cc-5/13/24 warn items keep their effective {pass, warn, n/a} vocabulary. The only change is *where* the warn is born (agent, clamped by code) rather than *whether* (overlay demotion). Final outputs for these items are bit-identical in status.
- Forced-outcomes TSV behavior is untouched and remains the mechanism for per-project, human-judgment overrides (e.g., ADR-07-style "confirmed non-blocker for this site plan").
- Guides without a Fail Status column behave exactly as today: binary pass/fail (+ n/a).

### Non-goals

- No `warn` in the review (technical review) workflow — this spec covers completeness-check only.
- No `warnReason` machine-readable field (deferred; see above).
- No changes to eval mappings/TSVs — warn vs. fail distinctions in scoring are a separate concern.

## Implementation order

1. This spec (winston PR).
2. Bureau: schemas → `review.md` → `enrich-findings.ts` clamp → cc-21 edits → consumer sweep (single PR).
3. Completion-officer: port cc-21 guide changes (single PR).
4. Notify City Hall UI owner about organic warns.

## Verification

- Unit-level (**done**): `enrich-findings.ts` run against a synthetic six-path fixture — advisory fail → warn (clamped, logged); blocking warn → fail (clamped, logged); fail-or-warn passes through in both directions; forced warn on a blocking item exempt; pass untouched. The same fixture then flowed through `build-review-comments.ts` post-overlay-removal: statuses pass through, counts correct (1 pass / 2 fail / 3 warn).
- End-to-end (**pending merge**): local `completeness-check` run on 1700 S Lamar v4 with `version=v2.6-trimmed`. Expected: CC-21-04 emits `warn` natively (Analysis Point 3 acknowledgment in the Engineering and Drainage Report qualifies under the protocol; the AP1 2-yr increase is a protocol matching-rule test), ADR-07-class items unchanged vs. prior runs.
