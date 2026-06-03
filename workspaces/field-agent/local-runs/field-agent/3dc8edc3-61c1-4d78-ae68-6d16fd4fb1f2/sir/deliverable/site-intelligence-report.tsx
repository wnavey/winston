// @ts-nocheck
// Site Intelligence Report — 12713 Cinchring Ln, Austin TX 78727
// Intended use: demolish existing single-family residence and construct a duplex (2 units).

import React from 'react';
import {
  NoeticDocument,
  CoverPage,
  ContentsPage,
  NoeticPage,
  SectionHeading,
  SubHeading,
  SeverityBadge,
  Callout,
  Table,
  KeyValue,
  MarkdownBody,
  Divider,
} from '/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/noetic-pdf/src/index';

const REPORT_TITLE = 'Site Intelligence Report';
const PROPERTY_ADDRESS = '12713 Cinchring Ln, Austin, TX 78727';
const REPORT_DATE = 'June 3, 2026';

function Report() {
  return (
    <NoeticDocument title={`${REPORT_TITLE} — ${PROPERTY_ADDRESS}`}>
      {/* ── Cover ──────────────────────────────────────── */}
      <CoverPage
        title={REPORT_TITLE}
        subtitle={PROPERTY_ADDRESS}
        date={REPORT_DATE}
      />

      {/* ── Contents ───────────────────────────────────── */}
      <ContentsPage
        title={REPORT_TITLE}
        metadata={[
          { label: 'Property', value: PROPERTY_ADDRESS },
          { label: 'Legal', value: 'Lot 12, Block M, Scofield Subdivision, Cabinet 91, Slide 264-265, Travis County' },
          { label: 'Acreage', value: '~0.18 ac (~7,840 SF estimated; 8,054 SF per TCAD)' },
          { label: 'Parcel ID', value: 'TCAD 362652 / GeoID 0262200208 (pending verification)' },
          { label: 'Zoning', value: 'SF-2 (per web research) or MF-3 (per COA GIS) — Zoning Verification Letter required' },
          { label: 'Jurisdiction', value: 'City of Austin (full purpose) — Travis County' },
          { label: 'Proposed Use', value: 'Demolish existing SFR; construct duplex (2 attached residential units)' },
          { label: 'Report Date', value: REPORT_DATE },
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
          '9. Considerations Before Concept Design',
        ]}
      />

      {/* ── 1. Executive Summary ──────────────────────── */}
      <NoeticPage>
        <SectionHeading number={1}>Executive Summary</SectionHeading>

        <SeverityBadge level="significant">
          Duplex use is almost certainly prohibited by the Scofield Declaration of Covenants. Project feasibility depends on resolving the private-covenant constraint before design proceeds.
        </SeverityBadge>

        <MarkdownBody markdown={`This report evaluates the feasibility of demolishing the existing single-family residence at 12713 Cinchring Lane and constructing a two-unit duplex on the same lot. The analysis covers ten development disciplines, the property's recorded title burdens, and applicable City of Austin programs.

**City zoning supports the duplex.** Under the HOME Initiative Phase 1 ordinance (effective February 5, 2024), a duplex is permitted by right on SF-2 and SF-3 lots without rezoning, conditional use permit, or Board of Adjustment action. The project proceeds via residential building permit only. If the base zoning is confirmed as MF-3 (as indicated by prior COA GIS analysis), a duplex is the minimum-density permitted use and would not even require HOME Phase 1 authorization.

**Private covenants are the controlling constraint.** The Scofield Residential Owners Association Declaration of Covenants (Vol. 11863, Pg. 1147, Travis County) almost certainly restricts every lot to single-family residential use. Prior analysis of the Declaration confirmed a narrow single-family definition under Section 4.1, a 75-percent supermajority amendment threshold across approximately 570 owners, and enforcement provisions including daily fines and attorneys' fee recovery added by the Eighth Amendment (2005). HOME Initiative Phase 1 does not override private deed restrictions under Texas law.

**Three forward paths are viable.** (1) Pivot to a single-family replacement house, which aligns with both city zoning and private covenants. (2) Pursue a CC&R amendment campaign, which requires a supermajority vote and is practically infeasible. (3) Acquire and hold pending CC&R termination or legislative pre-emption of HOA restrictions, which is speculative.

**If duplex were permitted,** the incremental costs over a replacement SFR are manageable: a second water/wastewater tap with capital recovery fees ($13,000-$27,000), sidewalk fee-in-lieu (~$2,250), and potential WUI Zone C ignition-resistant construction premium ($5,000-$15,000). No flood, environmental, or transportation hard stops exist. The lot qualifies for drainage review exemption under Site Plan Lite reforms.`} />
      </NoeticPage>

      {/* ── 2. Property Identity ──────────────────────── */}
      <NoeticPage>
        <SectionHeading number={2}>Property Identity</SectionHeading>

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Field', width: 160, bold: true },
            { header: 'Value', flex: 1 },
            { header: 'Source', width: 140 },
          ]}
          rows={[
            { Field: 'Street address', Value: '12713 Cinchring Lane, Austin, TX 78727', Source: 'Survey; TCAD' },
            { Field: 'Legal description', Value: 'Lot 12, Block M, Scofield Subdivision, Cabinet 91, Slide 264-265, Plat Records, Travis County, TX', Source: 'Plat; survey' },
            { Field: 'TCAD Property ID', Value: '362652 (pending verification)', Source: 'Prior analysis' },
            { Field: 'COA GeoID', Value: '0262200208 (pending verification)', Source: 'Prior analysis' },
            { Field: 'Lot area', Value: '~7,840-8,054 SF (0.18-0.185 ac)', Source: 'Survey est.; TCAD' },
            { Field: 'Frontage', Value: '~60 ft on Cinchring Lane (curved chord)', Source: 'Survey' },
            { Field: 'Approximate dimensions', Value: '60 ft front x ~127 ft depth', Source: 'Survey' },
            { Field: 'Existing improvement', Value: '1-story brick and wood SFR, ~2,095 SF, built 1993', Source: 'TCAD; listing' },
            { Field: 'Year built', Value: '1993', Source: 'TCAD; listing' },
            { Field: 'Plat reference', Value: 'Cabinet 91, Slide 264-265, Travis County Plat Records', Source: 'Plat' },
            { Field: 'School district', Value: 'Pflugerville ISD (Parmer Lane Elem / Westview MS / Connally HS)', Source: 'PfISD zones' },
          ]}
        />

        <SubHeading>Existing improvements</SubHeading>
        <MarkdownBody markdown={`The lot is improved with a 1-story brick and wood single-family residence (approximately 2,095 SF, 4 bedrooms / 2 bathrooms), a concrete driveway, a wood fence, and a concrete sanitary sewer vault. All existing improvements are proposed for demolition as part of the duplex project. The Scofield Farms HOA assessment is approximately $125 per quarter ($500/year).`} />
      </NoeticPage>

      {/* ── 3. Jurisdiction & Regulatory Framework ────── */}
      <NoeticPage>
        <SectionHeading number={3}>Jurisdiction & Regulatory Framework</SectionHeading>

        <MarkdownBody markdown={`The parcel is inside the full-purpose corporate limits of the City of Austin in Travis County. All city land development regulations (LDC Title 25), criteria manuals, and the Austin Strategic Mobility Plan apply. Pflugerville ISD is the school district despite the Austin city address — a common North Austin condition north of Parmer Lane.

There is no adopted neighborhood plan covering this parcel. The Imagine Austin Growth Concept Map designates Parmer Lane as an Activity Corridor approximately 0.5 miles north; no Activity Center is mapped at the Parmer/MoPac intersection. The parcel sits in "established residential" fabric.

Base zoning warrants a procedural note. Web-based research for this report identified the zoning as SF-2 based on neighborhood characteristics. However, a prior property-records analysis via the COA Zoning_1 GIS layer found MF-3 (Multi-Family Residence, Medium Density) at the parcel coordinates. The MF-3 reading is consistent with a known late-1980s and early-1990s Austin developer pattern, in which the development entity secured a higher zoning entitlement and then imposed a private deed restriction to deliver a single-family product. A Zoning Verification Letter from DSD (~$337) is required to confirm the authoritative reading before design.`} />

        <Table
          headerStyle="light"
          columns={[
            { header: 'Layer / framework', width: 180, bold: true },
            { header: 'Status', flex: 1 },
          ]}
          rows={[
            { 'Layer / framework': 'Jurisdiction', Status: 'City of Austin (full purpose); Travis County' },
            { 'Layer / framework': 'Base zoning', Status: 'SF-2 (web research) or MF-3 (COA GIS) — verify via Zoning Verification Letter' },
            { 'Layer / framework': 'Overlays / conditional overlays', Status: 'None' },
            { 'Layer / framework': 'Neighborhood Plan Combining District (-NP)', Status: 'None' },
            { 'Layer / framework': 'Adopted neighborhood plan', Status: 'None covers this parcel' },
            { 'Layer / framework': 'Station-area plan / TOD overlay', Status: 'Not applicable — outside Project Connect Phase 1 alignment' },
            { 'Layer / framework': 'ETOD overlay', Status: 'Not applicable' },
            { 'Layer / framework': 'Imagine Austin', Status: 'Established residential; ~0.5 mi from Parmer Lane Activity Corridor' },
          ]}
        />

        <SubHeading>Active permits & case history</SubHeading>
        <MarkdownBody markdown={`No active development permits, zoning cases, variance applications, or open code-enforcement actions were identified for this parcel as of the report date. No pending zoning cases were found for the immediate Scofield area. Pre-application meeting with DSD Residential Plan Review is recommended before final design.`} />
      </NoeticPage>

      {/* ── 4. Chain of Title & Recorded Instruments ──── */}
      <NoeticPage>
        <SectionHeading number={4}>Chain of Title & Recorded Instruments</SectionHeading>

        <SeverityBadge level="significant">
          Scofield Declaration of Covenants restricts lots to single-family residential use. This is the controlling constraint on the duplex project.
        </SeverityBadge>

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Instrument', width: 170, bold: true },
            { header: 'Type', width: 140 },
            { header: 'Burdens this parcel', flex: 1 },
          ]}
          rows={[
            { Instrument: 'Vol. 11863 Pg. 1147', Type: 'Master Declaration of CC&Rs (Scofield Subdivision)', 'Burdens this parcel': 'Yes — controlling document; single-family-use restriction (§4.1)' },
            { Instrument: 'Amendments 1-8', Type: 'Amendments to Declaration', 'Burdens this parcel': 'Yes — 8th Amendment (Doc 2005103195) adds $25/day fines, attorneys\' fees, lien priority' },
            { Instrument: 'Cabinet 91, Slide 264-265', Type: 'Recorded plat', 'Burdens this parcel': 'Yes — establishes lot boundaries, 5\' PUE, 25\' building line' },
            { Instrument: 'Vol. 660 Pg. 968', Type: 'Blanket electric easement', 'Burdens this parcel': 'Yes per survey — scope to be confirmed via title commitment' },
            { Instrument: 'Vol. 11863 Pg. 1147', Type: 'Ingress/egress easement for utilities', 'Burdens this parcel': 'Yes — utility access' },
            { Instrument: 'Per plat', Type: '5-foot Public Utility Easement', 'Burdens this parcel': 'Yes — along lot boundaries; no structures permitted' },
            { Instrument: 'Vol. 11863 Pg. 1147', Type: 'Declarant reserved ROW/easement rights (10\' max each side)', 'Burdens this parcel': 'Yes — standard subdivision provision' },
          ]}
        />

        <SubHeading>Key Declaration provisions</SubHeading>
        <Callout variant="correction" label="Use restriction (§4.1):">
          The Declaration limits every property in Scofield to single-family residential use, with a narrow definition (occupants related by blood, marriage, or adoption; foster children; domestic servants). A two-unit duplex is the prohibited use category. HOME Initiative Phase 1 does not pre-empt this private covenant. The full CC&R text should be obtained and reviewed by Texas real estate counsel before committing further diligence cost.
        </Callout>

        <Callout variant="action" label="Enforcement and term:">
          The Eighth Amendment (2005) added $25 per day fines on covenant violations, recovery of attorneys' fees by the prevailing HOA, and lien priority for assessments and fines. The Declaration auto-renews; amendment to remove the single-family restriction requires a 75 percent supermajority of approximately 570 owners.
        </Callout>

        <SubHeading>Platted building line</SubHeading>
        <MarkdownBody markdown={`The recorded plat establishes a 25-foot building line along the front of Lot 12. This platted building line is more restrictive than the HOME Phase 1 zoning setback of 15 feet and controls the front setback under Austin permitting practice. To use the reduced 15-foot setback, the owner would need to replat or amend the plat — requiring subdivision review. The 25-foot front setback reduces the buildable envelope by approximately 10 feet of depth compared to the HOME Phase 1 standard.`} />
      </NoeticPage>

      {/* ── 5. Environmental Constraints ──────────────── */}
      <NoeticPage>
        <SectionHeading number={5}>Environmental Constraints</SectionHeading>

        <MarkdownBody markdown={`The parcel sits in north Austin on Blackland Prairie, east of MoPac and off the Edwards Plateau limestone outcrop. The environmental constraint profile is clean — none of the high-impact Austin environmental layers apply.`} />

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Constraint', width: 200, bold: true },
            { header: 'Status', width: 180 },
            { header: 'Implication', flex: 1 },
          ]}
          rows={[
            { Constraint: 'FEMA flood zone', Status: 'Zone X — outside SFHA', Implication: 'No flood insurance required; standard foundation. FIRM Panel 48453C0115E.' },
            { Constraint: 'City of Austin floodplain', Status: 'Outside 25-yr and 100-yr', Implication: 'No floodplain regulations apply.' },
            { Constraint: 'Edwards Aquifer zones', Status: 'Outside all zones', Implication: 'No TCEQ EAPP required.' },
            { Constraint: 'Critical Environmental Features', Status: 'None known on parcel', Implication: 'No CEF buffers. ERI form at permitting confirms.' },
            { Constraint: 'Endangered species habitat', Status: 'BCCP participation area', Implication: 'BCCP fee at permit; no individual ESA consultation.' },
            { Constraint: 'Watershed', Status: 'Walnut Creek (Suburban)', Implication: 'IC governed by zoning (45%); WQ controls apply at subdivision scale.' },
            { Constraint: 'Contamination / LUST', Status: 'None identified', Implication: 'Low risk; Phase I ESA recommended before demolition.' },
            { Constraint: 'Heritage trees', Status: 'Unknown — no survey', Implication: 'Tree survey required pre-design. See Trees discipline in Section 8.' },
            { Constraint: 'WUI Proximity Zone', Status: 'Zone C (per COA GIS)', Implication: 'Ignition-resistant construction required; $5,000-$15,000 premium.' },
          ]}
        />

        <SubHeading>Wildland-Urban Interface — Proximity Zone C</SubHeading>
        <Callout variant="action" label="Construction-cost premium:">
          The parcel maps to WUI Proximity Zone C per the COA Wildland-Urban Interface ArcGIS layer. Zone C is the lightest tier but triggers ignition-resistant construction: Class A roof covering, fire-resistant exterior wall assembly, ember-resistant attic vents, and defensible-space landscaping. Estimated $5,000-$15,000 added cost regardless of duplex vs. replacement SFR. Final confirmation recommended via COA WUI Zone Lookup tool.
        </Callout>
      </NoeticPage>

      {/* ── 6. Infrastructure & Utilities ─────────────── */}
      <NoeticPage>
        <SectionHeading number={6}>Infrastructure & Utilities</SectionHeading>

        <MarkdownBody markdown={`The parcel is fully served by Austin Energy (electric), Austin Water (water and wastewater), Texas Gas Service (gas), and Austin Resource Recovery (solid waste). The existing residence has all utility connections.`} />

        <Table
          headerStyle="light"
          columns={[
            { header: 'Utility', width: 140, bold: true },
            { header: 'Provider', width: 140 },
            { header: 'Status', flex: 1 },
          ]}
          rows={[
            { Utility: 'Electric', Provider: 'Austin Energy', Status: 'Existing service; second-unit meter required; ESPA per unit.' },
            { Utility: 'Gas', Provider: 'Texas Gas Service', Status: 'Available in service territory; verify at address.' },
            { Utility: 'Water', Provider: 'Austin Water', Status: 'Existing meter; second meter required for duplex.' },
            { Utility: 'Wastewater', Provider: 'Austin Water', Status: 'Existing sewer service; second lateral required; concrete vault on site.' },
            { Utility: 'Stormwater', Provider: 'COA Watershed Protection', Status: 'Monthly drainage charge; scales with impervious cover.' },
            { Utility: 'Solid waste', Provider: 'Austin Resource Recovery', Status: 'Curbside service (duplex qualifies at <=6 units).' },
            { Utility: 'Street', Provider: 'COA Public Works', Status: 'Cinchring Lane = ASMP Level 1; 50-ft ROW; no ROW dedication.' },
            { Utility: 'Transit', Provider: 'CapMetro', Status: 'Nearest bus ~1 mi on Parmer Ln; limited service.' },
            { Utility: 'Telecom', Provider: 'Spectrum / AT&T / Google Fiber', Status: 'Spectrum best coverage; AT&T Fiber limited; verify at address.' },
          ]}
        />

        <SubHeading>Water and wastewater — duplex-specific requirements</SubHeading>
        <Callout variant="action" label="Two-meter rule and Utility Tap Plan:">
          Austin Water requires individual water and wastewater meters per unit for new duplex construction. A Utility Tap Plan stamped by a Texas Professional Engineer is a hard gate before residential plan review. Engage civil engineering at schematic design, not at permit submittal.
        </Callout>

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Fee item (second unit)', width: 220, bold: true },
            { header: 'Estimated range', width: 140 },
            { header: 'Notes', flex: 1 },
          ]}
          rows={[
            { 'Fee item (second unit)': 'Water capital recovery fee', 'Estimated range': '$4,800-$8,000', Notes: 'Per ERC; plat-date tier determines rate' },
            { 'Fee item (second unit)': 'Wastewater capital recovery fee', 'Estimated range': '$2,900-$5,000', Notes: 'Per ERC' },
            { 'Fee item (second unit)': 'Water + WW tap fees', 'Estimated range': '$5,500-$14,000', Notes: '5/8" or 3/4" residential meter' },
            { 'Fee item (second unit)': 'PE-stamped Utility Tap Plan', 'Estimated range': '$2,000-$5,000', Notes: 'External civil engineering fee' },
            { 'Fee item (second unit)': 'Sidewalk fee-in-lieu', 'Estimated range': '~$2,250', Notes: '60 ft x 5 ft on Cinchring frontage' },
            { 'Fee item (second unit)': 'Total infrastructure delta vs replacement SFR', 'Estimated range': '$15,000-$35,000', Notes: 'Conservative central estimate' },
          ]}
        />

        <SubHeading>Transportation</SubHeading>
        <MarkdownBody markdown={`No transportation hard stops. A traffic impact analysis is not triggered (duplex generates ~10 net new daily trips, well below the 2,000 trips/day TIA threshold). The existing 50-foot ROW meets the ASMP Level 1 standard; no ROW dedication is required. One shared driveway serves both units. Austin's November 2023 parking minimum elimination means no on-site parking is required by code; design is market-driven.`} />

        <SubHeading>Stormwater and drainage</SubHeading>
        <MarkdownBody markdown={`The lot (~7,840 SF) qualifies for the Site Plan Lite drainage review exemption (threshold: 11,500 SF). No engineered drainage study, detention pond, or formal drainage plan is required. The Walnut Creek suburban watershed classification governs water quality regulations, but individual duplex lots are carved out of subdivision-scale impervious cover restrictions. The binding IC limit comes from zoning (45%).

The 15-foot drainage easement referenced on the plat must be confirmed and plotted from the recorded plat before schematic design. The concrete sanitary sewer vault near the rear lot line creates a compound constraint with the rear setback.`} />
      </NoeticPage>

      {/* ── 7. Programs & Opportunities ───────────────── */}
      <NoeticPage>
        <SectionHeading number={7}>Programs & Opportunities</SectionHeading>

        <MarkdownBody markdown={`City of Austin development programs are favorable for infill residential on this parcel. The relevant programs are listed below with eligibility status.`} />

        <Callout variant="insight" label="HOME Initiative Phase 1 (Ordinance 20231207-001):">
          By-right permission for up to three units per lot on SF-1, SF-2, and SF-3 zoned parcels citywide. No affordability strings. If base zoning is SF-2 or SF-3, HOME Phase 1 permits the duplex. If MF-3, a duplex is already by-right without HOME. Note: HOME does not override private deed restrictions.
        </Callout>

        <Callout variant="insight" label="Site Plan Lite Phase 1:">
          Residential projects of four units or fewer are exempt from formal site plan review. The project proceeds through DSD Residential Plan Review as a building permit, saving approximately $15,000-$40,000 in engineering and review fees.
        </Callout>

        <Callout variant="insight" label="Parking minimums eliminated (November 2023):">
          No minimum off-street parking is required for any use type citywide. Developers can size parking to market demand. Most duplex developers in suburban north Austin still provide 2 spaces per unit via driveway/garage.
        </Callout>

        <SubHeading>Programs verified not applicable</SubHeading>
        <Table
          headerStyle="light"
          columns={[
            { header: 'Program', width: 200, bold: true },
            { header: 'Why not applicable', flex: 1 },
          ]}
          rows={[
            { Program: 'ETOD Overlay', 'Why not applicable': 'Parcel is ~9 miles north of Project Connect Phase 1 light rail stations.' },
            { Program: 'VMU / DB90', 'Why not applicable': 'Targeted at corridor and mixed-use sites; not applicable to SF-zoned infill.' },
            { Program: 'Qualified Opportunity Zone', 'Why not applicable': 'Census tract is not a designated QOZ.' },
            { Program: 'Affordability Unlocked', 'Why not applicable': 'Requires 50% affordable units for 99 years; impractical at 2-unit scale.' },
            { Program: 'S.M.A.R.T. Housing', 'Why not applicable': 'Available if affordability commitments made, but fee savings (~$4,000) unlikely to justify deed-restricting 1 of 2 units.' },
            { Program: 'RSMP fee-in-lieu', 'Why not applicable': 'No detention obligation triggered at this scale.' },
            { Program: 'Parkland dedication', 'Why not applicable': 'Building-permit path on existing lot does not trigger parkland gateway.' },
          ]}
        />
      </NoeticPage>

      {/* ── 8. Discipline Findings — Constraint Matrix ─── */}
      <NoeticPage>
        <SectionHeading number={8}>Discipline Findings</SectionHeading>
        <SubHeading>Constraint matrix</SubHeading>

        <MarkdownBody markdown={`The constraint matrix below consolidates the significant and moderate findings across all ten development disciplines, plus the project's opportunities. Detail and citations follow in 8.1 through 8.10.`} />

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Discipline', width: 90, bold: true },
            { header: 'Topic', width: 200 },
            { header: 'Level', width: 80 },
            { header: 'Citation', flex: 1 },
          ]}
          rows={[
            { Discipline: 'Site', Topic: 'CC&R §4.1 prohibits duplex use', Level: 'significant', Citation: 'Scofield Declaration, Vol. 11863 Pg. 1147' },
            { Discipline: 'Trees', Topic: 'Heritage-tree contingency (no survey conducted)', Level: 'moderate', Citation: 'LDC §25-8 Subch B; Ord. 20100204-038' },
            { Discipline: 'Trees', Topic: 'Protected-tree mitigation costs ($5K-$25K)', Level: 'moderate', Citation: 'LDC §25-8 Subch B; ECM §3.5.4' },
            { Discipline: 'Water', Topic: 'Two-meter rule + tap fees ($13K-$27K)', Level: 'moderate', Citation: 'Austin Water CRF Schedule' },
            { Discipline: 'Water', Topic: 'PE-stamped Utility Tap Plan required', Level: 'moderate', Citation: 'Austin Water plan review' },
            { Discipline: 'Fire', Topic: 'WUI Zone C construction premium ($5K-$15K)', Level: 'moderate', Citation: 'Austin WUI Code; COA GIS' },
            { Discipline: 'Fire', Topic: '1-hour fire-rated party wall between units', Level: 'moderate', Citation: 'IRC §R302.3' },
            { Discipline: 'Stormwater', Topic: 'Sewer vault + rear setback compound constraint', Level: 'moderate', Citation: 'Survey; Austin Water' },
            { Discipline: 'Transport', Topic: 'Sidewalk fee-in-lieu (~$2,250)', Level: 'moderate', Citation: 'LDC §25-6-353' },
            { Discipline: 'Zoning', Topic: '25-ft platted building line (vs 15-ft HOME setback)', Level: 'moderate', Citation: 'Plat Vol. 11863 Pg. 1147' },
            { Discipline: 'Site', Topic: 'Asbestos survey required before demolition', Level: 'moderate', Citation: 'TCEQ NESHAP; 40 CFR 61 Subpart M' },
            { Discipline: 'Zoning', Topic: 'HOME Phase 1 — duplex by right', Level: 'opportunity', Citation: 'Ord. 20231207-001' },
            { Discipline: 'Site', Topic: 'Site Plan Lite exemption (saves $15K-$40K)', Level: 'opportunity', Citation: 'LDC §25-5-2' },
            { Discipline: 'Stormwater', Topic: 'Drainage review exemption (lot <=11,500 SF)', Level: 'opportunity', Citation: 'Site Plan Lite Phase 2' },
            { Discipline: 'Floodplain', Topic: 'FEMA Zone X confirmed', Level: 'opportunity', Citation: 'FIRM Panel 48453C0115E' },
          ]}
        />
      </NoeticPage>

      {/* ── 8.1 Zoning & Land Use ─────────────────────── */}
      <NoeticPage>
        <SubHeading>8.1 Zoning & Land Use</SubHeading>

        <SeverityBadge level="significant">
          CC&R single-family-only restriction defeats the duplex thesis regardless of base zoning.
        </SeverityBadge>

        <MarkdownBody markdown={`The base zoning requires verification. Web-based research identified SF-2 (Single-Family Residential, Standard Lot); a prior COA GIS query found MF-3 (Multi-Family Residence, Medium Density). The MF-3 reading is consistent with a common 1990s Austin developer pattern. Under either reading, a duplex is permitted by city zoning: under SF-2, HOME Phase 1 enables it; under MF-3, it is the minimum-density allowed use. A Zoning Verification Letter (~$337) is the canonical confirmation.

The dimensional envelope under SF-2 / HOME Phase 1 provides: 35 ft height, 40% building coverage (~3,136 SF footprint), 45% impervious cover (~3,528 SF), 0.40:1 FAR (~3,136 SF GFA). Setbacks: 15 ft front (HOME) but 25 ft from platted building line (controls), 5 ft interior side, 5 ft rear (HOME, reduced from 10 ft). No parking minimums apply.

No overlays encumber the parcel: no NCCD, no conditional overlay, no historic designation, no NP combining district, no ETOD, no scenic roadway.

The controlling constraint is private. The Scofield Declaration §4.1 restricts every property to single-family residential use. Texas case law confirms HOAs may enforce single-family-only deed covenants against HOME-permitted duplex construction. Three forward paths exist: (1) pivot to SFR replacement, (2) pursue Declaration amendment (75% supermajority of ~570 owners), or (3) acquire and hold pending future CC&R termination.`} />
      </NoeticPage>

      {/* ── 8.2 Site Plan & Form ──────────────────────── */}
      <NoeticPage>
        <SubHeading>8.2 Site Plan & Form</SubHeading>

        <MarkdownBody markdown={`The procedural path under city regulation is straightforward. Site Plan Lite exempts projects of four units or fewer from site plan review. The project proceeds through DSD Residential Plan Review as a building permit.

The required application stack includes: demolition permit (separate intake), residential building permit (combined building/electrical/plumbing/mechanical), tree disposition application if trees >=19" dbh are affected, address request for the second unit, and utility disconnect coordination. The 1993 house is post-1978 (no EPA RRP lead-paint survey required at that date) but may contain asbestos-containing materials — a TCEQ asbestos survey is required before the demolition permit. If ACM is found, abatement adds $3,000-$15,000 and extends the pre-construction schedule.

The CC&R-imposed form constraints would govern any permitted project: minimum 1,200 SF per unit, 2-story maximum, 50% exterior masonry minimum, attached 2-car garage required, ACC pre-approval mandatory.`} />
      </NoeticPage>

      {/* ── 8.3 Stormwater & Drainage ─────────────────── */}
      <NoeticPage>
        <SubHeading>8.3 Stormwater & Drainage</SubHeading>

        <MarkdownBody markdown={`A duplex on a single platted lot proceeds through residential building permit with plot-plan-scale drainage review. The lot (~7,840 SF) qualifies for the Site Plan Lite drainage review exemption (threshold: 11,500 SF), eliminating the need for an engineered drainage study or on-site detention.

Water quality controls are not triggered. The combined new and redeveloped impervious cover (estimated 3,500-4,400 SF) is below the 8,000 SF threshold for the water-quality control trigger outside the Barton Springs Zone. Walnut Creek is a Suburban watershed, and individual duplex lots are carved out of Subchapter A impervious cover restrictions per LDC §25-8-63(B).

RSMP fee-in-lieu is not relevant — the project triggers no detention obligations. The Scofield subdivision's existing regional water quality facilities may provide additional coverage.

The 15-foot drainage easement on the recorded plat and the concrete sanitary sewer vault near the rear lot line create a compound constraint on rear-yard development. The effective no-build envelope along the rear may extend deeper than the formal 5-foot rear setback. Austin Water Field Operations should be consulted on clear-zone requirements around the vault.`} />
      </NoeticPage>

      {/* ── 8.4 Floodplain ────────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.4 Floodplain</SubHeading>

        <MarkdownBody markdown={`The parcel is in FEMA Flood Zone X (outside the Special Flood Hazard Area), confirmed by the property survey against FIRM Panel 48453C0115E (effective June 16, 1993). The site is on upland terrain at approximately 850-870 feet elevation, well above the Walnut Creek floodplain corridor.

No federal flood insurance is required. No base flood elevation, elevation certificate, CLOMR, or LOMR applies. The parcel is also outside the City of Austin's locally-regulated 25-year and 100-year floodplain, Erosion Hazard Zone, Critical Water Quality Zone, and Water Quality Transition Zone.

Note: a November 2025 FEMA preliminary FIRM update for Travis County should be checked at building permit submittal as a verification step.`} />
      </NoeticPage>

      {/* ── 8.5 Environmental ─────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.5 Environmental</SubHeading>

        <MarkdownBody markdown={`The environmental picture is clean. The parcel is east of MoPac on Blackland Prairie. No Critical Environmental Features, Critical Water Quality Zone, Edwards Aquifer zones, salamander habitat, golden-cheeked warbler habitat, or karst invertebrate habitat affects this site. The BCCP participation fee applies at permit.

Walnut Creek watershed (Suburban classification) governs water quality regulations. IC limits apply at subdivision scale, not individual lots, per LDC §25-8-63(B); binding IC comes from zoning.

No Phase I ESA has been commissioned. Residential use history since the 1990s suggests low contamination risk, but a Phase I is recommended before demolition for lender/investor due diligence and to satisfy ASTM E1527-21 standards.

Soil conditions in the 78727 area feature high shrink-swell clay (Blackland Prairie Vertisols). A geotechnical report is recommended before foundation design; post-tensioned slab-on-grade or drilled piers are standard.`} />
      </NoeticPage>

      {/* ── 8.6 Tree Protection & Erosion Control ──────── */}
      <NoeticPage>
        <SubHeading>8.6 Tree Protection & Erosion Control</SubHeading>

        <MarkdownBody markdown={`Tree protection is the dominant non-CC&R physical constraint on building placement. No tree survey has been conducted — this is the single largest data gap. The house was built in 1993, giving the lot over 30 years of tree growth. A North Austin residential lot is likely to support two to five mature trees of common species (cedar elm, live oak, hackberry, pecan, Texas ash).

Protected trees (any species at 19" dbh) require mitigation if removed: 1:1 caliper-inch replacement on-site or fee-in-lieu (~$200/caliper inch). Estimated $5,000-$25,000 mitigation contingency depending on inventory.

Heritage trees (listed species at 24" dbh) require Land Use Commission approval for removal — historically low approval probability. On a 60-foot by 127-foot lot, the Critical Root Zone of even a single large tree (24" tree = 24-ft CRZ radius, ~1,810 SF circle) can consume a significant portion of the buildable area. CRZ protection at half the drip line will likely influence building placement.

Erosion/sediment control is routine. The disturbed area (~0.18 acres) is below the 1-acre TCEQ TPDES Construction General Permit threshold. Site-specific ESC is required per ECM §1.4: silt fence, stabilized construction entrance, tree protection fencing, concrete washout. Typical cost $1,500-$3,000.`} />
      </NoeticPage>

      {/* ── 8.7 Transportation ────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.7 Transportation</SubHeading>

        <MarkdownBody markdown={`Transportation requirements are essentially identical to a teardown-and-rebuild SFR. No TIA is triggered (~10 net new daily trips vs 2,000 threshold). No ROW dedication required — Cinchring Lane is ASMP Level 1 with 50-ft platted ROW matching standard.

Driveway permitting is straightforward: one driveway per frontage under 100 ft. Maximum apron width 25 ft. Existing curb cut is reusable. Minimum 30 ft from nearest cross-street curb return.

The sidewalk obligation under LDC §25-6-353 is the only meaningful transportation cost. New residential construction triggers sidewalk-or-fee-in-lieu along the 60-ft Cinchring frontage (60 ft x 5 ft = 300 SF). Fee-in-lieu is approximately $2,250; this trigger applies equally to a replacement SFR.

No scenic roadway overlay applies. No TxDOT review required. No protected bicycle facility on Cinchring.`} />
      </NoeticPage>

      {/* ── 8.8 Water & Wastewater ────────────────────── */}
      <NoeticPage>
        <SubHeading>8.8 Water & Wastewater</SubHeading>

        <MarkdownBody markdown={`The parcel is inside Austin Water's retail service area. The existing residence has both taps; the public mains have capacity for the second duplex unit without service-extension engineering.

Austin Water requires individual meters per unit. The existing single residential meter cannot serve as master meter; the project requires a second water tap and meter plus a second wastewater service lateral. A PE-stamped Utility Tap Plan is a hard gate before residential plan review.

Cost estimate for second-unit infrastructure:
- Water capital recovery fee: $4,800-$8,000 per ERC
- Wastewater capital recovery fee: $2,900-$5,000 per ERC
- Water and wastewater tap fees: $5,500-$14,000
- PE-stamped Utility Tap Plan: $2,000-$5,000 engineering
- Conservative total: $15,000-$32,000

The concrete sanitary sewer vault near the rear lot line serves the public sewer main. Second-unit lateral routing must work around it. Austin Water Field Operations should be consulted on clear-zone requirements.

No MUD, PID, or special district complications exist. The property is city-served throughout. No reclaimed water connection or on-site sewage facility applies.`} />
      </NoeticPage>

      {/* ── 8.9 Fire ──────────────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.9 Fire</SubHeading>

        <MarkdownBody markdown={`A duplex is an R-3 occupancy under IRC. R-3 keeps the project on the residential building permit path with no Fire Analysis Table or alternate means of compliance review.

Sprinkler requirements are a data gap. IRC §R313.1 nominally mandates NFPA 13D sprinklers in two-family dwellings, but Texas LGC §233.155 pre-empts municipal sprinkler mandates for one- and two-family dwellings. Austin has historically incorporated that pre-emption. Current status should be confirmed at DSD pre-application. This is the largest construction-cost swing item ($15,000-$25,000 if sprinklers are required).

A 1-hour fire-rated party wall is required between units per IRC §R302.3, continuous from foundation to underside of roof sheathing.

Fire apparatus access is satisfied by Cinchring Lane (paved public street); no on-site fire lane or turnaround is required. Hydrant flow — 1,000 GPM at 20 psi within 600 ft per IFC §507 — is almost certainly compliant on the mature north Austin water mains; a formal Austin Water flow test confirms.

WUI Proximity Zone C triggers ignition-resistant construction (detailed in Section 5).

Standard IRC residential life-safety items apply: hardwired interconnected smoke/CO alarms, emergency egress windows in sleeping rooms, visible distinct addresses per unit (12713-A / 12713-B).`} />
      </NoeticPage>

      {/* ── 8.10 Parkland ─────────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.10 Parkland</SubHeading>

        <MarkdownBody markdown={`Parkland is a non-issue on the residential building permit pathway. Austin's parkland dedication ordinance (LDC §25-1-601) attaches obligations at the site plan gateway (for multifamily and commercial) and the subdivision gateway (for single-family). A duplex on an existing platted lot triggers neither: Site Plan Lite exempts from site plan, and the existing plat is unchanged. No PARD review, no parkland Determination, no fee-in-lieu.

On-site parkland dedication is structurally impossible: the ordinance requires a quarter-acre minimum for dedicated parkland, well above this ~0.18-acre lot.

The parcel sits in the Walnut Creek parkland service area; the nearest large public park is Walnut Creek Metropolitan Park (~290 acres) approximately 2 miles south. No city parkland abuts the lot, so no Chapter 26 / Texas Parks and Wildlife Code concerns apply.`} />
      </NoeticPage>

      {/* ── 9. Considerations Before Concept Design ───── */}
      <NoeticPage>
        <SectionHeading number={9}>Considerations Before Concept Design</SectionHeading>

        <SubHeading>Data gaps requiring action</SubHeading>
        <MarkdownBody markdown={`The following items must be resolved before final design or substantial acquisition cost is committed.`} />

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Gap', width: 180, bold: true },
            { header: 'Action / source', flex: 1 },
            { header: 'Owner', width: 150 },
          ]}
          rows={[
            { Gap: 'Confirm base zoning', 'Action / source': 'Request Zoning Verification Letter from DSD (~$337). Confirms SF-2 or MF-3.', Owner: 'Buyer / DSD' },
            { Gap: 'CC&R enforceability and HOA posture', 'Action / source': 'Obtain full Declaration text from Inframark or Travis County Clerk. Engage Texas real estate counsel for enforceability opinion and HOA position letter.', Owner: 'Counsel' },
            { Gap: 'Tree inventory and CRZ mapping', 'Action / source': 'Commission ISA-certified arborist walk plus updated boundary survey ($1,500-$3,500). Required before building footprint can be finalized.', Owner: 'Arborist / surveyor' },
            { Gap: 'Drainage easement location on Lot 12', 'Action / source': 'Order recorded plat (Cabinet 91, Slide 264-265); civil engineer to plot the 15-ft drainage easement on a current survey.', Owner: 'Surveyor / civil engineer' },
            { Gap: 'Blanket electric easement scope (Vol. 660 Pg. 968)', 'Action / source': 'Obtain via title commitment; confirm with Austin Energy whether any distribution facilities exist on Lot 12.', Owner: 'Title company / AE' },
            { Gap: 'Sprinkler requirement for R-3 duplex', 'Action / source': 'Confirm with DSD residential intake at pre-application meeting; verify current LDC §25-12-1 status.', Owner: 'DSD / architect' },
            { Gap: 'Hydrant flow test', 'Action / source': 'Request flow test from Austin Water Field Operations.', Owner: 'Austin Water / engineer' },
            { Gap: 'WUI Proximity Zone confirmation', 'Action / source': 'Verify via COA WUI Zone Lookup tool before construction documents.', Owner: 'Architect' },
            { Gap: 'Phase I ESA', 'Action / source': 'Commission ASTM E1527-21 Phase I before demolition. Addresses lender due diligence and asbestos/LBP risk.', Owner: 'ESA consultant' },
            { Gap: 'Geotechnical report', 'Action / source': 'Commission geotech before foundation design. High shrink-swell clay requires engineered slab or pier foundation.', Owner: 'Geotech engineer' },
          ]}
        />

        <SubHeading>What to do next, in priority order</SubHeading>

        <MarkdownBody markdown={`The following sequence orders the work by dependency. No durations are assigned; the developer's team owns scheduling.

1. **Decision point on use program.** The CC&R §4.1 single-family-use restriction is the controlling constraint. Before committing further diligence cost, decide between (a) duplex contingent on CC&R action, (b) single-family replacement, or (c) pass on the parcel.

2. **If duplex remains the program:** engage Texas real estate counsel for a written opinion on CC&R enforceability and amendment feasibility before signing the purchase contract.

3. **DSD Zoning Verification Letter.** Confirms the base zoning reading. Required regardless of duplex vs. SFR strategy.

4. **Title commitment review.** Resolves the Vol. 660 Pg. 968 blanket electric easement scope, current owner, lien status, and HOA estoppel.

5. **Pre-application meeting with DSD Residential Plan Review.** Confirms procedural path, current fee schedule, sprinkler amendment status, and drainage-exemption practice.

6. **Arborist walk and updated boundary survey.** Resolves tree inventory and CRZ constraints. The updated survey also resolves the 15-foot drainage easement location.

7. **Engage civil engineer for Utility Tap Plan and drainage form.** Required before residential plan review will issue.

8. **Engage architect for schematic design.** Must incorporate WUI Zone C assemblies, Subchapter F McMansion envelope, and (if duplex and CC&Rs permit) any HOA ACC requirements.

9. **Demolition permit application** (separate from new construction permit). Commission asbestos survey before filing.

10. **Building permit application** with full architectural, structural, MEP set; Utility Tap Plan; tree disposition; ESC plan; sidewalk-or-fee-in-lieu election.`} />

        <Divider />

        <Callout variant="neutral" label="Scope note:">
          This report identifies constraints, opportunities, and data gaps for the proposed development. It does not draft engineering documents, surveys, or legal opinions. Schedule estimates are deliberately omitted; the engineering and construction teams own the timeline.
        </Callout>
      </NoeticPage>
    </NoeticDocument>
  );
}

export default <Report />;
