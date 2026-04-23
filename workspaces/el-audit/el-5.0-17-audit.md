# EL 5.0 #17 ("Electric Service Infrastructure Design") → 5.1 Audit

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/17.md` — *Electric Service Infrastructure Design* (23 checklist items: EL-17.1 – EL-17.23)

**5.1 commit:** `aed4f1b13e2fcdf3e9a0c1d2d28179ed92d7ed95` — *Update Austin review guides + glossary from training v5.1 (#245)* on `main` (branch `feat/inspection-alias-ui`)

**5.1 corpus searched:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` (all subdirs; `el-md-exp/` excluded)

## Summary

5.0 file #17 was a broad "show the electric infrastructure on every sheet" guide built around UCM § 1.4.2.6 (CAD / plan-sheet) and UCM § 1.16.0 (content requirements). In 5.1 the `el/` directory was consolidated from 20 files to 3, and the AEDC (not UCM) replaced UCM as the primary electric citation root. Most 5.0 #17 items survive in some form — largely **combined** into broader AEDC 1.16.0 "AutoCAD drawing content" checklist items in `el/3.md` (EL-3.11 in particular absorbs a large swath of the "show X on plans" 5.0 items). Coverage of POS designation on specific plan sheets, duct bank routing, trenching assignments, gas-service identification, separate "electric site plan," and "service type designation" appears removed or at best partial. Several pedestal/vault/street-light/street-light-conduit items are also dropped or only obliquely covered.

## Status counts

| Status | Count |
|---|---|
| retained | 0 |
| reworded | 2 |
| renumbered | 0 |
| moved-within-el | 3 |
| moved-cross-department | 0 |
| combined | 10 |
| split | 0 |
| removed | 6 |
| partial | 2 |
| **Total** | **23** |

(Counts reflect the **primary** classification for each 5.0 row. Items whose coverage in 5.1 is substantively thinner than 5.0 are classified `partial`; items whose concept still appears but folded into a broader 5.1 check are `combined`.)

## Main table

| 5.0 ID | Deficiency (truncated) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-17.1 | Point of electric service (POS) and primary source location not shown on required plan sheets per UCM § 1.4.2.6… | partial | el/3.md EL-3.11 | EL-3.11 requires the AEDC 1.16.0(1) georeferenced AutoCAD to show existing AE facilities but does not explicitly require POS be shown on site/landscape/electrical sheets. The 5.0 "one POS / one voltage" rule survives only in narrative, not as a checklist line. |
| EL-17.2 | Underground electric cabling routing, conduit locations, service lines not shown on required plan sheets… | combined | el/3.md EL-3.11; el/3.md EL-3.19 | 5.1 rolls "show underground electric on plans" into the generic AutoCAD-content check (EL-3.11) plus the coverage-extent check (EL-3.19). No dedicated cable-routing item remains. |
| EL-17.3 | Transformer locations or transformer pads not shown on required plan sheets… | combined | el/3.md EL-3.11; el/2.md EL-2.22; el/3.md EL-3.7 | "Show transformers" is now implicit in EL-3.11 (AutoCAD content). EL-2.22 covers pad sizing/clearances/easement; EL-3.7 covers AE approval for transformer/pull-box design. The "on every required sheet" requirement is dropped. |
| EL-17.4 | Electric meter locations not shown on required plan sheets… | removed | — | No 5.1 checklist item requires meter locations on plans. AEDC 1.3.5 narrative mentions meter ownership; no deficiency statement maps to meter placement. |
| EL-17.5 | Poles or service drops not shown on required plan sheets… | combined | el/3.md EL-3.11; el/1.md EL-1.7 | Existing poles covered by EL-3.11 (AutoCAD content: guys/anchors/poles). Service-drop clearance covered by EL-1.7 but neither explicitly requires poles/service drops be shown on every required sheet. |
| EL-17.6 | Duct bank routing and locations not shown on required plan sheets when required | removed | — | No 5.1 item references duct-bank routing. The duct-bank concept only appears incidentally in el/1.md EL-1.10 (joint-trench parallel runs) — a different deficiency. |
| EL-17.7 | Street lighting layout and light pole locations not shown on required plan sheets… | combined | el/3.md EL-3.18; el/3.md EL-3.20; el/3.md EL-3.22 | 5.1 has multiple street-light checks (coordination, labeling, spacing, conflicts) but no explicit "layout must be shown on required sheets" item. |
| EL-17.8 | Street light conduit plan, conduit connections, and routing not shown… | removed | — | Street-light conduit routing/connection plan is no longer a checklist item. 5.1 street-light items focus on pole coordination, labels, and conflicts — not conduit plans. |
| EL-17.9 | Projected electrical load not shown on plan sheets | partial | el/3.md EL-3.11 (implicit) | AEDC 1.16.0 narrative in el/3.md mentions "projected load" as AutoCAD content, but no standalone deficiency statement flags a missing load value. 5.0's dedicated load-not-shown item is effectively absorbed into EL-3.11's generic "required content" check — weaker coverage. |
| EL-17.10 | Master electrical plan not provided from MEP for multi-lot developments | removed | — | No 5.1 item addresses master electrical plans for multi-lot developments. |
| EL-17.11 | Service type (overhead or underground) not clearly designated on plans | removed | — | No 5.1 checklist item flags ambiguous service-type designation. Undergrounding *requirements* are covered extensively in el/2.md (EL-2.1–EL-2.8), but a "plans don't say which service type applies" check is gone. |
| EL-17.12 | Electrical vaults not shown on plans when required | removed | — | No 5.1 item flags missing vaults. el/1.md EL-1.4 handles vault vertical clearance from overhead lines, and Network-Area narrative appears in 5.0 only; no 5.1 vault-presence deficiency. |
| EL-17.13 | Electrical service pedestals not shown on plans when required | removed | — | UCM § 1.5.3.4 pedestal narrative survives in el/2.md context ("8-foot minimum clearance is required around all pedestals…" in licensing narrative), but no 5.1 checklist item flags missing pedestals. |
| EL-17.14 | Trenching assignments not shown on plans when underground electric work is required | removed | — | Customer-trenching-responsibility check has no 5.1 counterpart. |
| EL-17.15 | Plans do not indicate whether gas service is required or which components will use it | removed | — | No 5.1 electric checklist addresses gas-service identification. el/1.md EL-1.8 covers a different concern (TGS crossing clearance / coordination), not whether gas service is identified on plans. |
| EL-17.16 | Electric line extension not shown on plans when required for service | combined | el/3.md EL-3.1; el/3.md EL-3.10 | Line-extension narrative is rolled into ESPA submittal (EL-3.1) and easement/design coordination (EL-3.10). No dedicated line-extension deficiency. |
| EL-17.17 | Electric site plan not included in plan set or submitted separately in AB+C portal | removed | — | Concept of a separate "electric site plan" submittal no longer has a checklist item. |
| EL-17.18 | Electrical easement locations and extents not clearly delineated on plans | combined | el/3.md EL-3.11; el/3.md EL-3.10; el/2.md EL-2.15; el/2.md EL-2.16 | EL-3.11 requires easements in the AutoCAD; EL-3.10 covers easement recording coordination. EL-2.15/EL-2.16 cover easement conflicts and licensing. No single "easements not shown with dimensions" item. |
| EL-17.19 | Existing electric facilities (poles, guys, anchors, transformers) not shown | combined | el/3.md EL-3.11; el/3.md EL-3.8 | EL-3.11 explicitly requires existing AE facilities (transmission/distribution structures, guys, anchors, transformers) in the AutoCAD submittal. EL-3.8 handles guy-anchor vs. driveway conflicts. |
| EL-17.20 | One-Line Diagram of the electrical riser not included in plan set | removed | — | One-Line Diagram requirement has no 5.1 checklist item. The UCM § 1.4.2.6 Table 1.4.3.B plan-sheet list is entirely dropped from the el/ 5.1 corpus. |
| EL-17.21 | Plans do not demonstrate sufficient clearances for existing and proposed electric facilities | combined | el/1.md EL-1.2 – EL-1.7, EL-1.26 – EL-1.28; el/2.md EL-2.22 | All clearance specifics moved to el/1.md (Overhead/Vertical Clearances). 5.1 is substantially richer on specific clearance numbers than 5.0's single catch-all item. This is a **combined** mapping — coverage improved, not reduced. |
| EL-17.22 | Plans show multiple POS or multiple service voltages without approved exceptions | reworded | el/3.md EL-3.11 (narrative only) | The "one POS / one voltage" rule appears only in el/3.md regulatory-overview narrative for AEDC 1.16.0; no dedicated multi-POS deficiency statement survives. Close to removed but retained as narrative obligation. |
| EL-17.23 | CAD file not georeferenced to NAD 83 Texas Central Zone 4203 coordinate system | reworded | el/3.md EL-3.11 | EL-3.11 requires a "georeferenced AutoCAD drawing (version 2016 or newer)" per AEDC 1.16.0(1) but drops the specific NAD 83 Texas Central Zone 4203 requirement. Concept retained; specificity reduced. |

## Pattern observations

- **AEDC replaced UCM.** 5.0 used UCM § 1.4.2.6 / § 1.16.0 as the electric service authority; 5.1 uses AEDC 1.16.0(1) as the corresponding "AutoCAD drawing content" hook. Bureau's electric code source moved from the UCM (municipal code) to the Austin Energy Design Criteria directly.
- **Heavy consolidation into EL-3.11.** A single 5.1 deficiency (EL-3.11, "georeferenced AutoCAD drawing with all required content") absorbs roughly 7 distinct 5.0 items (EL-17.1, 17.2, 17.3, 17.5, 17.9, 17.18, 17.19, 17.23). This is efficient but loses the 5.0 per-sheet granularity (site/landscape/electrical/one-line).
- **Plan-sheet-matrix concept dropped.** 5.0 emphasized UCM § 1.4.2.6 Table 1.4.3.A (CAD layer/color table) and Table 1.4.3.B (required plan sheets: site, landscape, electrical, one-line). Neither the layer/color table nor the plan-sheet matrix appears anywhere in 5.1 `el/`. One-Line Diagram requirement (EL-17.20) and CAD-layer-color requirement (no 5.0 ID, but in narrative) are fully gone.
- **Six genuine removals.** EL-17.4 (meters), 17.6 (duct banks), 17.8 (street light conduit plan), 17.10 (master electrical for multi-lot), 17.11 (service type designation), 17.12 (vaults), 17.13 (pedestals), 17.14 (trenching), 17.15 (gas identification), 17.17 (separate electric site plan), 17.20 (one-line diagram) — 11 items in total trend toward "removed" or "weakly partial." Training v5.1 appears to have dropped items the historic-comment training data didn't reinforce strongly, in favor of the broader "submit complete AutoCAD per AEDC 1.16.0" umbrella.
- **Clearance topics *expanded*.** EL-17.21 (generic clearance sufficiency) corresponds to ~10+ specific 5.1 items in el/1.md, so overhead/underground clearance coverage is richer in 5.1, not thinner.

## Key findings / surprises

1. **Zero fully "retained" items** — every 5.0 #17 item was either reworded, folded into a broader 5.1 item, or dropped. This is a rewrite, not a touch-up.
2. **One-Line Diagram requirement is gone.** UCM § 1.4.2.6 Table 1.4.3.B mandates it; the 5.1 el/ corpus has no checklist item for it. If the training pipeline intended to keep it, this is a regression worth flagging.
3. **CAD layer/color compliance is gone.** The "Elec. UG / Elec. OH / Elec. Pole / Magenta" layer-table rules (UCM § 1.4.2.6 Table 1.4.3.A) are nowhere in 5.1 el/.
4. **Service-type designation check dropped.** Whether plans say "overhead" vs. "underground" is no longer flagged — this is a common submittal defect historically.
5. **Gas-service identification dropped entirely.** EL-17.15 does not map to the TGS-crossing clearance in el/1.md EL-1.8 — those are distinct deficiencies.
6. **Vault and pedestal "when required" items dropped.** These relied on AE Design documentation lookups; 5.1 may have considered them under-determinable from plans alone, but no checklist trace remains.
7. **Heavy narrative-only coverage.** "One POS / one voltage" and "projected load on plans" appear in 5.1 el/3.md regulatory overview but not as numbered deficiencies — agents may not surface these as findings.
