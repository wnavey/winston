# West Sacramento Walmart SIR — Paid Document Pulls

**Status:** Draft v1
**Date:** 2026-07-25
**Repos touched:** none (this is an execution runbook for a fresh session, not a code change)
**Artifacts touched:** the diligence run at `~/noetic/diligence/west-sacramento-walmart/` (adds downloaded instruments + a pull receipt; does NOT re-render the report — that's a separate follow-on session)
**Skills referenced:** `noetic-tools:county-clerk-paid-pull-session`, `noetic-tools:diligence-replay-phase-5`, `noetic-tools:diligence-report`

> **Read this first if you have zero context.** A Site Intelligence Report (SIR) was completed for a Walmart Supercenter renovation/expansion in West Sacramento, CA. The report shipped with a handful of **recorded-instrument gaps** that could not be pulled for free — chiefly the shopping-center **REA/CC&Rs**, which is the one document that could materially cap the expansion. Your job is to **acquire those documents** (paid), file them into the run, and stop. A *later* session will re-run or patch the SIR with the new evidence. You are the "go buy the documents" step in the middle.

---

## Problem

The SIR run lives at `~/noetic/diligence/west-sacramento-walmart/`. It concluded the expansion is feasible and largely administrative under zoning — **but** several decision-relevant facts sit behind recorded instruments the run could only see in a free *index* (names + document numbers), not as images:

- **Yolo County splits its recorder access into a free index tier and a paid image tier.** The free grantor/grantee index confirmed the vesting deed exists; document *images* require payment. The free party-name search also did not round-trip reliably in the run's automated session, so even an index-only encumbrance list could not be certified.
- The single highest-value gap is the recorded **Reciprocal Easement Agreement (REA) / Declaration of CC&Rs** for the Riverpoint Marketplace shopping center. Zoning (base C + PD-45 overlay) allows the store's expansion administratively, but a center REA is **private law layered on top** and commonly (a) caps the anchor's floor area independent of zoning, (b) fixes a center-wide parking ratio, (c) requires other owners'/declarant **consent to expand**, and (d) defines no-build envelopes, cross-access, and sign rights. Until it is read, the expansion carries an **unquantified private-law ceiling**.

The SIR carries all of these honestly as `[P]` punch-list items. This spec closes them.

### Subject facts (everything you need to open an order)

| Field | Value |
|---|---|
| Property | Walmart Supercenter #3652, **755 Riverpoint Ct, West Sacramento, CA 95691** (Yolo County) |
| APN / assessment | **014-793-066-000** (12-digit packed: `014793066000`); assessor map page **014-79**, map year **08/09** |
| Legal | **Lot "B", Riverpoint Marketplace** subdivision (full metes-and-bounds is one of the docs to pull — assessor legal is blank) |
| Fee owner (vesting) | **Wal-Mart Real Estate Business Trust**, per deed **2009-0024915** (recorded **2009-08-03**; assessor doc ref `2009R0024915`; documentId `DOCCGD-2009-0024915-00`) |
| Prior owner | Wal-Mart Stores Inc (2009 intra-company transfer) |
| Center | **Riverpoint Marketplace**, West Sacramento (co-anchors historically IKEA / Home Depot / Nugget; ~96.75 ac; the Walmart pad is one 22.03-ac lot within it) |
| Recorder office | **Yolo County ACE — Clerk-Recorder Branch**, 625 Court Street, Woodland, CA 95695 · **(530) 666-8130** |

---

## The documents to pull (priority order)

Pull in this order; **#1 is the one that can change the answer** — if budget or time is tight, get #1 and #2.

1. **Riverpoint Marketplace REA / Declaration of CC&Rs + ALL amendments and supplements.**
   *Why:* governs floor-area cap, center parking ratio, building envelope, cross-access, and any consent-to-expand right. This is the load-bearing document. Recorded against the center master lot(s); find it via the developer/declarant name or by walking the "subject to" recitals in the 2009 deed (see #3).
   *Unlocks:* converts the SIR's #1 "significant — data gap" (Transportation / Zoning) into a known constraint.

2. **Recorded final subdivision / parcel map for Riverpoint Marketplace** (map year 08/09; assessor map page 014-79).
   *Why:* Lot B's exact geometry **and which easements are drawn on Lot B vs. the neighboring IKEA/Home Depot/inline lots** (most center easements sit on the other lots — do not attribute them to the subject without checking the map).
   *Unlocks:* real net-buildable area + easement footprints (Drainage, Transportation).

3. **Deed 2009-0024915** (image).
   *Why:* the **full metes-and-bounds legal** (assessor legal is blank) and its **"subject to" recital chain** — which itself names the REA and easements to pull under #1/#4.
   *Unlocks:* legal description for all disciplines; a roadmap to the other instruments.

4. **All active easements burdening Lot B** — PG&E electric (a 2026 padmount-transformer engineering permit exists on the parcel), city / RD 900 / WSAFCA drainage, and any center utility/detention easements.
   *Unlocks:* Drainage / stormwater / floodplain constraints.

5. **Any City ↔ center Development Agreement (Cal. Gov. Code §65864) and/or recorded PD-45 conditions of approval.**
   *Why:* could add vesting rights or obligations beyond the zoning code. Check both the Clerk index and City Community Development.

6. **Monetary encumbrances** — deeds of trust, UCC fixture filings, mechanics'/judgment/tax liens, lis pendens against the parcel or owner. The free party-name index did not round-trip in the run; a paid search or a title run clears this.

---

## How to acquire them — three routes (pick per budget/urgency)

### Route A (RECOMMENDED, fastest, most complete): open a Preliminary Title Report

A single prelim from a title company returns the REA, the recorded map, the deed, and **every Schedule B exception plotted against Lot B**, with legible copies of the underlying instruments — i.e. essentially all six items in one order, professionally plotted. This is the standard diligence move and is more reliable than pulling instrument-by-instrument.

- **What to hand the title company** (enough to open an order): APN `014-793-066-000`; owner *Wal-Mart Real Estate Business Trust*; vesting doc `2009-0024915` (rec. 2009-08-03); legal *Lot B, Riverpoint Marketplace, Yolo County, map year 08/09, assessor map page 014-79*; center name *Riverpoint Marketplace, West Sacramento*.
- **Ask for:** a preliminary title report with **all Schedule B-II exceptions plotted against Lot B** and **legible copies of every underlying instrument** (REA + amendments, subdivision map, easements, development agreement if any).
- **Cost/effort:** typically opened at-risk for a few hundred dollars, often credited at closing; turnaround a few business days. Requires a human to engage a title company (First American, Fidelity, Chicago Title, Placer Title all operate in Yolo). **This is a human action — the executing session drafts the order request; Will places it.**

### Route B (DIY county pull): Yolo ACE Self-Service Portal + phone payment

Yolo County ACE (Assessor / Clerk-Recorder / Elections) exposes an **online Self-Service Portal** for official-records search and copy ordering. Mechanics (verified 2026-07-25 against ace.yolocounty.gov):

- **Index search is free**, records **1970–present**, index updated weekly. Search by grantor/grantee name, document number, document type, or recording date.
- **Images are viewable free at the office kiosk only**, BUT **plain copies can be ordered online** through the "Official Records Search and Copies" service in the **Self-Service Online Queue** and delivered **by email** (certified copies are mail-only).
- **Payment is NOT processed online.** After queuing the order you **call (530) 666-8130 and give a credit card** over the phone. This is the "interactive" part of the paid-pull session.
- **Fees (standard California statutory recorder fees — verify at order):** ~**$7.35 first page + $2.00 each additional page**, **+ ~$6.50** per document for certification if a certified copy is needed (plain email copies are cheaper and sufficient for reading the REA). A per-name records **search fee** may apply; confirm on the call.

> **Note on the `county-clerk-paid-pull-session` skill:** that skill was built for jurisdictions with a fully-online paid *download* tier (e.g. Georgia / GSCCCA: $5 single-use image window). **Yolo does not match that model** — its images download only after a **phone credit-card payment**, and certified copies come by mail. So the skill's automated download loop will not apply cleanly here. Use the skill's *structure* (walk the priority list item-by-item, confirm coverage before paying, file + OCR each doc, write a pull-receipt) but expect the payment + delivery steps to be **human-in-the-loop over the phone/email**, not a browser download.

### Route C (delegate): document-retrieval abstractor

Hire a Yolo County document-retrieval/abstractor service to pull items 1–3 by instrument number. Slower and piecemeal; only if A and B are both unavailable.

---

## The interactive paid-pull session — step by step (Route B)

Run this as a human-in-the-loop session (the operator drives the phone payment; you drive the search, coverage-check, filing, and OCR).

1. **Set up the run environment.** Work against `~/noetic/diligence/west-sacramento-walmart/`. Downloaded instruments land in `sir/deliverable/supporting-documents/`. You will also write `~/noetic/diligence/west-sacramento-walmart/hitl/pull-receipt.md`.
2. **Open the Yolo ACE Self-Service Portal** (start at `https://ace.yolocounty.gov/222/Official-Records-Search`, follow to the Self-Service Online Queue). Use `agent-browser` (headed) if a browser is needed. Portal is public/non-login for the index.
3. **For each priority document (1→6), search the free index first and CONFIRM COVERAGE before paying:**
   - REA/CC&Rs: search by the center declarant/developer name (find it in the 2009 deed recitals — pull #3 first if needed), or by document type "Declaration" / "CC&Rs" / "Easement" in the relevant date range around the center's development.
   - Subdivision map: search "maps" / record-of-survey index by book-page or the assessor map page 014-79.
   - Deed: search document number `2009-0024915` directly.
   - Verify each hit actually covers **Lot B / the subject center** (read the index legal / party names) — **never pay for a document whose coverage you cannot confirm from the free index or a watermarked preview** (a prior run once bought the wrong block's plat).
4. **Queue the plain-copy order** for each confirmed instrument (email delivery).
5. **Operator places phone payment.** Present the operator the exact list + queued order total and the number to call **(530) 666-8130**. Record what was authorized. *(Do not fabricate that a payment happened — wait for the operator to confirm the charge and that the email copies arrived.)*
6. **File + OCR each received document.** Save the PDFs to `sir/deliverable/supporting-documents/<instrument-no>.pdf`. Transcribe each to markdown (vision/OCR) so the text is searchable — the REA especially needs a clean transcription of its floor-area, parking, and consent clauses.
7. **Write `hitl/pull-receipt.md`:** for each item — instrument number, what it is, cost, coverage evidence relied on (why you were confident it covers Lot B), delivery method, and a one-line summary of the key clause found (esp. the REA's floor-area / parking / consent terms). Note any item that was NOT found or NOT purchased and why.

### Budget guardrails (bind whoever spends)

- **Never buy a document whose subject coverage isn't confirmed pre-purchase** (free index legal, watermarked preview, or a clerk cross-reference).
- **Exhaust free preview/kiosk tiers first** where they answer the question.
- **Record every purchase** (item, cost, coverage evidence) in `pull-receipt.md`. A skipped purchase whose free tier sufficed is worth recording too.
- Do not spend without the operator's explicit go on the specific item list + total.

---

## Handoff to the SIR re-run / patch session (out of scope here — for the NEXT session)

Once the documents are filed and OCR'd, a separate session updates the report. Two options for that session (not yours to run):

- **Patch (cheaper):** feed the REA/map/deed findings into the relevant research + discipline files and re-render via `noetic-tools:diligence-replay-phase-5` (re-renders Phase 5 against updated on-disk artifacts without re-running Phases 0–4). Best when the new docs mainly sharpen the Transportation/Zoning/title findings.
- **Full re-run:** re-run `noetic-tools:diligence-report` on the same run dir (it resumes / can re-do affected phases) if the REA materially changes the frame (e.g. a hard floor-area cap that flips the feasibility verdict).

The `pull-receipt.md` + the OCR'd instruments in `supporting-documents/` are the interface between this session and that one — leave them clean and self-describing.

---

## Open questions

- **Q1 — Route choice.** Prefer the title-report route (A) or the DIY county pull (B)? A is faster/more complete and plots easements against Lot B for you; B is cheaper and fully in-house but phone-payment + email delivery, and won't plot exceptions. Recommendation: **A** unless a title company can't be engaged quickly.
- **Q2 — Certified vs plain copies.** Plain (email) copies are sufficient to *read* the REA and drive the analysis. Certified copies (mail-only, +~$6.50/doc) are only needed if a document must be relied on in a binding/legal context. Recommendation: plain copies for the SIR update.
- **Q3 — REA locate path.** If the REA's declarant name isn't obvious from the index, pull the 2009 deed (#3) first and walk its "subject to" recitals to get the REA's recording reference, then pull it directly. Confirm this two-step is acceptable rather than a broad (billable) name search.
- **Q4 — Budget ceiling.** What's the not-to-exceed for the DIY route (Route B) before defaulting to a title report? (County copy fees are small per doc; a multi-hundred-page REA + amendments could run up page fees.)
- **Q5 — Development Agreement source.** If no recorded DA appears in the Clerk index (#5), is a City Community Development records request in scope for this session, or deferred to the re-run session's punch-list?
