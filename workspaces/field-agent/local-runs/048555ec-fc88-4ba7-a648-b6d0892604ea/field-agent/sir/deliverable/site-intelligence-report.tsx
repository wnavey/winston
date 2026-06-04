// @ts-nocheck
import * as React from 'react';
import { View, Text } from '@react-pdf/renderer';
import {
  NoeticDocument,
  CoverPage,
  ContentsPage,
  NoeticPage,
  MarkdownBody,
  KeyValue,
  Divider,
  SectionHeading,
  SubHeading,
  SeverityBadge,
  Callout,
  Table,
  Badge,
} from '/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/noetic-pdf/src/index';

const HAS_CONCEPT_PLAN = true;

const REPORT_TITLE = 'Site Intelligence Report & Concept Plan Review';

function Report() {
  return (
    <NoeticDocument title={`${REPORT_TITLE} -- 9101 Cameron Rd`}>
      {/* ── Cover ── */}
      <CoverPage
        title={REPORT_TITLE}
        subtitle="9101 Cameron Rd, Austin, TX"
        date="June 4, 2026"
      />

      {/* ── Contents ── */}
      <ContentsPage
        title={REPORT_TITLE}
        metadata={[
          { label: 'Property', value: '9101 Cameron Rd, Austin, TX 78753' },
          { label: 'Legal', value: 'Unit 1, Cameron Ferguson Condominiums' },
          { label: 'Acreage', value: '1.01 AC (44,150 SF)' },
          { label: 'Owner', value: 'D & M Precision Inc (per TCAD)' },
          { label: 'Parcel ID', value: 'TCAD 928312' },
          { label: 'Zoning', value: 'CS (General Commercial Services)' },
          { label: 'Jurisdiction', value: 'City of Austin, full purpose' },
          { label: 'Proposed Use', value: 'AutoZone Store No. 11094 -- 7,375 SF retail' },
          { label: 'Report Date', value: 'June 4, 2026' },
          { label: 'Prepared by', value: 'Noetic' },
        ]}
        tocItems={[
          '1. Executive Summary',
          '2. Property Identity',
          '3. Jurisdiction & Regulatory Framework',
          '4. Chain of Title & Recorded Instruments',
          '5. Environmental Constraints',
          '6. Infrastructure & Utilities',
          '7. Programs & Opportunities',
          '8. Discipline Findings',
          '9. Concept Plan Review',
          '10. Recommendations & Open Questions',
        ]}
      />

      {/* ── 1. Executive Summary ── */}
      <NoeticPage>
        <SectionHeading number={1}>Executive Summary</SectionHeading>
        <MarkdownBody markdown={`This Site Intelligence Report evaluates the feasibility of developing a 7,375-square-foot AutoZone retail store (Store No. 11094, Prototype 74) at 9101 Cameron Road in Austin, Texas. The property is a 1.01-acre parcel (44,150 SF) zoned CS (General Commercial Services) within the City of Austin's full-purpose jurisdiction.\n\n**The proposed use is permitted by right with no discretionary approvals required.** The entitlement path is fully administrative -- site development permit review by DSD staff -- with no Planning Commission or City Council hearings triggered. This is the lowest-risk entitlement pathway available in Austin.`} />

        <Callout variant="action" label="Primary Risk:">
          The concept plan's current layout places the building behind surface parking relative to Cameron Road. Austin's Subchapter E design standards prohibit or heavily restrict this configuration. The building will likely need to be repositioned closer to Cameron Road, or an Alternative Equivalent Compliance (AEC) application will be required. This is the single most consequential site plan issue.
        </Callout>

        <MarkdownBody markdown={`**Key findings at a glance:**\n- **Zoning headroom is exceptional.** The project uses 8% of allowed FAR, 40% of allowed impervious cover, and 33% of allowed height. No dimensional variance is needed.\n- **Subchapter E compliance is the critical design constraint.** Build-to zone, parking placement, entrance orientation, and facade transparency requirements all affect the AutoZone prototype layout on Cameron Road.\n- **Three heritage trees must be preserved** (Live Oak 28", American Elm 29.5", Sycamore 25.5"), with Critical Root Zones constraining site grading and building placement. A 33" Ligustrum classified as Heritage on the survey is actually an invasive species exempt from heritage protections -- correcting this classification reduces variance exposure.\n- **ROW dedication of approximately 25 feet along Cameron Road is required** per the ASMP target of 154 feet, reducing usable site depth.\n- **CWQZ and CEF setback areas constrain the northern and eastern portions of the site**, limiting where stormwater infrastructure and site improvements can be placed.\n- **The condominium regime (Cameron Ferguson Condominiums) is an unresolved data gap.** The declaration may impose use restrictions or architectural controls beyond CS zoning. This document must be reviewed before site plan submission.`} />
      </NoeticPage>

      {/* ── 2. Property Identity ── */}
      <NoeticPage>
        <SectionHeading number="2">Property Identity</SectionHeading>
        <Table
          headerStyle="dark"
          columns={[
            { header: 'Field', width: 180, bold: true },
            { header: 'Value', flex: 1 },
            { header: 'Source', width: 160 },
          ]}
          rows={[
            { Field: 'Address', Value: '9101 Cameron Rd, Austin, TX 78753', Source: 'Concept plan' },
            { Field: 'Parcel ID', Value: '928312 (TCAD)', Source: 'TCAD / concept plan' },
            { Field: 'Legal Description', Value: 'Unit 1, Cameron Ferguson Condominiums, Doc. No. 2018119069, O.P.R.T.C.T.', Source: 'Concept plan' },
            { Field: 'Owner of Record', Value: 'D & M Precision Inc', Source: 'TCAD (2020 assessment)' },
            { Field: 'Site Area', Value: '1.01 AC / 44,150 SF', Source: 'Concept plan table' },
            { Field: 'Original Subdivision', Value: 'Trigg Addition, Vol. 68, Pg. 79, P.R.T.C.T.', Source: 'Concept plan' },
            { Field: 'Controlling Plat', Value: 'Resubdivision of Cameron Ferguson Park, Doc. No. 201800004', Source: 'Concept plan' },
            { Field: 'County', Value: 'Travis County, Texas', Source: 'Geocode' },
            { Field: 'Assessed Value (2020)', Value: '$486,678 (Land: $435,600 / Improvements: $51,078)', Source: 'TCAD via RealtyTrac' },
            { Field: 'Existing Improvements', Value: '2,640 SF industrial/commercial building (1985), slab foundation, metal roof', Source: 'TCAD' },
          ]}
        />
        <MarkdownBody markdown={`The property is Unit 1 of the Cameron Ferguson Condominiums, a commercial condominium regime established in 2018. The existing 2,640-square-foot building dates to 1985 and has minimal improvement value ($51,078 vs. $435,600 land value), indicating favorable redevelopment economics.\n\nAdjacent properties include ZF Holdings Inc. (3.075 acres, south), D & M Precision / Precision Engine Service (1.014 acres, east, within Trigg Addition), the Housing Authority of the City of Austin (west), and Cameron Road right-of-way (north).`} />
      </NoeticPage>

      {/* ── 3. Jurisdiction & Regulatory Framework ── */}
      <NoeticPage>
        <SectionHeading number="3">Jurisdiction & Regulatory Framework</SectionHeading>
        <Table
          headerStyle="light"
          columns={[
            { header: 'Element', width: 200, bold: true },
            { header: 'Determination', flex: 1 },
          ]}
          rows={[
            { Element: 'Jurisdiction', Determination: 'City of Austin, full-purpose city limits' },
            { Element: 'County', Determination: 'Travis County' },
            { Element: 'Base Zoning', Determination: 'CS (General Commercial Services)' },
            { Element: 'Combining Districts', Determination: 'None' },
            { Element: 'Overlays', Determination: 'None (no NP, CO, MU, NCCD, TOD, CVC, Historic)' },
            { Element: 'Watershed', Determination: 'Little Walnut Creek -- Urban classification' },
            { Element: 'ASMP Street Level', Determination: 'Cameron Rd: Level 4 (Corridor Mobility)' },
            { Element: 'Neighborhood Plan', Determination: 'Not within an adopted neighborhood plan area' },
            { Element: 'Imagine Austin', Determination: 'Near Imagine Austin activity corridor (Cameron Rd)' },
            { Element: 'Subchapter E', Determination: 'Applies -- nonresidential site plan on principal street' },
            { Element: 'Site Plan Type', Determination: 'Administrative (DSD Director)' },
            { Element: 'Procedural Path', Determination: 'Standard administrative site plan -- no commission or council hearing' },
          ]}
        />
        <MarkdownBody markdown={`The regulatory profile is straightforward: CS zoning with no overlays, in an Urban watershed, requiring an administrative site plan. The only procedural complexity is Subchapter E compliance for the Cameron Road frontage.`} />

        <SubHeading>Active permits & case history</SubHeading>
        <MarkdownBody markdown={`No active site development permits, building permits, plat amendments, variances, or other open cases were identified on this parcel through web research of the City of Austin Development Services Department records. The Cameron Road / Dessau Road Safety Project (a public infrastructure project funded through the 2020 Mobility Bond) is actively under construction in the Cameron Road corridor, which may affect construction-phase access and ROW coordination.\n\nFor verification, the applicant should confirm permit status through the Austin Build + Connect (AB+C) portal or at the pre-application conference.`} />
      </NoeticPage>

      {/* ── 4. Chain of Title & Recorded Instruments ── */}
      <NoeticPage>
        <SectionHeading number="4">Chain of Title & Recorded Instruments</SectionHeading>
        <Table
          headerStyle="dark"
          columns={[
            { header: 'Instrument', width: 160 },
            { header: 'Type', width: 120 },
            { header: 'Reference', width: 160 },
            { header: 'Burdens this parcel?', flex: 1 },
          ]}
          rows={[
            { Instrument: 'Condo Declaration', Type: 'Condominium', Reference: 'Doc. 2018119069', 'Burdens this parcel?': 'Yes -- governs Unit 1 use, maintenance, common elements' },
            { Instrument: 'Resubdivision Plat', Type: 'Plat', Reference: 'Doc. 201800004', 'Burdens this parcel?': 'Yes -- controlling plat; conditions run with land' },
            { Instrument: 'Electric Easement', Type: 'Utility', Reference: 'Doc. 2013157214', 'Burdens this parcel?': 'Yes -- western portion of site' },
            { Instrument: 'Drainage Easement', Type: 'Drainage', Reference: 'Doc. 2014138374', 'Burdens this parcel?': 'Yes -- southern portion' },
            { Instrument: '10\' P.U.E.', Type: 'Public utility', Reference: 'Doc. 200800021', 'Burdens this parcel?': 'Yes -- south/SE boundary' },
            { Instrument: '7.5\' P.U.E.', Type: 'Public utility', Reference: 'Doc. 200800021', 'Burdens this parcel?': 'Yes -- eastern boundary' },
            { Instrument: '25\' ROW Reserve', Type: 'ROW', Reference: 'Doc. 201800004', 'Burdens this parcel?': 'Yes -- Cameron Rd frontage; dedication required' },
            { Instrument: '15\' W.W.E.', Type: 'Wastewater', Reference: 'Vol. 11285, Pg. 2104', 'Burdens this parcel?': 'Yes -- wastewater main corridor' },
            { Instrument: 'Varying W.E.', Type: 'Water', Reference: 'Doc. partially illegible', 'Burdens this parcel?': 'Likely -- protects 36" or 14" water line' },
            { Instrument: 'Trigg Addition', Type: 'Original plat', Reference: 'Vol. 68, Pg. 79', 'Burdens this parcel?': 'Possible -- deed restrictions may still run; verify expiration' },
          ]}
        />

        <Callout variant="data-gap" label="Critical data gap:">
          The full text of the condominium declaration (Doc. No. 2018119069), controlling plat (Doc. No. 201800004), and Trigg Addition deed restrictions (Vol. 68, Pg. 79) were not reviewed for this report. County clerk documents were not downloaded. These instruments should be obtained at title commitment and reviewed by counsel for use restrictions, architectural controls, and conditions of approval that may affect the proposed development.
        </Callout>
      </NoeticPage>

      {/* ── 5. Environmental Constraints ── */}
      <NoeticPage>
        <SectionHeading number="5">Environmental Constraints</SectionHeading>

        <SeverityBadge level="moderate">CWQZ boundaries cross the site in multiple locations, restricting development within the 100-year fully-developed floodplain. Most construction is prohibited in CWQZ absent a Land Use Commission variance (LDC 25-8-261).</SeverityBadge>

        <SeverityBadge level="moderate">CEF setback lines on the eastern and northeastern portions indicate springs, seeps, or other Critical Environmental Features. Default 150-foot buffer applies; reducible to 50 feet with hydrogeologic justification (ECM 1.10.4).</SeverityBadge>

        <SeverityBadge level="moderate">Three heritage trees (Live Oak 28", American Elm 29.5", Sycamore 25.5") impose Critical Root Zone constraints on building and parking placement. CRZ radii of 25.5-29.5 feet affect grading, utilities, and foundation work.</SeverityBadge>

        <SeverityBadge level="none">The site is not in the Edwards Aquifer Recharge Zone, Barton Springs Zone, or a mapped Erosion Hazard Zone. No endangered species habitat has been identified. The Urban Watershed classification imposes no separate impervious cover cap below the 95% CS zoning limit.</SeverityBadge>

        <MarkdownBody markdown={`**Watershed:** Little Walnut Creek, Urban classification -- the least restrictive tier under Austin's Comprehensive Watersheds Ordinance. Regulated by LDC Chapter 25-8, Subchapter A, Article 8.\n\n**Water quality treatment is required** for all new impervious cover exceeding 8,000 SF (the proposed IC of 16,666 SF triggers this). Green Stormwater Infrastructure (GSI) has been mandatory since November 2022 (LDC 25-8-213(C)). The preliminary pond shown on the concept plan must incorporate GSI elements or obtain a documented exemption.\n\n**An Environmental Resource Inventory (ERI) will be required** to confirm CEF locations and negotiate final buffer dimensions with the Watershed Protection Department. The ERI field survey should be scheduled before site plan submittal.`} />
      </NoeticPage>

      {/* ── 6. Infrastructure & Utilities ── */}
      <NoeticPage>
        <SectionHeading number="6">Infrastructure & Utilities</SectionHeading>
        <Table
          headerStyle="dark"
          columns={[
            { header: 'Utility', width: 130, bold: true },
            { header: 'Existing Infrastructure', flex: 1 },
            { header: 'Key Constraint', width: 200 },
          ]}
          rows={[
            { Utility: 'Water', 'Existing Infrastructure': '36" transmission main, 14" main, 8" main along/near Cameron Rd', 'Key Constraint': '36" is transmission -- no direct tap (UCM 2.9.2.A.4.a). Connect to 8" main.' },
            { Utility: 'Wastewater', 'Existing Infrastructure': '8" and 10" WW lines on site; manholes with inverts documented', 'Key Constraint': 'Gravity service available. No SER likely if connecting to existing mains within 100 ft.' },
            { Utility: 'Storm Drainage', 'Existing Infrastructure': '24" storm line, grate inlets on site', 'Key Constraint': 'Detention required. Storm drain connection within 300 ft available.' },
            { Utility: 'Electric', 'Existing Infrastructure': 'Austin Energy service territory; electric easement on site', 'Key Constraint': 'Standard ESPA post-site-plan. No transmission lines adjacent.' },
            { Utility: 'Gas', 'Existing Infrastructure': 'Texas Gas Service available', 'Key Constraint': 'Standard commercial service.' },
            { Utility: 'Transit', 'Existing Infrastructure': 'CapMetro Route 37/339 on Cameron Rd', 'Key Constraint': 'Bus stops nearby; transit access favorable.' },
          ]}
        />
        <MarkdownBody markdown={`**ROW Dedication:** Cameron Road is ASMP Level 4 with a target ROW of 154 feet. Existing ROW is approximately 99-116 feet. The concept plan shows a 25-foot ROW reserve (Doc. No. 201800004) consistent with the dedication gap. Dedication will be required at site plan as a condition of approval.\n\n**Cameron Road Safety Project:** The Cameron Road / Dessau Road Safety Project is actively under construction (groundbreaking October 2025), which may affect construction-phase traffic management and utility coordination.`} />
      </NoeticPage>

      {/* ── 7. Programs & Opportunities ── */}
      <NoeticPage>
        <SectionHeading number="7">Programs & Opportunities</SectionHeading>

        <Callout variant="insight" label="RSMP fee-in-lieu potential:">
          The Regional Stormwater Management Program (RSMP) may allow this site to pay a fee-in-lieu for stormwater detention above the 2-year storm, reducing the on-site pond footprint. An RSMP feasibility meeting with the Watershed Protection Department should occur before site plan completeness check. Eligibility for the Little Walnut Creek watershed should be confirmed.
        </Callout>

        <Callout variant="insight" label="Invasive species reclassification:">
          The heritage tree survey classifies Ligustrum #17 (33") and Arizona Ash #13 (19") and #18 (39") as Heritage/Protected trees. These species are on Austin's exempt invasive species list (ECM 3.5.4.A.2.b). Correcting the classification eliminates heritage variance requirements and mitigation costs for these three trees, reducing both regulatory risk and project timeline.
        </Callout>

        <MarkdownBody markdown={`**Programs evaluated but not applicable:**\n- Density bonus programs (DDBP, DB90, ETOD, VMU) -- residential/mixed-use only; not available for single-use commercial retail\n- HOME Initiative -- affects residential zoning districts; CS commercial not impacted\n- Parkland dedication -- commercial uses exempt since January 1, 2024\n- Tax Increment Financing / TIRZ -- property is not within a designated TIF district\n- Federal Opportunity Zone -- check Census tract eligibility (not confirmed)\n- Site Plan Lite -- not available for this project size/use; residential only`} />
      </NoeticPage>

      {/* ── 8. Discipline Findings ── */}
      <NoeticPage>
        <SectionHeading number="8">Discipline Findings</SectionHeading>
        <SubHeading>Constraint matrix</SubHeading>
        <MarkdownBody markdown={`The table below consolidates the significant and moderate findings across all ten disciplines. Detail and citations follow in sections 8.1 through 8.10.`} />
        <Table
          headerStyle="dark"
          columns={[
            { header: 'Discipline', width: 90, bold: true },
            { header: 'Topic', width: 200 },
            { header: 'Level', width: 80 },
            { header: 'Citation', flex: 1 },
          ]}
          rows={[
            { Discipline: 'Site', Topic: 'Parking between building and Cameron Rd', Level: 'Significant', Citation: 'Subchapter E 2.2' },
            { Discipline: 'Site', Topic: 'Build-to zone -- 0% frontage', Level: 'Significant', Citation: 'Subchapter E 2.2' },
            { Discipline: 'Zoning', Topic: 'Condo regime dimensional ambiguity', Level: 'Significant', Citation: 'Doc. 2018119069' },
            { Discipline: 'Site', Topic: 'Entrance orientation to Cameron Rd', Level: 'Moderate', Citation: 'Subchapter E 2.4' },
            { Discipline: 'Site', Topic: 'Facade transparency/glazing', Level: 'Moderate', Citation: 'Subchapter E Art. 3' },
            { Discipline: 'Trees', Topic: 'Heritage tree CRZ conflicts', Level: 'Moderate', Citation: 'LDC 25-8-601; ECM 3.5.2' },
            { Discipline: 'Trees', Topic: 'Survey misclassification (invasives)', Level: 'Moderate', Citation: 'ECM 3.5.4.A.2.b' },
            { Discipline: 'Env', Topic: 'CEF setback on east/NE', Level: 'Moderate', Citation: 'LDC 25-8-281; ECM 1.10.4' },
            { Discipline: 'Floodplain', Topic: 'CWQZ crosses site', Level: 'Moderate', Citation: 'LDC 25-8-261' },
            { Discipline: 'Transport', Topic: 'ROW dedication ~25 ft', Level: 'Moderate', Citation: 'ASMP Level 4' },
            { Discipline: 'Stormwater', Topic: 'GSI mandatory for WQ', Level: 'Moderate', Citation: 'LDC 25-8-213(C)' },
            { Discipline: 'Site', Topic: 'AEC application likely needed', Level: 'Moderate', Citation: 'Subchapter E Art. 5' },
          ]}
        />
      </NoeticPage>

      {/* ── 8.1 Zoning & Land Use ── */}
      <NoeticPage>
        <SubHeading>8.1 Zoning & Land Use</SubHeading>
        <SeverityBadge level="none">Retail Sale of Auto Parts is permitted by right in CS. No CUP, rezoning, or variance required. Fully administrative site plan path.</SeverityBadge>
        <Table
          headerStyle="light"
          columns={[
            { header: 'Standard', width: 160, bold: true },
            { header: 'CS Allowed', width: 100 },
            { header: 'Proposed', width: 100 },
            { header: 'Utilization', width: 80 },
            { header: 'Status', flex: 1 },
          ]}
          rows={[
            { Standard: 'Max Height', 'CS Allowed': '60 ft', Proposed: '~20 ft', Utilization: '33%', Status: 'Complies' },
            { Standard: 'Max FAR', 'CS Allowed': '2:1', Proposed: '0.17:1', Utilization: '8.3%', Status: 'Complies' },
            { Standard: 'Max IC', 'CS Allowed': '95%', Proposed: '37.75%', Utilization: '40%', Status: 'Complies' },
            { Standard: 'Building Coverage', 'CS Allowed': '95%', Proposed: '17%', Utilization: '18%', Status: 'Complies' },
            { Standard: 'Front Setback', 'CS Allowed': '10 ft min', Proposed: '10 ft', Utilization: 'At min', Status: 'Verify measurement basis' },
            { Standard: 'Side/Rear Setback', 'CS Allowed': '0 ft', Proposed: 'TBD', Utilization: '--', Status: 'Likely complies' },
            { Standard: 'Parking Minimum', 'CS Allowed': 'None (repealed)', Proposed: '12 spaces', Utilization: 'N/A', Status: 'Operator choice' },
          ]}
        />
        <SeverityBadge level="significant">Condominium regime creates dimensional calculation ambiguity. Unclear whether setbacks, FAR, and IC are measured against Unit 1 boundaries or the pre-regime parent tract. Must resolve with DSD before site plan submission.</SeverityBadge>
        <MarkdownBody markdown={`**Bicycle parking** is required under LDC 25-6-477 but is not shown on the concept plan. This must be added before site plan submission.\n\n**Compatibility Standards** (LDC Article 10) may apply at the western boundary if the Housing Authority property is classified as residential use. If triggered, compatibility would impose setback and height limits on the western edge. At the proposed 20-foot building height, compatibility height limits (up to 40 feet at 50-100 feet from the triggering property) are unlikely to constrain the design, but setback requirements should be verified.`} />
      </NoeticPage>

      {/* ── 8.2 Site Plan & Form ── */}
      <NoeticPage>
        <SubHeading>8.2 Site Plan & Form</SubHeading>
        <SeverityBadge level="significant">Concept plan places building behind parking relative to Cameron Road. Subchapter E 2.2 restricts surface parking between building and principal street. This is the most consequential site plan risk -- the building will likely need repositioning or an AEC application.</SeverityBadge>
        <SeverityBadge level="significant">Build-to zone: 0% of Cameron Rd net frontage is occupied by building facade. Subchapter E requires 40% (Urban Roadway) or a lower percentage (Suburban Roadway). No building face at the build-to line.</SeverityBadge>
        <SeverityBadge level="moderate">Primary customer entrance must face Cameron Rd and be architecturally prominent (Subchapter E 2.4). AutoZone Prototype 74 typically orients the entrance toward the parking lot.</SeverityBadge>
        <SeverityBadge level="moderate">Facade transparency: 40% glazing on front facade, 25% on visible sides required (Subchapter E Art. 3). Auto parts retail prototypes often feature blank side/rear walls that may not comply.</SeverityBadge>
        <MarkdownBody markdown={`**Procedural path:** Administrative site plan (DSD Director). No commission hearing triggered. Site Plan Lite is not available for this project.\n\n**AEC pathway:** If the AutoZone prototype cannot be repositioned due to CWQZ, heritage tree CRZ, pond, or truck-turn constraints, Alternative Equivalent Compliance (LDC Subchapter E Art. 5) provides an administrative mechanism. AEC requires a concept plan demonstrating the alternative design meets the intent of the standard. Pre-approval before site plan submission is recommended; expect 2-4 months.`} />
      </NoeticPage>

      {/* ── 8.3 Stormwater & Drainage ── */}
      <NoeticPage>
        <SubHeading>8.3 Stormwater & Drainage</SubHeading>
        <SeverityBadge level="moderate">Green Stormwater Infrastructure (GSI) is mandatory for water quality treatment (LDC 25-8-213(C)). The preliminary pond must incorporate GSI elements (biofiltration, rain garden, or equivalent) or obtain a documented exemption.</SeverityBadge>
        <MarkdownBody markdown={`**Water quality volume:** Required for 16,666 SF of proposed IC using the formula WQV = (0.5 + 0.1 per 10% IC over 20%) x DA x 3,630. For a 1.01-acre site at 37.75% IC, the WQV is approximately 2,200 CF.\n\n**Detention:** No-increase rule applies at every point of discharge for the 2-, 10-, 25-, and 100-year storms. The 2-year on-site control is required regardless of RSMP participation. Atlas 14 rainfall data is mandatory.\n\n**RSMP eligibility:** If the Little Walnut Creek watershed is eligible, the RSMP fee-in-lieu could eliminate detention requirements above the 2-year storm, substantially reducing the pond footprint. An RSMP feasibility meeting must occur before the site plan completeness check.\n\n**Preliminary pond location:** The concept plan positions the pond in the CWQZ area northwest of the building. Ponds in CWQZ may require additional permitting coordination with the Watershed Protection Department. The pond must not encroach on the 25-foot ROW reserve.`} />
      </NoeticPage>

      {/* ── 8.4 Floodplain ── */}
      <NoeticPage>
        <SubHeading>8.4 Floodplain</SubHeading>
        <SeverityBadge level="moderate">CWQZ boundaries cross the site, indicating the 100-year fully-developed floodplain (for Urban watersheds) extends onto the property. Most development within CWQZ requires a Land Use Commission environmental variance (LDC 25-8-41).</SeverityBadge>
        <MarkdownBody markdown={`**FEMA flood zone:** The building area is likely in FEMA Zone X (minimal flood hazard) based on the site's position relative to the drainage features. However, the CWQZ presence indicates that portions of the site -- particularly the northern area near Cameron Rd and the eastern area near the CEF setback -- are within the City of Austin's fully-developed 100-year floodplain, which is typically more extensive than the FEMA SFHA.\n\n**Building placement:** The proposed building footprint appears to be positioned outside the CWQZ boundaries based on the concept plan. This should be confirmed through a formal floodplain delineation study using the City's approved hydraulic models.\n\n**Pond in CWQZ:** The preliminary pond is positioned within the CWQZ area. Water quality ponds and detention facilities may be permissible within CWQZ under certain conditions, but require coordination with the Watershed Protection Department and may require compensatory storage analysis.`} />
      </NoeticPage>

      {/* ── 8.5 Environmental ── */}
      <NoeticPage>
        <SubHeading>8.5 Environmental</SubHeading>
        <SeverityBadge level="moderate">CEF setback lines on the eastern and northeastern portions of the site indicate Critical Environmental Features (likely springs or seeps). Default 150-foot buffer applies; administrative reduction to 50 feet is possible with hydrogeologic justification (ECM 1.10.4).</SeverityBadge>
        <MarkdownBody markdown={`**Environmental Resource Inventory (ERI):** An ERI will be required to confirm CEF type, location, and buffer reduction eligibility. The ERI field survey (hydrogeologic, vegetation, and wastewater sub-reports) should be commissioned before site plan submittal. ERI is valid for 7 years.\n\n**Not in sensitive zones:** The site is not in the Edwards Aquifer Recharge Zone, Barton Springs Zone, or a mapped Erosion Hazard Zone. No Save Our Springs restrictions apply. No endangered species habitat has been identified.\n\n**IC limit:** The Urban Watershed classification imposes water quality treatment requirements rather than numeric IC caps. The 95% CS zoning IC limit governs, and the proposed 37.75% is well within this limit.`} />
      </NoeticPage>

      {/* ── 8.6 Tree Protection & Erosion Control ── */}
      <NoeticPage>
        <SubHeading>8.6 Tree Protection & Erosion Control</SubHeading>
        <SeverityBadge level="moderate">Three correctly classified heritage trees impose CRZ constraints: Live Oak #15 (28-ft CRZ), American Elm #16 (29.5-ft CRZ), and Sycamore #14 (reclassified from Protected to Heritage at 25.5"). CRZ circles constrain building, parking, and utility placement.</SeverityBadge>
        <SeverityBadge level="moderate">Tree survey misclassification: Ligustrum #17 (33") and Arizona Ash #13 (19") and #18 (39") are on Austin's exempt invasive species list. Their Heritage/Protected classifications are incorrect. Reclassification eliminates variance requirements and mitigation costs, but removal permits are still required.</SeverityBadge>
        <MarkdownBody markdown={`**Trees to be removed (4):** Persian Silk Tree #7 (invasive, no mitigation), Arizona Ash #10 and #12 (invasive, no mitigation), Mulberry #11 (confirm species -- White Mulberry is invasive/exempt; Red Mulberry is native/regulated). All are under 12" and non-protected even if not invasive.\n\n**CRZ protection during construction:** Chain-link fence at CRZ boundary required (ECM 3.6.1). No cut/fill within the Quarter CRZ (innermost zone). Grading, utility trenching, and staging within the Half CRZ must be limited. The site plan must demonstrate that all proposed improvements -- including over-excavation, scaffolding, and form bracing -- stay outside CRZ protection limits.\n\n**ESC plan required** for all site disturbance (LDC 25-8-181). Standard Urban watershed requirements apply. No phasing triggers (site is well under 25 acres).`} />
      </NoeticPage>

      {/* ── 8.7 Transportation ── */}
      <NoeticPage>
        <SubHeading>8.7 Transportation</SubHeading>
        <SeverityBadge level="moderate">ROW dedication of approximately 25 feet along Cameron Road is required. ASMP target ROW is 154 feet; existing ROW is approximately 99-116 feet. The concept plan's 25-foot ROW reserve (Doc. No. 201800004) is consistent with this requirement.</SeverityBadge>
        <SeverityBadge level="none">No Traffic Impact Analysis required. Estimated trip generation of approximately 450 daily trips is well below the 2,000-trip TIA threshold. Sub-threshold mitigation (sidewalks, bicycle facilities) may still be required.</SeverityBadge>
        <MarkdownBody markdown={`**Driveway access:** Cameron Rd is ASMP Level 4. Driveway type, spacing, and width must comply with TCM Section 7 access management standards. Type I (residential) driveways are prohibited on Level 3+ streets. The concept plan shows one primary driveway from Cameron Rd.\n\n**Truck-turn:** The concept plan's truck-turn exhibit includes an engineer note: "If distance can be changed to 35', truck turn could probably work, but 40' would make a comfortable fit." This indicates the current drive aisle width is marginal for the design vehicle. The aisle width constraint affects the site layout south of the building.\n\n**Sidewalk and bicycle facilities:** New sidewalk along the Cameron Rd frontage will be required. Protected bicycle facilities may be required if Cameron Rd is on the Bicycle Priority Network.`} />
      </NoeticPage>

      {/* ── 8.8 Water & Wastewater ── */}
      <NoeticPage>
        <SubHeading>8.8 Water & Wastewater</SubHeading>
        <SeverityBadge level="note">The 36-inch water line along Cameron Road is a transmission main. No meter or fire-line tap is permitted on a transmission main without a Director exception (UCM 2.9.2.A.4.a). The project must connect to the 8-inch service main.</SeverityBadge>
        <MarkdownBody markdown={`**Water service:** Austin Water retail territory confirmed. The 8-inch main provides adequate capacity for commercial retail service. No Service Extension Request (SER) is anticipated if the connection is within 100 feet of the property boundary.\n\n**Wastewater service:** Gravity sewer is available via the 8-inch and 10-inch wastewater lines on site. Existing manholes with documented inverts confirm adequate grade for gravity connection. No lift station required.\n\n**Capital recovery fees:** Water and wastewater capital recovery (impact) fees will be assessed at tap permit issuance. For a 7,375 SF commercial retail building, fees are estimated at $15,000-$25,000 combined (varies by meter size and current fee schedule). Verify with Austin Water at pre-application.\n\n**Reclaimed water / OWRS:** Check whether a reclaimed water main is within 250-500 feet, which would trigger mandatory connection requirements (LDC 25-9-412). The Onsite Water Reuse System (OWRS) mandate (effective April 2024) should also be evaluated for this project.`} />
      </NoeticPage>

      {/* ── 8.9 Fire ── */}
      <NoeticPage>
        <SubHeading>8.9 Fire</SubHeading>
        <SeverityBadge level="none">Standard fire access and sprinkler requirements apply. Single-story Group M (Mercantile) occupancy at 7,375 SF. No high-rise, standpipe, or aerial apparatus triggers. 2024 IFC governs.</SeverityBadge>
        <MarkdownBody markdown={`**Sprinkler system:** An NFPA 13 automatic sprinkler system is likely required based on IBC thresholds for Group M occupancy. Sprinkler installation provides a fire-flow reduction (75% per IFC Table B105.2) and extends the allowable apparatus-to-building distance from 150 feet to 200 feet.\n\n**Fire flow:** At 1,500 gpm minimum for commercial (reducible to 1,000 gpm only with pre-approved AMOC), the existing water infrastructure should be adequate. A field-verified fire flow test (AFD-conducted or witnessed, within 1 year of site plan submission) will be required.\n\n**Fire lane:** 25-foot minimum width, 14-foot vertical clearance, within 150 feet (200 feet with NFPA 13) of all exterior walls. HS-20 loading required for all fire lane surfaces.\n\n**Hydrant coverage:** Primary hydrant within 400 feet (500 feet if sprinklered). 300-foot maximum spacing in commercial areas. Confirm nearest hydrant location and flow test data.\n\n**FDC:** One FDC required for the sprinkler system, street-side, oriented to fire apparatus access. Must be within 300 feet of nearest hydrant.`} />
      </NoeticPage>

      {/* ── 8.10 Parkland ── */}
      <NoeticPage>
        <SubHeading>8.10 Parkland</SubHeading>
        <SeverityBadge level="none">Parkland dedication does not apply. Commercial and retail uses are exempt from parkland dedication requirements under the current ordinance (LDC 25-1-601(C), effective January 1, 2024, per Ord. 20231130-087). The prior commercial parkland requirement was repealed.</SeverityBadge>
      </NoeticPage>

      {/* ── 9. Concept Plan Review ── */}
      <NoeticPage>
        <SectionHeading number="9">Concept Plan Review</SectionHeading>
        <SubHeading>9.1 Plan Summary</SubHeading>
        <Table
          headerStyle="light"
          columns={[
            { header: 'Field', width: 180, bold: true },
            { header: 'Value', flex: 1 },
            { header: 'Source', width: 140 },
          ]}
          rows={[
            { Field: 'Project', Value: 'AutoZone Store No. 11094, Prototype 74', Source: 'Title block' },
            { Field: 'Engineer', Value: 'Pape-Dawson Engineers', Source: 'Title block' },
            { Field: 'Drawing Date', Value: 'April 2026', Source: 'Title block' },
            { Field: 'Scale', Value: '1 inch = 20 feet', Source: 'Title block' },
            { Field: 'Building', Value: '7,375 SF single-story retail', Source: 'Building info table' },
            { Field: 'Building Coverage', Value: '17% (7,375 SF / 44,150 SF)', Source: 'Tracking table' },
            { Field: 'Proposed IC', Value: '37.75% (16,666 SF)', Source: 'Tracking table' },
            { Field: 'Parking', Value: '12 spaces (10 standard, 1 accessible, 1 van)', Source: 'Parking table' },
            { Field: 'WQ/Detention', Value: 'Preliminary pond NW of building', Source: 'Drawing' },
            { Field: 'Design Vehicle', Value: 'Delivery truck (SU-30 class estimated)', Source: 'Truck-turn exhibit' },
            { Field: 'Heritage Trees', Value: '3 heritage + 3 protected to remain; 4 trees to remove', Source: 'Tree survey table' },
          ]}
        />
      </NoeticPage>

      <NoeticPage>
        <SubHeading>9.2 Measured setbacks (read from scale)</SubHeading>
        <MarkdownBody markdown={`Published scale: 1 inch = 20 feet. At 300 DPI, 1 pixel = 0.067 feet.`} />
        <Table
          headerStyle="dark"
          columns={[
            { header: 'Edge', width: 80, bold: true },
            { header: 'Code minimum', width: 110 },
            { header: 'CSP labeled', width: 110 },
            { header: 'Measured (building face)', width: 150 },
            { header: 'Compliance', flex: 1 },
          ]}
          rows={[
            { Edge: 'North', 'Code minimum': '10 ft', 'CSP labeled': '10 ft', 'Measured (building face)': 'Labeled 10 ft', Compliance: 'At minimum -- tight' },
            { Edge: 'East', 'Code minimum': '0 ft (interior)', 'CSP labeled': 'Not labeled', 'Measured (building face)': 'Est. 12-17 ft from property line', Compliance: 'Complies' },
            { Edge: 'South', 'Code minimum': '0 ft (interior/rear)', 'CSP labeled': 'Not labeled', 'Measured (building face)': 'Est. 40-60 ft from S property line', Compliance: 'Complies' },
            { Edge: 'West', 'Code minimum': '10 ft (if street side)', 'CSP labeled': 'Not labeled', 'Measured (building face)': 'Est. 80+ ft from W boundary', Compliance: 'Complies (verify street-side)' },
          ]}
        />
        <Callout variant="correction" label="Setback measurement basis:">
          The 10-foot front setback is labeled on the concept plan from the property line (not the ROW line). After ROW dedication (~25 feet), the property line will shift southward. The engineer must confirm that the 10-foot setback is measured from the post-dedication property line, not the existing property line or curb face. If measured from the existing line, the effective setback after dedication may be less than 10 feet.
        </Callout>
      </NoeticPage>

      <NoeticPage>
        <SubHeading>9.3 Impervious cover verification</SubHeading>
        <Table
          headerStyle="light"
          columns={[
            { header: 'Surface', width: 200, bold: true },
            { header: 'Area (SF)', width: 110 },
            { header: '% of lot', width: 90 },
            { header: 'Source', flex: 1 },
          ]}
          rows={[
            { Surface: 'Building footprint', 'Area (SF)': '7,375', '% of lot': '16.7%', Source: 'CSP building info table' },
            { Surface: 'Parking + drive aisles', 'Area (SF)': 'Est. 5,000-6,000', '% of lot': 'Est. 11-14%', Source: 'Estimated from 12 spaces + aisles' },
            { Surface: 'Sidewalks + service pads', 'Area (SF)': 'Est. 1,500-2,000', '% of lot': 'Est. 3-5%', Source: 'Estimated from plan' },
            { Surface: 'Dumpster pad', 'Area (SF)': 'Est. 200-400', '% of lot': 'Est. 0.5-1%', Source: 'Estimated from plan' },
            { Surface: 'Total proposed IC', 'Area (SF)': '16,666', '% of lot': '37.75%', Source: 'CSP tracking table' },
            { Surface: 'IC limit (CS zoning)', 'Area (SF)': '41,943', '% of lot': '95%', Source: 'LDC 25-2-492(D)' },
            { Surface: 'Headroom', 'Area (SF)': '25,277', '% of lot': '57.25%', Source: 'Calculated' },
          ]}
        />
        <MarkdownBody markdown={`The concept plan tracking table states total proposed IC of 16,666 SF (37.75%). The individual surface areas are not itemized on the plan. The sum of estimated surfaces (building + parking + sidewalks + dumpster) is consistent with the stated total. IC is well within the 95% zoning limit with 57% headroom.`} />
        <Callout variant="data-gap" label="IC component breakdown not provided:">
          The concept plan tracking table provides only the total IC figure without an itemized breakdown by surface type. The engineer should provide a detailed IC schedule on the next concept plan revision showing each impervious surface, its area, and its percentage of lot area. This is standard practice for site plan submittal.
        </Callout>
      </NoeticPage>

      <NoeticPage>
        <SubHeading>9.4 Compliance Check</SubHeading>
        <Table
          headerStyle="dark"
          columns={[
            { header: 'Constraint', width: 200, bold: true },
            { header: 'Plan response', flex: 1 },
            { header: 'Level', width: 90 },
          ]}
          rows={[
            { Constraint: 'Subchapter E parking placement', 'Plan response': 'Not addressed -- parking in front of building', Level: 'Non-compliant' },
            { Constraint: 'Subchapter E build-to zone', 'Plan response': 'Not addressed -- 0% frontage at build-to', Level: 'Non-compliant' },
            { Constraint: 'Subchapter E entrance orientation', 'Plan response': 'Not verifiable from concept plan', Level: 'Unclear' },
            { Constraint: 'Heritage tree CRZ preservation', 'Plan response': 'Trees marked to remain; CRZ shown on drawing', Level: 'Addressed' },
            { Constraint: 'CWQZ setback', 'Plan response': 'Building positioned outside CWQZ (appears compliant)', Level: 'Addressed' },
            { Constraint: 'CEF buffer', 'Plan response': 'CEF setback lines shown; building outside buffer', Level: 'Addressed' },
            { Constraint: 'ROW dedication', 'Plan response': '25\' ROW reserve shown; potential dedication area noted', Level: 'Addressed' },
            { Constraint: 'WQ/detention', 'Plan response': 'Preliminary pond shown NW of building', Level: 'Preliminary' },
            { Constraint: 'Fire access', 'Plan response': 'Fire lane shown on drawing', Level: 'Addressed' },
            { Constraint: 'ADA access', 'Plan response': 'ADA path and accessible parking shown', Level: 'Addressed' },
          ]}
        />
      </NoeticPage>

      <NoeticPage>
        <SubHeading>9.5 Discipline Plan-Specific Findings</SubHeading>
        <MarkdownBody markdown={`**Truck turn clearance:** The engineer's red annotation on Sheet 2 notes that the current drive-aisle distance is marginal: "If distance can be changed to 35', truck turn could probably work, but 40' would make a comfortable fit." This constraint interacts with the heritage tree CRZ limits and the Subchapter E parking-placement requirement. If the building is repositioned to the Cameron Rd frontage, the truck-turn geometry changes entirely.\n\n**Pond placement vs. ROW reserve:** The preliminary pond is positioned in the CWQZ area, which is also near the 25-foot ROW reserve. If ROW dedication shifts the property line southward, the pond may need to be redesigned or relocated. The interaction between ROW dedication, CWQZ limits, and pond footprint is a critical design coordination item.\n\n**Heritage tree CRZ vs. building footprint:** The concept plan shows heritage trees (shown as large circles) near the building and parking area. The 28-foot CRZ of the Live Oak (#15) and 29.5-foot CRZ of the American Elm (#16) create exclusion zones where no grading, utilities, or foundations may be placed. The engineer should verify that no proposed improvements encroach on the Half CRZ or Quarter CRZ.`} />
      </NoeticPage>

      <NoeticPage>
        <SubHeading>9.6 Findings that differ from CSP / cover-sheet assumptions</SubHeading>

        <Callout variant="correction" label="Lot area discrepancy:">
          The concept plan tracking table states 44,150 SF. The feasibility intake states 44,250 SF. A 100-SF discrepancy. Use the plan table value (survey-derived) as primary.
        </Callout>

        <Callout variant="correction" label="IC allotment discrepancy:">
          The intake states an 80% IC limit. The plan table shows 95%. The 95% figure is the correct CS zoning IC limit. The 80% figure does not correspond to any known Austin watershed IC restriction for Urban watersheds. This should be clarified and the correct limit (95%) used in all calculations.
        </Callout>

        <Callout variant="correction" label="Tree survey date:">
          The intake states December 30, 2020. The concept plan note states December 30, 2025. The plan date is more recent and governs. Tree surveys are valid for 5 years from the survey date (ECM 3.3.1.A).
        </Callout>
      </NoeticPage>

      <NoeticPage>
        <SubHeading>9.7 Open Questions for the Engineer</SubHeading>
        <MarkdownBody markdown={`1. **Building height, finished floor elevation, foundation type, and construction type** are shown as placeholders ("XX", "XXX", "XXXX") on the concept plan. These must be specified for fire code analysis, floodplain compliance (FFE must be at minimum 2 feet above the design flood elevation), and IBC construction type determination.\n\n2. **Can the AutoZone Prototype 74 be repositioned** to place the building facade at the Cameron Road frontage with parking behind or beside the building? What are the dimensional constraints of the prototype that prevent this?\n\n3. **What is the design vehicle AASHTO designation** for the truck-turn exhibit? The turning radius suggests SU-30 class, but confirmation is needed for drive-aisle width design.\n\n4. **Has an RSMP feasibility meeting been scheduled** with the Watershed Protection Department? This should occur before the site plan completeness check.\n\n5. **Has the tree survey been submitted to the City Arborist** for classification review? The invasive species misclassifications (Ligustrum #17, Arizona Ash #13 and #18) should be corrected before site plan submittal to avoid unnecessary variance proceedings.\n\n6. **What is the intended disposition of the existing 2,640-SF building?** Full demolition is assumed but should be confirmed.\n\n7. **Has the condominium association been consulted** regarding the proposed development? The declaration may require unit-owner approval for site modifications affecting common elements.`} />
      </NoeticPage>

      {/* ── 10. Recommendations & Open Questions ── */}
      <NoeticPage>
        <SectionHeading number="10">Recommendations & Open Questions</SectionHeading>

        <SubHeading>Data gaps requiring action</SubHeading>
        <MarkdownBody markdown={`The following items could not be resolved through desk research and require action before or during site plan preparation.`} />
        <Table
          headerStyle="dark"
          columns={[
            { header: 'Gap', width: 200, bold: true },
            { header: 'Action / source', flex: 1 },
            { header: 'Owner', width: 120 },
          ]}
          rows={[
            { Gap: 'Condo declaration review', 'Action / source': 'Pull Doc. No. 2018119069 from Travis County Clerk; review for use restrictions, architectural controls, common-element provisions', Owner: 'Counsel' },
            { Gap: 'Controlling plat notes', 'Action / source': 'Pull Doc. No. 201800004 from Travis County Clerk; review conditions of approval', Owner: 'Counsel' },
            { Gap: 'Trigg Addition restrictions', 'Action / source': 'Pull Vol. 68, Pg. 79; assess expiration and applicability', Owner: 'Counsel' },
            { Gap: 'CEF field verification', 'Action / source': 'Commission ERI field survey (RPLS + ISA arborist); submit to WPD for buffer negotiation', Owner: 'Engineer' },
            { Gap: 'Subchapter E roadway class', 'Action / source': 'Request Cameron Rd classification determination at DSD pre-application conference', Owner: 'Engineer' },
            { Gap: 'Fire flow test', 'Action / source': 'Schedule AFD-witnessed hydrant flow test on mains serving the site (valid 1 year)', Owner: 'Engineer' },
            { Gap: 'Construction type', 'Action / source': 'Specify IBC construction type for fire-flow calculation and sprinkler analysis', Owner: 'Architect' },
            { Gap: 'Condo dimensional basis', 'Action / source': 'Clarify with DSD whether setbacks/FAR/IC apply to Unit 1 boundaries or parent tract', Owner: 'Engineer' },
            { Gap: 'Varying water easement', 'Action / source': 'Confirm document number and width from title commitment', Owner: 'Title company' },
          ]}
        />

        <SubHeading>What to do next, in priority order</SubHeading>
        <MarkdownBody markdown={`1. **Obtain and review the condominium declaration** (Doc. No. 2018119069). This is the most material unresolved item -- the declaration may contain use restrictions or approval requirements that affect project feasibility.\n\n2. **Schedule a DSD pre-application conference.** At this meeting, confirm: (a) Subchapter E roadway classification for Cameron Rd, (b) whether dimensional standards apply to Unit 1 or the parent tract, (c) the procedural path and expected review cycle.\n\n3. **Evaluate building repositioning vs. AEC.** The Subchapter E parking-placement and build-to-zone conflicts are the most consequential design issues. Determine whether the Prototype 74 can be reoriented to place the facade at the Cameron Rd frontage, or whether AEC is the preferred path.\n\n4. **Correct the tree survey classifications.** Submit the updated survey to the City Arborist, reclassifying Ligustrum #17, Arizona Ash #13, and Arizona Ash #18 as exempt invasive species. This reduces variance exposure and simplifies the permitting path.\n\n5. **Commission the ERI field survey.** The CEF setback areas on the east/NE require field verification. Early completion allows buffer negotiation with WPD before site plan submittal.\n\n6. **Schedule the RSMP feasibility meeting** with WPD. If eligible, RSMP fee-in-lieu can reduce the pond footprint, freeing site area for the building repositioning.\n\n7. **Obtain a fire flow test** from AFD on the nearest hydrants serving the 8-inch water main.\n\n8. **Pull all recorded instruments** from Travis County Clerk at title commitment. Review with counsel for easement conflicts, deed restrictions, and ROW obligations.\n\n9. **Complete the concept plan** by specifying building height, FFE, foundation type, construction type, and design vehicle AASHTO designation. Add bicycle parking. Provide itemized IC schedule.\n\n10. **Submit site plan application** through Austin Build + Connect once items 1-9 are resolved.`} />
      </NoeticPage>
    </NoeticDocument>
  );
}

export default <Report />;
