# `generate-crc-guides` — Instability Fix Design Spec

> **Status:** Design ready for implementation. 2026-06-26.
> **Pairs with:** [INSTABILITY-PROBLEMS-AND-FIX-PROPOSAL-SPEC.md](INSTABILITY-PROBLEMS-AND-FIX-PROPOSAL-SPEC.md) — the proposal is the *why*, this spec is the *what*.
> **Scope:** Moderate re-investment in the existing skill. More patch than redesign. No conductor migration this round; that's a future batch.

---

## 0. Context

The gen-4 run on `1700 S Lamar - U0 MCR.PDF` completed without errors but silently undercut six phases (Phase 5.5 figure detection narrowed 47→7 pages; Phase 6 decomposition batched; Phase 6.3 bureau lookups dropped to zero; Phase 6.5 enrichment sub-prompts collapsed into the main loop; Phase 7.5 source-map skipped; Phase 10 binary uploads deferred). Full diagnostic in the paired proposal.

The pattern: every prose imperative in `pipeline.md` ("you MUST", "no phase deferrals", "be judicious") sits alongside softening language ("vision is expensive"), and the agent silently resolves the tension under perceived cost pressure each run. No downstream phase can detect or refuse the shortcut, because there is no filesystem-anchored contract between phases.

### Goals

1. Catch every gap class from the gen-4 run at the next-phase boundary, not at human review.
2. Halt on degraded; require user acknowledgement before continuing.
3. Remove cost-pressure rationalization as a vector — make explicit that the user is paying Pro/Max tokens and has opted in to full pipeline spend.
4. Keep `pipeline.md` *shorter*, not longer — move per-phase enforcement into machine-checkable artifacts.
5. Land in one PR. Backwards-compatible with the existing skill prompts (no rewrites of `prompts/*.md`).

### Non-goals (deferred — see §11)

- Migration of the skill to a `conductor` workflow.
- Splitting `generate-crc-guides` into sub-skills.
- Moving deterministic phases (rasterize, pdftotext, file copy, source-map projection) out of the agent loop and into scripts.
- Resume support (`--force-restart`, partial-write recovery).
- Blessed-baseline tracking for cross-gen diffs.
- Headless / Inngest invocation. The skill remains an interactive Pro-account skill for now.
- MCP `storage_upload` enhancement at the Noetic MCP server. Fixed in-skill via `curl`.

---

## 1. Locked design decisions

| # | Decision | Source |
|---|---|---|
| D1 | Moderate re-investment; patch + validation step at phase boundaries. | Q1 |
| D2 | Presence-first gating + light quality validation. Vision is *not* expensive — user pays Pro/Max tokens and has opted in. | Q2, Q14 |
| D3 | No conductor migration this round. | Q3 |
| D4 | Default: halt on `completed_degraded`, require user acknowledgement. No headless mode. | Q4, Q5 |
| D5 | Bureau-miss-rate > 30% trips `completed_degraded`. | Q5 |
| D6 | No phase-skip flags. | Q6 |
| D7 | No sub-skill split. | Q8 |
| D8 | Out-of-prompt `verify-phase.py` for presence + count rules; in-prompt prose for light quality audit. | Q9 |
| D9 | Renumber every phase to a peer integer (no sub-numbering anywhere). | Q10 |
| D10 | Cross-gen sanity diff at the renumbered Phase 12 — Option C: hard floor on zero-counts + soft regression on atomic items. | Q11 |
| D11 | No resume support. | Q12 |
| D12 | Phase 7 (was Phase 6) emits `items.json` with `sourceSpanVerbatim` per item. Phase 10 source-map becomes a cheap bbox-projection pass. | Q13 |
| D13 | Phase 6 (was 5.5) vision-detects every kept page. No budget. Make explicit to the agent. | Q14 |
| D14 | Phase 7 decomposition: structural rule — one LLM call per parent comment via `decompose-comment.md`. Plus diagnostic count ratio in the verify rules. | Q15 |
| D15 | Binary upload fix lives in the skill (`curl` + service-role key), not at the MCP layer. | Q16 |
| D16 | Real JSON Schema validation via `jsonschema` (Python). Not prose-level "verify these fields." | Q17 |
| D17 | `pipeline.md` shrinks; per-phase contracts move to `references/phase-contracts.md`. | Q18 |
| D18 | One PR lands the full design. No beads decomposition. | Q20 |

---

## 2. Architecture

### 2.1 Filesystem-anchored phase contract

Each phase produces:

1. A **required artifact** at a known relative path.
2. A **phase execution log** at `scratch/phase-execution-logs/phase-{N}.json` conforming to `references/schemas/phase-execution-log.schema.json`.

The next phase's first step is to invoke `scripts/verify-phase.py {gen-dir} {N}`. If the script exits non-zero, the phase halts and writes `VALIDATION-FAILED.md` to the gen dir, then `AskUserQuestion` for proceed/retry/abort.

### 2.2 Execution log shape

`scratch/phase-execution-logs/phase-{N}.json`:

```jsonc
{
  "phase": "6",                              // string, integer-valued (no sub-numbers)
  "phase_name": "figure-extraction",
  "status": "completed",                     // "completed" | "completed_degraded" | "skipped" | "failed"
  "started_at": "2026-06-26T18:42:11.482Z",
  "ended_at":   "2026-06-26T18:45:14.901Z",
  "duration_ms": 183419,
  "inputs": {
    "kept_comment_count": 181,
    "pages_to_render": 47
  },
  "outputs": {
    "artifacts_written": [
      "scratch/figures-index.json",
      "scratch/figures/"                     // dirs end in "/"; verify-phase.py checks dir non-empty
    ],
    "counts": {
      "pages_rasterized": 47,
      "pages_vision_detected": 47,
      "figures_emitted": 28
    }
  },
  "decisions": [
    { "rule": "vision-detect-all-kept-pages",
      "spec_ref": "phase-contracts.md#phase-6",
      "rationale": "default contract — no triage; vision is not a cost gate" }
  ],
  "warnings": [],
  "errors": [],
  "llm_calls": [
    { "step": "detect-and-bound", "model": "claude-opus-4-7", "page": 4,
      "tokens_in": 1200, "tokens_out": 180 }
  ]
}
```

**Status semantics:**

| Status | Required artifacts | Next phase behavior |
|---|---|---|
| `completed` | all present, all counts match, no warnings | proceed |
| `completed_degraded` | all present, warnings raised | `AskUserQuestion` → proceed / retry / abort |
| `skipped` | required artifacts missing | halt + `VALIDATION-FAILED.md` |
| `failed` | phase aborted with errors | halt + `VALIDATION-FAILED.md` |

A phase MUST write its log atomically — temp file + rename. Partial logs are treated as `skipped`.

The full JSON Schema lives at `references/schemas/phase-execution-log.schema.json` (see §7 for the schema content).

### 2.3 `verify-phase.py` — out-of-prompt gate

`scripts/verify-phase.py`. Invoked between phases via Bash. Single-script, phase number arg.

```
verify-phase.py <gen-dir> <phase-number>

Exit codes:
  0 — completed (proceed)
  1 — skipped | failed | log invalid (halt)
  2 — completed_degraded (AskUserQuestion before proceeding)
```

What it checks, in order:

1. **Log file exists** at `scratch/phase-execution-logs/phase-{N}.json` and parses as JSON.
2. **Log conforms** to `references/schemas/phase-execution-log.schema.json` (validated via `jsonschema`).
3. **Status** is one of the four enum values.
4. **Every path** in `outputs.artifacts_written` exists. Paths ending in `/` must be non-empty directories.
5. **Phase-specific count rules** (see §4 per phase). These are file-derived cross-checks — e.g., for Phase 6, `len(figures-index.json entries with vision_detected=true) >= log.outputs.counts.pages_vision_detected`. The script reads the artifact directly, not the log's word.
6. **Cross-phase invariants** (see §4). E.g., Phase 8's verify reads `phase-7.json` to confirm `bureau-cache.json` was non-empty before enrichment started.

The script is **out of prompt**. The agent invokes it via Bash; it cannot rationalize a failure into a pass.

### 2.4 In-prompt phase preamble (light quality audit)

Each phase prompt block in `pipeline.md` opens with the same five-line preamble. Brief, fixed:

```
BEFORE STARTING PHASE {N}:
1. Run: bash scripts/verify-phase.py {gen-dir} {N-1}
2. Exit 0 → proceed. Exit 1 → halt + VALIDATION-FAILED.md + AskUserQuestion.
   Exit 2 → AskUserQuestion (proceed / retry / abort) before continuing.
3. Read scratch/phase-execution-logs/phase-{N-1}.json. Confirm the
   `decisions[]` array contains the expected default-contract entries
   for that phase (see references/phase-contracts.md §Phase {N-1}).
4. If a decision deviates from the default contract (e.g., a phase
   self-narrowed) and is not already flagged as `completed_degraded`,
   stop and AskUserQuestion. Do not silently proceed.
5. Start phase. Emit your artifact + execution log atomically.
```

Step 3–4 is the "light quality audit" — the agent reads the prior log and visually confirms the decisions match the default contract. Catches cases where the agent wrote a misleading log claiming `completed` while having narrowed the work. Cheap; relies on the agent honestly reporting decisions, but the structural verify in step 2 catches presence-level lies.

### 2.5 Cost & vision policy (anti-shortcut language)

The single highest-leverage prompt change. Goes at the **top of `pipeline.md`** in its own callout block, and is referenced from `SKILL.md` "Key rules":

```
COST & VISION POLICY (READ FIRST)

This skill is invoked from a Claude Pro or Max account. The user has
elected to spend their session token budget on a complete pipeline run.
Native Opus / Sonnet vision calls and per-comment LLM dispatches are
NOT a cost concern. The user understands this is a token-expensive
skill and has opted in.

The agent's only correct heuristic is:
  "Run every phase as written. Make every per-page vision call.
   Make every per-comment LLM decomposition call. Make every
   per-department enrichment sub-prompt call. Do not batch.
   Do not narrow. Do not collapse."

If you find yourself reasoning:
  - "this saves 85% of vision calls"
  - "I can write the enrichment sections inline"
  - "this comment doesn't need the LLM decomposition call"
  - "the binary upload is disproportionately expensive in tokens"
STOP. That is the exact failure mode this contract exists to prevent.
The phase-execution-log gate will catch the shortcut and halt the run.
You will not save the user tokens by collapsing calls — you will only
trigger a re-run.

The only legitimate phase short-circuits are CLI flags at Phase 0
(--submission-version-id, --project-id, --submission-id) and the
figure-extraction skip for parent comments already dropped in
Phases 3-5. Anything else is a bug, not a tradeoff.
```

This language replaces, not supplements, the existing "be judicious"-adjacent prose in `references/figure-extraction.md` and the "Cost notes" section of `references/enrichment.md` (see §9 for the diff). Mixed signals are the root cause.

---

## 3. Phase renumbering

Sub-numbering gets dropped. Every phase becomes a peer integer.

| Old phase | New phase | Name | Notes |
|---|---|---|---|
| 0 | **0** | Pre-flight + resolve submission_version | Adds 0.4 sub-step (Supabase service-role key check) within Phase 0 — still one phase, see §4.0 |
| 1 | **1** | Parse MCR PDF | unchanged in scope |
| 2 | **2** | Department classification | unchanged in scope |
| 3 | **3** | Status filter | unchanged in scope |
| 4 | **4** | Severity classification | unchanged in scope |
| 5 | **5** | Plan-verifiability filter | unchanged in scope |
| 5.5 | **6** | Figure extraction | promoted out of sub-numbering |
| 6 | **7** | Decomposition (now emits `sourceSpanVerbatim` per item) | bureau cache writes happen here for vague-citation lookups |
| 6.3 | *folded into 7 + 8* | Bureau cache | not a peer phase — it's a shared artifact (`scratch/bureau-cache.json`) populated by Phase 7 and completed in Phase 8 |
| 6.5 | **8** | Enrichment | promoted out of sub-numbering; completes the bureau cache |
| 7 | **9** | HITL review batch | promoted (was sub-number 7, now peer 9) |
| 7.5 | **10** | Source-map emit | promoted; cheaper now that Phase 7 emits per-item spans |
| 8 | **11** | Emit (per-dept guides) | renumbered |
| 9 | **12** | Validation gate (count math + cross-gen sanity diff) | renumbered; cross-gen diff added |
| 10 | **13** | Supabase upload (with binary path) | renumbered; binary upload fix added |

Total: 14 phases (0–13). No sub-numbers anywhere in the pipeline.

Downstream consumers of phase numbers (none currently, since the skill outputs files not phase IDs) are unaffected. Internal references in `bugs/INSTABILITY-PROBLEMS-AND-FIX-PROPOSAL-SPEC.md` keep their original numbers; this design spec uses the new numbers exclusively.

---

## 4. Per-phase contracts

Each phase below states: **required artifacts**, **execution-log counts**, **verify-phase.py rules**, **cross-phase invariants**.

The full JSON schemas live at `references/schemas/`. Prose-level summaries follow.

### 4.0 Phase 0 — Pre-flight + resolve submission_version

**Required artifacts.**

```
scratch/preflight.json
scratch/phase-execution-logs/phase-0.json
```

**`scratch/preflight.json` shape.**

```jsonc
{
  "working_dir": "/Users/wnavey/noetic",
  "bureau_path": "/Users/wnavey/noetic/bureau",
  "comment_resolution_check_path": "/Users/wnavey/noetic/comment-resolution-check",
  "cli_tools": {
    "pdftotext": { "found": true, "path": "/opt/homebrew/bin/pdftotext" },
    "pdftoppm":  { "found": true, "path": "/opt/homebrew/bin/pdftoppm" },
    "convert":   { "found": true, "path": "/opt/homebrew/bin/convert" }
  },
  "supabase": {
    "service_role_key_source": "inspector-general/.env",
    "service_role_key_present": true,
    "project_ref_from_url": "<project_ref>"
  },
  "resolution": {
    "project_uuid": "23301a8a-...",
    "submission_uuid": "cf1201c2-...",
    "submission_version_id": "...",
    "submission_version_number": 4
  },
  "generation_number": 5,
  "generation_dir": "/Users/wnavey/noetic/comment-resolution-check/23301a8a-.../cf1201c2-.../4/5"
}
```

**New sub-step: Supabase service-role key check.** Before doing any DB lookup work:

1. Look for env var `SUPABASE_SERVICE_ROLE_KEY`.
2. If unset, parse `$NOETIC_WORKING_DIR/inspector-general/.env` for the key.
3. If still unset, halt with the message:
   ```
   Supabase service-role key not found. Phase 13 needs this to upload
   mcr.pdf and figures via curl. Set SUPABASE_SERVICE_ROLE_KEY in your
   environment, or ensure $NOETIC_WORKING_DIR/inspector-general/.env
   contains a SUPABASE_SERVICE_ROLE_KEY=... line.
   ```
4. Do not write the key into any artifact. `preflight.json` records only the *source* (`"env" | "inspector-general/.env" | "absent"`), not the value.

**Verify rules.**

- `preflight.json.cli_tools.*.found` all `true`.
- `preflight.json.supabase.service_role_key_present == true`.
- `preflight.json.resolution.*` all populated.
- Generation dir on disk matches `preflight.json.generation_dir`.

### 4.1 Phase 1 — Parse MCR PDF

**Required artifacts.**

```
mcr.pdf
scratch/mcr.txt
scratch/raw-comments.json
scratch/phase-execution-logs/phase-1.json
```

**Execution-log counts.**

```jsonc
{ "raw_comments_parsed": <int>,
  "unique_dept_prefixes": <int>,
  "pages_in_pdf": <int>,
  "mcr_sha256": "<hex>" }
```

**Verify rules.**

- `mcr.pdf` exists, sha256 matches log.
- `raw-comments.json` is a non-empty array; every entry has `raw_id, dept_prefix, comment_number, status, body, source_page`.
- `raw_comments_parsed == len(raw-comments.json)`.

### 4.2 Phase 2 — Department classification

**Required artifacts.**

```
scratch/dept-classifications.json
scratch/phase-execution-logs/phase-2.json
```

**`scratch/dept-classifications.json` shape.**

```jsonc
{
  "classified": [
    { "raw_id": "TPW 6", "dept_prefix": "TPW", "department": "Transportation and Public Works" }
  ],
  "hitl_bucket": [
    { "raw_id": "??? 1", "dept_prefix": "???", "category": "dept:unknown" }
  ]
}
```

**Verify rules.**

- `len(classified) + len(hitl_bucket) == phase-1.counts.raw_comments_parsed`.

### 4.3 Phase 3 — Status filter

**Required artifacts.**

```
scratch/status-filter.json
scratch/phase-execution-logs/phase-3.json
```

**`scratch/status-filter.json` shape.**

```jsonc
{
  "kept":    [ { "raw_id": "TPW 6", "status": "Pending" } ],
  "dropped": [ { "raw_id": "TPW 1", "status": "Cleared", "reason": "status" } ],
  "hitl":    [ { "raw_id": "TPW 9", "status": "???", "category": "status:unknown" } ]
}
```

**Verify rules.**

- `len(kept) + len(dropped) + len(hitl) == phase-2.counts.classified + phase-2.counts.hitl_bucket`.

### 4.4 Phase 4 — Severity classification

**Required artifacts.**

```
scratch/severity.json
scratch/phase-execution-logs/phase-4.json
```

**Verify rules.**

- Every entry in `phase-3.kept` has a corresponding severity classification in `severity.json`.
- `severity_llm_calls_dispatched >= len(phase-3.kept)` (one call per kept comment — no batching).

### 4.5 Phase 5 — Plan-verifiability filter

**Required artifacts.**

```
scratch/plan-verifiability.json
scratch/phase-execution-logs/phase-5.json
```

**Verify rules.**

- Every entry in `severity.json` with `severity != "note"` has a verifiability classification.
- `verifiability_llm_calls_dispatched >= len(non_note_severities)`.

### 4.6 Phase 6 — Figure extraction (was Phase 5.5)

**The most-shortcut phase in gen-4. Tightest contract.**

**Required artifacts.**

```
scratch/pages/page-NN.png                              (one per kept-comment-hosting page)
scratch/figures-index.json
scratch/figures/{parent_comment_id}/N.png              (one per detected figure)
scratch/phase-execution-logs/phase-6.json
```

**`scratch/figures-index.json` shape.**

```jsonc
{
  "pages": [
    { "page": 4,
      "rasterized": true,
      "vision_detected": true,                         // MUST be true for every kept page
      "vision_model": "claude-opus-4-7",
      "figures_detected": 3,
      "figures": [
        { "comment_id": "TPW 9",
          "bbox_pct": { "x": 12.5, "y": 32.0, "w": 70.0, "h": 55.0 },
          "brief_label": "Standard parking bulb-out",
          "crop_path": "scratch/figures/TPW-9/1.png",
          "described": true,
          "description": "...",
          "type": "reference-design",
          "constraints": ["..."] }
      ] }
  ]
}
```

**Execution-log counts.**

```jsonc
{ "pages_kept": <int>,
  "pages_rasterized": <int>,
  "pages_vision_detected": <int>,
  "figures_emitted": <int>,
  "vision_detect_calls_dispatched": <int>,
  "vision_describe_calls_dispatched": <int> }
```

**Verify rules.**

- `pages_kept == count(unique source_pages across all kept comments after Phase 5)`.
- `pages_rasterized == pages_kept` (one PNG per kept page).
- **`pages_vision_detected == pages_kept`** — every kept page MUST have a vision-detect call. This is the gen-4 narrowing fix. If less than `pages_kept`, status MUST be `completed_degraded` or `failed`.
- `vision_detect_calls_dispatched >= pages_kept` (one call per page minimum).
- `figures_emitted == sum of figures_detected across pages`.
- Every entry in `figures-index.json` with `described: true` has a corresponding PNG at its `crop_path`.

**Cross-phase invariants.**

- Reads `phase-5.json` to confirm `verifiability_llm_calls_dispatched > 0` (no upstream skip).

### 4.7 Phase 7 — Decomposition (was Phase 6) + items.json with source spans

**Required artifacts.**

```
scratch/items.json                                     # NEW: was raw-comments[].decomposed; now first-class
scratch/bureau-cache.json                              # populated for vague-citation lookups
scratch/phase-execution-logs/phase-7.json
```

**`scratch/items.json` shape (this is the [D12] move — `sourceSpanVerbatim` becomes a Phase-7 field):**

```jsonc
{
  "items": [
    { "id": "TPW-6.1",
      "parentComment": "TPW 6",
      "requirement": "...",
      "codeCitation": "TCM 9.2.3.1.B",
      "severity": "required",
      "evidenceExpected": "Site plan / striping sheet",
      "requiredEvidenceForms": [],
      "preferredEvidenceForms": [],
      "sourcePage": 14,
      "sourceSpanVerbatim": "Provide a striping plan showing ...",  // NEW
      "figures": [...] }
  ],
  "decomposition_summary": {
    "parents_in": <int>,
    "items_out": <int>,
    "compound_split_count": <int>,
    "vague_citation_decomp_count": <int>,
    "notes_block_collapsed_count": <int>
  }
}
```

**`scratch/bureau-cache.json` shape (shared with Phase 8 — Phase 7 writes initial entries, Phase 8 appends).**

```jsonc
{
  "sections": {
    "TCM 9.2.3.1.B": { "text": "...", "source_path": "bureau/jurisdictions/austin/codes/tcm/contents/Section 9..." }
  },
  "misses": [
    { "citation": "DCM 8.3.2(C)", "fallback": "section_not_found",
      "context": { "phase": "7", "comment_id": "DE 35" } }
  ]
}
```

**Execution-log counts.**

```jsonc
{ "parents_in": <int>,
  "items_out": <int>,
  "decompose_calls_dispatched": <int>,           // one per parent — no batching
  "decompose_code_section_calls_dispatched": <int>,
  "vague_citation_count": <int>,
  "bureau_lookups_attempted": <int>,
  "bureau_lookups_succeeded": <int>,
  "bureau_lookups_failed": <int> }
```

**Verify rules.**

- `parents_in == len(kept comments after Phase 5 + HITL flips through Phase 9)` — wait, Phase 9 (HITL) runs *after* 7. Correction: `parents_in == len(kept comments emerging from Phase 5)`; the HITL backfill is handled in Phase 9.
- **`decompose_calls_dispatched == parents_in`** — D14: structural rule, one LLM call per parent. The gen-4 collapse fix.
- `decompose_code_section_calls_dispatched == vague_citation_count`.
- `items_out >= parents_in` (every parent produces ≥1 item).
- **Diagnostic warn:** if `items_out / parents_in < 1.15` *and* `parents_in > 50`, surface as warning ("ratio suggests undersplit"). This is the soft signal for the compound-content density problem in gen-4. Threshold calibrated on gen-1 (240/181 ≈ 1.33).
- Every item has a non-null `sourceSpanVerbatim` string.

**Cross-phase invariants.**

- Reads `phase-6.json` to confirm `pages_vision_detected == pages_kept` (no figure narrowing — figures are decomposition context).

### 4.8 Phase 8 — Enrichment (was Phase 6.5)

**Required artifacts.**

```
scratch/enrichment/{dept}/description.md
scratch/enrichment/{dept}/reg-overview.md
scratch/enrichment/{dept}/key-terms.md
scratch/enrichment/{dept}/docs.md
scratch/enrichment/{dept}/methodology.md
scratch/bureau-cache.json                              # extended from Phase 7
scratch/phase-execution-logs/phase-8.json
```

**Execution-log counts.**

```jsonc
{ "depts_processed": <int>,
  "enrichment_subprompts_dispatched": <int>,
  "unique_citations_resolved": <int>,
  "bureau_lookups_attempted_this_phase": <int>,
  "bureau_lookups_failed_this_phase": <int>,
  "bureau_miss_rate": <float> }
```

**Verify rules.**

- For every dept in the dept-classifications-after-status-filter set, all five `.md` files exist and are non-empty (≥50 chars).
- **`enrichment_subprompts_dispatched == 5 * depts_processed`** — D14: structural rule. The gen-4 collapse fix. No inlining.
- `bureau_lookups_attempted_this_phase > 0` if `unique_citations_resolved > 0`. **The phase MUST attempt bureau lookups.** The gen-4 "zero bureau reads" fix.
- **`bureau_miss_rate <= 0.30`** — D5. Above 30% → status `completed_degraded` with `AskUserQuestion`.

**Cross-phase invariants.**

- Reads `phase-7.json`. Halts if `phase-7.bureau_lookups_attempted == 0`. (Catches the case where the bureau cache file exists but was never populated.)
- Reads `phase-7.items.json`. Confirms every unique citation in items has an entry in `bureau-cache.json` (resolved or in `misses[]`).

### 4.9 Phase 9 — HITL review batch (was Phase 7)

**Required artifacts.**

```
scratch/hitl-prompts.json
scratch/hitl-decisions.json                            # written after AskUserQuestion responses
scratch/phase-execution-logs/phase-9.json
```

**`scratch/hitl-prompts.json` shape.**

```jsonc
{
  "prompts": [
    { "id": "h1", "category": "dept:unknown", "raw_id": "??? 1", "options": [...] },
    { "id": "h2", "category": "status:unknown", "raw_id": "TPW 9", "options": [...] }
  ]
}
```

**Verify rules.**

- If `hitl-prompts.json.prompts` is non-empty, `hitl-decisions.json.decisions` must have the same length.
- If Phase 9 flips a previously-dropped comment to `include`, Phase 6 (figure extraction) MUST be re-invoked for that comment's source_page — log records `phase-6-rerun: true` in `phase-9.json.outputs`.

### 4.10 Phase 10 — Source-map emit (was Phase 7.5)

**Now a cheap projection pass** (D12) — `sourceSpanVerbatim` already lives on every item from Phase 7.

**Required artifacts.**

```
source-map.json                                        # at gen-dir root, not scratch
scratch/phase-execution-logs/phase-10.json
```

The full `source-map.json` shape is documented in the existing `pipeline.md` §7.5.7 — keep that unchanged.

**Execution-log counts.**

```jsonc
{ "parents_in": <int>,
  "items_in": <int>,
  "items_with_exact_match": <int>,
  "items_with_fuzzy_match": <int>,
  "items_with_vision_recovery": <int>,
  "items_with_source_unknown": <int>,
  "parent_bbox_anchor_success": <int>,
  "parent_bbox_anchor_failure": <int>,
  "vision_recovery_calls_dispatched": <int> }
```

**Verify rules.**

- `source-map.json` exists. (The gen-4 silent-skip fix.)
- `items_in == phase-7.items_out + phase-9.hitl_flipped_items`.
- All §7.5.6 invariants pass (orphan check, unique IDs, char-offset bounds, verbatim/offset co-null rule).
- `items_with_source_unknown / items_in <= 0.05` — above 5% triggers `completed_degraded`.

### 4.11 Phase 11 — Emit (was Phase 8)

**Required artifacts.**

```
crc-{dept}.md      OR   crc-{dept}-1.md, crc-{dept}-2.md, ...
ignored-comments.md
decisions.md
manifest.json
figures/{parent_comment_id}/N.png                      # promoted from scratch
scratch/phase-execution-logs/phase-11.json
```

**`manifest.json` shape.** Extends the current shape (see `references/output-format.md`) with new top-level fields:

```jsonc
{
  // existing fields preserved
  "phase_logs_summary": {
    "phase-0":  { "status": "completed",          "duration_ms": 4321 },
    "phase-1":  { "status": "completed",          "duration_ms": 12345 },
    // ...
    "phase-13": { "status": "completed",          "duration_ms": 89012 }
  },
  "cost_disclosure": {
    "vision_calls_total": <int>,
    "llm_subprompt_calls_total": <int>,
    "bureau_reads_total": <int>
  },
  "uploaded_files": []                                 // populated by Phase 13
}
```

**Verify rules.**

- All upstream phase logs (0–10) have `status in {completed, completed_degraded}`.
- For every dept with ≥1 emitted item, the dept's guide file(s) exist.
- Every emitted item ID matches the Phase 8.1 normalization (strip `.1` from solo items).
- `figures/` at gen-dir root contains every figure listed in `items.json` (post HITL drops).

### 4.12 Phase 12 — Validation gate (was Phase 9) + cross-gen sanity diff

Existing count-reconciliation math stays:

```
total_parsed == total_emitted_items_collapsed_to_parents
              + dropped_status + dropped_severity + dropped_not_verifiable
              + hitl_dropped
```

**NEW: cross-gen sanity diff (D10, Option C).** Implemented inside Phase 12.

1. **Discover priors.** List sibling dirs at `{projectUuid}/{submissionUuid}/{submissionVersionNumber}/{N}/` for `N < current_generation_number`. For each, read its `manifest.json`.
2. **Compute baselines** from the prior set:
   - `baseline_figures = max(prior.cost_disclosure.vision_calls_total or prior figure counts)`
   - `baseline_bureau_lookups = max(prior.cost_disclosure.bureau_reads_total or prior bureau counts)`
   - `baseline_enrichment_calls = max(prior.cost_disclosure.llm_subprompt_calls_total restricted to phase-8 calls)`
   - `baseline_atomic_items = max(prior atomic item totals)`
3. **Hard floor checks** (any of these → `failed`, write `VALIDATION-FAILED.md`):
   - `current_figures == 0` while `baseline_figures > 0`
   - `current_bureau_lookups == 0` while `baseline_bureau_lookups > 0`
   - `current_enrichment_subprompts == 0` while `baseline_enrichment_calls > 0`
4. **Soft regression check** (warn → `completed_degraded`):
   - `(current_atomic_items - baseline_atomic_items) / baseline_atomic_items < -0.20`
5. **Skip the diff if no prior generations exist.** First-ever gen on a submission_version has no baseline.

**Required artifacts.**

```
scratch/phase-execution-logs/phase-12.json
VALIDATION-FAILED.md                                   # only if math fails or hard floor trips
```

**Execution-log counts.**

```jsonc
{ "count_math_pass": true,
  "prior_generations_compared": [1, 2, 3, 4],
  "baselines": { "figures": 28, "bureau_lookups": 47, "enrichment_calls": 75, "atomic_items": 240 },
  "current":   { "figures": 31, "bureau_lookups": 52, "enrichment_calls": 75, "atomic_items": 218 },
  "hard_floor_trips": [],
  "soft_regression_trips": [
    { "stat": "atomic_items", "current": 218, "baseline": 240, "delta_pct": -9.2 }
  ] }
```

### 4.13 Phase 13 — Supabase upload (was Phase 10) + binary upload fix

**Required artifacts.**

```
scratch/phase-execution-logs/phase-13.json
manifest.json                                          # updated with uploaded_files
```

**Upload strategy by file type.**

| File type | Tool | Notes |
|---|---|---|
| `*.md`, `*.json` (text) | `mcp__claude_ai_Supabase__storage_upload` | existing path; cheap |
| `mcp.pdf`, `figures/**.png` (binary) | `curl -X POST` with service-role key | D15 — binary fix |

**Binary upload via `curl`:**

```bash
SUPABASE_PROJECT_REF="<project_ref_from_preflight>"
SUPABASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co"
BUCKET="crc-guides"
RELATIVE_PATH="${projectUuid}/${submissionUuid}/${submissionVersionNumber}/${generation_number}/mcr.pdf"

curl -X POST \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/pdf" \
  --data-binary "@${gen_dir}/mcr.pdf" \
  "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${RELATIVE_PATH}"
```

For PNGs use `Content-Type: image/png`. For each binary, capture the response status; non-2xx → log to `manifest.json.upload_errors[]` and set phase status to `completed_degraded`.

**`manifest.json.uploaded_files` shape (D15 enforcement).**

```jsonc
"uploaded_files": [
  { "path": "mcr.pdf",                "method": "curl",          "size_bytes": 5234567, "status": 200, "uploaded_at": "..." },
  { "path": "crc-tpw.md",             "method": "mcp",           "size_bytes": 18234,   "status": 200, "uploaded_at": "..." },
  { "path": "figures/TPW-9/1.png",    "method": "curl",          "size_bytes": 89012,   "status": 200, "uploaded_at": "..." }
]
```

**Verify rules.**

- Every file in the gen dir (excluding `scratch/`) appears in `uploaded_files` with `status == 200`.
- `mcr.pdf` is present in `uploaded_files`. (Gen-4 silent-skip fix.)
- Every PNG under `figures/` is present in `uploaded_files`.
- `uploaded_files.method == "curl"` for every entry where `path == "mcr.pdf"` or `path.startswith("figures/")`.

---

## 5. Cross-gen sanity diff — Option C details

Recap of §4.12, with worked example using the gen-4 numbers:

**Gen-4 had:**

| Stat | gen-1 | gen-2 | gen-3 | gen-4 | Baseline (max of priors) | Trip? |
|---|---|---|---|---|---|---|
| Figures | 28 | 24 | 6 | 12 | 28 | **hard floor**: 12 > 0 → no trip on zero rule. Soft? Not in Option C. |
| Bureau lookups | many | many | partial | 0 | many | **HARD FLOOR HIT** — halt + VALIDATION-FAILED.md |
| Enrichment sub-prompts | 75 | 75 | partial | 0 | 75 | **HARD FLOOR HIT** — halt + VALIDATION-FAILED.md |
| Atomic items | 240 | 225 | 190 | 192 | 240 | soft: 192/240 = 0.80 → −20.0% → **right at threshold**, trip → completed_degraded |

In the gen-4 run, Option C catches the two most egregious gaps (bureau zero, enrichment zero) at hard-floor severity and surfaces the atomic-items regression at soft severity. No calibration period needed for the hard floors; the soft regression threshold (−20%) is the proposal's suggestion and stays adjustable in `phase-contracts.md`.

**Note on "what if gen-1 was the buggy one?"** Option C only treats zero-counts as bad — it doesn't try to identify the "right" baseline. A gen that legitimately produced zero of something will get re-flagged on every subsequent run, but that's a feature: the human reviewer marks that prior gen as a known-bad and the diff is informational from then on. (Blessed-baseline tracking is the v2 follow-up — see §11.)

---

## 6. Binary upload fix (Phase 13)

Already specified inline at §4.13. Three things to call out:

1. **Service-role key sourcing happens in Phase 0**, not Phase 13. If the key is missing, the user finds out at minute 0 of a 30-minute run, not minute 28.
2. **`uploaded_files` enumeration is enforced.** Phase 13 verify reads the gen dir, reads `manifest.json.uploaded_files`, and confirms every non-`scratch/` file is enumerated. The gen-4 case (`uploaded_at` set despite partial upload) cannot recur — the enumeration is the source of truth, not a single timestamp.
3. **No fallback to base64-through-MCP for binaries.** Don't make it an option. `curl` or fail.

---

## 7. File & directory changes

### 7.1 New files

```
claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/
├── references/
│   ├── phase-contracts.md                             # NEW — all per-phase rules, the canonical source
│   └── schemas/                                       # NEW dir
│       ├── phase-execution-log.schema.json
│       ├── preflight.schema.json
│       ├── raw-comments.schema.json
│       ├── dept-classifications.schema.json
│       ├── status-filter.schema.json
│       ├── severity.schema.json
│       ├── plan-verifiability.schema.json
│       ├── figures-index.schema.json
│       ├── items.schema.json
│       ├── bureau-cache.schema.json
│       ├── enrichment-section.schema.json
│       ├── hitl-prompts.schema.json
│       ├── hitl-decisions.schema.json
│       ├── source-map.schema.json
│       └── manifest.schema.json
└── scripts/                                           # NEW dir
    └── verify-phase.py
```

### 7.2 Modified files

```
claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/
├── SKILL.md                                           # renumber pipeline table; add cost policy
├── pipeline.md                                        # shrink; point at phase-contracts.md; renumber
├── references/
│   ├── figure-extraction.md                           # strip "be judicious"; reinforce cost policy
│   ├── decomposition.md                               # strip "bias toward fewer"; structural-rule note
│   └── enrichment.md                                  # strip "Cost notes" section; reinforce cost policy
└── working-dir.md                                     # add gen-dir layout for scratch/phase-execution-logs/
```

### 7.3 Generation directory layout (post-fix)

```
{projectUuid}/{submissionUuid}/{submissionVersionNumber}/{generation-number}/
  mcr.pdf
  crc-{dept}.md
  ignored-comments.md
  decisions.md
  manifest.json
  source-map.json
  figures/{parent_comment_id}/N.png
  VALIDATION-FAILED.md                                 # only if Phase 12 fails
  scratch/
    preflight.json
    mcr.txt
    raw-comments.json
    dept-classifications.json
    status-filter.json
    severity.json
    plan-verifiability.json
    figures-index.json
    items.json
    bureau-cache.json
    hitl-prompts.json
    hitl-decisions.json
    enrichment/{dept}/{description,reg-overview,key-terms,docs,methodology}.md
    pages/page-NN.png
    figures/{parent_comment_id}/N.png
    phase-execution-logs/
      phase-0.json
      phase-1.json
      ...
      phase-13.json
```

---

## 8. `phase-execution-log.schema.json` (canonical)

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "phase-execution-log.schema.json",
  "title": "PhaseExecutionLog",
  "type": "object",
  "required": ["phase", "phase_name", "status", "started_at", "ended_at", "outputs"],
  "additionalProperties": false,
  "properties": {
    "phase": { "type": "string", "pattern": "^([0-9]|1[0-3])$" },
    "phase_name": { "type": "string", "minLength": 1 },
    "status": { "enum": ["completed", "completed_degraded", "skipped", "failed"] },
    "started_at": { "type": "string", "format": "date-time" },
    "ended_at": { "type": "string", "format": "date-time" },
    "duration_ms": { "type": "integer", "minimum": 0 },
    "inputs": { "type": "object" },
    "outputs": {
      "type": "object",
      "required": ["artifacts_written", "counts"],
      "additionalProperties": false,
      "properties": {
        "artifacts_written": {
          "type": "array",
          "items": { "type": "string" }
        },
        "counts": {
          "type": "object",
          "additionalProperties": { "type": ["integer", "number", "string", "boolean"] }
        }
      }
    },
    "decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule", "spec_ref", "rationale"],
        "properties": {
          "rule": { "type": "string" },
          "spec_ref": { "type": "string" },
          "rationale": { "type": "string" }
        }
      }
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["code", "message"],
        "properties": {
          "code": { "type": "string" },
          "message": { "type": "string" },
          "context": { "type": "object" }
        }
      }
    },
    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["code", "message"],
        "properties": {
          "code": { "type": "string" },
          "message": { "type": "string" },
          "context": { "type": "object" }
        }
      }
    },
    "llm_calls": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "step": { "type": "string" },
          "model": { "type": "string" },
          "tokens_in": { "type": "integer" },
          "tokens_out": { "type": "integer" }
        }
      }
    }
  }
}
```

The per-phase artifact schemas (figures-index, items, bureau-cache, etc.) follow the same draft-07 convention; full content lives in the schema files in this PR.

---

## 9. `verify-phase.py` outline

Not committing finished code in this spec — the PR ships the actual script. Outline:

```python
#!/usr/bin/env python3
"""verify-phase.py — gate between CRC pipeline phases.

Usage: verify-phase.py <gen-dir> <phase-number>

Reads <gen-dir>/scratch/phase-execution-logs/phase-<N>.json.
Validates per references/phase-contracts.md.

Exit codes:
  0 — completed (proceed)
  1 — skipped | failed | log invalid | required artifact missing (halt)
  2 — completed_degraded (caller should AskUserQuestion)
"""

import json, sys, pathlib
from jsonschema import validate, ValidationError

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
SCHEMA_DIR = SKILL_DIR / "references" / "schemas"
LOG_SCHEMA = json.loads((SCHEMA_DIR / "phase-execution-log.schema.json").read_text())

# Per-phase rule registry — one function per phase.
# Each returns (status_override | None, [warnings]).
PHASE_RULES = {
    "0":  rules_phase_0,
    "1":  rules_phase_1,
    # ...
    "6":  rules_phase_6,    # the hardest, includes the vision-detect-all check
    "7":  rules_phase_7,
    "8":  rules_phase_8,    # bureau miss rate, enrichment 5 * depts
    # ...
    "12": rules_phase_12,   # cross-gen sanity diff
    "13": rules_phase_13,   # binary upload enumeration
}

def main(gen_dir: pathlib.Path, phase: str) -> int:
    log_path = gen_dir / "scratch" / "phase-execution-logs" / f"phase-{phase}.json"
    if not log_path.exists():
        print(f"FAIL: phase-{phase}.json missing", file=sys.stderr)
        return 1

    log = json.loads(log_path.read_text())

    try:
        validate(log, LOG_SCHEMA)
    except ValidationError as e:
        print(f"FAIL: log schema invalid: {e.message}", file=sys.stderr)
        return 1

    if log["status"] in ("skipped", "failed"):
        print(f"FAIL: phase status {log['status']}", file=sys.stderr)
        return 1

    for path_str in log["outputs"]["artifacts_written"]:
        p = gen_dir / path_str
        if path_str.endswith("/"):
            if not p.is_dir() or not any(p.iterdir()):
                print(f"FAIL: directory missing or empty: {path_str}", file=sys.stderr)
                return 1
        else:
            if not p.exists():
                print(f"FAIL: artifact missing: {path_str}", file=sys.stderr)
                return 1

    rule_fn = PHASE_RULES.get(phase)
    if rule_fn:
        override, warnings = rule_fn(gen_dir, log)
        for w in warnings:
            print(f"WARN: {w}", file=sys.stderr)
        if override == "failed":
            return 1
        if override == "completed_degraded" or log["status"] == "completed_degraded":
            return 2

    return 0
```

Per-phase rule functions enforce the counts and cross-checks from §4. They MAY upgrade `status: completed` to `completed_degraded` if file-derived counts disagree with log claims — the file is ground truth.

---

## 10. `pipeline.md` after the shrink

The new pipeline.md is ~30% shorter. Each phase becomes a 5–8 line block referencing `phase-contracts.md` for the full rules. Sample shape for Phase 6:

```markdown
## Phase 6 — Figure extraction

Only runs on comments surviving Phases 3–5. See
[references/figure-extraction.md](references/figure-extraction.md)
for the pipeline mechanics and
[references/phase-contracts.md#phase-6](references/phase-contracts.md#phase-6)
for the contract (required artifacts, log schema, verify rules).

Preamble: run `bash scripts/verify-phase.py {gen-dir} 5` and proceed only on
exit 0; on exit 1 halt + VALIDATION-FAILED.md; on exit 2 AskUserQuestion.

**Vision-detect every kept page.** No narrowing. Pro/Max tokens are not a
cost gate. See [Cost & Vision Policy](#cost--vision-policy) at the top of
this file.

Emit `scratch/figures-index.json`, `scratch/figures/`, and
`scratch/phase-execution-logs/phase-6.json` (atomically). Move on to Phase 7.
```

All "you MUST" / "be judicious" / "no phase deferrals" prose collapses into the cost-policy block at the top of the file + the structural verify-phase.py gate.

---

## 11. SKILL.md changes

Only three sections change:

### 11.1 Pipeline-at-a-glance table

Renumber per §3. Drop the "Parallelism" column repetition — keep it, but the phase numbers are integer-valued only.

### 11.2 Key rules — add the cost policy as a top-level rule

Insert directly after "**Atomic, never roll-up**":

```markdown
**Cost is not a constraint.** This skill runs on the user's Claude
Pro/Max token budget. The user has opted in to a full pipeline run.
Do not narrow vision calls, batch enrichment sub-prompts, or collapse
per-comment LLM dispatches. See pipeline.md "Cost & Vision Policy".
```

The existing "**No phase deferrals**" rule stays but trims its softening
language — "if vision is native to your model, use it" → "vision MUST run on every
kept page. Period."

### 11.3 Deliverables section

Add `scratch/phase-execution-logs/phase-N.json` to the layout. Add a one-liner pointing at `references/phase-contracts.md`.

---

## 12. Rollout — single PR plan

This PR lands as one atomic change. Order of operations within the PR:

1. **Add** `references/schemas/*.schema.json` (the contracts in machine form).
2. **Add** `references/phase-contracts.md` (the contracts in prose form, linking to schemas).
3. **Add** `scripts/verify-phase.py` (the gate).
4. **Modify** `pipeline.md` — shrink + renumber + cost policy at top.
5. **Modify** `SKILL.md` — pipeline table renumber + cost-policy key rule.
6. **Modify** `references/figure-extraction.md`, `references/decomposition.md`, `references/enrichment.md` — strip cost-softening language.
7. **Modify** `working-dir.md` — gen-dir layout reflects new `scratch/phase-execution-logs/` and renumbered phases.

### 12.1 Test plan (light — user will validate post-merge)

Single-test invocation: re-run the skill on the same 1700 S Lamar U0 MCR after the PR merges. Expected behavior:

- Phase 6 dispatches vision on all kept pages (~47); `phase-6.json.outputs.counts.pages_vision_detected == pages_kept`.
- Phase 7 dispatches `decompose-comment.md` once per kept parent (~181); `phase-7.json.outputs.counts.decompose_calls_dispatched == parents_in`.
- Phase 8 emits 5 enrichment files per dept; bureau-cache.json has > 0 sections; bureau_miss_rate ≤ 30%.
- Phase 10 emits `source-map.json` on first pass.
- Phase 12 cross-gen diff compares against gen-1..gen-4 and surfaces any regressions vs gen-1's 240/28/many baselines.
- Phase 13 enumerates every gen-dir file (incl. `mcr.pdf` and `figures/**.png`) in `manifest.json.uploaded_files`.

A `phase-{N}.json` file with `status: skipped` or a missing artifact halts the run at the next phase's verify step — that's the success-test for the gate.

---

## 13. Out of scope — next batches

Captured for the next round of design discussion. None of these block this PR.

| Item | Source | Note |
|---|---|---|
| Move deterministic phases (rasterize, pdftotext, file copy, source-map projection) into scripts the agent invokes, not performs | Q7 | "next batch of questions" — author and user agreed to defer |
| Sub-skill split (one prompt per phase, thin orchestrator) | Q8 | rejected for now in favor of conductor migration when it happens |
| Conductor migration (YAML-orchestrated workflow) | Q3 | "soon, yes" — discrete future PR |
| Resume support (`--force-restart`, skip-completed-phases on re-run) | Q12 | YAGNI |
| Blessed-baseline tracking (mark a gen as "this is good, compare against it") | Q11 | v2 follow-up on cross-gen diff |
| Headless / Inngest invocation (no AskUserQuestion available) | Q4 | not yet |
| MCP `storage_upload` enhancement at the Noetic MCP server (add `content_base64`) | Q16 | fixed in-skill via `curl` instead |
| Calibrate the soft-regression threshold (-20% on atomic items) against the next ~3 production runs | proposal §6 | adjustable constant in phase-contracts.md |

---

## 14. Open questions for the implementer

These are small enough to resolve during implementation rather than re-spec:

1. Should `phase-execution-log.schema.json` make `llm_calls[]` required, or keep it optional (some phases have no LLM calls)? **Default: optional.**
2. For Phase 13 binary uploads, retry on 5xx response? **Default: one retry with 2s backoff, then surface as error.**
3. For Phase 12 cross-gen diff, when reading prior `manifest.json` files, what if the prior file predates the `cost_disclosure` field? **Default: skip that prior gen from the comparison set; log to phase-12.warnings.**
4. `verify-phase.py` exit code 2 (degraded) — should the orchestrator call `AskUserQuestion` with a standard set of options (proceed / retry / abort) or phase-specific options? **Default: standard set, with a free-text "why" surfaced from the log's warnings array.**

---

End of spec.
