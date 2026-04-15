# Sheet 14 — Inlet Drainage Area Map

Site drainage area map and rational method runoff calculations.

## Reading Guide

This sheet contains the Inlet Drainage Area Map for the site, detailing the drainage sub-basins, building footprints, and existing utility layouts. It is primarily used to present post-development runoff calculations and grate inlet capacities for various storm events using the Rational Method.

**Key values:**
*   **Drawing Scale:** 1" = 20'
*   **Sub-basins mapped:** 17 total (A1 through A17), ranging from 0.03 acres to 0.24 acres
*   **Impervious Cover:** Reaches up to 97% on specific sub-basins (e.g., A2, A3, A13-A17)
*   **Storm Events Calculated:** 2-Year, 10-Year, 25-Year, and 100-Year (accounting for NOAA Atlas 14)
*   **Highest calculated 25-Year Runoff (Q25):** 2.53 cfs (Sub-basin A17)
*   **Highest calculated 100-Year Runoff (Q100):** 3.55 cfs (Sub-basin A17)
*   **Grate Inlet Sizing:** All proposed inlets are 2.0 ft x 2.0 ft
*   **Grate Inlet Open Area (Ao):** 3.01 square feet for all listed inlets
*   **Clogging Factor:** Inlet capacity is reduced by 50% to allow for clogging

**Content blocks on this sheet:**

*   **Block 1: drawing — Inlet Drainage Area Map**
    *   This is the primary site plan showing sub-basin boundaries (A1-A17), contours, building footprints (Bldg 1-8), easements, existing utilities, and adjacent property details.
    *   Use VISION to examine the spatial layout, the routing of drainage areas to specific inlets, and site grading contours.

*   **Block 5: table — Post-Developed Rational Method Runoff Calculations**
    *   A comprehensive table listing the acreage, impervious/pervious cover, time of concentration (Tc = 5 min for all), and calculated flow (Q) for 2, 10, 25, and 100-year storm events across all 17 sub-basins.
    *   READ the block content for exact runoff coefficients (C), rainfall intensities (I), and peak flows (Q) for specific sub-basins.

*   **Block 6: table — 25 YR - Inlet Calculation Table - Grate Inlets**
    *   A table verifying that all onsite grate inlets have the capacity to handle the 25-year storm flow (Q25). Details include inlet size (2x2), open area (Ao), flow depth (h), and capacity vs. actual Q25.
    *   READ the block content to confirm individual inlet capacities and flow depths.

*   **Block 8: text_block — Inlet Calculation Formulas and Notes**
    *   Provides the specific formula used for intercept flow (Qi = 4.82*Ao*h^0.5) and notes the mandatory 50% capacity reduction for clogging.
    *   READ the block content to verify the engineering assumptions and code references (COA - DCM Section 4.3.1).

*   **Block 11: text_block — Rainfall Data Notes**
    *   Confirms the source of the rainfall intensity data (City of Austin DCM Section 2.4.3, Table 2-2B) and explicitly notes that intensities account for NOAA Atlas 14.
    *   READ to verify the regulatory standards used for the hydrological calculations.

*   **Blocks 2, 3, 4, 7, 9, 10: various — Boilerplate, Administrative & Reference Data**
    *   These blocks contain administrative information including a reference to landscape sheet 32 for the tree list (Block 2), the Texas 811 call-before-you-dig notice (Block 3), the Engineer's seal for Jason K. Rodgers (Block 4), standard legal/utility disclaimers (Block 7), the legal property description for Lot 1 Mecey Subdivision (Block 9), and the 1"=20' graphic scale (Block 10).
    *   READ briefly for project administrative details or specific legal descriptions; otherwise, these can generally be skipped during a technical review.

---

- `block-5.md` — table: A table detailing the post-developed rational method runoff calculations for various sub-basins (A1 
- `block-6.md` — table: A table detailing the 25-year storm inlet calculations for grate inlets, including sub-basin area, Q

All other block detail in `./blocks.md`
