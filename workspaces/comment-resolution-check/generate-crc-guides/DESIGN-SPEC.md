# `generate-crc-guides` — Design Spec

> **Status:** Draft, 2026-06-18. Iteration-1 of the [CRC spec](../SPEC.md) §4-A and §5.
> Drives implementation of the first of three CRC components: the Claude Code skill
> that turns an MCR PDF into per-department crc-guide markdown files.

---

## 1. Overview

**Purpose.** A Claude Code skill that turns a Master Comment Report PDF into per-department crc-guide markdown files — atomic checklist items, a regulatory overview / key terms / validation methodology enriched from bureau, and figures cropped from the MCR with vision-generated descriptions — ready for the CRC Conductor workflow to verify against an updated plan set.

**Location.** `~/noetic/claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/`

**Invocation.** `/generate-crc-guides` with either:
- A path to the MCR PDF and *no* submission ids → skill prompts the human for project name + version (and resolves the rest via Supabase), OR
- Any combination of `--mcr-pdf`, `--project-id` / `--project-name`, `--submission-id`, `--submission-version-id`, `--submission-version-number` as CLI args. The skill walks whichever rung of the ladder it's given.

**Out of scope.** AW redlines, AE Bluebeam, anything not in the MCR text.

---

## 2. Inputs

### 2.1 Required (one way or another)
- **MCR PDF** — local file path. User-supplied.
- **A resolved `submission_version` row** — either supplied directly via `--submission-version-id`, or resolved via the lookup ladder in §3.1.

### 2.2 Interactive prompts (when not given as CLI args)
1. **Project name** — fuzzy-matched against `project.name`. If multiple matches, `AskUserQuestion` picks one.
2. **Submission version number** — integer. Resolved against the single `submission` row with `submission_type='site_plan'`. If multiple `site_plan` submissions exist, prompt for which.

### 2.3 Short-circuits
- `--submission-version-id` → skip all DB lookups.
- `--project-id` → skip project name search; still resolve submission + version.
- `--submission-id` → skip submission search; still resolve version.

### 2.4 Working directory

The skill operates from `$NOETIC_WORKING_DIR`, a **conceptual root** for the user's noetic layout. Defaults to `~/noetic`. **Not a real environment variable** — it's notation for "wherever the user's noetic checkouts live." The skill reads bureau from a sibling directory and writes CRC outputs to another sibling directory.

```
$NOETIC_WORKING_DIR/                            # default: ~/noetic
├── bureau/                                     # read by Phase 6.3 + Phase 6.5
└── comment-resolution-check/                   # written by Phase 8
    └── {projectUuid}/{submissionUuid}/{...}/
```

**Validation (runs first in Phase 0).** Before any DB or LLM work:

1. Compute the candidate root. Default: `~/noetic`.
2. Check that `{root}/bureau/` exists.
3. If yes → that root is also the CRC output root. Proceed.
4. If no → **fail fast** with: "Bureau not found at `{root}/bureau`. Provide the correct `$NOETIC_WORKING_DIR` (the directory that contains `bureau/` as a child). CRC outputs will land at `{provided_root}/comment-resolution-check/...` — a sibling of bureau." Re-validate the new value before proceeding.

Single check anchors all reads (bureau) and writes (CRC outputs) against the same root. Modeled after diligence-report's `working-dir.md` pattern, but simpler — one conceptual variable instead of four real env vars.

---

## 3. Pipeline

### Phase 0 — Pre-flight + resolve submission_version

**3.0 Working directory check.** Validate `{NOETIC_WORKING_DIR}/bureau/` exists per §2.4; fail fast and prompt for the correct root if not. This determines where Phase 8 writes outputs (sibling of bureau).

**3.1 Lookup ladder** (each step skipped if its output is already pinned by a CLI arg):

```
project.name (input)  →  SELECT id FROM project WHERE name ILIKE '%input%'
                          ↳ multiple? AskUserQuestion to disambiguate
project.id            →  SELECT id FROM submission WHERE project_id=$1 AND submission_type='site_plan'
                          ↳ multiple? AskUserQuestion to disambiguate
submission.id + ver#  →  SELECT id FROM submission_version
                              WHERE submission_id=$1 AND version_number=$2
```

Output: `{projectUuid, submissionUuid, submissionVersionId, submissionVersionNumber}` — printed back to the user before proceeding.

**Implementation:** direct MCP calls to `mcp__claude_ai_Supabase__execute_sql`.

### Phase 1 — Parse the MCR PDF

**Approach:** copy MCR → `pdftotext` → LLM extraction pass over the text. Vision is *not* used in MVP.

1. **Copy the source MCR PDF** to `{gen-dir}/mcr.pdf`. The user-supplied path can be anywhere; after this step, all downstream phases (and the bucket upload) reference the local copy at a known location. Original filename + sha256 captured in `manifest.json` for traceability.
2. Run `pdftotext -layout {gen-dir}/mcr.pdf {gen-dir}/scratch/mcr.txt`.
3. Single LLM extraction pass that emits a structured JSON array of raw comments:

   ```jsonc
   {
     "raw_id": "TPW 6",          // exactly as it appears in the PDF
     "dept_prefix": "TPW",
     "comment_number": "6",
     "status": "Pending",         // verbatim from the MCR
     "body": "...full text...",   // U0: prefix stripped if present
     "code_reference": "TCM 9.2.3.1.B", // null if absent
     "source_page": 12
   }
   ```

4. Save raw extraction to `scratch/raw-comments.json` for re-runs / debugging.

**Both ID conventions handled in the same prompt:** `DEPT N:` and `DEPT N – Current Status: ...`. The `U0:` body prefix is stripped when present.

### Phase 2 — Department classification

For each raw comment, map `dept_prefix` → city department name via `references/dept-prefix-dict.tsv` (hand-authored, shipped with the skill). Format:

```
prefix    department_name                                         notes
SP        Site Plan                                               DSD Site Plan reviewer
TPW       Transportation & Public Works
DE        Drainage Engineering
CA        City Arborist
WQ        Water Quality
CM        Construction Management
PR        PARD / Planning & Design Review
OWB       One Water Bureau
AWRR      Austin Water — Resource Recovery
AD        Austin Development
PB        Parks Board / Parkland
```

Unknown prefix → **HITL bucket**: prompt user to (a) add to the dict and continue, or (b) drop with a logged reason.

### Phase 3 — Status filter

For each comment, classify status into one of three buckets:

- **Keep:** `Pending`, `New`, `Rejected` (case-insensitive).
- **Drop (status):** `Cleared`, `FYI`, `Informational`.
- **HITL:** anything else.

HITL bucket items get logged for the end-of-run prompt (see §4).

### Phase 4 — Severity classification

The MCR doesn't carry an explicit severity field per comment. We **infer severity from the body language** via an LLM judgment pass:

- **`required`** — language like "shall", "must", "is required", "comply with §…", "submit before approval".
- **`recommendation`** — "should", "consider", "recommend", "we suggest".
- **`note`** — "note that", "FYI" (when status filter didn't catch it), "for your information".

Items classified `note` → dropped, logged as **drop (severity)**.

### Phase 5 — Plan-verifiability filter (LLM per comment)

For every kept comment, an LLM call answers:

> "Could a civil engineering revision to the site plan PDFs make this comment satisfied? Answer `yes`, `no`, or `uncertain`. If `no` or `uncertain`, classify why: `pay-fee`, `schedule-meeting`, `submit-worksheet`, `execute-agreement`, `external-approval`, `procedural-other`, `unclear`."

- `yes` → keep.
- `no` → drop, log reason.
- `uncertain` → HITL bucket.

### Phase 5.5 — Figure extraction (post-filter)

For comments surviving Phases 3–5, extract any figures the MCR attached. Runs after the filters so we don't burn vision calls on dropped comments.

**Inputs:** kept comments (each carries `source_page` from Phase 1), the MCR PDF.

**Steps:**

1. **Rasterize relevant pages.** `pdftoppm -r 150 mcr.pdf scratch/pages/page` → `page-NN.png`. Only render pages that host at least one kept comment.
2. **Haiku detect + bound (one call per page).** Combined detection + bounding pass. Prompt:
   > "Page N of an MCR. Kept comments on this page: `[{id: TPW 12, text_excerpt: '...streetscape... TCM 2.8.2.2'}, ...]`. For each figure on the page, return `{comment_id, bbox_pct: {x, y, w, h}, brief_label: '5-word figure label'}`. Express bbox as percent of page so it's DPI-independent."
3. **Crop.** `convert page-NN.png -crop W%xH%+X%+Y% scratch/figures/{parent_comment_id}/N.png`. Sequential numbering per parent (`1.png`, `2.png`, ...).
4. **Sonnet describe (one call per cropped figure).** Prompt produces a type classification + a description + a constraints list:
   > "Cropped figure attached to MCR comment `{comment_id}: {comment_body_excerpt}` citing `{code_ref}`. Return JSON:
   > - `type`: `reference-design` (a generic ideal-state diagram from a code or standard, not specific to this site plan) | `site-specific` (a screenshot, markup, or photo showing a defect or condition on the submitted plan) | `unclear`.
   > - `description`: 2–4 sentences describing what the figure shows and any visible dimensions / labels / annotations.
   > - `constraints`: array of numeric constraints visible (minimum dimensions, separations, offsets) as short strings."
5. **Attach to raw comments.** Each kept comment gets a `figures` array:
   ```jsonc
   "figures": [{
     "local_path": "scratch/figures/TPW-9/1.png",
     "caption": "TCM Fig. 9-2 — Standard parking bulb-out",
     "type": "reference-design",
     "description": "Plan view of a parking bulb-out showing minimum dimensions: 30' end space, 22' interior space, 18' min from lane edge, 7-8' stall width, 10-11' lane width...",
     "constraints": ["min 30' end space", "min 15' from hydrant", "min 7–8' stall width"]
   }]
   ```

**Inheritance.** When Phase 6 decomposes a parent comment, all atomic sub-items inherit the parent's `figures` array (figures are parent-scoped, not per-sub-item).

**Feeds Phase 6.5 enrichment.** Figure descriptions + constraints are part of the per-dept enrichment LLM's context, so Regulatory Overview / Validation Methodology can ground statements in the figure's actual content (e.g., "TPW 9 supplies TCM Fig. 9-2 with min 15' hydrant offset — verification requires the U1 striping plan to match that dimension").

**HITL backfill.** If Phase 7 HITL flips a previously-dropped comment to `include`, Phase 5.5 is re-invoked just for that comment's `source_page` to backfill its figures.

**Iteration-1 simplifications.** No image hashing / de-duplication — same figure under multiple comments produces multiple copies. No cross-run caching — re-runs always re-extract.

### Phase 6 — Decomposition

For each kept comment, apply CRC decomposition rules:

1. **Simple comment** → 1 atomic item.
2. **Compound English** ("provide A AND B AND C" / numbered list / multiple distinct sentences with distinct requirements) → split into N items.
3. **Vague code ref** ("comply with DCM 1.2.4.E" with no body text) → **read the code section from bureau** and emit 1 item per sub-requirement found. See §6 for bureau lookup details.

Each emitted item gets:

- `id`: `{DEPT}-{commentNumber}` for parents with a single atomic item (most common case — matches the MCR's own ID form). `{DEPT}-{commentNumber}.{subIndex}` (subIndex = `1..N`) when the parent decomposed into multiple items. The decomposition prompt always emits `.{subIndex}` (uniform contract); Phase 8 strips the `.1` from any parent whose final item count is exactly 1.
- `parentComment`: `{DEPT} {commentNumber}`
- `requirement`: the verification statement (one sentence)
- `codeCitation`: copied from the parent comment; if Phase 6.3 decomposed via a code section, sub-citations are appended where available
- `severity`: inherited from parent
- `evidenceExpected`: short hint at where in the plan set this should appear (sheet type)
- `sourcePage`: from parent (for traceability)

### Phase 6.5 — Enrichment (per department)

After atomic items are produced for a department, the skill enriches the guide with regulatory context drawn from bureau and LLM-composed framing sections. This is what gives crc-guides depth comparable to completeness-check guides — but scoped narrowly to what the MCR comments actually cite, not the department's full remit.

**Inputs (per dept):**
- All atomic items for the dept (from Phase 6)
- All unique code citations across those items
- MCR header info (project name, SP number, MCR date)

**Steps** (run per dept, parallel where possible):

1. **Citation collection.** Build `unique_citations: Set[(code, section)]` from the dept's items.
2. **Bureau lookup (parallel per citation).** For each citation, resolve to `$NOETIC_WORKING_DIR/bureau/jurisdictions/austin/codes/{dir}/` and read the section. Reuses the path-resolution logic from §6. Section text is cached so Phase 6.3 decomposition and Phase 6.5 enrichment don't double-fetch.
3. **LLM sub-prompts (5 calls per dept, sharing the loaded section text):**
   - `description` — 2–3 sentences naming the themes covered.
   - `regulatory-overview` — ~2 paragraphs synthesizing the cited code sections.
   - `key-terms` — regulatory + project-specific terms with one-sentence definitions and citations. Target ~8, no hard cap.
   - `documents-to-review` — short list of plan sheet types implied by the items.
   - `validation-methodology` — 3–5 cross-references / nuances / resolution criteria; default sentence if nothing high-signal emerges.
4. **Persist drafts.** Write each section to `scratch/enrichment/{dept}/{description,key-terms,reg-overview,docs,methodology}.md` so Phase 8 assembly is concatenation and any individual section can be regenerated without re-running everything.

**Calibration (iteration 1):**
- Run for every dept regardless of item count — single-item depts still get framing, just minimal.
- Bureau backfill is best-effort. If a citation can't be located, include the parent section with a "(parent section — specific sub-section not located)" note.
- If validation-methodology comes back empty / low-signal, write the default: "Each item is verified directly against the U1 plan set per its requirement statement; no cross-item dependencies identified at guide generation time."

### Phase 7 — HITL review batch

If anything landed in the HITL bucket during Phases 2–5, present them all as a single batched review to the user (see §4 for mechanism). For each item the user picks: `include` (and supplies missing data if needed) or `drop` (with optional reason). Decisions are appended to `decisions.md` (§7).

### Phase 8 — Emit guide files + ignored-comments report

1. **ID normalization.** For every parent comment with exactly one surviving atomic item, strip the `.1` suffix from that item's `id`. Parents with ≥2 items keep their `.{subIndex}` form. This runs after Phase 7 HITL decisions so a parent that dropped from 2 → 1 items via HITL also renormalizes.
2. Group items by department. For each department with ≥1 item, write its guide file(s) (see §5 for format).
3. **Per-file size cap.** If a dept has >20 atomic items, split into `crc-{dept}-1.md`, `crc-{dept}-2.md`, … on a parent-comment boundary (never split a single parent's decomposed items across files). Departments at or below the cap keep the canonical `crc-{dept}.md` name. Per-part body content: title + all enrichment sections are duplicated verbatim across parts; checklist table + figures are scoped to the items in each part. Downstream stitching in `bureau/workflows/comment-resolution-check/` strips the trailing `-{N}` to merge split parts into one department section in the final review report.
4. Write `ignored-comments.md` (see §5.3).
5. Write `decisions.md` (HITL prompts + answers, for re-gen replay).
6. Write `manifest.json` summarizing the run (counts, inputs, timestamps stamped at execution time, NOT inferred). Dept counts sum across split parts; the file split is **not** surfaced in the manifest.

### Phase 9 — Validation gate

Reconcile:

```
total_parsed == total_emitted_items_collapsed_to_parents
              + dropped_status + dropped_severity + dropped_not_verifiable
              + hitl_dropped
```

("collapsed to parents" because decomposition can multiply rows). If math doesn't add up, write a `VALIDATION-FAILED.md` and surface to the user — don't silently continue.

### Phase 10 — Supabase upload

Mirror the local generation directory — including the copied `mcr.pdf`, all `crc-*.md` files, `ignored-comments.md`, `decisions.md`, `manifest.json`, and the `figures/` subtree — to the `crc-guides` storage bucket at the same relative path. The `scratch/` subtree is local-only (not uploaded). Implementation: `mcp__claude_ai_Supabase__storage_upload` (or whichever upload primitive is available).

---

## 4. HITL touchpoint (single batched prompt)

After Phases 2–5, the skill presents one consolidated review via `AskUserQuestion`. The prompt summarizes:

- Unknown department prefixes
- Unknown statuses
- "Uncertain" plan-verifiability comments

For long lists, batch into chunks of ≤10 per question. Decisions are written to `decisions.md` as they're collected. The user sees a count summary first ("3 unknown prefixes, 7 unknown statuses, 12 plan-verifiability uncertains — 22 decisions to make").

---

## 5. Output artifacts

### 5.1 Directory layout

```
$NOETIC_WORKING_DIR/comment-resolution-check/   # default: ~/noetic/comment-resolution-check
  {projectUuid}/{submissionUuid}/{submissionVersionNumber}/
    {generation-number}/
      mcr.pdf                  # copied from user-supplied path at Phase 1; durable
      crc-sp.md                # dept ≤20 items
      crc-tpw.md
      crc-de-1.md              # dept >20 items splits across N parts
      crc-de-2.md
      ...
      ignored-comments.md
      decisions.md
      manifest.json
      figures/
        TPW-9/1.png
        TPW-12/1.png
        ...
      scratch/
        raw-comments.json
        mcr.txt
        pages/page-NN.png       # rasterized MCR pages (Phase 5.5)
        figures/                # working crops (promoted to ../figures/ in Phase 8)
        enrichment/{dept}/...
```

`generation-number` = `max(existing) + 1`, starting at `0`.

### 5.2 Per-department guide format

Structure draws from both formal review guides (`bureau/.../review-guides/wwp/*.md`) and completeness-check guides (`completion-officer/.../checklists/cc-*.md`). Sections sourced as follows:

| Section | Source |
|---|---|
| Title | Hand-templated |
| Description | Phase 6.5 LLM |
| Source | Hand-templated from MCR metadata |
| Regulatory Overview | Phase 6.5 bureau backfill + LLM synthesis |
| Key Terms | Phase 6.5 bureau backfill + LLM (target ~8, not capped) |
| Documents to Review | Phase 6.5 LLM |
| Validation Methodology | Phase 6.5 LLM (default sentence if no patterns) |
| Checklist Items | Phase 6 atomic items |
| Figures | Phase 5.5 (Haiku detect + bound, Sonnet describe + classify) |

```markdown
# CRC — {DEPT_FULL_NAME} ({DEPT_PREFIX}) — {project name} v{version_number}

## Description
Verifies resolution of {N} {DEPT} comments raised in the U0 MCR for
{project}. Items cover [LLM-detected themes].

## Source
MCR: {mcr filename}. Items map 1:1 to atomic MCR issues.

## Regulatory Overview
[Phase 6.5 LLM synthesis of cited code sections. ~2 paragraphs scoped to
what the comments actually cite — NOT the dept's full regulatory remit.]

## Key Terms
- **{Term}** — definition (≤1 sentence). Citation: {code ref}.
- ... (~8 terms, no hard cap)

## Documents to Review
- Site plan / ROW dedication exhibit
- Striping and signing plan
- ...

## Validation Methodology
- {Resolution criterion / cross-reference / nuance — 3–5 bullets, or a
  single default sentence if no high-signal patterns are identified.}

## Checklist Items
| ID | Parent Comment | Requirement to verify resolved | Code Citation | Severity | Evidence expected |
|----|---------------|-------------------------------|---------------|----------|-------------------|
| TPW-6 | TPW 6 | On-street parking dimensioned ≥15 ft from either side of fire hydrants | TCM 9.2.3.1.B | required | Site plan / striping sheet |
| TPW-12.1 | TPW 12 | 7' tree and furniture zone provided, measured from back of curb | TCM 2.8.2.2 | required | Streetscape plan / cross-section |
| TPW-12.2 | TPW 12 | 5' minimum clear zone (sidewalk) provided | TCM 2.8.2.2 | required | Streetscape plan / cross-section |

## Figures

- **TPW 9** — TCM Fig. 9-2, Standard parking bulb-out *(reference-design)*

  ![Plan view of parking bulb-out with labeled minimum dimensions](figures/TPW-9/1.png)

  Plan view of a parking bulb-out showing minimum dimensions: 30' end space,
  22' interior space, 18' min from lane edge, 7–8' stall width, 10–11' lane
  width. Fire hydrant marked at curb. Bicycle path adjacent.

  Constraints: min 30' end space; min 15' from hydrant; min 7–8' stall width.
```

#### Splitting large guides

Empirically, CRC review agents hit context compaction on guides with >20 atomic items, degrading verdict quality. To bound the per-agent workload, departments above the cap split across multiple files.

**Rules:**

- **Hard cap:** 20 atomic items per guide file.
- **Split unit:** atomic items, but a parent comment's decomposed atomic items (e.g. `TPW-12.1`, `TPW-12.2`, `TPW-12.3`) stay together. The split lands on a parent boundary, so a single part can hold 18–22 items depending on where the nearest boundary falls.
- **Naming:** only triggered departments split. `crc-{dept}.md` (≤20) vs. `crc-{dept}-1.md` / `crc-{dept}-2.md` / … (>20). A single MCR may produce a mix of both forms.
- **Order:** items keep MCR order (ascending parent number, then ascending subIndex); the first part holds the lowest-numbered parents.

**Per-part body content:**

| Section | Behavior |
|---|---|
| H1 title | Identical across all parts (no "Part X of Y" — agent shouldn't need to know it's a part) |
| Description / Source / Regulatory Overview / Key Terms / Documents to Review / Validation Methodology | Duplicated verbatim across all parts (every part is self-contained for the agent) |
| Checklist Items table | Scoped to this part's items |
| Figures | Scoped to figures whose parent comment is in this part's items. Figure PNGs in `figures/` are shared on disk and uploaded once. |

**Downstream stitching.** The CRC workflow (`bureau/workflows/comment-resolution-check/`) strips a trailing `-{digits}` from each guide-file basename to derive the dept-level grouping ID (`crc-de-1` → `crc-de`) and merges findings from all parts into a single department section in the final review report. The split is invisible in `review-comments.json` and downstream UI.

### 5.3 `ignored-comments.md`

Top-of-file summary:

```
Total parsed: 187
Emitted items (atomic): 142
Parent comments emitted: 121
Dropped — status: 31
Dropped — severity (note): 6
Dropped — not plan-verifiable: 18
HITL-dropped: 11
```

Then the table:

| Comment ID | Dept | Original status | Severity | Reason | Sub-reason | Excerpt |
|------------|------|-----------------|----------|--------|------------|---------|
| PR 10 | PR | FYI | — | status | — | "FYI – the parkland fee was assessed at…" |
| SP 23 | SP | Pending | required | not-plan-verifiable | pay-fee | "Pay the Service Improvement Fee prior to…" |

---

## 6. Bureau access (Phase 6.3 decomposition + Phase 6.5 enrichment)

Both phases use the same path resolution. Section text loaded once is cached and reused across consumers.

**Citation prefix → code dir mapping** (shipped with the skill in `references/code-dir-map.tsv`):

```
LDC     code-of-ordinances
DCM     dcm
UCM     ucm
TCM     tcm
ECM     ecm
FPCM    fpcm
SSM     ssm
```

**Lookup strategy** (given a `(code_prefix, section_id)` pair):

1. Map the prefix to its bureau dir under `$NOETIC_WORKING_DIR/bureau/jurisdictions/austin/codes/{dir}/`.
2. Read the code's `README.md` for the citation convention (DCM and others document their own — see `dcm/README.md`).
3. Walk `contents/Section N - Name/` folders to find the cited section. For DCM `1.2.4.E` → `Section 1 - Drainage Policy/.../1.2.4.E.md` (or whatever the naming convention turns out to be — discover at runtime via the README and a directory listing).
4. Return the section text.

**Phase 6.3 consumer.** When an MCR comment is *just* a citation, an LLM pass identifies sub-requirements in the section text (numbered/lettered enumeration, "shall" clauses) and emits one atomic item per sub-requirement.

**Phase 6.5 consumer.** Section text feeds Regulatory Overview synthesis and Key Terms extraction; multiple sections per dept are loaded and passed to the LLM as combined context.

**Graceful failure.**
- Phase 6.3 → emit 1 row with the original citation, log in `decisions.md`. Don't block the run.
- Phase 6.5 → include the parent section text with a "(parent section — specific sub-section not located)" note in Regulatory Overview; if even the parent is missing, fall back to "[Code section {citation} could not be located in bureau — see comment body for context.]" and log it.

`$NOETIC_WORKING_DIR` is the conceptual noetic root (see §2.4); defaults to `~/noetic/`. Validated in Phase 0; not a real env var.

---

## 7. Re-gen behavior

When the skill detects a prior generation directory for the same `{projectUuid}/{submissionUuid}/{submissionVersionNumber}`:

1. Read the latest prior `decisions.md`.
2. **AskUserQuestion:** "Prior generation found at `…/0/`. Use its decisions as defaults?" → `Reuse` / `Start fresh`.
3. If `Reuse`: any HITL question whose key matches a prior decision is auto-resolved using the prior answer; only new uncertainties prompt.
4. New generation always writes to a new `{generation-number}` dir — never overwrites.

**Decision key shape** so prior decisions can be matched: `(category, comment_id)` — e.g. `("status:unknown", "ZZ 7")`, `("verifiability:uncertain", "SP 23")`.

---

## 8. Skill file layout

```
generate-crc-guides/
  SKILL.md                              # Frontmatter + overview + pipeline at a glance
  pipeline.md                           # Phase-by-phase detail (this design doc, cleaned)
  references/
    working-dir.md                      # $NOETIC_WORKING_DIR conventions + Phase 0 validation
    dept-prefix-dict.tsv                # prefix → department name
    code-dir-map.tsv                    # citation prefix → bureau code dir
    status-filter.md                    # status vocab + filter rules
    severity-classification.md          # LLM prompt + rules
    plan-verifiability.md               # LLM prompt + rules
    figure-extraction.md                # Phase 5.5 pipeline (rasterize, detect, crop, describe)
    decomposition.md                    # decomposition rules + bureau lookup
    enrichment.md                       # Phase 6.5 sub-prompt sequencing + calibration
    output-format.md                    # guide file format + ignored-comments format
    hitl-flow.md                        # batched HITL prompt mechanics
    supabase-lookup.md                  # SQL ladder + queries
  prompts/
    extract-comments.md                 # PDF text → structured comments
    classify-severity.md                # severity inference prompt
    judge-plan-verifiability.md         # yes/no/uncertain prompt
    detect-and-bound-figures.md         # Phase 5.5: Haiku per-page detection + bbox
    describe-figure.md                  # Phase 5.5: Sonnet per-figure type + description
    decompose-comment.md                # compound English split prompt
    decompose-code-section.md           # vague code ref → sub-reqs prompt
    enrich-description.md               # Phase 6.5: dept-level description
    enrich-regulatory-overview.md       # Phase 6.5: synthesize cited sections
    enrich-key-terms.md                 # Phase 6.5: term extraction
    enrich-documents-to-review.md       # Phase 6.5: plan sheet inference
    enrich-validation-methodology.md    # Phase 6.5: cross-refs / nuances
```

`SKILL.md` itself stays under ~200 lines; deep detail lives in `references/` and `prompts/` and is loaded by the skill at runtime as needed.

---

## 9. What's deferred (explicit non-goals for this skill)

- Multi-run / medly / majority vote → CRC workflow's job, not this skill.
- AW redlines / AE Bluebeam → v2.
- Pre-decomposition of compound code refs **with no English body**: in scope (§6.3). Pre-decomposition of compound code refs *that already have explanatory English*: out of scope — trust the English, ignore deeper code-section walks.
- Generating PDFs → `generate-crc-report` (a separate skill, iteration-1 W1 sibling).

---

## 10. Open items (small defaults, flag for redirect)

- **`generation-number` zero-padding** — `0/` vs `0000/`? Default: no padding, just integer.
- **Department slug for filenames** — lowercase prefix as-is (`crc-tpw.md`, `crc-awrr.md`)? Or slugified full name (`crc-transportation-public-works.md`)? Default: lowercase prefix — short and matches the ID convention.
- **`pdftotext` flags** — `-layout` to preserve column structure, OR `-raw` for cleaner text feed. Default: `-layout` for the MCR's two-column tendencies; revisit if it produces garbled headers.
