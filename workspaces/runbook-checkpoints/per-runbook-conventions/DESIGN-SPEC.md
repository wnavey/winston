# Per-runbook conventions: runbooks choose the parts of AGENTS-core they get, and the run declares its answer-key posture

**Status:** Draft v1
**Date:** 2026-09-28
**Companion:** `conventions.html` (same folder): the diagrams for everything below.
**Prompted by:** `workspaces/runbook-checkpoints/bugs/AGENT-RULE-19-BUG.md` (winston#284), and Will's question on 2026-09-28: *"the AGENTS-core rules make sense for SOME runbooks, like review and sir. But rule 19 bars the jurisdiction's own review comments, and we literally have a runbook called process-city-response-docs whose whole job is to process them."*
**Repos touched:** `conductor2` (`write_conventions` reads a fragment list and an answers posture from `runbook.yaml`, inherits the posture from outer runs, and writes it where scripts can read it), `bureau` (split `runbooks/lib/AGENTS-core.md` into fragments with stable rule ids, declare `conventions:` + `answers:` in every `runbook.yaml`, re-point 13 rule-number citations)
**Repos NOT touched:** `substation`, `cityhall`, `claude-plugins`, the database. (The document-authorship data fix in the bug doc is a separate spec; §6 shows where it plugs in.)

---

## 1. Problem

### 1.1 One rulebook, concatenated in front of every runbook

`conductor2/src/verbs/mod.rs:219-237` `write_conventions()` builds a run's `AGENTS.md` by concatenating two files, unconditionally:

```rust
let core = runbooks_dir.join("lib/AGENTS-core.md");      // 21 rules, 42 lines
...
let rb_agents = runbooks_dir.join(name).join("AGENTS.md");  // the runbook's own, if any
std::fs::write(root.join("AGENTS.md"), agents)?;
std::fs::write(root.join("CLAUDE.md"), "@AGENTS.md\n")?;
```

It runs for every top-level run (`setup`) and every sub-run (`runner: runbook` materialization), so every agent in every conductor2 runbook reads all 21 core rules. The only way a runbook can change a core rule is the core's own line 3: *"Where this core and the runbook's own `AGENTS.md` disagree, the runbook's own file wins."* So the only override is to contradict the rule, and a contradiction is a tie the model breaks at read time.

### 1.2 The core is four rulebooks glued together

Grouping the 21 rules by what they're about (`bureau/runbooks/lib/AGENTS-core.md`):

| Group | Rules | What they govern |
|---|---|---|
| **craft** | 1, 7, 10, 11, 12, 14, 16, 17, 18 | how any agent step works: no prose arithmetic, reuse on-disk data, `SUPERSEDES:`, append long files, count back delegated work, `tool-bugs.md`, `scratch/`, gaps not inventions, finish inside the session |
| **sourcing** | 2, 3, 4, 5, 6, 8, 9, 13, 15 | research against outside sources: GIS magnitude checks, zero-with-a-control, "not published" needs an attempt, headless vs headed browsing, expected vs got, PDF table row counts, cite what you read, retrieve documents named by number, sampling |
| **answer bar** | 19, 20 | never read this run's answers: prior Noetic output about the project, and the jurisdiction's review comments on this case |
| **client register** | 21 | "regulations" not "laws"; no process vocabulary in client-facing text |

### 1.3 Most runbooks already fight the core

The ten conductor2 runbooks (`bureau/runbooks/*/runbook.yaml`) and their own `AGENTS.md`:

| Runbook | Own AGENTS.md | Where the core does not fit |
|---|---|---|
| review | 49 lines | fits: its evals are the reason the bar exists |
| sir | 6 lines | fits |
| site-research | 13 lines | fits; says itself it "does not know which consumer it serves" and binds the bar identically under review and sir |
| preprocessing-v4 | 49 lines | **rule 19 contradicts its job.** It reads every document it is staged; on Valley View the reader read / refused / read / withheld the city's MCR across four runs (bug doc §Symptom). Sourcing (GIS, browsing, sampling) and client register are irrelevant; its rule 16 is its own register. But it *does* use the prior-output half: `preprocessing-v4/scripts/stage.py:22` and `steps/1.2-stage/step.yaml:7` justify not staging the previous reading layer by "core rule 19". |
| anchor-geometry | 31 lines | **rule 19 contradicts its job.** It fits frames "to the SIR's county parcel" (`runbook.yaml:3`); an SIR is named in rule 19 as barred prior Noetic output about the property. Sourcing and client register are irrelevant (its rule 7 is its own register). |
| extract-geometry-v2 | 43 lines | sourcing and client register irrelevant; its rule 12 is its own register |
| guide-training | 3 lines | trains "from historic reviewer comments" (`runbook.yaml:6`), which rule 19 allows only because they're other cases; carries its own narrower bar ("never open `atomic-mcr*`") |
| prospector (+ 11 sub-runbooks: regulatory, fees, comment-harvest, review-guides → guide-training, …) | none | gets the whole core; `comment-harvest` loads historic reviewer comments into the Library DB; "researches public jurisdictions and holds no client's work" (`conductor2/src/verbs/mod.rs:247-248`, the reason its sandbox is off) |
| smoke, smoke-package | 10 / 5 lines | test fixtures: "do the least work"; sourcing, bar and register are noise |

And **process-city-response-docs**, whose whole job is to read the city's MCR and redlines into CRC guides, is still a prose `RUNBOOK.md` (not a conductor2 graph), so it doesn't get the core today. **It will contradict rule 19 on the day it is ported.**

### 1.4 The bar belongs to the run, not the runbook

site-research runs as a sub-run under review (`review/steps/1.4-site-research`) and under sir (`sir/steps/1.2-site-research`), and must be barred inside both. guide-training runs as a sub-run of prospector (`prospector/review-guides/steps/3-train`). So whether an agent may read the answers depends on **the outermost run**, not only on the runbook the agent is in.

conductor2 already has exactly this shape for the OS sandbox: `sandbox_enabled()` (`mod.rs:239-262`) reads the **outermost** runbook's `runbook.yaml` via `procs::outermost_run`, and a sub-runbook "cannot loosen a run whose outermost runbook did not declare it". The answer bar needs the same rule.

### 1.5 Prose can't enforce the bar where it matters most

The worst case in the bug doc isn't an agent reading the MCR. It's review's deterministic staging (`runbooks/lib/stage_submission.py:975`, `submission_db.py:308-311`) copying the city's comments into `supplementary-docs/` with no agent involved. No `AGENTS.md` reaches a Python script. Anything this spec does to the prose has to leave a machine-readable posture that staging code can check later (§6).

---

## 2. Proposal in one paragraph

Split `lib/AGENTS-core.md` into **four fragment files** under `lib/conventions/`. Each `runbook.yaml` declares **which fragments it gets** (`conventions:`) and **what its agents may read of the answers** (`answers: barred | prior-output | open`). conductor2 concatenates the chosen fragments, then the one answers file the **effective** posture selects, then the runbook's own `AGENTS.md`. The effective posture is the **strictest** posture declared anywhere from the outermost run down to this one, so a sub-run can tighten but never loosen. conductor2 also writes the effective posture to `.conductor/conventions.json` so deterministic scripts can enforce it. Rules get stable ids instead of numbers, and the "runbook file wins where they disagree" sentence goes: a rule that doesn't fit is left out, never contradicted. There's no template engine; choosing fragments and the posture is just choosing files.

This is option **A** (fragments) plus option **C** (posture) from the 2026-09-28 brainstorm; §8 records why B and D were not chosen.

---

## 3. Decisions

### D1. Four fragments, split along the §1.2 groups

```
bureau/runbooks/lib/conventions/
  craft.md               rules 1, 7, 10, 11, 12, 14, 16, 17, 18   (every runbook)
  sourcing.md            rules 2, 3, 4, 5, 6, 8, 9, 13, 15
  client-register.md     rule 21
  answers-barred.md      rules 19, 20 as today
  answers-prior-output.md  the prior-output half of 19 + an explicit "the case's documents are in bounds" line (D4)
```

`craft` is mandatory. conductor2 prepends it whether or not it's listed, because rules like `tool-bugs.md` (14), `scratch/` (16) and "finish inside the session" (18) are machinery that contracts and `contract-helpers.ts:724` already assume. The answers files are **not** fragments a runbook lists; they're chosen by the posture (D3).

Four is a judgement call. Two (`craft` + answers) would leave sourcing noise on PPv4, geometry and smoke; six or more starts to become option B by another name. See Q3.

### D2. `runbook.yaml` declares `conventions:` and `answers:`

```yaml
# review/runbook.yaml
conventions: [sourcing, client-register]   # craft is implicit
answers: barred

# preprocessing-v4/runbook.yaml
conventions: []
answers: prior-output

# anchor-geometry/runbook.yaml
conventions: []
answers: open
```

**Missing keys mean today's behaviour:** `conventions` absent → `[sourcing, client-register]`; `answers` absent → `barred`. A runbook nobody touches assembles the same rules it gets now (only the rule labels change, D5). That makes the conductor2 change safe to ship first, and it means the default is the strict posture, same as the sandbox default: forgetting the key never opens the answers.

An unknown fragment name or posture fails `conductor setup` (and `conductor check`) with the list of valid values, not a silent skip.

### D3. The effective posture is the strictest in the run chain

Order: `barred` > `prior-output` > `open`.

```
effective(run) = max( declared(outermost), …, declared(parent), declared(this runbook) )
```

Implemented beside `sandbox_enabled()`, reading each ancestor run root's runbook name the way `procs::outermost_run` already walks up. Consequences:

| Chain | Declared | Effective | Why this is right |
|---|---|---|---|
| review → site-research | barred, barred | barred | unchanged |
| sir → site-research | barred, barred | barred | unchanged |
| prospector → review-guides → guide-training | open, open, prior-output | prior-output | a sub-run keeps its own bar under an open parent (`atomic-mcr*` stays barred) |
| smoke → smoke-package | open, open | open | fixture |
| a future review that nests preprocessing-v4 | barred, prior-output | **barred** | PPv4 run *inside* a review must not read the answers, even though PPv4 alone may |

The last row is the reason for "strictest wins" instead of "outermost wins". The sandbox can use outermost-only because it's a boolean that only the outer run relaxes. Posture has to hold in both directions: an open parent can't loosen a barred child, and a barred parent can't be loosened by an open child.

### D4. Split the bar into its two halves

Rule 19 bars two different things in one sentence, and the runbooks that trip over it need them separately:

| Half | Content (from rule 19) | Who needs it |
|---|---|---|
| **prior output** | any prior Noetic output about this project or property: previous comment reports, SIRs, review tables, `eval/` and scoring paths, anything named like ground truth or an answer key | review, sir, site-research, **preprocessing-v4** (`stage.py:22` uses it to skip the previous reading layer), guide-training (`atomic-mcr*`) |
| **case comments** | the jurisdiction's own review comments on this case: case file, permit attachments, staff report, the applicant's comment-response letter | review, sir, site-research only |

So the three postures render as:

- **`barred`** → `answers-barred.md`: rules 19 and 20, today's text.
- **`prior-output`** → `answers-prior-output.md`: the prior-output half, plus one explicit line that closes the Valley View tie: *"The jurisdiction's documents on this case, its comment reports and completeness results included, are in bounds: read every document you are staged. Whether a later consumer may see them is enforced where that consumer stages its inputs, not here."* It keeps rule 20's "state it in every sub-agent prompt" for the half that remains.
- **`open`** → nothing. anchor-geometry reads the SIR by design; smoke has nothing to protect.

This is where C adds something A can't: `prior-output` isn't just a smaller subset of rules. It includes an **affirmative** statement, and without it a PPv4 reader facing an MCR would still have to decide on its own.

### D5. Stable rule ids replace numbers

Each rule keeps its text and gains a bracketed id that's unique across all fragments, e.g.

```markdown
- **[craft.count-back]** When you delegate N pieces of work, count N non-trivial results back …
- **[sourcing.zero-control]** Never report a zero without a control. …
- **[answers.prior-output]** Any prior Noetic output about this project or property is barred …
```

Numbers stop meaning anything once a run can assemble 9, 18 or 21 core rules. The sweep covers the **13 live citations** found on 2026-09-28 (`grep -rnE "(AGENTS-core|[Cc]ore)(.s)? rules? [0-9]+|AGENTS\.md rules? [0-9]+"` minus `examples/`):

| File | Cites |
|---|---|
| `sir/steps/README.md:74` | core rule 14 |
| `sir/steps/3.0-geometry/contract.test.ts:27` | rule 1 |
| `preprocessing-v4/steps/1.2-stage/step.yaml:7` | core rule 19 |
| `preprocessing-v4/scripts/stage.py:22` | core rule 19 |
| `review/AGENTS.md:15` | core rule 14 |
| `review/AGENTS.md:39` | core's rule 18 |
| `review/steps/2.8-premises/contract.test.ts:131` | AGENTS-core rule 1 |
| `review/scripts/annotate-disposition-check.ts:4` | AGENTS-core rule 12 |
| `review/scripts/lib/annotate-merge.ts:387` | AGENTS-core rule 12 |
| `review/scripts/KNOWN-ISSUES.md:8` | AGENTS-core rule 14 |
| `lib/contract-helpers.ts:724` | core rule 14 (inside an assertion message) |
| `site-research/bin/arcgis_query.py:18` | AGENTS-core rule 3 |
| `site-research/steps/8-repair/prompt.md:14` | core rule 14 |

The six hits under `*/examples/**/_eval/` and example findings are frozen snapshots of past runs, and they stay as written. Runbook-local rule numbers (`review/AGENTS.md rule 9`, `preprocessing-v4` rule 14) are out of scope; they live in one file and don't shift.

### D6. No override by contradiction

`craft.md` opens with: *"These conventions are the ones this runbook chose. The runbook's own `AGENTS.md` adds to them and never contradicts them; a rule that does not fit this runbook is left out of its `conventions:`, not overridden."* The old *"the runbook's own file wins"* line is deleted, and so are the five "`../lib/AGENTS-core.md` is prepended … Where the two disagree, this file wins" preambles (anchor-geometry, extract-geometry-v2, preprocessing-v4, smoke, smoke-package). conductor2 replaces them with a generated header (D7), so the preamble can't drift from what was actually assembled.

### D7. conductor2 writes what it assembled, for agents and for scripts

The assembled `<run>/AGENTS.md` starts with a two-line generated header:

```markdown
<!-- assembled by conductor: craft, sourcing, client-register · answers: barred (declared by review; effective from review) -->
```

And `<run>/.conductor/conventions.json`:

```json
{ "fragments": ["craft", "sourcing", "client-register"], "answers": "barred",
  "answers_declared": "barred", "answers_source": "review" }
```

`.conductor/` is conductor's own directory, beside the lock, logs and the sandbox settings (`mod.rs:233-236`), and it's already off the step surface. Scripts read the posture from this file, and it's the hook for §6.

### D8. Per-runbook assignment (the proposal's content)

| Runbook | `conventions:` | `answers:` | Change vs today |
|---|---|---|---|
| review | `[sourcing, client-register]` | `barred` | none (ids only) |
| sir | `[sourcing, client-register]` | `barred` | none |
| site-research | `[sourcing]` | `barred` | drops client register (it writes "for the next agent, not for a client") |
| preprocessing-v4 | `[]` | `prior-output` | **drops sourcing, register, the case-comments bar; gains "read every document you are staged"** |
| extract-geometry-v2 | `[]` | `open` | drops sourcing, register, bar |
| anchor-geometry | `[]` | `open` | **drops the bar that forbids the SIR it fits to** |
| guide-training | `[sourcing]` | `prior-output` | drops case-comments bar (it has no case) and register; keeps its own `atomic-mcr*` line |
| prospector + sub-runbooks | `[sourcing]` | `open` | see Q5 (comment-harvest) |
| smoke, smoke-package | `[]` | `open` | drops everything but craft |
| process-city-response-docs (at port) | `[]` | `prior-output` | the MCR is its input; prior CRC guides for the project are Q4 |

---

## 4. What does not change

- The **text** of every rule that stays. This spec moves and relabels rules; it doesn't rewrite them, except for the one new line in `answers-prior-output.md` (D4) and the one-line opening of `craft.md` (D6).
- Runbooks' own `AGENTS.md` content, apart from deleting the D6 preamble.
- The sandbox rule (`sandbox_enabled`) and how it's inherited.
- `CLAUDE.md` = `@AGENTS.md`, and the file names contracts expect at a run root (`mod.rs:303` test).
- Legacy prose runbooks (`preprocessing`, `preprocessing-v3`, `process-city-response-docs` today) that conductor2 doesn't assemble.

---

## 5. Rollout

1. **conductor2**: `write_conventions` reads `lib/conventions/` **if present**, otherwise falls back to `lib/AGENTS-core.md` byte for byte. Adds the `conventions:`/`answers:` keys with the D2 defaults, D3 inheritance, D7 header and `conventions.json`, and validation in `setup`/`check`. Tests: defaults reproduce today's rule set; an open parent can't loosen a barred child; a barred parent can't be loosened; an unknown fragment fails. Ship and rebuild the cloud sandbox image (it pins conductor2).
2. **bureau PR 1**: split `AGENTS-core.md` into `lib/conventions/*.md` with ids (D5), sweep the 13 citations, delete `AGENTS-core.md`, and update `runbooks/README.md:12`. No `runbook.yaml` declares anything yet, so every run assembles the same rules as before (verify by diffing a `conductor setup` of each runbook before and after, ignoring ids).
3. **bureau PR 2**: add the D8 declarations and delete the D6 preambles. Changes that alter behaviour, which the reviewer should look at: preprocessing-v4, anchor-geometry, guide-training.
4. **Acceptance**: re-run PPv4 on Valley View v3 twice with `scope.documents` cut to the two city documents (bug doc repro §5). Both runs read both documents, and neither parks at `2.3-documents`.

Step 1 has to land and reach the cloud image before step 2. A bureau checkout without `AGENTS-core.md` on an old conductor2 would assemble runs with no core at all.

---

## 6. How this meets the bug doc's data fix (not in this spec)

The bug doc's worst case is review staging copying misfiled city documents, and no prose fixes that. What this spec contributes is a posture that code can read: `stage_submission.py` can read `.conductor/conventions.json` and, when `answers` is `barred`, exclude documents whose (future) role field marks them as the answer-bearing class. With `prior-output` or `open` it stages everything. Adding that field, backfilling it, and choosing where authorship is decided are bug-doc Q2–Q5 and belong in their own spec. This spec only makes sure the switch they'll need already exists and is set correctly for every runbook.

---

## 7. Open questions

- **Q1. Is Will's 2026-09-25 Valley View ruling the policy for PPv4?** D8 assumes yes (`prior-output`: read every staged document). If PPv4 should skip city documents instead, it stays `barred` and needs the contract's "principled refusal" disposition from the bug doc (fix direction 4).
- **Q2. The applicant's comment-response letter.** Rule 19 names it as barred (it quotes the comments). Under `prior-output` PPv4 reads it. Is that intended? It's applicant-authored, so presumably yes; the bar applies at review staging.
- **Q3. Four fragments or two?** `craft` + answers only, with sourcing folded into craft, is simpler and costs PPv4/geometry/smoke about 9 irrelevant rules. The proposal says four.
- **Q4. process-city-response-docs and prior Noetic output.** It versions CRC guides (`--versioning=bump`). Does a worker read the project's previous guides? If so its posture is `open`, not `prior-output`.
- **Q5. prospector's posture, and comment-harvest.** prospector researches public jurisdictions, so `open`. But does `comment-harvest` ever load comments on a case that's a live Noetic client project, one a later review would be evaluated on? If it can, the Library DB becomes a way to route around the case-comments bar, and prospector needs `prior-output` plus a harvest-side exclusion.
- **Q6. Should `craft` really be mandatory?** Making it listable adds flexibility nobody has asked for. The proposal says mandatory.
- **Q7. Where does a step-level exception go?** Today a step can't narrow or widen the posture. Is per-runbook granularity enough? The proposal says yes until a real case shows otherwise.

---

## 8. Alternatives considered

- **B. One template with `omit:`/`replace:` per runbook.** Finest control, and closest to "a template the runbooks modify". Rejected because it's a small patch language: nobody can read a runbook's effective rules without assembling them, and a `replace:` goes stale silently when the core rule it replaced is edited.
- **C alone (posture only).** Fixes rule 19 and leaves the other 19 rules on every runbook. It's the most important half, so it's kept inside the proposal, but it doesn't address relevance.
- **D. No shared core, plus a consistency test.** The most honest assembled file, but it's ten copies of the craft rules. A test catches silent drift but not someone forgetting to update the copies.
- **Keep the core, fix only the data** (bug doc directions 1–2). Necessary but not sufficient: anchor-geometry's contradiction with the SIR isn't a data problem, and PPv4's reader would still have to break a tie.
