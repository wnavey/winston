# A city-written document filed as an applicant document: AGENTS-core rule 19 bars it, preprocessing reads it anyway (sometimes), and the reading layer already holds it

> **Status:** diagnosed 2026-09-28, **not fixed. Deliberately left in place** so a re-run reproduces it (Will, 2026-09-25). This doc is the input to a brainstorming session on a robust solution, not a fix plan.
> **Root cause lives in:** the *data*, not in any one runbook. City-authored documents are stored as ordinary applicant documents (`document.kind = 'document'`), so every consumer that trusts `kind` treats the city's review comments as part of the applicant's submission. Bureau's rule 19 (`runbooks/lib/AGENTS-core.md:37`) is the only thing that notices, and it notices by model judgement.
> **Discovered on:** four `preprocessing-v4` (PPv4) cloud runs on **Valley View Townhomes** (project `63cead15-41f8-418c-b0ef-bd5c2b44719a`), submission `8fea702d-952c-4aa0-ab00-f848d8abf5b6`, `version_number` 3 (`submission_version` `31d7c595-39de-47ed-b7b7-a108d1b03e20`), 2026-09-24 → 2026-09-28.
> **It presents as** a PPv4 reader failing its contract, or as a captain escalation asking "may this document be read?". **It isn't a PPv4 bug.** PPv4's staging filter, its reader and its contract each do what they were written to do. The contradiction is between them, and the data feeds it.
> **Related:** the captain escalation fixes it surfaced (bureau#1806, cityhall#703; follow-ups bureau#1807, #1857, conductor2#116, substation#315); the cloud-publish spec `workspaces/runbook-checkpoints/cloud-publish/DESIGN-SPEC.md`; the City Response Documents feature, `bureau/runbooks/process-city-response-docs/README.md`.

---

## Summary

Two documents in Valley View's submission were **written by the City of Austin, not the applicant**:

| `document_version` | Name in the app | File | Author |
|---|---|---|---|
| `470cf1b7-8976-4728-aaa1-c91b2bbb07ea` | Completeness Check Results | `SP-2025-0126C_Completeness Check Update 1 Response_4666.pdf` | City of Austin DSD, completeness-check reviewers' comments |
| `83016f09-2906-47f1-9272-9d80d2219f19` | Master Comment Report | `U1 MCR.pdf` | City of Austin DSD, the Update-1 Master Comment Report |

Both are stored as `document.kind = 'document'` with `city_response_type = NULL`, i.e. exactly like an applicant filing. They were uploaded into `version_number` 1 on 2026-04-07 and are linked (`submission_document`) to versions 1, 2 **and** 3.

Bureau's constitution, `runbooks/lib/AGENTS-core.md` rule 19, bars "**the jurisdiction's own review comments on this case**" from every runbook agent, because "every accuracy number Noetic publishes rests on this bar" (rule 20). **In the same sentence** it says "the submission package itself, every sheet and document the applicant filed, is the subject of the run and always in bounds." A city document linked into the applicant's package is *both*, so the rule contradicts itself on exactly these files, and the model reading the document has to break the tie.

It breaks it differently each run. Across four PPv4 runs the two documents were read, refused, read, and refused-then-ruled-readable (§Symptom). When the reader refuses, the PPv4 documents contract fails the refusal (it requires verbatim content), the run parks, and a human has to rule. When it reads, the city's comments are transcribed verbatim into the run's artifact.

**The part that should change the framing of any fix:** for these two documents the reading layer **already holds the city's comments.** `document_section` has 6 rows for `470cf1b7` and 15 for `83016f09`, written on 2026-04-07 at 16:59 by the automatic upload-time transcription, with `preprocessing_run_id = NULL`. And bureau's **review** runbook stages those sections for any review of these submission versions, filtering only on the same `kind` (§Evidence 8). So PPv4's refusal protects nothing here; the bar rule 19 describes is already broken one layer up, silently.

What is working correctly, so nobody rips it out:

- PPv4 `1.2-stage` **already excludes city documents that are correctly marked** (`kind = 'city_response'`), with a comment saying why (`stage.py:227-230`).
- The **City Response Documents** feature exists and is the designed home for these files (`kind='city_response'`, `city_response_type ∈ {mcr, redlines, misc}`, attached to the city's own submission version, processed by `process-city-response-docs` into CRC guides).
- The reader's refusal is **correct under rule 19 as written**, and the contract's failure is **correct under its own rule** ("the inventory carries the document, not a description of it").
- Since bureau#1806 the captain turns the resulting failure into an answerable decision card with options, and since #1857 it no longer offers adopted items as re-run buttons. The escalation path works; what it escalates is a policy question nobody has answered.

**Root cause in one sentence:** nothing in the data says who wrote a document, so rule 19, which depends on authorship, is enforced by the reading model's guess on each run, and every deterministic consumer (PPv4 staging, review staging, the app) treats the city's comments as applicant evidence.

---

## The bug in one diagram

```
 UPLOAD (2026-04-07)                       STORED AS                          CONSUMERS (all trust `kind`)
 ──────────────────                        ─────────                          ───────────────────────────
 applicant files ─────────┐
                          ├──► document(kind='document') ──┬──► submission_document ──► v1, v2, v3 of 8fea702d
 city's MCR + CC results ─┘     city_response_type = NULL  │
      (city-authored)      ✗ authorship lost here          │
                                                           ├──► upload-time transcription (16:59, same day)
                                                           │      └─► document_section: 15 (MCR) + 6 (CC)   ✗ city comments
                                                           │          preprocessing_run_id = NULL              now in the
                                                           │                                                   reading layer
                                                           │
                                                           ├──► PPv4 1.2-stage  stage.py:230
                                                           │      kind ∈ {document, drainage-model} ✓ passes (it "is" a document)
                                                           │      └─► 2.3-documents/read  (prompt: "one document the APPLICANT filed")
                                                           │            model applies AGENTS-core rule 19 by judgement:
                                                           │              read   → verbatim city comments in artifact.json  ✗ (rule 19)
                                                           │              refuse → contract.test.ts:55 "≥50% sections have content" ✗
                                                           │                       → 3 retries → captain escalation → human rules
                                                           │
                                                           ├──► review 1.2-stage-submission  stage_submission.py:975
                                                           │      submission_db.document_versions() → kind filter ✓ passes
                                                           │      └─► db.document_sections() → supplementary-docs/<slug>/  ✗ the review
                                                           │                                                               reads the city's
                                                           │                                                               own comments
                                                           │
                                                           └──► app / cityhall: listed as an applicant document

 THE DESIGNED PATH (unused for these two):  document(kind='city_response', city_response_type='mcr'|'redlines'|'misc')
   on the CITY's submission_version  ──► PPv4 skips it ✓ · review skips it ✓ · process-city-response-docs → CRC guides ✓
```

---

## Symptom (as observed)

Four PPv4 cloud runs, identical request (`version_number` 3, `submission_id` `8fea702d…`, `publish.allowed: true`), same submission, same two documents:

| Run | Created | `470cf1b7` Completeness Check Results | `83016f09` Master Comment Report | What followed |
|---|---|---|---|---|
| `7025a6b3-ace3-4a3a-b9af-b7e5e16a78d5` | 2026-09-24 | read, passed | read, passed | died at `4.1-publish` (service-role lane; led to the cloud-publish spec). Cancelled. |
| `4de659aa-7918-4758-934b-9aa51d3c8a01` | 2026-09-24 | **refused**, failed its contract 3×; `harness_tail`: *"Getting that text means reading pages the run rules forbid: the city's review comments on the case and the applicant's response to them."* | read, passed (56 s, $0.40) | captain escalation *"A human must decide whether 'Completeness Check Results' (470cf1b7) is a filed document that may be read or barred review correspondence under AGENTS.md rule 19"* on a dead `operator` card, which led to bureau#1806 / cityhall#703. Cancelled. |
| `4724ded1-4f5e-471a-a770-bea8630b6d2f` | 2026-09-25 | read, passed | read, passed | died at `4.1-publish` on an import bug (bureau#1807). Cancelled. |
| `378a9792-a274-46ba-9756-8cf48c946c52` | 2026-09-25 | read, passed | **withheld**, failed | captain decision card (09-25 18:42): *"Document 83016f09 ('Master Comment Report') is the jurisdiction's review comments, which the rules bar, but the applicant filed it, which makes it in bounds. The reader withheld it on purpose, so a human must rule…"* → Will's ruling (below) → the captain edited the run's copy of `read/prompt.md`, asked for approval of the edit twice, Will kept it (09-28 15:32), all 10 documents passed. Parked later on the publish token (fixed by conductor2#116 + bureau#1857 + substation#315). |

**Will's ruling on `378a9792`** (decision on the 09-25 18:42 card, `status: other`, 19:09):

> "Ignore the AGENTS-core.md rule about guarding against processing "answers". This is a real city MCR, and we need to pre-process it . please continue with preprocessing-v4, and do so on the "Completeness Check Results""

That is the only standing human position on record, and it applied to **one run's copy** of the reader prompt. Nothing on `main` encodes it.

**Tempting first guesses that don't survive the data:**

- *"The contract is too strict."* Relaxing the ≥50%-content check would make the refusal pass, and the run would then publish an empty inventory for a document the review stage still reads the old sections of. It hides the symptom and leaves the leak.
- *"The reader should just follow the rule."* It does. The rule says both "bar the city's comments" and "the applicant's filings are always in bounds", and these files are both. Four runs, four model calls, three different outcomes.
- *"PPv4 should filter city documents out."* It already does (`stage.py:230`), by `kind`. The kind is wrong.
- *"It's a Valley View one-off."* It isn't (§Evidence 10).

---

## Evidence chain

1. **Rule 19 contradicts itself on a city document inside the applicant's package.** `bureau/runbooks/lib/AGENTS-core.md:37` (quoted whole):
   > 19. Two capabilities are barred outright, by any route: **any prior Noetic output about this project or property** (…) and **the jurisdiction's own review comments on this case** (its case file, its permit attachments, its staff report, and the applicant's comment-response letter, which quotes the comments it answers). Case identity and status rows are fine. The submission package itself, every sheet and document the applicant filed, is the subject of the run and always in bounds.

   `:38` (rule 20): "Every accuracy number Noetic publishes rests on this bar … Where a route's status is unclear, decline it and write down which route and why." **Rule 20 tells an unsure reader to refuse**, which is what `4de659aa` and `378a9792` did. `AGENTS-core.md` is prepended to every runbook's `AGENTS.md`, PPv4's included (`preprocessing-v4/AGENTS.md:3`); PPv4's own file has 16 rules and none of them addresses authorship.

2. **Both documents are city-authored, not applicant filings.** Section content (from `document_section`) of `470cf1b7`: *"Comments: 04/29/2025 (Please respond to each comment in letter form) **CC Drainage/WQ Review – Amy Papa (512) 974-2635 - amy.papa@austintexas.gov** DE 1 – Current Status: Pending * U0: If a development is located within 550 feet of an existing storm drain system…"*; section titles `Project Information and Review Status | Drainage and Water Quality Review | City Arborist Review | Land Development Engineering Review | ATD Review | Austin Energy Review`. `83016f09`: 15 sections, `General Information and Case Manager Review | Electric Review | Transportation & Public Works (TPW-TDS) Review | Drainage Engineering Review | … | City Arborist …`, content *"WQ 1 – Current Status: Pending * U1: Comment stands. * U0: Provide a description of any changes…"*. **These are review comments by named city reviewers: rule 19's barred class, verbatim.**

3. **They are stored as applicant documents.** `document.kind = 'document'`, `city_response_type = NULL` for both. `document_version.submission_version_id = 55fb6548-814f-4287-bc4a-6018b756d730` (version 1), created 2026-04-07 15:12. `submission_document` links each to versions 1 (`55fb6548…`, status `reviewed`), 2 (`48f705aa…`, `review_complete`) and 3 (`31d7c595…`, `draft`). **Nothing in the rows distinguishes them from the eight real applicant filings beside them** (the Consolidated Site Plan Application, the Engineer's Summary Letter, the TIA worksheet, …). Their file names do: "U1 MCR", "Completeness Check **Update 1 Response**". Those are city responses to later rounds, filed into version 1 after the fact.

4. **There is a designed channel, and these two don't use it.** `document.kind` in prod (2026-09-28): `document` 220 · `feasibility_intake` 80 · `intake_attachment` 72 · `drainage-model` 7 · `binary` 2 · **`city_response` 4** (`mcr` 2, `redlines` 1, `misc` 1; first created 2026-09-04, two projects). `bureau/runbooks/process-city-response-docs/README.md:5`: that feature "attaches `document(kind='city_response')` rows (`city_response_type ∈ {mcr, redlines, misc}`) to the **city-submitted** `submission_version`" and drives the CRC-guide skills over them. **The channel is five months younger than Valley View's upload and holds four documents in the whole database.**

5. **PPv4 staging filters on exactly that channel.** `bureau/runbooks/preprocessing-v4/scripts/stage.py:227-231`:
   ```python
   # Applicant filings only. A `city_response` (the MCR, the redlines) is the city's answer to
   # this submission and has its own runbook (process-city-response-docs); PPv3's discovery
   # query (document_version.submission_version_id) picked those up, the junction does not.
   if doc.get("kind") not in ("document", "drainage-model"):
       continue
   ```
   **The filter is right and the input is wrong:** a misfiled city document is `kind='document'` and passes.

6. **The reader is told it is reading an applicant filing.** `preprocessing-v4/steps/2.3-documents/steps/read/prompt.md:3`: "You read **one** document **the applicant filed** with this submission…". The pages say otherwise, so rule 19 (in the prepended core) and the prompt's framing point in opposite directions, and the model picks per run. **Nondeterministic by construction:** the same input produced read / refuse / read / withhold.

7. **A refusal cannot pass the contract.** `read/contract.test.ts:55-59`:
   ```ts
   it('the inventory carries the document, not a description of it: most sections have verbatim content', () => {
     const secs = readJson(dir, 'document.json', Document).sections;
     const withContent = secs.filter((s) => (s.content ?? '').trim().length > 0).length;
     expect(withContent / secs.length, `${withContent} of ${secs.length} sections carry content`).toBeGreaterThanOrEqual(0.5);
   });
   ```
   There is no "barred / not read by rule" disposition. PPv4's gap ledger (`preprocessing-v4/AGENTS.md` §Gaps, rule 14) has `disclose | needs-higher-dpi-read | needs-operator | needs-source | needs-engineer`, and the refusing reader recorded `DOC-CCR-NOT-READ`, but **the contract counts content, not gaps.** Conductor retries 3×, then the captain escalates. The captain's own diagnosis on `4de659aa`: *"The output is correct under its rules, and a re-run would fail the same way."*

8. **The review runbook already reads these documents' sections.** `bureau/runbooks/review/steps/1.2-stage-submission` → `runbooks/lib/stage_submission.py:975` `sections = db.document_sections(base, auth, entry["id"])` for every entry of `submission_db.document_versions()` (`runbooks/lib/submission_db.py:284-312`), whose only exclusion is:
   ```python
   # conductor filters the same two kinds; anything else (an uploaded
   # correspondence blob, a model file) is not review evidence.
   if not doc or doc.get("kind") not in ("document", "drainage-model"):
       continue
   ```
   So a review of Valley View version 1, 2 or 3 stages `supplementary-docs/master-comment-report/` and `supplementary-docs/completeness-check-results/` from the upload-time sections, **the city's comments, handed to the reviewer as applicant evidence.** Rule 19 exists precisely to prevent this, and nothing enforces it at this layer; a review agent that obeys rule 19 has to notice by reading.

9. **The reading layer already holds the city's comments, from before PPv4 existed.** `document_section` for `470cf1b7`: 6 rows, first `created_at` 2026-04-07 16:59:26. For `83016f09`: 15 rows, 16:59:31. Both `document_version.preprocessing_run_id = NULL` and `city_response_processing_run_id = NULL`. These are the automatic upload-time transcriptions (the pipeline the PPv3/PPv4 work replaced; `substation/src/inngest/functions/process-file/plan-set.ts:231` "v2: all reading/transcription AI moves to the operator-run runbook"). **PPv4 refusing to read the document changes nothing about what a review sees.**

10. **It is not a Valley View one-off.** City- or response-shaped documents stored as `kind='document'` with published sections, 2026-09-28:

    | Project | `document.name` | Sections | Note |
    |---|---|---|---|
    | Valley View Townhomes | Master Comment Report | 15 | city, barred class |
    | Valley View Townhomes | Completeness Check Results | 6 | city, barred class |
    | Lamar + Collier | Site Plan Comment Responses (2 versions) | 14 + 6 | the applicant's comment-response letter, **named in rule 19 as barred** ("which quotes the comments it answers") |
    | Central Health | Response To Staff Comments | 3 | same class |
    | 12 projects | Project Review Form | 35 | ambiguous: the Austin PRF is a city form the applicant files |

    Plus, with no sections yet: `ACE_Review_Comments.pdf`, `1700 S Lamar u1 MCR.doc.pdf`, `1700 S Lamar - U0 MCR.PDF`, "Project Review Form (PRF)" ×2 (the 1700 S Lamar MCRs are the correctly-kinded `city_response` rows). **The barred class is broader than "the MCR"**: rule 19 also names the applicant's own comment-response letter, which *is* applicant-authored, so "who wrote it" alone does not decide the bar either.

11. **A human ruled that preprocessing should read it**, once, for one run (§Symptom, quoted). The captain then wrote the ruling into the run's copy of `read/prompt.md` ("Operator ruling for this run … lifts the review-comment bar for item 83016f09 only"; diff at `$RUN/captain/proposed-prompt-ruling.diff` in the snapshotted sandbox `conductor-63cead15-41f8-418c-b0ef-bd5c2b44719a`) and asked twice before keeping it, because `prompt.md` is a gated file (captain D8). **The escalation machinery did its job; the policy it escalated is still undecided on `main`.**

---

## Timeline

| When | What | Relevance |
|---|---|---|
| 2026-04-07 15:12 | Valley View submission v1 uploaded; the MCR and CC Results arrive as `kind='document'` in v1 | authorship lost at entry |
| 2026-04-07 16:59 | upload-time transcription writes 6 + 15 `document_section` rows | the city's comments enter the reading layer |
| 2026-04-15 | legacy `review-4.3` workflow completes on v1 (`55fb6548…`) | **unverified** whether that workflow consumed supplementary-document sections (Q7) |
| v2, v3 | the same two `document_version`s are linked to each new version | the leak carries forward to every version |
| 2026-09-04 | first `kind='city_response'` rows (City Response Documents feature) | the designed channel appears, five months later, not backfilled |
| 2026-09-24 → 09-28 | four PPv4 runs: read / refuse / read / withhold | the bar is enforced by model judgement, nondeterministically |
| 2026-09-25 19:09 | Will rules the MCR "needs to be pre-processed" (one run) | the only human position on record |

**Corollaries:** this is not a regression, and no recent PR introduced it. The captain changes (bureau#1806, #1857) made it *visible and answerable*. Before them the same refusal ended in a dead card. Nothing ever *enforced* rule 19 at a data boundary; it has always been prose.

---

## Root cause

1. **Authorship is not in the data.** `document` has `kind` and a nullable `city_response_type`, both set only by the City Response Documents upload path. Anything uploaded through the ordinary document path is `kind='document'` regardless of who wrote it, and nothing backfills or checks it.
2. **Rule 19 is written as agent prose, with a carve-out that assumes the data is right.** "Every sheet and document the applicant filed … always in bounds" is true only if `submission_document` holds only applicant filings. When it doesn't, the rule's two halves collide, and rule 20 tells the agent to decline when unsure.
3. **Deterministic consumers enforce a proxy (`kind`) for the real property (authorship / "is this the city's answer").** PPv4 staging, review staging and the app all use `kind`, so all three pass a misfiled city document.
4. **PPv4's contract has no representation for a principled refusal**, so the one component that does apply rule 19 turns a correct refusal into a failure.
5. **The reading layer is shared by consumers with opposite needs.** Review must *not* see the city's comments (rule 19/20: accuracy). CRC and `process-city-response-docs` *must* see them (they turn the MCR into guides). The app shows documents to people, who may reasonably want to see the MCR. A single reading layer with no authorship/role field cannot serve all three with one rule.

---

## Impact

| Consumer | Affected? | How |
|---|---|---|
| **Review runbook** (`review/1.2-stage-submission`) | ⚠️ **Yes, silently** | Stages the city's comments from `document_section` as supplementary applicant evidence for any review of Valley View v1–v3 (and Lamar + Collier, Central Health, per Evidence 10). No log, no warning. A review agent reading the MCR is reading the answer key rule 20 says every accuracy number rests on. **This is the worst case**: it changes review output without a trace. |
| **Accuracy / eval numbers** (rule 20) | ⚠️ Possibly | Any published accuracy measured on a project whose submission links a misfiled MCR or comment-response letter is contaminated to the extent the review read it. Not yet measured (Q7). |
| **PPv4** | Yes, loudly | A nondeterministic park at `2.3-documents` needing a human ruling (cost of 3 reader retries + the captain; wall-clock until someone answers). When the reader *does* read, the city's comments are re-transcribed into `artifact.json` and published on approval, which is harmless relative to the existing sections but not what rule 19 describes. |
| **CRC / `process-city-response-docs`** | Partially | Works on `kind='city_response'` rows; a misfiled MCR is **invisible to it** (it discovers by kind), so a project like Valley View gets no CRC guides from its MCR unless someone re-files it. |
| **App (cityhall)** | Cosmetic | Lists the MCR as an applicant document; the City Response badge (`document/[documentId]/+page.svelte:68`) doesn't show. |
| **Captain** | No | Escalates correctly since bureau#1806/#1857. |

**Cheap detector** for the worst case (candidate misfiled city documents that already have readable sections):

```sql
select p.name project, d.id document_id, d.name, dv.id document_version_id, dv.file_name,
       count(s.id) sections
from document d
join project p on p.id = d.project_id
join document_version dv on dv.document_id = d.id
left join document_section s on s.document_version_id = dv.id
where d.kind = 'document'
  and (d.name ~* '(comment report|completeness check result|comment respons|response to (staff )?comments|staff report|review comments)'
       or dv.file_name ~* '(\mMCR\M|comment|completeness check update)')
group by 1,2,3,4,5 order by sections desc;
```

A name heuristic, so it has false positives and negatives. It's a triage list, not a classifier.

---

## Fix directions (not yet implemented — seeds for the brainstorm, not a mandate)

The brainstorm should start from Will's ruling (Evidence 11): **preprocessing should read the city's documents.** If that holds, the bar belongs at the *consumer* (review), not at the *reader* (PPv4), and the fix is about authorship in the data plus enforcement where it matters.

1. **Make authorship a first-class fact at the source, and backfill.** Put city-authored documents on the designed channel (`kind='city_response'`, `city_response_type`) at upload/intake: a classifier at upload, an operator choice in the upload UI, or both. Backfill the misfiled ones (the detector above as a starting list, a human confirms). *Hazard:* re-kinding changes what every consumer sees for that project at once (the app list, review staging, CRC discovery); the City Response feature attaches to the **city's** `submission_version`, and these rows are linked to the applicant's versions 1–3, so re-filing may mean moving links, not just flipping `kind`.
2. **Enforce rule 19 deterministically where it matters: review staging.** `submission_db.document_versions` / `stage_submission.download` exclude barred-class documents by a data field, not by an agent noticing. Rule 19's prose stays as the backstop. Needs the field from (1), or a second one (e.g. `document.role` / `barred_for_review`), because rule 19's class ≠ city-authored (the applicant's comment-response letter is applicant-authored and barred; Evidence 10).
3. **Split rule 19 by runbook purpose.** It is a *review-time* rule written into the *all-runbook* core. PPv4 builds a reading layer used by consumers with opposite needs (Root cause 5); its AGENTS.md could state that it reads every document it stages, and records authorship/role in the output (e.g. a document-level field in `document.json`) for downstream consumers to filter on. `AGENTS.md` already "wins where the two disagree" (`preprocessing-v4/AGENTS.md:3`).
4. **Give the PPv4 contract a representation for a principled refusal**, e.g. a document-level `disposition: barred` with a gap id, which the ≥50%-content check accepts. Cheapest, and stops the park, but **alone it leaves the review leak (Evidence 8) untouched** and keeps enforcement nondeterministic.
5. **Operator scope as the escape hatch.** `request.scope.documents` already lists which `document_version`s to read (`1.1-inputs/contract.test.ts`); an explicit exclude list, or a request-level ruling, would let an operator decide once per run at launch instead of at a mid-run gate. A workaround, not a fix.

**Existing-data hazard for any option:** the upload-time sections for misfiled city documents are already in `document_section` and already read by review staging. Deleting them breaks nothing that should have them (CRC reads `city_response` rows), but re-kinding without removing them from review staging's path leaves the leak; decide the two together.

---

## Prior art

- **The designed channel and its filter:** `process-city-response-docs/README.md:5` (the `city_response` model), `preprocessing-v4/scripts/stage.py:227-231` (PPv4 honours it), `runbooks/lib/submission_db.py:308-311` (review staging honours it). The pattern is right; the data doesn't use it.
- **The app already renders the distinction:** cityhall `src/routes/(app)/project/[projectId]/document/[documentId]/+page.svelte:68-70` badges `city_response_type === 'mcr' | 'redlines'`.
- **Upload path that sets it:** substation `src/routes/submissions.integration.test.ts:795-893` exercises creating `city_response_type: 'mcr' | 'redlines'` documents. Read the route under test to see where an upload chooses the kind.

---

## Open questions

- **Q1.** Is Will's 2026-09-25 ruling ("we need to pre-process it") the policy for **all** runs, i.e. PPv4 reads every staged document and the bar moves to review? Or was it a one-run call?
- **Q2.** What is the unit of the bar: *city-authored* documents, or rule 19's broader *answer-bearing* class (which includes the applicant's comment-response letter)? The data field has to encode whichever it is.
- **Q3.** Where does authorship get decided for new uploads: a model classifier at intake, the uploader's choice, the jurisdiction's portal metadata, or a HITL at preprocessing?
- **Q4.** Should misfiled city documents be **re-kinded in place** (links to the applicant's versions stay) or **re-filed** onto a city `submission_version` per the City Response design?
- **Q5.** What happens to the existing upload-time `document_section` rows for barred documents: delete, keep for the app, or keep but exclude from review staging?
- **Q6.** Should PPv4 publish sections for barred documents at all, given CRC reads the PDF through its own runbook?
- **Q7.** Did the legacy `review-4.3` run on Valley View v1 (2026-04-15, `workflow_runs`) read these sections, and did any published accuracy number include a project with a misfiled answer-bearing document? (Needs the 4.3 workflow's staging code and the eval project list.)
- **Q8.** Is the Austin **Project Review Form** (12 projects, 35 sections) barred, in bounds, or case-by-case? It's a city form the applicant fills.

---

## Reproduction / verification recipe

**1. The two documents, their kind and their links** (expect `kind='document'`, `city_response_type` null, linked to v1/v2/v3):
```sql
select d.id, d.name, d.kind, d.city_response_type, dv.id dv, dv.file_name, dv.submission_version_id owner_sv,
       array_agg(sv.version_number order by sv.version_number) linked_versions
from document d join document_version dv on dv.document_id = d.id
join submission_document sd on sd.document_version_id = dv.id
join submission_version sv on sv.id = sd.submission_version_id
where dv.id in ('83016f09-2906-47f1-9272-9d80d2219f19', '470cf1b7-8976-4728-aaa1-c91b2bbb07ea')
group by 1,2,3,4,5,6,7;
```

**2. The city's comments already in the reading layer** (expect 15 + 6 rows, 2026-04-07, `preprocessing_run_id` null):
```sql
select dv.id, dv.preprocessing_run_id, count(s.id), min(s.created_at), left(max(s.content), 200)
from document_version dv join document_section s on s.document_version_id = dv.id
where dv.id in ('83016f09-2906-47f1-9272-9d80d2219f19', '470cf1b7-8976-4728-aaa1-c91b2bbb07ea')
group by 1,2;
```

**3. The per-run outcomes** (expect the Symptom table; exit 1 = refused/failed):
```sql
select r.id, r.status, r.created_at,
       string_agg(distinct e.item || ':' || (e.payload->>'exit'), ', ') doc_exits
from runbook_runs r left join runbook_run_events e
  on e.run_id = r.id and e.kind = 'step.exit'
 and e.item in ('83016f09-2906-47f1-9272-9d80d2219f19', '470cf1b7-8976-4728-aaa1-c91b2bbb07ea')
where r.project_id = '63cead15-41f8-418c-b0ef-bd5c2b44719a' and r.runbook = 'preprocessing-v4'
group by 1,2,3 order by 3;
```
The refusal's own words: `select payload->>'harness_tail' from runbook_run_events where run_id = '4de659aa-7918-4758-934b-9aa51d3c8a01' and kind = 'step.exit' and item = '470cf1b7-8976-4728-aaa1-c91b2bbb07ea';`
The ruling: `select payload->>'prompt', decision from runbook_hitl_questions where run_id = '378a9792-a274-46ba-9756-8cf48c946c52' and step = 'captain' order by created_at;`

**4. The review leak, without running a review:** in a bureau checkout, run the review's staging for version 3 (`python3 runbooks/lib/stage_submission.py` via `runbooks/review/steps/1.2-stage-submission/step.yaml`'s `cmd:` with a scratch `$RUN`), or read `submission_db.document_versions(…, '31d7c595-39de-47ed-b7b7-a108d1b03e20')` in a REPL. **Expect** `supplementary-docs/master-comment-report/` and `supplementary-docs/completeness-check-results/` to be staged with the city's comments. **A fix passes when** neither is staged for a review, while `process-city-response-docs` (or whatever reads the MCR by design) still finds it.

**5. Reproduce the PPv4 failure:** launch PPv4 on the same request (`trigger-cloud-runbook` skill; request as in the Symptom table). It reproduces **only sometimes** (2 of 4 runs), because the reader's refusal is a model judgement. To force it, launch with `scope.documents: ["470cf1b7-8976-4728-aaa1-c91b2bbb07ea", "83016f09-2906-47f1-9272-9d80d2219f19"]` and `scope.tracks: ["documents"]` to cut the run to the two documents (unverified: that `1.2-stage`/`2.1-cover` are happy with the sheets track off), and repeat. **A fix passes when** the run's handling of both documents is the same on every run and matches the policy decided in Q1/Q2.
