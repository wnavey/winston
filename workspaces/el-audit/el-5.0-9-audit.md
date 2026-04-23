# Audit: EL-5.0 Guide 9 — "Electric Service Submittal Forms and Documentation"

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/9.md` (worktree at commit `ced6e10`)
**5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` on branch `feat/inspection-alias-ui`; most recent el/ update at commit `aed4f1b` ("Update Austin review guides + glossary from training v5.1 (#245)")
**5.1 el/ files:** `el/1.md` (Overhead/Vertical Clearances), `el/2.md` (Underground Utility Routing), `el/3.md` (AE Service & ROW Utility Coordination). `el-md-exp/` excluded per instructions.

## Summary

5.0 el/9 was a 50-row checklist organized around four submission buckets: (a) the ESPA (items 1–13); (b) AE land-development submittal artifacts — forms, GFA, CAD, Distribution Plan, profiles (items 14–32); (c) coordination approvals and financial responsibility acknowledgements (items 33–40); (d) plat notes, clearances, easements, and violation-pattern self-certification flags (items 41–50).

In 5.1, this material was consolidated primarily into **el/3.md** ("Austin Energy Service and ROW Utility Coordination"), with secondary landings in **el/1.md** (transmission/clearance-heavy items) and **el/2.md** (transformer pad, underground trenching, parkland-in-transmission-easement). The retraining compressed many granular ESPA checks into a single ESPA item (EL-3.1), and it dropped or absorbed many operational/documentation artifacts (case number, address-verification letter, estimated service date, SMART Housing waiver documentation, fee, service verification letter, AE Submittal Form, AE Standard Notes Form, full-scale plan copy, switchgear/pad-mount coordination, proximity survey, AE approved O/H-to-U/G detail, Core Transit Corridor OH-relocation work order) that were treated as training artifacts the reviewer would not reliably catch from plan data alone. Several items were recast as pattern warnings inside 5.1's Regulatory Overview rather than as standalone checklist rows.

The single largest surprise: the entire "self-certification violation pattern" group (5.0 items EL-9.48 / EL-9.49 / EL-9.50) was dropped from the checklist, although the concept survives in the Regulatory Overview prose of el/3. Also removed outright: the substation-capacity check (EL-9.22), the 48-hour-notice documentation check for work near high-voltage overhead lines (EL-9.43), and the self-determined service-characteristics flag (EL-9.48) — all of which were prominent in 5.0.

## Status counts

- retained: 0
- reworded: 3 (EL-9.14, EL-9.20→partial, EL-9.41)
- renumbered: 0
- moved-within-el: 2 (EL-9.34, EL-9.42)
- moved-cross-department: 0
- combined: 9 (EL-9.1–9.13 all collapse into EL-3.1; EL-9.23 also rolls in)
- split: 0
- removed: 30
- partial: 6

## Main audit table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-9.1 | ESPA form not submitted to AE to initiate electric service design | combined | el/3 EL-3.1 | 5.1 collapses the ESPA submission, field-completeness, and updates checks into a single EL-3.1 item. |
| EL-9.2 | Point-of-service location not provided with ESPA | combined | el/3 EL-3.1 | Field-level ESPA content check absorbed into EL-3.1 narrative ("ESPA approval not documented"). No dedicated row. |
| EL-9.3 | Projected electrical load not provided with ESPA | combined | el/3 EL-3.1 | Same as EL-9.2. |
| EL-9.4 | Case number not included with ESPA | removed | — | Procedural/administrative field check dropped. |
| EL-9.5 | Address verification letter not submitted with ESPA | removed | — | Dropped; addressing handled by EL-3.30 / EL-3.31 but for a different purpose. |
| EL-9.6 | Estimated service date not provided with ESPA | removed | — | Dropped. |
| EL-9.7 | Correct address not confirmed; 9-1-1 approved address mismatch | partial | el/3 EL-3.31 | 5.1 EL-3.31 covers addressing-plan approval but not multi-address ESPA reconciliation; narrow concept only partially preserved. |
| EL-9.8 | Updated ESPA not submitted when previous ESPA has expired | combined | el/3 EL-3.1 | Re-submission condition absorbed into EL-3.1. |
| EL-9.9 | ESPA not submitted for building expansion | combined | el/3 EL-3.1 | Scope trigger absorbed into EL-3.1 applicability. |
| EL-9.10 | Separate ESPA not submitted for each building in multi-building project | combined | el/3 EL-3.1 | Multi-building ESPA rule absorbed. |
| EL-9.11 | Separate ESPA not submitted for each unit in multi-unit project | combined | el/3 EL-3.1 | Reviewer Convention; absorbed. |
| EL-9.12 | Updated ESPA not submitted when site design has changed significantly | combined | el/3 EL-3.1 | Absorbed. |
| EL-9.13 | ESPA not submitted when adding load to existing site | combined | el/3 EL-3.1 | Absorbed into EL-3.1's "new or modified electrical service" applicability. |
| EL-9.14 | Design Intake Form not submitted to AE through AB+C portal | reworded | el/3 EL-3.1; el/3 EL-3.7 | Specific AB+C Design Intake Form concept not preserved by name; general AE coordination/approval carried forward. Partial mapping. |
| EL-9.15 | Signed AE Submittal Form not provided | removed | — | Artifact-level form check dropped. Reviewer Convention citation in 5.0. |
| EL-9.16 | Signed AE Standard Notes Form not provided | partial | el/3 EL-3.6 | Standard AE Notes requirement survives as plan-notes check (EL-3.6), but the "signed form" artifact is not preserved. |
| EL-9.17 | Full-scale copy of entire site plan not provided for AE review | removed | — | Submittal-logistics check dropped. |
| EL-9.18 | Electrical load calculations / demand projections not provided to AE | partial | el/3 EL-3.1; el/3 EL-3.11 | EL-3.11 requires georeferenced CAD with projected load + facility space; load-calc artifact not separately itemized. |
| EL-9.19 | Voltage and service-size specifications not provided to AE | partial | el/3 EL-3.1; el/3 EL-3.11 | Absorbed into ESPA submission and AEDC 1.16.0(1) content check. |
| EL-9.20 | Total GFA not provided on site plan for AE grid load monitoring | removed | — | GFA-specific check dropped; not present in el/1, el/2, or el/3. |
| EL-9.21 | Existing electric service capacity not verified adequate for proposed load | partial | el/3 EL-3.1 | Concept folded into ESPA applicability ("modified electrical service"); no standalone capacity verification row. |
| EL-9.22 | Substation capacity not verified adequate near capacity-limited substation | removed | — | Dropped. No substation-capacity checklist item in 5.1 el/. |
| EL-9.23 | Proof of correspondence with AE Design approving preliminary design not submitted | combined | el/3 EL-3.1; el/3 EL-3.2 | EL-3.2 (AEU clearance/approval not obtained) is the closest surviving proxy. |
| EL-9.24 | Letter from AE stating service can be provided and identifying easements/upgrades | partial | el/3 EL-3.3 | EL-3.3 covers the Electric Service Availability Letter from AE Public Involvement, but only when the serving utility is in question; broader "service confirmation + upgrade identification" letter concept is narrower in 5.1. |
| EL-9.25 | Agent/Owner Authorization Letter explicitly stating "Austin Energy" not provided | removed | — | Dropped. |
| EL-9.26 | Work order / cost estimate from AE for overhead relocation on Core Transit Corridor frontage | removed | — | The CTC/overhead-relocation requirement itself is covered by el/2 EL-2.3 (ROW undergrounding), but the specific "AE work order / cost estimate in file" artifact check is not preserved. |
| EL-9.27 | CAD files not submitted for AE Transmission Engineering review | partial | el/3 EL-3.11 | EL-3.11 requires AutoCAD with existing AE transmission facilities, but the transmission-engineering-specific submittal routing is not separately called out. |
| EL-9.28 | AutoCAD drawings not submitted in version 2016 or newer | partial | el/3 EL-3.11 | Version-2016-or-newer requirement is carried forward inside EL-3.11's compound check, not as a standalone row. |
| EL-9.29 | AutoCAD drawings not submitted to AE reviewer for transmission line review | removed | — | Transmission-review routing-specific check dropped. |
| EL-9.30 | Profile design of crossing infrastructure not in CAD when crossing AE transmission line | removed | — | Dropped. No "profile of transmission crossing" checklist item in 5.1 el/. |
| EL-9.31 | AE Distribution Plan not submitted separate from site plan when modifying existing AE facilities | removed | — | Dropped. |
| EL-9.32 | Profile plans not submitted for electrical facilities interacting with drainage features | removed | — | Dropped. Item EL-1.12 covers utility-crossing method designation but does not address electric-into-drainage profiles. |
| EL-9.33 | AE-approved detail for overhead-to-underground electric conversion not provided | removed | — | Dropped. Conceptually adjacent to el/2 EL-2.3 ROW undergrounding but the specific "AE-approved detail" artifact is not checked. |
| EL-9.34 | AE Design approval not obtained for underground electric trenching under detention ponds | moved-within-el | el/2 EL-2.10 | EL-2.10 prohibits utilities routed underneath detention/retention ponds (Reviewer Convention). Broadens from electric-specific to all utilities; no explicit "AE Design approval" sub-requirement. |
| EL-9.35 | Switchgear installation not coordinated with AE design lead | removed | — | Dropped. |
| EL-9.36 | Pad-mounted transformer installation not coordinated with AE design lead | partial | el/2 EL-2.22; el/3 EL-3.7 | 5.1 has a transformer-clearance/sizing/easement checklist (EL-2.22) and AE approval of transformer/pull-box design (EL-3.7), but the narrow "load triggers pad-mount → coordinate with AE design lead" framing is not preserved. |
| EL-9.37 | Developer responsibility not acknowledged for line extension | removed | — | Dropped. No line-extension financial acknowledgment row in 5.1 el/. |
| EL-9.38 | Developer responsibility not acknowledged for excess-facilities removal/relocation | removed | — | Dropped. |
| EL-9.39 | Developer responsibility not acknowledged for electric system upgrades | removed | — | Dropped. |
| EL-9.40 | Austin Energy Site Plan Review fee not provided | removed | — | Dropped. |
| EL-9.41 | Plat notes (i)–(viii) not included per UCM § 1.16.0(8) | reworded | el/3 EL-3.32 | EL-3.32 preserves all eight AEDC 1.16.0(8) plat notes verbatim — closest to a direct retention. Also folds in EL-9.42 (parkland prohibition). |
| EL-9.42 | Land within transmission easement incorrectly labeled / dedicated as parkland | moved-within-el | el/3 EL-3.32 | Merged into EL-3.32. Also touched by el/2 EL-2.13 (transformers/utility boxes in parkland, different concept). |
| EL-9.43 | 48-hour AE notification documentation not provided for work within 10 ft of HV overhead lines | removed | — | Dropped as a documentation-of-arrangements check. UCM 1.14.9's 48-hour pre-construction safety meeting for transmission survives in el/1 EL-1.18, but that targets demolition notes near transmission, not the H&S-Code §752.003 10-ft HV-overhead notification. |
| EL-9.44 | Proximity survey not provided showing customer facilities vs. AE primary voltage facilities | partial | el/1 EL-1.4 | EL-1.4 preserves the AE proximity-survey concept for vaults near overhead power lines, but the broader "AE-requested survey for any primary-facility proximity" trigger is narrower in 5.1. |
| EL-9.45 | Plans do not demonstrate sufficient clearances for existing/proposed electric facilities | partial | el/1 EL-1.26; el/3 EL-3.12 | el/1 now handles clearances through many specific rows (EL-1.2 through EL-1.28); generalized "sufficient clearances" statement preserved in EL-1.26 graphical delineation check. |
| EL-9.46 | Plans do not demonstrate sufficient electric easements or metes-and-bounds | partial | el/2 EL-2.15; el/3 EL-3.10 | EL-2.15 handles easement-vs-ROW conflict; EL-3.10 handles electrical-easement recording. Composite coverage; the specific "metes and bounds descriptions for additional easements" artifact is not a dedicated row. |
| EL-9.47 | Plans do not demonstrate AE personnel access to facilities | reworded | el/3 EL-3.12 | EL-3.12 preserves the AEDC 1.16.0(4) access-demonstration requirement almost verbatim with added truck-access dimensional criteria. |
| EL-9.48 | Service characteristics (voltage/phases/capacity) shown without AE Design approval | removed | — | Dropped from checklist. Concept survives only in el/3 Regulatory Overview narrative. |
| EL-9.49 | Multiple points of service / multiple voltages shown without AE Design/Spot&Conduit exception approval | removed | — | Dropped from checklist. el/3 Regulatory Overview mentions the AEDC 1.3.3 one-point-of-service rule but there is no checklist row. |
| EL-9.50 | SMART Housing line-extension fee waiver claimed without HPD documentation | removed | — | Dropped. SMART Housing waiver checks survive only in other departments (eptp/13.md for landscape fees), not for AE line-extension. |

## Patterns observed

- **ESPA micro-checks collapsed:** EL-9.1 through EL-9.13 (13 rows on ESPA submission, fields, updates, multi-building/multi-unit, expansion, load increase) all fold into a single 5.1 item (el/3 EL-3.1). This is the single biggest compression in the file.
- **"Financial responsibility acknowledgement" category dropped wholesale:** EL-9.37/38/39 (line extension, excess facilities, system upgrades), EL-9.40 (AE fee), EL-9.50 (SMART Housing waiver) all removed. 5.1 el/3 Regulatory Overview still explains the line-extension vs. excess-facilities distinction but no longer requires a specific developer-acknowledgement artifact in the plan set.
- **Self-certification violation patterns (EL-9.48/49/50) removed from checklist:** In 5.0 these were top-of-guide "Common Violation Patterns" made executable. In 5.1 they are demoted to narrative-only in el/3's Regulatory Overview.
- **Submittal-logistics artifacts dropped:** Signed AE Submittal Form (9.15), Signed AE Standard Notes Form (9.16), full-scale copy for AE (9.17), AE Site Plan Review fee (9.40), Service Verification Letter (9.24 broad form), Agent/Owner Authorization Letter (9.25), AE Distribution Plan (9.31), AE-approved OH-to-UG conversion detail (9.33), CTC overhead-relocation work order (9.26). This suggests the training run classified these as things a reviewer cannot reliably flag from plan data alone.
- **48-hour-notice check fragmented:** 5.0 had a single 48-hour item (9.43) anchored to Tex. H&S Code §752.003 / UCM 1.10.2(B). In 5.1 this is gone; the only surviving 48-hour reference is in el/1 EL-1.18, which is limited to pre-construction safety meetings before transmission-line demolition (UCM 1.14.9). The general HV-overhead 48-hour notification requirement has no checklist home.
- **Citation platform shift:** 5.0 cited "UCM §…" throughout; 5.1 el/3 uses "AEDC §…" for the same provisions, implying a code-namespace rename between training runs. Out of scope for this audit but would confuse a naive citation diff.
- **CTC overhead-to-underground:** the physical requirement is preserved in el/2 EL-2.3 (ROW undergrounding on CTC frontage) but every associated documentation check (work order / cost estimate / AE-approved detail) was dropped.
- No 5.0 items from this file migrated cross-department; the cross-department search (ESPA, AE coordination) returned only el/3.

Report path: `/Users/winston/workspace/winston/workspaces/el-audit/el-5.0-9-audit.md`
