# U1 MCR comment rounds are flattened: resolved and superseded U0 text becomes live CRC checklist items

> **Status:** Diagnosed 2026-09-18. Fix **not implemented**. The 16 affected failed items on review `ccd1048e` were hand-triaged to `resolved` in `comment_triage`, with the note "Stale u0 comment, no longer applicable". The guides themselves (crc-guides gen `7/1`) are **not** corrected.
>
> **Root cause:** `claude-plugins` → `generate-crc-guides` (the Phase-2 extract prompt and the Phase-3 status filter). The runbook `bureau` → `process-city-response-docs` (MCR worker) does not pass the MCR's update cycle to the skill.
>
> **Discovered:** by Will while reading CRC review [`ccd1048e`](https://app.noeticbuild.com/project/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/review/ccd1048e-8772-4867-924a-66a8db3f41ad) (Lamar + Collier, SVN8 run 8). The first hint was Fire items failing on comments the city had struck through.
>
> **Full audit:** IG report [`2026-09-18-crc-stale-u0-items-lamar-collier-svn8`](https://inspector-general-gamma.vercel.app/reports/view/2026-09-18-crc-stale-u0-items-lamar-collier-svn8/). It has a per-item ledger for all 170 items, with the MCR rounds as printed, crops and rulings.
>
> **Related:** `workspaces/city-response-docs/preprocessing/DESIGN-SPEC.md` (the runbook spec).
>
> **It looks like a CRC bug, but it isn't one.** The CRC agent checked the plan set faithfully against the items it was handed. The items were wrong before CRC ever ran.

## Summary

From U1 onward, the City of Austin MCR is a **comment history**, not a list of comments. Each comment keeps every round, and the most recent round comes first:

```
F1 – Current Status: Resolved
   ● U1: Comment resolved
   ● U0: The width of the fire lane turnaround appears to be less than 25ft. …   ← struck through in the PDF
```

`generate-crc-guides` was designed and tuned against the **U0** MCR, which has one round per comment. There, dropping the `U0:` marker was harmless. Its extract prompt tells the model to strip the `U0:` / `U1:` markers ("a cycle marker, not part of the requirement") and join the comment into one `body`. Against a U1 MCR, that turns the history into a single requirement. Decomposition then splits every U0 sub-ask into its own atomic item, including sub-asks the city has since resolved, dropped, narrowed away, or redirected to a waiver. Two smaller gaps compound this:
- the status filter doesn't recognise `Resolved`, and under `--defer-uncertain` it keeps those comments as Pending;
- `pdftotext` can't see the strikethrough the Fire reviewer used to retire U0 text.

On the Lamar + Collier U1 MCR, **54 of the 170 MCR-derived items (32%) carry stale U0 content, and 39 of them should not exist at all**. **23 of the 120 MCR-derived failed verdicts are false fails that come only from stale content**, and another 15 fails are partly stale. The same flattening also **drops the new U1 asks**: 15 things U1 requires (mostly waiver packages and AEC letters) have no item that checks them.

**Working correctly (don't touch):**
- **CRC workflow / conductor:** it verified each item against the plan set exactly as written.
- **The Phase-3 drops:** every comment dropped as Cleared, Informational, FYI or not plan-verifiable was checked, and none was a still-open, checkable ask.
- **Department classification, severity, plan-verifiability and enrichment:** these are correct for the text they were given.
- **Discovery (`discover.ts`):** it already resolves `city_submission_number` correctly. The value just never reaches the skill.

**Root cause in one sentence:** nothing in the runbook→skill chain knows which update cycle an MCR belongs to, and the extract prompt tells the model to throw away the only in-document signal (the `U0:` / `U1:` markers) that would reveal it.

## The bug in one diagram

```
 process-city-response-docs (bureau)                        generate-crc-guides (claude-plugins)
 ─────────────────────────────────                          ─────────────────────────────────────
 discover.ts
   version_number        = 7         ✓
   city_submission_number = 2  (→ U1) ✓ ──► ADDENDUM.md "SP-2026-0136C (Update U1)"  ✓
                                             │
 mcr-worker.md:5,17-19                       │  ✗ cycle NOT forwarded
   --project-id --submission-version-id      ▼  (no --update-cycle / --mcr-cycle flag exists)
   --versioning=bump --defer-uncertain ──────────────────────────►  Phase 2  extract-comments.md:53
                                                                     "Strip the U0:/U1: body prefix"
   MCR text (pdftotext -layout) ──────────────────────────────────►  ┌──────────────────────────────┐
   F1 – Current Status: Resolved                                     │ body = "Comment resolved     │
     ● U1: Comment resolved                                          │   The width of the fire lane │ ✗ rounds
     ● U0: ~~The width of the fire lane…~~  ← strike lost ✗          │   turnaround … 25 ft …"      │   merged
                                                                     └──────────────┬───────────────┘
                                                                                    ▼
                                                                     Phase 3  status-filter.md:18
                                                                     "Resolved" ∉ vocab → status:unknown
                                                                     --defer-uncertain → keep as Pending ✗
                                                                                    ▼
                                                                     Phase 4/5 decompose (correct ✓ for
                                                                     its input) → F-1 "25 ft wide, 14 ft
                                                                     vertical clearance"
                                                                                    ▼
                                                                     crc-guides/…/7/0 → carried to 7/1
                                                                                    ▼
 CRC workflow (correct ✓) checks the U1 plan set against F-1 ──► FAILED   ← false fail, city already resolved it
```

The same path produces the subtler cases. Where the comment is still **open** but U1 narrowed the ask, every U0 sub-ask still becomes an item:

```
SP9 – Pending
  U1: Add proposed height for Tract 1 and Tract 2. Correct the Maximum FAR …      ← the live ask
  U0: Provide separate site data tables … site area, zoning, use(s), units, height,
      building coverage, impervious cover, GFA, and FAR.                           ← superseded
                     │ merged + decomposed
                     ▼
  SP-9.1 height ✓  SP-9.2 FAR ✓  SP-9.3 "full site data table fields" ✗ → CRC FAILED on missing zoning/coverage in TOTAL row
```

## Symptom (as observed)

- **Project** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` ("Lamar + Collier"); **submission** `cf1201c2-2e8b-4034-9a5e-a70b6317e39a`.
- **Submission version 7** (`0e308099-7304-42e2-93a3-e5007af2e73c`), `city_submission_number = 2`, which is the city's **U1** review.
- **MCR:** `document` `f639c569-4949-45e1-8179-272ada1ec11a` / `document_version` `4008f1ba-5623-4375-9340-bb9309fddcaa`, file `1700 S Lamar u1 MCR.doc.pdf` (51 pp, sha256 `8142e074…d9c2a6`). The PDF header reads `Update: U1`.
- **Processing:** `city_response_processing_run` `71ae6262-295e-4a89-92bf-437588fa25f2` (runbook `3b91551`, skill `d8c82e2`) produced crc-guides gen `…/7/0/`. That was carried forward into gen `…/7/1/` by run `c94f2ad4` (the ACE memo).
- **CRC review** `ccd1048e-8772-4867-924a-66a8db3f41ad` (label `2026-09-17-svn8-u1-crc-run8-winstlocal`, bureau `5239e1e7`) has 173 items (170 from the MCR plus 3 from the ACE memo): 122 failed, 51 resolved.

**What Will saw:** Fire items F-1, F-3, F-4, F-5.1 and F-5.2 failed. The MCR marks every Fire comment *Resolved*, with the U0 text struck through. Will manually overrode those items to resolved, and many others besides.

**Tempting but wrong first guesses:**
- *"CRC hallucinated a failure."* It didn't. For F-1, CRC correctly reported that the plan does not show what F-1 asks for. The item should never have been asked.
- *"It's only a Fire problem, caused by the strikethrough."* Strikethrough explains only F1–F6. The dominant failure mode is a still-**Pending** comment whose U1 round narrows or redirects the U0 ask (SP, DE, AWRR, CA, WQ, APR, TPW, LDE). The text layer carries those rounds perfectly well, and the prompt deliberately merges them.
- *"The run's HITL caught it."* It flagged part of it. `hitl/readout.md:33-34,47` lists F1–F6 as `status:unknown (source status "Resolved")` and describes keeping them as "conservative". The operator accepted that default, and `hitl/decision.md` records "F1–F6 'Resolved' cluster was left as kept-and-flagged". Nothing surfaced the narrowed-but-pending comments, because they pass the status filter cleanly.

## Evidence chain

1. **The U1 MCR is a round history, not a comment list.** The text layer has 147 `U0` lines, 185 `U1` lines and 1 `U2` mention. A vision pass over all 51 pages produced 219 comment records with verbatim rounds. **Most open comments print `U1:` first, then the original `U0:` text below it.** Layouts vary by department: `SP27 - Current Status: Pending / U1: … / U0: …`; `TPW 3: Comment Status: Pending` with the original text unlabeled and `U1:` appended; `EV 07- EV 15 U1: All landscape comments pending` covering nine comments at once; and DE 3, whose `U1 :` bullet is empty while its real U1 text sits on the next, unlabeled bullet.

2. **The pipeline merged the rounds with the markers removed.** `source-map.json` in crc-guides gen `7/1` stores the text each parent was decomposed from. **The stored text for `F-1` is `"Comment resolved The width of the fire lane turnaround appears to be less than 25ft. Fire Department access roads must be a minimum of 25 ft wide with a minimum of 14 ft vertical clearance."`**, which is the U1 and U0 text run together. `SP-27` is `"The overall AEC approach appears to be reasonable. … 75% of the net frontage length of the property along the CTC must consist of continuous building façade …"`, and `TPW-3` is `"… dedicate 58 feet of right-of-way … Please submit a waiver request from ROW dedication through the KNACK portal."` The prompt asked for exactly this (see Root cause).

3. **"Resolved" was kept as Pending, and the run recorded it.** gen `7/1` `decisions.md` contains: **"F1 — kept-and-flagged, treated as Pending (was status 'Resolved')"**, with the same line for F2–F6. `status-filter.md:18` lists "Resolved" as an unknown term, and `--defer-uncertain` means unknown statuses are kept.

4. **Strikethrough is real, confined to Fire, and invisible to the text layer.** 300 dpi crops of p.26–27 show **the whole U0 bullet struck through on F1–F6**, including the `U0:` label and the Reference line. On F2 the strike continues across the page break. A visual sweep of all 51 pages found no strikethrough anywhere else. `pdftotext -layout` shows the struck text as ordinary text. A related case: in SP32, the reviewer **highlighted** only part c), the one clause still required, and that signal is lost the same way.

5. **This is not "the model misread a few comments": it is systematic, it follows the round structure, and it touches 10 departments.** Every one of the 170 items was ruled on against the per-comment ground truth:

   | Mechanism | Items | False fail | Partly stale fail | Stale pass |
   |---|---:|---:|---:|---:|
   | Resolved + struck (F1–F6) | 9 | 5 | 0 | 4 |
   | Resolved, header conflict (CM 13: header says Pending, U1 says "Acknowledged. Thank you…") | 1 | 0 | 0 | 1 |
   | U0 sub-ask dropped in U1 (SP-9.3, WQ-3.1, AWRR-3.1/3.3/3.6, CA-05.4, SP-32.1 …) | 21 | 14 | 0 | 7 |
   | U1 redirected the ask to a process step: waiver, KNACK, AEC or pending decision (TPW-3, DE-19/21, LDE-1.1, APR-5, SP-27.2, SP-29, DE-6) | 8 | 4 | 2 | 2 |
   | Partly stale (valid ask plus stale U0 condition) | 12 | 0 | 11 | 1 |
   | Unclear (U1 wording supports either reading) | 3 | 0 | 2 | 1 |
   | **Total** | **54** | **23** | **15** | **16** |

   By department: SP 16, DE 13, F 9, AWRR 4, APR 3, CA 3, WQ 3, CM 1, LDE 1, TPW 1.

6. **The failures are not random: the valid items are clean.** The 116 items rated VALID come from comments where U1 keeps the U0 ask open ("Comment remains", "Pending submittal of architectural and landscape sheets", or the sheets-44–69-missing cases), or that are new in U1 (PB1–3, F8, AW1, WQ 16). **Every stale item traces to a round the pipeline merged or a formatting signal it could not see.** None traces to a misread of a single-round comment.

7. **The cycle was known to the runbook and never used.** `discover.ts:173-174` emits `version_number: 7, city_submission_number: 2`. The run's `ADDENDUM.md:15-16` records `city_submission_number | 2` and `case_number | SP-2026-0136C (Update U1)`. **`mcr-worker.md:5` hands the worker `{project_id, submission_version_id, jurisdiction_slug}` and the versioning intent, but not the cycle.** The skill has no parameter that could receive it (`mcr-worker.md:17-19`).

## Timeline

| When | What | Relevance |
|---|---|---|
| ≤ 2026-09-01 | `generate-crc-guides` built and tuned on **`1700-S-Lamar-U0-MCR.pdf`** (see `references/output-format.md:222` and `references/source-pdfs-metadata.md:44`). Crc-guides gens 0–6 for this project live under **version 4** (city submission #1, the U0 MCR). | On a U0 MCR each comment has one round, so stripping `U0:` is lossless. **The invariant "one round per comment" held for every input the skill had seen.** |
| 2026-09-01 | `9ea95ae` (#226) prunes noetic-tools. The strip instruction and the status vocabulary already exist at that point. | Not a regression. The behaviour is original to the skill. |
| 2026-09-04 | Runbook `process-city-response-docs` specced (winston `city-response-docs/preprocessing/DESIGN-SPEC.md`). It invokes the skill "in place" with non-interactive flags. | The runbook inherits the skill's U0 assumption and adds `--defer-uncertain`, which turns unknown "Resolved" into kept-as-Pending. |
| 2026-09-16 | **First U1 MCR processed** (run `71ae6262`, gen `7/0`). The readout flags F1–F6 "Resolved" but calls keeping them conservative, and the operator publishes. | **This is where the corruption enters.** |
| 2026-09-17 | CRC review `ccd1048e` runs against gen `7/1`. | This is where the corruption surfaces, as false fails. |

Corollary: this is **deterministic for any MCR at U1 or later**, not flaky. It is not a regression from recent runbook work. The runbook is simply the first thing to feed the skill a non-U0 MCR.

## Root cause

**1. The extract prompt explicitly discards the round structure.** `claude-plugins/plugins/noetic-tools/command-packs/generate-crc-guides/prompts/extract-comments.md` (at `c01cd4e`):

```
19:  "body": "...",                 // body text, with leading "U0:" / "U1:" prefix stripped
…
53: All three are valid. Strip the `U0:` / `U1:` body prefix when present — it's a cycle marker, not part of the requirement.
…
57: … **Before searching for the `U0:` prefix, strip leading whitespace plus these characters from the body** …
```

The output schema has one `body` string per comment and nowhere to put rounds. `decompose-comment.md` then assumes a single-round body. Its examples all start `body: "U0: …"`, and line 192 says "use the whole substantive sentence(s) of `body` — typically everything after the "U0:" prefix".

**2. The skill's model of the world is "U0 MCR in, U1 plan set checked".** `SKILL.md:18`:

```
Produces the per-department checklist guides that the CRC Conductor workflow consumes to verify whether a
resubmitted (U1) plan set resolves the comments the city raised in the original (U0) Master Comment Report.
```

This hard-codes U0 as the MCR and U1 as the plan set. There is no concept of "the MCR is U*n*; check the U*n*+1 plan set against the **latest** round".

**3. The status vocabulary treats "Resolved" as unknown, and the non-interactive default keeps it.** `references/status-filter.md`:

```
 8: - **`Pending`** — comment was raised at U0 and not yet resolved (the dominant case).
13: - **`Cleared`** — city explicitly marked resolved. Not a CRC concern.
18: Anything else — case-mismatched typos, unfamiliar terms ("Updated", "Resolved", "Hold"), missing status. Bucket as `category: "status:unknown"`.
```

"Resolved" is named as an example of an unknown term. `--defer-uncertain` then keeps it and flags it as Pending, which is **the fail-open direction**.

**4. The runbook does not carry the cycle across the boundary.** `bureau/runbooks/process-city-response-docs/prompts/mcr-worker.md:5,17-19`: the worker gets `project_id`, `submission_version_id`, `jurisdiction_slug` and the versioning intent. It passes `--project-id --submission-version-id --versioning=bump --defer-uncertain` and nothing that says "this MCR is U1".

**5. Text-only extraction can't see reviewer formatting.** Strikethrough (F1–F6) and highlighting (SP32) are drawing-level signals. `pdftotext -layout` drops them. Neither the skill nor the runbook has a formatting or vision check on comment bodies.

**Missing invariant:** *an item may only encode what the city requires as of the MCR's latest round.* The pipeline has no representation of rounds, so nothing can enforce this.

**Near-miss:** the `hitl/readout.md` operator note already said "if 'Resolved' here means the city considers those comments closed, they may be over-included". The signal reached the human, but it was framed as the safe default, and it covered only the six Fire comments, not the other 44 stale items, which come from narrowed-but-still-pending comments.

## Sample request/response (real, abridged)

**Phase 2 input** (pdftotext, p.35):

```
SP27 - Current Status: Pending
    U1: The overall AEC approach appears to be reasonable. Full evaluation will require submittal of a
     formal AEC request letter and submittal of the complete architectural and landscape plans sheets. …
    U0: 75% of the net frontage length of the property along the CTC must consist of continuous building
     façade built up to the clear zone, or the supplemental zone if one is provided. …
     Reference: Sub E Sec. 2.2.2.D.1
```

**Phase 2 output, as stored in source-map `SP-27.verbatim_text`.** The rounds are merged and the markers are gone:

```
"The overall AEC approach appears to be reasonable. Full evaluation will require submittal of a formal AEC
 request letter … A separate AEC Sheet may be helpful. 75% of the net frontage length of the property along
 the CTC must consist of continuous building façade built up to the clear …"
```

**Phase 4 decompose output → CRC:**

```
SP-27.1  (derived from the U1 sentence fragments)                               CRC: failed
SP-27.2  "≥75% of CTC net frontage is continuous façade built to the clear zone"   ← U0 standard; U1 redirected
                                                                                  it to a formal AEC request   CRC: resolved (stale pass)
(no item) "formal AEC request letter + complete architectural/landscape sheets submitted"   ← the live U1 ask: COVERAGE GAP
```

## Impact

| Consumer / surface | Effect |
|---|---|
| **CRC verdicts (review `ccd1048e`)** | ⚠️ **Affected.** 23 false fails, plus 15 partly-stale fails, out of 120 MCR-derived fails. These tell the applicant to redo work the city already accepted. Examples: F-1 (fire lane width), SP-9.3 (full site data table), WQ-3.1 (centered water-quality hatches), and TPW-3 (dedicate right-of-way, when the city only asked for a waiver request). |
| **CRC coverage** | ⚠️ **Affected, silently.** 15 U1 asks have no item: the DE 8/19/20/21 waiver packages, the LDE-1 and TPW-3 waivers, the SP27/SP29 AEC requests, APR3's DB90 letter, the SP5 draft UDA, SP36's ADA path of travel, and AWRR2's meter demand sheet. **CRC can report a department clean while the city's actual U1 ask is outstanding.** |
| Stale passes | Partly affected. 16 stale items passed. The verdict is unharmed, but they add noise to the applicant-facing report. |
| crc-guides gen `7/1` (bucket) | Affected. It is the source CRC reads (`fetch-crc-guides.ts` reads the highest gen), so every future CRC run on v7 inherits the bad items until a corrected gen is emitted. |
| `comment_triage` on `ccd1048e` | Patched by hand. 16 rows were inserted 2026-09-18 (`verdict_override=resolved`, note "Stale u0 comment, no longer applicable"). The earlier manual overrides already covered F-1, F-3, F-4, F-5.x, DE-26.2 and AWRR-3.1/3.3/3.6. **Re-running CRC resets this**, because triage is per review. |
| U0 MCRs (city_submission_number = 1) | **Unaffected.** They have one round, so stripping is lossless. That is why this went unnoticed through gens 0–6 on v4. |
| Redlines path (`generate-crc-guides-from-redlines`) | Not audited here. Redline PDFs can carry U0 and U1 markups too, so assume **possibly affected** until checked. |
| Misc path (`generate-crc-guides-from-misc`) | Unaffected. Memos have a single round. |

- **Deterministic:** yes, for every MCR at U1 or later.
- **Logged:** only the "Resolved" subset appears in `decisions.md` and the readout, framed as a safe default. **The narrowed-but-pending majority fires silently.**
- **Cheap detector (worst case):** for each parent in `source-map.json`, flag any whose MCR comment has two or more round markers (`/\bU\d+\s*:/` appearing twice or more in the comment's raw text span), or whose header status matches `/resolved|cleared/i`. On this MCR that flags every parent behind the 54 stale items. It also flags parents whose U1 keeps U0 open, so treat it as a review queue, not an auto-drop.

## Fix directions (not yet implemented; directions for the implementer, not a mandate)

1. **Make the pipeline aware of the update cycle end to end (the principled fix).**
   - **Runbook:** in `mcr-worker.md`, pass the cycle to the skill, for example `--mcr-cycle U<city_submission_number-1>`. Cross-check it against the PDF header (`Update: U1` on page 1) and fail loudly if they disagree. Note the off-by-one: `city_submission_number = 2` is the **U1** MCR.
   - **Skill Phase 2:** change `extract-comments.md` to emit `rounds: [{label: "U1", text}, {label: "U0", text}, …]` instead of a merged `body`. **Delete the "strip the U0:/U1: prefix" rule.** Handle the layouts seen here: labeled rounds in either order, unlabeled original text plus appended `U1:`, grouped ranges (`EV 07- EV 15 U1: …`), and an empty `U1 :` bullet followed by an unlabeled continuation (DE 3).
   - **Skill Phase 3+:** derive the **effective ask** from the latest round.
     - If the latest round resolves the comment ("Comment resolved", "Comment cleared", "Acknowledged"), drop it.
     - If it keeps U0 open ("Comment remains", "Pending submittal of X", "not addressed"), decompose U0, with U1 as context.
     - If it narrows or redirects the ask, decompose **only** the latest round and pass U0 as context, never as items. **A process step the city asks for (a waiver request, a KNACK submittal, an AEC letter) is itself the item.**
   - **Store the rounds in `source-map.json`** so audits like this one become a query.
   - **Update `SKILL.md:18`:** the MCR is U*n*, and items encode the latest round.

2. **Status vocabulary (cheap, do it regardless).** Add `Resolved` and `Cleared, FYI` to the drop set in `status-filter.md`. Also treat a header that conflicts with the latest round (header Pending, U1 "Acknowledged…") as a **blocking** pre-flight question, not a keep-and-flag default. Under `--defer-uncertain`, a `status:unknown` whose latest round text matches a resolution phrase should drop, not keep. The current default fails open.

3. **Formatting-aware extraction.** Detect strikethrough and highlight per comment span:
   - either from PDF drawing operators (pdfplumber `lines`/`rects` crossing the vertical midline of `chars`; yellow fill `rects` behind `chars`),
   - or with one cheap vision check per comment block that has more than one round.

   Drop struck spans. Treat a highlighted span as the scope of the remaining ask (SP32 c).

4. **Detection and repair for already-emitted guides.**
   - Run the detector above over every crc-guides gen produced from a `city_submission_number ≥ 2` MCR. Today that is only `…/7/0` → `…/7/1`.
   - Re-generate v7 as gen `7/2` with the fix, then re-run CRC for SVN8.
   - **Repair hazard:** atomic item IDs (`SP-9.3`, …) will shift or disappear. `comment_triage` rows and any report citations key on `review_comment_id` of the *old* review, so they won't carry over. A re-run CRC produces a new review, and the 42 triage rows on `ccd1048e` stay attached to the old one.

5. **Readout wording.** `hitl-readout.md` should describe a kept `status:unknown` as **"possibly over-included"**, not "conservatively kept". It should also report a count of multi-round comments and how many items came from a non-latest round.

## Reproduction / verification recipe

Everything below is on prod (`mgxqsrjutswbciyrltwd`), read-only. Audit working files are in `~/noetic/tmp/crc-u0-audit-lamar-collier/` (`vision_all.json` = 219-comment ground truth, `final.json` = 170 item rulings).

```bash
U=$PUBLIC_SUPABASE_URL; K=$SUPABASE_SERVICE_ROLE_KEY; H=(-H "apikey: $K" -H "Authorization: Bearer $K")
# 1. The version is city submission #2 (= U1)
curl -s "$U/rest/v1/submission_version?id=eq.0e308099-7304-42e2-93a3-e5007af2e73c&select=version_number,city_submission_number" "${H[@]}"
# 2. The MCR itself
curl -s "$U/storage/v1/object/submission-data/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/city-response/0e308099-7304-42e2-93a3-e5007af2e73c/bbd33554-0b53-40fd-ab27-4425b92d0d37/1700_S_Lamar_u1_MCR.doc.pdf" "${H[@]}" -o mcr.pdf
pdftotext -layout mcr.pdf - | grep -nA3 '^F1 –'        # → "U1: Comment resolved / U0: The width of the fire lane…"
pdftoppm -r 300 -f 26 -l 27 -png mcr.pdf fire           # → look: U0 bullets of F1–F6 struck through
# 3. What the pipeline extracted
P=23301a8a-4cdb-4751-ac0c-93b97f0f5c12/cf1201c2-2e8b-4034-9a5e-a70b6317e39a/7/1
curl -s "$U/storage/v1/object/crc-guides/$P/source-map.json" "${H[@]}" \
  | jq -r '.parent_comments[] | select(.id=="F-1" or .id=="SP-9" or .id=="TPW-3") | "\(.id): \(.verbatim_text)"'
curl -s "$U/storage/v1/object/crc-guides/$P/decisions.md" "${H[@]}" | grep Resolved
```

**Unambiguous acceptance cases for the fix** (re-run the skill on this MCR and check the emitted items):

| MCR comment | Expected after fix |
|---|---|
| F1–F6 (header Resolved, U1 "Comment resolved", U0 struck) | **No items** |
| CM 13 (header Pending, U1 "Acknowledged. Thank you…") | No item, or a blocking pre-flight question; never an item carrying case number `SP-2026-0107C` |
| SP9 | Items only for Tract 1/2 height and max FAR; **no** full site-data-table item |
| SP32 | One item: the screening-materials note (part c); no a)/b) items |
| TPW 3 | One item: ROW-dedication waiver request submitted via KNACK; **no** "dedicate 58 ft ROW" item |
| DE 19 / DE 21 | Items for the DCM 5.7.0 waiver package and the horizontal-clearance waiver request |
| WQ 3 | Only the "≥1 4'×6' detention-basin hatch ≥5 ft from each wall" item; no centered water-quality-pond hatch item |
| AWRR3 | Only the collection tank location and distribution lines (U0 items 4–5); no NP meter / RPZ / cistern-note items |
| SP27 / SP29 | Formal AEC request (plus architectural and landscape sheets); no 75%-frontage / 30-20 ft supplemental-zone items |
| EV 07–15, CA13/16–22 (U1: pending because sheets 44–69 were missing) | U0 asks **retained** (regression guard: don't over-drop) |
| PB1–3, F8, AW1, WQ 16 (new in U1) | Items present |

A U0 MCR (v4's `1700 S Lamar U0 MCR.pdf`) should produce **identical** output before and after the fix.
