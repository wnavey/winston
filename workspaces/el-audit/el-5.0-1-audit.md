# Audit: EL 5.0 file 1 — "Site Feature Clearances from Overhead Electric Lines"

- **5.0 source:** `/tmp/bureau-5.0/jurisdictions/austin/review-guides/el/1.md` (worktree @ `ced6e10`)
- **5.1 target:** `/Users/winston/workspace/bureau/jurisdictions/austin/review-guides/` on `main` @ `8fccc32b3370c31521f245904ad65a10372ebadc`
- **Scope:** 47 checklist items (EL-1.1 through EL-1.47)

## Summary

5.0's `el/1.md` was a clearance-focused grouping organized around site feature types (buildings, fences, retaining walls, driveways, water meters, trees, transformers, guys, signs, etc.). In 5.1 this was collapsed into a smaller number of more abstract items in `el/1.md` ("Overhead and Vertical Electrical Clearances") plus `el/2.md` (routing/undergrounding/transformer pad) and `el/3.md` (AE coordination). Tree-placement items went to `eptp/` (arborist). Transmission easement parkland-labeling went to `park/`. A large body of detailed site-feature-specific rules (fences near substations, marquee signs, decorative lighting, streetlight-under-overhead, trash enclosures, pole-to-driveway spacing, sidewalk clearing, guy-wire easement widths, new pole spacing, oriented crossings, overhead-secondary-over-primary, service-mast roof clearances, niche 35-ft clearance, etc.) appears to have been dropped from main entirely. The older `el-md-exp/` directory still on disk is the retained 5.0-style content (as experimental/legacy) and is NOT the production 5.1 — it is not credited as a 5.1 location below.

## Status counts

| Status | Count |
|---|---|
| retained | 0 |
| reworded | 3 |
| renumbered | 0 |
| moved-within-el | 5 |
| moved-cross-department | 1 |
| combined | 6 |
| split | 0 |
| partial | 6 |
| removed | 26 |
| **Total** | **47** |

(Categories sum to 47; `partial` entries are counted in their own row and not double-counted under a primary status.)

## Main audit table

| 5.0 ID | Deficiency (truncated ~80 chars) | Status | 5.1 Location(s) | Notes |
|---|---|---|---|---|
| EL-1.1 | Buildings and permanent structures do not maintain 7'6" horizontal sky-to-ground | reworded | el/1.md EL-1.2 | 5.1 generalized to "customer facilities" (covers buildings) and fixed conductor-not-pole note. |
| EL-1.2 | Customer facilities do not maintain 15-ft radial clearance from primary/neutral | reworded | el/1.md EL-1.3 | Same rule; 5.1 also merges absolute-prohibition sub-rule (5.0 EL-1.27) here. |
| EL-1.3 | Building projections (overhangs, awnings, balconies, decks, roofs, patios) | combined | el/1.md EL-1.2, EL-1.3 | 5.1 folds projections into generic "customer facility" items; no dedicated projection row. |
| EL-1.4 | Gas pump canopies do not maintain required clearances | combined | el/1.md EL-1.2, EL-1.3 | Gas pump canopies covered as a "customer facility" under generic clearance items; specific call-out removed. |
| EL-1.5 | Stairs, elevated walkways, platforms do not maintain 15-ft radial | combined | el/1.md EL-1.3 | Folded into generic 15-ft radial item; no elevated-feature-specific row. |
| EL-1.6 | Buildings do not maintain clearance from ROW electric facilities | combined | el/1.md EL-1.2, EL-1.3 | ROW vs. on-site distinction collapsed into generic items. |
| EL-1.7 | Surveyed conductor elevations not included on building elevation sheets | removed | — | Survey data now implicit in Documents-to-Review; no dedicated deficiency row. |
| EL-1.8 | Section/plan views do not show dimensions from conductor to building edge | partial (reworded) | el/1.md EL-1.5, EL-1.26 | 5.1 EL-1.5 covers pole-vs-conductor anchor; EL-1.26 covers graphical delineation. Explicit "section exhibits missing" framing is gone. |
| EL-1.9 | Fences do not maintain 7.5-ft horizontal sky-to-ground clearance | removed | — | No fence-specific clearance row in 5.1 (generic EL-1.2 would catch buildings but fences are not explicitly enumerated among "customer facilities"). |
| EL-1.10 | Fence posts do not maintain 10-ft horizontal from electric poles | removed | — | Reviewer-convention rule dropped; no 5.1 equivalent. |
| EL-1.11 | Fences near substation not electrically isolated with 10-ft non-conductive panel | removed | — | Substation-fence isolation rule dropped entirely. |
| EL-1.12 | Fencing near transmission not non-conductive or grounded | removed | — | Transmission fence grounding rule dropped. |
| EL-1.13 | Vehicle barrier fencing beneath overhead lines lacks 7.5-ft clearance | removed | — | No 5.1 row. |
| EL-1.14 | Retaining walls do not maintain 7.5-ft horizontal sky-to-ground | removed | — | Retaining-wall-specific rule dropped; generic EL-1.2 lists "customer facilities" but not walls. |
| EL-1.15 | Retaining walls adjacent to substation lack 5-ft separation | removed | — | Substation-adjacency rule dropped. |
| EL-1.16 | Emergency access structures lack clearances from overhead | removed | — | Bridges/platforms-specific row dropped. |
| EL-1.17 | Retaining walls lack section exhibits showing clearance | removed | — | Wall-specific exhibit requirement dropped. |
| EL-1.18 | Driveways do not maintain 16-ft/18-ft vertical clearance | reworded | el/1.md EL-1.7 | 5.1 uses "service-drop over truck-traffic areas" framing with 18-ft default; captures same rule. |
| EL-1.19 | Vehicles parked/displayed on concrete pads lack vertical clearance | removed | — | Vehicle-display-pad row dropped; generic service-drop-clearance item EL-1.7 covers the underlying rule. |
| EL-1.20 | Final road/driveway grades lack 30-ft clearance from transmission | partial | el/1.md EL-1.19, EL-1.26 | 5.1 no longer cites 30-ft numeric; transmission clearance is now "AE engineering required" (EL-1.26). Numeric standard dropped. |
| EL-1.21 | Highway/freeway grades with distribution underbuilt lack 40-ft clearance | removed | — | 40-ft underbuilt-transmission rule dropped. |
| EL-1.22 | Existing poles in conflict with driveways not relocated 30 ft | moved-within-el | el/3.md EL-3.8 | 5.1 covers "driveway conflicts with pole guy anchor" / AE coordination; 30-ft numeric standard dropped. |
| EL-1.23 | Clearances measured from pole instead of conductor | moved-within-el (reworded) | el/1.md EL-1.5 | Same rule, rewritten as a dedicated measurement-methodology deficiency. |
| EL-1.24 | Streetlight poles located under overhead lines | removed | — | No streetlight-under-overhead row in 5.1. |
| EL-1.25 | Sidewalks not cleared from poles at property ends | removed | — | Sidewalk-pole-conflict rule dropped. |
| EL-1.26 | Trash areas/receptacles placed under overhead | removed | — | Trash-bin-service-height rule dropped. |
| EL-1.27 | Customer facilities installed under/over AE distribution (absolute prohibition) | combined | el/1.md EL-1.3 | Absolute-prohibition sub-rule merged into 5.1 EL-1.3. Easement 7.5-ft sub-clause not explicitly preserved. |
| EL-1.28 | Water meters lack 7.5-ft clearance from service drops | removed | — | Water-meter-specific clearance rule dropped. (wwp/18.md covers meter placement but not electric clearances.) |
| EL-1.29 | Water lines lack clearance from overhead distribution | removed | — | No 5.1 row for water-line-to-overhead clearance. |
| EL-1.30 | Permanent foundations within 5 ft of property line | removed | — | 5-ft-foundation-setback RC rule dropped. |
| EL-1.31 | Registered-surveyor mid-span clearance survey not provided | removed | — | Survey-documentation deficiency not retained as explicit row. |
| EL-1.32 | Overhead crossings of roadways not at 90 degrees | removed | — | 90-degree crossing RC dropped. |
| EL-1.33 | Secondary overhead crossing over primary | removed | — | Secondary-over-primary RC dropped. |
| EL-1.34 | Marquee signs lack profile exhibits / clearance dimensions | removed | — | Marquee-specific row dropped; generic EL-1.2/EL-1.3 would catch signs only as "customer facilities." |
| EL-1.35 | New power poles for underground service <20 ft from existing | removed | — | 20-ft pole spacing RC dropped. |
| EL-1.36 | Decorative lighting under overhead lacks clearances | removed | — | Decorative-lighting row dropped. |
| EL-1.37 | Trees within 10 ft distribution / 50 ft transmission not UC species | moved-cross-department | eptp/10.md EPTP-10.25, EPTP-10.26; eptp/22.md EPTP-22.51; eptp/28.md EPTP-28.29 | Tree-species-near-overhead migrated to EPTP (arborist) guide. 50-ft transmission UC requirement preserved in eptp/10.md overview. |
| EL-1.38 | Meter locations obstructed by site features | partial | — | No direct 5.1 equivalent; meter working-clearance rule (UCM 1.10.9) not re-instantiated in el/1.md, el/2.md, or el/3.md. Effectively dropped. |
| EL-1.39 | Development does not maintain clearances from existing streetlights | removed | — | Streetlight-clearance RC dropped. |
| EL-1.40 | Down guy wires conflicting with accessible paths/driveways | partial | el/3.md EL-3.8 | 5.1 covers driveway-vs-guy-anchor conflict via AE coordination, without the "convert to self-supporting pole" remediation detail. |
| EL-1.41 | Guy easements for transmission anchors — 10 ft + 50 ft beyond | removed | — | Specific transmission-guy-easement-geometry RC dropped. |
| EL-1.42 | Down guy anchor points lack 10-ft x 5-ft easements | removed | — | Distribution-guy-easement-geometry RC dropped. |
| EL-1.43 | Transformers lack 7.5-ft vertical clearance from overhead lines | partial | el/2.md EL-2.22 | 5.1 EL-2.22 covers transformer clearances per UCM 1.10.4 broadly; the specific "7.5-ft from overhead above transformer" framing is not explicit. |
| EL-1.44 | Transformers/switchgear in niche lack 35-ft vertical clearance | removed | — | 35-ft-niche rule not present in current el/1.md, el/2.md, or el/3.md. (Still in legacy el-md-exp/13.md, not production.) |
| EL-1.45 | Construction staging within 10 ft of energized overhead (OSHA) | partial (moved-within-el) | el/1.md EL-1.6, EL-1.18, EL-1.19 | 5.1 EL-1.6 incorporates 10-ft OSHA via UCM 1.10.2; transmission-specific staging covered by EL-1.18/EL-1.19. Dedicated staging-distribution row not preserved. |
| EL-1.46 | Missing 48-hour notification note per Tex. H&S 752.003 | partial | el/1.md Regulatory Overview; el/3.md EL-3.13, EL-3.14 | 5.1 preserves 48-hour note only in transmission (UCM 1.14.9) and moonlight-tower (AE operational) contexts. Generic distribution 48-hour note per H&S 752 no longer appears as a checklist deficiency. |
| EL-1.47 | Service-mast through-roof installations lack 3-ft / 18-in clearance | removed | — | Service-mast roof-clearance rule dropped. |

## Notable patterns

- **Massive shrinkage on site-feature-specific rules.** Roughly half of the 5.0 items were feature-specific deficiencies (fences, retaining walls, marquee signs, decorative lights, trash areas, streetlights, vehicle-display pads, water meters, water lines, guy-wire easement geometry, pole spacing, crossing angles, etc.). 5.1 consolidates these into a handful of generalized items keyed on "customer facility" and relies on the 7.5-ft / 15-ft envelopes to catch them. Anything that isn't covered by those two envelopes, plus EL-1.5 (measure-from-conductor) and EL-1.7 (service-drop truck clearance), has effectively been dropped.
- **Reviewer-Convention rules disproportionately removed.** Nearly every `Reviewer Convention` item in 5.0 (EL-1.10, 1.15, 1.22 partial, 1.24–26, 1.29, 1.30, 1.32, 1.33, 1.35, 1.39, 1.41, 1.42) was dropped. The retraining appears to have pruned non-code-backed conventions.
- **Trees moved to EPTP.** The tree-species-under-overhead rule (EL-1.37) is the single clearest cross-department migration, now distributed across eptp/10, 22, 28.
- **Transmission handling simplified.** Numeric transmission clearances (30 ft road, 40 ft underbuilt highway) were replaced with a blanket "requires AE engineering analysis" approach (el/1.md EL-1.26 + Regulatory Overview).
- **Transformer niche and substation-adjacency rules are now absent from production.** They still exist in `el-md-exp/` but that directory is not part of the 5.1 production guide set (el/ has only 1.md, 2.md, 3.md).
- **New material appears in 5.1 that is absent from 5.0 file 1:** utility-crossing separations (12-in, 18-in), SCM staging/access 14-ft clearance, DAPCZ-specific AULCC thresholds, Plaza Saltillo/NBG undergrounding — indicating the retraining brought in material from other 5.0 files (likely the 4-20.md range) and from non-electrical UCM chapters.
- **EL-1.38 (meter obstruction / working clearance)** appears to be genuinely lost in production; UCM 1.10.9 working-clearance obligations are not re-instantiated in el/1.md, el/2.md, or el/3.md. Worth flagging to the training team.
