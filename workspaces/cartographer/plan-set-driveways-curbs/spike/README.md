# Spike scripts behind §1.3–§1.4 (2026-10-19)

PyMuPDF 1.26.5 + shapely 2.0.7, run against the local White Water PDF named in Appendix A. Each prints the numbers quoted in the spec; none needs a model.

| script | what it measures |
|---|---|
| `probe1.py` | sheet titles by text; layer × item-type counts on sheets 7, 12, 13 (the `'c'` Bézier counts on `C-CURB FOC` / `BOC`) |
| `probe2.py` | the sheet index; the text layer's words on 12 and 7; every layer on 7 and 12 |
| `probe3.py` | arc radii per layer by a three-point circle through each Bézier, grouped by centre (R 20.05 / 28.02 / 25.02 / 15.02 …; BOC at R − 0.50); chain counts and lengths (894 ft FOC in 170 chains) |
| `probe4.py` | how far each survey layer extends past the lot; closed rings in `V-CONC-LINE`, `C-DEMO CONC`, `C-IC EXIST PAVING` |
| `probe5.py` | the frontage edge (nearest `V-ASPHALT-LINE`), P/L-to-pavement offsets, which chains cross the Brezza Lane line and at what station (existing driveway 77.8–111.0 ft; sidewalk 66.6–71.0) |
| `probe6.py` | the demolished chains' nearest approach to the right-of-way line (24.4 ft at stations 106.6–107.4) and the proposed FOC ends |
| `probe7.py` | the face/back test: pairs FOC/BOC geometrically with layers withheld and scores four "which member is the face" rules against the layer truth (best 12 of 17) |
| `content-block-hybrid-hits.json` | the `search_content_blocks_hybrid` answers for five curb queries on the three plan set versions (§1.3, "What the content blocks say") |

The lot in page space is the convex hull of the `C-BNDY LINE` dash endpoints; stations are `LineString.project` along the frontage edge; 1″ = 20′ (0.27778 ft/pt) is the registration winston#322 solved, not the title block.
