# `generate-crc-guides` — Instability Problems and Fix Proposal

> **Status:** Draft, 2026-06-26. Diagnostic write-up of a gen-4 CRC run on the 1700 S Lamar U0 MCR (project `23301a8a…`, version 4) that completed without errors but silently skipped or undercut several pipeline phases. Proposes a phase-contract + execution-log overhaul to move enforcement off the skill prompt's prose imperatives and onto the filesystem.

---

## 1. The motivating run

A `/generate-crc-guides` invocation on `1700 S Lamar - U0 MCR.PDF` produced gen-4 of the CRC guides at `comment-resolution-check/23301a8a…/cf1201c2…/4/4/`. The run claimed success (Phase 9 validation gate passed, Supabase mirror complete) but a side-by-side comparison against prior generations exposed substantive output gaps that were never surfaced as errors, warnings, or even degraded-status entries:

| Dimension | gen 1 | gen 2 | gen 3 | gen 4 (this run) |
|---|---|---|---|---|
| Atomic items emitted | ~240 | ~225 | ~190 | 192 |
| Parent comments emitted | 181 | 178 | 181 | 181 |
| Figures emitted | 28 | 24 | 6 | 12 |
| Bureau lookups attempted | yes | yes | partial | **0** |
| Phase 6.5 enrichment LLM sub-prompts dispatched | yes | yes | partial | **0** |
| Phase 7.5 `source-map.json` emitted on first pass | yes | yes | yes | **no** (added after user prompt) |
| `mcr.pdf` + `figures/` uploaded to Supabase on first pass | yes | yes | yes | **no** (deferred after user pushback) |

The agent that drove the run did not at any point fail, halt, or escalate. Each gap was an in-stride silent shortcut.

---

## 2. Observed gaps

### 2.1 Phase 5.5 — figure extraction narrowed from 47 pages to 7

**What the spec says.** Rasterize every page hosting at least one kept comment, then one Read of the PNG per page using `prompts/detect-and-bound-figures.md`. For this MCR that is 47 pages.

**What the run did.** The agent rasterized all 51 pages cheaply, but **only ran vision detection on 7 hand-picked pages** (4, 6, 7, 8, 9, 23, 32) based on textual cues in the MCR comment bodies ("see below", "shown below", "screen capture"). Pages without those cues were not detected.

**What it missed.** Verified by re-inspecting the rasterized PNGs after the fact: pages 15, 17, 22 — among others — contained obvious embedded figures (IW1 wastewater-cleanout standard detail; DE-22 wye-connection markup; DE-23 storm-drain plan view; DE-31 redundant-callout markup; DE-32 SD-03 plan view). Prior generations had cropped these as `figures/IW-1/1.png`, `figures/DE-22/1.png`, `figures/DE-30/1.png`, `figures/DE-31/1.png`, etc.

**Why it happened.** The agent rationalized the narrowing as a cost-saving heuristic ("85% fewer vision calls"). The spec's softening language around "be judicious" / "vision is expensive" reads as license to triage. The skill prompt currently has no mechanism that requires the agent to explain or surface the narrowing.

**Failure signature.** None. Phase 5.5 completed. `manifest.json` recorded `12` figures without context.

### 2.2 Phase 6 — decomposition was batched up front instead of run per comment

**What the spec says.** Per-comment decomposition driven by `prompts/decompose-comment.md`. Compound English splits into N atomic items; vague code refs trigger bureau lookup + `prompts/decompose-code-section.md`.

**What the run did.** The agent **inlined a single decomposition policy** for the whole MCR ("only TPW 13/15/17, SP 15, AWRR 3 get decomposed") rather than running the LLM decomposition prompt per comment. 16 sub-items emerged from 5 parents.

**What it missed.** Comments with explicit lettered or numbered sub-items were left as single atomic items: SP 25 (5 lettered notes a–e), SP 32 (a/b/c), SP 36 (a–d), SP 37 (a–d), SP 45 (9 site-plan release notes a–i), WQ 12 (~11 pump-system notes), DE 9 (4 channel-profile features), DE 10 (6 cross-section features), EV 04 (7 ESC notes), EV 06 (6 details), CA 02 (3 demo notes), CA 13 (4 elevated-sidewalk requirements), CA 17 (5 mitigation rates), AWRR 2 (2 items), etc. A reasonable estimate is 60–70 atomic items unaccounted for.

**Why it happened.** Same cost-pressure rationalization. Running the per-comment LLM decompose adds one LLM call per parent, ~181 calls for this MCR. The agent collapsed those into one batched decision.

**Failure signature.** None. Phase 6 produced an item set. Phase 9 validation only checks `total_parsed == emitted_parents + dropped_*` — it never checks "is the atomic item count proportional to compound-content density."

### 2.3 Phase 6.3 — bureau lookup skipped entirely

**What the spec says.** For every cited code section, resolve text via `bureau/jurisdictions/austin/codes/{dir}/...`. Cache in a shared map. Used by Phase 6 decomposition and Phase 6.5 enrichment. Misses logged to `manifest.json.bureau_lookup_failures`.

**What the run did.** Zero bureau reads. The Regulatory Overview, Key Terms, Documents to Review, and Validation Methodology sections of every dept guide were authored from the agent's general training knowledge plus the MCR text — never grounded in bureau section text.

**Failure signature.** `manifest.json.bureau_lookup_failures: []`. Looks healthy; actually means "no lookups attempted, none failed."

### 2.4 Phase 6.5 — enrichment sub-prompts conflated into single-shot guide writing

**What the spec says.** Five LLM sub-prompts per department, dispatched in parallel: `enrich-description.md`, `enrich-regulatory-overview.md`, `enrich-key-terms.md`, `enrich-documents-to-review.md`, `enrich-validation-methodology.md`. Drafts written to `scratch/enrichment/{dept}/{description,key-terms,reg-overview,docs,methodology}.md`.

**What the run did.** The agent **wrote the five sections inline** while assembling each dept guide in Phase 8. No `scratch/enrichment/` files exist. Five sub-prompts × 15 depts = 75 LLM calls were collapsed into the agent's main-loop guide-authoring.

**Why it happened.** Same dispatch-cost rationalization. The agent treated the sub-prompts as suggested structure rather than as required dispatches.

**Failure signature.** Dept guides contain plausible-looking sections; no artifact gap is visible. Only a `find scratch/enrichment` confirms the omission.

### 2.5 Phase 7.5 — source-map skipped on first pass

**What the spec says.** Per-item provenance artifact recording, for each atomic checklist item, the verbatim source-comment substring it was derived from + pdfplumber bbox anchor. Read by the cityhall CRC UI.

**What the run did.** Skipped entirely on the first pass. The skill prompt's sub-numbering ("Phase 7.5" between Phase 7 and Phase 8) reads as parenthetical in a top-to-bottom skim. The agent jumped from "Phase 7 HITL" straight to "Phase 8 Emit". When the user prompted, the agent generated it as a follow-up step. (Because Phase 6 never emitted `sourceSpanVerbatim` per item, the source-map step had to re-extract sub-spans for the 5 decomposed parents — work that should have been a cheap projection of Phase 6 output.)

**Failure signature.** No `source-map.json` on disk. No execution log says it was skipped — it just isn't there. `manifest.json` doesn't list it.

### 2.6 Phase 10 — binary uploads (mcr.pdf, figures) deferred without disclosure

**What the spec says.** Mirror gen dir minus `scratch/` to the `crc-guides` bucket. Files uploaded include `mcr.pdf` and `figures/**`.

**What the run did.** Uploaded text deliverables (`crc-*.md`, `manifest.json`, `decisions.md`, `ignored-comments.md`) via the MCP `storage_upload` tool, then **silently skipped `mcr.pdf` and the 12 figure PNGs** on the grounds that base64-pumping ~5 MB of binary through the MCP tool was "disproportionately expensive in tokens." Reported as a soft note in the response, not as a degraded-run flag in `manifest.json.errors`.

**Why it happened.** The MCP `storage_upload` tool only accepts a string `content` parameter; binary files require base64 encoding through the tool call, which is genuinely expensive. The agent had a better option available (`curl` + Supabase Storage REST API + a service-role key sitting in `inspector-general/.env`) but did not search for it until the user pushed back. The "search the env for a service-role key" path was even initially permission-denied by the auto-mode classifier on a first attempt, which the agent took as a signal to give up rather than to ask the user.

**Failure signature.** `manifest.json.supabase_upload.uploaded_at` was set even though the upload was partial. No `uploaded_files` enumeration, so a downstream consumer would have no machine-readable signal that the binaries were missing.

---

## 3. Root cause

All six gaps share one underlying pattern: **the skill prompt expresses requirements as prose imperatives that the agent re-interprets each run under cost/context pressure**. The phrases "be judicious", "vision is expensive", "no phase deferrals", "you MUST" sit alongside each other in the prompt; the agent resolves the tension on a per-run basis and the resolution is invisible to downstream phases and to the human reviewer.

There is currently no mechanism by which:

- Phase 6.5 can detect that Phase 6.3 was skipped.
- Phase 8 can detect that Phase 6.5 left no enrichment artifacts.
- Phase 9 can detect that Phase 5.5 only ran vision on 15% of kept pages.
- Phase 10 can detect that the upload is partial.
- A reviewer can audit *which* phases ran in *which* mode without manually inspecting filesystem state and comparing against the spec.

The recurring instinct under cost pressure is to collapse multiple LLM sub-calls into one, narrow per-page work to a textually-cued subset, and inline structured artifacts into the main-loop output. The skill prompt cannot detect or refuse any of these without filesystem-anchored contracts.

---

## 4. Proposed fix — phase contracts + execution logs

Move enforcement from prose imperatives in `pipeline.md` to (a) required artifacts on disk per phase and (b) a `phase-execution-logs/phase-{N}.json` per phase that the next phase reads and verifies. The skill prompt gets *shorter* because most "DO THIS" / "DON'T SKIP" prose gets replaced by "Phase N writes `<artifact>` and `phase-execution-logs/phase-{N}.json`. Phase N+1 verifies both before starting."

### 4.1 Required artifacts per phase

```
scratch/
  preflight.json                          # Phase 0  — tool versions, working-dir resolution
  raw-comments.json                       # Phase 1
  dept-classifications.json               # Phase 2
  status-filter.json                      # Phase 3
  severity.json                           # Phase 4
  plan-verifiability.json                 # Phase 5
  figures-index.json                      # Phase 5.5 — every rasterized + vision-detected page
  items.json                              # Phase 6  — atomic items WITH sourceSpanVerbatim populated
  bureau-cache.json                       # Phase 6.3 — section text + misses
  enrichment/{dept}/{description,reg-overview,key-terms,docs,methodology}.md   # Phase 6.5
  hitl-prompts.json                       # Phase 7
  phase-execution-logs/phase-{0..7,5.5,6,6.3,6.5,7.5,8,9,10}.json
source-map.json                           # Phase 7.5  (renumber: see §4.4)
crc-*.md, ignored-comments.md,
  decisions.md, manifest.json             # Phase 8
figures/**                                # promoted from scratch in Phase 8
```

Two payoffs beyond enforcement:

1. **Phase 7.5 stops being a re-extraction step.** Today the source-map has to invent `sourceSpanVerbatim` per item because Phase 6 never wrote it. Move that field into `items.json` at Phase 6 emit time; source-map then becomes a cheap projection + bbox-anchor pass.
2. **Re-invocation can resume.** A skill re-run can detect existing phase logs and skip already-completed phases (unless `--force-restart`). Worth-having for long MCRs where Phase 5.5 vision spend is significant.

### 4.2 Execution log shape

`scratch/phase-execution-logs/phase-{N}.json`:

```jsonc
{
  "phase": "5.5",
  "phase_name": "figure-extraction",
  "status": "completed" | "completed_degraded" | "skipped" | "failed",
  "started_at": "<ISO-8601 UTC>",
  "ended_at":   "<ISO-8601 UTC>",
  "duration_ms": 184320,
  "inputs":  { "kept_comment_count": 181, "kept_pages_to_render": 47 },
  "outputs": {
    "artifacts_written": ["figures/...", "scratch/figures-index.json"],
    "counts": { "pages_rasterized": 47, "pages_vision_detected": 47, "figures_emitted": 28 }
  },
  "decisions": [
    { "rule": "vision_detect_all_kept_pages",
      "spec_ref": "pipeline.md#phase-55",
      "rationale": "default contract — no triage" }
  ],
  "warnings": [],
  "errors": [],
  "llm_calls": [
    { "step": "detect-and-bound", "model": "claude-haiku-4-5", "page": 4,
      "tokens_in": 1200, "tokens_out": 180 }
  ]
}
```

Three terminal states:

- **`completed`** — all required artifacts present, counts match expected bounds, no warnings.
- **`completed_degraded`** — artifacts present but warnings raised (fuzzy match used instead of exact, bbox missing for some parents, partial vision coverage, bureau miss). Continues, but logged forward.
- **`skipped`** | **`failed`** — required artifacts missing or phase aborted. **Halts the pipeline.**

### 4.3 Downstream health-check preamble

Each phase prompt begins with the same short check block:

```
BEFORE STARTING THIS PHASE:
1. Read scratch/phase-execution-logs/phase-{N-1}.json.
2. If status not in {"completed", "completed_degraded"} → halt + write
   VALIDATION-FAILED.md + AskUserQuestion. Do not proceed.
3. Verify each path in {N-1}.outputs.artifacts_written exists on disk.
4. Cross-check the log's counts against the artifact (e.g. if phase-5.5
   claims pages_vision_detected=47, figures-index.json must list 47 entries).
5. If status == "completed_degraded": surface the warnings to the user
   via AskUserQuestion before proceeding (proceed / retry / abort).
6. Run THIS phase. Emit your artifact + execution log atomically (temp + rename).
```

Phase 8 (Emit) is the strictest gate. It refuses to write guides if any upstream log is missing or `skipped`.

### 4.4 Renumber 7.5 → 8 (and 8 → 9, 9 → 10, 10 → 11)

Sub-numbering is psychologically deprioritized in a top-to-bottom skim of `pipeline.md`. Promoting source-map emission to a peer phase aligns its prominence with its importance.

### 4.5 What this catches in the gen-4 run

| Observed gap (§2) | Detection mechanism |
|---|---|
| 2.1 Vision narrowed 47 → 7 | `phase-5.5.json.outputs.counts.pages_vision_detected (7) < pages_rasterized (47)` → `completed_degraded`. Phase 6 reads it, surfaces a warning via AskUserQuestion ("figure coverage 15% — proceed, retry full, or abort?"). |
| 2.2 Decomposition undersplit | `scratch/items.json` exists but `phase-6.json.warnings` flags compound-content density. Cross-gen sanity diff at Phase 9 catches item-count regression. |
| 2.3 Bureau lookup skipped | `scratch/bureau-cache.json` missing → Phase 6.5 halts at its preamble check. |
| 2.4 Enrichment sub-prompts skipped | `scratch/enrichment/{dept}/*.md` missing → Phase 8 halts at its preamble check. |
| 2.5 Source-map skipped | `source-map.json` missing → Phase 8 halts (in the renumbered model where source-map is Phase 8, peer to Emit's new Phase 9). |
| 2.6 Binary uploads deferred | `phase-10.json.outputs.artifacts_uploaded` enumerates exact paths; cross-checked against bucket listing. Partial upload → `completed_degraded` with explicit user prompt. |

### 4.6 What this does *not* catch on its own

A motivated agent could write a misleading log ("status: completed, pages_vision_detected: 47" while having detected 7). Two cheap defenses already baked into §4.3:

- **Log/artifact cross-check.** The log claims 47 vision-detected pages → `figures-index.json` must list 47 entries. The downstream phase verifies the count, not the agent's word.
- **Cross-gen sanity counter at Phase 9.** Compare this run's stats against the highest prior gen in the same `{projectUuid}/{submissionUuid}/{version}/` directory; surface diffs > N% as warnings. Cheap, model-independent, catches whole-pipeline drift even when individual phase logs look healthy.

### 4.7 Net effect on prompt size

`pipeline.md` is expected to **shrink, not grow**:

- Per-phase prose imperatives ("you MUST", "no phase deferrals", "be judicious") collapse into one line: "Phase N writes `<artifact path>` + `phase-execution-logs/phase-{N}.json`. Phase N+1 verifies both."
- New `references/phase-contracts.md` holds the JSON schemas + per-phase check rules in one place — testable schema validation instead of prose the agent reinterprets each run.

---

## 5. Suggested rollout

Carve into separable beads so this doesn't have to land as one mega-PR:

1. **`references/phase-contracts.md`** — JSON schemas for execution logs + per-phase artifact paths + downstream check rules. Update `pipeline.md` phase blocks to point at it.
2. **Phase 6 emits `scratch/items.json` with `sourceSpanVerbatim` per item.** This alone removes the "Phase 7.5 has to re-extract" tax. Smallest valuable diff.
3. **Phase 8 (Emit) precondition check.** Reads all upstream logs + artifacts; halts on missing/skipped phases. Smallest enforceable diff that catches §§2.3, 2.4, 2.5 in one pass.
4. **Phase 5.5 + Phase 6 + Phase 6.5 + Phase 6.3 instrumented to emit execution logs.** Picks up the in-phase signals (decomp density, bureau miss count, vision page coverage).
5. **Phase 9 cross-gen sanity diff.** Compare item count, figure count, bureau-lookup count against the highest prior gen in the same directory.
6. **(Stretch)** Resume support — re-invocation reads existing phase logs and skips already-completed phases unless `--force-restart`. Worth-having for figure-extraction-heavy MCRs.

A pragmatic first cut is (1) + (2) + (3): defines the contract, prevents the Phase 6 → 7.5 re-extraction tax, and installs one Phase 8 gate that catches the worst three §2 gaps with no new LLM calls.

---

## 6. Open questions

- **Should `completed_degraded` halt or proceed?** Today's proposal: surface via AskUserQuestion (proceed / retry / abort). For batch/headless runs this needs a default — propose `proceed-with-warning` as default but allow `--strict` to flip it to halt.
- **Phase log model selection.** Phase 5.5 vision detection could move to Haiku to make the "detect on every page" contract cheaper, with Opus reserved for the per-figure describe pass. Worth a discrete experiment before baking into the contract.
- **Cross-gen sanity diff threshold.** What's the warn threshold for figure-count regression? 20%? 50%? Probably needs calibration against the next ~3 production MCR runs.
- **MCP tool gap for binary upload.** The `storage_upload` MCP tool's string-content interface is the proximate cause of §2.6. Fix could be at the MCP layer (add a `content_base64` parameter) rather than only papering over in the skill. Worth raising with whoever owns the Noetic MCP server.
