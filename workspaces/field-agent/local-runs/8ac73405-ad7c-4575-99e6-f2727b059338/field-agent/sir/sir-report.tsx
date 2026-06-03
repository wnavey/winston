import {
  NoeticDocument,
  NoeticPage,
  CoverPage,
  ContentsPage,
  SectionHeading,
  SubHeading,
  SeverityBadge,
  Callout,
  Table,
  KeyValue,
  MarkdownBody,
  Divider,
} from '/Users/wnavey/noetic/claude-plugins/plugins/noetic-tools/noetic-pdf/src/index';

function Report() {
  return (
    <NoeticDocument title="Site Intelligence Report — 12713 Cinchring Lane, Austin, TX">
      {/* ── Cover ─────────────────────────────────────── */}
      <CoverPage
        title="Site Intelligence Report"
        subtitle="12713 Cinchring Lane, Austin, TX 78727"
        date="June 3, 2026"
      />

      {/* ── Contents + first section ──────────────────── */}
      <ContentsPage
        title="Site Intelligence Report"
        metadata={[
          { label: 'Property', value: '12713 Cinchring Lane, Austin, TX 78727' },
          { label: 'Legal Description', value: 'Lot 12, Block M, Scofield Subdivision, Cab. 91, Sl. 264-265' },
          { label: 'Report Date', value: 'June 3, 2026' },
          { label: 'Assessment Tier', value: 'Tier 1 (Address Only)' },
          { label: 'Prepared by', value: 'Noetic AI' },
          { label: 'Data Sources', value: 'Feasibility intake, MLS records, Bureau feasibility guides (11 disciplines), LDC / HOME amendments' },
        ]}
        tocItems={[
          'Executive Summary',
          'Property Identification',
          'Zoning & Land Use',
          'Regulatory Pathway',
          'Environmental & Drainage',
          'Easements & Encumbrances',
          'HOA & Deed Restrictions',
          'Utilities & Infrastructure',
          'Transportation & Access',
          'Data Gaps & Recommendations',
        ]}
      />

      {/* ── 1  Executive Summary ──────────────────────── */}
      <NoeticPage>
        <SectionHeading number={1}>Executive Summary</SectionHeading>
        <SeverityBadge level="moderate">Likely feasible with conditions — deed-restriction risk is the go/no-go gate</SeverityBadge>

        <MarkdownBody markdown={`The subject property is an 8,054 SF (~0.18-acre) lot in the Scofield Farms subdivision of North Austin, improved with a 1-story brick-and-wood single-family residence built in 1993 (2,095 SF, 4 bed / 2 bath). The owner proposes to **demolish the existing house and construct a new duplex**.

Under the City of Austin's **HOME Phase 1 amendments** (effective 2024), duplex use is permitted by right on SF-3 zoned lots. The project does **not** require a site plan — it proceeds through residential building permit review only. The site is in FEMA **Zone X** (no floodplain), in an established subdivision with existing utility infrastructure.`} />

        <SubHeading color="teal">Key Conditions and Risks</SubHeading>

        <Callout variant="action" label="DEED RESTRICTIONS (HIGH RISK):">
          The property is governed by the Scofield Farms ROA Declaration of Covenants, Conditions and Deed Restrictions. Private deed restrictions may prohibit duplex construction even where city zoning permits it. The City does not enforce deed restrictions; however, the HOA and neighbors may enforce through civil litigation. Legal review of the CC&Rs is essential before proceeding.
        </Callout>

        <Callout variant="data-gap" label="ZONING CONFIRMATION:">
          Base zoning is estimated as SF-3 based on lot size (8,054 SF is below the SF-2 minimum of 10,000 SF). GIS confirmation was not available for this Tier 1 run. HOME amendments apply to both SF-2 and SF-3.
        </Callout>

        <Callout variant="action" label="TREE SURVEY REQUIRED:">
          The lot is 30+ years old and likely has mature trees. Protected or heritage trees (oaks, pecans, elms) could significantly constrain the buildable envelope. An RPLS-certified tree survey is required before design.
        </Callout>

        <Callout variant="neutral" label="TIGHT DIMENSIONAL ENVELOPE:">
          At 8,054 SF with a 0.40:1 FAR cap, maximum GFA is ~3,222 SF for the duplex (both units combined). Building coverage capped at 40%. These are workable for a duplex but require careful, efficient design.
        </Callout>
      </NoeticPage>

      {/* ── 2  Property Identification ────────────────── */}
      <NoeticPage>
        <SectionHeading number={2}>Property Identification</SectionHeading>
        <SeverityBadge level="none">Property identity confirmed across intake and MLS sources</SeverityBadge>

        <Table
          columns={[
            { header: 'Field', width: 150 },
            { header: 'Value', flex: 1 },
          ]}
          rows={[
            { Field: 'Address', Value: '12713 Cinchring Lane, Austin, TX 78727' },
            { Field: 'Legal Description', Value: 'Lot 12, Block M, Scofield Subdivision, Cabinet 91, Slide 264-265, Travis County, TX' },
            { Field: 'Lot Size', Value: '8,054 SF (0.18 acres)' },
            { Field: 'Year Built', Value: '1993' },
            { Field: 'Existing Improvements', Value: '1-story brick/wood SFR, 2,095 SF, 4 bed / 2 bath, concrete drive, wood fence' },
            { Field: 'HOA', Value: 'Scofield Farms ROA — $125/quarter' },
            { Field: 'School District', Value: 'Pflugerville ISD' },
            { Field: 'Jurisdiction', Value: 'City of Austin — Full Purpose' },
          ]}
        />

        <SubHeading>Proposed Development</SubHeading>
        <MarkdownBody markdown={`- **Project type:** Demolish existing SFR; construct new duplex (ground-up)
- **Construction type:** New construction following full demolition
- **Unit type:** Duplex (two dwelling units)`} />
      </NoeticPage>

      {/* ── 3  Zoning & Land Use ──────────────────────── */}
      <NoeticPage>
        <SectionHeading number={3}>Zoning & Land Use</SectionHeading>
        <SeverityBadge level="none">Duplex permitted by right under HOME Phase 1</SeverityBadge>

        <SubHeading>Base Zoning District</SubHeading>
        <MarkdownBody markdown={`**Estimated: SF-3 (Family Residence)**

The lot size of 8,054 SF is below the SF-2 minimum (10,000 SF) but above the SF-3 minimum (5,750 SF), indicating **SF-3** as the base zoning district. GIS confirmation is required.

Under HOME Phase 1 (effective 2024), **duplex use is permitted by right** on SF-1, SF-2, and SF-3 lots citywide. No conditional use permit, rezoning, or variance is required.

**No overlay districts identified** — no CO, MU, NCCD, ETOD, DB90, VMU, CVC, WO, PUD, or TOD indicators from available data.`} />

        <SubHeading>Dimensional Standards (SF-3)</SubHeading>
        <Table
          columns={[
            { header: 'Standard', width: 180 },
            { header: 'Requirement', width: 130 },
            { header: 'Project Impact', flex: 1 },
          ]}
          rows={[
            { Standard: 'Max Height', Requirement: '35 ft', 'Project Impact': 'Adequate for 2-story duplex' },
            { Standard: 'Max FAR (0.40:1)', Requirement: '3,222 SF GFA', 'Project Impact': 'Both units combined — efficient design required' },
            { Standard: 'Max Bldg Coverage (40%)', Requirement: '3,222 SF', 'Project Impact': 'Ground-floor footprint limit' },
            { Standard: 'Max Imperv. Cover (45%)', Requirement: '3,624 SF', 'Project Impact': 'Includes building + all paving' },
            { Standard: 'Front Setback', Requirement: '25 ft', 'Project Impact': 'Consistent with plat building line' },
            { Standard: 'Side Setback', Requirement: '5 ft each', 'Project Impact': '15 ft if corner lot (street side)' },
            { Standard: 'Rear Setback', Requirement: '10 ft', 'Project Impact': 'Standard' },
          ]}
        />

        <SubHeading>Compatibility Standards</SubHeading>
        <MarkdownBody markdown={`**Not applicable.** The 2024 replacement Article 10 applies only to sites zoned MF-4 or less restrictive within 75 ft of a triggering property. SF-3 is more restrictive than MF-4, so Compatibility Standards do not apply to this duplex project.`} />

        <SubHeading>Parking</SubHeading>
        <MarkdownBody markdown={`**No minimum parking required.** Citywide parking minimums were eliminated November 2023 (Ord. No. 20231102-028). ADA accessible parking still applies per federal law.`} />
      </NoeticPage>

      {/* ── 4  Regulatory Pathway ─────────────────────── */}
      <NoeticPage>
        <SectionHeading number={4}>Regulatory Pathway</SectionHeading>
        <SeverityBadge level="none">Building permit only — no site plan required</SeverityBadge>

        <MarkdownBody markdown={`The proposed duplex on an existing platted SF lot is **exempt from site plan requirements** under LDC Chapter 25-5. The project proceeds through **residential building permit review** under the 2024 IRC and LDC Chapter 25-2.

**Subchapter E (Design Standards)** does not apply — it is triggered only by projects requiring a site plan.`} />

        <SubHeading>Required Permits and Approvals</SubHeading>
        <Table
          columns={[
            { header: 'Permit / Approval', width: 180 },
            { header: 'Required', width: 70 },
            { header: 'Notes', flex: 1 },
          ]}
          rows={[
            { 'Permit / Approval': 'Demolition Permit', Required: 'YES', Notes: 'Separate permit for existing structure removal' },
            { 'Permit / Approval': 'Building Permit (duplex)', Required: 'YES', Notes: 'Residential Plan Review Division' },
            { 'Permit / Approval': 'Site Plan', Required: 'NO', Notes: 'Exempt — duplex on existing platted lot' },
            { 'Permit / Approval': 'TIA / Trans. Assessment', Required: 'NO', Notes: 'Far below trip thresholds' },
            { 'Permit / Approval': 'Tree Survey & Protection', Required: 'LIKELY', Notes: 'If regulated trees present on site' },
            { 'Permit / Approval': 'ESC Plan', Required: 'YES', Notes: 'Basic erosion/sediment control with permit' },
            { 'Permit / Approval': 'Austin Water Service', Required: 'YES', Notes: 'Coordinate new taps for duplex' },
          ]}
        />

        <SubHeading>Estimated Timeline</SubHeading>
        <Table
          columns={[
            { header: 'Phase', width: 200 },
            { header: 'Duration', flex: 1 },
          ]}
          rows={[
            { Phase: 'Design & engineering', Duration: '2-4 months' },
            { Phase: 'Demolition permit', Duration: '2-4 weeks' },
            { Phase: 'Building permit review', Duration: '4-8 weeks' },
            { Phase: 'Demolition construction', Duration: '2-4 weeks' },
            { Phase: 'New construction', Duration: '8-14 months' },
            { Phase: 'Total estimated', Duration: '14-24 months' },
          ]}
        />
      </NoeticPage>

      {/* ── 5  Environmental & Drainage ───────────────── */}
      <NoeticPage>
        <SectionHeading number={5}>Environmental & Drainage</SectionHeading>
        <SeverityBadge level="none">Zone X — no floodplain constraints</SeverityBadge>

        <SubHeading>Flood Zone</SubHeading>
        <Table
          columns={[
            { header: 'Field', width: 180 },
            { header: 'Value', flex: 1 },
          ]}
          rows={[
            { Field: 'FEMA Zone', Value: 'Zone X (outside 100-year flood prone area)' },
            { Field: 'FIRM Panel', Value: '0115E, Community No. 480624 (48453C)' },
            { Field: 'FIRM Date', Value: 'June 16, 1993' },
            { Field: 'Floodplain Permit', Value: 'Not required' },
            { Field: 'FFE Requirements', Value: 'Not applicable' },
          ]}
        />

        <Callout variant="data-gap" label="FIRM PANEL AGE:">
          The FIRM date is from 1993 (33 years old). Current effective panels may have been updated. Confirmation via FEMA NFHL recommended. However, the Scofield Farms area is generally upland terrain without significant flood risk.
        </Callout>

        <SubHeading>Environmental Summary</SubHeading>
        <MarkdownBody markdown={`- **Watershed:** Likely Walnut Creek (North Austin) — Suburban or Urban classification
- **Edwards Aquifer:** Not in recharge or transition zone
- **Barton Springs Zone:** Not applicable
- **CEFs:** No known Critical Environmental Features (GIS confirmation needed)
- **WUI:** Not expected in established suburban area
- **Water Quality:** Controls triggered if new + redeveloped impervious cover exceeds 8,000 SF. At 3,624 SF max IC, this threshold may not be reached.`} />
      </NoeticPage>

      {/* ── 6  Easements ──────────────────────────────── */}
      <NoeticPage>
        <SectionHeading number={6}>Easements & Encumbrances</SectionHeading>
        <SeverityBadge level="moderate">Blanket electric easement scope unknown — instrument review required</SeverityBadge>

        <Table
          columns={[
            { header: 'Easement', width: 130 },
            { header: 'Type', width: 90 },
            { header: 'Reference', width: 120 },
            { header: 'Impact', flex: 1 },
          ]}
          rows={[
            { Easement: '5-ft P.U.E.', Type: 'Utility', Reference: 'Subdivision plat', Impact: 'Restricts building within 5 ft of applicable lot lines' },
            { Easement: '25-ft Bldg Line', Type: 'Setback', Reference: 'Subdivision plat', Impact: 'Front setback — consistent with SF-3' },
            { Easement: 'Blanket electric', Type: 'Electric', Reference: 'Vol. 660, Pg. 968', Impact: 'Scope unknown — could affect entire lot' },
            { Easement: 'Utility ingress/egress', Type: 'Access', Reference: 'Vol. 11863, Pg. 1147', Impact: 'Right of access for utility providers' },
            { Easement: 'Declarant ROW reserve', Type: 'Potential', Reference: 'Vol. 11863, Pg. 1147', Impact: 'Up to 10 ft each side of lot lines' },
          ]}
        />

        <Callout variant="action" label="INSTRUMENT REVIEW REQUIRED:">
          The blanket electric easement (Vol. 660, Pg. 968) is the highest-risk easement item. Blanket easements can cover the entire lot and restrict construction activities. The actual scope must be determined by reviewing the original instrument at the Travis County Clerk's office. The declarant's 10-ft reservation, if exercised, combined with the 5-ft P.U.E. and 5-ft side setbacks, could create 15-ft constraints from each side lot line.
        </Callout>
      </NoeticPage>

      {/* ── 7  HOA & Deed Restrictions ────────────────── */}
      <NoeticPage>
        <SectionHeading number={7}>HOA & Deed Restrictions</SectionHeading>
        <SeverityBadge level="significant">Deed restrictions may prohibit duplex — legal review required before proceeding</SeverityBadge>

        <SubHeading>Scofield Farms ROA</SubHeading>
        <KeyValue
          items={[
            { label: 'HOA', value: 'Scofield Farms Residential Owners Association' },
            { label: 'Management', value: 'Inframark' },
            { label: 'Dues', value: '$125/quarter' },
            { label: 'Governance', value: 'Declaration of CC&Rs (with 8+ amendments)' },
            { label: 'Architectural Review', value: 'Architectural Control Committee (ACC)' },
          ]}
        />

        <Callout variant="action" label="GO / NO-GO DECISION POINT:">
          This is the single highest risk factor for the proposed development. The City of Austin issues building permits based on LDC compliance regardless of deed restrictions. However, the HOA and neighboring property owners may enforce deed restrictions through civil litigation and could obtain an injunction. Scofield Farms was developed in the early 1990s as a single-family community. The original deed restrictions almost certainly contemplate single-family residential use only. Whether duplexes are prohibited, and whether the HOME amendments affect covenant enforceability, is a legal question requiring: (1) full review of the Declaration and all amendments, (2) legal opinion on duplex permissibility, and (3) assessment of HOA enforcement posture.
        </Callout>
      </NoeticPage>

      {/* ── 8  Utilities ──────────────────────────────── */}
      <NoeticPage>
        <SectionHeading number={8}>Utilities & Infrastructure</SectionHeading>
        <SeverityBadge level="data-gap">Existing infrastructure assumed adequate — service confirmation needed</SeverityBadge>

        <Table
          columns={[
            { header: 'Utility', width: 120 },
            { header: 'Provider', width: 110 },
            { header: 'Status', width: 80 },
            { header: 'Duplex Impact', flex: 1 },
          ]}
          rows={[
            { Utility: 'Water', Provider: 'Austin Water', Status: 'Existing', 'Duplex Impact': 'May need new/upsized taps; capital recovery fees apply' },
            { Utility: 'Wastewater', Provider: 'Austin Water', Status: 'Existing', 'Duplex Impact': 'May need new/upsized tap; LUE calculation for 2 units' },
            { Utility: 'Electric', Provider: 'Austin Energy', Status: 'Existing', 'Duplex Impact': 'New service panels; meter upgrade for 2-unit config' },
            { Utility: 'Fire Protection', Provider: 'AFD', Status: 'Existing', 'Duplex Impact': 'Hydrant coverage expected adequate; NFPA 13D may apply' },
          ]}
        />

        <SectionHeading number={9}>Transportation & Access</SectionHeading>
        <SeverityBadge level="none">Local street — no TIA or ROW dedication expected</SeverityBadge>

        <MarkdownBody markdown={`- **Cinchring Lane:** Local/residential street (ASMP Level 1 estimated)
- **No TIA required** — residential duplex far below 2,000 daily trip threshold
- **No ROW dedication expected** — local street; ASMP target likely met
- **Driveway:** Existing access from Cinchring Lane; may need modification for duplex
- **Type I residential driveway** appropriate for Level 1 street`} />
      </NoeticPage>

      {/* ── 10  Data Gaps ─────────────────────────────── */}
      <NoeticPage>
        <SectionHeading number={10}>Data Gaps & Recommendations</SectionHeading>

        <SubHeading color="teal">Critical Data Gaps</SubHeading>
        <Table
          columns={[
            { header: 'Gap', width: 160 },
            { header: 'Priority', width: 60 },
            { header: 'Resolution', flex: 1 },
          ]}
          rows={[
            { Gap: 'Deed restrictions review', Priority: 'HIGH', Resolution: 'Obtain CC&Rs from county clerk or HOA; engage real estate attorney' },
            { Gap: 'Base zoning confirmation', Priority: 'HIGH', Resolution: 'COA GIS Property Profile or zoning verification letter' },
            { Gap: 'Tree survey', Priority: 'HIGH', Resolution: 'RPLS-certified tree survey before design' },
            { Gap: 'County clerk documents', Priority: 'HIGH', Resolution: 'Download Vol. 660/Pg. 968 and Vol. 11863/Pg. 1147' },
            { Gap: 'COA floodplain (current)', Priority: 'MED', Resolution: 'COA GIS or FloodPro check' },
            { Gap: 'Adjacent property zoning', Priority: 'LOW', Resolution: 'COA GIS adjacent context query' },
          ]}
        />

        <SubHeading color="teal">Recommended Next Steps</SubHeading>
        <MarkdownBody markdown={`1. **Obtain and review Scofield Farms CC&Rs** — This is the go/no-go decision point
2. **Confirm base zoning** via COA GIS or zoning verification letter
3. **Commission RPLS-certified tree survey** — before any design work
4. **Review county clerk instruments** — blanket electric easement and declarant's reservation
5. **Engage architect/designer** — 3,222 SF GFA cap requires efficient duplex design
6. **Contact Austin Water** — confirm service capacity and tap requirements
7. **Contact Austin Energy** — determine meter/panel requirements for two-unit service`} />

        <Divider spacing={12} />

        <SubHeading color="teal">Confidence Assessment</SubHeading>
        <Table
          columns={[
            { header: 'Category', width: 160 },
            { header: 'Confidence', width: 90 },
            { header: 'Basis', flex: 1 },
          ]}
          rows={[
            { Category: 'Property ID', Confidence: 'HIGH', Basis: 'MLS + intake data' },
            { Category: 'Zoning (SF-3)', Confidence: 'MEDIUM', Basis: 'Inferred from lot size; GIS TBD' },
            { Category: 'Use permissibility', Confidence: 'HIGH', Basis: 'HOME amendments clear' },
            { Category: 'Flood zone', Confidence: 'MEDIUM', Basis: 'Intake data; 1993 FIRM' },
            { Category: 'Easements', Confidence: 'MEDIUM', Basis: 'Intake data; instruments not reviewed' },
            { Category: 'Deed restrictions', Confidence: 'VERY LOW', Basis: 'Not reviewed' },
            { Category: 'Trees', Confidence: 'VERY LOW', Basis: 'No survey data' },
          ]}
        />

        <Divider spacing={8} />
        <MarkdownBody markdown={`*This report was generated as a **Tier 1 (address-only)** assessment. No supporting documents, site plans, or concept plans were available. A Tier 2/3 assessment with TCAD records, GIS property profile, county clerk documents, and tree survey would substantially increase confidence.*`} />
      </NoeticPage>
    </NoeticDocument>
  );
}

export default <Report />;
