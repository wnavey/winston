# Surveyor Geocoder Gap — Root Cause of Wrong-Location GIS Cascades

**Filed:** 2026-06-10
**Repo:** `noetic/surveyor`
**Severity:** SIGNIFICANT — silently produces parcel-fictional research outputs that downstream phases cannot detect.
**Evidence runs:**
- Run 1 (correct): `surveyor/workspaces/parkland-magnolia-parkway/` (Pearland, TX — 2026-06-08)
- Run 2 (incorrect): `surveyor/workspaces/seed-pearland-tx/` (same parcel — 2026-06-09)

Companion analysis: `diligence/comparison/agent-1-surveyor-comparison-findings.md` and `diligence/comparison/final-comparison.md`.

---

## TL;DR

The surveyor's research phase has a hidden requirement to resolve the property address to a WGS84 lat/lon. **There is no MCP tool for this**, so the agent improvises. Sometimes it shells out to the Census Geocoder via `curl` in the Bash tool (correct). Sometimes it hand-types coordinates from prior knowledge (often wrong). When the hand-typed point is wrong, every downstream point-based GIS query (Pearland GIS, FEMA NFHL, TxDOT, Census tract, QOZ) returns coherent-sounding facts about the *wrong polygon*, and no instrumentation downstream can detect the drift.

Two back-to-back runs of the same property (same address, same survey PDF, same surveyor code) produced points 4 km apart because of this. The resulting Run 2 diligence narrative invented a Mary's Creek crossing, MUD No. 2 inclusion, 23,709 AADT and 4-lane Magnolia Pkwy frontage, FIRM panel 0040K, Silverlake neighbors, and an Urban Living + TR + NAT FLU triad — all describing a Silverlake-area parcel ~4 km east of the real subject parcel.

**Fix:** add a real `census_geocode` (or equivalent) MCP tool; require its use in the Pearland field guide; sanity-check the resolved point against the CAD parcel polygon; persist resolved coordinates + provenance to `intermediate/`.

---

## 1. Where the address-to-coordinates step belongs

The surveyor's `prompts/research.md` describes a six-step research procedure. Step 4 ("Property Profile", `research.md:39–43`) requires calling tools like `pearland_property_profile` and `pearland_zoning_lookup`. Those tools — and the entire FEMA / TxDOT / Census fan-out the field guide instructs the agent to perform — accept only WGS84 lat/lon, never an address or parcel ID. Confirmed at `src/sources/pearland-gis/property-profile.ts:96–100` (`Number(args.lat) / Number(args.lon)` and abort if not finite).

For Harris County parcels, the chain `hcad_search` → `hcad_parcel_lookup` returns a WGS84 centroid from HCAD's ArcGIS layer. That path is deterministic.

For Brazoria County parcels — which is what the Pearland Magnolia Parkway property is — `brazoria_cad_*` returns the propertyId, the legal description, and the values, **but no geometry**. The Pearland field guide acknowledges this at `jurisdictions/pearland-tx.md:88–92`:

> **Centroid availability:** only `hcad_parcel_lookup` returns a parcel centroid directly. For **Brazoria** parcels, `brazoria_cad_*` returns no geometry — geocode the site address (e.g. Esri World Geocoder or census geocoder) to obtain a WGS84 point before calling `pearland_*` / FEMA / TxDOT / census.

**That instruction names tools that don't exist in the surveyor inventory.** I searched the source list (`find src/sources -name 'geocode*' -o -name 'index.ts' | xargs grep -l geocod`). The only geocoder modules that exist are jurisdiction-specific to *other* cities:

- `src/sources/nb-gis/geocode.ts` — `nb_geocode` (New Braunfels locComposite GeocodeServer)
- `src/sources/nyc-geosearch/geocode.ts` — `nyc_geocode_address` (NYC DCP Pelias)

There is no `census_geocode`, no `nominatim_geocode`, no `esri_world_geocoder`, and the Pearland source set (`hcad-gis`, `brazoria-cad`, `pearland-gis`, `harris-county-clerk`, `brazoria-county-clerk`, `fema-nfhl`, `txdot`, `census-qoz`) does not include any of them. The `census-qoz` module exposes only `census_tract_lookup` and `qoz_lookup` — both *consumers* of lat/lon, not producers.

---

## 2. Evidence — what each run actually did

I parsed `workspaces/{run}/logs/phase-2-research.log` as JSONL and extracted the assistant's ordered tool calls plus the lat/lon arguments passed to point-based tools.

### Run 1 (parkland-magnolia-parkway) — recognized the gap

```
03  mcp__surveyor__append_note            (plan: CAD search → details → profile → ...)
04  mcp__surveyor__brazoria_cad_search    query="12501 Magnolia Parkway"
05  mcp__surveyor__brazoria_cad_search    query="HABARI TRUST"
06  mcp__surveyor__brazoria_cad_details   propertyId=179020
07  mcp__surveyor__brazoria_cad_details   propertyId=711006
08  Bash  curl "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
              ?address=12151+Magnolia+Parkway+Pearland+TX+77584
              &benchmark=Public_AR_Current&format=json"
09  Bash  curl "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
              ?address=12151+CR+59+Pearland+TX+77584..."
10  mcp__surveyor__pearland_property_profile  lat=29.540891 lon=-95.412766
11  mcp__surveyor__pearland_zoning_lookup     lat=29.540891 lon=-95.412766
12  mcp__surveyor__fema_flood_profile         latitude=29.540891 longitude=-95.412766
13  mcp__surveyor__txdot_roadway_lookup       latitude=29.540891 longitude=-95.412766
14  mcp__surveyor__census_tract_lookup        latitude=29.540891 longitude=-95.412766
15  mcp__surveyor__qoz_lookup                 latitude=29.540891 longitude=-95.412766
```

The Run 1 agent noticed that `brazoria_cad_*` returned no geometry, **shelled out to the U.S. Census Geocoder via `curl` in the general-purpose Bash tool** (events 08–09), got `(29.540891, -95.412766)`, and used it for the entire point-based cascade.

Two further details:
- The agent geocoded `12151` (the CAD-recorded street number) rather than `12501` (the survey's title-block street number). It identified the address discrepancy on its own.
- I independently re-verified the resolved point: Nominatim returns `(29.5409, -95.4128)` for `12151 Magnolia Pkwy Pearland TX` — exact match.

### Run 2 (seed-pearland-tx) — did NOT geocode

```
00  Bash  cat .../site-plan-data.md
01  mcp__surveyor__brazoria_cad_search   query="12501 Magnolia Parkway"
02  mcp__surveyor__brazoria_cad_search   query="HABARI TRUST"
03  mcp__surveyor__brazoria_cad_details  propertyId=179020
04  mcp__surveyor__brazoria_cad_details  propertyId=711006
05  Bash  ls .../workspaces/seed-pearland-tx/
06  Bash  ls .../intermediate/ ...site-plans/
07  Bash  ls .../site-plans/seed-pearland-tx/
08  Bash  find .../seed-pearland-tx/ -type f | head -50
09  Bash  cat .../research-findings.jsonl | head -50
10  mcp__surveyor__pearland_zoning_lookup     lat=29.54683 lon=-95.36833   ← FIRST APPEARANCE
11  mcp__surveyor__fema_flood_lookup          latitude=29.54683 longitude=-95.36833
12  mcp__surveyor__pearland_property_profile  lat=29.54683 lon=-95.36833
13  mcp__surveyor__fema_flood_profile         latitude=29.54683 longitude=-95.36833
14  mcp__surveyor__txdot_roadway_lookup       latitude=29.54683 longitude=-95.36833
15  mcp__surveyor__census_tract_lookup        latitude=29.54683 longitude=-95.36833
16  mcp__surveyor__qoz_lookup                 latitude=29.54683 longitude=-95.36833
```

Across the entire Run 2, the Bash tool was used 6 times — all `ls` / `find` / `cat` for file inspection, **zero `curl` calls to any geocoder.** The coordinates `(29.54683, -95.36833)` appear for the first time at event 10, hand-typed by the LLM with no preceding lookup. They are not present in `intermediate/site-plan-data.md`, not returned by any earlier tool, and not derivable from the CAD details (which carry only the street-address string `12151 MAGNOLIA PKWY` and a Brazoria propertyId).

The Run 2 agent also emitted **zero text/reasoning blocks** before event 10 — it went directly from file inspection to point-based GIS queries with no explanation for the coordinate choice.

### How wrong was Run 2?

| Datum | Run 1 (correct) | Run 2 (wrong location) |
|---|---|---|
| Lat/Lon | (29.5409, -95.4128) | (29.5468, -95.3683) — ~4 km east |
| Watershed | **Clear Creek** | Marys Creek |
| FIRM panel | **48039C0020K** (matches survey title block exactly) | 48039C0040K (attributed by Run 2 to "tile boundary"; actually wrong-point) |
| MUD at parcel | **None**; MUD #34 abuts north | "MUD No. 2 — ETJ / MANVEL" reported at parcel |
| Magnolia Pkwy AADT | 10,835 (2022) | 23,709 (2021) — different roadway segment |
| Magnolia Pkwy lanes | 2 (today), planned widen to 100' | "4 (divided), 100' already" — different segment |
| Adjacent subdivisions | Southern Trails PUD Sec 11 | Silverlake Townhomes / Gardens / Springbrook (wrong neighbors) |
| Census tract | 48039660611 (Tract 6606.11) | 48039660703 (Tract 6607.03) |
| Corridor overlay | Magnolia Pkwy Corridor Overlay at frontage | "No corridor overlay" (wrong point misses it) |
| FLU 2040 | Compact Residential interior + TR strip at frontage | TR + Urban Living + Natural Areas (3-way split) |

Run 2's narrative is internally coherent — every point-based tool faithfully reported what's at `(29.5468, -95.3683)`. The narrative is just **fiction for the subject parcel**.

---

## 3. Why the variation happens

Two consecutive runs against identical inputs produced points 4 km apart. The git log shows nothing GIS-related changed between them:

```
65e0fe4 2026-06-09  spec: document standalone server entry + shared vision_transcribe tool (#69)
00354bc 2026-06-09  Prospector wave: Bend, OR — Deschutes County source module (#68)
37c3085 2026-06-08  Rebuild Brazoria County Clerk source as working browser-backed module (#67)
880b22b 2026-06-08  Prospector wave: Pearland, TX — sources (Surveyor modules) (#66)
```

PR #66 added the Pearland sources used by both runs. PR #67 rebuilt the Brazoria County Clerk module — irrelevant to coordinate resolution. PR #68 added a different jurisdiction (Bend, OR). PR #69 added a `vision_transcribe` spec doc.

**The Pearland GIS code and Brazoria CAD code are byte-identical between the two runs.** Both runs were given the same `intermediate/site-plan-data.md` (modulo workspace-name labeling) and the same Exhibit A survey PDF.

The variation is purely model behavior on an instruction the pipeline doesn't enforce. The pipeline's three pieces conspire to make the outcome a coin flip:

1. **The Pearland field guide** (`jurisdictions/pearland-tx.md:88–92`) tells the agent to "geocode the site address (e.g. Esri World Geocoder or census geocoder)" — but names no MCP tool that actually does this.
2. **The research prompt** (`prompts/research.md:35–41`) describes Step 3 as "Parcel Lookup" that returns parcel geometry — which works for Harris County (`hcad_parcel_lookup`) and silently fails for Brazoria.
3. **The general Bash tool** is available to an enterprising agent, who *could* shell out to `curl https://geocoding.geo.census.gov/...` — but isn't told to.

Whether a given run gets correct coordinates depends entirely on whether the LLM:
- Notices the gap between "needs a point" and "no centroid tool",
- Remembers the Census Geocoder URL and query format,
- Decides Bash+curl is an acceptable workaround.

Run 1's agent did all three. Run 2's did none. There is no deterministic step that would have caught the drift — no required tool call, no sanity check, no post-condition assertion.

---

## 4. Why downstream phases can't detect the drift

Once the agent has a (possibly wrong) point, every Pearland / FEMA / TxDOT / Census layer faithfully reports what's at that point. They don't know it's the wrong point — they just answer truthfully about the polygon they cover.

The surveyor's `output/facts.md` and `intermediate/research-findings-injected.md` then ingest those answers as natural-language assertions ("the parcel is in BCMUD No. 2", "Mary's Creek crosses Magnolia Pkwy at the property", "FIRM panel 48039C0040K"). The original coordinates are never re-emitted in those files. There is no coordinate-provenance field anywhere in `intermediate/` or `output/`.

When the diligence-report skill consumes the surveyor's outputs as its `seed-site-data.md`, the coordinate question is already resolved. Phases 1 (extraction), 2 (research), 3 (disciplines), and synthesis don't re-query GIS — they work from the surveyor's already-baked prose. The diligence-report skill therefore has no way to detect "these facts were sampled at the wrong polygon" because it never sees raw coordinates, only the downstream prose derived from them.

This is why the Run 2 diligence report's Bottom Line confidently asserts that *"Mary's Creek runs through (or abuts) the parcel and is under active Brazoria Drainage District No. 4 (BDD#4) channel-improvement construction"* as a top-level strategic finding. The discipline-level files (sde.md, fwp.md) repeat the same parcel-fictional framing. Every layer of synthesis amplifies the error.

---

## 5. Fix

Four changes close this whole class of bug.

### 5a. Add a real `census-geocoder` source module

Wrap the U.S. Census Geocoder one-line endpoint:

```
https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
  ?address={url-encoded address}
  &benchmark=Public_AR_Current
  &format=json
```

Free, no API key, national coverage, returns lat/lon in WGS84. Expose as MCP tool `census_geocode_address(address: string)` that returns `{lat, lon, matched_address, match_score}` or `null` if no match. Pattern after `src/sources/nb-gis/geocode.ts` for structure.

Optional secondary: a Nominatim wrapper with appropriate User-Agent and rate-limit politeness, as a fallback.

### 5b. Require its use in the Pearland field guide

Update `jurisdictions/pearland-tx.md` to replace the vague "(e.g. Esri World Geocoder or census geocoder)" hint with a concrete required step:

> **For Brazoria parcels, call `census_geocode_address(address)` BEFORE any point-based GIS lookup.** Use the address from the CAD details (not the customer-supplied address — they may disagree, as on the Habari Magnolia Pkwy property where CAD records 12151 vs survey shows 12501). Persist the resolved lat/lon to your reasoning notes.

Add `census-geocoder` to the `sources:` list at the top of the file.

### 5c. Sanity-check the resolved point against the CAD parcel polygon

`brazoria_cad_*` doesn't currently return geometry, but Brazoria's parcel layer exists at the Brazoria County GIS endpoint and *can* be queried for the parcel polygon by propertyId. Add a `brazoria_cad_parcel_polygon(propertyId)` tool (or extend `brazoria_cad_details` to optionally include polygon WKT), then:

- After `census_geocode_address` returns a point,
- Query the parcel polygon by propertyId,
- Verify the resolved point falls within the polygon (or within, say, 100 m of it),
- **Abort the run with a hard error if the sanity check fails.** Don't proceed to point-based GIS calls with an unverified point.

If a parcel polygon truly isn't available (some smaller counties), fall back to a stricter requirement on geocoder match score (e.g., score ≥ 95) and surface the lower-confidence as a finding for human review.

### 5d. Persist coordinate provenance in `intermediate/`

Today there is no record of how a point was derived. Add a `coordinate_provenance.json` (or a top-of-file YAML frontmatter on `site-plan-data.md`) emitted by phase 2 that captures:

```json
{
  "lat": 29.540891,
  "lon": -95.412766,
  "source": "census_geocode_address",
  "queried_address": "12151 Magnolia Parkway Pearland TX 77584",
  "match_score": 100,
  "cad_parcel_polygon_check": "passed",
  "alternative_addresses_tried": ["12501 Magnolia Parkway Pearland TX 77584"]
}
```

This gives every downstream phase (and every human auditor) a one-glance way to confirm that the GIS cascade was anchored to the correct point. It also gives future surveyor improvements (or post-mortems like this one) something to assert against.

---

## 6. How to detect this bug in past runs

The signature is mechanical. For any past surveyor run, this Python snippet over the JSONL log will surface it:

```python
import json
path = "surveyor/workspaces/<run>/logs/phase-2-research.log"
with open(path) as f:
    has_geocoder = any(
        "geocoding.geo.census.gov" in c.get("input", {}).get("command", "")
        or "nominatim" in c.get("input", {}).get("command", "").lower()
        for line in f
        for c in (json.loads(line).get("message", {}).get("content", []) or [])
        if c.get("type") == "tool_use" and c.get("name") == "Bash"
    )
```

If `has_geocoder` is `False` for a Brazoria-county run (or any non-Harris run in the Pearland jurisdiction), the run almost certainly used hand-typed coordinates and should be re-verified. Cross-check the first lat/lon in any `pearland_*` / `fema_*` / `txdot_*` tool call against an external geocoder (Nominatim is free).

---

## 7. Why this matters beyond Pearland

The same gap exists for every jurisdiction that:

- Uses an appraisal district that doesn't return parcel geometry (most Texas CADs other than HCAD), AND
- Has city / county GIS layers that require lat/lon input, AND
- Doesn't have a city-specific geocoder source module wired in.

By inspection that's most of the Texas jurisdictions in the surveyor inventory other than the NYC and New Braunfels carve-outs. The fix is to add the Census geocoder as a *national* fallback (analogous to how `census-qoz` is a national source), require it in every jurisdiction field guide that depends on lat/lon, and gate downstream point-based calls behind a sanity-check.

---

## 8. Suggested follow-up beads

(For when this is picked up off the backlog.)

1. **surveyor: add `census-geocoder` national source module** — implement `census_geocode_address` MCP tool wrapping `geocoding.geo.census.gov/geocoder/locations/onelineaddress`. P1.
2. **surveyor: require `census_geocode_address` in Pearland field guide** — update `jurisdictions/pearland-tx.md` to make geocoding an explicit named step. Add `census-geocoder` to `sources:`. P1.
3. **surveyor: parcel-polygon sanity check** — extend `brazoria_cad_details` (and Brazoria CAD source) to return parcel polygon; gate downstream point-based calls behind a point-in-polygon check. P2.
4. **surveyor: persist coordinate provenance** — phase 2 must emit `intermediate/coordinate_provenance.json` (or YAML frontmatter on `site-plan-data.md`). P2.
5. **surveyor: audit all Texas jurisdiction guides for the same gap** — replicate fixes for any other field guide that gestures at "geocode the address" without naming a tool. P2.
6. **surveyor: lint check for "use Esri or census geocoder" pattern** — CI lint that flags any field guide referencing a tool not in the source manifest. P3.

---

**Author:** auto-generated by the comparison work in `diligence/comparison/`, 2026-06-10. See companion files there for the full diligence-report comparison context (Run 1 v4.0 vs Run 2 unedited).
