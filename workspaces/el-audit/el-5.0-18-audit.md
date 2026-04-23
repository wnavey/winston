# EL 5.0 File 18 Audit — "Austin Energy Plan Notes and Contact Information"

**5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/18.md`
**5.1 corpus:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` @ commit `aed4f1b13e2fcdf3e9a0c1d2d28179ed92d7ed95` ("Update Austin review guides + glossary from training v5.1 (#245)")
**5.1 el/ structure:** 3 files (1.md clearances; 2.md underground routing; 3.md AE service & ROW coordination). `el-md-exp/` excluded per instructions.

## Summary

EL-18 was a dedicated grouping for AE plan notes, disclaimer language, notes-section organization, and contact info. In v5.1, the AE notes concept collapsed into **el/3** ("Austin Energy Service and ROW Utility Coordination"), which retains only the four Standard AE Notes (EL-3.6) and the developer-responsibility conduit note (EL-3.5). The rest of EL-18 — conceptual-design disclaimer, "changes affect electric" coordination note, "Austin Energy Notes" heading requirement, non-AE utilities mixed in, duplicated note sections, transmission-note separation, inapplicable transmission notes, and the current-AE-contact-info item — were **dropped** from the electrical guide. A few dropped items (inapplicable notes, duplicate notes, outdated contact info) have generic coverage in `zlu/5` (plan-notes hygiene); those are classified **partial / moved-cross-department**, not retained, because they no longer carry AE-specific language or triggers.

## Status Counts (10 items)

| Status | Count |
|---|---|
| retained | 0 |
| reworded | 0 |
| renumbered | 0 |
| moved-within-el | 2 |
| moved-cross-department | 0 |
| combined | 0 |
| split | 0 |
| removed | 5 |
| partial | 3 |

## Main Table

| 5.0 ID | Deficiency (truncated ~80) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-18.1 | Current Austin Energy contact information not shown on plan sheets or project cover sheet | partial | zlu/5 (ZLU-5 outdated dept names/citations, generic) | No AE-specific contact-info item in v5.1 el/. `zlu/5` addresses "outdated department names" generically; `el/3` EL-3.14 mentions "current AE contact information" only in the moonlight-tower context. No v5.1 item requires an AE contact block on cover/plan sheets. |
| EL-18.2 | Note missing: electric facilities shown are conceptual only, not for bidding, final AE design may vary | removed | — | No v5.1 item requires the conceptual/not-for-bidding/may-vary disclaimer. Not captured in el/3 AE notes list or in zlu/5. |
| EL-18.3 | Note missing: AE must review changes (building SF, location, detention, grading, spoil sites) | removed | — | No v5.1 item requires this change-triggers-AE-review coordination note. Not in el/3 plan-notes enumeration. |
| EL-18.4 | Notes section heading is not exactly "Austin Energy Notes" (uses Utility Notes, etc.) | removed | — | Heading-text requirement dropped. zlu/5 addresses notes-section organization generically but does not mandate the "Austin Energy Notes" heading. |
| EL-18.5 | Transmission notes not separated into distinct "Austin Energy Transmission Notes" section | partial | el/3 EL-3.32 | EL-3.32 requires the 8 AEDC 1.16.0(8) transmission plat notes be present when a transmission easement exists, but does not require them to sit in a distinctly-headed "AE Transmission Notes" section separate from the standard AE Notes. The organizational/section-separation aspect is lost. |
| EL-18.6 | AE Notes section includes notes referencing non-AE utilities (Pedernales, water, etc.) | removed | — | No v5.1 item flags cross-utility pollution of the AE Notes block. zlu/5 covers "inapplicable notes" generically but not AE-section-specific non-AE references. |
| EL-18.7 | AE Notes section includes notes not applicable to project (e.g. transmission notes w/o transmission infra) | partial | zlu/5 (ZLU-5.x — inapplicable/template notes, generic) | `zlu/5` catches inapplicable regulatory notes and template boilerplate that doesn't apply to the actual project. Not AE-specific and does not cite AEDC 1.14.0 as trigger, but the same review behavior is achievable. Moved-cross-department scope, so tagged partial. |
| EL-18.8 | AE Notes section does not include the four current standard AE Notes or includes outdated ones | moved-within-el | el/3 EL-3.6 | Retained in substance and moved from el/18 to el/3. EL-3.6 enumerates identical four notes (tree pruning; easement/access; erosion control + tree protection w/in 10 ft of centerline; NESC/OSHA/COA/Texas clearance maintenance) and cites same "General Site Plan Notes — Standard AE Notes" authority with the same "changing required text results in rejection" language. |
| EL-18.9 | AE Notes section appears in multiple locations on plans (duplicate sections) | partial | zlu/5 (generic duplicate-notes patterns, e.g. ZLU-5.16, ZLU-4.30–4.35) | Generic duplicate-notes coverage exists in `zlu/` but no AE-Notes-specific duplication check. `zlu/5.16` is the Fire Department analog. Partial + moved-cross-department in scope. |
| EL-18.10 | Developer responsibility note for conduit/infrastructure per AE Design Criteria Manual + coord w/ other utilities | moved-within-el | el/3 EL-3.5 | Retained substantively. EL-3.5 requires "developer is responsible for designing and constructing all conduit and related infrastructure to current Austin Energy Electric Service Standards, including conductor installation costs, and for coordinating with other utilities to resolve all conflicts." Note: 5.1 references "Electric Service Standards" rather than "Design Criteria Manual"; the 5.0 violation pattern about citing outdated "2017 Electric Service Standards" is no longer flagged — current AE language itself uses "Electric Service Standards." Citation shifted from AEDC 1.3.0 to AEDC 1.16.0(7); AEDC 1.6.4; AEDC 1.6.6. Minor reword within moved-within-el. |

## Patterns Observed

- **Plan-notes-hygiene items systematically deprecated.** Five of ten items in EL-18 covered *how* AE notes are organized, headed, disclaimed, or deduplicated — all removed from the electrical guide. The retraining consolidated AE notes to two concrete deficiencies: the four standard notes and the developer-conduit note. Heading text, disclaimer language, non-AE pollution, and duplication are no longer AE-reviewer concerns in v5.1 el/.
- **Partial coverage via `zlu/5`.** Generic plan-notes-hygiene items (inapplicable notes, outdated citations, duplicate sections) migrated into the ZLU (zoning/land use) discipline rather than staying in el/. Reviewer behavior is approximately preserved for EL-18.1, EL-18.7, EL-18.9 but with different triggers and citations.
- **Transmission-notes organization partially retained.** The substantive transmission plat-notes list survives as EL-3.32 (all eight AEDC 1.16.0(8) notes), but the separation-of-sections requirement (distinct "AE Transmission Notes" header) is gone.
- **"Contact information currency" dropped from el/.** Only wwp/38 (AW contact info) retains a department-specific current-contact-info deficiency in v5.1. The analogous AE item (EL-18.1) has no direct successor. This matches the user's "out of scope: citation currency" guidance and suggests the retraining treated contact-info as out-of-scope for technical review.
- **Citation drift on EL-18.10.** The 5.0 item cites "2017 Electric Service Standards" (outdated) vs "Design Criteria Manual" (current). The 5.1 equivalent EL-3.5 uses "Electric Service Standards" as current canonical language. Readers auditing against 5.0 would flag this as a citation mismatch; it is actually an upstream canonical-terminology change.
