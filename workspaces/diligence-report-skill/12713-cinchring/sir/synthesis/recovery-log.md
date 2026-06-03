# Recovery Log — 12713 Cinchring Ln

Notes on gap-recovery decisions made during synthesis.

## Bucket A items (re-attempted)

None. All material gaps fall into Buckets B or C.

## Conflicts resolved during synthesis

### Base zoning: SF-3 vs MF-3
- **Zoning Pathway** subagent inferred SF-2/SF-3 from neighborhood context (Property Profile UI was not reachable from its tooling).
- **Property Records** subagent later pulled the COA Zoning_1 ArcGIS feature service directly at the parcel coordinates and got **MF-3**.
- **Resolution:** treat MF-3 as the authoritative reading (ArcGIS feature service is the source the Property Profile UI itself uses). Flag the SF-platted-as-MF-3 anomaly as a data-gap requiring DSD Zoning Verification Letter.

### WUI status
- **Environmental** subagent inferred "almost certainly outside any WUI zone" based on suburban Blackland Prairie location.
- **Property Records** subagent confirmed **WUI Proximity Zone C** via the COA WUI ArcGIS layer at parcel coordinates.
- **Resolution:** treat Zone C as authoritative. Include ignition-resistant construction premium ($5K–$15K) in moderate findings. Recommend final confirmation via the COA WUI Zone Lookup tool before design.

## Bucket B items (genuinely external, surfaced for action)

- Title commitment will pull: Vol. 660 Pg. 968 blanket electric easement; most-recent deed; HOA dues / arrearages; sub-survey of the 15' D.E.
- Arborist will produce: full tree inventory and CRZ mapping.
- DSD pre-application meeting will resolve: Zoning Verification Letter; sprinkler amendment status; detention exemption; fee schedule.
- Austin Water Field Ops will produce: hydrant flow test; rear-vault disposition.

## Bucket C items

None. No concept plan was provided, so no plan-specific ambiguities.

## Surveyor pipeline note

The configured property-records pipeline (which invokes the surveyor CLI) was not available in this run because the CLI's headless subprocess could not authenticate. A direct property-records research subagent was substituted; it produced equivalent data via TCAD public search, COA Property Profile ArcGIS, FEMA Map Service Center, and the Travis County Clerk index. The Scofield HOA's publicly posted recorded CC&Rs and amendments provided the chain of title detail that the clerk-PDF download path would otherwise have produced.
