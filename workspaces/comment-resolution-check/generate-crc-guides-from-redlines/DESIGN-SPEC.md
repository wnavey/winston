# `generate-crc-guides-from-redlines` — Design Spec

> **Status:** Draft revised 2026-06-23 after a question-and-answer grill against the original 2026-06-22 draft. Companion to [`generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md). Drives implementation of a sibling Claude Code skill that turns a navalbase step-3 (or refined step-3) result for a single redline PDF into a per-department crc-guide file for the Comment Resolution Check workflow.
>
> Read [`../SPEC.md`](../SPEC.md) for the parent CRC architecture, [`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md) for the MCR-sourced sibling, and [`../crc-workflow/DESIGN-SPEC.md`](../crc-workflow/DESIGN-SPEC.md) for the Conductor workflow that consumes the emitted guide. This document only specifies what's *different* from the MCR-sourced sibling.

---

## 1. Overview

**Purpose.** A Claude Code skill that turns a navalbase step-3 (or refined step-3) result for a single redlined PDF into **a single consolidated per-department crc-guide markdown file** (e.g. `crc-aw-redlines.md`) for the Comment Resolution Check workflow. The file contains one row per actionable redline comment — the same format as the MCR-sourced sibling — plus a cropped image of each redline that the workflow's `crc-vision-check` tool can attach during verification.

**Why a separate skill from `generate-crc-guides`.** The MCR-sourced skill atomizes loosely-structured natural-language review comments out of a PDF text dump. This skill consumes a **structured** JSON contract produced by navalbase (`detailed-analysis-results.json`) — every redline comment is already atomic, already has a `bounding_box`, already has transcribed text and a `category`. The work is therefore different: crop images using known bboxes, derive sheet-class labels from the navalbase `category` field, opportunistically pull regulatory context from a sibling layer-2-enrichment file (when present), and emit a single dept-grouped file.

**Location.** `~/noetic/claude-plugins/plugins/noetic-tools/skills/generate-crc-guides-from-redlines/`

**Invocation.** `/generate-crc-guides-from-redlines` with:
- `--detailed-analysis-results-path <path>` (required) — path to a `detailed-analysis-results.json` from either `step-3-output/` (raw) or `step-3-output-refined/` (post-refine). The skill works with either.
- `--dept-code <code>` (required; prompted if missing) — short code used in the filename and row IDs. e.g. `aw`, `ae`.
- `--dept-label <label>` (required; prompted if missing) — full label used in the title block and the CRC workflow's `output_json.sections[i].label`. e.g. `Austin Water (Redlines)`.
- Submission-version resolution flags identical to the MCR sibling: `--project-id` / `--project-name` / `--submission-id` / `--submission-version-id` / `--submission-version-number`. Same lookup ladder.

**Out of scope.**
- MCR-sourced comments (their own skill).
- AE Bluebeam.
- Comments without a `bounding_box` — every emitted row requires an image crop; null-bbox entries are filtered with a logged reason.
- Cross-PDF batching in a single invocation — one invocation = one PDF. Multi-PDF support for the same dept happens via re-running and selecting `merge` in the versioning prompt (see §5).
- Refined-vs-raw input detection — the skill accepts either tree without validation. Refinement is the user's choice, not enforced here.
- Vision re-verification — dropped in v1; the navalbase refine skill is the upstream verification pass.

---

## 2. Inputs

### 2.1 Required

| Flag | Description |
|---|---|
| `--detailed-analysis-results-path` | Absolute path to a `detailed-analysis-results.json`. Sibling files (`source.pdf`, optional `enriched-analysis-results.json`) are auto-resolved per §2.4. |
| `--dept-code` | Short dept identifier (e.g. `aw`). Drives filename `crc-{dept-code}-redlines.md` and row IDs `{DEPT_CODE_UPPER}-RL-N`. Prompted if missing. Must be non-empty before progressing. |
| `--dept-label` | Full human label (e.g. `Austin Water (Redlines)`). Drives the title block and `output_json.sections[i].label` in the CRC workflow's DB writes. Prompted if missing. Must be non-empty before progressing. |
| Submission-version resolution | Either `--submission-version-id` directly, or `--project-name` + `--submission-version-number` via the lookup ladder. Same as the MCR sibling — see [`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md) §3.1. |

### 2.2 Optional

| Flag | Default | Description |
|---|---|---|
| `--enriched-analysis-results-path` | auto-resolved | Explicit override if the layer-2-enriched file is not next to the detailed file. |

### 2.3 Auto-resolved sibling files

Given `<detailed-analysis-results-path>` at:

```
.../analysis-results/<folder_rsn>/<file_name>/detailed-analysis-results.json
```

the skill resolves:

- **Source PDF**: `<same-dir>/source.pdf` — symlink written by navalbase step-3 (or the refine skill). Required. Missing → abort with: *"source.pdf symlink missing — run `navalbase step-3-analyze-pdfs` once on this PDF to recreate it, or pass `--source-pdf <path>` explicitly."* In Phase 9 the skill follows the symlink and uploads the resolved file.
- **Enriched layer-2 results (optional)**: `<same-dir>/enriched-analysis-results.json`. If present, used in Phase 4 for regulatory enrichment. If absent, the `## Regulatory Overview` and `## Key Terms` sections are omitted from the emitted guide.

### 2.4 Working directory

Same convention as `generate-crc-guides`: `$NOETIC_WORKING_DIR` (default `~/noetic`), validated by checking that `{root}/bureau/` exists. CRC output lands at `{root}/comment-resolution-check/...`. See [`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md) §2.4.

---

## 3. Pipeline

### Phase 0 — Pre-flight

1. **Vision-model check.** This skill performs best with Opus 4.7's native vision. If the current model is not Opus 4.7 (or later with native vision), surface a confirmation prompt: *"This skill is most effective with Opus 4.7's native vision. Current model: {model}. Vision quality may be reduced. Continue?"* If the user declines, abort. If yes, proceed. Do NOT hard-abort on a weaker model.
2. **Tool validation.** `pdftoppm` (poppler) and `magick` (ImageMagick 7+) must be on `$PATH`.
3. **JSON shape validation.** `detailed-analysis-results.json` parses and has the navalbase top-level keys (`folder_rsn`, `fileName`, `total_pages`, `page_results`). The skill accepts either raw step-3 or refined step-3 input — there is no validation that this is specifically a refined tree.
4. **Dept args.** Validate `--dept-code` and `--dept-label` are non-empty; prompt the user for any missing. Both must resolve to non-empty values before any further work runs.
5. **Submission-version resolution.** Same ladder as MCR sibling.
6. **source.pdf reachability.** Follow the symlink; confirm target exists and is a readable PDF.

### Phase 1 — Identify candidate items

Walk every `page_results[i].detailed_analysis.redline_comments[j]` and every `.graphical_edits[j]`. Build a flat list of candidates, each carrying the source navalbase fields plus a `source_kind` (`redline_comment` | `graphical_edit`) and the `(page_number, page_id)` it came from.

**Scope filter.** Drop with logged reason in `ignored-comments.md`:

- `reviewer_intent != "corrective"` → reason `informational`
- `bounding_box == null` → reason `no-bbox` (no crop possible)

There is **no category filter** and **no dept-mismatch filter**. The input PDF is presumed to belong to `--dept-code` in its entirety, regardless of which sheet type each individual redline appears on.

**Row IDs.** Assign sequential IDs to surviving candidates in input order (page ascending, then page_id ascending): `{DEPT_CODE_UPPER}-RL-{N}` where N is 1..N. e.g. `AW-RL-1`, `AW-RL-2`, …. In `merge` mode (§5.3) numbering continues from the highest existing row ID in the existing dept file.

### Phase 2 — Render per-item crops

For each surviving candidate, produce:

- `<gen-dir>/figures/{row_id}/1.png` — the comment's `bounding_box` rendered from the source PDF at 600 DPI with **15% padding** (same recipe as the refine skill's `references/vision-multipass.md`).

For composite-merged comments, the crop uses the top-level merged-envelope `bounding_box`, not per-component boxes (per-component crops are deferred — see §8).

Rendering details:

- `pdftoppm -r 600 -png -f N -l N source.pdf <scratch>/raw-p<N>.png` produces the raw page render at 600 DPI. Downscale crops only if their longest edge exceeds 4000 px.
- Crop math: pixel coordinates from normalized bbox, 15% padding on each side, clamped to image bounds. Output via `magick <raw>.png -crop {W}x{H}+{X}+{Y} +repage <out>.png`.

A 300-DPI full-page render is also produced (once per in-scope page, deduplicated) for use as scratch-only context during the Phase 3 vision pass. It is **not** persisted to `figures/` and **not** embedded in the emitted guide. The emitted guide carries one PNG per row (the crop) — matching the existing convention in `crc-tpw.md` / `crc-de.md`.

### Phase 3 — Vision pass per item

For each candidate, spawn one subagent (Opus 4.7 native vision when available) with both the crop and the 300-DPI page render attached via the Read tool, plus the structured item JSON in the prompt. The subagent performs **three tasks** — no verify step:

1. **Caption** — write a short alt-text (≤140 chars) and a 1–3 sentence figure description.
2. **Enrich the requirement** — refine the engineer-facing `requirement` sentence using any detail visible in the crop beyond what's already in `full_comment_inference`. Keep the requirement at the level of "what the engineer must do," not a literal prediction of what U1 must contain.
3. **Classify the figure** — `site-specific` / `reference-design` / `unclear`.

**Evidence expected is NOT produced here.** It's derived deterministically in Phase 5 from the navalbase `category` field.

Output schema per item:

```jsonc
{
  "row_id": "AW-RL-1",
  "caption": {
    "alt": "Red rectangle around existing 6\" water meter callout with reviewer text '5/8\" Water Meter # 63255523' in the adjacent margin",
    "body": "The reviewer has drawn a red rectangle around the existing plan callout naming a 6\" water meter and added a margin annotation correcting the meter size and supplying a specific meter number."
  },
  "requirement": "Update the existing water meter callout to reflect a 2\" meter, including the reviewer-supplied meter number, in place of the prior 6\" callout.",
  "figure_type": "site-specific"
}
```

#### 3.1 Parallelism

Cap at `min(11, candidate_count)`. Matches the refine skill.

#### 3.2 Field-naming watch-out

The subagent **must not** emit refinement-pipeline language ("Verified at 600 DPI…", "step-3 transcribed…", etc.) — same rule as PR #56 added to the refine skill. The skill's vision prompt copies the relevant section of the refine skill's "Reviewer-facing vs. refiner-audit fields" guidance into its own prompt.

#### 3.3 If verify is ever added back

For a future revision that re-introduces verification: only `verification.match: false` with `confidence: high` escalates to HITL. `confidence: low` or `medium` mismatches are auto-kept and flagged in `manifest.json`. (Recorded here so the policy is on record; v1 does not run verify.)

### Phase 4 — Opportunistic regulatory enrichment

If `enriched-analysis-results.json` exists, match each candidate to its layer-2 entry by `(page_number, page_id)` (or by `id` if preserved across the refinement pass). For each match, copy:

- `final_enriched_comment` → contributes to the body of `## Regulatory Overview` (combined into a single dept-level paragraph summarizing across enriched items).
- `code_citations[]` → the **Code Citation** column on this row, formatted as the citation string only (no section body).
- `key_terms[]` → `## Key Terms` bullets, deduped across items and ordered by frequency.

If `enriched-analysis-results.json` is **absent**: **omit the `## Regulatory Overview` and `## Key Terms` sections entirely** from the emitted guide. Do not fill with a reviewer-convention disclaimer — empty is cleaner than fake structure, and a disclaimer risks biasing the downstream verifier toward `failed`.

### Phase 5 — Derive Evidence-expected sheet-class labels

For each row, map navalbase `category` → a short sheet-class label following the convention in the existing `crc-tpw.md` / `crc-de.md` examples (single sheet-name string, not a sentence):

| navalbase `category` | `Evidence expected` |
|---|---|
| `water` | Water plan |
| `wastewater` | Wastewater plan |
| `demolition` | Demolition plan |
| `general_notes` | General notes / cover sheet |
| `title_sheet` | Cover sheet |
| `erosion` | Erosion control plan |
| `water_quality` | Water quality plan |
| `landscape` | Landscape plan |
| any other / unknown / null | Best-effort from `sheet_description` if present; else `(plan sheet)` |

The mapping table lives in `references/sheet-class-map.md` and is the only thing that needs updating when new categories appear in navalbase output.

### Phase 5b — Margin code-citation regex

For each row that did NOT get a code citation from Phase 4, regex-scan `transcribed_text` + `full_comment_inference` for code references the reviewer hand-wrote in the margins. Pattern (rough form, refined in `references/code-citation-regex.md`):

```
[A-Z]{2,4}\s+\d+(?:[-.]\d+)*(?:\([A-Z0-9]+\))?(?:\.[A-Z0-9]+)*
```

Matches like `UCM 2.7.4.B`, `DCM 1.2.2(D)`, `LDC 25-6-55` populate the **Code Citation** column with the matched literal string. Multiple matches per row join with `; `. No matches → column shows `—`. No bureau section-text lookup is performed; the citation alone is preserved.

### Phase 6 — HITL batch

A single consolidated `AskUserQuestion` pass surfacing:

1. **Versioning choice** if existing redlines content is detected for this dept in the highest gen (see §5).
2. **Cross-dept confirmation** if the highest gen contains redlines for a *different* dept and no file for this dept yet.

No HITL for category-mismatch (filter removed). No HITL for vision verification (step removed). No HITL for non-default dept (handled by required `--dept-*` args in Phase 0).

### Phase 7 — Emit the consolidated guide

Write **one** markdown file per dept per generation: `<gen-dir>/crc-{dept-code}-redlines.md`. Template in §4.2.

Also emit:

- `redlines-manifest.json` — sidecar tracking source PDFs and row-ID ranges per dept (§4.3).
- `ignored-comments.md` — log of dropped candidates (§4.4).
- `manifest.json` — standard skill manifest (§4.5).

### Phase 8 — Validation gate

Count reconciliation: `candidates_total == emitted_rows + dropped_no_bbox + dropped_informational + hitl_dropped`. Fail loudly with a per-stage tally if math is off.

Every emitted row must have a non-null `figures/{row_id}/1.png`. Fail with the list of missing files if any are missing.

### Phase 9 — Supabase upload

Mirror `<gen-dir>` (minus `scratch/`) to bucket `crc-guides` at the same relative path. Specifically:

- Follow the `source.pdf` symlink and upload the resolved PDF to `<gen-dir>/source-pdfs/{filename}` (always; no sha256-based skip-if-exists check in v1).
- Upload every PNG under `figures/`.
- Upload the markdown, `redlines-manifest.json`, `ignored-comments.md`, and `manifest.json`.

---

## 4. Output artifacts

### 4.1 Directory layout

```
$NOETIC_WORKING_DIR/comment-resolution-check/
  {projectUuid}/{submissionUuid}/{submissionVersionNumber}/{generation-number}/
    crc-{dept-code}-redlines.md         # single consolidated file per dept
    crc-{other-dept-code}-redlines.md   # if multiple depts have redlines this gen
    crc-aw.md                           # MCR-sourced files from sibling skill (may coexist)
    crc-tpw.md
    ...
    redlines-manifest.json              # per-dept source-PDF tracking
    ignored-comments.md
    manifest.json                       # this skill's manifest
    source-pdfs/
      <filename>.pdf                    # resolved-symlink copy of each source redline PDF
    figures/
      AW-RL-1/
        1.png
      AW-RL-2/
        1.png
      ...
    scratch/                            # local-only, not uploaded
```

`{generation-number}` is shared with the MCR-sourced sibling — both skills look at the same parent directory and the CRC workflow's `fetch-crc-guides` step consumes every `crc-*.md` file in the resolved generation as a glob. See §5 for the per-skill semantics (this skill never displaces MCR-sourced files in a gen).

### 4.2 Per-dept file template

```markdown
# CRC — {dept-label} — {project name} v{version_number}

## Description

Verifies resolution of {N} redline markups raised against the {project name} U0 plan set by {dept-label, "(Redlines)" stripped}. Each row in the checklist maps to a single redline comment or graphical edit extracted by navalbase from the source PDF.

## Source

Redline PDF: {source.pdf filename}. Items map 1:1 to navalbase-extracted redline comments and graphical edits.

<!-- The following two sections appear ONLY if enriched-analysis-results.json was present. -->

## Regulatory Overview

{Phase 4 final_enriched_comment, combined across items}

## Key Terms

- **{term}** — {definition}. Citation: {citation}.
- ...

<!-- End conditional sections. -->

## Documents to Review

- The redline source PDF itself ({filename})
- The U1 plan sheets corresponding to each row's "Evidence expected" column

## Validation Methodology

Cross-reference each row against the U1 plan sheet listed in its "Evidence expected" column. The Requirement column states the specific correction the reviewer marked in red ink; the figure under "Figures" shows the marked-up area on the source redline. To consider a row resolved, the U1 plan must show the requested correction on the indicated sheet.

## Checklist Items

| ID | Parent Comment | Requirement to verify resolved | Code Citation | Severity | Evidence expected |
|----|----------------|-------------------------------|---------------|----------|-------------------|
| AW-RL-1 | Page 9 item 2 | {Phase 3 requirement} | {Phase 4 or 5b citation, or —} | required | {Phase 5 sheet-class label} |
| AW-RL-2 | Page 9 item 3 | ... | ... | required | ... |
| ...    | ...          | ...                          | ...           | required | ...                   |

## Figures

- **AW-RL-1** — {Phase 3 caption.alt} *({Phase 3 figure_type})*

  ![{Phase 3 caption.alt}](figures/AW-RL-1/1.png)

  {Phase 3 caption.body}

- **AW-RL-2** — ...
```

Notes on the table:

- The `Parent Comment` column holds the navalbase source pointer (`Page N item M`) for traceability back to the source PDF. The CRC workflow's review agent reads this for context but does not treat it as a spec extension (per `crc-workflow/DESIGN-SPEC.md` §4.2).
- The `Severity` column is always `required` for v1. The upstream refine pass is responsible for filtering out non-actionable / lesser redlines, so everything that survives to this skill is treated as required.
- The heading `## Figures` (plural) matches the existing convention in `crc-tpw.md` / `crc-de.md`.

### 4.3 `redlines-manifest.json`

Sidecar tracking which source PDFs contributed to which row-ID ranges for each dept's file in this generation. Used by §5's `merge` logic to extend an existing dept file with rows from a second source PDF.

```jsonc
{
  "schema_version": "1.0.0",
  "generation_number": 3,
  "dept_files": {
    "crc-aw-redlines.md": {
      "dept_code": "aw",
      "dept_label": "Austin Water (Redlines)",
      "row_count": 12,
      "sources": [
        {
          "source_pdf_filename": "1700-aw-redlines-water.pdf",
          "source_pdf_sha256": "<sha256>",
          "detailed_analysis_results_path": "/Users/.../detailed-analysis-results.json",
          "navalbase_folder_rsn": "1700-s-lamar",
          "row_id_range": ["AW-RL-1", "AW-RL-8"],
          "emitted_at": "<ISO-8601>"
        },
        {
          "source_pdf_filename": "1700-aw-redlines-wastewater.pdf",
          "source_pdf_sha256": "<sha256>",
          "detailed_analysis_results_path": "/Users/.../detailed-analysis-results.json",
          "navalbase_folder_rsn": "1700-s-lamar",
          "row_id_range": ["AW-RL-9", "AW-RL-12"],
          "emitted_at": "<ISO-8601>"
        }
      ]
    }
  }
}
```

In a fresh `replace` or `bump version` run this file is overwritten / created. In `merge` mode a new `sources[]` entry is appended.

### 4.4 `ignored-comments.md`

Same shape as the MCR sibling's `ignored-comments.md`. Reason values for v1:

- `no-bbox` — Phase 1 (item had `bounding_box: null`).
- `informational` — Phase 1 (`reviewer_intent != "corrective"`).
- `hitl-dropped` — Phase 6 (rare; only when the user picks `cancel` mid-run).

### 4.5 `manifest.json`

```jsonc
{
  "skill_version": "1.0.0",
  "skill_name": "generate-crc-guides-from-redlines",
  "generation_number": 3,
  "executed_at": "<ISO-8601>",
  "dept_code": "aw",
  "dept_label": "Austin Water (Redlines)",
  "versioning_mode": "supplement",          // or "replace" | "bump" | "merge"
  "inputs": {
    "detailed_analysis_results_path": "/Users/.../detailed-analysis-results.json",
    "detailed_analysis_results_sha256": "<sha256>",
    "source_pdf_filename": "1700-aw-redlines-water.pdf",
    "source_pdf_sha256": "<sha256>",
    "enriched_analysis_results_path": "<path or null>",
    "project_id": "<uuid>",
    "project_name": "1700 South Lamar",
    "submission_id": "<uuid>",
    "submission_version_id": "<uuid>",
    "submission_version_number": 4
  },
  "counts": {
    "candidates_total": 14,
    "emitted_rows": 12,
    "dropped_no_bbox": 1,
    "dropped_informational": 1,
    "hitl_dropped": 0
  },
  "regulatory_enrichment": {
    "enriched_file_present": true,
    "rows_with_layer2_citation": 8,
    "rows_with_margin_regex_citation": 2,
    "rows_with_no_citation": 2
  },
  "supabase_upload": {
    "bucket": "crc-guides",
    "relative_path": "{projectUuid}/{submissionUuid}/{versionNumber}/{generation_number}/",
    "uploaded_at": "<ISO-8601>"
  }
}
```

---

## 5. Versioning behavior

The skill **never modifies a file in a prior generation directory**. Versioning decisions affect only the current run's target directory.

### 5.1 Resolution

1. Read `$NOETIC_WORKING_DIR/comment-resolution-check/{projectUuid}/{submissionUuid}/{submissionVersionNumber}/` and identify the highest existing generation number (or note that none exist).
2. Check whether a `crc-{this-dept-code}-redlines.md` exists in that highest generation.
3. Check whether any *other* `crc-{other-dept-code}-redlines.md` files exist in that highest generation.
4. Decide versioning mode based on the table in §5.2.

### 5.2 Versioning prompts

| Existing state in highest gen | Default behavior | HITL prompt |
|---|---|---|
| No prior generation exists | Create gen 0 and write into it | None — proceed |
| Highest gen has no `crc-*-redlines.md` for this dept (may have MCR-sourced files or other depts' redlines) | Supplement: write this dept's redlines file into the highest gen | None — proceed |
| Highest gen has `crc-{this-dept-code}-redlines.md` | Prompt | `replace` / `bump version` / `merge` / `cancel` |
| Highest gen has redlines only for a *different* dept (no file for this dept) | Confirm | "Existing redlines in highest gen belong to {other dept}. Continue writing redlines for {this dept}? `continue` / `cancel`" |

### 5.3 Mode semantics

- **replace** — Overwrite `crc-{this-dept-code}-redlines.md` in the highest gen. The `dept_files["crc-{code}-redlines.md"]` entry in `redlines-manifest.json` is replaced. Row IDs restart at 1. Figures for the prior row IDs are removed from `figures/`.
- **bump version** — Create a new generation directory (`{highest + 1}`). Copy forward every MCR-sourced `crc-*.md` and the other depts' `crc-*-redlines.md` (plus their `figures/` and `source-pdfs/`) from the previous gen so the new gen is self-contained for workflow consumption. Write this dept's redlines file fresh in the new gen. Row IDs start at 1.
- **merge** — Append new rows to the existing `crc-{this-dept-code}-redlines.md` in the highest gen. Row IDs continue from the last one used (existing ends at `AW-RL-8` → new rows start at `AW-RL-9`). A new `sources[]` entry is appended to `redlines-manifest.json`. No content dedup — if two PDFs cover overlapping redlines, both are kept; the verifier handles any duplication downstream.
- **cancel** — Abort the run; emit no files.

---

## 6. Bureau access

This skill does **not** perform its own bureau code-section lookups. Code citations come from one of two sources, in priority order:

1. **Layer-2 enrichment** (if `enriched-analysis-results.json` is present) — the `code_citations[]` array is consumed verbatim.
2. **Margin-regex extraction** (Phase 5b, always run for rows without layer-2 citations) — literal code-reference strings the reviewer hand-wrote on the redlines are extracted from `transcribed_text` and `full_comment_inference`.

Rows with no citation from either source show `—` in the Code Citation column. No section-text bodies are fetched from bureau — the citation string alone is sufficient signal for the verifier.

---

## 7. Skill file layout

```
~/noetic/claude-plugins/plugins/noetic-tools/skills/generate-crc-guides-from-redlines/
├── SKILL.md
├── pipeline.md
├── prompts/
│   └── caption-enrich-classify.md      # the single per-item vision prompt
└── references/
    ├── crop-recipe.md                  # cropping math + pdftoppm / magick invocations
    ├── output-format.md                # per-dept file + ignored-comments + manifests
    ├── sheet-class-map.md              # navalbase category → "Evidence expected" label
    ├── code-citation-regex.md          # the Phase 5b regex pattern and examples
    ├── versioning.md                   # the §5 versioning prompts and mode semantics
    └── opportunistic-enrichment.md     # Phase 4 matching rules
```

`working-dir.md`, `hitl-flow.md`, `supabase-lookup.md`, and a shared department dictionary are concepts the MCR sibling already owns — these references either link out to the sibling's `references/` or live under a `_shared/` dir at the plugin root (decision deferred to implementation).

---

## 8. Deferred / non-goals (v1)

- **Per-component crops on composite-merged comments.** v1 uses the merged-envelope `bounding_box`. v2 could emit one figure per `annotation_component` and group them under a single row.
- **Cross-PDF batching in one invocation.** One invocation = one PDF. Multi-PDF for the same dept happens via re-running and selecting `merge`. v2 could accept `--folder-rsn` to iterate every PDF under one navalbase run.
- **Vision re-verification.** Dropped from v1 — the refine skill is the upstream verification pass. If added back, only `confidence: high` false-matches escalate to HITL (§3.3).
- **Bureau section-text fetching.** Even when citations are present, this skill does not pull section bodies from bureau. The citation string is preserved as-is.
- **Eval / accuracy harness for redlines CRC.** No eval path in v1. The MCR-sourced sibling has a labelled later-cycle ground truth path; redlines do not, and we ship without one for now.
- **Auto-merge dedup.** When two PDFs covering the same dept produce overlapping rows in `merge` mode, both rows are kept. No content-similarity dedup.
- **Refined-vs-raw input detection.** The skill accepts either tree. Refinement is up to the user. The skill does not warn or flag when run against unrefined input.
- **Source-PDF dedup on upload.** Always re-uploads `source.pdf` even if a matching sha256 is already in the bucket.

---

## 9. Relationship to the navalbase refine skill

This skill is the natural downstream consumer of `navalbase-refine-step-3-output`, but the refine step is **optional**. Recommended workflow:

1. `navalbase step-3-analyze-pdfs` (one-time per PDF) → `step-3-output/.../detailed-analysis-results.json`.
2. *(Optional)* `noetic-tools:navalbase-refine-step-3-output` against that → `step-3-output-refined/.../detailed-analysis-results.json` (cleaner, composites merged, process noise removed).
3. *(Optional)* `navalbase layer-2-enrich --step-3-dir step-3-output[-refined]` → produces `enriched-analysis-results.json` alongside, populating real regulatory citations.
4. Invoke `noetic-tools:generate-crc-guides-from-redlines` with `--detailed-analysis-results-path` pointing at either the raw or refined tree. The skill auto-detects and uses `enriched-analysis-results.json` if present.

Running on the unrefined step-3 tree is supported. The user accepts the risk that process-noise items (sheet-index signposts, rejection stamps, "Apply comments to ALL sheets" boilerplate) may surface as rows in the emitted guide. Refining first is recommended but not enforced.
