# Evidence-Chip Block Coverage — CRC Run Results

> **Run:** Lamar + Collier v4, CRC review `47eca23e-a010-4f87-ac3b-1cf6f4c481ae`
> **Project:** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` · **submission_version:** `6b9b85ed-e992-4906-a222-b24ee836910c`
> **Generated:** 2026-07-09 · from `review_comments.output_json` (prod app DB)
> **Scope:** First CRC run to exercise the `evidence-chips-with-block-short-ids` pipeline end-to-end.

---

## Summary

| Metric | Count | % of 295 |
|---|---:|---:|
| Total comments in run | 295 | 100% |
| Comments whose **top-level** chip shows a block (UI-visible highlight) | **87** | **29.5%** |
| Comments with a block in **at least one run's** findings | 188 | 63.7% |
| Comments with a block available but **dropped at consolidation** (Q2) | **101** | **34.2%** |
| Sanity check: top-level block but no per-run block (should be 0) | 0 | — |

The last row confirms the invariant: a top-level block chip is always sourced
from a real per-run finding — consolidation copies the winning voter's
`sheetReferences` wholesale, never fabricates one. So `top ⊆ per-run` holds
(87 ⊆ 188).

---

## Q1 — Checklist IDs whose top-level UI chip shows a block

87 comments across 12 disciplines. Format: `comment# · checklist-id · status · chip(s) as sheet:block`.

### austin-water-redlines (1)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 6 | AW-RL-1 | failed | s6:b9 |

### city-arborist (8)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 31 | CA-02.2 | failed | s9:b4 |
| 34 | CA-04.2 | failed | s10:b2 |
| 37 | CA-05.2 | failed | s8:b3 |
| 56 | CA-16.2 | resolved | s46:b1, s47:b1 |
| 57 | CA-17 | uncertain | s47:b1 |
| 66 | CA-21 | failed | s46:b1, s47:b1 |
| 67 | CA-22 | failed | s44:b1 |
| 68 | CA-22.1 | failed | s44:b1 |

### drainage-engineering (13)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 80 | DE-5 | failed | s24:b3 |
| 93 | DE-18 | uncertain | s27:b4 |
| 98 | DE-22 | uncertain | s28:b4 |
| 101 | DE-25 | uncertain | s29:b3 |
| 102 | DE-26 | uncertain | s27:b5 |
| 105 | DE-28.1 | uncertain | s28:b4 |
| 106 | DE-28.2 | resolved | s27:b4, s27:b5, s28:b4 |
| 108 | DE-30 | uncertain | s28:b1, s28:b4 |
| 110 | DE-32 | uncertain | s28:b2, s28:b6 |
| 111 | DE-33 | resolved | s29:b4 |
| 112 | DE-35 | failed | s30:b7 |
| 113 | DE-36.1 | resolved | s29:b4 |
| 114 | DE-36.2 | failed | s1:b9 |

### environmental-review (13)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 115 | EV-01 | resolved | s1:b6 |
| 116 | EV-02 | resolved | s1:b6 |
| 118 | EV-04 | failed | s5:b3 |
| 119 | EV-05.1 | resolved | s1:b2 |
| 130 | EV-07.1 | resolved | s52:b1 |
| 131 | EV-07.2 | resolved | s1:b2 |
| 132 | EV-08.1 | resolved | s52:b1 |
| 133 | EV-08.2 | uncertain | s52:b1, s52:b2 |
| 136 | EV-11.1 | failed | s47:b1 |
| 137 | EV-11.2 | failed | s47:b1 |
| 139 | EV-12 | resolved | s47:b1 |
| 140 | EV-13 | resolved | s47:b3 |
| 141 | EV-14 | resolved | s47:b1 |

### fire-for-site-plan (2)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 150 | F-4 | uncertain | s1:b4 |
| 154 | F-7 | uncertain | s1:b4 |

### industrial-waste (1)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 155 | IW-1.1 | failed | s35:b10 |

### one-water-bureau (5)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 159 | OWB-2 | failed | s16:b2, s16:b4 |
| 160 | OWB-3 | failed | s16:b4 |
| 161 | OWB-5 | failed (rec) | s16:b4 |
| 162 | OWB-7 | failed (rec) | s16:b1, s16:b2 |
| 163 | OWB-8 | failed | s16:b4 |

### pard-planning-design-review (4)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 166 | PR-3 | failed | s16:b4, s1:b9 |
| 167 | PR-4 | failed (rec) | s16:b4 |
| 168 | PR-5 | failed | s47:b3 |
| 171 | PR-9 | failed | s1:b6 |

### atpw-utility-coordination (1)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 172 | RW-1 | failed | s6:b19 |

### site-plan (25)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 173 | SP-1 | uncertain | s1:b9 |
| 174 | SP-2 | resolved | s3:b1 |
| 175 | SP-3 | failed | s1:b9 |
| 179 | SP-7 | failed | s16:b4 |
| 181 | SP-9 | uncertain | s16:b4, s16:b2, s16:b3 |
| 182 | SP-11.1 | resolved | s16:b2 |
| 183 | SP-11.2 | failed | s16:b4 |
| 184 | SP-12 | resolved | s16:b4, s16:b5 |
| 185 | SP-13 | resolved | s16:b4 |
| 191 | SP-16 | uncertain | s16:b2, s16:b4 |
| 192 | SP-17.1 | failed | s37:b1, s38:b1 |
| 198 | SP-20.1 | uncertain | s8:b4, s9:b4 |
| 202 | SP-24 | uncertain | s14:b5 |
| 203 | SP-25 | failed | s5:b21 |
| 204 | SP-25.1 | uncertain | s5:b21 |
| 218 | SP-33.1 | uncertain | s16:b4 |
| 220 | SP-34 | failed | s14:b4 |
| 226 | SP-37 | failed | s38:b3 |
| 227 | SP-40 | failed | s1:b9 |
| 230 | SP-43 | failed | s14:b1 |
| 231 | SP-44 | resolved | s1:b9 |
| 233 | SP-46 | resolved | s1:b2 |
| 234 | SP-47 | uncertain | s14:b6 |
| 236 | SP-50 | failed | s13:b1 |
| 237 | SP-51 | failed | s16:b1 |

### transportation-public-works (4)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 238 | TPW-1 | resolved | s1:b6 |
| 242 | TPW-6 | failed | s16:b1 |
| 267 | TPW-16 | failed | s15:b1 |
| 273 | TPW-20.1 | uncertain | s14:b4, s16:b2 |

### water-quality (10)
| # | Checklist ID | Status | Block chip(s) |
|--:|---|---|---|
| 279 | WQ-3.1 | failed | s29:b1 |
| 280 | WQ-3.2 | failed | s29:b1 |
| 283 | WQ-7 | uncertain | s29:b4 |
| 284 | WQ-8.1 | uncertain | s29:b1, s29:b8 |
| 287 | WQ-9 | uncertain | s29:b1, s30:b7 |
| 288 | WQ-10 | failed | s29:b6 |
| 289 | WQ-11 | failed | s29:b1 |
| 290 | WQ-12 | failed | s29:b4 |
| 292 | WQ-14.1 | failed | s29:b1 |
| 295 | WQ-15 | failed | s1:b9 |

---

## Q2 — Block available but not surfaced (consolidation drop)

**101 of 295 comments (34.2%)** had a block-granular chip in at least one run's
findings, but the top-level rendered chip carries **no** block — because the
run selected as the consolidation winner didn't cite one.

Two useful framings:

- **As a share of all comments:** 101 / 295 = **34.2%**
- **As a share of block-capable comments** (had a block in *some* run): 101 / 188 = **53.7%**

So of every comment where the agent *was* able to pin a block on at least one
of its runs, more than half lost that precision at consolidation.

### Why this happens

Per DEV-PLAN §4 consolidation semantics, the rendered card takes the **winning
voter's finding wholesale** — explanation, agentTrace, and `evidenceLocations`
together. The winner is the earliest run whose status matches the effective
(majority) status. If that particular run happened to cite the block at
sheet-level only while a *different* majority voter pinned the exact block, the
block reference is dropped. This is documented, accepted behavior: the failure
mode is a sheet-level chip, not a wrong deep-link. There is no cross-voter
evidence merging today.

### Known examples from this run

- **AW-RL-4 (comment 9)** and **AW-RL-5 (comment 10)** — both meter-callout
  redlines. Multiple runs pinned sheet 8/9 blocks in their per-run
  `sheetReferences`, but the winning voter cited sheet-level only, so neither
  renders a block chip. (These were the initial spot-check comments that
  looked "broken" but are behaving as designed.)

### Implication / possible follow-up

34% is a large fraction of already-computed block precision being discarded at
the last hop. If deep-link coverage matters, the cheapest lever is a
consolidation tweak: when the winning voter lacks a `blockNumber` but another
majority voter on the same finding has one (same sheet), graft that block
reference onto the winning finding's chip. This stays within "majority voters
agree" and would lift top-level block coverage from 87 toward ~188 without
touching the agent or schema. Worth weighing against the §4 "keep consolidation
simple" decision.

---

## Method / reproducibility

All figures are from a single pass over `review_comments` for
`review_id = '47eca23e-a010-4f87-ac3b-1cf6f4c481ae'` in the app DB
(`mgxqsrjutswbciyrltwd`). Block presence is detected by whether a
`blockNumber` key appears in `output_json->'sheetReferences'` (top-level /
UI-facing) vs. `output_json->'sourceFindings'` (raw per-run findings). The
runtime bbox resolution was verified against the live `SheetLightbox.svelte`
join chain (`submission_plan_set` → `plan_set_version` filtered by
`plan_set_id = documentId` → `sheet_version` by `sheet_number` →
`content_block` by `short_id`) for comment 6 (AW-RL-1, s6:b9), which resolves a
valid normalized bbox `{x:0.453, y:0.261, w:0.106, h:0.195}` on a
`short-id-ordered` sheet.
