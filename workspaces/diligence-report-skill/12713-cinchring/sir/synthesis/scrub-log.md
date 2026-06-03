# Research Appendix Scrub Log

**File:** `/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/noetic-pdf/src/examples/12713-cinchring-appendix.md`
**Date:** June 3, 2026

## Scope
Final scrub of the assembled Research Appendix to remove internal pipeline language while preserving all substantive findings, citations, code references, dollar estimates, severity classifications, and recommendations. The file (~2,870 lines) was reviewed end-to-end and edited in place.

## Categories of changes

### 1. Heading-level normalization
- Dropped per-file `# Phase 2 — Property Records` / `# Phase 2 — Neighborhood Plan Context` / `# Phase 2 — Environmental Research` / `# Phase 2 — Transportation Research` / `# Phase 2 — Web Follow-ups` H1 headings.
- Replaced with H2 subsection headings under the existing `# Part I — Topical Research` umbrella: `## Property Records`, `## Neighborhood Plan Context`, `## Environmental Research`, `## Transportation Research`, `## Additional Jurisdictional Context` (renamed from "Web Follow-ups").
- Demoted the eleven discipline-assessment H1 headings (`# Zoning & Land Use — 12713 Cinchring …`, etc.) under `# Part II — Discipline Assessments` to H2 form (`## Zoning & Land Use`), removing the redundant address suffix.
- Demoted the two synthesis H1 headings (`# Issue Matrix — …`, `# Recovery Log — …`) to H2.
- Demoted the three topical H1 headings (`# Zoning Pathway — …`, `# Restrictive Covenants — …`, `# Programs — …`) to H2 under Part I.

### 2. Subagent / agent / model language
- Removed/replaced every occurrence of "subagent" (50+ instances). Patterns swapped:
  - "the zoning-specialist subagent" → "the zoning analysis"
  - "restrictive-covenants subagent" → "the Restrictive Covenants section" / "counsel"
  - "downstream subagents" → "this research" / "subsequent analysis"
  - "the surveyor agent" → "the surveyor" (real-world actor)
  - "this subagent could not" → "this research could not"
  - "the Programs subagent" → "the Programs section"
  - "the Drainage subagent" → "the Stormwater & Drainage section"
  - "the Zoning subagent" → "the Zoning Pathway section"
- Confirmed zero remaining occurrences of "subagent" / "agent" / "the model" referring to AI components.

### 3. Pipeline phase references (our pipeline, not Austin program names)
- "in Phase 2", "per Phase 2", "Phase 2 surfaced", "Phase 3 subagents" → "this research", "subsequent analysis", "the discipline review", etc.
- "Phase 1 survey extraction" → "1994 survey extraction".
- "in Phase 2 surveyor pass" → "in the next survey pass".
- Preserved verbatim (real program names): HOME Initiative Phase 1, HOME Phase 1, HOME 1, HOME Initiative Phase 2, HOME Phase 2, HOME 2, Site Plan Lite Phase 1, Site Plan Lite Phase 2, ETOD Phase 1, Project Connect Phase 1, Austin Light Rail Phase 1. Also preserved "Phase II" / "Phase VI Section II" etc. as those are subdivision phase names.

### 4. File-path references
- Removed `/Users/wnavey/noetic/diligence/12713-cinchring/sir/phase2-research/scofield-docs/` reference.
- Replaced all bare-file cross-references (`zoning-pathway.md`, `restrictive-covenants.md`, `property-records.md`, `programs.md`, `web-followups.md`, `environmental.md`, `seed-site-data.md`, `transportation.md`, `eptp.md`, `eptp`, `sde`, `zlu`, `fwp`, `sduf`, `wwp`, `ta`, `el`, `park.md`) with neutral section-name references (e.g., "see the Restrictive Covenants section", "see the Stormwater & Drainage section").
- Removed `bureau/jurisdictions/austin/feasibility-guides/park.md` citation.

### 5. Prompt-derived language
- "the user prompt referred to '20240516-005'" → factual statement that "the adopted small-lot SF ordinance is -006; -005 is the ETOD Overlay subdistrict ordinance".
- "per the seed data" → "public records indicate" / "consistent with the 1993/1994 survey vintage".
- "user-provided Phase 2 facts" / "user-summary" → "the Property Records research".
- "the prompt's wording about …" footnote that flagged user-input error → deleted; the corrected fact is left standing on its own.
- "in this research session" / "in this run" / "in the search window" → "in this research" or rewritten to drop self-reference.

### 6. Cross-discipline pointer cleanup
- "discipline `sde`" / "`zlu` discipline" / "`sduf` discipline" → named the actual section ("Stormwater & Drainage", "Zoning & Land Use", "Site Plan & Form").
- Header lines like "### Site Plan trigger (cross-reference to sduf)" → "### Site Plan trigger (cross-reference to Site Plan & Form)".

### 7. Trailing meta note
- "## Surveyor pipeline note … The configured property-records pipeline (which invokes the surveyor CLI) was not available in this run because the CLI's headless subprocess could not authenticate. A direct property-records research subagent was substituted; …" → replaced with a brief, neutral "## Method note" that documents the research approach without exposing pipeline mechanics.

### 8. Section-title rewrites
- "## 7. Key data-gaps / actions for downstream subagents and title work" → "## 7. Key data-gaps and items for title work".
- "## 10. Open questions for the surveyor and restrictive-covenants subagents" → "## 10. Open questions for the title company and counsel".
- "## Critical follow-ups for downstream subagents" → "## Critical follow-ups".
- "## Cross-references / handoffs" → "## Cross-references".

## Preservation list (kept verbatim, by design)

- All zoning code strings (MF-3, SF-2/-3, NCCD, NPCD, etc.).
- Ordinance numbers and effective dates.
- All dollar estimates ($5K–$15K WUI premium, $13K–$27K tap+CRF, etc.).
- Severity labels (`significant`, `moderate`, `data-gap`, `opportunity`, `note`).
- Industry-standard tool/system names (GIS, FEMA, LiDAR, TIA, LOMR, LOMA, USFWS, TCEQ, TxDOT, COA, LDC, DSD, AFD, AW, TCAD, ATD, ABP, ASMP, RSMP, DCM, ECM, UCM, BCM, FPCM, IRC, IFC, IBC, IWUIC, NFPA 13D, ITE, AASHTO, CapMetro).
- Real program names — HOME Initiative Phase 1/2, Site Plan Lite Phase 1/2, ETOD Phase 1, Project Connect Phase 1, Imagine Austin, SMART Housing, Affordability Unlocked, DB90, VMU, NBG.
- Recorded-instrument citations (Vol. 11863 Pg. 1147, Doc # 2005103195, Vol. 660 Pg. 968, Cabinet 91 Slide 264–265, etc.).
- Tax / valuation numbers (~$11,100/yr, $499,000 list price, $125/quarter HOA dues, $200/caliper-inch UFRF, $0.00593/SF IC/month drainage charge).

## Phrases debated but kept

- **"in this research"** — kept where it appears in confidence statements (e.g., "the Property Profile page was not directly retrievable in this research"). This is neutral consulting-style phrasing comparable to "during this engagement" and does not expose pipeline mechanics.
- **"Method note:"** and **"Research method:"** headers — kept; these are normal consulting-deliverable conventions.
- **"the surveyor"** — kept where it refers to a real-world actor (the licensed land surveyor who will produce the updated boundary survey), not the AI pipeline.
- **The Restrictive Covenants "Method note"** describing PDF retrieval from the HOA portal — kept the substance (it documents document-chain authenticity) and only removed the local PDF-cache file path.
- **"in this research" replacing "in this session" / "in this run"** — chose "in this research" because the original confidence framing (Verified / Inferred / Unconfirmed) depends on stating what could and couldn't be retrieved at the time. Stripping it entirely would weaken the data-gap transparency that the report is designed to preserve.

## Sanity checks performed

- `grep "subagent"` → 0 matches.
- `grep "/Users/wnavey"` → 0 matches.
- `grep "phase2-research\|phase3-disciplines"` → 0 matches.
- `grep "bureau/jurisdictions\|feasibility-guides"` → 0 matches.
- `grep "\\\`[a-z\\-]+\\.md\\\`"` → 0 matches (all bare `.md` cross-references removed).
- Discipline-code backtick references (`sde`, `zlu`, `sduf`, `eptp`, `wwp`, `ta`, `el`) → only severity labels (`significant`, `moderate`, `data-gap`, `opportunity`, `note`) remain in backticks, which is intentional.
- Heading hierarchy: Part I / Part II / Part III H1s sit above H2 section headings cleanly; no orphan H1s left over from the per-discipline files.
