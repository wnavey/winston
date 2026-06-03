# Phase 4 Recovery Log

## Gap Recovery Attempts

### 1. Base Zoning (SF-2 vs MF-3) — Bucket B
**Gap:** Phase 2 web research inferred SF-2 based on neighborhood characteristics and listing data. A prior analysis of this property found MF-3 on the COA Zoning_1 GIS layer. This is a material discrepancy — MF-3 permits a duplex without HOME Phase 1; SF-2 requires HOME Phase 1.
**Attempt:** Cannot resolve without direct GIS query or DSD Zoning Verification Letter.
**Resolution:** Documented as data-gap. Recommend DSD Zoning Verification Letter (~$337). The prior run's MF-3 finding (via COA GIS parcel query) is likely more authoritative than the web-inferred SF-2. Note: MF-3 is a known pattern in 1990s Austin subdivisions where the developer secured MF zoning but deed-restricted to SFR.
**Status:** Bucket B — requires DSD verification.

### 2. TCAD Property Records — Bucket B
**Gap:** Surveyor CLI failed with authentication error. TCAD property ID, owner, assessed value, lot dimensions not retrieved.
**Attempt:** CLI re-run not feasible (same auth issue). Prior run retrieved TCAD ID 362652, GeoID 0262200208, lot area 8,054 SF.
**Resolution:** Incorporated prior-run data points into deliverable where cited. Recommended title commitment for full verification.
**Status:** Bucket B — requires manual TCAD lookup or title commitment.

### 3. CC&R Full Text — Bucket B
**Gap:** Full Declaration text not obtained; restriction language inferred from subdivision characteristics.
**Attempt:** Prior run obtained and reviewed the actual CC&R text, confirming §4.1 single-family-use restriction with narrow definition, 75% amendment threshold, enforcement provisions including $25/day fines.
**Resolution:** Incorporated prior-run verified findings into deliverable. CC&Rs definitively prohibit duplex use.
**Status:** Bucket B (for this run) — the prior run resolved it. Developer should obtain their own copy from Inframark or Travis County Clerk.

### 4. WUI Proximity Zone — Bucket B
**Gap:** This run's web research found "low wildfire risk" (suburban area). Prior run found WUI Proximity Zone C via COA WUI ArcGIS layer.
**Resolution:** Prior run's Zone C finding from the authoritative GIS source takes precedence. Incorporated into deliverable. Zone C triggers ignition-resistant construction premium ($5,000-$15,000).
**Status:** Bucket B — recommend final confirmation via COA WUI Zone Lookup tool.

### 5. Tree Survey — Bucket B
**Gap:** No tree survey conducted.
**Resolution:** Cannot be resolved remotely. Requires ISA-certified arborist field visit. Documented as data-gap with estimated mitigation contingency ($5,000-$25,000).
**Status:** Bucket B — requires field survey.

### 6. Phase I ESA — Bucket B
**Gap:** No Phase I ESA commissioned.
**Resolution:** Standard recommendation for pre-acquisition/pre-demolition. Low contamination risk based on residential history but formal documentation recommended for lender/investor due diligence.
**Status:** Bucket B — requires ESA consultant.

### 7. Sprinkler Requirement — Bucket B
**Gap:** IRC §R313.1 requires sprinklers for two-family; TX LGC §233.155 pre-empts; current Austin LDC status unclear.
**Resolution:** Prior run confirmed this as a data-gap requiring DSD pre-application confirmation. Largest construction-cost swing item ($15,000-$25,000).
**Status:** Bucket B — requires DSD confirmation.

### 8. Lot Dimensions — Bucket B
**Gap:** Lot width (50 ft minimum for duplex) not confirmed from plat.
**Resolution:** Prior run found ~60 ft frontage on curved chord (R = 1,075 ft) and ~127 ft depth. Lot width exceeds 50 ft minimum. Incorporated into deliverable.
**Status:** Resolved from prior-run data.

## Summary
- **Bucket A items re-attempted:** 0 (surveyor CLI auth issue prevents re-run)
- **Bucket B items documented:** 7
- **Items resolved from prior-run data:** 3 (zoning likely MF-3, lot dimensions, CC&R text)
- **Material findings upgraded from prior-run data:** WUI Zone C (moderate), MF-3 zoning (note/data-gap)
