// @ts-nocheck
// Site Intelligence Report — 12713 Cinchring Ln, Austin TX 78727
// Intended use: demolish existing single-family residence and construct a duplex.

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
} from '../index';

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
          { label: 'Legal', value: 'Lot 12, Block M, Scofield Subdivision, Section II, Phase VI' },
          { label: 'Acreage', value: '0.185 ac (8,054 SF per TCAD)' },
          { label: 'Parcel ID', value: 'TCAD 362652 / GeoID 0262200208' },
          { label: 'Zoning', value: 'MF-3 (per COA Zoning_1 layer; pending Zoning Verification Letter)' },
          { label: 'Jurisdiction', value: 'City of Austin (full purpose) — Travis County, Council District 7' },
          { label: 'Proposed Use', value: 'Demolish existing single-family residence; construct duplex (2 attached residential units)' },
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
          Duplex use is prohibited by the recorded Scofield Declaration of Covenants. Project not feasible as scoped without HOA action.
        </SeverityBadge>

        <MarkdownBody markdown={`This report evaluates the feasibility of demolishing the existing single-family residence at 12713 Cinchring Lane and constructing a two-unit duplex on the same lot. The analysis covers ten development disciplines (zoning, site form, drainage, environmental, trees, transportation, water, wastewater, fire, parkland), the property's recorded title burdens, and every applicable City of Austin incentive program.

**Headline finding.** The City of Austin regulatory framework supports a duplex on this lot. The parcel is mapped MF-3 on the COA Zoning_1 GIS layer, which permits a duplex as the minimum-density allowed use, and even under a more restrictive SF-3 reading the HOME Initiative Phase 1 ordinance would independently permit it by-right. The path is a residential building permit; Site Plan Lite Phase 1 exempts the project from formal site plan review.

**Constraint that controls the outcome.** The Scofield Residential Owners Association master Declaration (Vol. 11863, Pg. 1147 of the Travis County Real Property Records) restricts every property in the subdivision to "single-family residential use" under §4.1. The Declaration's Eighth Amendment (Document No. 2005103195, recorded June 10, 2005) added enforcement provisions including $25 per day fines, attorneys' fees recovery, and lien priority over homestead. Amendment to remove the single-family restriction requires a 75 percent vote of the approximately 570 owners — practically infeasible. The Declaration auto-renews through at least December 31, 2032.

**What the buyer can do with this parcel.** Three forward paths are viable. (1) Pivot to a single-family replacement: demolition and rebuild of a single-family residence aligns with both city zoning and the private covenants; no friction. (2) Pursue a CC&R amendment campaign across the subdivision: long horizon, uncertain outcome, only worth pursuing if duplex outcomes are strategically important. (3) Acquire and hold pending future CC&R termination, or pending a Texas legislative pre-emption of HOA single-family restrictions — speculative.

**Cost and constraint summary if duplex were permitted.** Sidewalk fee-in-lieu (~$2,250) and a second water/wastewater tap with capital recovery fees ($13K–$27K) are the meaningful incremental costs over a teardown-and-rebuild single-family residence. WUI Proximity Zone C construction premium ($5K–$15K) applies to either scenario. No flood, environmental, or transportation hard stops; FEMA Zone X confirmed on current effective FIRM Panel 48453C0270J.`} />
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
            { Field: 'Street address', Value: '12713 Cinchring Lane, Austin, TX 78727', Source: 'TCAD; survey' },
            { Field: 'Legal description', Value: 'Lot 12, Block M, Scofield Subdivision, Section II, Phase VI', Source: 'TCAD; plat Cabinet 91 Slide 264-265' },
            { Field: 'TCAD Property ID', Value: '362652', Source: 'TCAD' },
            { Field: 'COA GeoID (10-digit)', Value: '0262200208', Source: 'COA GIS' },
            { Field: 'Lot area (TCAD)', Value: '8,054 SF (0.185 ac)', Source: 'TCAD' },
            { Field: 'Lot area (GIS polygon)', Value: '8,085 SF', Source: 'COA GIS' },
            { Field: 'Lot area (survey, estimated)', Value: '≈ 8,083 SF', Source: '1994 boundary survey' },
            { Field: 'Frontage', Value: '≈ 60 ft on Cinchring Lane (curved chord; R = 1,075 ft)', Source: 'Survey' },
            { Field: 'Approximate dimensions', Value: '60 ft front × ≈ 127 ft depth × 67 ft rear', Source: 'Survey' },
            { Field: 'Existing improvement', Value: '1-story brick and wood single-family residence, ~2,095 SF, 4 BR / 2 BA, 1993 build', Source: 'TCAD; MLS' },
            { Field: 'Plat reference', Value: 'Cabinet 91, Slide 264-265, Travis County Plat Records', Source: 'Plat; survey' },
            { Field: 'Council district', Value: '7', Source: 'COA GIS' },
            { Field: 'School district', Value: 'Pflugerville ISD (Parmer Lane Elementary / Westview MS / John B. Connally HS)', Source: 'PfISD attendance zones' },
            { Field: 'Census tract (2020 GEOID)', Value: '48453000421', Source: 'Census Geocoder' },
          ]}
        />

        <SubHeading>Current ownership and market status</SubHeading>
        <MarkdownBody markdown={`Travis Central Appraisal District records reflect the prior owner of record (the property has been at the same ownership since approximately 2013). The property is currently listed for sale at $499,000 (ACTRIS MLS 2532841); the current owner will be confirmed through the title commitment at acquisition. The HOA assessment is $125 per quarter to the Scofield Residential Owners Association (also known as Scofield Farms HOA), Inframark-managed.`} />

        <KeyValue
          items={[
            { label: '2025 list price', value: '$499,000 (active listing)' },
            { label: 'HOA dues', value: '$125 / quarter — Scofield Residential Owners Association' },
            { label: 'Estimated 2025 tax', value: '~$11,100 (combined entities)' },
          ]}
          layout="stacked"
        />
      </NoeticPage>

      {/* ── 3. Jurisdiction & Regulatory Framework ────── */}
      <NoeticPage>
        <SectionHeading number={3}>Jurisdiction & Regulatory Framework</SectionHeading>

        <MarkdownBody markdown={`The parcel is inside the full-purpose corporate limits of the City of Austin in Travis County. All city land development regulations (LDC Title 25), criteria manuals (Drainage, Environmental, Transportation, Utility), and the Austin Strategic Mobility Plan apply with no ETJ exceptions. Pflugerville ISD is the school district despite the Austin city address (a common North Austin condition north of Parmer Lane).

There is no adopted neighborhood plan covering this parcel. The North Austin Civic Association Neighborhood Plan (adopted 2000) covers an area south of Anderson Lane, well south of Scofield. The North Burnet–Gateway Neighborhood Plan covers an area west of MoPac. Wells Branch to the east is a municipal utility district, not a city planning area. The Imagine Austin Comprehensive Plan Growth Concept Map places the parcel in the "established residential" fabric, approximately 0.7 miles from the Tech Ridge Neighborhood Center designation and 0.5 miles west of the Interstate 35 Activity Corridor.

The parcel sits in the Desired Development Zone (DDZ), which makes it eligible for SMART Housing fee waivers if the affordability path is elected.

Base zoning warrants a procedural note. The COA Zoning_1 GIS feature service shows the parcel as MF-3 (Multi-Family Residence, Medium Density) at parcel coordinates. The surrounding Scofield Section II subdivision is platted and developed as single-family. The combination — MF base zoning overlaid on a deed-restricted single-family subdivision — is a known late-1980s and early-1990s Austin developer pattern, in which the development entity secured a higher zoning entitlement and then imposed a private deed restriction to deliver a single-family product. The base zoning persists at TCAD/COA whether or not new MF use is contemplated. The MF-3 reading should be confirmed with a DSD Zoning Verification Letter before final design.`} />

        <Table
          headerStyle="light"
          columns={[
            { header: 'Layer / framework', width: 180, bold: true },
            { header: 'Status', flex: 1 },
          ]}
          rows={[
            { 'Layer / framework': 'Jurisdiction', 'Status': 'City of Austin (full purpose); Travis County' },
            { 'Layer / framework': 'Base zoning (per COA GIS)', 'Status': 'MF-3 — verify via Zoning Verification Letter' },
            { 'Layer / framework': 'Overlays / conditional overlays', 'Status': 'None at parcel' },
            { 'Layer / framework': 'Neighborhood Plan Combining District (-NP)', 'Status': 'None' },
            { 'Layer / framework': 'Adopted neighborhood plan', 'Status': 'None covers this parcel' },
            { 'Layer / framework': 'Station-area plan / Project Connect overlay', 'Status': 'Outside Phase 1 light rail alignment' },
            { 'Layer / framework': 'ETOD overlay', 'Status': 'Not applicable — outside station areas' },
            { 'Layer / framework': 'Desired Development Zone', 'Status': 'In DDZ — affirmatively encouraged' },
            { 'Layer / framework': 'Council District', 'Status': '7' },
            { 'Layer / framework': 'Imagine Austin', 'Status': 'Established residential; ~0.7 mi from Tech Ridge Neighborhood Center' },
          ]}
        />

        <SubHeading>Active permits & case history</SubHeading>
        <MarkdownBody markdown={`No active development permits, zoning cases, variance applications, or open code-enforcement actions are on record for the parcel as of the report date. The most recent permit of record reflects the original 1993 single-family construction. Adjacent lots in Block M show no recent zoning or building permit activity that would affect this parcel.

The Travis County Clerk index reflects no recent recorded instruments against the parcel beyond standard owner-of-record activity. The Scofield Declaration (Vol. 11863 Pg. 1147) and its eight amendments are the controlling private instruments — see Section 4.

Pre-application meeting with City of Austin Development Services Department (DSD) Residential Plan Review is recommended before final design to confirm the procedural path, fee schedule, and any neighborhood-specific items for North Austin.`} />
      </NoeticPage>

      {/* ── 4. Chain of Title & Recorded Instruments ──── */}
      <NoeticPage>
        <SectionHeading number={4}>Chain of Title & Recorded Instruments</SectionHeading>

        <SeverityBadge level="significant">
          Scofield Declaration of Covenants §4.1 expressly prohibits duplex use; this is the controlling constraint on the project.
        </SeverityBadge>

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Instrument', width: 170, bold: true },
            { header: 'Type', width: 140 },
            { header: 'Recorded', width: 90 },
            { header: 'Burdens this parcel', flex: 1 },
          ]}
          rows={[
            { Instrument: 'Vol. 11863 Pg. 1147', Type: 'Master Declaration of Covenants, Conditions and Restrictions (Scofield Subdivision)', Recorded: '1993-02-01', 'Burdens this parcel': 'Yes — controlling document; §4.1 single-family-use restriction' },
            { Instrument: 'Vol. 11949 Pg. 239', Type: 'Second Amendment to Declaration', Recorded: '1993', 'Burdens this parcel': 'Yes — brings Scofield Phase VI Section II under the Declaration (this lot)' },
            { Instrument: 'Vol. 11880 Pg. 775; 12041 Pg. 3048; 12139 Pg. 151; 12365 Pg. 90; 12416 Pg. 392', Type: 'First, Third, Fourth, Fifth, Sixth, Seventh Amendments', Recorded: '1993–1995', 'Burdens this parcel': 'Yes — operative; technical amendments' },
            { Instrument: 'Doc No. 2005103195', Type: 'Eighth Amendment to Declaration', Recorded: '2005-06-10', 'Burdens this parcel': 'Yes — adds $25/day fines, attorneys-fee recovery, lien priority over homestead' },
            { Instrument: 'Cabinet 91, Slide 264-265', Type: 'Recorded plat (Scofield Subdivision, Section II, Phase VI)', Recorded: '~1993', 'Burdens this parcel': 'Yes — establishes platted setbacks, 5\' P.U.E., 7.5\' M.U.E. & P.S.E., 15\' D.E.' },
            { Instrument: 'Vol. 660 Pg. 968', Type: 'Blanket electric easement (pre-subdivision)', Recorded: '~1965–66', 'Burdens this parcel': 'Yes per survey notation — scope not publicly retrievable; resolve via title commitment' },
            { Instrument: 'Vol. 8602 P. 508; Vol. 8317 P. 1148; Vol. 8602 P. 552; Vol. 10202 P. 358; Vol. 10254 P. 1735; P. 1672; P. 1196', Type: 'Other easements of record', Recorded: 'various', 'Burdens this parcel': 'Noted on 1994 survey as "Do not affect this lot"' },
          ]}
        />

        <SubHeading>Key Declaration provisions</SubHeading>
        <Callout variant="correction" label="Use restriction (§4.1):">
          The Declaration limits every property in Scofield to "single-family residential use." Single-family is defined narrowly (occupants related by blood, marriage, or adoption; foster children; domestic servants). A two-unit duplex is the prohibited use category. The Declaration's §3.7 procedural language refers in places to "duplex residences," but §4.1's use limitation is the operative restriction and is not overridden by §3.7.
        </Callout>

        <Callout variant="action" label="Enforcement and term:">
          The Eighth Amendment (2005) added $25 per day fines on covenant violations, recovery of attorneys' fees by the prevailing HOA, and lien priority for assessments and fines. The Declaration auto-renews every ten years; the current term runs through at least December 31, 2032. Amendment to remove the single-family restriction requires a 75 percent supermajority of approximately 570 owners — practically infeasible.
        </Callout>

        <SubHeading>Form constraints if duplex were permitted</SubHeading>
        <Table
          headerStyle="light"
          columns={[
            { header: 'CC&R provision', width: 200, bold: true },
            { header: 'Requirement', flex: 1 },
          ]}
          rows={[
            { 'CC&R provision': 'Minimum building square footage', Requirement: '1,200 SF per unit' },
            { 'CC&R provision': 'Maximum height', Requirement: '2 stories' },
            { 'CC&R provision': 'Exterior masonry', Requirement: '≥ 50% of exterior surface' },
            { 'CC&R provision': 'Garage', Requirement: 'Required (attached, not less than 2-car)' },
            { 'CC&R provision': 'Front building line', Requirement: '25 ft' },
            { 'CC&R provision': 'Side building lines', Requirement: '5 ft (matches plat)' },
            { 'CC&R provision': 'Rear building line', Requirement: '10 ft (more restrictive than 7.5\' platted P.S.E.)' },
            { 'CC&R provision': 'Architectural Control Committee', Requirement: 'Pre-construction submittal of plans required; ACC has approval authority' },
          ]}
        />
      </NoeticPage>

      {/* ── 5. Environmental Constraints ──────────────── */}
      <NoeticPage>
        <SectionHeading number={5}>Environmental Constraints</SectionHeading>

        <MarkdownBody markdown={`The parcel sits east of MoPac on Blackland Prairie, off the Edwards Plateau limestone outcrop. None of the environmental constraint layers that typically drive Austin development friction apply here. The single notable item is the Wildland-Urban Interface designation, which adds construction-cost premium but does not change feasibility.`} />

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Constraint', width: 200, bold: true },
            { header: 'Status', width: 200 },
            { header: 'Implication', flex: 1 },
          ]}
          rows={[
            { Constraint: 'FEMA flood zone', Status: 'Zone X — outside SFHA', Implication: 'No federal flood insurance required; standard foundation. FIRM Panel 48453C0270J eff. 2014-08-18.' },
            { Constraint: 'City of Austin floodplain', Status: 'Outside locally-regulated 25-yr and 100-yr', Implication: 'No COA floodplain regulations apply.' },
            { Constraint: 'Erosion Hazard Zone (EHZ)', Status: 'Outside', Implication: 'No EHZ setbacks reduce buildable area.' },
            { Constraint: 'Critical Water Quality Zone (CWQZ)', Status: 'Outside', Implication: 'No riparian buffer constraints.' },
            { Constraint: 'Critical Environmental Features (CEFs)', Status: 'None on parcel', Implication: 'No CEF buffers.' },
            { Constraint: 'Edwards Aquifer Recharge / Transition / Contributing', Status: 'Outside all zones', Implication: 'No TCEQ WPAP/CZP required.' },
            { Constraint: 'Watershed', Status: 'Walnut Creek (Suburban)', Implication: 'IC limits apply at subdivision scale, not individual lots, per LDC §25-8-63(B). Binding IC comes from zoning.' },
            { Constraint: 'Endangered species habitat', Status: 'Outside all (no salamander, warbler, karst invertebrate)', Implication: 'No federal ESA Section 7 / Section 10 consultation.' },
            { Constraint: 'Underground storage tanks / LUST', Status: 'None within search radius', Implication: 'No contamination concerns from neighbors.' },
            { Constraint: 'Historic / archaeological', Status: 'Not historic; not in designated district', Implication: 'No historic review.' },
            { Constraint: 'Heritage trees (mapped)', Status: 'Trees not located on 1994 survey', Implication: 'Inventory required pre-design. See Trees discipline in Section 8.' },
          ]}
        />

        <SubHeading>Wildland-Urban Interface — Proximity Zone C</SubHeading>
        <Callout variant="action" label="Construction-cost premium:">
          The parcel maps to WUI Proximity Zone C per the COA Wildland-Urban Interface ArcGIS layer. Zone C is the lightest tier of the WUI overlay but still triggers ignition-resistant construction: Class A roof covering, fire-resistant or ignition-resistant exterior wall assembly, ember-resistant attic vents, defensible-space landscaping, and decking restrictions. Estimated $5,000 to $15,000 added construction cost regardless of whether the project is a duplex or a replacement single-family residence. Recommend final confirmation of Zone C via the COA WUI Zone Lookup tool before design development.
        </Callout>

        <SubHeading>Tree inventory (data gap)</SubHeading>
        <MarkdownBody markdown={`The 1994 boundary survey does not locate individual trees, which is typical of surveys of that vintage. A 30-year-old North Austin residential lot is highly likely to support two to five mature trees of common species (cedar elm, Texas ash, live oak, hackberry, pecan). An arborist walk is required pre-design to identify any protected trees (any species at 19 inches diameter at breast height) and heritage trees (specified species at 24 inches dbh: live oak, post oak, blackjack oak, bur oak, white oak, Texas red oak, Mexican white oak, Texas ash, bald cypress, American elm, cedar elm, pecan, Arizona walnut, Eastern black walnut, Texas madrone, bigtooth maple).

Critical Root Zone (CRZ) protection at half the drip line will likely dictate building placement on a 60-foot by 127-foot lot. If a heritage tree sits in the proposed building envelope, removal requires Land Use Commission approval (low probability of approval); workarounds typically constrain the building footprint substantially. Budget $5,000 to $25,000 mitigation contingency for protected (non-heritage) tree removal pending inventory.`} />
      </NoeticPage>

      {/* ── 6. Infrastructure & Utilities ─────────────── */}
      <NoeticPage>
        <SectionHeading number={6}>Infrastructure & Utilities</SectionHeading>

        <MarkdownBody markdown={`The parcel is fully served by Austin Energy (electric), Austin Water (water and wastewater), Texas Gas Service (gas), and Austin Resource Recovery (solid waste). The existing residence has all utility connections, and the public mains have capacity for the second duplex unit without service-extension engineering.`} />

        <Table
          headerStyle="light"
          columns={[
            { header: 'Utility / system', width: 140, bold: true },
            { header: 'Provider', width: 140 },
            { header: 'Status', flex: 1 },
          ]}
          rows={[
            { 'Utility / system': 'Electric', Provider: 'Austin Energy', Status: 'Existing service; second-unit meter required for duplex; standard residential interconnection.' },
            { 'Utility / system': 'Gas', Provider: 'Texas Gas Service', Status: 'Existing service; one or two meters for a duplex per developer preference.' },
            { 'Utility / system': 'Water', Provider: 'Austin Water', Status: 'Existing 5/8" or 3/4" residential meter; second meter required per duplex policy.' },
            { 'Utility / system': 'Wastewater', Provider: 'Austin Water', Status: 'Existing service via rear 7.5\' P.S.E.; second lateral required for duplex; concrete sewer vault on rear lot line.' },
            { 'Utility / system': 'Stormwater drainage', Provider: 'COA Watershed Protection', Status: 'Monthly drainage charge scales with impervious cover; estimated ~$25–30/month per unit post-build.' },
            { 'Utility / system': 'Solid waste', Provider: 'Austin Resource Recovery', Status: 'Curbside service available (≤6 units); duplex qualifies.' },
            { 'Utility / system': 'Street', Provider: 'COA Public Works', Status: 'Cinchring Lane = ASMP Level 1 Local; 50-ft platted ROW matches L1 standard; no ROW dedication required.' },
            { 'Utility / system': 'Transit', Provider: 'CapMetro', Status: 'Route 243 (Wells Branch) within 0.5 mi; Howard MetroRail Red Line station ~1.4 mi.' },
          ]}
        />

        <SubHeading>Water and wastewater — duplex-specific requirements</SubHeading>
        <Callout variant="action" label="Two-meter rule and Utility Tap Plan:">
          Austin Water requires individual water and wastewater meters per unit for new duplex construction; the existing single residential meter cannot be retained as a master meter. Plan review for the duplex also requires a Utility Tap Plan stamped by a Texas Professional Engineer — a hard gate before residential plan review will issue. Engage civil engineering at schematic design, not at permit submittal, to avoid stalling intake.
        </Callout>

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Fee item (second unit)', width: 220, bold: true },
            { header: 'Estimated range', width: 140 },
            { header: 'Notes', flex: 1 },
          ]}
          rows={[
            { 'Fee item (second unit)': 'Water tap fee', 'Estimated range': '$3,000–$8,000', Notes: '5/8" residential meter typical' },
            { 'Fee item (second unit)': 'Wastewater tap fee', 'Estimated range': '$2,500–$6,000', Notes: 'Per Austin Water FY schedule' },
            { 'Fee item (second unit)': 'Water Capital Recovery Fee (CRF)', 'Estimated range': '$5,000–$8,000', Notes: 'Per equivalent residential connection (ERC); SMART Housing waives' },
            { 'Fee item (second unit)': 'Wastewater Capital Recovery Fee', 'Estimated range': '$3,000–$5,000', Notes: 'Per ERC; SMART Housing waives' },
            { 'Fee item (second unit)': 'PE-stamped Utility Tap Plan', 'Estimated range': '$2,000–$5,000', Notes: 'External engineering fee' },
            { 'Fee item (second unit)': 'Sidewalk fee-in-lieu (per LDC §25-6-353)', 'Estimated range': '~$2,250', Notes: '60 ft × 5 ft on Cinchring frontage' },
            { 'Fee item (second unit)': 'Total upfront infrastructure-and-fee delta vs replacement SFR', 'Estimated range': '$15,000–$35,000', Notes: 'Conservative central estimate' },
          ]}
        />

        <SubHeading>Transportation</SubHeading>
        <MarkdownBody markdown={`No transportation hard stops. A traffic impact analysis is not triggered (duplex generates approximately 13 daily trips, well below the 2,000 trips per day TIA threshold). The 60-foot lot frontage permits one shared driveway under Transportation Criteria Manual Section 7. Existing curb cut on Cinchring is reusable. Cinchring Lane has horizontal curvature near the lot (R = 1,075 ft) but adequate residential sight distance.

The sidewalk obligation under LDC §25-6-353 is the only meaningful new transportation cost item; the fee-in-lieu (~$2,250) is the typical election. The same obligation would apply to a teardown-and-rebuild single-family residence.

No scenic roadway overlay, no TxDOT review (no direct frontage on FM 734 / Parmer Lane), no on-street CapMetro facility on Cinchring, no protected bike lane. Austin's November 2023 parking minimum elimination means there is no on-site parking requirement at all; design choices are market-driven only.`} />

        <SubHeading>Stormwater and drainage</SubHeading>
        <MarkdownBody markdown={`The duplex residential building permit triggers a Tier 1 drainage review only — a residential drainage form, not a full drainage report. Impervious cover increases from approximately 27 percent (existing) to approximately 45–55 percent (duplex), still below MF-3 ceiling and Subchapter F McMansion FAR limits.

Water quality controls are not triggered. The new and redeveloped IC for a duplex on this lot falls below the 8,000 SF threshold for the water-quality control trigger outside the Barton Springs Zone (LDC §25-8-211 / 213). The Walnut Creek watershed Suburban classification does not bind individual single-family or duplex lots per LDC §25-8-63(B). No on-site detention is required at residential building permit scale.

The 15-foot drainage easement referenced on the plat (Cabinet 91, Slide 264-265) is a data gap — the 1994 survey shows the easement exists but does not dimension its location on Lot 12. The easement most likely runs along the rear lot line (consistent with the concrete sanitary sewer vault visible on the survey), but its position must be confirmed from the recorded plat before schematic design.`} />
      </NoeticPage>

      {/* ── 7. Programs & Opportunities ───────────────── */}
      <NoeticPage>
        <SectionHeading number={7}>Programs & Opportunities</SectionHeading>

        <MarkdownBody markdown={`City of Austin development programs are unusually favorable for an infill residential project on this parcel. The relevant programs are listed below with eligibility status and value.`} />

        <Callout variant="insight" label="HOME Initiative Phase 1 (Ordinance 20231207-001):">
          By-right permission for up to three units per lot on SF-1, SF-2, and SF-3 zoned parcels citywide. No affordability strings attached. If the base zoning is read as SF-3 (rather than MF-3), HOME Phase 1 alone permits the duplex. As of June 2026, the ordinance remains in effect with 631 approvals citywide and no invalidating litigation. Note: this program enables duplex use as a matter of city zoning only; it does not override private deed restrictions.
        </Callout>

        <Callout variant="insight" label="Site Plan Lite Phase 1 (Ordinance 20230720-158):">
          Residential projects of four units or fewer are exempt from formal site plan review under LDC §25-5-2. The project proceeds through DSD Residential Plan Review as a building permit, not through Commercial Site Plan. This streamlines the timeline materially compared with a site plan path and saves approximately $15,000–$40,000 in engineering and review fees.
        </Callout>

        <Callout variant="insight" label="Desired Development Zone (DDZ):">
          The parcel sits in the DDZ, which is the precondition for SMART Housing fee waivers. The DDZ status alone does not waive fees but qualifies the project for the SMART program if elected.
        </Callout>

        <Callout variant="neutral" label="SMART Housing Program (Austin Housing Finance Corporation):">
          Available if at least 10 percent of new units serve households at or below 80 percent of Median Family Income. Waives capital recovery, parkland, building permit, and water/wastewater impact fees on affordable units. For a two-unit duplex, qualifying for SMART Housing typically means deed-restricting one of two units — uneconomic for a market-rate developer. Listed for completeness.
        </Callout>

        <SubHeading>Programs verified not applicable</SubHeading>
        <Table
          headerStyle="light"
          columns={[
            { header: 'Program', width: 200, bold: true },
            { header: 'Why not applicable', flex: 1 },
          ]}
          rows={[
            { Program: 'HOME Phase 2 (small-lot SF)', 'Why not applicable': 'Reduces SF minimum lot size to 1,800 SF for single-unit small lots; does not extend duplex by-right beyond what HOME 1 already provides at this lot size.' },
            { Program: 'ETOD Overlay (Phase 1)', 'Why not applicable': 'Parcel is approximately 9 miles north of the Project Connect Phase 1 light rail stations covered by the ETOD overlay.' },
            { Program: 'DB90 / VMU2 / Affordability Unlocked', 'Why not applicable': 'Targeted at LR/GR/CS/MF corridor and mixed-use sites; not applicable to a small residential infill.' },
            { Program: 'Qualified Opportunity Zone (federal IRC §1400Z-2)', 'Why not applicable': 'Census Tract 48453000421 is not on the Travis County QOZ designation list.' },
            { Program: 'LIHTC / HUD CDBG / TDHCA Bootstrap', 'Why not applicable': 'Federal and state affordable housing programs are not designed for two-unit single-lot infill.' },
            { Program: 'RSMP fee-in-lieu (stormwater)', 'Why not applicable': 'Walnut Creek is RSMP-eligible, but the project does not trigger detention obligations at this scale, so RSMP fee-in-lieu does not apply.' },
            { Program: 'Parkland dedication / fee-in-lieu', 'Why not applicable': 'Parkland obligations attach at site plan or subdivision; the residential building permit path on an existing platted lot does not trigger either gateway.' },
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
            { Discipline: 'Zoning', Topic: 'CC&R §4.1 prohibits duplex use', Level: 'significant', Citation: 'Scofield Declaration, Vol. 11863 Pg. 1147' },
            { Discipline: 'Site', Topic: 'CC&R-imposed form (masonry, min SF, height, ACC)', Level: 'significant', Citation: 'Scofield Declaration §3.x' },
            { Discipline: 'Trees', Topic: 'Heritage-tree contingency', Level: 'moderate', Citation: 'Ord. 20100204-038; LDC §25-8 Subch B' },
            { Discipline: 'Trees', Topic: 'Protected-tree mitigation contingency', Level: 'moderate', Citation: 'LDC §25-8 Subch B; ECM §3.5.4' },
            { Discipline: 'Stormwater', Topic: 'Sanitary sewer vault and 7.5\' P.S.E. compound rear constraint', Level: 'moderate', Citation: 'Survey; Austin Water service' },
            { Discipline: 'Transport', Topic: 'Sidewalk fee-in-lieu (~$2,250)', Level: 'moderate', Citation: 'LDC §25-6-353' },
            { Discipline: 'Water', Topic: 'Two-meter rule + tap fees for second unit ($13K–$27K)', Level: 'moderate', Citation: 'Austin Water Service Standards; CRF Schedule' },
            { Discipline: 'Water', Topic: 'PE-stamped Utility Tap Plan required at plan review', Level: 'moderate', Citation: 'Austin Water plan-review submittal' },
            { Discipline: 'Fire', Topic: 'WUI Proximity Zone C ignition-resistant construction ($5K–$15K)', Level: 'moderate', Citation: 'Austin WUI Code; LDC §25-12-271' },
            { Discipline: 'Site', Topic: 'Subchapter F McMansion envelope sets massing cap (~3,222 SF GFA)', Level: 'moderate', Citation: 'LDC §25-2 Subchapter F' },
            { Discipline: 'Zoning', Topic: 'MF-3 base zoning permits more than a duplex (future-state)', Level: 'opportunity', Citation: 'COA Zoning_1' },
            { Discipline: 'Site', Topic: 'Site Plan Lite exempts project from formal site plan (saves $15K–$40K)', Level: 'opportunity', Citation: 'Ord. 20230720-158; LDC §25-5-2' },
            { Discipline: 'Env', Topic: 'Desired Development Zone — SMART Housing fee-waiver precondition', Level: 'opportunity', Citation: 'COA DDZ' },
            { Discipline: 'Floodplain', Topic: 'FEMA Zone X confirmed on current effective FIRM', Level: 'opportunity', Citation: 'FIRM Panel 48453C0270J (eff. 2014-08-18)' },
          ]}
        />
      </NoeticPage>

      {/* ── 8.1 Zoning & Land Use ─────────────────────── */}
      <NoeticPage>
        <SubHeading>8.1 Zoning & Land Use</SubHeading>

        <SeverityBadge level="significant">
          CC&R §4.1 single-family-only restriction defeats the duplex thesis regardless of base zoning.
        </SeverityBadge>

        <MarkdownBody markdown={`The COA Zoning_1 GIS feature service shows the parcel as MF-3 (Multi-Family Residence, Medium Density) at the parcel centroid. MF-3 permits a duplex as the minimum-density allowed use; it also permits triplex, fourplex, and small multi-family configurations by-right. Under the LDC use chart for MF-3, no use exception or conditional use review is required for a duplex. The dimensional standards under MF-3 — front 25 ft, side 5 ft, rear 10 ft, max FAR 0.40, max IC 45 percent, max BC 40 percent, max height 35 ft / 2 stories, parking minimum 0 — accommodate a duplex on the 8,054 SF lot.

The SF-platted-as-MF-3 pattern is a known late-1980s and early-1990s Austin developer move: the developer secures higher base zoning, then imposes a private deed restriction to deliver a single-family product. The base zoning persists at TCAD/COA whether or not new MF use is contemplated. A Zoning Verification Letter from DSD (approximately $337 fee) is the canonical way to confirm the reading before final design.

Even if the base zoning were read as SF-3 instead of MF-3, the HOME Initiative Phase 1 ordinance independently permits a duplex on any SF-1/SF-2/SF-3 zoned parcel. The HOME 1 envelope is: max 3 units per lot, base-zoning FAR/IC/BC, base-zoning height (no Subchapter F 32-ft single-family cap), Subchapter F McMansion still applies, max 40 percent front-yard impervious cover, max 4 front-yard parking spaces, garage behind front building line, street-facing entrance, short-term rental limit. HOME 1 has had 631 approvals citywide as of June 2026; the ordinance remains in effect with no invalidating litigation.

The controlling constraint is private. Scofield Declaration §4.1 restricts every property to "single-family residential use," with single-family defined narrowly (occupants related by blood, marriage, or adoption; foster children; domestic servants). Texas case law confirms that HOAs may enforce single-family-only deed covenants against HOME-permitted duplex construction; HOME does not pre-empt private contracts. The §3.7 procedural reference to "duplex residences" elsewhere in the Declaration does not override §4.1's use limitation.

Three forward paths exist. (1) Pivot to a single-family replacement: clean by-right on both fronts. (2) Pursue Declaration amendment: requires 75 percent supermajority of ~570 owners, practically infeasible. (3) Acquire and hold pending CC&R termination or legislative pre-emption: speculative.`} />
      </NoeticPage>

      {/* ── 8.2 Site Plan & Form ──────────────────────── */}
      <NoeticPage>
        <SubHeading>8.2 Site Plan & Form</SubHeading>

        <MarkdownBody markdown={`The procedural path under city regulation is straightforward. Site Plan Lite Phase 1 (Ordinance 20230720-158, LDC §25-5-2) exempts residential projects of four units or fewer from formal site plan review. The project proceeds through DSD Residential Plan Review as a building permit, not through Commercial Site Plan. Pre-construction reviews are the same set as for a teardown-and-rebuild single-family residence: tree disposition, drainage, zoning verification, utility coordination, address assignment.

Subchapter E (Mixed Use / Compatibility Design) does not apply because no site plan is triggered and the parcel is not in a corridor or transit-oriented overlay. Subchapter F (Residential Design) does apply: McMansion FAR (0.40 base), 45-degree side tent envelope, and front building line setback all govern massing. The effective gross floor area ceiling under Subchapter F is approximately 3,222 SF for a duplex on this lot.

The required application stack includes the demolition permit (separate intake), residential building permit (combined building/electrical/plumbing/mechanical), tree disposition application if any trees ≥19 inches dbh are affected, address request for the second unit (Unit A / Unit B convention), and utility disconnect coordination with Austin Energy and Texas Gas Service. The demolition path is clean: the 1993 build is post-1978 (no EPA RRP lead-paint survey required), under four units (TX DSHS asbestos survey exempt), under 45 years old (no historic-demolition delay), and not in a designated historic district.

The CC&R-imposed form constraints are more restrictive than zoning and would govern any permitted project: 1,200 SF minimum per unit, 2-story maximum height, 50 percent exterior masonry minimum, attached 2-car garage required, Architectural Control Committee pre-approval mandatory.`} />
      </NoeticPage>

      {/* ── 8.3 Stormwater & Drainage ─────────────────── */}
      <NoeticPage>
        <SubHeading>8.3 Stormwater & Drainage</SubHeading>

        <MarkdownBody markdown={`A duplex on a single platted lot is a residential building permit path through DSD Land Development Engineering. The drainage review is plot-plan scale: a residential drainage form rather than a full Drainage Criteria Manual report.

Water quality controls are not triggered. The combined new and redeveloped impervious cover (estimated 3,600–4,400 SF) is below the 8,000 SF threshold for the §25-8-211 / §25-8-213(C) water quality control trigger outside the Barton Springs Zone. The Walnut Creek watershed is Suburban (not Barton Springs Zone), so the no-threshold rule does not apply. The §25-8-63(B) carve-out further exempts individual single-family and duplex lots from Subchapter A impervious cover restrictions.

On-site detention is not required at this scale. DCM §1.2.2.D scopes detention obligations to site plans and subdivision construction plans, not residential building permits. The Walnut Creek drainage system has adequate downstream capacity for incremental residential infill.

Regional Stormwater Management Program (RSMP) fee-in-lieu eligibility exists for Walnut Creek watershed but is not directly relevant here — RSMP attaches to on-site detention obligations under DCM 8.2, and the project triggers none.

The platted 15-foot drainage easement (Cabinet 91 Slide 264-265, recorded with Vol. 11863 Pg. 1147) is a data gap that warrants resolution before schematic design. The easement most likely runs along the rear lot line in conjunction with the 7.5-ft P.S.E. (consistent with the concrete sanitary sewer vault visible on the 1994 survey), but its position must be plotted from the recorded plat.

The sanitary sewer vault near the rear lot line creates a compounded constraint on rear-yard development. Austin Water Field Operations should be consulted on clear-zone requirements around the vault; the effective no-build envelope along the rear may be deeper than the 7.5-foot P.S.E. alone.`} />
      </NoeticPage>

      {/* ── 8.4 Floodplain ────────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.4 Floodplain</SubHeading>

        <MarkdownBody markdown={`The parcel is in FEMA Flood Zone X (outside the 100-year and 500-year Special Flood Hazard Area), confirmed against the current effective FIRM Panel 48453C0270J (effective August 18, 2014). The 1994 survey's Zone X determination, which referenced a now-superseded 1993 panel, remains accurate under the current FIRM.

No federal flood insurance is required by statute, although discretionary coverage is inexpensive. No base flood elevation applies. No Letter of Map Amendment or Letter of Map Revision is on file for the parcel.

The parcel is also outside the City of Austin's locally-regulated 25-year and 100-year floodplain, including the city's Fully Developed Floodplain layer. The Erosion Hazard Zone (EHZ), Critical Water Quality Zone (CWQZ), and Water Quality Transition Zone (WQTZ) are all absent at parcel coordinates.

The platted 15-foot drainage easement is a private subdivision easement, not a regulatory floodplain or §25-8-92 buffer.

A November 2025 FEMA preliminary FIRM update for Travis County should be checked at building permit submittal as a verification step; preliminary FIRMs occasionally change effective zones for parcels that were previously in Zone X.`} />
      </NoeticPage>

      {/* ── 8.5 Environmental ─────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.5 Environmental</SubHeading>

        <MarkdownBody markdown={`The environmental picture is clean. The parcel is east of MoPac on Blackland Prairie, off the Edwards Plateau limestone outcrop. None of the typical Austin environmental constraint layers apply: no Critical Environmental Features, no Critical Water Quality Zone or Water Quality Transition Zone, no Edwards Aquifer Recharge / Transition / Contributing zones, no salamander habitat (Eurycea spp.), no golden-cheeked warbler habitat, no karst invertebrate habitat. The TCEQ Petroleum Storage Tank viewer shows no LUST sites within the search radius.

Walnut Creek watershed (Suburban classification) governs water quality regulations under LDC §25-8 Article 9. Suburban classification sets impervious cover ceilings at subdivision scale per §25-8-63(B); individual single-family and duplex lots are carved out of the subchapter limits. Binding IC for this project comes from zoning, not watershed.

The Desired Development Zone designation is the one affirmative environmental opportunity: DDZ status is the precondition for SMART Housing fee waivers if the affordability path is elected.

The single moderate environmental finding is the Wildland-Urban Interface designation. The parcel maps to WUI Proximity Zone C — the lightest tier of the WUI overlay but still triggering ignition-resistant construction requirements. The Phase 2 environmental review initially expected the parcel to be outside any WUI zone, but the property-records query against the COA WUI ArcGIS layer confirmed Zone C; the authoritative reading is Zone C. Construction-cost premium $5,000–$15,000 for Class A roof, ignition-resistant exterior, ember-resistant vents, and defensible space. Apply equally to a duplex or replacement single-family.`} />
      </NoeticPage>

      {/* ── 8.6 Tree Protection & Erosion Control ──────── */}
      <NoeticPage>
        <SubHeading>8.6 Tree Protection & Erosion Control</SubHeading>

        <MarkdownBody markdown={`Tree protection is the dominant non-CC&R constraint on building placement. The 1994 boundary survey does not locate individual trees, which is typical of that vintage; a 30-year-old North Austin residential lot is highly likely to support two to five mature trees of common species. Protected trees are any species at 19 inches diameter at breast height; heritage trees are listed species at 24 inches dbh — live oak, post oak, blackjack oak, bur oak, white oak, Texas red oak, Mexican white oak, Texas ash, bald cypress, American elm, cedar elm, pecan, Arizona walnut, Eastern black walnut, Texas madrone, bigtooth maple.

A heritage tree inside the proposed building envelope materially constrains the project. Removal requires Land Use Commission approval — historically low approval probability and a multi-month review process — or work-around design that preserves the Critical Root Zone (half the drip line). On a 60-foot by 127-foot lot, CRZ constraints can drive footprint placement substantially.

Protected (non-heritage) tree removal requires 1:1 caliper-inch mitigation: planting equivalent caliper inches on-site, or fee-in-lieu to the Tree Fund at the current rate (verify; historically ~$250 per caliper inch). Mitigation contingency budget: $5,000–$25,000 pending arborist inventory.

Erosion and sediment control is routine. The disturbed area is approximately 0.185 acres, well below the 1-acre threshold that triggers a TCEQ TPDES Construction General Permit Notice of Intent. Site-specific ESC is required per Environmental Criteria Manual §1.4: silt fence, stabilized construction entrance, tree protection fencing, concrete washout. Typical cost $1,500–$3,000. Tree protection fencing must be installed before demolition equipment enters the site; sequence demolition permit and tree disposition application together.

Soil conditions: Edwards-Whitewright (EdC) association — typical North Austin Blackland Prairie soil with moderate shrink-swell. Standard pier-and-beam or post-tension slab foundation appropriate; budget $2,000–$4,000 for a geotechnical report at design.`} />
      </NoeticPage>

      {/* ── 8.7 Transportation ────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.7 Transportation</SubHeading>

        <MarkdownBody markdown={`Transportation requirements for a duplex on this parcel are essentially identical to those of a teardown-and-rebuild single-family residence. No traffic impact analysis is triggered (a duplex generates approximately 13 daily trips per ITE Land Use Code 220, well below the 2,000 trips per day threshold under the Transportation Criteria Manual). No right-of-way dedication is required — Cinchring Lane is ASMP Level 1 Local, and the 50-foot platted ROW matches the Level 1 standard.

Driveway permitting is straightforward. The 60-foot frontage permits one driveway under TCM Section 7 (one driveway per frontage under 100 feet). The existing curb cut on Cinchring is reusable; if relocated, the new position must respect 30–50 ft minimum spacing from an intersection. Maximum apron width is 25 feet. Cinchring has horizontal curvature near the lot (R = 1,075 ft) but sight distance is adequate at a residential driveway.

The sidewalk obligation under LDC §25-6-353 is the only meaningful new transportation cost item. New residential construction triggers sidewalk-or-fee-in-lieu along the Cinchring frontage (60 ft × 5 ft ≈ 300 SF). Fee-in-lieu is approximately $2,250; sidewalk construction is approximately $5,000–$10,000 if a contractor builds it. Fee-in-lieu is the typical election. The trigger is "new construction," so the same obligation would apply to a replacement single-family residence.

No scenic roadway overlay applies. No TxDOT review is required (no direct frontage on FM 734 Parmer Lane). CapMetro Route 243 (Wells Branch) is within approximately 0.5 miles; the Howard MetroRail Red Line station is approximately 1.4 miles. No protected bicycle facility on Cinchring. Austin's November 2023 elimination of parking minimums means no on-site parking is required.

Street Impact Fees apply on residential building permits per LDC §25-6-201 ff., but the rate at duplex scale is de minimis compared with the water/wastewater capital recovery fees.`} />
      </NoeticPage>

      {/* ── 8.8 Water & Wastewater ────────────────────── */}
      <NoeticPage>
        <SubHeading>8.8 Water & Wastewater</SubHeading>

        <MarkdownBody markdown={`The parcel is inside Austin Water's retail water and wastewater service area with no MUD, WCID, or CCN complications. The existing residence has both taps; the public mains in Cinchring Lane and the rear 7.5-foot Public Sewer Easement have capacity for the second duplex unit without service-extension engineering.

Austin Water requires individual water and wastewater meters per unit in new duplex construction. The existing single residential meter cannot be retained as a master meter; the project requires a second water tap (and meter) and a second wastewater service lateral. Austin Water also requires a Utility Tap Plan stamped by a Texas Professional Engineer before residential plan review will issue — a hard procedural gate that must be cleared via civil engineering at schematic design rather than waiting for permit submittal.

Cost estimate for the second-unit infrastructure (verify against the current Austin Water FY fee schedule at permit submittal):
- Water tap fee: $3,000–$8,000 (5/8" residential meter typical)
- Wastewater tap fee: $2,500–$6,000
- Water Capital Recovery Fee: $5,000–$8,000 per equivalent residential connection
- Wastewater Capital Recovery Fee: $3,000–$5,000 per ERC
- PE-stamped Utility Tap Plan: $2,000–$5,000 in external engineering
- Conservative total for the second unit: approximately $20,000–$30,000

Capital recovery fees are waived under the SMART Housing Program if the affordability path is elected.

Coordination with Austin Water Field Operations is required for the concrete sanitary sewer vault visible on the survey near the rear lot line. The vault likely serves the public sewer main in the rear 7.5-foot easement; second-unit lateral routing must work around it.

The COA Watershed drainage charge (a monthly utility bill, not a permit fee) will roughly double from approximately $14/month to approximately $25–30/month per unit post-construction, reflecting the higher impervious cover. The annual operating cost increase is negligible. No reclaimed water connection, no on-site sewage facility (no septic — fully sewered), no Industrial Waste discharge.`} />
      </NoeticPage>

      {/* ── 8.9 Fire ──────────────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.9 Fire</SubHeading>

        <MarkdownBody markdown={`A duplex of two dwelling units is an R-3 occupancy under the International Residential Code (and IBC). R-3 keeps the project on the residential building permit path: no Fire Analysis Table, no alternate means of compliance review, no high-rise track.

The sprinkler question is a data gap to resolve at pre-application. IRC §R313.1 nominally mandates an NFPA 13D sprinkler system in two-family dwellings, but Texas Local Government Code §233.155 pre-empts municipal sprinkler mandates for one- and two-family dwellings, and Austin has historically incorporated that pre-emption. The current LDC §25-12-1 amendment status as of 2026 should be confirmed with DSD residential intake. This is the single largest construction-cost swing item ($15,000–$25,000 if sprinklers are required).

A 1-hour fire-rated party wall is required between the two units per IRC §R302.3, continuous from foundation to underside of roof sheathing. If sprinklers are installed, the rating can be reduced to 30 minutes.

Fire department apparatus access is satisfied by Cinchring Lane (paved public street); no on-site fire lane, turnaround, or aerial access is required at R-3 scale. Hydrant flow at this lot — 1,000 GPM at 20 psi within 600 ft per IFC §507 (reducible to 500 GPM with an NFPA 13D sprinkler) — is almost certainly compliant on the mature 12-inch North Austin water mains; an Austin Water flow test is the formal confirmation.

Wildland-Urban Interface Zone C triggers ignition-resistant construction (see Section 8.5 Environmental for cost detail).

Standard IRC residential life-safety items apply: hardwired interconnected smoke and carbon monoxide alarms per unit (R314, R315), emergency egress windows in each sleeping room (R310). Visible, distinct addresses per unit (12713-A / 12713-B).`} />
      </NoeticPage>

      {/* ── 8.10 Parkland ─────────────────────────────── */}
      <NoeticPage>
        <SubHeading>8.10 Parkland</SubHeading>

        <MarkdownBody markdown={`Parkland is a non-issue on the duplex residential building permit pathway. Austin's parkland dedication ordinance (LDC §25-1-601 ff.) attaches obligations at the site plan gateway (for multifamily and commercial) and the subdivision gateway (for single-family). A duplex on an existing platted lot triggers neither: Site Plan Lite Phase 1 exempts the project from site plan review, and the existing plat is unchanged. No Parks and Recreation Department review, no parkland Determination, no fee-in-lieu.

On-site parkland dedication is structurally impossible regardless: the Parkland Dedication Operating Procedures §14.3.7(A)(7)(a) require a quarter-acre minimum parcel for dedicated parkland, well above this 0.185-acre lot.

The parcel sits in the Walnut Creek parkland service area; the nearest large public park is Walnut Creek Metropolitan Park (~290 acres) approximately 2 miles south. No city parkland on or adjacent to the lot, so no Chapter 26 / Texas Parks and Wildlife Code concerns.

A note on alternative paths: a HOME Phase 2 small-lot subdivision approach (resubdividing the lot into two separately deeded single-unit lots) would trigger the SF parkland obligation at the plat gateway. That path is not currently in scope but warrants flagging if the developer pivots strategy.`} />
      </NoeticPage>

      {/* ── 9. Considerations Before Concept Design ───── */}
      <NoeticPage>
        <SectionHeading number={9}>Considerations Before Concept Design</SectionHeading>

        <SubHeading>Data gaps requiring action</SubHeading>
        <MarkdownBody markdown={`The following items must be resolved before final design or substantial acquisition cost is committed. Each row lists the gap, the action required to close it, and the team member who owns the action.`} />

        <Table
          headerStyle="dark"
          columns={[
            { header: 'Gap', width: 180, bold: true },
            { header: 'Action / source', flex: 1 },
            { header: 'Owner', width: 150 },
          ]}
          rows={[
            { Gap: 'Confirm base zoning (MF-3 vs SF anomaly)', 'Action / source': 'Request a Zoning Verification Letter from City of Austin DSD (~$337 fee). Authoritative reading of base zoning.', Owner: 'Buyer / DSD' },
            { Gap: 'CC&R interpretation and enforcement posture', 'Action / source': 'Engage Texas real estate counsel to (i) opine on enforceability of §4.1 against a HOME-permitted duplex, (ii) advise on amendment campaign feasibility, and (iii) obtain formal HOA position letter on duplex construction at this address.', Owner: 'Counsel' },
            { Gap: 'Location of the platted 15-foot drainage easement on Lot 12', 'Action / source': 'Order the recorded plat (Cabinet 91, Slide 264-265) from Travis County Clerk; civil engineer to plot the easement on a current survey before schematic design.', Owner: 'Surveyor / civil engineer' },
            { Gap: 'Scope of the blanket electric easement (Vol. 660 Pg. 968)', 'Action / source': 'Obtain via title commitment; confirm with Austin Energy easement records office whether any distribution facilities exist on Lot 12.', Owner: 'Title company / Austin Energy' },
            { Gap: 'Tree inventory and Critical Root Zone mapping', 'Action / source': 'Commission ISA-certified arborist plus updated boundary survey ($1,500–$3,500 combined). Required before building footprint can be finalized.', Owner: 'Arborist / surveyor' },
            { Gap: 'Current effective COA sprinkler-amendment status for R-3 duplex', 'Action / source': 'Confirm with DSD residential intake at pre-application meeting; verify LDC §25-12-1 amendment language.', Owner: 'DSD / architect' },
            { Gap: 'Hydrant flow test for fire-flow confirmation', 'Action / source': 'Request a flow test from Austin Water Field Operations before design development.', Owner: 'Austin Water / engineer' },
            { Gap: 'WUI Proximity Zone confirmation', 'Action / source': 'Final confirmation via the COA Wildland-Urban Interface Code Zone Lookup tool before plans go to construction documents.', Owner: 'Architect' },
            { Gap: 'Current owner of record + most recent deed', 'Action / source': 'Resolved by title commitment at closing; not material to feasibility.', Owner: 'Title company' },
            { Gap: 'Current HOA assessment status and any pending special assessments', 'Action / source': 'HOA estoppel certificate at acquisition; review last 24 months of board minutes for any covenant-enforcement activity nearby.', Owner: 'Title company / counsel' },
          ]}
        />

        <SubHeading>What to do next, in priority order</SubHeading>

        <MarkdownBody markdown={`The following sequence orders the work by what each step depends on. No durations are assigned; the developer's team owns scheduling.

1. **Decision point on use program.** The CC&R §4.1 single-family-use restriction is the controlling constraint. Before committing further diligence cost, the buyer should decide between (a) duplex contingent on CC&R action, (b) single-family replacement, or (c) pass on the parcel.

2. **If duplex remains the program:** engage Texas real estate counsel for a written opinion on CC&R enforceability and amendment feasibility before signing the purchase contract.

3. **DSD Zoning Verification Letter.** Confirms the MF-3 reading. Required regardless of duplex vs. SFR strategy.

4. **Title commitment review.** Resolves the Vol. 660 Pg. 968 blanket electric easement scope, current owner, lien status, and HOA estoppel.

5. **Pre-application meeting with DSD Residential Plan Review.** Confirms procedural path, current fee schedule, sprinkler amendment status, detention-exemption practice for the proposed project type.

6. **Arborist walk and updated boundary survey.** Resolves the tree inventory data gap and establishes Critical Root Zone constraints that drive footprint placement. The updated survey also resolves the 15-foot drainage easement location.

7. **Engage civil engineer for Utility Tap Plan and drainage form.** Required before residential plan review will issue.

8. **Engage architect for schematic design.** Must incorporate WUI Zone C ignition-resistant assemblies, Subchapter F McMansion envelope, and (if duplex remains in play and CC&Rs permit) any HOA Architectural Control Committee requirements.

9. **Demolition permit application** (separate from new construction permit).

10. **Building permit application** with full architectural, structural, MEP set; Utility Tap Plan; tree disposition; ESC plan; sidewalk-or-fee-in-lieu election.`} />

        <Divider />

        <Callout variant="neutral" label="Scope note:">
          This report does not draft engineering documents, surveys, or legal opinions. It identifies the items requiring those deliverables and the team members who own them. Schedule estimates are deliberately omitted; the engineering and construction teams own the timeline.
        </Callout>
      </NoeticPage>
    </NoeticDocument>
  );
}

export default <Report />;
