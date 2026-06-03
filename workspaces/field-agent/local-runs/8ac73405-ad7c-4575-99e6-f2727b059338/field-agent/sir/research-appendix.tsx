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

function ResearchAppendix() {
  return (
    <NoeticDocument title="Research Appendix — 12713 Cinchring Lane, Austin, TX">
      {/* ── Cover ─────────────────────────────────────── */}
      <CoverPage
        title="Research Appendix"
        subtitle="12713 Cinchring Lane, Austin, TX 78727"
        date="June 3, 2026"
      />

      {/* ── Contents ──────────────────────────────────── */}
      <ContentsPage
        title="Research Appendix"
        metadata={[
          { label: 'Property', value: '12713 Cinchring Lane, Austin, TX 78727' },
          { label: 'Legal Description', value: 'Lot 12, Block M, Scofield Subdivision' },
          { label: 'Report Date', value: 'June 3, 2026' },
          { label: 'Assessment Tier', value: 'Tier 1 (Address Only)' },
          { label: 'Companion Document', value: 'Site Intelligence Report' },
          { label: 'Prepared by', value: 'Noetic AI' },
        ]}
        tocItems={[
          'Research Methodology',
          'Source Data',
          'Zoning Analysis',
          'HOME Amendments Analysis',
          'Dimensional Envelope',
          'Easement Impact Analysis',
          'Flood & Environmental Analysis',
          'Regulatory Pathway Analysis',
          'Feasibility Guides Referenced',
          'Recorded Document References',
          'Confidence Matrix',
        ]}
      />

      {/* ── A  Methodology ────────────────────────────── */}
      <NoeticPage>
        <SectionHeading number={1}>Research Methodology</SectionHeading>

        <MarkdownBody markdown={`This Tier 1 (address-only) assessment was conducted without access to MCP surveyor tools (TCAD, COA GIS, FEMA NFHL, Travis County Clerk, TCEQ). Research relied on feasibility intake data, web research (MLS listings, City of Austin resources), and all 11 Bureau feasibility guides for Austin.`} />

        <SubHeading>Tools Attempted vs. Available</SubHeading>
        <Table
          columns={[
            { header: 'Tool', width: 180 },
            { header: 'Status', width: 110 },
            { header: 'Notes', flex: 1 },
          ]}
          rows={[
            { Tool: 'TCAD appraisal_search', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'TCAD appraisal_details', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'COA GIS property_profile', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'COA GIS adjacent_context', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'FEMA flood lookup', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'TCEQ Edwards zone', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'TxDOT roadway lookup', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'County clerk search', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'Census / QOZ lookup', Status: 'NOT AVAIL', Notes: 'Surveyor MCP not provisioned' },
            { Tool: 'Web search', Status: 'USED', Notes: 'Multiple queries; MLS, COA, LDC sources' },
            { Tool: 'Bureau feasibility guides', Status: 'USED', Notes: 'All 11 disciplines reviewed' },
          ]}
        />
      </NoeticPage>

      {/* ── B  Source Data ─────────────────────────────── */}
      <NoeticPage>
        <SectionHeading number={2}>Source Data</SectionHeading>

        <SubHeading>Intake Data (Tier 1)</SubHeading>
        <KeyValue
          items={[
            { label: 'Address', value: '12713 Cinchring Lane, Austin, TX' },
            { label: 'Legal', value: 'Lot 12, Block M, Scofield Subdivision, Cabinet 91, Slide 264-265' },
            { label: 'Proposed', value: 'Demo existing; build new duplex (ground-up)' },
            { label: 'Existing', value: '1-story brick/wood house, concrete drive, wood fence' },
            { label: 'Flood Zone', value: 'Zone X per FIRM Panel 0115E, dated 6/16/93' },
          ]}
        />

        <SubHeading>Easements (from Intake)</SubHeading>
        <MarkdownBody markdown={`- 5' Public Utility Easement (P.U.E.) and 25' Building Line
- Blanket-type electric easement per Vol. 660, Pg. 968
- Ingress & egress easement for utilities per Vol. 11863, Pg. 1147
- Declarant reserves right to grant/dedicate R.O.W. and easements, not to exceed 10' each side of any lot line per Vol. 11863, Pg. 1147`} />

        <SubHeading>MLS / Public Record Data</SubHeading>
        <Table
          columns={[
            { header: 'Field', width: 140 },
            { header: 'Value', flex: 1 },
          ]}
          rows={[
            { Field: 'Lot Size', Value: '8,054 SF (0.18 acres)' },
            { Field: 'Structure', Value: '2,095 SF, 4 bed / 2 bath' },
            { Field: 'Year Built', Value: '1993' },
            { Field: 'Stories', Value: '1' },
            { Field: 'Construction', Value: 'Brick and wood' },
            { Field: 'HOA', Value: 'Scofield Farms ROA, $125/quarter' },
            { Field: 'ZIP', Value: '78727' },
            { Field: 'Source', Value: 'Redfin MLS #6917720' },
          ]}
        />

        <SubHeading>Community Context</SubHeading>
        <MarkdownBody markdown={`**Scofield Farms** is located off Parmer Lane and Metric Boulevard in North Austin between I-35 and Mopac. Three sections: Original (east of Metric, north of Parmer), Park at Scofield (east of Metric at Chasewood), and Withers Way (west of Metric). Pflugerville ISD serves the area. HOA managed by Inframark with an Architectural Control Committee (ACC).`} />
      </NoeticPage>

      {/* ── C  Zoning Analysis ────────────────────────── */}
      <NoeticPage>
        <SectionHeading number={3}>Zoning Analysis</SectionHeading>

        <SubHeading>Base Zoning Inference</SubHeading>
        <MarkdownBody markdown={`The base zoning was inferred from lot size analysis:

- **SF-2 minimum lot size:** 10,000 SF
- **SF-3 minimum lot size:** 5,750 SF
- **Subject lot:** 8,054 SF

The lot meets SF-3 minimums but not SF-2 minimums, indicating **SF-3** as the most likely base zoning district. The property could be SF-2 with a pre-existing non-conforming lot size if the subdivision was platted under different standards, but this is unlikely given the lot is part of a platted subdivision.

**Limitation:** This is an inference, not a confirmed zoning designation. GIS confirmation is required.`} />

        <SectionHeading number={4}>HOME Amendments Analysis</SectionHeading>

        <MarkdownBody markdown={`**HOME Phase 1** (effective 2024) key provisions:

- Allows duplexes, two-unit, and three-unit on SF-1, SF-2, and SF-3 lots
- Building coverage max 40% for duplex/two-unit/three-unit
- Impervious cover max 45%
- Height per base zoning (35 ft for SF-3; Subchapter F 32-ft restriction applies only to single-family residential use)
- No minimum parking (citywide elimination, Ord. No. 20231102-028, Nov 2023)

**HOME Phase 2** (accepted Nov 2024; Site Plan Lite/Infill Plat from June 2025): Lowered small-lot SF minimum to 1,800 SF. Not directly relevant to this duplex project.

**Key regulatory finding:** A duplex on an SF-3 lot proceeds via building permit only. No site plan, no Subchapter E, no TIA.`} />
      </NoeticPage>

      {/* ── D  Dimensional Envelope ────────────────────── */}
      <NoeticPage>
        <SectionHeading number={5}>Dimensional Envelope Calculation</SectionHeading>

        <SubHeading>Capacity Table (8,054 SF lot)</SubHeading>
        <Table
          columns={[
            { header: 'Parameter', width: 200 },
            { header: 'Calculation', width: 130 },
            { header: 'Result', flex: 1 },
          ]}
          rows={[
            { Parameter: 'Max GFA (0.40:1 FAR)', Calculation: '8,054 x 0.40', Result: '3,222 SF' },
            { Parameter: 'Max bldg coverage (40%)', Calculation: '8,054 x 0.40', Result: '3,222 SF' },
            { Parameter: 'Max imperv. cover (45%)', Calculation: '8,054 x 0.45', Result: '3,624 SF' },
            { Parameter: 'Available IC for paving', Calculation: '3,624 - 3,222', Result: '402 SF (if max footprint)' },
          ]}
        />

        <Callout variant="insight" label="Two-story design advantage:">
          A two-story duplex with ~1,611 SF footprint achieves 3,222 SF GFA while using only 20% building coverage — well within the 40% limit. This frees 2,013 SF of IC budget for driveways, walkways, and patios. A single-story design maxing out coverage leaves only 402 SF for all other paving.
        </Callout>

        <SubHeading>Estimated Setback Analysis</SubHeading>
        <MarkdownBody markdown={`Using typical Scofield Farms lot geometry (~60 ft wide x 134 ft deep):

- **Front (25 ft):** 134 - 25 = 109 ft depth available
- **Rear (10 ft):** 109 - 10 = 99 ft depth available
- **Sides (5 ft each):** 60 - 10 = 50 ft width available
- **Buildable rectangle:** ~50 ft x 99 ft = ~4,950 SF

Setbacks are **not the binding constraint** — FAR and building coverage (3,222 SF) are the controlling limits.`} />

        <SectionHeading number={6}>Easement Impact Analysis</SectionHeading>

        <MarkdownBody markdown={`**5-ft P.U.E.:** Standard utility easement. If present on both side lot lines, buildable width reduces to 50 - 10 = 40 ft.

**25-ft Building Line:** Consistent with SF-3 front setback. No additional constraint beyond what zoning requires.

**Blanket Electric Easement (Vol. 660, Pg. 968):** Could range from access-only rights (minimal impact) to full construction restriction across the lot (severe impact). Instrument review is essential.

**Declarant's 10-ft Reservation (Vol. 11863, Pg. 1147):** Worst case: 10 ft each side + 5 ft P.U.E. + 5 ft setback = 20 ft from each side lot line, leaving only 20 ft buildable width on a 60-ft lot. This would make duplex construction extremely challenging.`} />
      </NoeticPage>

      {/* ── E  Flood & Environmental ───────────────────── */}
      <NoeticPage>
        <SectionHeading number={7}>Flood & Environmental Analysis</SectionHeading>

        <SubHeading>FIRM Panel Analysis</SubHeading>
        <MarkdownBody markdown={`**Panel 0115E**, Community No. 480624 (48453C), dated June 16, 1993.

**Zone X (unshaded):** Areas outside the 0.2% annual chance (500-year) floodplain. Most favorable designation — no floodplain development permit, no FFE requirements, no ASCE 24 compliance needed.

**Limitation:** FIRM date of 1993 is 33 years old. Travis County has undergone significant FIRM updates. Current panel should be confirmed but the Scofield Farms area is generally upland terrain.`} />

        <SubHeading>Watershed Inference</SubHeading>
        <MarkdownBody markdown={`**Walnut Creek Watershed** — property location east of Metric Blvd in North Austin places it within the Walnut Creek system (drains ~43 sq miles from North Austin to Colorado River).

Classification is likely **Suburban** or **Urban** development zone. This affects:
- Cut/fill disclosure (exempt in Urban, required in Suburban)
- Impervious cover limits per watershed
- Water quality control sizing

**Edwards Aquifer:** Not in recharge or transition zone (north Austin, well north of the boundary).

**Barton Springs Zone:** Not applicable.`} />

        <SectionHeading number={8}>Regulatory Pathway Analysis</SectionHeading>

        <SubHeading>Site Plan Exemption</SubHeading>
        <MarkdownBody markdown={`Under LDC Chapter 25-5, a site plan is NOT required for single-family or duplex construction on an existing platted lot. This means:

- No Subchapter E (Design Standards) compliance
- No formal completeness check process
- No multi-department review cycle
- Faster timeline through residential building permit
- No TIA or Transportation Assessment
- No PARD parkland dedication (building permit path, not site plan)

The project proceeds through the **Residential Plan Review Division** under:
- LDC Chapter 25-2 (zoning compliance)
- 2024 International Residential Code
- LDC Chapter 25-12 (technical codes)`} />

        <SubHeading>Compatibility Standards</SubHeading>
        <MarkdownBody markdown={`Post-July 2024 Article 10 (Ord. No. 20240516-004) applies only to sites zoned MF-4 or less restrictive AND within 75 ft of a triggering property (1-3 DU zoned SF-5 or more restrictive).

SF-3 is more restrictive than MF-4. The subject site is **not subject to Compatibility Standards** for its own development. The property IS a potential triggering property for nearby commercial development.`} />
      </NoeticPage>

      {/* ── F  Feasibility Guides ──────────────────────── */}
      <NoeticPage>
        <SectionHeading number={9}>Feasibility Guides Referenced</SectionHeading>

        <Table
          columns={[
            { header: 'Discipline', width: 50 },
            { header: 'Guide', width: 160 },
            { header: 'Key Findings', flex: 1 },
          ]}
          rows={[
            { Discipline: 'ZLU', Guide: 'Zoning & Land Use', 'Key Findings': 'SF-3 likely; duplex permitted under HOME; no overlays' },
            { Discipline: 'SDUF', Guide: 'Site Dev / Use / Form', 'Key Findings': 'No site plan required; Subchapter E N/A' },
            { Discipline: 'SDE', Guide: 'Subdivision & Dev Eng', 'Key Findings': 'Standard residential drainage; WQ may apply if IC > 8,000 SF' },
            { Discipline: 'EL', Guide: 'Electrical & Utility', 'Key Findings': 'Austin Energy service; check overhead clearances' },
            { Discipline: 'FWP', Guide: 'Floodplain & Waterway', 'Key Findings': 'Zone X — no floodplain constraints' },
            { Discipline: 'EPTP', Guide: 'Erosion, Trees & Plants', 'Key Findings': 'Tree survey critical; ESC plan required' },
            { Discipline: 'TA', Guide: 'Transportation Access', 'Key Findings': 'Local street; no TIA; no ROW dedication' },
            { Discipline: 'WWP', Guide: 'Water & Wastewater', 'Key Findings': 'Austin Water; existing service; tap fees apply' },
            { Discipline: 'Fire', Guide: 'Fire Feasibility', 'Key Findings': 'Standard residential; hydrant coverage expected' },
            { Discipline: 'Park', Guide: 'Parkland Dedication', 'Key Findings': 'Likely not triggered (building permit path)' },
          ]}
        />

        <SectionHeading number={10}>Recorded Document References</SectionHeading>

        <Table
          columns={[
            { header: 'Document', width: 140 },
            { header: 'Reference', width: 140 },
            { header: 'Priority', width: 60 },
            { header: 'Status', flex: 1 },
          ]}
          rows={[
            { Document: 'Blanket electric esmt', Reference: 'Vol. 660, Pg. 968', Priority: 'HIGH', Status: 'Not retrieved — surveyor tools unavailable' },
            { Document: 'Declarant esmt reserve', Reference: 'Vol. 11863, Pg. 1147', Priority: 'HIGH', Status: 'Not retrieved — surveyor tools unavailable' },
            { Document: 'Subdivision plat', Reference: 'Cab. 91, Sl. 264-265', Priority: 'MED', Status: 'Not retrieved — surveyor tools unavailable' },
            { Document: 'Declaration of CC&Rs', Reference: 'Unknown instrument', Priority: 'HIGH', Status: 'Not retrieved — requires HOA or clerk search' },
          ]}
        />
      </NoeticPage>

      {/* ── G  Confidence Matrix ──────────────────────── */}
      <NoeticPage>
        <SectionHeading number={11}>Confidence Matrix</SectionHeading>

        <Table
          columns={[
            { header: 'Data Point', width: 140 },
            { header: 'Confidence', width: 80 },
            { header: 'Source', width: 120 },
            { header: 'Gap', flex: 1 },
          ]}
          rows={[
            { 'Data Point': 'Address / location', Confidence: 'HIGH', Source: 'Intake + MLS', Gap: 'None' },
            { 'Data Point': 'Legal description', Confidence: 'HIGH', Source: 'Intake (survey)', Gap: 'None' },
            { 'Data Point': 'Lot size', Confidence: 'MED-HIGH', Source: 'MLS data', Gap: 'TCAD confirmation' },
            { 'Data Point': 'Base zoning', Confidence: 'MEDIUM', Source: 'Lot size inference', Gap: 'GIS confirmation' },
            { 'Data Point': 'Overlay districts', Confidence: 'LOW-MED', Source: 'No indicators found', Gap: 'GIS confirmation' },
            { 'Data Point': 'Use permissibility', Confidence: 'HIGH', Source: 'LDC + HOME', Gap: 'Zoning TBD' },
            { 'Data Point': 'Dimensional stds', Confidence: 'MED-HIGH', Source: 'LDC 25-2-492', Gap: 'Zoning TBD' },
            { 'Data Point': 'Flood zone', Confidence: 'MEDIUM', Source: 'Intake (1993 FIRM)', Gap: 'Current FIRM panel' },
            { 'Data Point': 'Watershed', Confidence: 'LOW-MED', Source: 'Geographic inference', Gap: 'GIS confirmation' },
            { 'Data Point': 'Easements', Confidence: 'MEDIUM', Source: 'Intake data', Gap: 'Instrument review' },
            { 'Data Point': 'Deed restrictions', Confidence: 'VERY LOW', Source: 'Not reviewed', Gap: 'CC&R review' },
            { 'Data Point': 'Trees', Confidence: 'VERY LOW', Source: 'No data', Gap: 'Field survey' },
            { 'Data Point': 'Utilities', Confidence: 'MEDIUM', Source: 'Existing assumed', Gap: 'AW/AE confirmation' },
            { 'Data Point': 'Compatibility', Confidence: 'HIGH', Source: 'LDC Article 10', Gap: 'None' },
            { 'Data Point': 'Permit path', Confidence: 'HIGH', Source: 'LDC Ch. 25-5', Gap: 'None' },
          ]}
        />

        <Divider spacing={12} />

        <Callout variant="neutral" label="Assessment Tier:">
          This Tier 1 (address-only) research appendix documents the methodology, sources, and analysis behind the companion Site Intelligence Report. A Tier 2 or Tier 3 assessment with TCAD records, COA GIS property profile (168 layers), county clerk document retrieval and transcription, and an RPLS-certified tree survey would resolve all identified data gaps and substantially increase confidence across all categories.
        </Callout>
      </NoeticPage>
    </NoeticDocument>
  );
}

export default <ResearchAppendix />;
