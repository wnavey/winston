# West Sacramento Walmart — Phase 1 (free exploration) findings

**Date:** 2026-07-25 · **Session:** headed `agent-browser` read-only exploration of the Yolo ACE / Tyler Eagle portal. **Nothing was purchased; no order was placed; no payment made.** A single test item (the 2009 deed) was added to a guest cart to observe the checkout gate, then the cart was cleared.

Screenshots: `scratchpad/yolo-explore/*.png` (session-local).

---

## 1. The order + payment flow (verified live, end-to-end)

The spec's Route B and the surveyor guide's "guest cart" describe the **same single mechanism**, now confirmed:

1. **Search** the free index at the Self-Service Portal (`yolocountyca-web.tylerhost.net/web`). Entry from `ace.yolocounty.gov/222/Official-Records-Search` → "Self-Service Portal" (`.../action/ACTIONGROUP201S4`). The reCAPTCHA disclaimer is bypassed with cookie `disclaimerAccepted=true` (same as `yolo_clerk_search`).
2. **Select** result rows (per-row checkboxes) → click **"Add Selected Document(s) to Cart"** (the `mdi-cart-plus` icon in the results header).
3. **Open cart** (`/web/cart`) → each item shows as **OFFICIAL RECORDS COPIES** with the **exact page count and price**.
4. **Checkout**: enter a **Name only** and click **"Place your Order."** — **NO LOGIN REQUIRED** (guest checkout confirmed). Copy-type is Official Record Copy (plain, email) vs Certified (mail).
5. **Payment is NOT collected online.** Verbatim from the checkout page:
   > "PAYMENT IS NOT COLLECTED ONLINE. Orders stay in queue until payment is received in person or by mail/fax with the printed application. Official Records copies: Provide credit card info by phone at **530-666-8130** after submitting your order."
6. **Delivery**: Official Record Copy (plain) → **by email**; Certified → **by mail only**.

**Implication for automation:** there is no in-browser image download and no in-browser payment. The agent can build the cart and reach the Name/Place-Order gate; the human places the order + pays by phone; documents arrive by email asynchronously (not same-session). This is fundamentally different from the GSCCCA model the `county-clerk-paid-pull-session` skill was built for.

## 2. Fees (verified on-screen; corrects the spec's estimates)

- **$5.00 first page + $2.00 each additional page** (per document).
- **+$3.00 per document** for certification (spec guessed ~$6.50 — actual is **$3**).
- **Page count is visible in the FREE index** (document detail → "Number Pages") — so **exact per-doc cost is computable before buying**. Verified: deed 2009-0024915 = 6 pages → cart showed **$15.00** ($5 + 5×$2).
- Index coverage: **Jan 1 1850 → present**, updated nightly M–F; **~3-business-day lag** (indexed through Jul 22 on Jul 25).

## 3. Coverage findings (what the free index actually shows)

| Priority doc (per spec) | Free-index status | Notes |
|---|---|---|
| **REA / CC&Rs + amendments** | **FOUND, but large** | Under party **RIVERPOINT MARKETPLACE SHOPPING CENTER (E/W)**: master **COVENANTS CONDITIONS & RESTRICTIONS ×1** + **DECLARATION ×1** + **AMENDMENT CC&R ×25** + **AMENDMENT DECLARATION ×2** = **~29 restriction instruments**. Developer principals appear as grantors (ALLBAUGH ×29, BRODOVSKY ×27 — Sacramento-area developer group). No "RECIPROCAL" doc-type exists; the REA is carried as CC&R/DECLARATION/AGREEMENT. |
| **Recorded subdivision/parcel map** | Not under center name | Center-name search returned **no MAP RECORDING**. Map is indexed under the surveyor/developer or must be found via **Map Book/Page Search** (assessor map page 014-79) or the `maps` def (DOCSEARCH233S1). Not yet pinpointed. |
| **Deed 2009-0024915** | **FOUND & confirmed** | DEED, 08/03/2009, WAL MART STORES INC → WAL MART REAL ESTATE BUSINESS TRUST, **6 pages** → **$15** plain. Legal-notes blank (metes-and-bounds only in the image, as spec predicted). |
| **Easements on Lot B** | Not under center name | Center-name search returned **no EASEMENT**. Easements sit under other grantors (developer / PG&E / individual lot owners); need targeted EASEMENT-type + party/date searches. Not yet enumerated. |
| **Development Agreement / PD-45** | Not searched | PD-45 design guidelines already on disk (`supporting-documents/pd45-riverpoint-design-guidelines.pdf`). Recorded DA (if any) would be an AGREEMENT — deferred. |
| **Monetary encumbrances** | Searchable | DEED OF TRUST / lien types exist as doc types; owner-name index works once driven correctly (see §4). |

**Cost reality for the load-bearing REA:** pulling "the REA + ALL amendments" piecemeal = ~29 long instruments. REAs and amendments run tens of pages; realistic piecemeal cost is **$600–1,000+**, and the operator would then have to reconcile 27 amendments by hand to reconstruct the operative text. This is the decisive fact for route choice (§5).

## 4. Surveyor code-change write-up (DEFERRED — do in a follow-up PR)

Two bugs/gaps found; both explain why this run had no `priority-pull-list.md` and why an automated party search would have come back empty.

**(a) `yolo_clerk_search` party-name searches return nothing (BUG).** The Name index (`DOCSEARCH201S5`) is a **two-stage typeahead**: type → pick an indexed name from the autocomplete (which adds a facet "chip") → then Search. The tool fills the party field and submits without selecting a suggestion, so no search item is registered → empty results ("did not reach the results view"). Reproduced live: `both-names "RIVERPOINT"` and `both-names "WAL MART REAL ESTATE BUSINESS TRUST"` both returned 0 via the CLI, while the identical names return rich results when the typeahead suggestion is clicked in the browser. Doc-number search works fine (no typeahead). **Fix:** the party-name path must interact with the `/web/search/suggest/BothNamesID` autocomplete (select the exact indexed name, or add it via `addSearchItem`) before submitting. Also note the Name def is `S5`, distinct from the Advanced/comprehensive def `S8` the tool currently routes through — S8 also has typeahead party fields, so the same fix applies.

**(b) Guide lacks the "Recording-Records Tier Behavior" section (GAP).** The surveyor county-clerk prompt only authors `priority-pull-list.md` (tier-aware override, Step 3) when the jurisdiction guide has a section titled exactly **"Recording-Records Tier Behavior."** `jurisdictions/west-sacramento-ca.md` has a "County Clerk / Recorder Instructions" section and a rich access-matrix, but **not** that heading — so the override never fired and no pull list was produced. **Fix:** add the section, adapting the GSCCCA-shaped pull-list schema to a **phone-order / email-delivery** jurisdiction: the `key`/`viewer_url` fields (which assume an in-browser image URL) don't exist for Yolo — replace with `documentId` (e.g. `DOCCGD-2009-0024915-00`) + `documentNumber` + `pages` (for pre-purchase cost) + `copy_type` (plain-email vs certified-mail). Populate the guide's tier facts: fees ($5+$2/pg, $3 cert), pay-by-phone 530-666-8130, email delivery, guest checkout (no login), page-count visible in free index.

**(c) Skill portal registration (GAP, downstream of a+b).** `county-clerk-paid-pull-session` only knows GSCCCA and its in-browser download loop. Yolo needs a new **"phone-order / email-delivery"** procedure variant: no auth, build cart → reach Name/Place-Order gate → hand off to human for phone payment → async email delivery → file/OCR/receipt when docs arrive → (no auto-replay, since delivery isn't same-session). Consider whether this even belongs in that skill or in a Yolo-specific runbook, given how different the async model is.

## 5. Route recommendation

The exploration **strengthens the spec's Route A recommendation (title report).** Rationale now evidence-backed:
- The operative REA is buried under **~29 instruments** (1 master + 27 amendments). Piecemeal county copies = **$600–1,000+** and manual reconciliation of every amendment.
- The **map and easements are not under the center name** — piecemeal pulls require additional detective searches, and (per the spec) most center easements sit on the *neighboring* lots, so each hit must be coverage-checked against Lot B before buying.
- A **preliminary title report** returns the **operative (amended) REA + recorded map + every Schedule-B exception plotted against Lot B**, with legible underlying instruments, for a flat few-hundred dollars, professionally reconciled.

If DIY (Route B) is still preferred, the pragmatic middle path is: **buy the 6-page deed ($15) first**, transcribe its "subject to" recitals to get the exact REA + easement recording references, then pull only those specific instruments by document number — avoiding a blind $600+ amendment sweep.
