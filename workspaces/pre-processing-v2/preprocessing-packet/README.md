# Agentic Preprocessing — Implementation Packet

**For:** Will (implementing with a Claude agent assistant)
**From:** Jason, via a planning session on 2026-08-13
**Status:** Jason has ratified the shape described below. How to implement it is your call —
this packet gives you the intent, the evidence, and a detailed map of the current system so
you and your agent don't have to rediscover any of it.

---

## What this is

When a customer uploads a site plan to our app, a cloud job splits the PDF into sheets, makes
thumbnails, and then has Google's Gemini model read every sheet — naming it, summarizing it,
and transcribing its tables and notes into the database. Those transcriptions turn out to be
wrong at a rate that makes them dangerous: on our benchmark package, roughly 40 of 57 sheets
had a recorded defect, including invented document numbers, dropped rows, and one sheet with
no transcription at all — and every defect is invisible to our checks because the structure
looks fine while the contents rot. Our review process already quietly works around this by
re-reading the actual drawings. So today we pay to generate content our own reviewers can't
trust.

## The plan

Split preprocessing into two halves along the mechanical/judgment line.

**The cloud job keeps only the mechanical work:** split the PDF, render thumbnails, unpack
zips (with one small AI call retained to sort a zip's contents), and detect page-count
mismatches loudly instead of silently truncating. After upload, the app shows sheet thumbnails
you can flip through — no names, summaries, or transcriptions yet.

**All the reading and understanding moves to a new operator-run runbook session**, built the
same way our review and site-intelligence sessions already work. It reads each sheet with two
independent passes — one that only transcribes, one that only interprets — and a third pass
that reconciles them, treating any disagreement as an open question rather than picking a
winner. It reads the cover sheet first and hands that context to every sheet reader, can zoom
into any region at high resolution, and can go look at other sheets when something (like a
missing legend) needs it. When something is genuinely off — a corrupted PDF, a new version
missing sheets the old one had — it stops and asks the operator instead of failing silently,
and the operator can fix and re-run the cheap mechanical step. When it finishes, it writes its
results into the exact same database fields the app and review process use today, so nothing
downstream changes.

**The review process gains one gate:** before a review starts, it checks whether this
submission version has been through the reading session; if not, it runs that first.

## Why this shape

The two-pass reading pattern is proven in our site-intelligence work, and its design
specifically defeats the failure modes we recorded — a model can't converge on its own
hallucination when two independent readings must agree. Publishing to the existing fields
means zero changes to the app or the four downstream systems that consume them. And the work
moves from metered per-call API spend to our flat-rate Claude subscription, with a human in
the loop exactly where judgment is needed.

## The build, in order

1. **A one-day spike first:** run the drafted reading runbook against the benchmark package
   where we've catalogued every known defect, and score it by how many it catches — that
   ratifies both the quality bar and the per-package cost before committing to the full build.
2. Then three small, independently shippable pieces (each its own PR):
   - Strip the AI calls from the cloud job (and delete its silent-failure paths).
   - Build the reading runbook plus a small script that publishes its output to the database.
   - Add the prerequisite check to the review runbook.

## Costs and consequences we're accepting

- Uploads no longer self-describe — until an operator runs the reading session, the app shows
  bare thumbnails, and in-app search over sheet content is empty.
- A large package will consume meaningful subscription capacity per run — the spike puts a
  number on it.
- Preprocessing now requires a human to initiate it, which is fine at our volume because
  reviews already do.

## Decisions already made vs. your latitude

**Ratified by Jason (the shape):** mechanical work stays in the sandbox; all
reading/summarizing/transcription moves to an interactive runbook; the runbook publishes to
the existing database fields; the review runbook gates on preprocessing having run; zip triage
stays as the one AI call at upload time.

**Yours to decide (implementation):** everything else — including whether every sheet gets
the full two-pass treatment or value-bearing sheets (cover, tables, notes, legends, schedules)
get two passes while pure-drawing sheets get a single read with a coverage confession. The
planning session's recommendation: let the spike decide, with defect-catch rate on the
benchmark package's known-bad sheets as the bar. See `design-notes.md` for the reasoned
recommendations and the traps to avoid.

## What's in this packet

| File | What it is |
|---|---|
| `jason-commentary.md` | Jason's original framing of how he thinks this should work, verbatim. The intent document — when in doubt, this wins. |
| `preprocessing-transcription-handoff.md` | The evidence dossier that motivated this: the nine recorded transcription failure modes, the benchmark package, the known-bad sheets to validate against. |
| `design-notes.md` | The planning session's hole-poking and adjustments: the full strip list (11 AI calls, not 3), the non-obvious couplings, schema recommendation, the tiering question, and governance rails. |
| `exploration-upload-pipeline.md` | Detailed code-level map of the current upload preprocessing: every AI call with file:line, the DB fields written, all consumers, and the silent-failure inventory. Point-in-time recon from 2026-08-13. |
| `exploration-runbook-patterns.md` | Detailed map of the two-pass reader pattern in the SIR runbook (the engine to reuse), the zoom/crop mechanics, escalation patterns, and how runbooks are structured and initiated. Same date. |
