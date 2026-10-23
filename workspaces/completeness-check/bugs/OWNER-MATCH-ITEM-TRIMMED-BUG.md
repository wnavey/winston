# CC never checks that the owner matches across application, tax certificate and cover sheet: CC-1-07 was trimmed, and its cross-reference was left behind

**ID:** BUG-19  
**Kind:** bug
**Status:** open
**Version:** 1
**Date:** 2026-10-23
**Repos touched:** `bureau` (Austin CC `v2.7-trimmed` checklist + data files)
**Repos NOT touched:** `cityhall`, `substation`, `conductor`

> **Status:** diagnosed 2026-10-23, fix not implemented. The root cause is in the checklist content (`bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/cc-1.md`), not in the CC runbook or the agent.
> **Discovered by:** comparing Noetic CC review `28b83857-16e2-4a88-a9c3-491a3262ad2d` (Whitewater Express Car Wash, project `7a697ef1-733f-4d3b-87e6-9cce995d8f1e`, submission `38ddbfd8-9263-47d4-b0af-e9146e11d582`, U0) with the City of Austin's CC Certification Letter for SP-2026-0216C.CC. IG report: https://inspector-general-gamma.vercel.app/reports/view/2026-10-23-cc-vs-city-whitewater-express-car-wash
> **Presents as** a CC-1-08 (tax certificate) miss. It isn't one: CC-1-08 is a presence check and behaved correctly. No checklist item asks the ownership-match question at all.
> **Related:** v2-trimmed removals of the same kind (FFE/foundation type DAT-08/09, see the same IG report's SP1 tab; drainage calcs/Appendix T in the [2008 San Antonio comparison](https://inspector-general-gamma.vercel.app/reports/view/2026-10-15-cc-vs-city-2008-san-antonio)); the dedupe precedent `workspaces/completeness-check/duplicate-items-v2.7-trimmed/` (bureau#2196).

## Summary

The City of Austin failed the Whitewater submission because **the owner on the application, the tax certificate and the plan-set cover sheet do not match**. Noetic CC has no item that checks this. Austin's CC v2 had one, **CC-1-07** ("Owner name on application does not match owner name shown on tax certificate or warranty deed"). The v2-trimmed pass (bureau `a586b2eca9`, 2026-04-03) removed it because its only citation was the Requirements page.

The trim removed the row but not the methodology line that refers to it. Every version from v2-trimmed through current `v2.7-trimmed` on bureau `main` (`f191145ec0`) still tells the agent: *"Cross-reference: Owner name on application must match owner name shown on tax certificate or warranty deed (CC-1-07)."* The agent is told to make a check that no item can report.

What works correctly:
- **CC-1-08** (tax certificate present) failed correctly: no tax certificate was in the package Noetic received.
- **CC-1-06** (owner signature or authorization letter) passed correctly on its own wording: the owner signed Section 3.
- **The agent saw the mismatch.** CC-1-06 run-1 recorded that the cover sheet names a different owner, then passed because "the owner-name inconsistency … is an ownership cross-reference matter outside this item's wording". That is the right call on the item as written. There was nowhere to put the finding.

Root cause in one sentence: **the ownership-match requirement exists only as an orphaned methodology sentence pointing at a deleted item ID, so the finding has no row to land on.**

## The bug in one diagram

```
 City requirement (Requirements page, "Documentation & Legal"):
   "Signature on the application matches the owner on the tax certificate or warranty deed"
   "The legal description on the plan must match the tax certificate"
          │
          ▼
 bureau CC v2 (2026-04-03, 36191bda37)
   cc-1.md  methodology:  "Cross-reference: Owner name … must match … (CC-1-07)"   ✓
   cc-1.md  checklist:    | CC-1-07 | Owner name on application does not match … |   ✓
          │
          ▼  v2-trimmed (a586b2eca9): "Requirements page only" rows removed
 bureau CC v2-trimmed … v2.7-trimmed (today)
   cc-1.md  methodology:  "Cross-reference: Owner name … must match … (CC-1-07)"   ✓ still here
   cc-1.md  checklist:    CC-1-07 row                                               ✗ gone
          │
          ▼
 CC run on Whitewater U0 (review 28b83857, 3 voters)
   CC-1-06 owner signature      → pass  (run-1 notes: cover sheet owner = NADG LFII DOUBLE CREEK LP,
                                          application owner = Brezza I35 Holdings LLC,
                                          "outside this item's wording")       ← finding dropped here
   CC-1-08 tax cert present     → fail  ("no tax certificate in the package")   ✓ correct, different defect
   (no item)  owner match       → —                                             ✗ never evaluated
          │
          ▼
 City CC letter, SP1 (Pending): "The application, tax certificate, and owner listed on the
   plan set do not match … otherwise a general warranty deed should be provided"   ← Noetic silent
```

## Symptom (as observed)

The City's CC Certification Letter for SP-2026-0216C.CC (results 08/21/2026; comments dated 08/03/2026, page 3), CC Site/Sub Plan Review:

> **SP1 – Current Status: Pending.** CC: The application, tax certificate, and owner listed on the plan set do not match. Provide an updated tax certificate showing all taxes paid. Ownership should match between the tax certificate and the owner information on coversheet, otherwise a general warranty deed should be provided reflecting current ownership.

Noetic review `28b83857` (v2.7-trimmed, bureau `fdc8014`, Opus 5.5, 3 voters, completed 2026-10-22):

| # | Item | Verdict | Votes | Comment |
|---|---|---|---|---|
| 6 | CC-1-06 owner authorization | pass | 3 pass | "Owner Brezza I35 Holdings LLC signed CC Application Section 3 …" |
| 7 | CC-1-08 tax certificate present | fail | 3 fail | "No tax certificate found among the seven supplementary documents or in the 30-sheet plan set." |

The IG comparison counted the city comment as "caught" through CC-1-08, but on a different defect: we said the certificate was missing, the city said ownership didn't match.

**Tempting wrong reading:** "CC-1-08 caught it, so nothing to fix." CC-1-08 fails only when no certificate exists. Had the applicant uploaded the certificate the city saw, CC-1-08 would have passed and Noetic would have said nothing about the mismatch, even though the application and cover sheet disagree on their own, with no certificate needed.

## Evidence chain

1. **The v2 checklist had the item.** `bureau` `jurisdictions/austin/completeness-check/v2/cc-1.md:55`:
   `| CC-1-07 | Owner name on application does not match owner name shown on tax certificate or warranty deed (INT-07) | Always | application form | explicit | Requirements page, Documentation & Legal | guideline |`
   **Its only citation was the Requirements page**, which is why the trim removed it.

2. **The trim removed the row and kept the cross-reference.** `v2-trimmed/cc-1.md:39` and current `origin/main` `v2.7-trimmed/cc-1.md:50` both read: *"Cross-reference: Owner name on application must match owner name shown on tax certificate or warranty deed (CC-1-07)."* **No `| CC-1-07 |` row exists in any version from v2-trimmed through v2.7-trimmed** (checked v2-trimmed, v2.1 … v2.7-trimmed). `true-comment-num-mapping.tsv` goes straight from `cc-1:CC-1-06 6` to `cc-1:CC-1-08 7`.

3. **The city still asks for it.** The live Requirements page (https://www.austintexas.gov/development-services/site-plan-requirements, under Site Plan Requirements) lists "Tax certificate (unless tax exempt). The legal description on the plan must match the tax certificate" and "Signature on the application matches the owner on the tax certificate or warranty deed". The bureau citation label `Requirements page, Documentation & Legal` still resolves in `sources/manifest.json` (snapshot `sn_requirements-page_20261007-4bb44e95`). **The city enforced it on this submission** (evidence above).

4. **The mismatch was visible in the submission without a tax certificate.** CC-1-06 run-1 observation: *"CC Application Section 3 (page 2) lists owner Brezza I35 Holdings LLC … Note: the plan set cover sheet (Sheet 1, Block 2) and Sheet 8 list the owner as NADG LFII DOUBLE CREEK LP, which differs from the owner named on the application."* **The application-to-cover-sheet half of the check needs nothing the package lacked.**

5. **The agent dropped it deliberately and correctly.** CC-1-06 run-1 reasoning: *"The owner-name inconsistency between the application and the plan cover sheet is an ownership cross-reference matter outside this item's wording and is noted for the reviewer rather than used to fail this item."* **Runs 2 and 3 did not mention the mismatch at all.** Even the incidental notice is 1 in 3 voters, and it never surfaces as a verdict.

6. **CC-1-08 behaved correctly and is the wrong place for this.** All 3 voters listed the 7 supplementary documents (CC Application, Engineer's Summary Letter, Engineers Report, Location Map, Project Review Form, Formal Submittal Site Plan Application, TIA Determination Worksheet) and found no tax certificate; the application gives tax parcel 775822 only. **The city evidently had a certificate that Noetic was never given**, so on this package CC-1-08's fail is right and the ownership question is separate.

7. **Not a one-off: v2.7 has other orphaned cross-references.** A scan of `v2.7-trimmed/*.md` methodology lines for IDs with no checklist row finds instructions (not "removed in vX" history notes) at `cc-19.md:42` ("Lowest finished floor elevations (FLP-02) should be consistent with data table FFE (DAT-08) and erosion plan FFE (ENV-24/CC-17-07)": DAT-08 was trimmed, FLP-02/ENV-24 are legacy IDs) and `cc-19.md:43` ("… (RSMP-10) are consistent with WQD-07/WQD-08 in CC-20": legacy IDs). **Nothing in bureau tests or validation flags a methodology reference to a non-existent item.**

## Timeline

| Date | Commit | Event |
|---|---|---|
| 2026-04-03 | `36191bda37` | CC v2 adds CC-1-07 plus the cross-reference line |
| 2026-04-03 | `a586b2eca9` | v2-trimmed removes the CC-1-07 row ("Requirements page only"); cross-reference kept |
| 2026-07-07 | `2cc7ba4e66` | v2.7-trimmed created as an exact copy of v2.6-trimmed; the orphan carries forward |
| 2026-10-22 | review `28b83857` | Whitewater U0 run: mismatch seen by 1/3 voters under CC-1-06, no verdict |
| 2026-10-23 | `3f5a88fc8d` (#2196) | Dedupe 192 → 189 items; cc-1.md edited, orphan untouched (now `cc-1.md:50`) |

So the gap is **not a regression** in any recent edit. It has existed in every Austin CC run since v2-trimmed (2026-04-03), and is deterministic: the item can never fire.

## Root cause

`bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/cc-1.md` (origin/main `f191145ec0`):

```
50: - **Cross-reference**: Owner name on application must match owner name shown on tax certificate or warranty deed (CC-1-07).
...
71: | CC-1-06 | Owner authorization signature missing, and no agent authorization letter signed by owner provided (INT-06) | Always | application form | explicit | CC Submittal Checklist, p.1; CC Application, Section 3 | document | fail |
72: | CC-1-08 | Current Tax Certificate missing from submittal (required even if tax-exempt) (INT-08) | Always | tax certificates | explicit | Requirements page, Core Submittal; CC Submittal Checklist, p.1; LDC Title 25 | document | fail |
```

The missing invariant: **every requirement the methodology tells the agent to check must have a checklist row it can report under.** Line 50 tells the agent to check ownership, but no row exists to carry the verdict, and each remaining row (signature present; certificate present) is worded so the agent is right to pass on ownership grounds.

Near-miss: the v2 row compared only the **application** with the **tax certificate or deed**. The city's comment also names the **cover sheet**, and the cover-sheet comparison is the half Noetic could have made on this package. Restoring v2 CC-1-07 verbatim would not have fired here: with no certificate the item has nothing to compare, and CC-1-08 already owns "certificate missing".

## Impact

- **Every Austin CC run since 2026-04-03: affected.** Ownership mismatches between the application, tax certificate/deed and plan-set cover sheet are never reported. ⚠️ This is silent: no log or uncertain verdict, and the agent's correct per-item reasoning hides the gap. A reviewer reading the CC report sees CC-1-06 pass and CC-1-08 pass or fail and has no signal that ownership was not checked.
- **Whitewater (review `28b83857`): partially affected.** The city comment was "caught" only incidentally through CC-1-08's missing-certificate fail. With a certificate in the package, it would have been a clean miss.
- **CC report PDF / cityhall review page: affected through the above.** Nothing renders because no row exists.
- **IG ground-truth comparisons: affected.** City ownership comments map to CC-1-08 on a different reason and get scored as catches.
- **Agent behaviour: low-grade noise.** The orphaned line sends voters looking for a CC-1-07 that isn't in their item list. Here it showed up as one voter's aside under CC-1-06; it can't produce a wrong verdict, only a lost one.
- **The other orphaned references (`cc-19.md:42-43`): same class, lower stakes.** They ask for consistency checks against items that don't exist (DAT-08 FFE in the data table, which the SP1 analysis also found the city asks for).
- **Unaffected:** the CC runbook, conductor, cityhall rendering, substation. This is purely checklist content.

## Fix directions (not yet implemented)

These are directions for the implementing agent, not a mandate. Will chooses between options 1 and 2 (Q1). Option 3 applies either way.

**1. Restore CC-1-07 as a three-way ownership-match item (recommended).**
Row, in cc-1.md's checklist after CC-1-06:
`| CC-1-07 | Owner named on the CC Application does not match the owner on the plan-set cover sheet, or the owner on the tax certificate / general warranty deed (INT-07) | Always | application form, cover sheet, tax certificates | explicit | Requirements page, Documentation & Legal | guideline | fail |`
plus methodology replacing the line-50 cross-reference:
- Compare the application's Section 3 owner with the cover-sheet owner block, and with the tax certificate or warranty deed **when present**. Any pair that disagrees fails.
- A missing certificate is CC-1-08's finding, not this item's. Don't fail CC-1-07 for absence; still compare application ↔ cover sheet.
- Normalize entity-name formatting (LLC / L.L.C., punctuation, case). A different legal entity is a fail; a formatting variant is not.
- An agent/applicant different from the owner is not a mismatch (that is CC-1-06's authorization question).
- The comment should name both owners and where each appears (e.g. "Application: Brezza I35 Holdings LLC; cover sheet Sheet 1 Block 2: NADG LFII DOUBLE CREEK LP").

Why this over folding: it is a **different deficiency with a different fix** (warranty deed or corrected cover sheet, versus a missing signature). The dedupe precedent (bureau#2196) merged only items that check "the same artifact against the same bar". This item has neither the same artifacts nor the same bar as CC-1-06.

Data-file cost, following the #2196 / `231ba8948b` precedent:
- `cc-item-title-mappings.tsv`: add `cc-1:CC-1-07	Owner on the application matches the plan-set cover sheet and the tax certificate or warranty deed`.
- `true-comment-num-mapping.tsv`: insert at 7, **renumber 7–189 → 8–190** (gapless, numeric group order).
- `pape-dawson-comment-num-mapping.tsv`: decide whether it gets a row (external numbering is preserved, per #2196).
- `source-citations.json`: add the item so the next incremental `cc-source-citations` run cites `Requirements page, Documentation & Legal` (label already in `sources/manifest.json`).
- Pinned counts in the guide-items and `test_ccs` tests and the CC README: 189 → 190 items.

**2. Fold the ownership check into CC-1-06 instead.**
Widen CC-1-06 to "Owner authorization signature missing (and no owner-signed agent letter), **or** the owner named on the application does not match the cover sheet / tax certificate / warranty deed", and retarget line 50's cross-reference to CC-1-06.
- *For:* no new ID, no renumbering, a smaller diff (cc-1.md + title mapping + source-citations).
- *Against:* one row carries two unrelated defects. A CC-1-06 fail no longer says which one, the comment has to disambiguate, and the triage/verdict-override history on CC-1-06 now mixes both. IG ground-truth mapping by item ID becomes ambiguous.

**3. Either way: clean up the orphans and add a guard.**
- Remove or retarget the line-50 cross-reference to whichever row now owns the check.
- Fix `cc-19.md:42-43` (FLP-02 / DAT-08 / ENV-24 / CC-17-07 / RSMP-10 / WQD-07/08): retarget to live IDs (CC-19-02 FFE; CC-19-16 prior RSMP) or delete. DAT-08's return is the SP1 data-table question in the IG report and is out of scope here.
- Add a bureau test: every item ID mentioned in a methodology/cross-reference line resolves to a row in the same version, unless the line is a "removed / retired in vX" history note. The scan in evidence item 7 is the prototype.

**Q1 (for Will):** option 1 (restore as CC-1-07, three-way) or option 2 (fold into CC-1-06)?
**Q2:** should a mismatch where a general warranty deed in the package reconciles the owners pass? The city's wording ("otherwise a general warranty deed should be provided") suggests yes.

## Reproduction / verification recipe

1. **The orphan:**
   ```bash
   cd ~/noetic/bureau && git fetch -q origin
   D=jurisdictions/austin/completeness-check
   git show origin/main:$D/v2.7-trimmed/cc-1.md | grep -n "CC-1-07"        # → only the cross-reference line, no row
   git show origin/main:$D/v2/cc-1.md | grep -n "| CC-1-07 |"               # → the original row
   git log --format='%h %ad %s' --date=short -S'| CC-1-07 |' origin/main -- $D   # → 36191bda37 add, a586b2eca9 trim
   ```
2. **The run evidence** (Noetic App Supabase `mgxqsrjutswbciyrltwd`):
   ```sql
   select comment_number, f->>'run' run, f->>'status' st, f->>'observation' obs, f->>'reasoning' rsn
   from review_comments c, jsonb_array_elements(c.output_json->'sourceFindings'->0->'perRunFindings') f
   where review_id = '28b83857-16e2-4a88-a9c3-491a3262ad2d' and comment_number in (6, 7)
   order by 1, 2;
   ```
   Expect CC-1-06 pass ×3, with run-1's observation naming both owners; CC-1-08 fail ×3 (no certificate).
3. **The city ground truth:** City CC Certification Letter for SP-2026-0216C.CC, page 3, second SP1 comment (quoted under Symptom). Local copy at `~/noetic/tmp/White-Water-Carwash-Completeness/Completness Check Certification Letter.pdf`; mapping in the IG report above.
4. **Acceptance test for the fix:** re-run CC (v2.7-trimmed after the fix) on the Whitewater U0 submission (`38ddbfd8-…`). Pass if the owning row (CC-1-07 under option 1, CC-1-06 under option 2) **fails on every voter** with a comment naming Brezza I35 Holdings LLC (application) and NADG LFII DOUBLE CREEK LP (cover sheet Sheet 1 / Sheet 8), **and** CC-1-08 still fails only for the missing certificate. Negative check: a submission where application and cover-sheet owners agree (e.g. the 2008 San Antonio St CC review `0bc96434-934e-4b3b-bdca-1094ff486b6b`, if they do agree there; verify first) must pass the owning row.
5. **Guard test (option 3):** the new bureau test fails on the pre-fix tree (catches `cc-1.md:50` CC-1-07 and `cc-19.md:42-43`) and passes after.
