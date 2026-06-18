# `generate-crc-guides` — Design Spec

> **Status:** Draft, 2026-06-18. Iteration-1 of the [CRC spec](../SPEC.md) §4-A and §5.
> Drives implementation of the first of three CRC components: the Claude Code skill
> that turns an MCR PDF into per-department crc-guide markdown files.

---

## 1. Overview

**Purpose.** A Claude Code skill that turns a Master Comment Report PDF into per-department crc-guide markdown files, ready for the CRC Conductor workflow to verify against an updated plan set.

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

---

## 3. Pipeline

### Phase 0 — Resolve submission_version

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

**Approach:** `pdftotext` → LLM extraction pass over the text. Vision is *not* used in MVP.

1. Run `pdftotext -layout` on the MCR PDF to produce a text file in the skill's scratch dir.
2. Single LLM extraction pass that emits a structured JSON array of raw comments:

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

3. Save raw extraction to `scratch/raw-comments.json` for re-runs / debugging.

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

### Phase 6 — Decomposition

For each kept comment, apply CRC decomposition rules:

1. **Simple comment** → 1 atomic item.
2. **Compound English** ("provide A AND B AND C" / numbered list / multiple distinct sentences with distinct requirements) → split into N items.
3. **Vague code ref** ("comply with DCM 1.2.4.E" with no body text) → **read the code section from bureau** and emit 1 item per sub-requirement found. See §6 for bureau lookup details.

Each emitted item gets:

- `id`: `{DEPT}-{commentNumber}.{subIndex}` (subIndex = `1` for non-decomposed items)
- `parentComment`: `{DEPT} {commentNumber}`
- `requirement`: the verification statement (one sentence)
- `codeCitation`: copied from the parent comment; if Phase 6.3 decomposed via a code section, sub-citations are appended where available
- `severity`: inherited from parent
- `evidenceExpected`: short hint at where in the plan set this should appear (sheet type)
- `sourcePage`: from parent (for traceability)

### Phase 7 — HITL review batch

If anything landed in the HITL bucket during Phases 2–5, present them all as a single batched review to the user (see §4 for mechanism). For each item the user picks: `include` (and supplies missing data if needed) or `drop` (with optional reason). Decisions are appended to `decisions.md` (§7).

### Phase 8 — Emit guide files + ignored-comments report

1. Group items by department; for each department with ≥1 item, write `crc-{dept_lowercase_slug}.md` (see §5 for format).
2. Write `ignored-comments.md` (see §5.3).
3. Write `decisions.md` (HITL prompts + answers, for re-gen replay).
4. Write `manifest.json` summarizing the run (counts, inputs, timestamps stamped at execution time, NOT inferred).

### Phase 9 — Validation gate

Reconcile:

```
total_parsed == total_emitted_items_collapsed_to_parents
              + dropped_status + dropped_severity + dropped_not_verifiable
              + hitl_dropped
```

("collapsed to parents" because decomposition can multiply rows). If math doesn't add up, write a `VALIDATION-FAILED.md` and surface to the user — don't silently continue.

### Phase 10 — Supabase upload

Mirror the local generation directory to the `crc-guides` storage bucket at the same relative path. Implementation: `mcp__claude_ai_Supabase__storage_upload` (or whichever upload primitive is available).

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
~/noetic/comment-resolution-check/
  {projectUuid}/{submissionUuid}/{submissionVersionNumber}/
    {generation-number}/
      crc-sp.md
      crc-tpw.md
      crc-de.md
      ...
      ignored-comments.md
      decisions.md
      manifest.json
      scratch/
        raw-comments.json
        mcr.txt
```

`generation-number` = `max(existing) + 1`, starting at `0`.

### 5.2 Per-department guide format

```markdown
# CRC — {DEPT_FULL_NAME} ({DEPT_PREFIX}) — {project name} v{version_number}

## Description
Comment-resolution checks derived 1:1 from the U0 MCR comments assigned to {DEPT}.
Each item verifies whether the updated plan set resolves a specific city comment.

## Source
MCR: {mcr filename}. Items map 1:1 to atomic MCR issues.

## Checklist Items
| ID | Parent Comment | Requirement to verify resolved | Code Citation | Severity | Evidence expected |
|----|---------------|-------------------------------|---------------|----------|-------------------|
| TPW-6.1 | TPW 6 | On-street parking dimensioned ≥15 ft from either side of fire hydrants | TCM 9.2.3.1.B | required | Site plan / striping sheet |
```

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

## 6. Bureau access for vague-code-ref decomposition (Phase 6.3)

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

Lookup strategy when an MCR comment is *just* a citation:

1. Map the citation prefix to its bureau dir under `$NOETIC_WORKING_DIR/bureau/jurisdictions/austin/codes/{dir}/`.
2. Read the code's `README.md` to get the citation convention (DCM and likely others document their own — see `dcm/README.md`).
3. Walk `contents/Section N - Name/` folders to find the cited section. For DCM `1.2.4.E` → `Section 1 - Drainage Policy/.../1.2.4.E.md` (or whatever the naming convention turns out to be — discover at runtime via the README and a directory listing).
4. Read the section file. Use an LLM pass to identify sub-requirements (numbered/lettered enumeration, "shall" clauses).
5. Emit one atomic item per sub-requirement, each carrying the full sub-citation.

**Graceful failure.** If the code dir doesn't exist for a citation, or the section can't be located, emit 1 row with the original citation and log a note in `decisions.md`. Don't block the run.

`$NOETIC_WORKING_DIR` defaults to `~/noetic/` and can be overridden by env var.

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
    dept-prefix-dict.tsv                # prefix → department name
    code-dir-map.tsv                    # citation prefix → bureau code dir
    status-filter.md                    # status vocab + filter rules
    severity-classification.md          # LLM prompt + rules
    plan-verifiability.md               # LLM prompt + rules
    decomposition.md                    # decomposition rules + bureau lookup
    output-format.md                    # guide file format + ignored-comments format
    hitl-flow.md                        # batched HITL prompt mechanics
    supabase-lookup.md                  # SQL ladder + queries
  prompts/
    extract-comments.md                 # PDF text → structured comments
    classify-severity.md                # severity inference prompt
    judge-plan-verifiability.md         # yes/no/uncertain prompt
    decompose-comment.md                # compound English split prompt
    decompose-code-section.md           # vague code ref → sub-reqs prompt
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
- **MCR upload to Supabase** — the spec mentions MCR PDFs live "in winston" today. Should this skill *also* mirror the MCR itself to the `crc-guides` bucket alongside the guides (for self-contained reproducibility)? Default: yes, copy MCR PDF into the generation dir locally + upload to bucket.
