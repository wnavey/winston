# Two-phase output for review agent steps — prose out of the session, constrained decoding into the pipeline

**Status:** Draft v1 — design proposal, not implementation-ready
**Date:** 2026-07-17
**Repos touched (if adopted):** `conductor` (step chaining or post-pass in the runner, direct Messages API call), `bureau` (CRC/CC review prompts + a structuring prompt/schema)
**Repos NOT touched:** `substation`, `cityhall`
**Context:** winston#178 (`../DESIGN-SPEC.md` + `../STRUCTURED-OUTPUT-RETRIES.md`), `../../bugs/STRUCT-OUTPUT-UNPARSED-EMIT-VARIANT.md`

## Problem

Review agent cells (CRC/CC, and the ensemble review workflow if run on sonnet) end a ~35-minute
evidence-gathering session by emitting a 6k–45k-char JSON payload through the agent SDK's
StructuredOutput tool. That coupling has three structural defects:

1. **The emit is probabilistic JSON.** The model types the JSON as raw tokens; unescaped `"` inch
   marks quoted from plan content make the whole emit unparseable (the game-day storm — 26 unparsed
   attempts, 2 cells burning all 5 in-session retries).
2. **A serialization failure costs an evidence-gathering session.** The only recovery past the SDK's
   retry budget is conductor's outer retry: a from-scratch ~35-min session. ~70 min of compute was
   discarded on game day for what was a one-character escape error.
3. **The fix layer is out of our hands.** The SDK's 5-attempt loop, its useless parse-error feedback,
   and its missing `strict: true` all live in the bundled CLI binary — no config in any released
   version (verified through 0.3.212), no patch point, no MCP side door (MCP tool inputs go through
   the same parse layer). Constrained decoding — which makes this failure class *impossible* — exists
   on the Messages API today, but the agent SDK doesn't use it and exposes no way to opt in.

Prompt mitigation (bureau#591, forbid literal inch marks) shipped 2026-07-16 and may well hold. This
proposal is the architectural fix if it doesn't — or if we want the failure class gone by
construction rather than by prompt compliance.

## Proposal

Split every review cell into two phases with different reliability profiles:

```
 PHASE 1 — review agent (sonnet, tools, ~35 min, expensive)
   same session as today, minus the StructuredOutput emit.
   Final deliverable: FINDINGS MARKDOWN — one `## <checklistItemId>` section
   per item (observation / reasoning / status / explanation / resolution /
   evidence locations as prose+fields). No JSON mechanics anywhere.
        │  findings.md per cell
        ▼
 PHASE 2 — structuring call (haiku, no tools, ~10 s, cheap)
   ONE direct Messages API call (plain @anthropic-ai/sdk, NOT the agent SDK):
   markdown in → output_config.format = crc emit schema (strict subset)
   → grammar-constrained sampling → schema-valid JSON, guaranteed at the
   token level. messages.parse() hands back the validated object.
        │  findings JSON per cell
        ▼
 DETERMINISTIC GATE (conductor code, not a model)
   - full checklistItemId coverage vs the guide's item list (no drops, no inventions)
   - ajv against the strict canonical schema (unchanged crc.schema.json)
   - existing normalize/inject-grouping path unchanged
   fail → retry PHASE 2 only (seconds, pennies); never re-runs phase 1
```

Key properties:

- **Serialization can no longer kill a session.** Phase 1 has no output-format failure mode; phase 2
  failures retry in seconds. The outer fresh-session restart disappears for this failure class.
- **Constrained decoding today, no upstream dependency.** Structured outputs (`output_config.format`
  / strict) is a Messages API feature; conductor calls the API directly in phase 2. The CRC emit
  schema already qualifies for the strict subset (zero unsupported keywords; needs only
  `additionalProperties: false` added).
- **The agent writes in its natural modality.** Inch marks in markdown are just characters. This
  also removes the bureau#591 prompt rule's reason to exist (keep it anyway as belt).
- **Precedent in-repo:** the CRC enrichment fan-out (steps 3.5a–c) is already a
  prepare → per-item model call → collect chain with `continueOnFailure` + null-fill; phase 2 is the
  same shape.

## Trade-offs

| | Gain | Cost |
|---|---|---|
| Correctness | Syntax guaranteed by grammar, not prompt compliance | **New lossy hop**: the structurer can mismap an item ID, merge findings, or paraphrase evidence — hence the deterministic gate is load-bearing, not optional |
| Cost/latency | Storm compute (~70 min/run worst observed) eliminated | +1 haiku call per cell (~120/run over ~30k chars each) — noise next to the sessions |
| Failure blast radius | Serialization failures cost seconds, not sessions | The markdown needs a light format contract (`## <itemId>` sections) — the format problem moves up a level, where violations are cheap to catch |
| Coupling | Emit reliability decoupled from model choice (sonnet's verbatim-quoting habit stops mattering) | Real conductor + bureau changes vs. bureau#591 which already shipped and may suffice |
| Fidelity | — | Two model passes over the evidence text instead of one; verbatim citations could drift in the retell. Mitigation: instruct phase 2 to copy field text verbatim, transform structure only |

Trade-offs of constrained decoding itself (acceptable here): strict-subset schema only (ours
qualifies), one-time schema compile latency (24 h cache; irrelevant at 120 cells/run), grammar
guarantees syntax not semantics (a cornered model produces well-formed-but-clipped output instead of
a parse error — strictly better for us).

## Alternatives considered

1. **Do nothing / trust bureau#591** — cheapest; measure first (see TODOs). This proposal is the
   contingency, not necessarily the next PR.
2. **Upstream SDK fix** (`strict: true` on the synthesized StructuredOutput tool; parse-error
   position in feedback; full `raw` on the sentinel) — the cleanest fix for the *current*
   architecture, but blocked on Anthropic accepting and shipping it. File it regardless; if it lands,
   phases stay merged and this proposal is mooted for correctness (though not for the blast-radius
   argument in defect #2).
3. **Conductor-side salvage (jsonrepair in `tryRepairStructuredOutput`)** — blocked today by the
   sentinel's ~2k `raw` truncation; only viable after upstream change, at which point option 2 is
   available anyway.
4. **MCP `submit_findings` tool with in-handler validation** — doesn't work: invalid JSON tool input
   dies in the same CLI parse layer before the handler runs, and MCP has no strict passthrough.

## Research / TODOs (pre-decision)

- [ ] **Measure first**: next sonnet-class CRC run — `coercion_failed` count and `unparsed_attempt`
      trend (conductor#229 event). If #591 holds at ≈0, park this proposal.
- [ ] **File the upstream SDK issue** (option 2) regardless — small ask, fast-shipping SDK, benefits
      every schema-bearing step.
- [ ] **Fidelity spike**: take 5 real findings-rich cells from run `ed5e7ba9`, hand-write the phase-1
      markdown equivalent, run phase 2 with haiku + `messages.parse()`, and diff against the actual
      emitted JSON — measure ID coverage, verbatim-citation drift, status fidelity. This is the
      go/no-go experiment.
- [ ] **Conductor mechanism decision**: (a) two chained workflow steps (agent step writing markdown
      output + a new fan-out "structuring" step type calling the Messages API directly), vs (b) a
      runner-level post-pass inside the existing agent step (session ends → runner makes the parse
      call before writing the output file). (b) keeps workflow.yamls unchanged; (a) is more
      observable and matches the enrichment-chain precedent.
- [ ] **How does phase 1 deliver the markdown?** Agent's final text vs. writing a file via a tool —
      final-text is simplest (runner already has it) but check size limits on very large cells
      (crc-DE-1 ≈ 45k chars).
- [ ] **Schema edit**: add `additionalProperties: false` throughout `crc.emit.schema.json` (and CC's)
      for strict-subset eligibility; confirm `evidenceLocations` numeric fields survive without
      `minimum` constraints (they have none today).
- [ ] **Vote-variance check**: does the two-pass retell change consolidated verdicts? Run a 1-guide
      A/B (same session transcripts, both output paths) before committing all 24 guides.

## Open questions

- **Q1** — Scope: CRC only, or CRC + CC (same failure exposure, same prompt family) + the ensemble
  review workflow (haiku today, but accepts a `model` input)? Leaning: build generically in
  conductor, adopt per-workflow.
- **Q2** — Phase-2 model: haiku for cost, or same-model-as-review for fidelity? The fidelity spike
  should answer this.
- **Q3** — On a phase-2 gate failure after N retries, what's the cell's terminal state — fail the
  run (today's posture) or emit a marked-degraded findings file and continue (the enrichment
  pattern)? Interacts with DESIGN-SPEC Q1 (no `continueOnFailure` on review).
- **Q4** — Should phase 2 be allowed to consult the guide file (for item IDs/titles) in addition to
  the markdown, or is the markdown the sole input? Sole-input is cleaner for the lossy-hop audit;
  guide-in-context probably improves ID mapping.
