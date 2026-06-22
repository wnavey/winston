# `generate-crc-guides-from-redlines` — Design Spec

> **Status:** Draft, 2026-06-22. Companion to [`generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md). Drives implementation of a sibling Claude Code skill that turns a navalbase **redline-derived JSON + source PDF** into per-comment crc-guide files for the Comment Resolution Check workflow.
>
> Read [`../SPEC.md`](../SPEC.md) for the parent CRC architecture and [`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md) for the MCR-sourced sibling. This document only specifies what's *different* in detail and only references the existing spec where shape is identical.

---

## 1. Overview

**Purpose.** A Claude Code skill that turns a navalbase step-3 (or refined step-3) result for a redlined PDF into per-item crc-guide markdown files for the **Austin Water (Redlines)** department — checklist item + opportunistic regulatory overview + key terms + validation methodology + a vision-verified, vision-described, vision-classified figure cropped from the source PDF. Output is ready for the CRC Conductor workflow to verify against an updated plan set.

**Why a separate skill from `generate-crc-guides`.** The MCR-sourced skill atomizes loosely-structured natural-language review comments out of a PDF text dump and routes them across many departments. This skill consumes a **structured** JSON contract produced by navalbase (`detailed-analysis-results.json`) — every redline comment is already atomic, already has a `bounding_box`, already has `transcribed_text` and `referenced_element` and `full_comment_inference` and `category`. The work this skill does is therefore **different**: it crops images using known bboxes, opportunistically pulls regulatory context from a sibling layer-2 enrichment file, and emits one markdown file per redline comment (not one per department).

**Location.** `~/noetic/claude-plugins/plugins/noetic-tools/skills/generate-crc-guides-from-redlines/`

**Invocation.** `/generate-crc-guides-from-redlines` with:
- Path to a `detailed-analysis-results.json` (required) — typically from `step-3-output-refined/analysis-results/<folder_rsn>/<file_name>/` after running the refine skill, but a raw `step-3-output/` path is also accepted.
- Department name (optional; defaults to **"Austin Water (Redlines)"**) — used for the file-naming variant suffix and the title block. Anything other than the default is treated as future work and prompts an HITL confirmation before proceeding.
- Mode (optional; `--mode net-new` (default) or `--mode supplement`).
- Project / submission resolution flags identical to the MCR-sourced skill: `--project-id` / `--project-name` / `--submission-id` / `--submission-version-id` / `--submission-version-number`. Same lookup ladder.

**Out of scope.**
- MCR-sourced comments (those have their own skill).
- AE Bluebeam.
- Comments without a `bounding_box` — every emitted item requires an image crop, so null-bbox entries are filtered with a logged reason. (Composite-merged comments use their top-level merged-envelope bbox; per-component crops are a v2 deferral, see §10.)
- Cross-PDF batching — one invocation = one PDF (one `detailed-analysis-results.json`).

---

## 2. Inputs

### 2.1 Required

- **`--detailed-analysis-results-path <path>`** — absolute path to a `detailed-analysis-results.json`. The skill reads this file and resolves several siblings automatically (see §2.4).
- **A resolved `submission_version` row** — supplied via `--submission-version-id` or resolved via the same Supabase lookup ladder as `generate-crc-guides` (project name → submission → version_number). See [`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md) §3.1.

### 2.2 Optional

- **`--dept <name>`** — default **`"Austin Water (Redlines)"`**. Drives the file-naming variant suffix (e.g. `crc-aw-redlines.md`) and the title block. Other values land in HITL confirmation; this skill is built around AW Redlines and other variants need an explicit decision.
- **`--mode <net-new|supplement>`** — default `net-new`. See §7.
- **`--enriched-analysis-results-path <path>`** — explicit override if you want to point at a layer-2-enriched file that isn't sitting next to the detailed file. By default the skill auto-detects (see §2.4).
- Standard Supabase-lookup short-circuits per the sibling spec.

### 2.3 Interactive prompts (when not given as CLI args)

Same project-name + submission-version-number prompts as the MCR-sourced skill. No new HITL prompts at input time.

### 2.4 Auto-resolved sibling files

Given `<detailed-analysis-results-path>` at:

```
.../analysis-results/<folder_rsn>/<file_name>/detailed-analysis-results.json
```

the skill resolves these by convention:

- **Source PDF**: `<same-dir>/source.pdf` — a symlink written by navalbase step-3 (or by the refine skill). Required. If missing, abort with: *"source.pdf symlink missing — run `navalbase step-3-analyze-pdfs` once on this PDF to recreate it, or pass `--source-pdf <path>` explicitly."*
- **Enriched layer-2 results (optional)**: `<same-dir>/enriched-analysis-results.json`. If present, use per §6 for regulatory enrichment. If absent, fall back to the structured fields already in `detailed-analysis-results.json` and label items as `reviewer-convention` for the regulatory column.
- **Proposed refinements** (if input is a refined tree): `<same-dir>/proposed-refinements.json` — read-only, used only to stamp provenance into manifest.json (records whether the input is a refined tree and which generation of refinement it is).

### 2.5 Working directory

Same convention as `generate-crc-guides`: `$NOETIC_WORKING_DIR` (defaults to `~/noetic`), validated by checking that `{root}/bureau/` exists. CRC output lands at `{root}/comment-resolution-check/...`. See [`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md) §2.4.

---

## 3. Pipeline

### Phase 0 — Pre-flight + resolve submission_version

Identical to the MCR-sourced skill's Phase 0 plus three additional checks:

1. **Tool validation**: `pdftoppm` (poppler) and `magick` (ImageMagick 7+) must be on `$PATH`. Vision is via the model's native Read tool (Opus 4.7), not Gemini or any external endpoint — no API key needed beyond what the runtime already has. If the model isn't Opus 4.7 (or later with native vision), abort with: *"This skill requires a model with native vision; current model lacks Read-tool image support."*
2. **JSON shape validation**: `detailed-analysis-results.json` parses; top-level has `folder_rsn`, `fileName`, `total_pages`, `page_results`. Each `page_results` entry that has `detailed_analysis` non-null parses against the navalbase contract documented in `claude-plugins/plugins/noetic-tools/skills/navalbase-refine-step-3-output/references/layer-2-contract.md`.
3. **source.pdf reachability**: follow the symlink; confirm the target exists and is a readable PDF.

### Phase 1 — Identify candidate items

Walk every `page_results[i].detailed_analysis.redline_comments[j]` and every `.graphical_edits[j]`. Build a flat list of candidate items, each carrying:

```jsonc
{
  "source_kind": "redline_comment" | "graphical_edit",
  "page_number": 9,
  "page_id": 2,                 // 1-indexed positional id within the page array (matches refine-skill convention)
  "stable_key": "p9-c2-<sha8>", // see §3.1
  "transcribed_text": "...",
  "reviewer_intent": "corrective" | "informational",
  "category": "water",
  "bounding_box": { ... } | null,
  "annotation_components": [ ... ] | [],
  "full_comment_inference": "...",
  "referenced_element": "...",
  "primary_annotation_type": "enclosure",
  // for graphical_edits:
  "edit_type": "callout_flag",
  "original_element_description": "...",
  "proposed_change_description": "..."
}
```

#### 3.1 Stable key derivation

`stable_key = "p{page_number}-c{page_id}-{sha8}"` where `sha8` is the first 8 hex chars of `sha256(transcribed_text || full_comment_inference || normalize(bounding_box))`. The page+id prefix is for human readability; the sha8 suffix is what `supplement` mode uses to dedupe (a re-run with reshuffled positional IDs still matches by content hash).

`normalize(bounding_box)` rounds to 4 decimal places to absorb floating-point noise across refinement passes.

#### 3.2 Scope filter

Drop with logged reason in `ignored-comments.md`:

- `reviewer_intent != "corrective"` → reason `informational` (rare in refined output, but possible in raw step-3).
- `bounding_box == null` → reason `no-bbox`. Composite-merged comments DO have a top-level `bounding_box` (the envelope), so they pass.
- `category` not in {`water`, `wastewater`} when `--dept` is the default `"Austin Water (Redlines)"` → reason `dept-mismatch`. The default dept owns water + wastewater categories; demolition/erosion/etc. on a redline PDF still surface there but get logged for a HITL include/drop choice in Phase 7. (Practically: most AW-Redlines PDFs only touch water + wastewater + demolition. The skill's first-class scope is water-family items; demolition is the most common HITL.)

### Phase 2 — Render per-item images

For each surviving candidate, produce:

1. **Crop image** — `<gen-dir>/figures/<stable_key>/crop.png` — the comment's `bounding_box` rendered from the source PDF at 600 DPI with **15% padding** (same recipe as the refine skill's `references/vision-multipass.md`). On composite-merged comments, the crop uses the top-level merged envelope `bounding_box`, not per-component boxes (per §10 deferral).
2. **Full-page render** — `<gen-dir>/figures/<stable_key>/page.png` — the whole page rendered at 300 DPI for spatial context. Shared across items on the same page (de-duplicated; only render once per page).

#### 3.2.1 Rendering details

- `pdftoppm -r 600 -png -f N -l N source.pdf <scratch>/raw-p<N>.png` produces the raw page render. Page renders are gigantic (~20kx14k for an arch D sheet at 600 DPI), so the **600-DPI render is used only as the source for cropping** and never attached to vision directly. Downscale crops only if their longest edge exceeds 4000 px (rare, but possible on full-sheet annotations).
- For the spatial-context page render: resize the 300-DPI raw page to `3600x` (longest edge) via `magick … -resize 3600x` — matches the refine skill's vision recipe.
- Crop math: pixel coordinates from normalized bbox, 15% padding on each side, clamped to image bounds. Output via `magick <raw>.png -crop {W}x{H}+{X}+{Y} +repage <out>.png`.

#### 3.2.2 Parallelism

Per-item: trivially parallel. Per-page page-render: must run once and be reused, so the orchestrator deduplicates by page_number before fanning out.

### Phase 3 — Vision pass per item

For each candidate, spawn one subagent (native Opus 4.7 vision) with both the crop and the full-page render attached via the Read tool, plus the structured item JSON in the prompt. The subagent performs **four tasks** in a single call:

1. **Verify** — confirm the cropped image shows the red ink + reviewer text described in `transcribed_text` / `full_comment_inference`. Emit `verification: { match: true|false, confidence: high|medium|low, notes: "..." }`. A `false` doesn't drop the item — it stamps a flag in `manifest.json` so the HITL pass surfaces it.
2. **Caption** — write a short alt-text (≤140 chars) and a longer figure description (1-3 sentences) describing what's visible. The longer description is the figure's body text in the emitted markdown.
3. **Enrich** — read the crop AND the surrounding context in the full-page render, then refine:
   - The `requirement` (the engineer-facing "what to verify" sentence) using any detail visible in the image beyond what's already in `full_comment_inference` (e.g., adjacent callouts that constrain the fix, neighboring sheet features).
   - The `evidence_expected` column (what the reviewer would need to see on the resubmitted plan to consider this resolved).
4. **Classify** — tag the figure as `site-specific` (the mark is on a specific drawing element, not transferable to other PDFs), `reference-design` (the mark references a standard detail or a typical pattern), or `unclear` (cannot determine from the crop alone).

The subagent emits a single JSON object:

```jsonc
{
  "stable_key": "p9-c2-abc12345",
  "verification": { "match": true, "confidence": "high", "notes": "..." },
  "caption": {
    "alt": "Red rectangle around existing 6\" water meter callout with reviewer text '5/8\" Water Meter # 63255523' in adjacent margin",
    "body": "The reviewer has drawn a red rectangle around the existing plan callout naming a 6\" water meter and added a margin annotation correcting the meter size and supplying a specific meter number. The composite reads as a one-step correction to the existing callout."
  },
  "enrich": {
    "requirement": "Update the existing water meter callout to reflect a 2\" meter, meter # 63255523, replacing the prior 6\" with #UNK.",
    "evidence_expected": "Resubmitted plan callout for this meter on the same demolition sheet reads '2\" Water Meter # 63255523' (or equivalent). Sheet symbol, layer, and bubble formatting consistent with adjacent meter callouts."
  },
  "figure_type": "site-specific"
}
```

#### 3.3.1 Parallelism

Cap at `min(11, candidate_count)`. The refine skill uses the same cap.

#### 3.3.2 Field naming watch-out

When emitting any field that flows into `enrich` or `caption`, the subagent **must not** include refinement-pipeline language ("Verified at 600 DPI…", "step-3 transcribed…", etc.) — the same rule that PR #56 added to the refine skill applies here. The skill's per-page vision prompt copies the relevant §"Reviewer-facing vs. refiner-audit fields" section into its own prompt verbatim.

### Phase 4 — Opportunistic regulatory enrichment

If `enriched-analysis-results.json` exists (per §2.4), pull per-item regulatory context. Iterate `page_results[]` → match each item to its corresponding entry by `(page_number, page_id)` (or by `stable_key` if the layer-2 output preserves it). For each match, copy:

- `final_enriched_comment` — used as the body of the **Regulatory Overview** section in the emitted markdown.
- `code_citations[]` — used to populate the **Code Citation** column on the checklist row. Each citation is `{citation: "UCM 2.7.4.B", section_text: "..."}`.
- `key_terms[]` — used to populate the **Key Terms** section.

If no `enriched-analysis-results.json` is present (or a specific item is not present in it):

- **Regulatory Overview** = the item's `full_comment_inference` as a single paragraph, plus the literal sentence: *"This item reflects reviewer convention rather than a specific cited code requirement. The resubmission must match the reviewer's intended correction; no formal code section is being asserted."*
- **Code Citation** column = `(reviewer convention)`.
- **Key Terms** = a short bulleted list of terms parsed from `transcribed_text` + `referenced_element` (e.g., for a meter-correction comment: "water meter", "meter number", "existing callout"). Best-effort; quality is not gated on this section when running without enrichment.

Manifest records which items had layer-2 enrichment available vs. which used the reviewer-convention fallback.

### Phase 5 — HITL review batch

A single consolidated `AskUserQuestion` pass at this phase, surfacing:

- Any candidate where Phase 3 verification returned `match: false` — user picks `keep` (emit as-is, flag in manifest) / `keep-with-edit` (drop into a follow-up edit subagent) / `drop` (skip emission, log to ignored-comments).
- Any candidate dropped in Phase 1 §3.2 with reason `dept-mismatch` — user picks `include` (force-emit anyway) / `drop` (final).
- Any candidate where the auto-resolved `--dept` is something other than the default — user confirms the intended dept once before all items emit under it.

Same batching semantics as the MCR-sourced skill's Phase 7. See [`../generate-crc-guides/references/hitl-flow.md`](../generate-crc-guides/references/hitl-flow.md) for the prompt mechanics.

### Phase 6 — Emit guide files

For each surviving item, write **one markdown file**: `<gen-dir>/crc-aw-redlines-{stable_key}.md`. (Stable key is human-readable enough — `p9-c2-abc12345.md` — that file listings reflect page + position + content hash.)

The file template is described in §5. Each file is self-contained: title, description, source, regulatory overview, key terms, documents to review, validation methodology, a one-row checklist, and the figure block.

Plus emit a single index file: `<gen-dir>/index-aw-redlines.md` — a flat list of every per-item file in this generation with one-line summaries and the stable keys, for human eyeballing and CRC-workflow discovery.

Plus the standard sidecar artifacts: `ignored-comments.md`, `decisions.md` (HITL trace), `manifest.json`.

### Phase 7 — Validation gate

Count reconciliation. Total candidates in Phase 1 must equal `emitted + dropped_no_bbox + dropped_informational + dropped_dept_mismatch + hitl_dropped`. If math doesn't add up, fail loudly with a per-stage tally.

Also gate: every emitted item must have a non-null `figures/<stable_key>/crop.png`. If any are missing, fail with the list.

### Phase 8 — Supabase upload

Mirror `<gen-dir>` (minus `scratch/`) to bucket `crc-guides` at the same relative path. Same convention as the MCR-sourced skill's Phase 10.

---

## 4. Output artifacts

### 4.1 Directory layout

```
$NOETIC_WORKING_DIR/comment-resolution-check/
  {projectUuid}/{submissionUuid}/{submissionVersionNumber}/{generation-number}/
    crc-aw-redlines-p6-c1-<sha8>.md           # one per emitted item
    crc-aw-redlines-p8-c1-<sha8>.md
    crc-aw-redlines-p9-c1-<sha8>.md
    crc-aw-redlines-p9-c2-<sha8>.md
    ...
    index-aw-redlines.md                      # flat list of per-item files
    ignored-comments.md                       # what was dropped and why
    decisions.md                              # HITL trace
    manifest.json
    source.pdf                                # symlink → input redline PDF
    detailed-analysis-results.json            # copy of the input JSON
    enriched-analysis-results.json            # copy IFF used at Phase 4
    figures/
      p6-c1-<sha8>/
        crop.png        # 600-DPI crop with 15% padding
        page.png        # 300-DPI full-page render (shared per-page, but symlinked into each item dir for portability)
      p8-c1-<sha8>/
        ...
    scratch/            # raw page renders, temp masks — not uploaded
```

`{generation-number}` is monotonic across all invocations against the same `(projectUuid, submissionUuid, submissionVersionNumber)`. It does **not** distinguish between MCR-sourced and redline-sourced runs — both skills increment the same counter. Bureau workflow reads all generations under a version and unions them.

### 4.2 Per-item file template

```markdown
# CRC — Austin Water (Redlines) — {project name} v{version_number} — item {stable_key}

## Description

{item.full_comment_inference}

## Source

Redline PDF: {source.pdf filename from manifest}, page {page_number}, item id {page_id}.
Source kind: {redline_comment | graphical_edit}.
Refined: {true | false} (whether input was the navalbase-refine-step-3-output tree).

## Regulatory Overview

{Phase 4 content — either enriched final_enriched_comment, or the "reviewer convention" fallback paragraph}

## Key Terms

{Phase 4 key_terms[] as a bulleted list}

## Documents to Review

- The redlined plan page itself (page {page_number} of the source PDF)
- {if category is water/wastewater: "Existing site utility plans, demolition plans, and any associated water/wastewater detail sheets in the resubmission."}
- {if category is general_notes or title_sheet: "Cover sheet, sheet index, and general notes block."}
- {otherwise: dept-default per category}

## Validation Methodology

{Phase 3 enrich.evidence_expected, rendered as the single methodology paragraph}

To consider this item resolved, a reviewer must confirm: {Phase 3 enrich.evidence_expected restated}.

## Checklist Items

| ID | Parent Comment | Requirement to verify resolved | Code Citation | Severity | Evidence expected |
|----|----------------|-------------------------------|---------------|----------|-------------------|
| AW-REDLINES-{stable_key} | Page {page_number}, item {page_id} | {Phase 3 enrich.requirement} | {Phase 4 code_citation or "(reviewer convention)"} | required | {Phase 3 enrich.evidence_expected} |

## Figure

**Source crop** (page {page_number}) — *({Phase 3 figure_type})*

![{Phase 3 caption.alt}](figures/{stable_key}/crop.png)

{Phase 3 caption.body}

**Page context** (full sheet)

![Full page {page_number}](figures/{stable_key}/page.png)
```

### 4.3 `index-aw-redlines.md`

```markdown
# CRC AW Redlines — {project name} v{version_number} — generation {N}

## Items in this generation

| Stable key | Page | Source kind | Requirement (summary) | Figure type |
|------------|------|-------------|-----------------------|-------------|
| p6-c1-abc12345 | 6  | redline_comment | Update sheet index AW signpost… | site-specific |
| p8-c1-def67890 | 8  | redline_comment | Correct existing water meter callout… | site-specific |
| p9-c2-fed09876 | 9  | redline_comment | Correct existing 6\" meter to 2\"… | site-specific |
| ... | ... | ... | ... | ... |

## Skipped this generation (already covered by prior generations)

(only present in `--mode supplement`)

| Stable key | Page | Reason |
|------------|------|--------|
| p35-c1-… | 35 | covered by generation 0 |
```

### 4.4 `ignored-comments.md`

Same shape as the MCR-sourced skill's ignored-comments.md (see [`../generate-crc-guides/references/output-format.md`](../generate-crc-guides/references/output-format.md)), with these reason values:

- `no-bbox` — Phase 1 §3.2 (item had `bounding_box: null`).
- `informational` — Phase 1 §3.2 (`reviewer_intent != "corrective"`).
- `dept-mismatch` — Phase 1 §3.2 (category outside the dept's owned set, and user dropped in HITL).
- `verification-failed` — Phase 5 (user dropped a `match: false` item).
- `hitl-dropped` — Phase 5 catch-all.

### 4.5 `manifest.json`

```jsonc
{
  "skill_version": "1.0.0",
  "skill_name": "generate-crc-guides-from-redlines",
  "generation_number": 3,
  "executed_at": "<ISO-8601>",
  "mode": "supplement",
  "dept": "Austin Water (Redlines)",
  "inputs": {
    "detailed_analysis_results_path": "/Users/.../step-3-output-refined/.../detailed-analysis-results.json",
    "detailed_analysis_results_sha256": "<sha256>",
    "source_pdf_path": "<resolved symlink target>",
    "source_pdf_sha256": "<sha256>",
    "enriched_analysis_results_path": "<path or null>",
    "input_is_refined_tree": true,
    "proposed_refinements_version": "1.2 (second-pass on page 8)",
    "project_id": "<uuid>",
    "project_name": "Lamar + Collier",
    "submission_id": "<uuid>",
    "submission_version_id": "<uuid>",
    "submission_version_number": 0
  },
  "counts": {
    "candidates_total": 10,
    "emitted_items": 9,
    "dropped_no_bbox": 1,
    "dropped_informational": 0,
    "dropped_dept_mismatch": 0,
    "verification_failed_kept": 0,
    "hitl_dropped": 0,
    "supplement_skipped_already_covered": 0
  },
  "regulatory_enrichment": {
    "items_with_enriched_data": 9,
    "items_using_reviewer_convention_fallback": 0,
    "items_unmatched_in_enriched_file": 0
  },
  "vision_verification": {
    "match_true": 9,
    "match_false_kept": 0,
    "match_false_dropped": 0
  },
  "supabase_upload": {
    "bucket": "crc-guides",
    "relative_path": "{projectUuid}/{submissionUuid}/{versionNumber}/{generation_number}/",
    "uploaded_at": "<ISO-8601>"
  }
}
```

---

## 5. Versioning behavior — net-new vs. supplement

The skill **never modifies an existing file** under any prior generation directory.

### 5.1 `--mode net-new` (default)

1. Compute the next available `{generation-number}` by reading `$NOETIC_WORKING_DIR/comment-resolution-check/{projectUuid}/{submissionUuid}/{submissionVersionNumber}/` and taking `max(existing_generations) + 1` (or `0` if none exist).
2. Create that fresh directory.
3. Emit one file per surviving candidate from the input JSON. Every candidate that survives Phase 1+5 produces a file in this generation.

### 5.2 `--mode supplement`

1. Walk every prior generation directory under the same `(projectUuid, submissionUuid, submissionVersionNumber)`. For each, parse the `manifest.json`'s emitted stable_keys (or fall back to scanning filenames matching `crc-aw-redlines-*.md`). Build a `covered_stable_keys: set[str]` across all prior generations.
2. Run Phase 1 on the input JSON to derive candidate stable_keys.
3. For each candidate whose `stable_key in covered_stable_keys`, mark as `supplement_skipped_already_covered` and log to `index-aw-redlines.md`'s "Skipped" table.
4. For each candidate NOT in `covered_stable_keys`, run Phases 2-7 normally and emit a file in the new generation directory.
5. If the candidate set has no net-new items, abort with a clear message: *"All N candidate items in this redline PDF are already covered by generations 0..{max}. Re-run with `--mode net-new` to emit a parallel generation, or re-run after refining the source PDF to produce different stable keys."*

Both modes always create a new generation directory; supplement just emits fewer files in it.

### 5.3 What stable_key matches across generations

Identity is the sha8 content hash from §3.1, so an item moved from page 8 to page 9 by a future PDF re-render would NOT match (its page_number changed) and would be emitted as net-new. This is intentional — the workflow that consumes these guides cares about the page location, not just the content. Two items with identical text on different pages are different deficiencies.

---

## 6. Bureau access

Phase 4 reads bureau code sections only if `enriched-analysis-results.json` is present (layer-2 enrichment already did the lookups). The skill does **not** do its own bureau walk — that's intentional (per the §1 answer): the reviewer-convention fallback is fine for items without enrichment.

If a future enhancement wants per-skill bureau lookup, the section-text cache and citation-prefix → code-dir-map from the MCR-sourced skill ([`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md) §6) can be reused.

---

## 7. Skill file layout

```
~/noetic/claude-plugins/plugins/noetic-tools/skills/generate-crc-guides-from-redlines/
├── SKILL.md
├── pipeline.md
├── working-dir.md        # link to shared content from generate-crc-guides
├── prompts/
│   ├── verify-caption-enrich-classify.md   # the single per-item vision prompt
│   └── derive-key-terms-fallback.md        # used when no enrichment file present
└── references/
    ├── crop-recipe.md            # cropping math + magick invocations
    ├── stable-key.md             # the §3.1 stable-key derivation
    ├── output-format.md          # per-item file + index + ignored-comments
    ├── opportunistic-enrichment.md  # §4 matching rules
    ├── reviewer-convention-fallback.md  # the "no enrichment" copy
    └── supplement-semantics.md   # the §5.2 supplement-mode rules
```

`working-dir.md`, `hitl-flow.md`, and `supabase-lookup.md` are shared concepts with the MCR-sourced skill — this skill's references either link out to those files or duplicate brief content (decision to be made in implementation; recommend a single shared `_shared/` dir at the plugin root so both skills can `[link](../../_shared/...)`).

---

## 8. What's deferred (explicit non-goals for this skill, v1)

- **Per-component crops on composite-merged comments.** v1 always uses the top-level merged-envelope `bounding_box`. v2 could emit one figure per `annotation_component` and group them under one checklist item.
- **Bureau lookup when no enrichment file is present.** v1 falls back to "reviewer convention." v2 could opportunistically do a citation-keyword lookup in bureau if `transcribed_text` or `referenced_element` contains a recognizable code prefix (e.g., "UCM 2.7.4.B" verbatim in the reviewer's handwriting).
- **Cross-PDF batching.** One invocation = one PDF. v2 could accept `--folder-rsn` and iterate every PDF under it.
- **MCR + Redline merge in the bureau workflow consume path.** The bureau CRC workflow currently treats `crc-aw.md` and `crc-aw-redlines.md` as siblings; merging into a single dept view is out of scope here.
- **Non-default `--dept` values.** v1 hard-fails to HITL confirmation if `--dept` isn't `"Austin Water (Redlines)"`. v2 extends to other Bluebeam / redline review sources.

---

## 9. Open items (small defaults, flag for redirect)

- **Severity column on every checklist row**: defaulting to `required` since every retained item is `reviewer_intent: corrective`. Could be set per-item by an optional `--severity-classifier` LLM pass, but seems unnecessary for redlines.
- **HITL prompt threshold**: if Phase 5 has >10 questions, batch them across multiple `AskUserQuestion` calls (4-question cap per the AskUserQuestion contract) rather than dropping any.
- **Stable-key sha length**: 8 chars assumes ≤4M items per project before collision; comfortable for foreseeable use. Bump to 12 if a real collision shows up in manifest stats.
- **The `dept` field stored in manifest**: rendered as the human label `"Austin Water (Redlines)"` and the variant-suffix slug `"aw-redlines"` separately. Used to construct filenames + title-block strings.
- **What to do if the same PDF gets refined twice with different ops between two supplement runs**: the stable_key absorbs text-only changes via content hash, so a refinement that just renames `(AUNK)` → `(#UNK)` produces a new key for the same underlying item. Acceptable for v1 (the user can always run `--mode net-new` to start fresh); v2 could add a stable-key alias table to tie content-equivalent items together.

---

## 10. Relationship to the navalbase refine skill

This skill is the **natural downstream consumer** of `navalbase-refine-step-3-output`. The recommended workflow:

1. `navalbase step-3-analyze-pdfs` (one-time per PDF) → `step-3-output/.../detailed-analysis-results.json`
2. Invoke `noetic-tools:navalbase-refine-step-3-output` against that → `step-3-output-refined/.../detailed-analysis-results.json` (cleaner, composites merged, noise removed, filtered to actionable pages)
3. (Optional but recommended) `navalbase layer-2-enrich --step-3-dir step-3-output-refined` → produces `enriched-analysis-results.json` alongside, populating real regulatory citations.
4. Invoke `noetic-tools:generate-crc-guides-from-redlines` with `--detailed-analysis-results-path` pointing at the refined tree. Step 3's enriched file is auto-picked up.
5. Output lands at `$NOETIC_WORKING_DIR/comment-resolution-check/.../{generation}/crc-aw-redlines-*.md` plus mirrored to Supabase.

Running on the **unrefined** step-3 tree is supported but discouraged: the refine skill removes process noise (sheet-index signposts, "REJECTED" stamps, "Apply comments to ALL sheets" boilerplate) that would otherwise become individual checklist items in the CRC guide — exactly the kind of low-signal items the engineer doesn't need on their resubmission punch list.

The refine-skill's `proposed-refinements.json` is read at Phase 0 (if present) only to stamp provenance into manifest.json; it never influences which items get emitted.
