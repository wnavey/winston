# Workflow Triad Audit: Formal Review · Completeness Check · Comment Resolution Check

**Date:** 2026-07-02
**Scope:** Cross-review of the three checklist-driven review workflows in Bureau — their workflow definitions, agent prompts, output schemas, downstream comment-shaping steps, and guide-file formats.

Sources audited:

| Workflow | workflow.yaml | Core prompt | Guide set sampled |
|---|---|---|---|
| Formal Review (v5.2.0) | `bureau/workflows/review/` | `prompts/review.md` | `bureau/jurisdictions/austin/review-guides/sduf/4.md` (+ dir structure) |
| Completeness Check (v1.0.0) | `bureau/workflows/completeness-check/` | `prompts/review.md` | `bureau/jurisdictions/austin/completeness-check/v2.5-trimmed/cc-3.md` |
| Comment Resolution Check (v1.0.0) | `bureau/workflows/comment-resolution-check/` | `prompts/review.md` | Local gen dir for Lamar + Collier v4: `crc-TPW-1.md`, `crc-aw-redlines.md`, manifest/figures/titles.json |

Also read: `synthesize-simplified.md`, `format-reports.md`, `enrich-final-comment.md`, the three output schemas (`review.schema.json`, `completeness.schema.json`, `crc.emit.schema.json`), and the CRC workflow README.

---

## 1. The shared skeleton

All three workflows are instances of the same architecture, and it's worth naming it because it's a real asset — a proven, reusable "checklist review machine":

1. **Guide files as the unit of work.** A markdown guide per grouping/department, containing a description, domain overview, documents-to-review, and a checklist table. One agent per guide file, fanned out in parallel (`checklistItems` glob + `maxWorkers`).
2. **The same evidence substrate.** All three navigate identical pre-processed site-plan data with an identical progressive-reading pattern: `README.md` → `facts.md` → `sheet-NN/guide.md` → `sheet-NN/blocks.md` → `supplementary-docs/*/overview.md`. The prompt text for this section is nearly copy-identical across the three prompts.
3. **The same epistemics.** Burden of proof on the applicant: never mark pass/resolved without affirmative, citable evidence; track what you could NOT find; missing evidence is a finding, not a shrug.
4. **Vision as an escalation, not a default.** All three: "pre-processed text first, vision only for targeted questions, provide full context, use documentId not projectId, the tool is slow — be judicious."
5. **Structured output against a JSON schema**, with per-finding `evidenceLocations` (`documentId` + `sheetNumber` + `label`) as the traceability primitive.
6. **Script-based deterministic post-processing** (consolidate → enrich → build `review-comments.json`) ending in the same review-saver contract (`reviews` / `review_sections` / `review_comments`).
7. **Multi-run majority vote as an optional dial.** Review defaults to runs=3; CC and CRC default to runs=1 with the same `runs` + cross-run-consolidate machinery available.

The differences below are mostly *appropriate specializations* of this skeleton for three different questions: "is this plan compliant?" (review), "is this submission complete enough to review?" (CC), and "did the resubmittal fix what the city flagged?" (CRC).

---

## 2. Side-by-side comparison

### 2.1 Task shape and status vocabulary

| | Formal Review | Completeness Check | CRC |
|---|---|---|---|
| Question | Open-ended compliance vs. trained deficiency checklist | Presence/completeness of required documents, data, notes | Closed-form: does U1 resolve each U0 comment? |
| Statuses evaluated | pass / fail / not-verifiable / n/a | pass / fail / not-applicable | resolved / failed (moot → resolved) |
| Statuses **emitted** | Only fail + not-verifiable | ALL items | ALL items |
| Ambiguity handling | First-class `not-verifiable` status | Collapses to `fail` ("applicant must provide verifiable materials") | Collapses to `failed`; multi-run adds `uncertain` via dissent-share threshold |
| Unverifiable-content policy | Distinct from fail | Same as fail | Same as failed |

Each of these vocabularies is *right for its task* — the divergence is a feature, not drift. Review needs `not-verifiable` because a technical requirement may be genuinely unassessable from submitted materials. CC is correct to collapse it: an unreadable submission is by definition incomplete. CRC is correct to be binary: the applicant either demonstrated resolution or didn't — but note that CRC is the only workflow where "uncertain" exists as a *consolidated* status (from vote dissent) rather than a per-agent status. That's a genuinely different and arguably better mechanism: uncertainty as an *emergent, measured* property rather than a self-reported one.

### 2.2 Ensemble and model economics

| | Formal Review | Completeness Check | CRC |
|---|---|---|---|
| Default model | Haiku 4.5 | Sonnet 5 | Sonnet 5 (enrichment: Haiku 4.5) |
| Default runs | 3 (ensemble is the design) | 1 (medly optional) | 1 (medly optional) |
| Confidence | Per-detail 1–3 from run count | Majority vote when runs>1 | high/medium/low tier + `uncertain` gate (`uncertainThreshold` dissent share, runs≥3) |
| Rationale | Many checklist items × cheap model × N passes; union recall is the target | Few items per guide; quality per pass matters | Few atomic items; quality per pass matters |

Two coherent philosophies: **cheap-model ensemble** (review) vs. **strong-model single-pass** (CC/CRC). Review's docs claim 89.6% union recall from the 3× Haiku design. CC and CRC inherited the ensemble machinery but treat it as an experiment dial. Nobody has published (as far as this audit found) a head-to-head of "3× Haiku ensemble vs 1× Sonnet" on the *same* guide set — that's the experiment that would tell you whether the two philosophies are both locally optimal or one is just older.

### 2.3 Tools

| Tool | Review | CC | CRC |
|---|---|---|---|
| `vision` (plain) | ✅ | ✅ | — |
| `site_imagery` (research-stage aerials/street view, caption-first) | ✅ | — | — |
| `script:semantic-search-blocks` (meaning-based block search) | — | ✅ | ✅ |
| `crc-vision-check` (vision + reference-figure attachment + per-item attribution) | — | — | ✅ |
| Vision specialists experiment (`vision_check` dispatcher: generic / inspect-drawing / measure-distance) | ✅ (experiment) | ✅ (experiment) | — |

The most striking asymmetry: **formal review — the workflow with the largest checklists and the highest miss cost — is the only one without semantic search.** Its prompt even instructs the agent to "verify on ALL relevant sheets — not just the first sheet where you find it," which is exactly the failure mode semantic search was added to CC to fix (content living on a non-obvious sheet). Conversely, CC and CRC lack `site_imagery`, which is defensible (completeness and resolution rarely need aerials) but was probably never actively decided.

`crc-vision-check` is the most advanced vision tool of the three: it attaches reviewer-supplied reference figures alongside the U1 sheet for side-by-side comparison, and requires `checklistItemIds` on every call so a verdict can later be traced to the exact image it was based on. Neither the plain `vision` tool in review nor CC has per-item attribution — which is why vision-coverage analytics (Inspector General) had to be reconstructed via LLM classification instead of read from logs.

### 2.4 Knowledge injection

Only formal review injects domain knowledge into the prompt: `disciplineKnowledge` (`bureau/disciplines/{code}.md`), `commonKnowledge`, and `jurisdictionGuidance` — all optional, with an explicit precedence rule (guide beats injected knowledge). CC and CRC bake domain context into the guide itself (`Overview` / `Regulatory Overview` / `Key Terms` sections) and inject nothing.

Both approaches work, but they represent different maintenance models: review's knowledge is *shared across groupings and updated in one place*; CC/CRC knowledge is *frozen into each guide at generation time*. For CRC (guides are per-project, disposable) freezing is right. For CC (guides are long-lived, versioned v1→v2.6-trimmed) the frozen Key Terms sections will silently rot as code changes — the same class of problem the training pipeline's `research` step exists to catch for review guides.

### 2.5 Guide file anatomy

| Section | Review guide (`sduf/4.md`) | CC guide (`cc-3.md`) | CRC guide (`crc-TPW-1.md`) |
|---|---|---|---|
| Description | ✅ | ✅ | ✅ |
| Regulatory/domain overview | ✅ (very dense — thresholds, exceptions, calc methods) | ✅ (lighter "Overview") | ✅ |
| Key Terms glossary | — | ✅ (distilled from Bureau glossary) | ✅ |
| Source / provenance | — (implicit: training pipeline) | Requirement Source + Source Type **per item** | ✅ dedicated section (MCR pdf / redline pdf) + Parent Comment per item |
| Documents to Review | ✅ | ✅ | ✅ |
| **Validation Methodology** (HOW to check) | — | ✅ (cross-reference / vision / GIS hints, per-item carve-outs) | ✅ (incl. cross-item consistency rules) |
| Checklist columns | ID, Deficiency, Code Citation, Applicability (free prose) | ID, Item, **Condition** (Always / If…), Location, **Location Binding** (explicit/flexible), Requirement Source, Source Type | ID, Parent Comment, Requirement, Code Citation, **Severity**, **Evidence expected**, Evidence form |
| Reference materials for verbatim checks | — | ✅ (Bureau path + section heading + match criteria) | — (figures play this role) |
| Figures (images for vision) | — | — | ✅ (cropped, pre-described, constraint-extracted) |
| Notes / caveats | ✅ (incl. "unconfirmed citations" flags) | — | — |

Observations:

- **CC's `Condition` column is the most machine-like applicability model.** Review expresses applicability as free prose per item ("Only when the site is within the UNO district… Check: Zoning field in facts.md"), which is richer but unparseable; CC's "Always / If X" is checkable and even has a default rule ("if a condition cannot be determined, treat as applicable"). CRC's `Evidence expected` column is a third model — it tells the agent *where to look*, which neither of the others does per-item.
- **CC's `Location Binding` (explicit vs flexible) is a quietly excellent concept**: it encodes whether a requirement is satisfied anywhere in the plan set or only on a specific sheet — precisely the distinction that drives the semantic-search decision rule. Review has no equivalent, and its guides implicitly treat everything as flexible.
- **Review guides carry uncertainty metadata** ("Items with unconfirmed citations… verify before citing") — an honesty mechanism the other two lack, though CRC needs it least (its citations come from the city's own comments).
- **CRC's Validation Methodology encodes cross-item logic** — disjunctive satisfaction (TPW-3.1's either/or), paired-item consistency (TPW-3.1 ↔ TPW-4.1 must agree), and "a note without a dimension callout fails." This is the only workflow whose guides express *relationships between checklist items*; the other two evaluate items independently.
- **Two CRC guide dialects coexist** (MCR-sourced `crc-TPW-1.md` vs redlines-sourced `crc-aw-redlines.md`, from sibling generation skills). The redlines dialect drops Regulatory Overview/Key Terms and mostly has empty Code Citations, but adds richly-described site-specific figures. The review prompt handles both because sections are declared "may be omitted when empty" — a deliberately tolerant reader, which is good design.

### 2.6 Output schema and the structured-output retry storm

The three schemas share the finding primitives but differ in a way that captures an important lesson:

- **Review**: agent emits `{grouping, findings[]}`; findings are terse (`deficiencyId`, `status`, `codeCitations`, areas, sheet/document refs, `comment`). No observation/reasoning fields — chain-of-evidence lives only in the optional `agentTrace` extended schema.
- **CC**: agent emits `{grouping, findings[], summary}`; every finding carries `observation` → `reasoning` → `tools_used` → verdict → `explanation` → `resolution` (+ structured `resolutionDetails` diff for standard-note failures). The prompt spends ~30 lines with WRONG/CORRECT JSON examples fighting envelope mistakes.
- **CRC**: same finding shape as CC, but the emit schema (`crc.emit.schema.json`) **deliberately drops top-level `grouping`** — it's derivable from the cell's filename, so the runner injects it post-hoc. Per the schema's own comment, requiring `grouping` was the single most common validation error and drove the retry storm (`crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md`).

The CRC fix — *never make the agent emit what the harness already knows* — is a general principle discovered in the newest workflow and not yet backported. CC still requires `grouping` (and still fights it in prompt prose); review requires it too and adds a prompt warning about prefix mistakes ("`4.md` → `\"4\"`, not `\"sduf-4\"`") — a bug class that would vanish entirely under the CRC approach.

The `observation → reasoning → verdict` field ordering in CC/CRC is also a real epistemide improvement over review's bare `comment`: it forces evidence documentation *before* the verdict token is produced, and gives auditors (Inspector General) structured material to evaluate. Review only gets this through the non-default extended schema.

### 2.7 Downstream comment shaping

Three genuinely different pipelines after findings land:

- **Review** (heaviest): split-by-grouping → per-grouping **synthesis agents** (4:1 consolidation with an information-preservation directive, three-tier scope classification, program-hierarchy citation correction, severity 0–3, cross-department + attention flags) → manifest → **section-organizer agent** → deterministic merge. Plus a complete parallel **re-review path** (compare vs prior review → synthesize only new findings → rewrite reconciled comment headlines).
- **CC** (lightest): enrich-findings script → one **format-reports agent** producing human-readable markdown reports + rephrased affirmative-question titles (preferring an authored TSV over LLM rephrasing) → build script. Also unique: **forced outcomes** (a TSV that overrides organic findings with AI-narrated forced verdicts, tagged in the trace) and comment-number mapping TSVs to match an external consultant's numbering.
- **CRC** (most surgical): enrich-findings → per-atomic-item **enrichment fan-out** (one Haiku agent per comment; ~80–150 cells; `continueOnFailure` + null-fill isolation) producing applicant-facing prose with a **forbidden-terms lint** (no first person, no run references, no internal idioms like U0/U1/MCR/blocks.md, no UUIDs — with a lint-failed → null → UI-fallback ladder) → **rephrase-titles with a titles.json cache** persisted back to the bucket so titles stay stable across re-runs → build script.

Each has something the others want:

- Review's synthesis has the only **consolidation intelligence** (many atomic findings → few coherent comments) and the only **cross-department / program-hierarchy reasoning**.
- CC's **authored-titles-first** rule ("prefer authored titles; never rephrase them") is the correct human-in-the-loop posture; review regenerates all headlines every run.
- CRC's **forbidden-terms lint + graceful null fallback** is the only mechanism anywhere that guards against internal jargon leaking to an external audience — and review's synthesized comments and CC's reports go to equally external readers with no such guard.
- CRC's **title cache** is the only anti-churn mechanism: re-running any of the other workflows can shuffle titles/headlines for unchanged findings, which reads as instability to a repeat customer.

### 2.8 Evaluation and ground truth

- **Review**: full eval loop — download atomic MCR, per-run Opus eval agents, deterministic union-recall scoring. This is the backbone of every training-quality claim (89.6% recall).
- **CC**: no accuracy eval at all. The only correction mechanisms are operational (forced outcomes, authored titles).
- **CRC**: no eval; the README explicitly defers it ("separate workflow when labeled data exists") and offers a smoke test (run U0 guides against U0 plans → everything should fail) — a clever *calibration* test, but one-sided (it can only detect false-resolved bias, not false-failed).

This is the largest maturity gap in the triad. CC has shipped through v2.6-trimmed with per-version trims justified by… judgment. CRC has natural ground truth waiting: when the city issues the *next* MCR on U1, every U0 comment the city dropped is a labeled "resolved" and every re-raised comment is a labeled "failed."

### 2.9 Guide provenance and lifecycle

| | Review | CC | CRC |
|---|---|---|---|
| Author | Training pipeline (6-step, bottom-up from ~200k historical comments) | Hand-curated + trimmed, versioned dirs (`legacy`…`v2.6-trimmed`) with `CURRENT_VERSION` pointer | Generated per project by `generate-crc-guides` / `-from-redlines` skills (HITL) |
| Storage | Bureau git (long-lived) | Bureau git (long-lived, versioned) | Supabase `crc-guides` bucket (per-run fetch; disposable) |
| Scope | Jurisdiction × discipline | Jurisdiction | Single project × submission cycle |
| Staleness risk | Managed (training `research` step validates vs code) | Unmanaged (frozen Key Terms/notes) | Irrelevant (lifespan ≈ one review cycle) |

CC's `CURRENT_VERSION` file-pointer and version directories are a nice lightweight release mechanism review lacks (review guides are just "whatever's on main"). CRC being bucket-fetched rather than git-fetched is right for per-project artifacts, but note it's the only guide set outside Bureau's PR-review discipline — the compensating control is the HITL generation skill plus `decisions.md`/`ignored-comments.md` audit artifacts, which is honestly a *better* provenance trail than either of the others produces.

---

## 3. Strengths and weaknesses per workflow

### Formal Review

**Strengths**
- The ensemble + union-recall design is the only architecture here with a *measured* accuracy story, and confidence tiers derived from run agreement are more trustworthy than self-reported confidence.
- Deepest comment synthesis: consolidation, scope tiers, program/overlay hierarchy correction, severity, cross-dept routing, re-review reconciliation.
- Only workflow with injected, centrally-maintained domain knowledge and with a citation-accuracy doctrine ("a wrong citation is worse than no citation" + guide-column-as-primary-source).
- Guides carry the richest regulatory reasoning (thresholds, exceptions, calculation methods) and self-declared uncertainty notes.

**Weaknesses**
- No semantic search — the "found it on the wrong sheet → false fail" and "missed it on a second sheet → false pass" failure modes are addressed only by prompt exhortation.
- Emits only fail/not-verifiable by default: pass determinations are invisible (no observation/reasoning trail) unless the extended-trace variant is on, which limits auditability and precision measurement (you can measure recall against the MCR, but false-fail analysis has less to work with).
- Free-prose applicability column: not machine-checkable, and applicability logic is re-derived by the agent every run.
- Headline/comment churn across runs — no title caching or authored-title override.
- Still requires the agent to emit `grouping` (retry-storm bug class CRC already fixed).

### Completeness Check

**Strengths**
- Most structured checklist row in the triad: Condition, Location, Location Binding, Requirement Source, Source Type — applicability and search strategy are data, not prose.
- Validation Methodology section + Reference Materials (Bureau path + heading + explicit semantic-match criteria) ground verbatim-note checks in canonical text instead of agent memory.
- Semantic search with a codified decision rule (search before failing "missing from cover sheet").
- Pragmatic operational controls nothing else has: forced outcomes, external comment-number mapping, authored titles — the mechanisms that make a workflow deployable with a real customer (Pape-Dawson) before the AI is perfect.
- Strict-but-fair completeness epistemics: "unverifiable = incomplete = fail" is the correct standard for intake review.

**Weaknesses**
- Zero accuracy evaluation — no ground truth, no scoring, no regression detection across checklist versions.
- Frozen domain knowledge (Key Terms, note inventories) with no revalidation step; the Notes-and-Templates DOCX it checks against changes on the city's schedule, not Bureau's.
- Single-agent format-reports step is a serial bottleneck and a single point of failure at the end of an otherwise fan-out pipeline (contrast CRC's per-comment enrichment fan-out with `continueOnFailure`).
- Fights the structured-output envelope in prompt prose rather than fixing the schema the way CRC did.
- Report prose goes straight to external readers with no forbidden-terms/jargon lint.

### Comment Resolution Check

**Strengths**
- The sharpest task framing of the three: "closed-form verification, not open-ended review," with an explicit definition of `resolved` (positive evidence OR moot) and an explicit anti-loophole rule (moot is not an escape hatch for ambiguity; ambiguity collapses to failed).
- `crc-vision-check` with reference-figure attachment is the best evidence tool in the system — it gives the vision model the reviewer's own redline/reference detail to compare against, and per-call `checklistItemIds` attribution makes verdicts traceable to images.
- Cross-item consistency rules in Validation Methodology (paired items must agree; disjunctive paths must both be checked before failing).
- Most engineering maturity per line: lenient emit schema (retry-storm fix), per-cell failure isolation with null-fill, dissent-share `uncertain` gate, forbidden-terms lint with graceful degradation, titles cache for cross-run stability. Every one of these is a hard-won generalizable pattern.
- Best provenance: every atomic item maps 1:1 to a city comment or redline, with figures, `decisions.md`, and `ignored-comments.md` as an audit trail.

**Weaknesses**
- No accuracy eval and only a one-sided calibration smoke test (catches false-resolved bias only).
- Iteration-1 gaps by design (no comment_triage, no prior-review chaining, no cross-cycle linkage to the formal-review re-review path).
- Two guide dialects (MCR vs redlines) with meaningfully different information density — redlines rows have no code citations and no regulatory overview, so the agent leans entirely on figures; nothing measures whether verdict quality differs between dialects.
- Binary status means a genuinely-uncertain single-run verdict *must* be recorded as failed; the `uncertain` mechanism only exists at runs≥3, which is not the default.
- Guides live outside Bureau git review (mitigated by HITL generation, but the mitigation is a skill convention, not a control).

---

## 4. Conceptual overlap worth watching: re-review vs CRC

Formal review's re-review path (compare new findings vs prior review → resolved/outstanding/new) and CRC answer *adjacent but different* questions:

- Re-review: "of the things **our AI** flagged last cycle, which still appear?" — anchored to our own prior comments, evaluated by re-running the full open-ended review.
- CRC: "of the things **the city** flagged, did the applicant resolve them?" — anchored to the city's MCR, evaluated as closed-form verification.

These should stay separate workflows, but they will converge in the product ("what changed since last cycle?") and there is no shared vocabulary yet for comment identity across cycles (review matches by comment_number/content in `compare-prior-review`; CRC matches by parent-comment ID from the MCR). Worth a deliberate design note before iter-3 CRC chaining lands, so the two don't grow incompatible notions of "same comment, next cycle."

---

## 5. Recommended next actions

Ordered roughly by leverage. None of these is "unify the workflows" — they're targeted transplants and a few net-new concepts.

### Transplants (proven in one workflow, missing in another)

1. **Backport the lenient emit schema to CC and review.** Drop agent-emitted `grouping` (runner injects from cell filename), exactly as `crc.emit.schema.json` does. Deletes a documented retry-storm bug class and ~40 lines of defensive prompt prose across the two older workflows. Low risk: downstream shapes unchanged.
2. **Give formal review `semantic-search-blocks`.** It's already a shared script (CC and CRC both mount it); add the tool + CC's decision rule ("search before failing on location; search before passing on absence") to the review prompt. Directly targets both wrong-sheet false-fails and multi-sheet false-passes. Cheap A/B: run the eval suite with/without.
3. **Adopt `observation → reasoning → tools_used` fields in review's default schema.** CC/CRC's evidence-before-verdict ordering is better epistemics and is what Inspector General needs for citation/evidence audits. Review currently only gets this via the non-default extended trace.
4. **Add a jargon/forbidden-terms lint to review synthesis and CC reports.** CRC's enrichment lint (no internal idioms, no run refs, no IDs; lint-fail → fallback rather than bad prose) should become a shared library — `enrichment-lint.ts` already exists and is tested; generalize the term table per audience.
5. **Title/headline stability for review and CC re-runs.** Port CRC's titles.json cache pattern (CC already half-has this via the authored TSV; review has nothing — synthesized headlines reshuffle every run, which will read as flakiness once re-reviews are customer-visible).
6. **Structure review-guide applicability.** Move the free-prose Applicability column toward CC's `Condition` ("Always / If X / check field Y in facts.md") and consider CC's `Location Binding` and CRC's `Evidence expected` as additional columns during the next training-pipeline revision. This is a training-pipeline prompt change (steps 5–7), not a hand-edit of 59 guides.
7. **Add a Validation Methodology section to review guides.** CC and CRC both tell the agent *how* to verify (cross-reference vs vision vs search; per-item carve-outs like "don't fail if the erosion-control contact line is blank"). Review guides say only *what* is deficient — the how is re-derived every run by a Haiku agent. The training pipeline's research step already gathers most of the needed material.
8. **Give CRC (and CC) per-item vision attribution's sibling: consider `site_imagery` where relevant** — low priority, but decide deliberately per workflow instead of by inheritance. Conversely, evaluate exposing `crc-vision-check`-style `referenceImages` to CC for standard-note/standard-detail comparisons (CC's verbatim checks against Notes-and-Templates are exactly a compare-against-reference task; today they run text-only through Bureau reference files).

### Evaluation gaps (net-new, highest strategic value)

9. **Build a CC eval set.** Take 5–10 historical submissions with known intake outcomes (or have a reviewer label one run's findings), and wire the review workflow's eval pattern (per-run eval agent + deterministic scoring) into CC. Without this, checklist-version trims (v2 → v2.6) are unfalsifiable.
10. **Close the CRC ground-truth loop.** When a U2 MCR arrives for a project CRC ran on U1: city-dropped comments = labeled resolved; re-raised = labeled failed. Build the small workflow the CRC README defers — this is the cheapest labeled data in the whole system because the city produces it for free every cycle.
11. **Make the CRC smoke test two-sided.** Today's U0-vs-U0 test only catches false-resolved bias. Add the mirror: run CRC guides against a plan set known to resolve a subset (or synthetically patch a few sheets) so false-failed bias is also measurable.
12. **Run the ensemble-vs-strong-model experiment.** 3× Haiku (review's philosophy) vs 1× Sonnet (CC/CRC's philosophy) on the same guide set with the same eval — both cost and accuracy. The machinery exists on all three workflows (`runs`, `model` inputs); what's missing is one deliberate comparison to justify the defaults, and it would inform whether CRC's default runs=1 (where ambiguity forcibly collapses to failed with no `uncertain` gate) is leaving accuracy on the table.

### New concepts (nothing does these today)

13. **A guide-file spec + linter per dialect.** Bureau has a content spec and a workflow validator, but no schema for guide files — the contract between generators (training pipeline, CC curation, two CRC skills) and the three review prompts is implicit. A per-dialect linter (required sections, checklist columns, ID formats, condition syntax, figure-path validity) would catch generator drift before it becomes silent agent confusion. The CRC guides' "sections may be omitted when empty" tolerance should be part of the spec, not folklore.
14. **Extract the shared prompt skeleton.** The site-plan-navigation block, vision etiquette, and burden-of-proof rules are near-identical triplicated prose that has already drifted in small ways. Even without template includes, designate a canonical source file and a periodic diff check so improvements (e.g., review's "verify on ALL relevant sheets" clause) propagate instead of forking.
15. **Cross-item consistency as a first-class guide feature.** CRC's paired-item rules (TPW-3.1 ↔ TPW-4.1 must agree) point at a general capability: checklist items that constrain each other (disjunctive alternatives, mutually exclusive paths, shared calculations). Review guides have implicit versions of this (SDUF-4.50 depends on SDUF-4.51; SDUF-4.14 supersedes 4.15–4.19 on Active Edge frontages) expressed only as prose cross-references. A lightweight `dependsOn`/`supersededBy` column — enforced by a post-review consistency script — would catch contradictory verdicts that today ship silently.
16. **Applicability pre-pass.** All three workflows have every agent independently re-derive applicability from facts.md every run. A single cheap upstream step (script + small model over facts.md + the structured Condition columns) could pre-compute per-item applicability verdicts, shrinking agent scope, cutting cost, and making n/a determinations consistent across runs and across groupings. CC's structured Condition column makes it the natural pilot.
17. **Unified cross-cycle comment identity.** Before CRC iter-3 chaining and more re-review usage, write the short design note (§4) defining how a comment is identified across submission cycles (city comment ID vs our comment_number vs checklist item ID), so review's re-review path, CC's priorReviewId linkage, and CRC's parent-comment lineage converge on one model instead of three.

---

## 6. Summary table

| Dimension | Formal Review | Completeness Check | CRC |
|---|---|---|---|
| Maturity | v5.2, eval-backed, production across 15 depts | v1.0 but battle-tested with customer controls | v1.0, iter-1 MVP, most modern engineering |
| Best idea to steal | Ensemble + eval loop; synthesis consolidation | Condition/Location-Binding columns; Reference Materials; forced outcomes | Lenient emit schema; reference-figure vision; forbidden-terms lint; titles cache |
| Biggest gap | No semantic search; invisible pass reasoning | No eval; frozen domain knowledge | No eval; binary status at default runs=1 |
| Guide lifecycle | Trained, git, long-lived | Curated, git, versioned | Generated, bucket, per-cycle |
| Keep different? | Yes — open-ended compliance needs ensembles + synthesis | Yes — intake screening needs strict presence logic + operational overrides | Yes — closed-form verification needs figures + provenance |
