# CRC run payload draft — Lamar + Collier v4 (post short-id reprocess)

> **Status: DRAFT — not fired.** Purpose: re-run CRC over v4 now that all 57
> sheets are `short-id-ordered`, to test evidence-chip block deep-linking.
> Sent via the Noetic MCP `inngest_trigger` tool (`event_name: "workflow/run"`).

## Source we're mirroring

Most recent prior CRC run — review `d1ff47e7-…` (2026-06-30), workflow_run
`da0d8419-…`. Its recorded `inputs`:

```json
{
  "runs": 5,
  "model": "claude-sonnet-4-6",
  "projectId": "23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
  "maxWorkers": 24,
  "jurisdiction": "austin",
  "crcGenerationNumber": 6,
  "submissionVersionId": "6b9b85ed-e992-4906-a222-b24ee836910c",
  "crcGuidesSubmissionVersionId": "6b9b85ed-e992-4906-a222-b24ee836910c"
}
```

Note: **smoke-test mode** — `crcGuidesSubmissionVersionId == submissionVersionId`
(both v4). CRC guides were generated from v4's own MCR and run against v4's own
plans. Generation 6 is still the latest in the `crc-guides` bucket (gens 0–6
exist) and is fully populated (23 dept guides + manifest + mcr.pdf + figures).

---

## FINAL payload (operator choices applied 2026-07-09)

`runs: 5`, `maxWorkers: 35`, `model: claude-haiku-4-5-20251001`,
`runLabel: 2026-07-09-block-ids-run-1`. The `inngest_trigger` call:

```json
{
  "event_name": "workflow/run",
  "data": {
    "workflowName": "comment-resolution-check",
    "inputs": {
      "runs": 5,
      "model": "claude-haiku-4-5-20251001",
      "runLabel": "2026-07-09-block-ids-run-1",
      "projectId": "23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
      "maxWorkers": 35,
      "jurisdiction": "austin",
      "crcGenerationNumber": 6,
      "submissionVersionId": "6b9b85ed-e992-4906-a222-b24ee836910c",
      "crcGuidesSubmissionVersionId": "6b9b85ed-e992-4906-a222-b24ee836910c"
    }
  }
}
```

**`runLabel` is supported** (verified 2026-07-09): engine.ts reads
`inputs.runLabel`, validates `/^[a-zA-Z0-9_-]+$/` (our value passes), stamps
`process.env.RUN_LABEL` → Vercel gateway cost tags + merges into
`reviews.metadata.runLabel`. Not declared in workflow.yaml inputs but handled
generically at the engine level for all review-type workflows.

---

## Decisions to confirm before firing

1. **runs: 5 (mirror) vs 1 (lean).** ← main cost lever. Recommend **1** for a
   feature-verification run; use 5 only if you also want majority-vote output
   comparable to the 06-30 series.
2. **model → `claude-haiku-4-5-20251001` (changed from mirror).** The 06-30 run
   used `claude-sonnet-4-6`; we're overriding to Haiku 4.5. This exact string is
   the workflow's own `enrichmentModel` default and runs through the same Claude
   Agent SDK path (`query({ options: { model } })`), so it's proven-valid.
   **Caveat:** workflow.yaml recommends Sonnet for the review agent ("quality
   matters more than cost"); Haiku will lower review quality but is fine + cheap
   for a plumbing test of block-number deep-linking. Effort is ignored by Haiku.
3. **crcGenerationNumber: 6.** Latest + what 06-30 used. Omitting it auto-picks
   the highest (also 6) — kept explicit for reproducibility.
4. **smoke-test mode retained** (both IDs = v4). Correct for this test — we're
   checking v4's plans, and v4's blocks are what the chips must deep-link to.

## Defaults we're NOT overriding (inherit from workflow.yaml)

`departmentCode=crc`, `enrichComments=true`, `enrichmentModel=claude-haiku-4-5-20251001`,
`enrichmentMaxWorkers=50`, `uncertainThreshold=0.35` (only bites at runs≥3).

## Why this tests the feature

Conductor + bureau are cloned fresh from `main` into the sandbox, so the run
picks up #215 (scheme-aware downloader + block-manifest), #531 (gate), #532
(schema+prompt) automatically. The downloader will render `blocks.md` numbered
by `short_id` and emit `block-manifest.json` with `validBlockNumbers`; the
review agent cites blocks; chips land in `review_comments` with a validated
`blockNumber`; cityhall modal (#576) highlights them.
