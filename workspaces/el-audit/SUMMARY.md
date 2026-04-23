# EL 5.0 → 5.1 Retraining Audit — Consolidated Summary

**Audit scope:** All 20 files in `bureau/jurisdictions/austin/review-guides/el/` at commit `ced6e10` (v5.0) vs. the 3 files on `main` (v5.1, commit `8fccc32b` / `aed4f1b`).

**Per-file reports:** `el-5.0-{1..20}-audit.md` in this directory.

---

## Overall tally (approximate)

| Metric | Count | % |
|---|---|---|
| Total 5.0 checklist items audited | ~770 | 100% |
| Retained (verbatim/near-identical) | **0** | **0%** |
| Reworded (semantic equivalent, rewritten) | ~35 | 5% |
| Moved-within-el | ~90 | 12% |
| Moved-cross-department | ~35 | 5% |
| Combined (folded into omnibus item) | ~125 | 16% |
| Split (one → multiple) | ~3 | <1% |
| Partial (some aspects lost) | ~90 | 12% |
| Removed (no 5.1 successor) | **~347** | **~45%** |

Rough reconstruction; per-file reports have exact numbers.

---

## Per-file counts

| File | Items | Removed | Removal % |
|---|---|---|---|
| 1.md | 47 | 26 | 55% |
| 2.md | 15 | 3 | 20% |
| 3.md | 42 | 15 | 36% |
| 4.md | 55 | 18 | 33% |
| 5.md | 31 | 13 | 42% |
| 6.md | 14 | 8 | 57% |
| 7.md | 24 | 13 | 54% |
| 8.md | 43 | 23 | 53% |
| 9.md | 50 | 30 | 60% |
| 10.md | 63 | 22 | 35% |
| 11.md | 33 | 11 | 33% |
| 12.md | 74 | 30 | 41% |
| 13.md | 39 | 17 | 44% |
| 14.md | 73 | 49 | **67%** |
| 15.md | 49 | 31 | 63% |
| 16.md | 24 | 3 | 13% |
| 17.md | 23 | 6 | 26% |
| 18.md | 10 | 5 | 50% |
| 19.md | 28 | ~16 | ~57% |
| 20.md | 33 | 17 | 52% |
| **Total** | **~770** | **~347** | **~45%** |

---

## Cross-cutting findings

### 1. "Zero retained" holds across all 20 files
Nothing survived verbatim anywhere in the corpus. v5.1 is a fresh-write with aggressive consolidation — not an edit of v5.0. This is significant if anyone assumed v5.1 would be additive or near-backwards-compatible.

### 2. ~45% hard removal rate
The median file lost ~45% of its checklist items outright. File 14 (vault/niche interior design) lost 67%; file 16 (tree/utility coordination) lost only 13% because most of it migrated cleanly to `eptp/`.

### 3. Substantive topic areas entirely dropped from production

| Topic | 5.0 source | 5.1 status |
|---|---|---|
| **Meter location (UCM § 1.9.3)** — indoor/outdoor, sight-of-transformer, 3-ft gas, 1-ft flood, 20-ft disconnect | files 1, 8, 10, 12, 14, 15, 20 | Gone everywhere in production `el/` |
| **Meter working-clearance (UCM § 1.10.9)** | file 1 | Gone |
| **Niche service (35-ft vertical, 3-hr fire wall, AE consultation)** | files 1, 6, 8, 13, 14, 15 | Gone (exists only in `el-md-exp/`) |
| **Vault interior design (dimensions, grounding, ladders, oil reservoirs, fire ratings per UCM § 1.11 / NEC Art. 450)** | file 14 | Gone — 67% removal rate |
| **Network Area rules** (downtown-only undergrounding/niche/vault regime) | files 8, 14, 15 | Gone |
| **Substation fence isolation + transmission fence grounding** | file 1 | Gone |
| **CAD technical specifications** (NAD 83 Texas Central, magenta layer, Elec. UG/OH layer names, model-space) | files 11, 17 | Gone |
| **Plan-presentation QA** (legend consistency, legibility, scale, cut-off labels) | file 11 | Gone |
| **Financial acknowledgements** (line extension, excess facilities, AE fee, SMART Housing waiver) | file 9 | Gone |
| **Transmission-easement physical checks** (8% slope, 16-ft gate, lay-down curb, detention prohibition, excavation depth, hydrants, irrigation, septic, vegetation) | files 4, 5, 6, 12 | Mostly gone; most 5-of-7 transmission items dropped in file 3 |
| **One Call / Texas 811** | files 4, 12 | Gone from `el/`; only `wwp/39` |
| **NEC compliance** | file 10 | Gone |

### 4. Omnibus consolidation pattern (loss of granularity)

A handful of 5.1 rows absorb large clusters of 5.0 items. If the omnibus check passes superficially, substantive sub-rules pass silently:

| 5.1 row | Topic | Absorbs |
|---|---|---|
| `el/3.md` **EL-3.1** | ESPA approval | 13 ESPA rows (EL-9.1–9.13) |
| `el/3.md` **EL-3.6** | Four Standard AE Notes | 9+ plan-note rows from files 7, 12, 18 |
| `el/3.md` **EL-3.11** | AEDC 1.16.0(1) georeferenced AutoCAD | ~7 plan-content rows from files 11, 17 |
| `el/3.md` **EL-3.12** | "Does not limit AE personnel access" | 4 geometric-access rows from file 16 |
| `el/3.md` **EL-3.32** | AEDC 1.16.0(8) plat notes (transmission) | 8+ plat-note rows from files 4, 7, 12 |
| `el/2.md` **EL-2.16** | Easement encroachment licensing | 6+ encroachment rows from file 5 |
| `el/2.md` **EL-2.22** | Transformer pad omnibus | 4+ pad rows from files 13, 14, 15 |
| `zlu/15.md` **ZLU-15.40** | Transformer pad clearance matrix (a)–(h) | UCM 1.10.4 numerical rules from files 13, 14, 15 |

### 5. Cross-department migrations (concentrated, not distributed)

| Migration | Primary destination |
|---|---|
| Tree/vegetation clearances near electric | `eptp/10.md`, `eptp/22.md`, `eptp/28.md` |
| Parkland prohibitions (utilities, transmission) | `park/5.md`, `park/6.md` |
| Screening requirements | `sduf/9.md`, `zlu/27.md` |
| Compatibility setbacks, moonlight towers (on plans), transformer pad numerical clearances | `zlu/15.md`, `zlu/21.md`, `zlu/5.md`, `zlu/16.md`, `zlu/25.md` |
| Floodplain AE equipment | `fwp/7.md`, `fwp/5.md` |
| Transformers in fire-lane width | `fire/12.md` |
| Detention pond near transmission | `sde/29.md` |
| Exterior lighting | `zlu/5.md`, `zlu/16.md` |
| Alley vacation coordination | `zlu/` |

Notable non-migrations: fire hydrants near transmission and 20-ft fire escape clearance (oil-filled) did **not** move to `fire/`.

### 6. Reviewer Conventions preferentially dropped
Items lacking hard code citations were removed at much higher rates. File 4 lost 5 of 7 RC items; file 1 lost the majority of its RCs.

### 7. Citation namespace shift: UCM → AEDC
For AE coordination content (files 7, 9, 18, 19, 20), citations systematically shifted from UCM to AEDC. Out of scope per audit instructions but consistent enough to flag.

### 8. Substantive threshold changes
Not just relocations — some 5.1 items changed the numerical standard:
- **Tree-to-underground-electric clearance:** UCM 1.10.10.4's 5 ft (5.0) → ECM 2.4.2.C's 10 ft (5.1 EPTP-10.17)
- **Transmission tandem-axle loading:** UCM 1.14.4.F's 46,000 lb (5.0) → AEDC 1.16.0(8)(vii)'s ≥48,000 lb (5.1 EL-3.32)

### 9. Notable semantic frame shifts
- 5.0 measured encroachments **from easement boundaries**; 5.1 measures from **outside conductor** and explicitly deprecates easement/pole-anchored dimensions (file 6)
- 5.0 used substantive on-drawing transmission checks; 5.1 replaced them with "confirm plan notes exist" checks (file 4)
- 5.0 tracked service-drop / undergrounding by `Network Area` concept; 5.1 eliminates the concept entirely (files 8, 14, 15)

### 10. File-number ≠ topic in 5.1
5.0 `el/2.md` was tree-electric clearances; 5.1 `el/2.md` is underground utility routing — completely different topic. Anyone navigating by file number will be misled.

---

## Suggested follow-up questions for the training team

1. Was the loss of meter location (UCM 1.9.3) and niche service (UCM 1.10.4 footnote 3) intentional? These are substantive UCM requirements with clear deficiency patterns.
2. Was the stripping of vault interior design (file 14, 67% removal) driven by a scope decision that vault design is architect/MEP, not reviewer-checkable from site plans?
3. Were Reviewer Conventions deliberately culled, or is the 45% baseline removal the retraining's natural compression?
4. Was the threshold change from UCM 1.10.10.4's 5-ft tree clearance to ECM 2.4.2.C's 10 ft a deliberate reinterpretation or an artifact of cluster consolidation?
5. Should the omnibus consolidation pattern (EL-3.1, 3.6, 3.11, 3.12, 3.32, 2.16, 2.22) be decomposed into sub-rules so reviewers can flag partial compliance, or is the single-row design intentional?
6. Intended home for substantive transformer pad rules — `zlu/15.md` ZLU-15.40 has the complete matrix while `el/2.md` EL-2.22 has only a narrative subset. Is the zoning guide authoritative by design?
