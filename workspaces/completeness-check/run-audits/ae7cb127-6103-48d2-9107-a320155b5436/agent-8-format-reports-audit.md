# Agent 8 — `format-reports` step audit

**Review ID:** `ae7cb127-6103-48d2-9107-a320155b5436`  
**Step wall:** 2m 41s (2026-07-07T18:14:25.460Z → 18:17:06.989Z)  
**Verdict:** `HEALTHY WITH NOTES`

---

## Step purpose

Turn `output/enriched-findings.json` into the human-visible artifacts:

1. `output/completeness-check-consolidated-report.md` — one overview table + per-grouping tables.
2. `output/reports/<grouping-id>.md` — one detailed report per grouping (14 in this run).
3. `output/rephrased-items.json` — composite-keyed (`{grouping}:{itemId}`) map that downstream `build-review-comments` uses to stamp item titles onto DB rows.

The step does NOT populate the DB `reviews.summary` field — no `summary` key is emitted anywhere in `output/review-comments.json` (verified: `reviewData` has only `metadata`, `groupings`, etc.). The null value seen in `reviews.summary` in this run is therefore expected, not a bug.

## Wiring

Single agent cell, one LLM call — NOT per-grouping fan-out (`cc-run-output/workflow/workflow.yaml:272-275`):

```yaml
- name: format-reports
  agent:
    model: claude-sonnet-5
    prompt: format-reports.md
```

No `schema`, no `checklistItems`, no `maxWorkers`, no `retries`, no `output` binding — the log confirms `"Running single agent" ... "hasSchema":false` at line 30240 of `logs/completeness-check.log`. Model is Sonnet 5 (differs from the review model `claude-haiku-4-5-20251001`), consistent with the "one big authorship task" shape of the prompt.

Prompt: `cc-run-output/workflow/prompts/format-reports.md` (193 lines) — spec covers display-status rule (`consolidatedStatus ?? status`), authored-TSV title lookup with rephrasing fallback (§ "Sourcing Checklist Item Titles", lines 26-82), consolidated-report structure (lines 84-122), per-grouping detailed report structure (lines 125-159), and the composite-keyed `rephrased-items.json` (lines 162-181).

## What happened (evidence)

**Agent run stats** (from `logs/completeness-check.log` line 30294, `subtype:"success"`):

- `num_turns`: 20
- `duration_ms`: 160,784 (2m 40.8s — matches wall)
- `duration_api_ms`: 162,109
- `total_cost_usd`: $0.812
- `usage`: 29 fresh input tokens, **889.5k cache-read** (`cache_read_input_tokens`), 85.6k cache-creation, 13,997 output tokens. Prompt caching is doing real work.
- `is_error`: false

**Tool trace** (parsed from step-scoped log lines):

| Tool  | Calls | Notes |
|-------|------:|-------|
| Read  | 4 | 1× enriched-findings (**failed — 387KB > 256KB Read cap**), 1× cc-item-title-mappings.tsv, 1× consolidated report self-verification, 1× cc-21.md self-verification |
| Bash  | 14 | 12× python3 inline JSON exploration; 1× python3 generate_reports.py (the big write); 1× cleanup rm + ls |
| Write | 1 | `/vercel/sandbox/workspace/output/generate_reports.py` (script the agent wrote and then executed) |
| tool_errors | 2 | (a) Read hit 256KB cap on enriched-findings.json; (b) one python3 KeyError:0 while probing the top-level shape (data is dict, not list). Both recovered without retry storm. |

**Interesting authorship path:** the agent could not `Read` `enriched-findings.json` directly (387.3KB exceeds the 256KB Read cap), so it pivoted to writing a Python script (`generate_reports.py`), executing it via Bash to produce all 16 markdown files + the JSON in one shot, verified two outputs by Read, then deleted the script. This is why total wall was only 2m 41s despite one non-fan-out cell — the "loop" happens inside a Bash-executed Python script, not inside the LLM turn budget.

Agent's own final message (line 30294, `result` field, truncated in log): *"All three deliverables are in place: 1. Consolidated report... 2. Detailed reports for cc-{1,2,3,5,6,10,13,15,19,20,21,22,23,24}... 3. Rephrased items JSON..."* — clean self-report, no flagged anomalies.

## Coverage

- **14 grouping reports** in `output/reports/`: `cc-{1,2,3,5,6,10,13,15,19,20,21,22,23,24}.md`. Matches the 14 groupings in `enriched-findings.json`. **None missing, none extra, none empty.**
- **Consolidated report:** present (246 lines), well-formed.
- **rephrased-items.json:** 194 entries, all keys are composite `{grouping}:{itemId}` form (0 bare-ID keys), covering all 14 groupings. Composite-key hazard the brief flags is NOT present on this run.

Cross-verified titles: **all 194** rephrased-items entries match the authored TSV (`bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/cc-item-title-mappings.tsv`) **verbatim**. Zero on-the-fly rephrasing was triggered.

## Faithfulness

Per-grouping `**Status:**` counts programmatically cross-checked against `enriched-findings.json` (display status = `consolidatedStatus ?? status`):

| Grouping | Report `{pass, fail, warn, uncertain, N/A}` | Enriched `{pass, fail, warn, uncertain, N/A}` | Match |
|---|---|---|---|
| cc-1  | 22/0/1/0/10 | 22/0/1/0/10 | ✓ |
| cc-2  | 5/0/0/1/0 | 5/0/0/1/0 | ✓ |
| cc-3  | 9/0/0/0/2 | 9/0/0/0/2 | ✓ |
| cc-5  | 11/0/0/0/3 | 11/0/0/0/3 | ✓ |
| cc-6  | 3/0/0/0/0 | 3/0/0/0/0 | ✓ |
| cc-10 | 2/0/0/1/1 | 2/0/0/1/1 | ✓ |
| cc-13 | 27/0/1/6/3 | 27/0/1/6/3 | ✓ |
| cc-15 | 8/0/0/1/5 | 8/0/0/1/5 | ✓ |
| cc-19 | 2/0/0/0/20 | 2/0/0/0/20 | ✓ |
| cc-20 | 6/0/0/0/0 | 6/0/0/0/0 | ✓ |
| cc-21 | 2/1/0/1/6 | 2/1/0/1/6 | ✓ |
| cc-22 | 6/2/0/3/3 | 6/2/0/3/3 | ✓ |
| cc-23 | 4/1/0/3/3 | 4/1/0/3/3 | ✓ |
| cc-24 | 0/0/4/0/5 | 0/0/4/0/5 | ✓ |
| **Grand total** | **107/4/6/16/61** | **107/4/6/16/61** | ✓ |

Sample deep-checks:

- **cc-19** (Floodplain & RSMP): all 22 items in report match enriched-findings by ID, status, explanation string, and evidence. Blockquote summary is copied straight from `groupings[8].summary` (from enrich, not agent — audit note below).
- **cc-21** (Drainage Policy Compliance): `CC-21-01` correctly rendered as Uncertain with the mandated callout — *"Agent could not reach consensus. Tentative verdict: Fail — 3 fail / 1 warn / 1 pass across runs."* — which matches `voteBreakdown={pass:1,fail:3,warn:1,not-applicable:0,missing:0}` and `tentativeStatus=fail`. Missing-runs clause correctly omitted (missing=0). `CC-21-04` correctly rendered as `Fail`. Explanation and evidence strings match enriched-findings exactly. No hallucinated IDs or statuses in either sample.

## Consolidated tallies

Consolidated report header (line 22-24): *"Total items evaluated: 133 · Passed: 107 · Failed: 4 · Uncertain: 16"* — arithmetic: 107 + 4 + 6 (warn, not shown in header) + 16 = 133 + 61 N/A = **194** ✓. Matches DB `metadata.result_totals` (107/4/6/16/61).

Per-grouping metrics table (lines 26-41) also correct — spot-checked cc-21 (4 evaluated / 1 failure / 1 uncertain / 25.0% fail rate = 1/4) and cc-22 (11 / 2 / 3 / 18.2% = 2/11) ✓.

Overview marker column (checkmark / X / question mark) also correct — X for the three groupings with failures (cc-21, cc-22, cc-23), question mark for the four with only uncertain-and-no-fail (cc-2, cc-10, cc-13, cc-15), checkmarks elsewhere ✓.

## What went right

- Single agent cell finished in 2m 40s with no retry storm; only 2 tool errors, both self-recovered mid-turn.
- 14/14 grouping reports written, non-empty, faithful to enriched-findings.
- All 194 rephrased-items keys are composite; **zero bare-ID entries** — the known collision-hazard join point in build-review-comments is safe on this run.
- Titles sourced from authored TSV (100%) — no LLM rephrasing risk on this run at all.
- Consolidated totals match cross-run-consolidate + DB (107/4/6/16/61).
- Uncertain callouts render correctly per prompt spec (severity-ordered breakdown, missing-runs clause suppressed when zero).
- Prompt caching working (889k cache-read tokens on a 20-turn run).

## What went wrong

- **`enriched-findings.json` is 387KB, above the 256KB Read cap** (`cc-run-output/logs/completeness-check.log` line 30243 tool_result content: `"File content (387.3KB) exceeds maximum allowed size (256KB)"`). The agent recovered by writing a Python generator, but on a future run with a larger checklist / more evidence per finding this will keep tripping and increasing the number of exploration turns. Root cause is not the format-reports agent — it is that enrich-findings serialises to a single monolithic JSON with no size-based sharding.
- **Per-grouping `summary` blockquote is NOT authored by format-reports** — it's copied verbatim from `groupings[i].summary` in enriched-findings.json (which came from enrich-findings, which pulled it from a review-produced field). The cc-21 summary line says *"1 item fails"* although the display counts show 1 fail + 1 uncertain (tentative fail). This is a small "stale summary vs. table" gap the brief flagged — but the source is the review agent's per-grouping summary text, not the format-reports agent. Format-reports faithfully passes it through. Fixing it means either (a) regenerating summaries after cross-run-consolidate stamps `uncertain`, or (b) having format-reports rewrite the summary to reflect display statuses.
- **Warn totals not surfaced in consolidated header** (only pass / fail / uncertain per prompt spec). The 6 warns are visible in the per-grouping table via the ⚠ marker but a reader scanning only the top-line "Passed: 107 · Failed: 4 · Uncertain: 16" would miss that 6 items warned. Prompt lines 106-108 explicitly say to omit warns; this is a prompt design gap, not an agent bug.
- **One Bash python3 KeyError:0** while probing the top-level shape (agent assumed the JSON was a list). Cost 1 turn; self-corrected.
- **`generate_reports.py` intermediate script** — the agent wrote a python script into `output/` and cleaned it up at the end. If the step ever crashes mid-way (or if `rm` fails), the script would leak into the DB-persisted output tree. On this run it was cleaned (verified: no `generate_reports.py` in `output/`). But it is worth teaching the agent to write to `/tmp` instead of `output/`.

## Observability gaps & remediations

1. **Pre-render invariants (highest value).** Before build-review-comments consumes format-reports outputs, run a Python assertion pass:
   - `len(rephrased_items) == checklist_manifest_item_count` (would have caught fragmentation-era collisions).
   - Every key is composite (`":"` in key). Every key parses to a known `(grouping, itemId)` in the checklist manifest.
   - Per-grouping report status counts (regex on `**Status:**` lines) equal enriched-findings counts. (I ran this by hand above; belongs in the workflow.)
   - Consolidated header totals (`\*\*Total items evaluated:\*\* N`) equal `sum(display_status ≠ not-applicable)` in enriched-findings, and pass/fail/warn/uncertain in the header match. Currently the agent's own self-report is the only checkpoint.

2. **Enriched-findings size sentinel.** The 387KB Read failure was recovered gracefully, but a size assertion in `enrich-findings` (or an auto-shard-on-size rule) would eliminate the tool-error round-trip on every run.

3. **Warn-count in header.** Extend `prompts/format-reports.md` lines 106-108 to include warns in the "Passed / Failed / Uncertain" summary line (or add a fourth token) so downstream human readers do not miss ⚠ items.

4. **Grouping-summary regen after cross-run consolidate.** The cc-21 blockquote example ("1 item fails") is arithmetically consistent with `status` counts pre-consolidate but not with the displayed `consolidatedStatus`-adjusted table below it. Either regenerate `groupings[i].summary` inside enrich-findings after applying consolidated statuses, or have format-reports rewrite it.

5. **`summary` field on `reviews` never populated.** Confirmed via `output/review-comments.json`: no `reviewData.summary` key. If the DB column is meant to hold the consolidated-report top matter, either the format-reports agent needs to emit it, or `build-review-comments` needs to synthesize it from the consolidated markdown. Currently: silent no-op.

6. **Promote structured tool errors to step status.** The 2 tool_errors in this run were benign self-recoveries, but they surfaced only inside the JSONL log; `run-log.json` shows `"status":"completed"`. A `warnings` array on the step's run-log record (populated from `is_error:true` tool_results) would give the synthesis agent a cheaper anomaly signal than log-scraping.

7. **Prefer `/tmp` for agent scratch scripts** — teach format-reports to write `generate_reports.py` under `/tmp`, not `output/`, so a crashed run cannot leak scratch artifacts into the persisted output tree.

---

**Verdict:** `HEALTHY WITH NOTES` — the step produced correct, faithful, complete outputs with matching totals across all 14 groupings and the DB metadata. Notes are architectural (Read-cap workaround, missing warn-in-header, stale grouping summaries, absent `reviews.summary`, no scratch-location discipline) rather than run failures.
