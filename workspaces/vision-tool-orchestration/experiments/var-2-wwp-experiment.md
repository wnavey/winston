# var-2 wwp experiment — next runs to fire

Generalization test for the `vision_check` + `measure-distance` chain
against a non-electrical review guide. wwp (Austin Water utility
separation; UCM 2.9 / DCM 5.7 / TCEQ Ch. 217 + 290) was picked because
it's the closest problem-class analog to el-md-exp:
plan-view, point-to-point clearances between two named features (water
main ↔ wastewater main, vault ↔ utility, hydrant ↔ utility, etc.)
with code-stated thresholds in feet.

If var-2 lifts Goal B over var-1/ctrl on wwp the way it did on
el-md-exp, that's a generalization claim. If it doesn't, the iter-1
result is electrical-specific and the architecture story narrows.

## Setup notes

- **Submission**: `55fb6548-814f-4287-bc4a-6018b756d730` (Valley View
  Townhomes v1) — same as el-md-exp for a same-submission cross-guide
  read. Swap if a richer utility-plan submission shows up.
- **Guide**: production `wwp` review guides — no `wwp-md-exp` overlay
  exists yet. If the prod guide produces too much noise (UCM 2.9
  mixes plan-view horizontal items with profile-view vertical
  inches), the cleanest follow-up is a trimmed overlay scoped to
  horizontal items only.
- **runs=1** for the smoke fire. If both runs complete cleanly and
  the chain executes, scale to `runs=3` for headline metrics with
  majority-vote aggregation (matches the el-md-exp framework).
- **Why ctrl needs `reviewExtended` schema + `review-extended` prompt**:
  `logAllAgentTrace=true` silently produces no `agentTrace` fields on
  the production `review` schema. Without `agentTrace.tools_used`
  per finding, we can't attribute vision-tool calls to checklist
  items → Goal A on ctrl falls apart. This is the same fix that
  retired el-md-exp's `BASELINE_V2` for `BASELINE_V3` post-bureau#314.

## Commands

### Control (ctrl-baseline — generic vision only)

```
npm run conduct -- --workflow=review --jurisdiction=austin --submission-version-id=55fb6548-814f-4287-bc4a-6018b756d730 --guide-code=wwp --runs=1 --model=claude-haiku-4-5-20251001 --eval=false --log-all-agent-trace=true --review-schema-name=reviewExtended --review-prompt-name=review-extended --set-current=false --department-code=wwp --run-label=VISION_CHECK_REVIEW_WWP_BASELINE_LOCAL_1_RUN --guides-dir=jurisdictions/austin/review-guides/wwp --guide-label=wwp --step=review-runs
```

Drops vs. el-md-exp ctrl: nothing — same flag set, retargeted at the
wwp guide and department code. No `--experiment` overlay, no
`--enabled-vision-specialists` (agent has only `vision`).

### Variant 2 (vision_check classifier routing)

```
npm run conduct -- --workflow=review --jurisdiction=austin --submission-version-id=55fb6548-814f-4287-bc4a-6018b756d730 --guide-code=wwp --runs=1 --model=claude-haiku-4-5-20251001 --eval=false --log-all-agent-trace=true --review-schema-name=reviewExtended --review-prompt-name=review-extended --enabled-vision-specialists=generic-vision,measure-distance --set-current=false --department-code=wwp --experiment=vision-check --run-label=VISION_CHECK_REVIEW_WWP_VAR2_RUN_1_LOCAL_1_RUN --guides-dir=jurisdictions/austin/review-guides/wwp --guide-label=wwp --step=review-runs
```

Adds `--experiment=vision-check` and `--enabled-vision-specialists=generic-vision,measure-distance`.
Same `vision-check` overlay used in el-md-exp RUN_10.

## After the smoke runs

1. Spot-check `output/vision-check-calls/<callId>/metadata.json` —
   what's the classifier picking for items like "Water mains
   crossing wastewater requires ≥10 ft horizontal separation"? If
   the classifier never routes to `measurement`, the bureau
   `vision-router.md` prompt + few-shots need wwp-domain examples
   before headline numbers are meaningful.
2. If routing fires, check that `measure-distance-calls/` carries
   real distances. The chain was Goal-C 100% on el-md-exp post
   bureau#324 + conductor#153/#154 — wwp should inherit that, but
   confirm.
3. If both look healthy, build the expected-vision-selection TSV
   for wwp (analog to el-md-exp's `expected.tsv` lifted from
   `item-classification.json`) and re-fire at `runs=3` for
   majority-vote aggregation.

## Open questions for iter-1 wwp

- **Horizontal vs vertical mix.** UCM 2.9 distance rules split
  roughly half-and-half between plan-view horizontal feet and
  profile-view vertical inches. measure-distance is plan-view only.
  Either filter the expected.tsv to horizontal items, or build a
  `wwp-md-exp` overlay that scopes the checklist accordingly.
- **Hardcoded scale.** `scaleInchesPerFoot=0.05` (1"=20') is fine
  for typical utility plans but wwp may include detail sheets at
  other scales. Same caveat as el-md-exp — affects measurement
  accuracy, not routing.
- **Submission fit.** Valley View Townhomes v1 may not exercise the
  full wwp checklist (no large-diameter storm crossings, no
  trenchless utility crossings, etc.). If items return mostly
  `n/a`, the denominator for Goal B will be too small to be
  meaningful and a different submission is the right move.
