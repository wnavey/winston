# DE-30 Manhole / Junction-Box Conflation — 10-Run CRC Quality Audit & Remediation Hypotheses

**Status:** Draft v1
**Date:** 2026-07-13
**Repos touched (by proposed remediations):** `bureau` (CRC review prompt), `noetic` / `noetic-tools` (`generate-crc-guides` skill), `conductor` (crc-vision-check prompt — optional, Q2)
**Repos NOT touched:** `cityhall`, `inspector-general` (this audit *used* IG-derived transcripts but changes nothing in IG), `substation`

---

## Problem

CRC item **DE-30** — *"A manhole is placed at each location where the storm drain pipe size changes, per DCM 5.6.0"* (guide `crc-DE-2.md`, checklist row line 60) — was evaluated by 10 independent review runs across two medly CRC reviews on the same U1 plan set (Lamar + Collier v4):

- `47eca23e-a010-4f87-ac3b-1cf6f4c481ae` — 5 runs, **claude-haiku-4-5**
- `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e` — 5 runs, **claude-sonnet-4-6**

**Ground truth: `failed`.** The U1 plans show no manhole at the SD-05 pipe-size change. The plan view labels a **5'x5' JUNCTION BOX** at STA 2+11.20 (where 36" RCP in → 54" RCP out); the SD-05 profile view omits that structure entirely and shows only a `45° 36" RCP BEND` at STA 2+44.59. A junction box is not a manhole, does not provide the personnel access DCM 5.6.0 exists to guarantee ("Manholes provide a very important access point for maintenance purposes" — the entire text of the section in bureau), and the plan set itself treats them as distinct structure types (Sheet 18 legend: `PROPOSED JUNCTION BOX` vs `EXISTING STORM DRAIN MANHOLE`; Sheet 36: manhole ring & cover standard details in Blocks 3/7/9–15, precast junction box details in Blocks 17–18).

**Observed outcome:**

- haiku vote: **3–2 failed** → consolidated correct, but 2 of the 3 correct verdicts were right for wrong or lucky reasons (§Per-run).
- sonnet vote: **4–1 resolved** → consolidated **wrong**, with high confidence (dissent share 0.2 < `uncertainThreshold` 0.35, so no `uncertain` flag).
- Across all 10 runs, exactly **one** (sonnet run-2) reached `failed` via the correct reasoning chain.

The failure is not an evidence problem. In every wrong run, the pre-processed text data and every vision response correctly identified the structure as a *junction box* (or a *bend*); no tool output ever called it a manhole. The equivalence "junction box ≈ manhole" was **manufactured inside agent reasoning**, three times hardening from a hedge in thinking into a fabricated regulatory claim in the final output.

This spec documents the audit (method, per-run findings, cross-cutting failure modes), assesses the generated guide, and proposes ranked remediation hypotheses with a test plan.

---

## Audit method

- Post-processed, tool-call-joined transcripts pulled from Supabase storage: bucket `inspector-general`, `ig-derived-review-outputs/{reviewId}/transcripts/crc-DE-2/run-{1..5}.json` (events = thinking / text / tool_call with inputs+results and `checklistItemIds` attribution).
- Guide audited: `~/noetic/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/cf1201c2-2e8b-4034-9a5e-a70b6317e39a/4/6/crc-DE-2.md` (both reviews used the same guide generation).
- Prompt/tooling ground truth: `bureau/workflows/comment-resolution-check/prompts/review.md`, `bureau/workflows/comment-resolution-check/workflow.yaml`, `conductor/src/tools/crc-vision-check/{index.ts,prompt.md}` (vision model: `google/gemini-3.1-pro-preview`).
- Code ground truth: `bureau/jurisdictions/austin/codes/dcm/contents/Section 5 - Storm Drains/5.6.0 - Manholes/` (5.6.0, 5.6.1 Spacing, 5.6.2 Public-Private Connections).
- One analysis agent per run transcript (10), plus one prompt/tooling sweep; all quotes below are verbatim from transcripts.

### The site-plan facts every run had available (text layer)

- Sheet 28 `guide.md`: `**SD-05 Junction Box (STA 2+11.20):** 5'x5', Top Elevation 533.84, 54" RCP (out) NE FL: 525.22, 36" RCP (in) SW FL: 526.72` — the size change is at this box.
- Sheet 28 plan-view block (`block-1.md` / `block-5.md` depending on split): `STA: 2+11.20 "SD-05" / 5'X5' JUNCTION BOX`; `STA: 2+44.59 "SD-05" / 45° 36" RCP BEND`.
- Sheet 28 profile block (Block 4): pipe labels change `54" R.C.P. @ 3.00%` → `36" R.C.P.` with **no structure at 2+11.20** (the profile genuinely omits the junction box — a real drafting inconsistency in the U1 set).
- Sheet 18 legend and Sheet 36 standard details distinguishing manholes from junction boxes (see Problem).
- No text source anywhere places a storm **manhole** on SD-05.

---

## Scoreboard

| Run | Model | Verdict | Correct? | One-line path summary |
|---|---|---|---|---|
| haiku-1 | haiku 4.5 | resolved | ✗ | Treated the 45° **bend** at 2+44.59 as "qualif[ying] as a manhole position"; told itself to verify manhole placement, never did; zero DE-30 vision calls |
| haiku-2 | haiku 4.5 | resolved | ✗ | Announced a DE-22+DE-30 vision check, then ran it for DE-22 only; verdict claims a 45° bend "functions as a junction structure… serves this function"; the 45° detail is confabulated (documented bend at that node is 22.5°) |
| haiku-3 | haiku 4.5 | **failed** | ✓ (partly lucky) | Sound principle ("the bend alone does not satisfy the requirement") but never saw the junction box at all — skipped `block-1.md` and vision, mislocated the size change at 2+44.59 |
| haiku-4 | haiku 4.5 | **failed** | ✓ (fragile) | Correct verdict via a geometry claim the text doesn't support (size change at 2+44.59, JB "upstream"); mid-run thinking had already said the JB "may satisfy the size change requirement" |
| haiku-5 | haiku 4.5 | **failed** | ✓ (wrong reason) | Failed only on the plan/profile inconsistency; final reasoning states "only a junction box **or** manhole satisfies DCM 5.6.0" and its resolution text tells the applicant a junction box would be acceptable |
| sonnet-1 | sonnet 4.6 | resolved | ✗ | Raised the correct doubt ("the standard calls for a manhole specifically"), wrote a leading vision prompt ("manhole **(or junction box)**"), then self-dismissed the doubt: "it's an access structure, so it should satisfy" — while failing DE-29 on the very same structure for the very same label mismatch |
| sonnet-2 | sonnet 4.6 | **failed** | ✓✓ (model run) | Asked vision a typed classification question; vision answered "**It is a junction box, not a manhole**"; corroborated against Sheet 36 details + Sheet 18 legend; strict reading; burden on applicant |
| sonnet-3 | sonnet 4.6 | resolved | ✗ | Posed the definition question 3×, never looked it up, resolved it from priors ("junction boxes typically qualify"), which hardened into a fabricated rule at output: "In Austin's DCM practice, a junction box constitutes an acceptable access structure" |
| sonnet-4 | sonnet 4.6 | resolved | ✗ | Instant, unhedged equation on first contact: "serves the same access function as a manhole **per the DCM standards**" (no such standard consulted); zero doubt anywhere; also failed DE-29 on the same structure |
| sonnet-5 | sonnet 4.6 | resolved | ✗ | Reached `failed` **twice** in its own thinking ("ambiguous evidence fails… I'm marking DE-30 as failed"; "That's a real compliance gap") and abandoned it both times; "(an accepted equivalent to a manhole)" appears for the first time in the final output |

**Net:** 4/10 correct status; **1/10 correct reasoning.** The stronger model did worse (1/5 vs 3/5) precisely because it gathered evidence better — sonnet reliably found the junction box in the text layer and then rationalized it into compliance, while two of haiku's correct verdicts came from *not finding* the junction box or from keying on the profile inconsistency.

---

## Per-run narratives

### Review `47eca23e` — haiku 4.5

**Run 1 — resolved (wrong).** Read the guide + sheet 25/27/28 text. All evidence it saw said "BEND" (including the guide's own DE-30 figure caption: "…with the pipe-size change point visible in the layout… along with 'BEND' annotations"). First contact with the item set the frame: *"Sheet 28 shows a 54" RCP transitioning to 36" RCP at STA 2+44.59 with a 45° bend, which appears to address this requirement."* Later it self-corrected — *"need to verify manhole placement at that location"* — then never performed the verification (no DE-30 vision call, despite running the identical vision pattern successfully for DE-22 and DE-26, both of which it failed). Final output rationalized: the bend "qualifies as a manhole position… serves the purpose of a size-change access point." **Failure class: abandoned verification + functional-equivalence rewrite. Pure judgment failure.**

**Run 2 — resolved (wrong).** Same evidence base. Announced *"Let me check vision tool for… the storm drain connection at South Lamar (DE-22 and DE-30)"* — but the actual call passed `checklistItemIds: ["DE-22"]`, aimed at the wye station, and the response explicitly said *"both in and out flow lines are listed as 54", indicating no size change at this node."* DE-30 was decided with zero targeted evidence; the verdict's "45° bend… functions as a junction structure… while not explicitly labeled 'manhole', the transition structure depicted serves this function" inverted the deficiency into the cure. **Failure class: evidence substitution (DE-22's station adopted as DE-30's evidence) + equivalence rewrite.**

**Run 3 — failed (correct, partly lucky).** Zero vision calls. Never read `block-1.md` (the plan-view block was split out of `blocks.md`, and the sheet-28 profile text contains no STA 2+11.20 entry), so **the junction box never entered its evidence**. Its stated principle was genuinely sound — *"The bend alone does not satisfy the requirement; a manhole is required at the size change independent of the bend"* — and it applied the same posture to DE-29. But whether it would have accepted a `5'X5' JUNCTION BOX` callout is untested in this run; sibling runs that did see the JB mostly caved. **Correct via a data-layout accident as much as principle.**

**Run 4 — failed (correct, fragile).** Found the junction box via semantic search, and mid-run thinking leaned wrong: *"DE-30 shows a 5'x5' junction box at STA 2+11.20 in SD-05 where the pipe transitions from 54" to 36", which may satisfy the size change requirement."* The final verdict flipped to `failed` on a **location** argument (JB "upstream of the size change… the transition occurs at STA 2+44.59 where a 45° bend is marked") that the text data doesn't actually support — the text puts the transition at the box. Right answer, wrong geometry, and one inference away from `resolved`. **Failure class avoided by accident; the structure-type argument ground truth turns on was never made.**

**Run 5 — failed (correct status, wrong reason).** The heaviest tool user (15 vision calls). Its DE-30 vision prompt was well-scoped and manhole-specific ("Verify the presence of a manhole at the transition point…"), and vision answered accurately: plan shows a junction box at 2+11.20, profile omits it and shows only a bend at 2+44.59. But vision's verdict framing ("the plan view **provides** a junction box at the transition… the profile fails to show this structure… without a manhole") implicitly graded the JB as adequate, and the agent absorbed that: final reasoning states *"only a junction box or manhole satisfies DCM 5.6.0,"* and the item failed **only** on the plan/profile inconsistency. Its prescribed resolution — "Ensure both plan and profile views consistently show a **manhole or junction box** at the size change point" — would accept a non-compliant fix. Had the drafting been consistent, this run resolves. Also notable: it attached the DE-30 reference figure with a **hallucinated description** ("Reference showing pipe size transition point with manhole and elevation details" — the figure contains no manhole). **Failure class: latent equivalence error masked by a lucky drafting inconsistency.**

### Review `d1ff47e7` — sonnet 4.6

**Run 1 — resolved (wrong).** Text data gave it everything (guide.md JB line; block-5 labels; the plan set's own `EXISTING STORM SEWER MANHOLE` label proving the taxonomy). Pre-vision thinking raised the exact right doubt: *"the standard calls for a manhole specifically, and I'm not certain a junction box meets that criterion."* Then its own batched 4-item vision prompt collapsed the distinction — *"is there a manhole **(or junction box)** at the location where the pipe size changes…?"* — and vision, answering the question as asked, confirmed presence without ever asserting equivalence. The decisive leap was self-generated: *"it's an access structure, so it should satisfy the requirement… so DE-30 appears resolved."* Same run, same structure, same station: DE-29 **failed** because *"the requirement explicitly calls for a 'public manhole' and that's not what's labeled here."* **Failure class: self-contaminated vision prompt + unresearched equivalence + intra-run inconsistency.**

**Run 2 — failed (correct — the model run).** Three replicable success factors:
1. **Typed classification vision question**: *"is there a manhole (or acceptable equivalent structure per DCM 5.6.0) placed at that transition? **Is the structure a manhole, junction box, or something else?**"* — forcing a fact, not a compliance opinion. Vision returned: *"**It is a junction box, not a manhole.**"*
2. **Corroboration from the plan set's own taxonomy**: it had opportunistically read Sheet 36 (originally for trench-drain items) and reused it — *"Looking at Sheet 36, I can see these are distinct structure types with different details, so I'll mark DE-30 as failed unless the code explicitly allows junction boxes for this condition."*
3. **Burden-of-proof direction**: ambiguity resolved against the applicant ("unless the code explicitly allows junction boxes," not "unless the code forbids them"), matching the review prompt's "ambiguous evidence collapses to `failed`."
It also walked up to the trap first ("a junction box with access does provide maintenance capability… might satisfy the manhole requirement") and was pulled back by the three guardrails. **This run is the template for remediation.**

**Run 3 — resolved (wrong, with fabrication).** Read everything including the Sheet 18 legend distinguishing the symbols (never used it). Vision prompt was leading and presupposed the answer (*"is there a manhole or junction box placed at this transition point?… Does the plan confirm this structure IS at the pipe size change location?"*). Vision flagged a red flag anyway: profile shows *"a gap between the 54" and 36" pipe segments with no vertical junction box or manhole drawn."* The agent posed the definitional question three times — *"I'm questioning whether this 5'x5' junction box actually qualifies as a manhole under DCM 5.6.0"* — and answered it from priors mid-sentence: *"though junction boxes typically qualify as acceptable structures."* By output time the hedge had hardened into fabricated regulation: *"In Austin's DCM practice, a junction box constitutes an acceptable access structure at a pipe size change."* No tool output, guide text, or code supports it. **Failure class: unGrounded definitional question → prior-injection → output-time fabrication; red-flag demotion ("legibility gap… does not negate the plan-view evidence").**

**Run 4 — resolved (wrong, zero doubt).** Decided from text alone; its one sheet-28 vision call was tagged for DE-22/23/29 and confirmed structure type "junction box." First contact was the wrong turn, asserted as fact: *"this serves the same access function as a manhole per the DCM standards, so it satisfies the requirement."* No junction-box-vs-manhole hesitation exists anywhere in the run. Requirement silently rewritten from "a manhole is placed" to "an access structure exists." And the same intra-run inconsistency as sonnet-1: DE-29 failed (*"There is no manhole located at the private-to-public ROW transition point"* — vision's words) while DE-30 resolved on the identical structure. **Failure class: instant unhedged equivalence + requirement rewrite.**

**Run 5 — resolved (wrong, self-overridden).** The vision prompt injected the equivalence (*"Is there a manhole **(or junction box)** at that size change location?"*, reference image described as "Compare to U1 to see if **a junction box or manhole** has been added"). Vision consistently said "junction box" and reported the profile omission. The agent then flip-flopped: *"Given the validation principle that ambiguous evidence fails, I'm marking DE-30 as failed"* → resolved-lean → *"That's a real compliance gap, so I should mark this as 'failed' despite what the plan shows"* → final: *"The plan view evidence of the junction box at the size change location outweighs the profile inconsistency, so I'm marking DE-30 as RESOLVED."* It had flagged its own gap — *"I need to confirm whether a 5'x5' junction box actually qualifies as a 'manhole' under the code standards"* — and never did the lookup. "(An accepted equivalent to a manhole)" appears nowhere before the final structured output. **Failure class: leading prompt + twice-abandoned correct verdict + output-time fabrication.**

---

## Cross-cutting findings

**F1 — This is a definitional-judgment failure, not an evidence or vision failure.** All 6 wrong runs had (or could trivially have had) the correct fact: the structure is a junction box / a bend. No tool ever called it a manhole. Every equivalence claim was model-generated. The vision tool (gemini-3.1-pro) performed well when asked well — sonnet-2's classification question produced the flatly correct "It is a junction box, not a manhole."

**F2 — Agents contaminate their own vision prompts.** Three sonnet runs embedded "(or junction box)" into the vision question, converting the tool from fact-finder into confirmer. The one run that instead asked "is the structure a manhole, junction box, or something else?" got the distinction handed to it. The review prompt (`prompts/review.md`) currently gives no guidance on *how to phrase* vision questions.

**F3 — Doubt raised, never grounded — then fabricated.** Sonnet runs 1, 3, 5 each explicitly posed "does a junction box qualify as a manhole under DCM 5.6.0?" in thinking, and each resolved it by assertion from priors instead of lookup. Twice ("In Austin's DCM practice…", "an accepted equivalent to a manhole") the unresolved hedge surfaced as confident fabricated regulation **only in the final structured output** — the most dangerous possible failure shape, because the output reads as researched.

**F4 — The explicit burden-of-proof rule was violated, not missing.** `prompts/review.md` already says: "The burden of positive evidence is on you… Absence of evidence… is `failed`… **Ambiguous evidence collapses to `failed`**." Sonnet-5 quoted the principle and overrode it two paragraphs later. The rule exists; nothing operationalizes it at the moment of temptation.

**F5 — Intra-run incoherence on the identical structure.** Sonnet-1 and sonnet-4 both **failed DE-29** ("public manhole at private-to-public transition") because the structure is labeled a junction box, and **resolved DE-30** ("manhole at size change") on the same structure at the same station. The strict-literal frame existed inside those runs — it just wasn't applied uniformly. No mechanism makes per-item verdicts share a definitional frame.

**F6 — Right-for-wrong-reason verdicts are unstable and export the error.** Haiku-5 failed the item but its `resolution` text instructs the applicant that a junction box would be acceptable — the conflation shipped to the customer inside a "correct" verdict. Haiku-4's failed verdict rests on unsupported geometry. Under majority vote these look like healthy dissent; they are not.

**F7 — Haiku vs sonnet divergence is about *where they looked*, not who reasoned better.** Haiku runs keyed on the profile (bend at 2+44.59); three never firmly connected the JB to the size change; their correct votes partly trace to missing evidence (run-3 never read `block-1.md`) and to the plan/profile drafting inconsistency. Sonnet reliably surfaced the JB from the text layer — and then 4/5 rationalized it. Better retrieval + undisciplined judgment = confidently wrong consolidation.

**F8 — Observability gaps made this audit harder.** `checklistItemIds` attribution was sparse/wrong (haiku-2 announced DE-30 in prose but tagged only DE-22; sonnet runs batched 3–4 items per vision call against the prompt's "usually one" rule), so verdict→image tracing required full-transcript reconstruction.

---

## Was the guide poor?

Mixed — the checklist row is fine; the support scaffolding around it failed in four specific ways:

**G1 — The requirement row is clean and literal.** "A manhole is placed at each location where the storm drain pipe size changes, per DCM 5.6.0" is unambiguous. Nothing in the row invites equivalence.

**G2 — No Validation Methodology row for DE-30.** The guide's methodology section (lines 39–44) gives item-specific verification gates for DE-19/20/21, DE-35 ("a text note stating 'drawdown ≤ 24 hr' alone does NOT satisfy"), DE-22, DE-28, DE-4/6 — but nothing for DE-29/DE-30, the two items whose entire verdict turns on a structure-type distinction. The DE-35 row proves the pattern works: no run tried to pass DE-35 on a bare compliance note. DE-30 needed the equivalent sentence: *"a junction box, inlet, wye, or bend is not a manhole; only an explicit manhole callout at the size-change station resolves this item."*

**G3 — Key Terms defines twelve terms but not the one that decided the item.** HGL, trickle channel, analysis point etc. are defined; "manhole" and "junction box" are not — despite DE-29 and DE-30 both hinging on that boundary, and despite the plan set itself (Sheet 18 legend, Sheet 36 details) providing ready-made ground truth for the distinction.

**G4 — Citation-grounding failure.** The Regulatory Overview states "No specific regulatory citations were identified for the Drainage Engineering (DE) items in this comment set… no section text is quoted here" — yet `bureau/jurisdictions/austin/codes/dcm/contents/Section 5 - Storm Drains/5.6.0 - Manholes/` exists, with 5.6.0's purpose sentence ("Manholes provide a very important access point for maintenance purposes") plus 5.6.1/5.6.2. The generate-crc-guides grounding step failed to find/quote a section that is present in bureau. Quoting even that one sentence — access for **maintenance personnel** — would have made the junction-box substitution visibly wrong (and note DE-27.2/DCM 5.6.1 legitimately counts junction boxes as *access points for spacing*, which is exactly the adjacent-rule bleed that contaminated DE-30 reasoning in haiku-5; the guide never warns that the 5.6.1 "access point" concept does not transfer to the 5.6.0 "manhole" requirement).

**G5 — Mild junction-box normalization from the DE-22 figure.** The DE-22 figure caption + constraints block prominently feature the "existing 7'x7' junction box" as legitimate infrastructure, keeping "junction box" salient as an acceptable-sounding term across the whole guide context (sonnet-1 even invoked the DE-22 figure mid-DE-30 reasoning). Secondary contamination at most — but it costs nothing to note in the figure caption that the JB there is an *existing* structure the city questioned, not an approved pattern.

**Verdict on the guide:** not the root cause (the checklist row was literal and sufficient for a disciplined reader — sonnet-2 passed with this exact guide), but the guide *missed three cheap opportunities* (G2, G3, G4) to make the wrong path hard, on an item where the training-time signal (the MCR comment demanded a manhole for accessibility) was clear.

---

## Where the wrong path started — causal chain

For the 6 wrong-or-wrong-reason runs the sequence is consistent:

1. **Retrieval surfaces a structure with an official-sounding name** ("5'X5' JUNCTION BOX") at the right station — or, for haiku, a bend at the station it believes is right.
2. **The requirement gets silently paraphrased** from "a manhole is placed" to "an access structure exists at" — usually within the first thinking block that touches the item (sonnet-4: first contact; sonnet-1: inside its own vision prompt).
3. **The definitional gap is either never noticed (sonnet-4, haiku-1/2) or noticed and left unGrounded (sonnet-1/3/5)** — no run except sonnet-2 consulted anything (code, legend, standard details) to answer it. The staged bureau (`resources.bureau: true`) contains the answer's raw material; no prompt language points agents at it for definitional disputes.
4. **The "resolved" narrative recruits supporting frame**: U0→U1 improvement bias ("a structure was added where there was none — surely that's what the reviewer wanted"), demotion of contrary signals (profile omission → "documentation gap"), and adjacent-rule bleed (5.6.1 access-point spacing counts junction boxes).
5. **At output time the hedge hardens into fabricated authority** ("per the DCM standards", "In Austin's DCM practice", "an accepted equivalent") — the structured-output field demands a confident `reasoning` string, and the unresolved question gets papered over rather than surfaced.

Steps 2–3 are the intervention points. Step 5 argues that any fix must land *before* structured output — post-hoc consistency checking of output text alone would catch the fabrication but not the verdict.

---

## Remediation hypotheses

Ranked by expected impact ÷ cost. H1–H3 are cheap and composable; H4–H5 are workflow changes to test after measuring H1–H3.

### H1 — Guide generation: per-item strictness rows + key-term contrasts + citation grounding (highest leverage)

Change `generate-crc-guides` (and `generate-crc-guides-from-redlines`) so that:

1. **Named-artifact methodology rows.** When an item's requirement names a specific physical artifact or document (manhole, cleanout, recorded covenant number, calculation…), emit a Validation Methodology row stating the noun is literal and enumerating the common look-alikes that do **not** satisfy it. For DE-30: *"Only an explicit manhole callout at each size-change station resolves this item. A junction box, curb inlet, wye, or bend at the size change does NOT satisfy DCM 5.6.0 — junction boxes are a distinct structure type (see plan legend / standard details) and are not manholes. Note: DCM 5.6.1 counts junction boxes as access points for spacing; that definition does not transfer to this item."* The DE-35 row already proves this pattern controls agent behavior.
2. **Contrastive Key Terms.** When two structure/document types are confusable and both appear in the plan set, define both terms *in contrast* ("Manhole — … Distinct from a junction box, which…").
3. **Fix citation grounding (bug).** The guide claimed no DE citations could be located while `austin/codes/dcm/.../5.6.0 - Manholes/` exists in bureau. Diagnose why the grounding step missed it (path/format/lookup query) and make the Regulatory Overview quote the cited sections' text — even one purpose sentence per section. Treat "cited section exists in bureau but guide says not found" as a generation-time validation error, not a silent fallback.

*Expected effect:* directly removes the step-2/step-3 failure for guided items; sonnet-2's win shows the strict frame + taxonomy evidence is sufficient. *Risk:* guide bloat; scope to items whose requirement names an artifact.

### H2 — Review prompt: a literal-noun / grounded-equivalence rule

Add to `bureau/workflows/comment-resolution-check/prompts/review.md` (near the "What resolved means" section):

> **Requirements name literal artifacts.** If the requirement says "manhole," evidence must show a manhole. You may not substitute a different structure/document because it "serves the same function" — functional equivalence is the city's call, not yours, and asserting it without a cited code/guide basis is fabrication. If you find yourself writing "should satisfy," "typically qualifies," "serves the function of," or "equivalent to," stop: that is a definitional question. Ground it (guide text, cited code section under the staged bureau tree, plan-set legend/standard details) or treat the item as ambiguous — which collapses to `failed`.

Optionally add the concrete lookup affordance: the bureau codes tree is already staged in the sandbox (`resources.bureau: true` in `workflow.yaml`); the prompt never mentions it as a resource for definitional disputes.

*Expected effect:* converts the three "doubt raised, never grounded" runs (sonnet-1/3/5) — all of which knew the right question — into `failed`. Targets the exact self-talk observed verbatim. *Risk:* over-strictness on items where equivalence IS fine; mitigated because the collapse target (`failed`) is the safe direction for CRC, and the guide can explicitly allow equivalents per H1.

### H3 — Vision-prompt discipline: classification questions, no embedded candidates

Add to the review prompt's crc-vision-check section:

> When the verdict depends on what a structure/label IS, ask the vision agent a **classification question** ("What structure is called out at STA X — a manhole, a junction box, or something else? Quote the label text.") — never a compliance question with candidate answers embedded ("is there a manhole (or junction box)…?"). Do not batch structure-identity questions with unrelated items; batched prompts get terse verdicts.

Optionally (Q2) reinforce in `conductor/src/tools/crc-vision-check/prompt.md`: "When asked about a structure, always report the exact label text before any assessment."

*Expected effect:* replicates the single decisive success factor of sonnet-2's vision call; removes the self-contamination seen in sonnet-1/3/5. *Cost:* one sentence; no code changes.

### H4 — Grounded-citation lookup step (bureau as the definitional referee)

Beyond the prompt nudge in H2: when a checklist item cites a code section, resolve the citation to the staged bureau path at guide-fetch time and inject the section text (or its absence) into the item row — so the agent never has to decide whether to go looking. This subsumes H1.3 at runtime rather than generation time, and works for guides already generated.

*Expected effect:* moderate alone (5.6.0's text is one sentence — helpful framing, not a syllogism-ender), strong combined with H2's "ground it or fail" rule. *Cost:* small conductor/fetch-step change.

### H5 — Workflow granularity: adversarial verification of `resolved` verdicts

The observed failure hardens at structured-output time (F3, causal step 5), and majority vote amplified it (4–1 confident-wrong). Add a cheap post-review, pre-consolidation pass: for each `resolved` item, a no-tools verifier agent receives only {requirement row, methodology row, the run's observation/reasoning/evidence quotes} and answers one question: *"Does the quoted evidence contain the literally-required artifact, or does the reasoning substitute an equivalent?"* Flag → flip to `failed` or route to `uncertain`. This is the "smaller, more granular steps" hypothesis, scoped to the one transition where the error crystallizes; it would have caught all 6 wrong-or-wrong-reason verdicts here, since every one contains the substitution *verbatim in its own reasoning field* ("functions as", "serves the same access function", "accepted equivalent", "or junction box").

*Expected effect:* high recall on this failure class because the fabrications are self-documenting. *Cost:* one extra cheap agent call per resolved item; new workflow step. Run as an experiment after H1–H3 are measured — it may be redundant if H1–H3 close the gap, or the safety net if they don't.

### H6 — Observability: enforce `checklistItemIds` accuracy (hygiene)

Tighten the review prompt's existing tagging rule (one item per vision call unless genuinely shared; tags must match the prompt's actual subject) and have IG's derived-output pipeline flag calls whose prompt text mentions item IDs missing from the tags (haiku-2's DE-30-in-prose/DE-22-in-tags call is the signature). Not a quality fix; makes the next audit cheap.

---

## Test plan

1. **Fixture:** same U1 plan set (Lamar + Collier v4), same `crc-DE-2` item set; regenerate the guide with H1 applied; apply H2+H3 prompt changes.
2. **Runs:** 5 × haiku 4.5 and 5 × sonnet 4.6 (same configs as the audited reviews), before Lamar+Collier v5 game day.
3. **Success criteria:**
   - DE-30: ≥ 4/5 `failed` per model, **and** every `failed` reasoning names the junction-box-vs-manhole distinction (not the plan/profile inconsistency alone) — right-for-wrong-reason counts as failure (F6).
   - DE-29/DE-30 verdict coherence within every run (F5).
   - Zero fabricated-equivalence phrases ("per the DCM standards", "accepted equivalent", "typically qualifies") in any `reasoning` field — grep-able check.
   - No regression on the other 17 DE-2 items vs. current majority verdicts.
4. **Then** decide H4/H5 based on residual error.

---

## Open questions

- **Q1** — Ground truth confirmation: is there any Austin condition under which a junction box IS accepted at a pipe-size change (e.g., box culvert transitions, structures > manhole-max diameter)? Will's position (and the MCR comment's intent): no — manholes required for personnel access. If an exception exists, H1's methodology row should state it rather than a blanket prohibition.
- **Q2** — Should the structure-classification directive live in the caller guidance only (H3), or also in `crc-vision-check/prompt.md` itself? Tool-side is stronger but affects every CRC/CC vision consumer.
- **Q3** — Majority-vote posture for definitional items: sonnet's 4–1 wrong verdict sailed under `uncertainThreshold` 0.35 as confident-resolved. Is there appetite for a per-item "strict" marker (set by H1's methodology row) that raises the uncertainty bar or requires unanimity for `resolved` on named-artifact items?
- **Q4** — Retroactivity: regenerate the existing Lamar+Collier CRC guide generation with H1 before v5 game day, or ship H2/H3 (prompt-only) for game day and fold H1 into the next guide generation?
- **Q5** — H1.3's grounding bug: is the miss specific to this generation (path/lookup query) or systemic across departments? Worth a one-off scan: for every generated CRC guide, does every cited section resolve to a bureau path?

---

## Scope boundaries

- **No conductor orchestration changes** in this spec beyond the optional H4 fetch-step and H5 experiment; the medly/majority-vote machinery is untouched.
- **No IG changes** — IG's derived transcripts were the audit instrument; H6 is a review-prompt + IG-lint suggestion, specced separately if pursued.
- **No re-adjudication of other DE-2 items** — DE-29 was examined only where runs' own reasoning coupled it to DE-30; a full DE-2 item-by-item audit is out of scope.
- **Model choice** (haiku vs sonnet vs sonnet-5 default) is deliberately not a remediation lever here: F7 shows the failure is prompt/guide-shaped, not capability-shaped, and the stronger model did worse.

---

## Appendix — quote index (verbatim, by run)

| Run | The load-bearing quote |
|---|---|
| haiku-1 | "a 45° bend, which appears to address this requirement" → "qualifies as a manhole position" |
| haiku-2 | "while not explicitly labeled 'manhole', the transition structure depicted serves this function" |
| haiku-3 | "The bend alone does not satisfy the requirement; a manhole is required at the size change independent of the bend" ✓ |
| haiku-4 | "a 5'x5' junction box at STA 2+11.20 … which may satisfy the size change requirement" (thinking; final verdict flipped on geometry) |
| haiku-5 | "only a junction box or manhole satisfies DCM 5.6.0" (failed anyway, on plan/profile inconsistency) |
| sonnet-1 | "the standard calls for a manhole specifically, and I'm not certain a junction box meets that criterion" → "it's an access structure, so it should satisfy the requirement" |
| sonnet-2 | vision: "It is a junction box, not a manhole." agent: "I'll mark DE-30 as FAILED since the specification explicitly requires a manhole, and a junction box doesn't meet that definition, even if it provides access" ✓✓ |
| sonnet-3 | "though junction boxes typically qualify as acceptable structures" → output: "In Austin's DCM practice, a junction box constitutes an acceptable access structure" (fabricated) |
| sonnet-4 | "this serves the same access function as a manhole per the DCM standards" (no standard consulted) |
| sonnet-5 | "Given the validation principle that ambiguous evidence fails, I'm marking DE-30 as failed" → "…outweighs the profile inconsistency, so I'm marking DE-30 as RESOLVED" |
