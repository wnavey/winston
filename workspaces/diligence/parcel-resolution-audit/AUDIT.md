# Parcel Resolution Audit — Atlanta Grocery Run 2

**Subject run:** `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/`
**Audit date:** 2026-06-17
**Auditor:** Claude Code, parcel-resolution-audit branch
**Status:** Read-only audit. No fixes proposed in this document.

---

## Executive summary

The diligence-report pipeline asserted that the Chastain Square site is a **single-parcel** redevelopment on Fulton PIN `17 009500040675`. The user has now stated that the site is actually a **3-parcel** assemblage. This audit traces how the pipeline arrived at "single parcel," documents the assumptions baked in along the way, and inventories the logging/observability gaps that allowed a confidently-wrong premise to survive five phases and ship in the final Site Intelligence Report.

The headline finding: **at no point in the pipeline does a structured check exist that asks "is the parcel set we have actually complete?"** A concept-plan-area cross-check fires emergently in Phase 1 (and did, correctly, in this run — flagging the 9.60 ac drawn vs 7.38 ac assessor delta), but the check is classified as a Bucket-C data-gap, not a STOP condition, and the pipeline proceeds to render the SIR with single-parcel reasoning baked into the executive-summary risk framing. The customer-supplied PIN went into Phase 0 with no structured slot to land in. The surveyor's coverage gate then crashed on a regex bug that, even after a fix, would not have caught the multi-parcel premise.

There are five distinct layers where multi-parcel awareness could have been enforced and wasn't:

1. **Input ingestion** — no parser for `PIN#` / `APN` patterns in the input prompt; no schema to differentiate customer-supplied coordinate-pin from customer-supplied parcel-pin.
2. **Phase 0 GIS resolution** — no documented branch for "address search returned N>1 parcels"; no field for it in the manifest.
3. **Open-Questions surfacing** — the Combined-parcel question was correctly identified by the Phase 0 agent and written into seed-site-data.md, then auto-answered on the same page without user confirmation. Open Questions are observational; no blocking gate keys off them.
4. **Surveyor seed contract** — the surveyor's parcel reader and the skill's seed format have a latent contract mismatch (regex `\S+` vs whitespace-bearing GSCCCA PINs) that has been blocking every Georgia run.
5. **Synthesis / Phase 4 gap-recovery** — Bucket C ("concept-plan ambiguity") is the closest bucket to "the parcel set is wrong," but its remediation is "flag in §9 / §10," not "stop and amend the seed."

The 9.60 ac drawn vs 7.38 ac assessor disagreement was visible and well-tracked through 20+ files — but at no point in the pipeline did that disagreement triple-back to "we need to confirm the parcel set before proceeding."

---

## 1. How the parcel was resolved in this run

### Phase 0 — input → seed-site-data.md

**Input:** `/Users/wnavey/noetic/diligence/atlanta-grocery-run-2/inputs/input-prompt.txt:4`
```
4279 Roswell Rd NE, Atlanta, GA 30342 (PIN# 17 00950004067)
```

The Phase 0 agent ran the following resolution chain:

1. **Address geocode** via Fulton PropertyMapViewer Tax Parcel layer 11. Returned exactly one feature: ParcelID `17 009500040675`, WGS84 centroid computed from the polygon ring (`phase0.json:14-17`, `seed-site-data.md:43`).
2. **Customer PIN reconciliation.** The 13-digit `17 00950004067` was identified as the LOWPARCELI alias of the 14-digit canonical, verified via Atlanta SAP record SAP-12-030 which carries both forms against the same polygon (`seed-site-data.md:12,45`).
3. **City-limits confirmation** via point-in-polygon hit against Atlanta Geopolitical Area MapServer layer 0 (`phase0.json:39`).
4. **Single-parcel assertion** written into seed-site-data.md as one bullet under `## Canonical Parcel IDs` (`seed-site-data.md:10-12`):
   > - 17 009500040675 — Chastain Square anchor parcel, 4279 Roswell Rd NE (single-parcel site; full 14-digit Fulton canonical form. ...)

The full chain runs in the Phase 0 agent's free-form reasoning. There is no codified gate that validates the result against any other source — the GIS address search returning N=1 is taken as definitive.

### Phase 0 → surveyor seed

The surveyor consumes `intermediate/site-plan-data.md`, which is produced by **byte-for-byte copy** of `seed-site-data.md` at `surveyor/src/cli.ts:266-270`:
```ts
if (opts.seedFile) {
  const seedPath = path.resolve(opts.seedFile);
  console.log(`Using seed file: ${seedPath}`);
  fs.copyFileSync(seedPath, sitePlanDataFile);
  console.log('Phase 1 skipped (seed mode).');
}
```

So any drift between the skill's expected format and the surveyor's reader is invisible at copy time and only surfaces when the coverage gate fires 25-30 minutes later. (This is what happened here: the regex bug at `parcels.ts:29` truncated `17 009500040675` → `17`, building a `required` set the agent's correct logs could never match.)

### Phase 1 vision — the only programmatic cross-check that fired

Phase 1 read the engineer's concept plan and surfaced (`sir/phase1-extraction/concept-plan-data.md:29,45,135`):

> Three plausible explanations: (a) the concept plan covers an assemblage that includes ROW or adjacent parcels not in the subject parcel polygon; (b) the engineer is using a metes-and-bounds figure that differs from the assessor; (c) the sheet erroneously includes adjoining parcels (e.g., "1907 area" retention or a neighboring strip). **Phase 2/3 to confirm whether the redevelopment touches parcels other than `17 009500040675`.**

This is the correct question. It surfaced as a `data-gap` in Bucket C (`references/synthesis-and-gap-recovery.md:78-80`), which means "flag in §9 with specific page reference" — not "stop and amend the seed."

The disagreement then propagated through ~20 downstream files (env, zoning-pathway, web-followups, eptp, zlu, el, fwp, sde, pages.tsx, run-manifest data_gaps, issue-matrix) — uniformly as "engineer to reconcile against boundary survey." Single-parcel remained the working hypothesis everywhere else.

---

## 2. Assumptions made

### Assumed: a customer-supplied PIN is a *coordinate*, not a parcel ID

The Phase 0 manifest schema (`references/run-manifest.md:104-138`) declares `customer_supplied_pin` as `{lat, lon}`. The subject-location gate (`references/subject-location-gate.md:9-13, 36-53`) treats "pin" as a dropped Google Maps point and reconciles by coordinate distance. There is no slot for a customer-supplied APN.

Consequence: `phase0.json:36` records `"customer_supplied_pin": null` even though the input clearly contained `PIN# 17 00950004067`. The PIN was rescued narratively in `seed-site-data.md:12, 45` but the structured audit trail lies.

### Assumed: GIS address search returns exactly one parcel

`pipeline.md:14` instructs the Phase 0 agent to "parse parcel(s) and intended use from user input" — one bullet, no detail. `references/subject-location-gate.md:36-53` describes the gate as reconciling coordinates between the authoritative assessor result and any customer-supplied pin. **There is no documented branch for "address search returned N parcels."** The manifest schema has only one `parcel_id` field (string, not array) at `references/run-manifest.md:120`.

A 2- or 3-parcel address-search result would either be (a) flagged narratively by the Phase 0 agent in the same prose detail field that recorded "one parcel" here, or (b) silently collapsed to a best-match pick. There is no STOP behavior.

### Assumed: a single-bullet `## Canonical Parcel IDs` section means single-parcel site

`prompts/seed-site-data.md:37` says: *"For a single-parcel site, use a single bullet."* There is no symmetric instruction to verify that the site IS in fact single-parcel before writing a single bullet. The number of bullets is taken as truth by downstream consumers; nothing checks back.

### Assumed: the Combined-parcel Open Question can be auto-answered by the Phase 0 agent

`seed-site-data.md:70` correctly raises:
> **Combined-parcel scenarios:** Concept references "attached shops to the south" — confirm whether all affected buildings sit on this single parcel 17 009500040675 (assessor record shows it as a single 7.38-acre parcel) or whether the inline shops are on adjoining parcels that need to be added to the diligence.

The skill is documented to surface this section to the user (`prompts/seed-site-data.md:90`), but **the pipeline has no blocking gate that pauses on it.** The only blocking gate in Phase 0 is the coordinate-distance reconciliation gate at `references/subject-location-gate.md:39-51`. STOP conditions per `pipeline.md:24` are: (a) customer pin >150–250 m from authoritative parcel, or (b) different parcels / jurisdictions between customer pin and authoritative point. Multi-parcel ambiguity — *raised by the agent's own reasoning, in the seed file* — does not stop the pipeline.

In this run, the same file (`seed-site-data.md`) raises the question at line 70 and auto-answers it at line 12 ("single-parcel site").

### Assumed: concept-plan area > assessor area is a data-gap, not a parcel-set discrepancy

When Phase 1 vision found 9.60 ac drawn vs 7.38 ac assessor (`concept-plan-data.md:29,45,135`), the disagreement was classified as a `data-gap` and routed to Bucket C in Phase 4 gap recovery. Bucket C's remediation is documented at `references/synthesis-and-gap-recovery.md:78-80` as "flag in §9 with specific page reference." There is no Bucket — A, B, C, or otherwise — for "the parcel set itself may be wrong; re-resolve."

### Assumed: the surveyor reader and the seed format agree on tokenization

The skill's seed format (`prompts/seed-site-data.md:27`) describes the bullet's "first whitespace-delimited token" as the canonical parcel identifier. The surveyor reader at `surveyor/src/lib/parcels.ts:29` enforces that literally with `BULLET_RE = /^[-*]\s+(\S+)/`. For Texas-style PINs (`102701`), this works. For Georgia-style PINs (`17 009500040675`), it fails — but the seed-author agent naturally writes the canonical form with the embedded space because that is how Fulton CAMA and Atlanta DPCD return it. The contract is consistent with itself but inconsistent with jurisdiction reality.

### Assumed: downstream disciplines can treat "the parcel" as singular

Search of the diligence skill and the bureau feasibility guides surfaces only two places that contemplate multi-parcel logic with any substance:
- `bureau/jurisdictions/atlanta/feasibility-guides/sduf.md:36,83` — mentions Unified Development Plan (§ 16-28.030) for multi-parcel projects; flags "SAP/COA applicability ambiguous on a boundary parcel" as a data-gap.
- `bureau/jurisdictions/atlanta/feasibility-guides/zlu.md:127` — "site split between two SPI subareas / overlay boundary on parcel" → data-gap.

Otherwise every feasibility guide treats "the parcel" as singular. The 10 disciplines all consume `seed-site-data.md` directly and inherit its single-parcel framing.

### Assumed: the property slug is the only place assemblage needs to be flagged

`working-dir.md:22-29` says: *"Combined parcels: use the primary parcel's address, or `<street>-assemblage` if no clear primary."* This is the only place "assemblage" appears in the skill's working-directory guidance — and it's a *slug-naming* rule, not an analytical one.

---

## 3. What we didn't check for

### Did not check: did the assessor return more than one parcel?

The Phase 0 tool result detail (`phase0.json:14-17`) reads:
> Fulton County PropertyMapViewer Tax Parcel layer 11 + Fulton CAMA address-search resolved parcel 17 009500040675 and computed WGS84 centroid

This prose "resolved parcel" presupposes singular. There is no structured field — anywhere in the run-manifest schema — that records the **count** of features the assessor returned. If the search had returned 3 parcels, the prose would presumably read differently, but no machine-readable signal would surface.

### Did not check: does the parcel polygon area agree with the concept-plan drawn area?

The Phase 0 agent computed the parcel polygon area (~349,325 SF / 8.02 ac per `phase0.json` and `seed-site-data.md:8`) and recorded the assessor's LandAcres (7.38 ac / 321,473 SF). This 8.02 vs 7.38 internal CAMA discrepancy is itself an unflagged ~9% delta within the same record (see the upstream multi-agent audit, Agent 3).

But more importantly: at Phase 0, the concept-plan area (9.60 ac) is not yet known. The cross-check between assessor area and drawn area can only fire in Phase 1, after vision extraction. There is no second pass that re-validates the parcel set against the now-known drawn area.

### Did not check: does the assessor's listed parcel boundary actually enclose the redeveloped footprint?

The concept plan was geo-referenced via overlay (`inputs/2026-03-11 - Chastain Square - CP15 - Regency - Atlanta_GA (overlay).pdf`). Nothing in the pipeline overlays the concept-plan footprint against the assessor's parcel polygon to check whether the proposed building, parking, and driveways fit within the single-parcel boundary. A simple GIS intersection check would have flagged the 9.60 vs 7.38 issue as a geometric fact, not a paper-tabulation discrepancy.

### Did not check: are the existing structures all on one parcel?

The concept plan retains the existing 2-story south building and the "1907 area" structure in the northeast corner (`pages.tsx:159-162`, §1.3 Risk #10). The SIR's §1.3 Risk #10 (the "selective-retention" inference about sub-leasehold counterparties) is exactly the kind of reasoning that would be sharpened — or rendered moot — by knowing whether each retained structure sits on parcel 1 or on parcels 2/3.

Confirmation would require either Fulton GIS overlay of structure footprints against parcel polygons, or a HCAD-equivalent improvement-by-parcel pull. Neither was done. The pipeline reached the inference path instead of the data path.

### Did not check: do the owner/title chains for adjoining parcels mention the same entities?

GSCCCA name searches ran against IRT PROPERTY CO, Regency Centers L.P./Corp., Equity One, Chastain Square LLC/2 LLC/II LLC, etc. — all entities tied to parcel 1. If parcels 2/3 are owned by a separate entity (a different LLC, a ground-lease counterparty, an estate, a pre-IRT predecessor), the name-search net never went over them. Their deeds, easements, reciprocal-easement-agreements, and conditions ordinances would be absent from `priority-pull-list.md` and silently missing from `restrictive-covenants.md`.

A "neighbors search" — pulling owner names from parcels adjacent to the subject — is a routine Phase 2 step in a multi-parcel diligence pass. It did not happen here because the pipeline never knew it was multi-parcel.

### Did not check: do the adjoining parcels carry their own zoning, overlays, SAP history?

Atlanta DPCD point-queries (zoning, overlays, IZ, BeltLine TCU, historic, SAP) all ran against the **centroid** (`atlanta_property_profile`, lon=-84.379667, lat=33.871083). A different parcel in the assemblage with a different centroid could land in:
- A different zoning district (e.g., R-4 if a residential adjoining lot is folded in — and there are R-4 lots immediately east per Wieuca Hills)
- A different SPI / overlay
- A different SAP filing history

The current SIR's "no overlays, all C-1-C, no SAP except SAP-12-030" verdict applies to **the centroid of parcel 1**, not to the assemblage.

### Did not check: is the recorded plat one plat or multiple?

The "Land Lot 95, 17th District" legal description in `pages.tsx:229` was pulled for parcel 1. Parcels 2/3 could sit in:
- A different Land Lot (Fulton's Land Lots are the 5,000 ft × 5,000 ft survey grid; assemblages routinely span them)
- A different recorded subdivision plat
- A separate plat book/page

None of these were checked.

### Did not check: do per-acre calculations key off the right total

Several disciplines compute per-acre values:
- `eptp.md:12,27,140` — tree-recompense cap = $35K/ac. Computed at *both* 7.38 ac ($258K) and 9.60 ac ($336K) — so the discipline preserved the ambiguity. But if real site is 9.60+ ac across 3 parcels, the $336K is right and the $258K conservative-baseline is misleadingly low.
- `park.md:24,76` — impact fees per "functional population" scaled by service area. Per-parcel.
- `wwp.md:30,57,86` — capacity / service eligibility per-parcel.
- `sde` — 35% redevelopment threshold for whole-site stormwater obligation, against total site impervious. Wrong baseline if assemblage acreage is different.

The pipeline ran each discipline's calc against assessor-canonical 7.38 ac (with eptp explicitly hedging both). None re-keyed to "total assemblage acreage from the now-confirmed parcel set."

---

## 4. Logging and observability gaps

### Phase 0

| Signal | Logged? | Where (or note) |
|---|---|---|
| Customer-supplied PIN identifier (`PIN# ...` from prompt) | **No** structured field | Survives only in `seed-site-data.md:12,45` narrative |
| Customer-supplied lat/lon pin | Yes | `phase0.json:36` `customer_supplied_pin` (typed `{lat,lon}`) |
| Number of features returned by assessor address search | **No** | Only in `phase0.json:14-17` prose detail string |
| Authoritative parcel ID(s) considered as candidates | **No** | Only the chosen one survives |
| Parcel polygon area | Yes — implicit | `seed-site-data.md:8` (349,325 SF derived from ring geometry) |
| Assessor LandAcres value | Yes | `seed-site-data.md:8`, derived from CAMA |
| Reconciliation: customer PIN vs authoritative APN (non-coordinate) | **No** structured field | Survives narratively in `seed-site-data.md:45` |
| Open Questions raised by the Phase 0 agent | Yes — in seed file | `seed-site-data.md:64-70` |
| Whether the Open Questions were answered by the user before continuing | **No** | No gate keys off them |

### Phase 1 vision

| Signal | Logged? | Where |
|---|---|---|
| Concept-plan title-block area | Yes | `sir/phase1-extraction/concept-plan-data.md:29` |
| Assessor vs drawn area disagreement | Yes | `concept-plan-data.md:45,135` (raised as checklist item) |
| Routed to which gap-recovery bucket | Yes | `run-manifest.json:52` → Bucket C `data-gap` |
| STOP triggered on the disagreement | **No** | Bucket C is a flag-and-continue path |
| Concept-plan footprint vs parcel polygon overlay check | **Not performed** | No such step in the pipeline |

### Surveyor coverage gate

| Signal | Logged? | Where |
|---|---|---|
| Resolved parcel-id list per `parcels.ts` | Partial | `cli.ts:556` logs *count* of parcels, not the list itself |
| `required` Cartesian product (parcel × doc-type) | Counts only | `cli.ts:556` log line `Gate check: X required pairs across N parcel(s)` |
| `attempted` set from JSONL | Counts only | Implicit in `cli.ts:558` `Pass 1: M pairs missing` |
| **Side-by-side attempted vs expected parcel-id values** | **No** | This is the regex-bug fingerprint and is absent everywhere |
| All-pairs-missing-after-recovery warning | **No** | The "fingerprint" line we'd want is unwritten; throws same way for genuine shortfall as for regex bug |
| Recovery-prompt-rendered parcel_id (the truncated value) | Yes — but inside the prompt itself | `intermediate/recovery-doc-search-pass1.md:5` reads `Parcel **17**` |

### Phase 4 synthesis / gap recovery

| Signal | Logged? | Where |
|---|---|---|
| Each data-gap bucket assignment | Yes | `run-manifest/phase4.json` |
| Phase 4 bucket for parcel-set discrepancies | **No bucket exists** | Bucket A/B/C/D do not enumerate "parcel set is wrong" |
| Retroactive parcel-set validation | **No mechanism** | Diligence-replay-phase-5 only re-renders; no path to re-resolve parcels |

### Phase 5 deliverable

| Signal | Logged? | Where |
|---|---|---|
| Parcel ID(s) on the cover | Yes | `pages.tsx:67` (one parcel) |
| Assemblage caveat in §2 Property Identity | Yes — partial | `pages.tsx:231` (notes 9.60 vs 7.38 reconciliation) |
| Assemblage caveat in §1 Executive Summary | **No** | §1.3 Risk framing assumes single parcel |
| §10.6 Concept Plan Review reconciliation question | Yes | `pages.tsx:956-967` |
| Statement of "what was *not* checked" regarding parcels | **No** | No "not a sealed survey" qualifier on parcel scope (only on geometry) |

---

## 5. Cross-cutting risks (lessons from this run)

### R1 — Silent-degradation paths exist at every layer of multi-parcel input handling

In priority order:

1. **`surveyor/src/lib/parcels.ts:29` regex truncates whitespace-bearing PINs.** Every Georgia / GSCCCA run will hit this. With 3 parcels, three bullets all collapse to `"17"` and the gate's `required` Set silently dedups to 12 distinct keys regardless of N.
2. **`surveyor/src/cli.ts:494-496` Cartesian product has no dedup or count-check.** With 3 parcels collapsed to `["17", "17", "17"]`, the gate builds 36 ordered pairs that the `Set` at line 504 reduces to 12. The N-parcel signal vanishes between lines 494 and 504, undetected.
3. **`references/run-manifest.md:120` `parcel_id` field is singular string, not array.** Manifest cannot record a multi-parcel resolution result. If the assessor returns 3 parcels, Phase 0 has no schema to write them into.
4. **`references/run-manifest.md:122` `customer_supplied_pin` typed as `{lat, lon}` only.** Any customer-supplied APN/PIN/parcel-id identifier lands as `null`. Audit trail lies.
5. **`references/subject-location-gate.md:36-53` reconciles coordinates only.** A customer-supplied APN that matches the assessor's APN (or doesn't) generates no gate event.
6. **`surveyor/src/cli.ts:266-270` `--seed-file` is byte-for-byte copy.** Skill ↔ surveyor format drift is invisible at copy time, surfaces 25-30 min later in the gate.

### R2 — The Open Questions block is observational, not blocking

The Phase 0 agent did the right thing — it identified the assemblage ambiguity and wrote it into `seed-site-data.md:64-70`. The pipeline ignored it. There's no documented gate that pauses Phase 1+ on unresolved Open Questions; `prompts/seed-site-data.md:90` merely says the orchestrator "will surface" the section to the user.

For a question with structural consequences ("are there other parcels we should be researching?"), observational surfacing is insufficient.

### R3 — `data-gap` ≠ STOP

Phase 1 vision correctly flagged "9.60 ac drawn vs 7.38 ac assessor" and added "Phase 2/3 to confirm whether the redevelopment touches parcels other than `17 009500040675`." This routed to Phase 4 Bucket C (`references/synthesis-and-gap-recovery.md:78-80`). Bucket C's remediation is "flag in §9 with specific page reference." The pipeline continued to render, the SIR shipped, and the assumption survived intact except inside §10.6 where the data-gap got its honest treatment.

A separate severity class — call it "parcel-set-suspect" or "premise-suspect" — does not exist. There is no path from "Phase 1 noticed a geometric inconsistency that implies the parcel set might be wrong" to "Phase 0 must re-resolve and the pipeline restarts."

### R4 — Restrictive-covenants and chain-of-title silently undercount on missing parcels

`prompts/research-restrictive-covenants.md:25,71-73` instructs the agent to filter encumbrances to "burdens this parcel" (singular). With the right parcel set, this is correct discipline. With a 1-of-3 parcel set, encumbrances burdening Lots 2 and 3 are *excluded by design* and never surface.

This produces a deliverable that reads complete but is silently lacking exactly the recorded instruments that travel with the missing parcels.

### R5 — Per-acre and per-parcel calcs are not cross-validated against the assumed parcel set

eptp's $258K vs $336K dual-cap calc is exemplary (preserves both possibilities). park.md, wwp.md, sde.md do not. Nothing in the pipeline says "re-check every per-acre figure once the parcel set is confirmed."

### R6 — There is no retroactive parcel-set amendment path

If the user (or an auditor) determines mid-run or post-hoc that the parcel set is wrong, the only documented remediation is "re-run from Phase 0." `noetic-tools:diligence-replay-phase-5` cannot change inputs. `working-dir.md:117-122` resume logic detects existing runs but doesn't recompose the seed.

This means: **even after we know there are 3 parcels, we cannot patch the run** — we either accept the single-parcel framing or run again. Given how much of the Phase 2 / Phase 3 reasoning is already correct (jurisdiction, GDOT, NPU-B, flood, fire), full re-run is wasteful. An amendment path that "freezes" still-valid artifacts and re-runs only what depends on parcel-set inputs would be ideal — but it does not exist today.

### R7 — Confident-tone-without-verification compounds the risk

`seed-site-data.md:12` asserts "single-parcel site" parenthetically with a reasoning chain — *"(assessor record shows it as a single 7.38-acre parcel)"* — that is correct as a statement about parcel 1's record, and incorrect as a statement about the redevelopment scope. The tone is declarative. Downstream agents inherit the tone with no signal that this premise is itself unverified.

By Phase 3, `sir/phase3-disciplines/zlu.md:4` reads as confident expert analysis on parcel 1; the assemblage question is preserved as a footnote. By Phase 5, `pages.tsx:67` cover meta lists exactly one parcel.

---

## 6. Where the assumption is asserted without verification (consolidated)

| File:line | Assertion | What would have verified it |
|---|---|---|
| `seed-site-data.md:12` | "single-parcel site" | Concept-plan footprint overlay against parcel polygon; user confirmation of `Open Questions` |
| `seed-site-data.md:43` | "Address search 'returned exactly one feature'" | (Verified for that address; does not preclude assemblage) |
| `seed-site-data.md:45` | "no customer pin to reconcile" | (Wrong on its face — input had `PIN#`) |
| `phase0.json:33-39` | `subject_location` block, singular `parcel_id` | Manifest schema doesn't allow N>1 |
| `phase0.json:36` | `customer_supplied_pin: null` | Customer-supplied PIN identifier had no schema slot |
| `surveyor/.../site-plan-data.md:12` | Same single-bullet section, byte-identical | (Inherited from seed copy) |
| `surveyor/.../document-search-log.jsonl` | Every row carries `parcel_id: "17 009500040675"` | Agent did not log any alternate parcel-id; no signal |
| `sir/deliverable/pages.tsx:67` | Cover meta: `Parcel: Fulton ParcelID 17 009500040675` | Singular field on cover |
| `sir/deliverable/pages.tsx:231` | KeyValue Lot area = 7.38 ac, with 9.60 ac flagged for §10.6 | Preserves the discrepancy but commits to 7.38 as canonical |
| `sir/deliverable/pages.tsx:1012` | §11 next-steps reference to engineer reconciliation | Lands the assemblage question as a pre-LOI step, not a re-resolve |

---

## 7. What we know now vs. what the pipeline knew

**What the pipeline knew at end-of-run:**
- One Fulton parcel (`17 009500040675`) at 7.38 ac assessor, 8.02 ac polygon
- A concept-plan title block claiming 9.60 ac
- Three plausible explanations (assemblage / metes-and-bounds / sheet error)
- Routed as Bucket C data-gap

**What the user knows now and the pipeline didn't:**
- The site is actually three parcels
- The other two parcel IDs (not yet shared with the auditor)
- Whether the other two share ownership chain, zoning, or are in separate hands

**What that gap means:**
The pipeline's "feasible" Bottom Line, its 11 Top Risks, its discipline findings, the SIR §10.6 reconciliation, and the priority-pull-list at run root were all reasoned against the parcel-1-only premise. The risks, mitigations, and per-acre figures that depend on parcel scope are now under-specified. The §4 chain-of-title and §6.6 recorded-encumbrances work is under-scoped. The §1.3 Risk #10 "selective-retention sub-leasehold" inference is potentially explained by parcel structure rather than leasehold structure.

This is a **premise error**, not a data-quality error. Premise errors break the pipeline's value proposition at the executive-summary layer — the layer the deal team reads first.

---

## 8. Open questions for follow-up brainstorm

(Not addressed here — left for the fixes session.)

- Should multi-parcel resolution be a separate phase, or part of Phase 0 with a real STOP gate?
- Should the input prompt have a structured `parcels:` field instead of free-text `PIN#` mentions?
- Should the address-search result count and any non-chosen candidate parcels be logged as a structured manifest field?
- Should the Phase 1 area-discrepancy check elevate from data-gap to STOP when the delta exceeds some threshold (e.g., > 20% of assessor area, > 0.5 ac absolute)?
- Should the concept-plan footprint be intersected with the parcel polygon at Phase 0 / 1 boundary as a programmatic check?
- Should every per-acre / per-parcel discipline calc be re-keyed against a "confirmed_assemblage_acreage" field that downstream agents must explicitly source?
- Should a parcel-set-amendment skill exist that takes the user's confirmation and surgically re-runs the affected phases without a full Phase-0 restart?
- Should the seed-author agent be required to perform an adjoining-parcels GIS sweep (1-step) and surface the names of immediately-adjacent owners?

---

## 9. Artifacts referenced

All paths absolute.

### Diligence skill
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/SKILL.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/pipeline.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/working-dir.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/seed-site-data.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/jurisdiction-detection.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/invoke-surveyor.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/research-restrictive-covenants.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/research-environmental.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/research-submarket.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/research-zoning-pathway.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/references/subject-location-gate.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/references/jurisdiction-detection.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/references/run-manifest.md`
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/references/synthesis-and-gap-recovery.md`

### Surveyor
- `surveyor/src/cli.ts` (esp. lines 266-270, 483-576)
- `surveyor/src/lib/parcels.ts` (esp. lines 28-29, 60-82, 84-109, 134-169)
- `surveyor/src/lib/document-search-log.ts:200-246`
- `surveyor/prompts/preamble-diligence.md:24-28`
- `surveyor/prompts/county-clerk.md:140-175`
- `surveyor/spec/document-search-coverage.md:11,61`

### Bureau feasibility guides
- `bureau/jurisdictions/atlanta/feasibility-guides/sduf.md:36,83`
- `bureau/jurisdictions/atlanta/feasibility-guides/zlu.md:127`
- `bureau/jurisdictions/atlanta/feasibility-guides/park.md:24,76`
- `bureau/jurisdictions/atlanta/feasibility-guides/wwp.md:30,57,86`

### Run-specific
- `diligence/atlanta-grocery-run-2/inputs/input-prompt.txt:4`
- `diligence/atlanta-grocery-run-2/seed-site-data.md` (esp. lines 5, 8, 10-12, 39-45, 64-70)
- `diligence/atlanta-grocery-run-2/run-manifest.json:24, 52`
- `diligence/atlanta-grocery-run-2/run-manifest/phase0.json:14-17, 33-39`
- `diligence/atlanta-grocery-run-2/sir/phase1-extraction/concept-plan-data.md:29, 45, 135`
- `diligence/atlanta-grocery-run-2/sir/phase2-research/*.md`
- `diligence/atlanta-grocery-run-2/sir/phase3-disciplines/*.md`
- `diligence/atlanta-grocery-run-2/sir/deliverable/pages.tsx:67, 231, 956-967, 1012`
- `diligence/atlanta-grocery-run-2/audit/multi-agent-audit-summary.md:58, 107-131`
- `surveyor/workspaces/atlanta-grocery-run-2/intermediate/site-plan-data.md:12`
- `surveyor/workspaces/atlanta-grocery-run-2/intermediate/document-search-log.jsonl`
- `surveyor/workspaces/atlanta-grocery-run-2/intermediate/recovery-doc-search-pass1.md:5`

### Companion notes
- `winston/workspaces/diligence/parcel-resolution-audit/research-notes.md` — full file:line trace (703 lines)
- `diligence/atlanta-grocery-run-2/audit/multi-agent-audit-summary.md` — upstream multi-agent audit covering downstream impacts

---

**End of audit. No fixes proposed; brainstorm phase to follow.**
