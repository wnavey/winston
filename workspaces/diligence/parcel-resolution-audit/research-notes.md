# Parcel Resolution Pipeline — Research Notes

Read-only trace of how parcel IDs flow through the diligence-report pipeline,
grounded in the `atlanta-grocery-run-2` artifacts and the upstream skill /
surveyor source. All file:line citations are absolute paths.

The run input asserted **one** PIN, `17 00950004067`, against an address —
`4279 Roswell Rd NE, Atlanta GA`. The pipeline accepted "single parcel" with
high confidence, then a downstream coverage gate failed on a regex bug. The
user now says the site is actually a **3-parcel** assemblage; this audit
traces every place that assumption was made or could have been challenged.

## 1. Input ingestion

### Where the user's input enters

- Input prompt: `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/inputs/input-prompt.txt:4`
  contains the only customer-supplied PIN reference:
  `4279 Roswell Rd NE, Atlanta, GA 30342 (PIN# 17 00950004067)`.
- The skill's documented input contract is in
  `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/SKILL.md:22-26`:
  > Required: **Parcel(s)** — address, APN, or geometry. **One parcel or
  > several being combined.**

### How Phase 0 is supposed to parse the prompt

There is **no dedicated input-prompt parser**. Parsing is done inline by the
Phase 0 agent under guidance from:

- `pipeline.md:14` — *"Parse parcel(s) and intended use from user input"* (one
  bullet, no detail)
- `prompts/seed-site-data.md:20` —
  `**Parcel(s):** <APN(s), comma-separated if multiple>` (output template only)
- `prompts/jurisdiction-detection.md:25-44` — sets jurisdiction; says nothing
  about parcels.
- `references/subject-location-gate.md:9-10` — says "the subject **address**
  (and any APN) from the user" and "any **customer-supplied geocode / map
  pin** (a lat/lon, a Google Maps link, a dropped pin)". The gate treats
  *pin* as a **lat/lon**, not an APN. Nowhere in this reference is a
  customer-supplied APN reconciled in a structured way against the
  authoritative parcel.

There is no explicit prompt-pattern for `PIN#`, `APN`, `Parcel ID`, etc.
There is no schema for the Phase 0 manifest's `customer_supplied_pin` field
that distinguishes "lat/lon pin" from "APN/PIN identifier".

### What the skill does with one PIN / multiple PINs / zero PINs

| Input shape | What the skill says to do | Where |
|---|---|---|
| Zero PINs (address only) | OK — supported; SIR is produced w/o §9 | `SKILL.md:23-32`, `pipeline.md:14` |
| One PIN | Assumed single-parcel by default | `prompts/seed-site-data.md:37` says *"For a single-parcel site, use a single bullet"* |
| Multiple PINs | Comma-separated; one bullet per parcel | `prompts/seed-site-data.md:20,30-35`; `prompts/seed-site-data.md:102` escalates *only* "if multiple parcels and you can't tell if they're being combined or evaluated separately" |
| Multiple jurisdictions | Escalate to user; "diligence will need separate sub-runs" | `prompts/jurisdiction-detection.md:31`, `references/jurisdiction-detection.md:31` |

**No prompt instructs the agent to ask the user whether a single-PIN input
might actually be a multi-parcel site.** The escalation rule
(`seed-site-data.md:102`) only fires if multiple PINs are supplied *and*
ambiguous.

### The `customer_supplied_pin: null` defect

`atlanta-grocery-run-2/run-manifest/phase0.json:36` records:
```json
"customer_supplied_pin": null,
"reconciliation": "no-customer-pin",
```
…even though `inputs/input-prompt.txt:4` literally says `PIN# 17 00950004067`.

Reason this happens (verified, no code change):
- The `customer_supplied_pin` field in `run-manifest.md:122` is **typed as a
  `{lat,lon}` object**: `"customer_supplied_pin": { "lat": 30.4203, "lon": -97.7419 }`.
- The subject-location gate (`references/subject-location-gate.md:36-53`)
  only knows how to reconcile **coordinates**, not parcel-ID strings.
- The PIN# in the prompt is a parcel-ID alias, not a coordinate. The Phase 0
  agent correctly preserved it in narrative form in seed-site-data.md
  (lines 12, 45 — "Customer-supplied 13-digit `17 00950004067` is the
  LOWPARCELI alias..."), but had no slot in the structured manifest, so the
  field went `null`.

The audit summary at
`diligence/atlanta-grocery-run-2/audit/multi-agent-audit-summary.md:125`
files this as **B3 — MED: Phase 0 input-prompt PIN parsing**:
> `phase0.json` records `customer_supplied_pin: null` despite the input
> prompt containing `PIN# 17 00950004067`.

## 2. Phase 0 → seed-site-data.md

### How "single parcel" was decided

The decision was reached in the Phase 0 agent's free-form reasoning, not a
codified gate. The chain of evidence is in `seed-site-data.md` and
`phase0.json`:

1. **GIS address search returned exactly one feature.** Authoritative source
   (`seed-site-data.md:43`):
   > Address search "4279 ROSWELL" returned exactly one feature (ParcelID 17
   > 009500040675); centroid computed from WGS84 outFields=*, outSR=4326
   > ring geometry via shoelace formula.
   The single-feature result is also recorded in
   `phase0.json:16` — *"address-search returned one parcel"*.
2. **The PIN matched a 14-digit alias.** `seed-site-data.md:12,45`:
   > Customer-supplied 13-digit "17 00950004067" is the LOWPARCELI alias and
   > resolves to this same parcel — confirmed via Atlanta Special
   > Administrative Permit record SAP-12-030 which carries both forms.
3. **The single-parcel conclusion is asserted on `seed-site-data.md:12`** as
   the only bullet under `## Canonical Parcel IDs`:
   > - 17 009500040675 — Chastain Square anchor parcel, 4279 Roswell Rd NE
   > (single-parcel site; full 14-digit Fulton canonical form. ...)

### What would happen if GIS returned multiple parcels

**No code path exists for this**. There is:

- No documented branch in `pipeline.md`, `references/subject-location-gate.md`,
  or `prompts/seed-site-data.md` for "address search returned N parcels".
- No structured manifest field for "N parcels returned by authoritative
  source"; only one parcel ID is recorded in
  `references/run-manifest.md:120` (`"parcel_id": "0123456789"` — string,
  singular).
- `references/subject-location-gate.md:41-42` only contemplates two
  *coordinates* disagreeing by >150–250 m, OR "different parcels"
  *between an authoritative and customer-supplied coord*. Nothing about
  authoritative search itself returning multiple polygons.

The closest written escalation is `prompts/seed-site-data.md:102` —
*"if multiple parcels and you can't tell if they're being combined or
evaluated separately"* — and even that fires only when the **user** has
supplied multiple parcels; not when the assessor returns multiple.

### The "Open Questions" question that was auto-answered

`seed-site-data.md:70` contains the line you flagged:
> **Combined-parcel scenarios:** Concept references "attached shops to the
> south" — confirm whether all affected buildings sit on this single parcel
> 17 009500040675 (assessor record shows it as a single 7.38-acre parcel)
> or whether the inline shops are on adjoining parcels that need to be
> added to the diligence.

The question was correctly *identified* by the Phase 0 agent, written into
the file under `## Open Questions for the User`, then the pipeline
**continued without waiting for an answer**:

- The skill is documented to surface this section to the user
  (`prompts/seed-site-data.md:90`: *"The orchestrator will surface to the
  user"*), but the pipeline has no blocking gate that actually pauses on
  it. The only blocking gate in Phase 0 is the **subject-location**
  reconciliation gate (`references/subject-location-gate.md:39-51`),
  which keys off coordinate distance.
- `pipeline.md:24` lists STOP conditions as: customer pin > ~150-250 m from
  authoritative parcel, OR different parcels / different jurisdictions
  *between the customer pin and the authoritative point*. Multi-parcel
  ambiguity does not trigger a STOP.
- Phase 0's manifest emits `status: "completed"` once jurisdiction and
  subject-coordinate are confirmed; Open Questions are observational.

In this run, the auto-answer is implicit in `seed-site-data.md:12`'s "(single-parcel site...)" assertion and was carried forward through every Phase 2/3 file.

## 3. Surveyor seed (site-plan-data.md)

### Who writes `intermediate/site-plan-data.md`

The diligence skill writes `seed-site-data.md` at the diligence-run root.
The surveyor CLI then **copies it byte-for-byte** to its workspace's
`intermediate/site-plan-data.md`:

- Invocation contract:
  `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/invoke-surveyor.md:14-25` —
  `npx tsx src/cli.ts run --seed-file "${NOETIC_DILIGENCE_DIR}"/seed-site-data.md ...`
- Copy implementation:
  `/Users/wnavey/noetic/surveyor/src/cli.ts:266-270`:
  ```ts
  if (opts.seedFile) {
    // Seed mode — skip Phase 1, copy seed file directly
    const seedPath = path.resolve(opts.seedFile);
    console.log(`Using seed file: ${seedPath}`);
    fs.copyFileSync(seedPath, sitePlanDataFile);
    console.log('Phase 1 skipped (seed mode).');
  }
  ```

Verification: `diligence/atlanta-grocery-run-2/seed-site-data.md` and
`surveyor/workspaces/atlanta-grocery-run-2/intermediate/site-plan-data.md`
are textually identical. Both list a single bullet under
`## Canonical Parcel IDs` at line 12.

### What happens if the user later says "there are 3 parcels"

**No update path exists.** The flow is one-way:

- The seed file is a Phase 0 artifact. Phase 1-5 only *read* it.
- There is no documented protocol in `pipeline.md` or `working-dir.md` for
  amending the parcel list after Phase 0.
- The closest mechanism is the gap-recovery loop in Phase 4
  (`references/synthesis-and-gap-recovery.md`), but its three buckets
  (A: re-spawn subagent; B: external; C: concept-plan ambiguity) do not
  include "the parcel set itself was wrong". Bucket C
  (`references/synthesis-and-gap-recovery.md:78-80`) flags concept-plan
  ambiguity but only as text in §9, never as a parcel-list amendment.
- A new parcel set requires re-running from Phase 0 (or surgically editing
  `seed-site-data.md` and re-invoking the surveyor + downstream phases).
  The `working-dir.md:117-122` "resume" logic detects existing runs but
  doesn't recompose the seed.

## 4. Surveyor's parcel reader

### `surveyor/src/lib/parcels.ts` contract

**Input:** path to `intermediate/site-plan-data.md`.
**Output:** `ReadParcelIdsResult { ok, parcelIds: string[], warnings?, error? }`.

Primary parse: lines under a heading literally matching the regex at
`surveyor/src/lib/parcels.ts:28`:

```ts
const SECTION_HEADER_RE = /^##\s+Canonical\s+Parcel\s+IDs\s*$/i;
```

Bullet extraction at `surveyor/src/lib/parcels.ts:29`:

```ts
const BULLET_RE = /^[-*]\s+(\S+)/;
```

**This is the load-bearing bug.** `(\S+)` captures the first
whitespace-delimited token only. Given the diligence skill's documented
seed format (`prompts/seed-site-data.md:27`):
> The bullet's **first whitespace-delimited token** (after the leading `-`)
> is the canonical parcel identifier

the parser is *technically consistent with the seed contract*. But for
jurisdictions whose canonical PIN format **contains whitespace** (Georgia
GSCCCA uses `<2-digit county> <12-digit body>`), the seed-author agent
naturally writes the canonical 14-digit form with the embedded space —
mirroring how Fulton CAMA and Atlanta DPCD return it. The reader then
truncates to "17".

Verified in this run:
- Seed line: `- 17 009500040675 — Chastain Square anchor parcel, 4279 Roswell Rd NE (single-parcel site; ...)`
  (`surveyor/workspaces/atlanta-grocery-run-2/intermediate/site-plan-data.md:12`)
- Gate's `required` list parcel-id field: `"17"` (audit
  `multi-agent-audit-summary.md:107`: *"gate's expected set is keyed on
  `\"17:<doc-type>\"`"*).
- Agent's `attempted` log:
  `surveyor/workspaces/atlanta-grocery-run-2/intermediate/document-search-log.jsonl`
  rows 1–N all carry `"parcel_id":"17 009500040675"`.
- The two sets never intersect → 100 % missing pairs after every recovery
  pass.

Other parts of `parcels.ts`:

- `surveyor/src/lib/parcels.ts:60-82` — `readBulletSection`: terminates at
  the next `#`–`######` heading.
- `surveyor/src/lib/parcels.ts:76` — strips trailing em-dash from the
  captured token (so `- 17 — narrative` would yield `"17"`, dropping the
  em-dash but not recovering the rest).
- `surveyor/src/lib/parcels.ts:84-109` — `extractIdsFromParcelLine`:
  fallback parser for the narrative `**Parcel(s):**` line. Prefers bolded
  tokens, else extracts whitespace/comma-separated tokens with at least one
  digit and length ≥ 4. **This fallback would have correctly captured
  `17 009500040675`** as `["17", "009500040675"]` (because the bold/digit
  filter does include the 12-digit body as its own token after the space
  split), but the fallback only fires when the dedicated section is
  missing or empty (`parcels.ts:141-154`).
- `surveyor/src/lib/parcels.ts:134-169` — `readParcelIds`: top-level
  contract; on failure of both paths emits an explicit `error` (no parcels,
  hard fail downstream).

### `surveyor/src/cli.ts` Phase 2.5 coverage gate

Gate body: `surveyor/src/cli.ts:483-576`.

Key steps:
- `cli.ts:485` — gate runs only in `--mode diligence` with a doc-search log
  path set.
- `cli.ts:487-491` — reads `intermediate/site-plan-data.md`; hard-throws
  with `Document-search gate cannot run: <error>` if `readParcelIds` fails.
- `cli.ts:492-496` — builds `required: { parcel_id, doc_type }[]` as
  Cartesian product of `parcels × REQUIRED_DOC_TYPES_DILIGENCE`.
- `cli.ts:498-506` — `readMissing()` reads
  `intermediate/document-search-log.jsonl` via `readAttempts()`
  (`surveyor/src/lib/document-search-log.ts:79-96`), builds a Set keyed
  `"${parcel_id}:${doc_type}"`, returns the unattempted subset.
- `cli.ts:508-552` — `runDocSearchRecovery(pass, missingPairs)` renders
  one of two recovery-prompt templates (interpolates the missing list
  using the broken parcel_id) and spawns a Claude subagent.
- `cli.ts:554-575` — main loop: up to **2 recovery passes**, then a hard
  throw at `cli.ts:569-573`:
  ```ts
  if (missing.length > 0) {
    const pairsStr = missing.map((p) => `${p.parcel_id}:${p.doc_type}`).join(', ');
    throw new Error(
      `Document-search gate failed after ${recoveryPasses} recovery pass(es). Missing (parcel × doc-type) pairs: ${pairsStr}`,
    );
  }
  ```
  This is the line referenced in the run's audit
  (`multi-agent-audit-summary.md:110`) — *"Surveyor throws at
  `src/cli.ts:571` with `Missing pairs: 17:MORTGAGE, …`"*.

### What should happen vs what does happen for N parcels

If parcels were `["17 009500040675", "17 009500040676", "17 009500040677"]`
(3-parcel assemblage):

- **Should:** 3 × 12 doc-types = 36 required pairs; surveyor agent logs at
  least one attempt per pair; gate passes (or recovery resolves remainder).
- **Actually (with current parser):** Reader yields `["17"]` regardless
  (only the first bullet's first token survives, and even the second/third
  bullets each collapse to `"17"`; `readBulletSection` returns them in
  insertion order but the surrounding code in `cli.ts:492` flatMaps them
  with no dedup, so `required` would have 3 × 12 pairs all keyed `"17"`).
  Agent logs `"17 009500040675"` / `"...0676"` / `"...0677"` → still zero
  overlap → hard-fail at `cli.ts:571`.

### `log_document_search_attempt` schema

- Tool definition: `surveyor/src/lib/document-search-log.ts:200-246`.
- `parcel_id` is declared free-form string
  (`document-search-log.ts:207`: *"Canonical parcel ID (matches an entry
  in site-plan-data.md 'Canonical Parcel IDs' section)."*) — **no
  validation that the value actually matches a parcel in the seed**.

## 5. Downstream consumers of the parcel list

### Phase 2 — research subagents

| Subagent | Reads parcel list? | Cite |
|---|---|---|
| Property records (surveyor) | YES — via seed copy | `prompts/invoke-surveyor.md:23` (passes `--seed-file`) |
| Restrictive covenants | YES — for "burdens this parcel?" determination | `prompts/research-restrictive-covenants.md:9,17,25,43,45,57,60,71` |
| Environmental | YES — but uses centroid not polygon | `prompts/research-environmental.md:4` |
| Submarket | YES — for 1-mi / 3-mi / 5-mi radii from "parcel centroid" | `prompts/research-submarket.md:9,17,40,105` |
| Zoning pathway | Reads parcel context, scans recent ordinances "for this parcel" | `prompts/research-zoning-pathway.md:18,26,58` |
| Neighborhood plan, programs, transportation, web-followups | Read seed for context, no parcel-list dependency beyond identity | (no parcel-explicit prompt) |

The restrictive-covenants subagent is the most parcel-list-sensitive
because it disambiguates "burdens Lot A vs Lot B/C/D"
(`prompts/research-restrictive-covenants.md:25,71-73`). With only Lot A
(parcel 1 of 3) provided, encumbrances on Lots B/C would be discarded as
non-burdening.

### Phase 3 — disciplines

The 10 disciplines read `seed-site-data.md` + the Phase 2 outputs. None
key calculations off **parcel count** directly, but several scale to
**parcel area / acreage**:

- `eptp` (tree recompense): explicitly computes per-acre cap against parcel
  area —
  `diligence/atlanta-grocery-run-2/sir/phase3-disciplines/eptp.md:12,27,140` —
  *"Worst-case exposure if every on-site tree is removed and no on-site
  replanting credit is taken: ~$258k (7.38 ac × $35k/ac cap) or ~$336k
  (9.60 drawn ac × $35k/ac cap)"*. Cap mis-sizes if assemblage acreage is
  used vs assessor.
- `park` (impact fees): rate is per "functional population" scaled by
  service area, which depends on which parcel(s) the dev sits on
  (`bureau/jurisdictions/atlanta/feasibility-guides/park.md:24,76`).
- `wwp`: capacity / service eligibility per-parcel
  (`bureau/jurisdictions/atlanta/feasibility-guides/wwp.md:30,57,86`).
- `zlu`: transitional-height-plane § 16-11.006(2)(b)(i) measured from "the
  common property line with a protected district"
  (`sir/phase2-research/zoning-pathway.md:127`). With a 3-parcel
  assemblage, *internal* lot lines may or may not survive a Unified
  Development Plan
  (`bureau/jurisdictions/atlanta/feasibility-guides/sduf.md:36`,
  `sir/phase2-research/zoning-pathway.md:313`).
- `sduf` mentions UDP (Unified Development Plan) for multi-parcel/phased
  projects: `feasibility-guides/sduf.md:36`.

### Cross-checks that DID exist

A real cross-check fired in this run (correctly), in Phase 1 vision:

- `diligence/atlanta-grocery-run-2/sir/phase1-extraction/concept-plan-data.md:29,45,135` —
  concept-plan title block says **9.60 ac (418,169 SF) "as drawn on
  sheet"**, vs Fulton assessor's **7.38 ac (321,473 SF)**. Phase 1
  explicitly logged:
  > Three plausible explanations: (a) the concept plan covers an
  > assemblage that includes ROW or adjacent parcels not in the subject
  > parcel polygon; (b) the engineer is using a metes-and-bounds figure
  > that differs from the assessor; (c) the sheet erroneously includes
  > adjoining parcels (e.g., "1907 area" retention or a neighboring
  > strip). **Phase 2/3 to confirm whether the redevelopment touches
  > parcels other than `17 009500040675`.**

This check is documented as a checklist item (concept-plan-data.md:135).
It surfaced consistently through:
- `sir/phase2-research/environmental.md:78,165`
- `sir/phase2-research/zoning-pathway.md:4,313`
- `sir/phase2-research/web-followups.md:6`
- `sir/phase3-disciplines/eptp.md:5,12,27,140`
- `sir/phase3-disciplines/zlu.md:4,147-180`
- `sir/phase3-disciplines/el.md:3,113-117`
- `sir/phase3-disciplines/fwp.md:89`
- `sir/phase3-disciplines/sde.md:3`
- `sir/deliverable/pages.tsx:231,910,956,967,1012`
- `run-manifest.json:52` — issue-matrix Bucket C row recording the
  discrepancy as **`data-gap`** with action *"Engineer to reconcile against
  boundary survey; clarify whether assemblage is involved"*.

But this cross-check is **emergent**: it only fires when a concept plan is
attached AND its title block contains a site-area figure. There is no
*programmatic* check elsewhere. The check classified the question as a
data-gap, not as a STOP condition — the pipeline continued to render the
SIR and Research Appendix end-to-end.

## 6. Single-parcel assumptions baked into the pipeline

### Hardcoded single-parcel language

- `claude-plugins/.../diligence-report/prompts/seed-site-data.md:37` —
  *"For a single-parcel site, use a single bullet."* (no symmetric note on
  multi-parcel verification)
- `claude-plugins/.../diligence-report/references/run-manifest.md:120` —
  manifest schema for Phase 0 declares `"parcel_id": "0123456789"` as a
  single string, not an array. The rollup field at
  `run-manifest.md:107-131` only has space for one parcel.
- `claude-plugins/.../diligence-report/references/subject-location-gate.md:60` —
  the single-source-of-truth line is keyed on `parcel <APN/parcel-id>`
  (singular).
- `claude-plugins/.../diligence-report/prompts/seed-site-data.md:70` —
  template `Subject location confirmed: <lat>,<lon>, parcel <APN/parcel-id>, ...`
  (singular).
- `claude-plugins/.../diligence-report/working-dir.md:27` — *"Combined
  parcels: use the primary parcel's address, or `<street>-assemblage` if
  no clear primary"* (slug-only guidance; no analytical guidance).
- `surveyor/src/cli.ts:556` — log line *"`${parcels.length} parcel(s)`"*
  is the only place the parcel count is surfaced.

### Multi-parcel-aware language (where it exists)

- `SKILL.md:8-10` lists combined-parcel scenarios as supported.
- `prompts/seed-site-data.md:30-35` — multi-bullet form documented.
- `prompts/seed-site-data.md:102` — escalation if "you can't tell".
- `prompts/jurisdiction-detection.md:31` — escalate cross-jurisdiction
  parcels.
- `surveyor/prompts/preamble-diligence.md:24-28` —
  multi-parcel research guidance for the surveyor agent (use GIS profile
  with multiple parcel IDs, check zoning mismatches, "note which
  constraints apply to specific parcels vs. the entire assembly").
- `surveyor/prompts/county-clerk.md:148` — *"The unit of coverage is a
  (parcel, doc_type) pair. For an N-parcel assembly you must log N × 12
  pairs."*
- `bureau/jurisdictions/atlanta/feasibility-guides/sduf.md:36` —
  Unified Development Plan (§ 16-28.030) doctrine for multi-parcel /
  phased projects.

### Bureau-side discipline-specific multi-parcel logic

- `bureau/jurisdictions/atlanta/feasibility-guides/sduf.md:36,83` — UDP
  mention; "SAP/COA applicability ambiguous on a boundary parcel" as
  data-gap.
- `bureau/jurisdictions/atlanta/feasibility-guides/zlu.md:127` — "Site
  split between two SPI subareas / overlay boundary on parcel" → data-gap.

Otherwise the bureau guides treat "the parcel" as singular. No assemblage
scoring framework exists discipline-by-discipline.

## 7. Logging / observability gaps

### What gets logged when parcels resolve in Phase 0

Recorded in `phase0.json`:
- `payload.subject_location.parcel_id` — single string
  (`run-manifest.md:120`).
- `payload.subject_location.customer_supplied_pin` — typed as
  `{lat, lon}` only; `null` for this run (`phase0.json:36`).
- `payload.subject_location.reconciliation` — coord-distance verdict only.
- `tools[].fulton-gis.detail` — narrative free-text:
  `phase0.json:14-17` says *"address-search returned one parcel"*. **This
  is the only place the "N=1 result" fact lives.** A 3-parcel result would
  presumably surface here in prose, but no machine-readable field exists.

What is NOT logged:
- The literal `customer_supplied_pin: "17 00950004067"` from the input
  prompt (typing gap; see §1).
- The set of all candidate parcels considered by the address search.
- The N returned by the assessor address search (only the single chosen
  parcel survives).
- The reconciliation status of "customer PIN ↔ authoritative APN" as a
  *non-coordinate* match. The PIN alias check appears in
  `seed-site-data.md:45` narrative but not in `phase0.json`.

### When the coverage gate hits a mismatch — what's logged

Confirmed silent failure. The gate at `surveyor/src/cli.ts:554-575`:

1. Logs *count* of required pairs (`cli.ts:556` — `Gate check: X required
   (parcel × doc-type) pairs across N parcel(s)`).
2. Logs *count* of missing pairs (`cli.ts:558,564` — `Pass 1: M pairs
   missing — running broad-sweep recovery…`).
3. On final failure, throws with the missing-pair list
   (`cli.ts:569-573`).

Nowhere does it log:
- The **attempted** parcel-IDs alongside expected (a one-line diff would
  expose the bug immediately).
- A warning when **all** required pairs are missing despite N attempts
  being recorded — the canonical "regex truncated" fingerprint.

The audit
(`diligence/atlanta-grocery-run-2/audit/multi-agent-audit-summary.md:123`)
files this as **B2 — HIGH** with the exact patch:
> `if (attempted.size > 0 && missing.length === required.length) { logger.warn(...) }`
> naming attempted-parcel-id alongside expected-parcel-id.

In this run, the silent-failure consumed:
- ~10 wasted minutes (audit `multi-agent-audit-summary.md:113`)
- ~$0.66 in API spend on Pass 2 alone
- A surveyor crash that left `output/facts.md` unwritten
  (`audit/multi-agent-audit-summary.md:131` — B6 LOW)

### When assessor address-search returns N parcels

- `phase0.json:16` shows the prose detail of "one parcel" in
  `tools[].fulton-gis.detail`. No structured `parcels_returned: N` field
  exists in the manifest schema (`references/run-manifest.md:107-131`).
- A 2- or 3-parcel result would either: (a) be narratively flagged by the
  agent in the same prose field, or (b) the agent would silently pick the
  best match and proceed. **There is no documented STOP behavior for this
  case.**

### Post-Phase-0 consistency check between parcel set and concept-plan area

There is no programmatic check. The cross-check that fired in this run
(§5 above — 9.60 vs 7.38 ac) only fired because:
1. A concept plan was attached (`Phase 1` ran).
2. The vision extraction surfaced the title-block area
   (`concept-plan-data.md:29`).
3. The Phase 1 agent **noticed** the disagreement and added a checklist
   item (`concept-plan-data.md:45,135`).

If any of those three conditions fails (no concept plan, no site-area cell
on the plan, or the agent doesn't notice), the assemblage question is
never raised. Even when raised, it lands as a `data-gap` in Bucket C
(`references/synthesis-and-gap-recovery.md:78-80`), which means *"flag in
§9 with specific page reference"* — not *"stop and ask the user"*.

### Retroactive validation

Two mechanisms exist but neither was used in this run:

- `noetic-tools:diligence-replay-phase-5` skill — re-renders Phase 5 only.
  Cannot change parcel set; reads existing artifacts.
- `noetic-tools:audit-diligence-run` skill — read-only post-hoc audit.
  Detected the regex bug here
  (`audit/multi-agent-audit-summary.md:117-121`).
- Manual amendment to `seed-site-data.md` followed by re-running phases
  1-5 — possible but undocumented.

There is no skill or CLI that ingests "user says the parcel set is
actually X, Y, Z" and replays the pipeline.

## 8. Cross-cutting risks (own observations)

### Silent-degradation paths for multi-parcel input

1. **GSCCCA-style whitespace-bearing PINs systemically broken**
   (`surveyor/src/lib/parcels.ts:29`). Every Georgia run will hit this
   regex even with a single PIN. With 3 parcels, three bullets all collapse
   to `"17"` and the gate's required-set keys collide / undercount.

2. **`required` Cartesian-product builder has no dedup**
   (`surveyor/src/cli.ts:494-496`). With the regex bug, 3 parcels yield
   `["17", "17", "17"]`; `flatMap` produces 36 `{parcel_id: "17", ...}`
   pairs. `readMissing` builds a Set, so the Cartesian product collapses
   silently to 12 distinct pairs. The N-parcel signal vanishes between
   line 494 and line 504.

3. **`customer_supplied_pin` slot type-mismatched to PIN identifiers**
   (`references/run-manifest.md:122` vs `phase0.json:36`). Any
   parcel-identifier supplied by the user will land as `null` in the
   manifest. Audits looking at `phase0.json` see a clean "no customer
   pin" verdict that is structurally untrue.

4. **Subject-location gate doesn't validate "single parcel" assumption**
   (`references/subject-location-gate.md`). It validates *coordinates* and
   *one parcel*. If GIS returns 3 polygons for one address, gate has no
   clause that triggers STOP.

5. **Surveyor's `seed-file` copy is byte-for-byte**
   (`surveyor/src/cli.ts:266-270`). Any drift between the skill's expected
   seed format and the surveyor's parcel reader is invisible at copy time;
   it only surfaces 25–30 minutes later when the coverage gate fails.

6. **Restrictive-covenants discipline silently undercounts encumbrances**
   on missing parcels (`prompts/research-restrictive-covenants.md:25,71`).
   The agent's "does this burden Lot A?" logic correctly *excludes*
   easements on Lots B/C/D — which is right when the project only touches
   Lot A, and silently catastrophic when the project touches all three.

7. **Phase 1 area cross-check requires three contingent conditions to
   fire** (concept plan attached, title-block area cell present, agent
   notices). Bare-address runs have no equivalent.

8. **`data-gap` is not a STOP.** Even when the assemblage question is
   raised correctly (as in this run), it lands as Bucket C — concept-plan
   ambiguity, flagged in §9. The pipeline continues to discipline
   analysis, synthesis, and rendering. The final SIR ships with the
   single-parcel assumption baked into §1.4 risk framing and per-discipline
   findings, with the assemblage question raised only deep in §10.6 and
   the §11 punch-list (`sir/deliverable/pages.tsx:967,1012`).

### Places "confident single parcel" is asserted without verification

- `diligence/atlanta-grocery-run-2/seed-site-data.md:12` —
  *"single-parcel site"* asserted parenthetically in the canonical-IDs
  bullet, with reasoning chain `(assessor record shows it as a single
  7.38-acre parcel)`. The reasoning is correct for parcel 17
  009500040675 in isolation but does not address whether the
  redevelopment touches other parcels.
- `phase0.json:33-39` — `subject_location.parcel_id: "17 009500040675"`,
  with no sibling field for "and N other parcels in scope".
- `phase0.json:30-31` — `detection_method: "geocode + assessor
  confirmation + point-in-polygon city-limits"` — none of these can
  detect assemblage.
- `seed-site-data.md:70` — the assemblage Open Question is asked, then
  *answered* in the same file at line 12 ("single-parcel site") without
  cross-checking the engineer's drawing or pausing for user confirmation.
- `sir/deliverable/pages.tsx:231` — KeyValue `Lot area` cell pegs the
  primary number to the assessor's 7.38 ac and *cross-references the 9.60
  reconciliation question to §10.6*. The SIR ships with the assumption
  preserved as a hedge, but the executive summary, risk-ranking, and
  recommended-action sections all treat single-parcel as the working
  hypothesis.

## Key file:line references (consolidated index)

### Diligence skill (Phase 0 contract)

- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/SKILL.md:22-26` — user-provided inputs (parcel, intended use)
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/SKILL.md:67` — subject-location anchor rule
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/pipeline.md:14` — "parse parcel(s) and intended use" (sole instruction)
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/pipeline.md:19-22` — Phase 0 location-confirmation gate
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/jurisdiction-detection.md:25-44` — detection order (concept plan → plat → address)
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/jurisdiction-detection.md:31` — cross-jurisdiction parcels → escalate
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/seed-site-data.md:20` — `**Parcel(s):**` field
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/seed-site-data.md:25-37` — Canonical Parcel IDs section format and contract
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/seed-site-data.md:60-78` — single-source-of-truth coord+parcel line
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/seed-site-data.md:89-103` — Open Questions + escalation rules
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/references/jurisdiction-detection.md:25-31` — detection order; combined-parcels caveat
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/references/subject-location-gate.md:9-13` — gate inputs (address, APN, pin)
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/references/subject-location-gate.md:36-53` — coord reconciliation (no APN-level reconciliation)
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/references/subject-location-gate.md:55-63` — write exactly ONE confirmed-coord line
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/references/run-manifest.md:104-138` — Phase 0 payload schema, `customer_supplied_pin` as `{lat,lon}`
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/working-dir.md:22-29` — property-slug rules (combined-parcel hint)

### Surveyor invocation + parcel reader

- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/invoke-surveyor.md:14-25` — invocation contract (`--seed-file`)
- `/Users/wnavey/noetic/surveyor/src/cli.ts:266-270` — `--seed-file` copies seed → `intermediate/site-plan-data.md`
- `/Users/wnavey/noetic/surveyor/src/lib/parcels.ts:5-23` — module docstring (primary + fallback contract)
- `/Users/wnavey/noetic/surveyor/src/lib/parcels.ts:28-29` — section header + **bullet regex (BUG)**
- `/Users/wnavey/noetic/surveyor/src/lib/parcels.ts:60-82` — `readBulletSection` (terminates at next heading)
- `/Users/wnavey/noetic/surveyor/src/lib/parcels.ts:84-109` — `extractIdsFromParcelLine` (fallback parser)
- `/Users/wnavey/noetic/surveyor/src/lib/parcels.ts:134-169` — `readParcelIds` top-level
- `/Users/wnavey/noetic/surveyor/src/lib/document-search-log.ts:200-246` — `log_document_search_attempt` tool def (free-string parcel_id)
- `/Users/wnavey/noetic/surveyor/src/cli.ts:483-491` — Phase 2.5 gate entry / `readParcelIds` call
- `/Users/wnavey/noetic/surveyor/src/cli.ts:492-506` — `required` Cartesian product + `readMissing`
- `/Users/wnavey/noetic/surveyor/src/cli.ts:508-552` — `runDocSearchRecovery` (Pass 1 / Pass 2)
- `/Users/wnavey/noetic/surveyor/src/cli.ts:554-576` — gate main loop + hard-throw at `cli.ts:571`

### Surveyor's multi-parcel guidance (research-side)

- `/Users/wnavey/noetic/surveyor/prompts/preamble-diligence.md:24-28` — N-parcel research procedure
- `/Users/wnavey/noetic/surveyor/prompts/county-clerk.md:140-175` — coverage gate semantics for assemblies (`N × 12 pairs`)
- `/Users/wnavey/noetic/surveyor/spec/document-search-coverage.md:11,61` — gate spec (assembly-aware)

### Run-specific artifacts (atlanta-grocery-run-2)

- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/inputs/input-prompt.txt:4` — customer PIN# `17 00950004067`
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/run-manifest/phase0.json:36` — `customer_supplied_pin: null` (bug)
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/run-manifest/phase0.json:14-17` — `fulton-gis.detail: "address-search returned one parcel"` (the only place N=1 is recorded)
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/run-manifest/phase0.json:33-39` — subject_location block
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/seed-site-data.md:5` — `**Parcel(s):** 17 009500040675`
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/seed-site-data.md:10-12` — Canonical Parcel IDs section (one bullet)
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/seed-site-data.md:39-45` — confirmed-location block, PIN-alias note
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/seed-site-data.md:64-70` — Open Questions, including the unresolved Combined-parcel question
- `/Users/wnavey/noetic/surveyor/workspaces/atlanta-grocery-run-2/intermediate/site-plan-data.md:12` — byte-identical bullet that gets fed into `parcels.ts:29`
- `/Users/wnavey/noetic/surveyor/workspaces/atlanta-grocery-run-2/intermediate/document-search-log.jsonl` (rows 31–60) — agent-logged `parcel_id: "17 009500040675"`
- `/Users/wnavey/noetic/surveyor/workspaces/atlanta-grocery-run-2/intermediate/recovery-doc-search-pass1.md:5` — gate-rendered `Parcel **17**` (the truncated value)
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/sir/phase1-extraction/concept-plan-data.md:29,45,135` — 9.60 vs 7.38 ac discrepancy + checklist
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/sir/phase3-disciplines/zlu.md:147-180` — PSF-4 finding (site-area reconciliation)
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/sir/deliverable/pages.tsx:231,910,956,967,1012` — SIR-level hedging on parcel set
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/run-manifest.json:24,52` — surveyor `degraded:doc-search-gate-failure`; data-gap row
- `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/audit/multi-agent-audit-summary.md:58,107-131` — prior audit naming B1/B2/B3/B6

### Downstream parcel-dependent prompts

- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/research-restrictive-covenants.md:9,17,25,43,45,57,60,71-73` — burdens-this-parcel logic
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/research-environmental.md:4` — seed dependency
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/research-submarket.md:9,17,40,105` — radii from parcel centroid
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/research-zoning-pathway.md:18,26,58` — recent ordinances for this parcel
- `/Users/wnavey/noetic/bureau/jurisdictions/atlanta/feasibility-guides/sduf.md:36,83` — Unified Development Plan / boundary-parcel SAP ambiguity
- `/Users/wnavey/noetic/bureau/jurisdictions/atlanta/feasibility-guides/zlu.md:127` — split-overlay-on-parcel data-gap
- `/Users/wnavey/noetic/bureau/jurisdictions/atlanta/feasibility-guides/park.md:24,76` — three-service-area impact-fee
- `/Users/wnavey/noetic/bureau/jurisdictions/atlanta/feasibility-guides/wwp.md:30,57,86` — septic / service per-parcel

### Synthesis / gap-recovery contract

- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/pipeline.md:113-118` — Bucket A/B/C
- `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/skills/diligence-report/references/synthesis-and-gap-recovery.md:78-89` — Bucket C and stop conditions (no "wrong parcel set" branch)
