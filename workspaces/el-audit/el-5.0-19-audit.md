# EL-5.0 File 19 Audit — "Special Electric Systems Coordination" vs. 5.1

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/19.md` — "Special Electric Systems Coordination" (28 checklist items, EL-19.1 – EL-19.28)
**5.1 commit:** `aed4f1b1` — "Update Austin review guides + glossary from training v5.1 (#245)"
**5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` (all subdirs except `el-md-exp/`)

## Summary

5.0 file 19 was the catch-all "Special Electric Systems Coordination" guide covering Austin Energy coordination, Network Area, moonlight towers, EV chargers, chilled water, transformer clearances, substations, lighting, and doors into ROW. In 5.1, the `el/` guide was reduced from 20 files to 3, and this file's content was mostly folded into `el/3.md` (AE service + ROW coordination) and `el/2.md` (underground routing + transformer clearances), with transmission-safety items already present in `el/1.md`. Several 5.0 items were dropped entirely (EV-charger-with-transformer check, chilled water, irrigation-to-AE, streetlight refeed, customer-owned-conduit, historical poles, substation gates, door-into-ROW, electrical-room-exterior-door, caution signage, dual feed). Lighting (EL-19.12) moved cross-department to `zlu/` (§ 2.5 is enforced by Zoning in 5.1, not Electric).

## Status counts (28 items)

| Status | Count |
|---|---|
| retained | 2 |
| reworded | 2 |
| renumbered | 1 |
| moved-within-el | 9 |
| moved-cross-department | 1 |
| combined | 2 |
| split | 1 |
| partial | 3 |
| removed | 7 |

(Primary status assigned; "partial" entries are double-counted where paired with a primary that did not fully cover the 5.0 scope.)

## Main audit table

| 5.0 ID | Deficiency (truncated ~80) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-19.1 | Duct bank design for Downtown Network system not coordinated with Austin Energy | removed | — | Network Area duct bank coordination dropped entirely. No equivalent in `el/1–3.md`. Network Area boundary only referenced tangentially via ESPA Design Services threshold in `el/3.md` (AEDC 1.4.2.3–1.4.2.4); no specific duct-bank review item survives. |
| EL-19.2 | Loop system not shown on all plan sheets that depict Austin Energy electrical lines | removed | — | No surviving 5.1 item about loop systems. Not covered in `el/1.md`, `el/2.md`, or `el/3.md`. |
| EL-19.3 | Dual feed electricity service not coordinated with and approved by Austin Energy | removed | — | UCM § 1.5.2 dual feed service checklist item dropped. `el/3.md` discusses ESPA and network service thresholds but has no dual-feed-specific item. |
| EL-19.4 | Line extension requirements to provide AE service not coordinated with AE | removed | — | UCM § 1.3.12 line extension / CIAC item dropped. Not represented as a checklist item in 5.1 `el/`. |
| EL-19.5 | Streetlight refeed design not approved by Austin Energy Design lead | removed | — | UCM § 1.6.0 streetlight refeed item dropped. 5.1 `el/3.md` covers street-light placement/coordination/spacing (EL-3.16, EL-3.18, EL-3.20–22) but has no distinct refeed-design item. |
| EL-19.6 | AE references/notes not removed from plans when development outside AE service territory | partial | `el/3.md` EL-3.3 (primary: reworded); `el/3.md` EL-3.4 | EL-3.3 (AEDC 1.4.1 Electric Service Availability Letter) covers the confirm-service-area question; EL-3.4 requires a plan note stating site is within AE service area. The inverse obligation (remove AE notes when outside territory, citing COA § 15-9-1) is not explicitly preserved. Partial coverage. |
| EL-19.7 | PUC Service Area Exception Application not completed for non-territorial provider in dual service area | removed | — | Dropped entirely. No 5.1 item references PUC Service Area Exception. |
| EL-19.8 | Multi-lot development with single AE service point not unified via UDA / replat / Land Status Determination | removed | — | UCM § 1.3.8 multi-lot unified service item dropped. No `el/` checklist item covers it. |
| EL-19.9 | Chilled water facilities not coordinated with and approved by AE | removed | — | UCM § 1.15.0 District Energy / chilled water item dropped. No equivalent in 5.1 `el/` or elsewhere. |
| EL-19.10 | EV chargers with transformers shown without updated electrical site plan (clearances, conduit, pad details) | partial | `el/2.md` EL-2.22 | EL-2.22 covers transformer pad sizing/clearances/AE easement per UCM § 1.5.2.6 and § 1.10.4 generally. The EV-charger-specific trigger (load/site-amenities-based applicability and bollard-within-4-ft check) is not preserved. Partial. |
| EL-19.11 | Irrigation plan not submitted to AE for review | removed | — | Dropped. No checklist item requires AE review of irrigation plan in 5.1. |
| EL-19.12 | Lighting plan not provided demonstrating fully-shielded / full cut-off fixture compliance | moved-cross-department | `zlu/5.md` ZLU-5.49; `zlu/16.md` ZLU-16.34 (primary) | LDC Subchapter E, § 2.5 enforcement migrated to Zoning department. ZLU-5.49 covers the § 2.5 note and Figure 34 placement. ZLU-16.34 covers hooded/shielded-from-residential. Also tangentially ZLU-19.43 (PUD lighting standards) and TCM 5.3.4 for trails (`park/1.md` PARK-1.59). No equivalent fixture-type checklist item remains in `el/`. |
| EL-19.13 | Proposed electric service routing not shown per AE Design Criteria Manual | reworded | `el/3.md` EL-3.11 (primary); `el/3.md` EL-3.19 | EL-3.11 folds routing-per-AEDC into the AutoCAD submittal-content requirement (AEDC 1.16.0(1)); EL-3.19 covers plan coverage to full extent of utility work. 5.1 reframes from "show routing" to "submit complete AutoCAD drawing with all required content." |
| EL-19.14 | Clearance conflict between existing conductors and proposed buildings not resolved by AE Design | combined | `el/1.md` EL-1.2, EL-1.3, EL-1.26 (primary); `el/3.md` EL-3.12 | Split across `el/1.md` distribution clearance items (7.5-ft horizontal + 15-ft radial from outside conductor) and `el/3.md` EL-3.12 (AEDC 1.16.0(4) personnel access / clearances demonstration). `el/1.md` provides the numeric substance; `el/3.md` provides the AE-coordination obligation. |
| EL-19.15 | Approval of electric system plans from AE not obtained (LDC § 25-4-200) | reworded | `el/3.md` EL-3.1 (primary); `el/3.md` EL-3.2 | EL-3.1 (ESPA submission/approval, AEDC 1.4.2.1) and EL-3.2 (AEU clearance) together replace the LDC § 25-4-200 framing with the ESPA-based AE approval workflow. Same substantive obligation, reworded to AEDC authority. |
| EL-19.16 | Compliance with AE Design Criteria Manual not demonstrated | combined | `el/3.md` EL-3.6 (primary: Standard AE Notes); `el/3.md` EL-3.4, EL-3.5; `el/1.md` EL-1.2–1.6; `el/2.md` EL-2.22 | Broken into discrete checks: verbatim Standard AE Notes (EL-3.6), AE service-area note (EL-3.4), developer responsibility note (EL-3.5), specific clearance numeric checks (`el/1.md`), transformer pad specs (`el/2.md`). Net substance preserved across multiple items. |
| EL-19.17 | Customer-owned conduit/cable shown for AE approval when jurisdiction is City Electrical Inspector | removed | — | COA § 15-9-123 customer-owned-conduit jurisdictional boundary item dropped. No 5.1 equivalent. |
| EL-19.18 | Substation gates blocked or access not maintained | removed | — | UCM § 1.14.4 substation-gate-access item dropped. 5.1 `el/1.md` EL-1.19 covers the 25-ft-wide × 16-ft-vertical-clearance transmission ROW access corridor (also UCM § 1.14.4), but the substation-gate-specific check is not preserved. |
| EL-19.19 | Moonlight tower conduit requirements (2 sets of 2" conduits) not specified | removed | — | UCM § 5.2.1 conduit-specification detail dropped. `el/3.md` EL-3.13–3.15 cover moonlight-tower permit/notification/25-ft ROW prohibition but not the 2×2" conduit specification. |
| EL-19.20 | Historical poles shown as relocated or moved | removed | — | Reviewer-convention 6th-Street historical-pole item dropped. No 5.1 equivalent. |
| EL-19.21 | Contractor responsibility for moonlight tower disassembly/storage/re-assembly not noted on plans | partial | `el/3.md` EL-3.13 (primary); EL-3.14; EL-3.15 | EL-3.13 (permit within 100 ft per COA § 14-11-201), EL-3.14 (AE advance-notification coordination note), EL-3.15 (25-ft ROW prohibition) collectively handle moonlight-tower coordination. The specific contractor-responsibility-for-disassembly note (COA § 14-11-202) is not explicitly preserved. Partial. |
| EL-19.22 | Vaults or meter rooms proposed outside Network Area where not permitted | removed | — | UCM § 1.5.2.6 Network-Area vault restriction checklist dropped. `el/1.md` discusses vault proximity to overhead lines (EL-1.4) but not the Network-Area location restriction. |
| EL-19.23 | Electrical room does not have exterior door | removed | — | Dropped. No 5.1 item requires electrical-room exterior door access. |
| EL-19.24 | Caution signage not shown for existing AE facilities during construction | renumbered | `el/1.md` EL-1.20 | EL-1.20 ("demolition plan does not include a note requiring contractor to use extreme caution when working near at-grade utility appurtenances") is a close match, reframed from "caution signage" to "caution note on demolition plan" and broadened to all at-grade utilities (Reviewer Convention authority rather than UCM § 1.10.1). Functionally renumbered. |
| EL-19.25 | Tailgate safety meeting with AE Transmission C&M not noted prior to construction | retained | `el/1.md` EL-1.18 | EL-1.18 preserves the pre-construction 48-hour safety meeting requirement along with the other UCM 1.14.9 transmission-safety obligations (barricades 10 ft from structures, warning signs, materials-storage prohibition). |
| EL-19.26 | Crane safety personnel not included in pre-construction safety meeting | partial | `el/1.md` EL-1.18 (primary); EL-1.25 | EL-1.18 covers the AE safety meeting and barricade requirements; EL-1.25 covers staging/spoils in transmission easement (UCM 1.14.9). Crane-specific 20-ft-buffer is mentioned in the `el/1.md` regulatory overview but not as a standalone checklist item; "crane safety personnel inclusion" as a discrete check is not preserved. Partial. |
| EL-19.27 | Proposed buildings, bike racks, or site features do not meet safety clearances from AE facilities | split | `el/2.md` EL-2.22 (transformer pad clearances — primary); `el/1.md` EL-1.2, EL-1.3, EL-1.6, EL-1.26 (overhead distribution clearances) | 5.1 splits the generic "site features near AE facilities" item into pad-mounted equipment clearance (`el/2.md` EL-2.22 per UCM § 1.10.4) and overhead-conductor clearances (`el/1.md` multiple items per UCM § 1.10.3 / § 1.10.6). "Bike racks / benches" are not called out as specific trigger features in 5.1. |
| EL-19.28 | Building doors open into right-of-way | removed | — | LDC § 25-12-3 / IBC § 3202 door-swing-into-ROW item dropped. No 5.1 equivalent in `el/`, `eptp/`, or elsewhere. (Note: `fwp/7.md` uses § 25-12-3 for flood amendments only; no door-swing-ROW item found anywhere.) |

## Patterns

- **Consolidation into 3 canonical guides.** 28 items collapsed into ~15 surviving coverages spread across `el/1.md` (clearances), `el/2.md` (routing + transformer pads), `el/3.md` (AE service + ROW coordination). Moonlight towers and the 10-ft overhead utility zone each got distinct items in 5.1 rather than living in the generic "special coordination" bucket.
- **Numeric-detail loss.** Several 5.0 items with precise code-derived specifics (EL-19.19 2×2" conduit, EL-19.1 Network Area duct bank, EL-19.22 vault-in-Network-Area) dropped. Where the generic obligation survived (e.g., moonlight-tower permit), the specific dimensional callout did not.
- **Cross-department migration.** The § 2.5 exterior-lighting checklist moved entirely to `zlu/` — in 5.0, Electric owned fixture-shielding; in 5.1, Zoning enforces § 2.5 and Electric no longer has any fixture-type item.
- **Rare-case drops.** Items gated on rare site conditions were disproportionately dropped: EV-chargers-with-transformers, chilled water, historical poles, PUC Service Area Exception, multi-lot unified service, streetlight refeed, irrigation-to-AE, customer-owned-conduit jurisdictional boundary, electrical-room exterior door, door-swing-into-ROW, dual feed, substation gates. These account for 7 of the 7 "removed" items — low-frequency-but-high-specificity checks were the retraining pipeline's preferred sacrifice.
- **AEDC replaces LDC.** 5.1 systematically reframes LDC § 25-4-200 framing with AEDC 1.4.x / 1.16.0 citations, reflecting that AE's own design criteria now carries the primary regulatory weight in the retrained corpus.
- **Transmission-safety preserved intact.** UCM 1.14.9 content (EL-19.25) is the cleanest survivor — fully retained in `el/1.md` EL-1.18 with expanded scope.
