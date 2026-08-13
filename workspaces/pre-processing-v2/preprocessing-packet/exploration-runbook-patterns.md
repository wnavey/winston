# Two-pass document analysis & runbook patterns — recon report

Point-in-time code recon, 2026-08-13. This maps the machinery the new preprocessing runbook
should reuse. File:line references were verified on that date.

**Important framing up front:** there are **two generations** of this machinery, and they use
*different* two-pass designs. The one Jason described ("content" pass + "meaning" pass, both
Opus, zoom for high resolution, synthesis that explores conflicts) is the **newer bureau
runbook**, not the plugin skill.

| generation | location | the two passes | models |
|---|---|---|---|
| **current / production** | `bureau/runbooks/sir/prompts/phase-1/readers/` | **Reader A (literal draftsman)** + **Reader B (meaning)** — same sheets, different *briefs* | both Opus (per runbook model discipline) |
| **older plugin skill** | `claude-plugins/plugins/noetic-tools/skills/diligence-report/` | **Gemini 3.1 Pro** + **Opus 4.7** — same sheets, different *models* | two different vendors |

`bureau/docs/runbooks.md:3` states the runbook "replaced the step-numbered pipeline approach
for SIR authoring." So the reader-A/reader-B pair is the live pattern to copy.

---

## 1. Exact files

### The two-pass implementation (current)

`/Users/dsd/noetic/bureau/runbooks/sir/prompts/phase-1/readers/`
- `README.md` (9 lines) — the whole design in one table
- `reader-a-literal.md` (84 lines) — pass 1 brief
- `reader-b-meaning.md` (89 lines) — pass 2 brief
- `reconcile.md` (89 lines) — the synthesis / conflict pass

**Orchestrated by:** `bureau/runbooks/sir/prompts/phase-1/phase-1.md` — Duty 3 (line 15) is
the whole invocation:

> **3. Extract the plan (only if attachments exist).** Two independent readers with different
> briefs — literal draftsman / meaning — reconciled by a third pass that marks every
> disagreement as a data gap; briefs at `bureau/runbooks/sir/prompts/phase-1/readers/`.
> Output: `phase-1-frame/plan-extraction.md` (+ the two raw readings kept separate). If there
> are no attachments, write one line saying so in the seed and move on.

**Bound by:** `bureau/runbooks/sir/prompts/shared-conventions.md` (every worker reads it first).

### The older dual-*model* implementation (plugin skill)

- `claude-plugins/plugins/noetic-tools/skills/diligence-report/prompts/phase1-vision.md` —
  the executable prompt; §3 "Dual-model extraction (parallel)" at line 58, §4 "Reconcile" at
  line 68
- `claude-plugins/plugins/noetic-tools/skills/diligence-report/references/phase1-vision.md` —
  the *why*; sections `## Rendering` (44), `## Cropping` (56), `## Dual-model pass` (69),
  `## Scale calibration` (82), `## Load-bearing cover-sheet fields — verbatim double-read`
  (129), `## Reconciliation gate` (148)

---

## 2. The actual pass names and their briefs

### Reader A — "the literal draftsman" (`reader-a-literal.md`)

This is the "content" pass. Key language:

- Line 3: *"You are one of two independent readings of the same sheets. You will never see
  the other reading, and you must not try to guess what it says or hedge toward it — a second
  reading is only worth having when it was produced without reference to the first."*
- Line 5: *"Your entire job is transcription and measurement. **You do not interpret.** You
  do not decide what a hatch pattern means, whether a setback is compliant, whether a tree is
  protected... Another reader does that, and your value to the reconciliation is that you did
  not."*
- Its six rules (13–18): **"Quote, never paraphrase"**; **"Say where every value came from"**
  (label / table / text layer / measured — measured states pixel count, DPI, ft/px); **"Do
  not measure on a scale-less sheet"**; **"Absent is an answer"**; **"Illegible is an answer
  too"**; **"Transcribe both, when a sheet contradicts itself."**
- Line 9: *"The PDF's text layer is a cross-check, not a substitute: it routinely holds
  strings that are not visible on the sheet, and misses strings that are."*

### Reader B — "meaning" (`reader-b-meaning.md`)

- Line 3: identical independence clause.
- Line 5 is the contrast, stated with an example: *"The other reader transcribes. You
  classify. Where they will write `hatched area, 12' wide, along the east line`, you write
  `existing 12' public utility easement along the east line — it constrains the east setback
  and anything sited over it`. Both readings are needed, and yours is the one that can be
  confidently wrong, so every classification you make states what you based it on."*
- Rules (13–18): **"Every classification names its evidence"** (*"A classification with no
  evidence line is a guess wearing a fact's clothes."*); **"Say when you cannot classify
  something"**; **"Do not adjudicate compliance"** (position is yours, violation is not);
  **"Do not invent a program"**; and **"One scheme or several?"** — the alternatives call
  (*"Blending two alternatives produces a layout that exists in neither drawing."*).

### The shared spine (the load-bearing design detail)

Both readers write **the same section skeleton, in the same order** (`reader-a-literal.md:49-81`,
`reader-b-meaning.md:51-86`) *"because the reconciler reads both readings against the same
skeleton, so do not reorganize it."* A's is `Quantities | Circulation | Features drawn |
Printed notes (verbatim) | Contradictions | Illegible / not found`; B's is `Scheme
determination | What is proposed | Quantities | Circulation | Features classified | Notes with
regulatory consequence | Contradictions | Unclassified — seen, could not name`.

Both readers also **verbatim-transcribe the same six load-bearing cover-sheet fields** —
watershed status, jurisdiction/ETJ, zoning/land-use, legal description & acreage, flood note,
benchmark/datum (`reader-a-literal.md:20-31`, `reader-b-meaning.md:20-31`). B's interpretive
licence *"stops at those six lines."* Missing → `NOT FOUND ON ANY SHEET`, never reconstructed.
Rationale given inline: *"A single misread cover-sheet line has shipped in a delivered report
before."*

Both end with a mandatory coverage confession (`:83` / `:88`): *"End with a one-line statement
of what you did **not** read and why... A reading that quietly covers half the set is the
failure this step is most prone to."*

---

## 3. Zoom-in / high-resolution cropping

This is the one place the two generations differ sharply: **the bureau runbook states the
*requirement* and delegates the *mechanics*; the plugin skill holds the actual commands.**

### Bureau runbook (policy, no commands)

Both reader briefs, line 9, identically: *"The attachment PDFs, read as rendered images at
**a DPI you can actually read** — use any renders and crops your spawner prepared, or render
pages yourself."* There are **no `pdftoppm`/`magick` commands anywhere under
`bureau/runbooks/`** (verified by grep across `sir/` and `review/` prompts and scripts — zero
hits). Zoom is treated as a first-class *disposition* instead (see §4).

### Plugin skill (the concrete recipes)

`prompts/phase1-vision.md`:
- **Step 0 (lines 22–33) — resolve host tooling first.** Worth copying: do *not* trust a bare
  binary on PATH, because *"on some hosts `/usr/bin/pdftotext` is a 0-byte stub that emits
  empty output (and silently makes a real PDF look 'scanned'/empty)"*. It probes
  `/opt/homebrew/bin`, `~/.homebrew/bin`, `/usr/local/bin` into `$PDFTOPPM` / `$PDFTOTEXT` /
  `$MAGICK`. Fallback if ImageMagick is absent: **crop with `pdftoppm` region flags
  (`-x -y -W -H`) at the target DPI**, or a small PIL crop — never fail the phase.
- **Step 1 (39–43) — two render passes:** `pdftoppm -r 300 -png` for bulk extraction,
  `pdftoppm -r 600 -png` (`-hires` suffix) for fine print in the title block, scale bar,
  dimension labels.
- **Step 2 (49–56) — quadrant crops off the *hi-res* render:**
  ```
  magick <prefix>-hires-1.png -crop 50%x50%+0+0     crop-NW.png
  magick <prefix>-hires-1.png -crop 50%x50%+50%+0   crop-NE.png
  magick <prefix>-hires-1.png -crop 50%x50%+0+50%   crop-SW.png
  magick <prefix>-hires-1.png -crop 50%x50%+50%+50% crop-SE.png
  ```
  plus `crop-drawing.png` / `crop-tables.png` when the sheet splits drawing from tables.
- **Why** (`references/phase1-vision.md:67`): *"Cropping reduces the number of pixels the
  vision model has to attend to per call, raising the precision of every measurement."*
- **Step 6 (86–92) — scale calibration ties DPI to feet:** from a `1"=20'` title block,
  300 DPI → 1 px = 0.0667 ft; 600 DPI → 1 px = 0.0333 ft. Every measured feature records
  pixel count + DPI + converted feet.
- **Failure modes (94–99):** image too low-res for fine print → re-render higher; rotated
  plan → de-skew (`magick -deskew`) *before* measuring.
- Targeted re-zoom on disagreement (`references/failure-modes.md:9`): *"Re-crop the affected
  region at higher zoom; re-run only that crop."*

---

## 4. Synthesis / conflict resolution — `reconcile.md`

The strongest file in the set and the best template for the new runbook. It is a **third
sub-agent** that sees only the two readings plus the renders.

**The governing rule (lines 7–11):**
> **"Mark every disagreement rather than picking a winner."**
> *"A value the two readers disagree on is a **data gap**, not a fact. There is exactly one
> exception, below, and it is narrow."*

**Deliberate blindness (line 5):** *"You did not watch either read happen, and that is
deliberate... If you find yourself reasoning about which reader is 'usually right', stop: you
have no such evidence."*

**Input containment (line 15):** the two readings + renders + text layer, *nothing else*.
*"Do not go back to the jurisdiction, the seed file, or the web to break a tie: this output
is what the plan says, and importing an outside answer launders a research finding into an
extraction."*

**Order of work (§1–§7b):**
1. **Scheme determination first** (19–21) — before reconciling a single value; check B's call
   yourself; if several schemes, reconcile *within* each.
2. **Sheet inventory** (23–25) — every page gets exactly one row, including "catalogued,
   deliberately not mined." *"A page with no row is indistinguishable from a page nobody
   opened."* Sheet identity is mechanical → resolve it, don't gap it.
3. **Load-bearing fields** (27–29) — record **both** readers' verbatim strings, always.
   Confirm a second independent way (text-layer grep **or** a higher-DPI targeted crop
   re-read); *"a field checked neither way cannot be counted confirmed."* Identical+confirmed
   → confirmed; whitespace/case-only delta → equivalent, noting what differed; anything else
   → data gap **with no value**.
4. **Quantities** (31–33) — one entry holding **both** values plus which reader(s) stand
   behind the reconciled one (*"a quantity that doesn't say who supports it is
   indistinguishable from a consensus one, and only one of those is evidence"*). Both agree →
   agreed; one saw it → single-reader; neither → unresolved. **The one narrow exception:** a
   *measured* value (no printed label) within **5%** may be averaged, recording the delta.
   *"A disagreement on a **printed label** is always material — one reader misread it, and
   the midpoint of a misread is not a measurement."*
5. **Acreage: declared vs derived** (35–37) — plan's declared acreage recorded *beside*
   geometry-derived; never averaged, never silently preferred.
6. **Circulation / orientation / features / callouts** (39–44) — circulation always gets a
   block per scheme; orientation records plan-north and whether both readers read it the
   same, never "assume north is up."
   - **§6a "Direction comes from measurements, never from a reader's words"** (46–53) — the
     single exception to "never pick a winner": *"When a compass label conflicts with a
     measurement, the measurement wins — and the conflict is ledgered, not silently
     dropped... because the measurement is evidence and the direction word is a restatement
     of it."*
7. **The data-gap ledger** (55–57) — one entry per unresolved thing: stable id, both
   positions, and a **disposition**: `disclose` / `needs-higher-dpi-read` / `needs-source` /
   `needs-operator` / `needs-engineer`. Crucially: *"do not resolve a gap by re-reading the
   sheet a third time yourself and declaring a winner — a third read performed alone is a
   single read again; if a higher-DPI crop would settle it, that is the disposition, and
   **your spawner decides whether to spend it**."* → **this is how zoom-in is actually
   requested: as a costed disposition escalated to the orchestrator, not a unilateral
   re-read.**
   - **§7a** (59–61) — walk *both* readers' internal-contradiction lists item by item,
     confirming each has a ledger **id**. *"(A real run dropped four this way.)"* A
     contradiction only one reader raised still gets an entry: *"silence is not
     corroboration."*
   - **§7b** (63–75) — a disposition table with explicit do-NOT columns.
     `needs-higher-dpi-read` is wrong when text is **occluded**: *"No DPI recovers pixels
     that were never drawn."* And check the text layer first — a run once ledgered an
     occluded `ONCOR ELE` as unclosable while the text layer held `ONCOR ELECTRIC`.

**Outputs (77–89):** `plan-extraction.json` + `plan-extraction.md`, same content. The
markdown is written as a **clean first-time statement**, not a diff: *"the reader of the
final deliverable never sees reader A or reader B. Disagreements appear as 'the drawing set
is not self-consistent about X'... never as 'reader A said 5,200 and reader B said 4,800'
woven through the prose."* Every gap id in the JSON appears as a string in the markdown, and
**"the prose may never assert what the ledger holds open."**

---

## 5. Models, effort, and how subagents are spawned

**Model/effort policy** — `bureau/runbooks/sir/RUNBOOK.md:16`:
> *"Every spawn — phase orchestrators and their workers alike — EXPLICITLY specifies its
> model; never leave it to inherit (an unspecified spawn inherits the spawning session's
> model, which may be Fable — Fable is not used for phase orchestrators or workers). **Opus**
> for orchestration, research leg leads, disciplines, and adversarial passes; **sonnet** for
> format-following work...; **haiku** for mechanical children whose output is copied rather
> than composed... Haiku never writes composed prose. Where the spawn carries a
> reasoning-effort setting: **high for orchestrators and adversarial passes, medium for
> research legs and disciplines, low for mechanical children**."*

The review runbook's version (`review/RUNBOOK.md:16`) is the same with a stronger tail:
*"reading a drawing, deciding whether the plan meets a rule, grading a deficiency, writing a
comment"* are all opus, and **"When in doubt, opus."** Reading a drawing is explicitly named
as judgment work → **both readers and the reconciler are Opus**. Effort is not separately
pinned for the readers; they sit between "orchestrator" and "research leg", so medium–high.

Reinforced as convention §19 (`sir/prompts/shared-conventions.md:34`) and review §25.

**Spawn topology:**
```
operator-facing session (opus)          RUNBOOK.md — never does phase work inline
  └─ phase-1 orchestrator (background opus)   prompts/phase-1/phase-1.md
       ├─ reader A      (own sub-agent)  reader-a-literal.md   ── never see
       ├─ reader B      (own sub-agent)  reader-b-meaning.md   ── each other
       ├─ reconciler    (own sub-agent)  reconcile.md          ── sees only the 2 files
       └─ adversarial reader (background) over the readout draft
```
Isolation rule — `readers/README.md:9`: *"Each spawn gets only its own brief. Neither reader
ever sees the other's output, both write the same section skeleton, and the reconciler sees
the two files and nothing else — two readings from separate contexts cannot converge on one
another's mistakes."*

Kickoff mechanics (`sir/RUNBOOK.md:60`): *"a background opus sub-agent with just a few lines
of prompt directing it to read `prompts/phase-1/phase-1.md` (its full instructions, as an
absolute path) and giving it the absolute run dir. **Have it name what it read when it
reports back, so a skipped read is visible.**"*

Two more conventions that shape spawning (`shared-conventions.md:29, 35`): **§14** *"When you
dispatch N workers, count N non-trivial outputs back, and read enough of each to confirm it
isn't a stub"*; **§20** *"The harness notifies you when an agent you spawned finishes — never
set a timer or polling loop to watch one."*

Nesting depth (review only, `review/RUNBOOK.md:64`): requires
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=4` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=50`;
defaults of 3/20 silently withhold spawning at the last level.

**Plugin-skill equivalent** (`skills/diligence-report/prompts/phase1-vision.md:58-66`):
"Spawn two subagents in parallel" — Gemini 3.1 Pro via `vision_transcribe` (defaults
`google/gemini-3.1-pro-preview`) or `agent-browser`, and Opus 4.7 via the standard vision
tool. Explicit vendor warning: *"Do NOT use Gemini 2.5 for recorded-instrument/plat text — it
confabulates dense small-print notes"* (retired for confabulation, per
`references/phase1-vision.md:29,73`). Outputs kept separately for audit as
`gemini-3.1-pro-extraction.md` and `opus-4.7-extraction.md`.

---

## 6. Escalation-to-human patterns

### In the runbook (lean, 4 levers + 2 stops)

`sir/RUNBOOK.md:47-54` "Judgment levers" — **Deepen freely** (no permission needed); **Call
for adversarial review on suspicion**; **Cut corners only when told** (*"Undisclosed
corner-cutting is the one unforgivable move"*); and:

> **"Stop and escalate.** If something makes the run's premise wrong (wrong parcel, wrong
> jurisdiction, a plan that contradicts the request), stop the phase and report to the
> top-level runner rather than building on a broken frame."*

Two mandatory stops (`:33-45`): **HITL1** frame confirmation (phase-1 orchestrator authors
`hitl/hitl1-readout.md`; runner presents in chat; decision recorded verbatim in
`hitl/hitl1-decision.md`; corrections go to a *fresh* phase-1 orchestrator scoped to exactly
what changed) and **HITL2** the acquisition question. Delivery: operator reads the real PDF;
publishing only on explicit "publish".

**The presentation-signal rule** (`:52`): *"Every HITL readout gets one adversarial pass over
the draft BEFORE the file is written to `hitl/` — the file landing there is the presentation
signal. Fix what it finds; note what stands. Once the operator has ruled, the readout is
never rewritten; a late correction goes to the operator as a message."*

**Escalation from the two-pass step specifically** is indirect and deliberate: the readers
never escalate (illegible/absent are *answers*, recorded); the reconciler never escalates
either — it emits ledger dispositions, and `needs-operator` / `needs-engineer` /
`needs-higher-dpi-read` are what surface upward. `needs-operator` is scoped tightly
(`reconcile.md:71`): use it *"when only the applicant knows: intent, retention, program"*,
not when the drawing already says it.

Other hard escalations: `sir/prompts/phase-1/phase-1.md` Duty 2 — a Street View walk captured
*before* the access trace exists "must be redone"; convention §16 — *"No CAPTCHA defeat; no
paid tiers without authorization. A paywall or interactive wall is a 'Need you?' item for
HITL2, not a challenge."*; convention §17 — mechanical checks **advise, they don't block**:
*"when one fails, fix what it found or disclose it in the deliverable — never ignore a
failure."*

### In the plugin skill (heavy, formal)

`references/hitl-protocol.md` is the full spec — four interaction classes: **GATE** (blocking,
via `AskUserQuestion` when the answer is a choice, plain blocking question when free-form;
*"A GATE never proceeds on an assumed answer"*), **FLAG** (non-blocking, batched to the Phase
4.5 checkpoint), **APPROVAL** (a GATE authorizing money/publishing/shared-state mutation —
must state the cost; five of them: paid purchase, jurisdiction bootstrap, learn-back merge,
delivery sign-off, publish), **CHECKPOINT** (mandatory pause; two exist — Phase 2.5
orientation, Phase 4.5 research).

Relevant to the two-pass step, `hitl-protocol.md:56`:
> *"Phase 1 vision disagreement (phase1-vision) | **FLAG** by default; **GATE** only if the
> disputed value feeds a Phase 0/2 gate (e.g. a parcel boundary)"* — batches to 4.5 by
> default, but surfaces early at HITL1 when frame-relevant (boundary, jurisdiction, zoning
> read).

Also worth stealing: the **threading rule** (`:27-29`) — a decision is recorded under a
stable `topic`, and *"Any later phase that needs that decision **reads the ledger entry
instead of re-asking**"*; revisiting opens a new entry noting supersession, never silently.
Persistence lands in three places (`hitl/`, append-only `hitl/ledger.md`, and the phase
manifest's `decisions[].hitl`) — this scheme exists because *"three recent runs recorded
their HITL session in three different structures... three faithful executions, three
inventions. One scheme now."* And `:74` — a GATE/APPROVAL in a headless runtime degrades per
that runtime's rules but *"never silently assumes a 'yes' on an APPROVAL."*

---

## 7. The new-review runbook — and what it means for a preprocessing runbook

### Does review have document analysis? No — it *assumes preprocessing already happened*.

`bureau/runbooks/review/RUNBOOK.md:20` — "What the run is given":
> *"**A pre-processed site plan submission, already on disk**: the plan set as a vector PDF,
> typically 30–100 sheets, split into single-sheet PDFs, sheet rasters and per-sheet
> transcriptions, plus the documents submitted with it (drainage report, traffic
> determination, permit packets, environmental studies). **Nothing is fetched at review
> time.**"*

`review/prompts/phase-1/phase-1.md:9,13,15` is explicit that the review runbook **verifies
rather than rebuilds**:
- *"The plan set is already processed and on disk — one folder per sheet holding the
  single-sheet vector PDF, a raster and the transcribed text blocks, indexed by the
  workspace's own README."*
- Duty 1: *"The pre-processed workspace already inventories itself — its README indexes every
  sheet with a title and a one-line description, and its manifest records where every file
  came from — **so verify rather than rebuild**"*: every indexed sheet folder present, every
  document accounted for, and the workspace's stated identity (project name, case/permit
  number, submission version, plan date, engineer of record, declared sheet total) matching
  the cover sheet as filed **and** the operator's request. A mismatch is a readout finding; a
  premise-breaking one stops the phase.
- Duty 2: *"**Pre-processing has already transcribed every sheet, so phase 1 does not re-read
  the set.**"* Only the cover sheet + the site-plan/dimensional-control sheets get a close
  read, *"from the vector PDF against the existing transcription blocks, and **record any
  disagreement between the two as a transcription defect for the readout** rather than
  silently preferring either."*

Confirmed in the design handoff — `scratch/review-freeform/HANDOFF.md:20`: *"**Phase 1 trusts
pre-processing. No dual read**; the close read is the cover sheet + the site-plan sheet(s)
the pre-processed index names, read from the vector PDF against the existing transcription;
the inventory is verified, not rebuilt."*

So: **the review runbook dropped the two-pass read on purpose, on the assumption
preprocessing is trustworthy — and there is a live, evidenced finding that it is not.** (See
`preprocessing-transcription-handoff.md` in this packet for that evidence; corroborating
conventions already in the review runbook at `review/prompts/shared-conventions.md:12-15` —
§3 "the vector plan PDF is the authority; the per-sheet transcriptions are a convenience
layer over it," §5 "**A negative reached only by searching text is not a negative.**")

### Where the current staging code lives

- `conductor/src/shared/project-downloader.ts` — the workspace builder. Writes
  `primary-site-plan/<plan-set-dir>/sheet-NN/` holding `guide.md`, `blocks.md`, `block-N.md`
  (lines 913–914, 969, 1041), plus `block-manifest.json` (460), `plan-set-versions.json`
  (788), and the `README.md` index (992–1002). Comments in the file record prior silent-loss
  incidents (1184: duplicate plan-set dirs overwriting each other's `guide.md`/`blocks.md`
  silently; 1219: *"were lost on every review run. Nothing errored; the README listed
  three..."*).
- `substation/src/inngest/functions/process-file/sheet.logic.ts` and
  `substation/supabase/migrations/20260708120000_sheet_version_block_numbering_scheme.sql`.
- ⚠️ `sheet_version` has **FOUR** workspace builders (memory:
  `reference_sheet_version_has_four_workspace_builders`) — a fix to one misses the others;
  find all consumers before changing output shape.
- The staged workspace is pure script, cheap to re-run: *"v4 Lamar: 57 sheets / 14 docs,
  95 s, zero tokens."* Ground truth for validation sits read-only on powerstation at
  `/home/powerstation/noetic/working/review/austin-1700-s-lamar/plan-set/`.

---

## 8. How runbooks are structured and initiated — the template to copy

**There is no slash command and no `commands/` entry.** A runbook is started by the operator
pointing an interactive Claude Code session at `bureau/runbooks/<name>/RUNBOOK.md` and letting
it act as top-level runner. `bureau/docs/runbooks.md:3`: *"a Claude Code session reads a
`RUNBOOK.md`, spawns phase orchestrators as sub-agents, and stops at human checkpoints for
judgment. They run locally on subscription tokens."*

**Anatomy (identical in `sir/` and `review/`):**
```
bureau/runbooks/<name>/
  RUNBOOK.md      # top-level runner's instructions — roles, model discipline,
                  # folder contract, phases+stops, judgment levers, kickoff steps,
                  # register rule
  prompts/
    shared-conventions.md         # binds every agent in the run; numbered rules
    phase-N/phase-N.md            # one orchestrator prompt per phase
    phase-N/<role>.md             # worker briefs (readers/, researchers/, …)
    phase-N/hitlN-readout.md      # readout FORMAT (+ …-example.md in sir/)
    tool-bug-sweep.md             # post-delivery sweep of the run's tool-bugs.md
  scripts/                        # runbook-specific deterministic helpers
  checks/*.yaml                   # advisory check registry for lib/fix_checks.py
bureau/runbooks/lib/              # shared code; lands here by MOVING, never copying
```

**The five structural conventions any new runbook should mirror:**

1. **Runner does nothing but talk to the operator.** `RUNBOOK.md:7-12` — four jobs only:
   capture request verbatim into `ADDENDUM.md`; spawn one phase orchestrator at a time
   (background) then sit idle; run the HITL conversations; relay operator directives by
   messaging the running orchestrator. *"NEVER do phase work inline — a top-level session
   executing steps inline can easily burn through the context window and force a mid-run
   handoff. Your context is reserved for the operator."*
2. **The folder contract is the API, the resume mechanism, and the audit surface**
   (`:24-37`). Each phase owns one folder; the next phase reads only that folder's **declared
   files**, following links. *"An orchestrator may write any additional files it finds
   useful, but every extra file must be linked from a declared file — an unlinked file is
   invisible downstream by design."* A fresh session can pick up any run from the folders
   alone. Each phase prompt ends with a **"Declared outputs (the phase contract)"** section
   (see `review/phase-1.md:27-36`).
3. **`ADDENDUM.md` is written once at kickoff and never updated mid-run** (`:72` / `:65`) —
   decisions land in `hitl/`, work lands in phase folders. One exception: a migrated run's
   addendum also says which phases arrive already satisfied and where the legacy artifacts
   live, and orchestrators skip accordingly. *(This exception is the natural seam for a
   preprocessing runbook to hand off into review.)*
4. **Prompts carry judgment, not step machinery.** `bureau/docs/runbooks.md:5`: *"A runbook
   is prompts and a few scripts — no step machinery. Judgment lives in the orchestrators,
   checks advise rather than block... This replaced the step-numbered pipeline approach for
   SIR authoring, whose recurring defect class was **its own checking machinery silently
   failing**."* Every phase prompt says the outcomes are fixed and the route is the
   orchestrator's ("How you get there is yours" — `review/phase-1.md:7`).
5. **Register rule** (`:74-76`) — client-facing artifacts never use the runbook's process
   vocabulary. *"Write like a plan reviewer, not like this runbook."*

**Run output lives outside the repo** — `~/noetic/working/<name>/` (`docs/runbooks.md:7`);
SIR uses `working/sir/<customer>-<project-slug>/`, review uses
`runs/<jurisdiction>-<project-slug>/`.
