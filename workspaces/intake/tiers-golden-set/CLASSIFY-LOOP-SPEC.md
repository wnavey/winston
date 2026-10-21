# Intake classify by tier: the change and the build-and-test loop

**Status:** Draft v1.2. This is a working doc for one implementation session: what changes and how
the build-and-test loop runs. It is not a full design spec.
**Date:** 2026-10-21
**Parent:** `DESIGN-SPEC.md` in this folder (v1.1, winston#329): the tiers, the golden set, §6 how to score
**Repos touched:**
- `bureau`: one PR changing `runbooks/intake-prospecting` steps 1.2–1.4. `runbooks/intake-score` changes only to read the renamed file.
- `winston`: this folder gains the scorer and the launcher.

**Repos NOT touched:** `dsd` (the Library DB is not read; see D6), `cityhall`, `substation`

> **Revision note (v1.2, 2026-10-21, Will's answers):**
> - **Q1 → D11:** the §3.5 bar is accepted as written.
> - **Q2 → D12:** the loop runs unsupervised. No pass waits for Will's approval; the §3.6 stop
>   rules are the only brakes, and each one ends in an inbox note.
> - **Q3 → §8:** the tier override at `1.5-scope` is not part of this work.
> - **Seat (D9):** every run uses the `personal` account, never `noetic`. The v1.1 fallback of
>   switching to the other seat is removed.
>
> **v1.1 (2026-10-21):** added §3.8: local lane, subscription billing, batched launches (D9, D10).

## 1. What we are doing

The tiers spec defines the question we care about: is there a **gate** (the city holds a site plan
before formal review until missing content is fixed), and if so, is it **Tier 1** (the city wrote a
content list) or **Tier 2** (it didn't)? A city with no gate is **Tier 3**.

`intake-prospecting`'s `1.4-classify` answers a nearby but different question: is a checklist
published? (`formal` / `none_found` / `inconclusive`, written to `1.4-classify/basis.json`; bureau
`origin/main` f83e018a30, `steps/1.4-classify/prompt.md`.) We change discovery and
classification so the step outputs gate and tier. Then we iterate on one bureau PR, scoring every
pass against the 15 `core` jurisdictions in `golden-set.json` until it meets the bar (§3.5).

The runbook's front half (`0-request` → `1.0-worktree` → `1.1-inputs` → `1.2-discover` →
`1.3-capture` → `1.4-classify`) stops by itself at the `1.5-scope` human gate (exit 75) when the
request says `gates: human`. Nothing past 1.4 runs during this loop.

## 2. Decisions

**D1: The output file is `1.4-classify/classification.json`**, replacing `basis.json`.
- Why the old name: the first intake-prospecting spec called the outcome the "intake basis": the
  ground the checklist stands on (a formal published checklist, or none found). With tiers, the
  file holds a classification, so the name should say that.
- Why not `classification-output.json`: the runbook names output files as plain nouns
  (`sources.json`, `manifest.json`, `items.json`, `decision.json`).
- The `basis` field stays inside the file, derived from the tier (D2), because steps 2.1 onward
  and `intake-score` read it.
- The rename touches ~22 references across `runbooks/intake-prospecting` (lib/intake.ts,
  step_verify.py, step_write.py, the 1.5/2.1/2.2 contracts, prompts, tests/fixture.ts,
  contracts.test.ts, write.test.ts) and `runbooks/intake-score` (score.py, test_score.py,
  0-request contract, score.test.ts). `intake-score` falls back to `basis.json` so old runs on disk
  still score.

**D2: What `classification.json` holds.** Everything `basis.json` holds today, plus:

| Field | Values | Rule (contract-enforced where marked ✔) |
|---|---|---|
| `gate` | `yes` / `no` / `unknown` | `yes` needs a `hold_text` or `practice` quote that shows content is screened ✔. A hold that only checks documents, fee, signature or copies is `no` (parent D10). `no` needs at least one `no_hold_text` and one `practice` quote ✔ (parent §3: silence is never enough). |
| `gate_evidence` | `[{source, quote, kind}]`, `kind` ∈ `hold_text`, `no_hold_text`, `practice`, `statute` | every `source` is in `sources.json` ✔ |
| `tier` | `1` / `2` / `3` / `null` | `null` exactly when `gate` is `unknown` ✔; `3` exactly when `gate` is `no` ✔ |
| `content_items` | an integer, the content items counted across the scope sources | Tier 1 needs ≥ 1 ✔ (parent D10) |
| `why_no_list` | `never_written` / `not_obtainable` / `withdrawn` / `null` | set exactly on Tier 2 ✔ (parent D3) |
| `basis` | derived | Tier 1 → `formal`, Tier 2 or 3 → `none_found`, `null` → `inconclusive` ✔ |

- `scope_sources` are non-empty exactly on Tier 1, as today.
- **The `none_found` rule changes.** Today `none_found` must rest on a strong-tier negative ledger
  attempt (`lib/intake.ts` `basisRules`). Tier 2 keeps that rule (a negative for the list). Tier 3
  rests on its `no_hold_text` + `practice` evidence instead, because a Tier 3 city may publish a
  checklist (Decorah IA).
- `readout.md` gains `## Gate` and `## Tier` sections above `## Basis`. `1.5-scope` reads the
  readout, so the person at the gate sees them.
- `schema_version` goes to 2.

**D3: Discovery looks for gate evidence, not only for checklists.** `1.2-discover` gains:
- **Surfaces** (ledger rows like today's):
  - the site plan section's filing and processing clauses
  - the administration / zoning-administrator-duties article (parent §4: Missouri "forthwith transmit" text is often undercut there)
  - Planning Commission minutes and packets for the last ~3 years, searched for tabled / incomplete / "contingent upon submission of" wording, and only when the code shows no hold
  - the state statute on completeness when the code is silent
- **No new `doc_type`.** `DOC_TYPES` is shared with the source registry and cc-source-citations
  (`runbooks/lib/sources/schemas.ts:11`). Minutes and staff reports stay `informational`, and
  every `sources.json` row gains `bears_on: ["gate" | "list"]`. The schema is a looseObject, so
  consumers don't break.
- **The prompt's goal and stopping rule change**: settle the gate question first, then the list.
  `process.md` gains `## Gate`.

**D4: Capture reads scanned minutes.** The golden set needed OCR for scanned minutes (parent
§4, `tools/ocr.swift`). L0 checks what `1.3-capture` does with an image-only PDF. If it returns no
words, one commit adds an OCR fallback, or marks the source `capture: false` with a reason so 1.4
says `unknown` rather than guessing.

**D5: The answer key stays out of the agents' reach.**
- The 1.2 and 1.4 barred lists gain the winston `workspaces/intake/tiers-golden-set/` folder and
  Inspector General reports. `rule19Rule` already scans tool calls; it gains those patterns.
- A bureau test fails if any prompt in 1.2–1.4 names a golden-set jurisdiction. This keeps the
  prompts generic, which Foreman already enforced on #2112.

**D6: The Library DB's extracted comments are not used in this loop.** They belong in the spec
that folds intake into prospector. Checked 2026-10-21 against the Library DB (`historic_comments`
count per jurisdiction):
- 4 of the 15 core cities have comments: Austin 151,029, El Paso 29,153, Georgetown 27,578, and
  Cedar Park 1,135. All four are Tier 1.
- Fairfax County, San Diego, Round Rock, Montgomery County and Fremont have a jurisdiction row
  and 0 comments. The six Tier 3 cities have no row at all.

So the comments could only confirm cities the classifier should already get right, and this set
can't measure whether they help. Where they do help is the gate question for trained cities:
- A stage name like San Antonio's "Completeness Review" or El Paso's "Pre-Application Review" is
  practice evidence of a gate.
- Intake-stage comments compared with the published checklist measure how stale it is (parent §9).

Once prospector trains a jurisdiction, its comments exist. The fold-in spec should add them in
`1.1-inputs` (a zero-token query, as `runbooks/guide-training/lib/library_comments.py` does with
strict name + state resolution), passed to 1.4 as `practice` evidence. Not here.

**D7: The scorer and the launcher live in winston**, in this folder beside `golden-set.json`, not
in the bureau checkout the agents work in (D5).
- `score_tiers.py --runs <dir>...` reads each run's `classification.json` (or `basis.json` for a
  pre-change run) and maps the run's slug to its golden-set id. It writes `scorecard.md` +
  `scorecard.json`:
  - the gate confusion matrix (truth yes/no × predicted yes/no/unknown)
  - Tier 1 vs Tier 2 on gated cities only
  - every miss with its predicted gate, tier, quotes and rationale
  - per-run cost and minutes
- `launch_tiers.py --set core|extended|<ids> --bureau <worktree> --out <pass dir>` writes one
  `0-request/request.json` per jurisdiction and sets each run up from the PR branch head:
  - name, state and the bureau slug, plus `gates: human` and `publish: false`
  - no `application_type_hint` and no seeds (either could leak the answer)
  - the existing bureau folder slug where one exists (`austin`, `fairfax-county`, `fremont`), a new
    one otherwise (`lenox-township-mi` style; 1.0 handles a jurisdiction bureau doesn't have yet)

**D8: One bureau PR; every change is a commit on it.** No stacked PRs. The scorer goes in one
small winston PR (P1). It is a different repo, so it is not stacked on anything.

## 3. The loop

### 3.1 Words

- **Pass**: one launch of a set of runs at one branch head, followed by scoring. Passes are
  numbered `p00`, `p01`, … and live under `~/noetic/working/intake-tiers/<pass>/`.
- **Full run (F)**: the whole front half for one jurisdiction, including live web discovery and
  capture. It costs the most.
- **Replay (R)**: re-run only `1.4-classify` on a frozen F run's captures, with the current prompts.
  It costs little, involves no web, and isolates a classify change from discovery noise.
- **Frozen corpus**: the most recent F run per city, which replays read. It is refreshed whenever a
  discover/capture change is re-run.
- **Working set**: the cities a pass is aimed at: the current misses plus 2 **canaries** (one
  passing Tier 1 and one passing Tier 3, from different states than the misses), so a fix that
  breaks something else shows up.

### 3.2 All 15, or a subset first?

Both, depending on what the commit changed:

| The commit changes | Next pass | Why |
|---|---|---|
| only `1.4-classify` (prompt, schema, contract) | **R on all 15** | Cheap, and every city is checked every time, so there is no blind spot |
| `1.2-discover` or `1.3-capture` | **F on the working set**; once the working set passes, **F on all 15** | F is the expensive pass; most discover changes target a few cities |
| both | F on the working set, then F on all 15 | the discover rule governs |

The **bar (§3.5) only counts F passes on all 15**: discovery varies run to run, and a replay
can't show that. The 19 `extended` cities are **held out**: run once at the end, never tuned on.

### 3.3 The phases

**L0: Set up and dry-run (before any prompt change).**
1. Cut the bureau branch `intake-classify-tiers` off `origin/main` in a worktree
   (`noetic-worktree bureau intake-classify-tiers`; see cut-pr).
2. Land P1 (the winston scorer + launcher) and test it on the El Paso run already on disk
   (`~/noetic/working/intake-prospecting/el-paso`, a `basis.json` run) so the scorer is proven
   before it scores anything new.
3. Prove a replay works. Copy a finished front-half run, refresh `$RUN/runbooks` from the branch
   (`cp` + `git -C $RUN/runbooks commit`, the #2112 recipe), delete `1.4-classify/` and
   `1.5-scope/`, then `conductor run-step` 1.4. Check that no path inside the copy points back to
   the original. If replays can't be made reliable, every pass is F and §3.2's first row becomes
   "F on the working set, then all 15".
4. Check D4: what capture does with a scanned minutes PDF (one of Decorah's).

**L1: Implementation commits.** One commit each, with tests updated in the same commit:
- **C1** D1 + D2: rename, new fields, contract rules, the `none_found` change, readout
  sections, fixtures, intake-score fallback.
- **C2** D3 + D5: discover's gate surfaces and `bears_on`, the barred-list additions, the
  no-city-names test.
- **C3** D4, only if L0 showed it is needed.
- Push; open the PR as a draft with the scorecard table (§3.7) empty.

**L2: `p00`, the first full picture.** F on all 15 core, as one pass started in batches (§3.8; the
first batch is the 3-run probe). Score it. Every miss
gets a one-line diagnosis in the scorecard, saying which kind it is:
- **discovery**: the evidence was never found or captured
- **judgment**: the evidence was there and the classifier read it wrong
- **key**: the golden entry looks wrong. Stop and raise it with Will; never edit the key to make a
  pass.

**L3: Iterate.** Repeat until the bar is met or the stop rule (§3.6) fires:
1. Pick the largest group of misses that share a cause. Make **one** change for it as one commit
   (prompt, schema or contract), and say in the commit message which misses it targets.
2. Run the next pass by §3.2, and score it.
3. Record the row (§3.7). If the targeted misses didn't move, or a canary broke, revert or rework
   the change as a new commit (never rewrite pushed history).

**L4: Meet the bar.** Once a pass meets the bar, run one more F on all 15 at the **same head**
with no commit between. Two passing F passes in a row at one head meet the bar.

**L5: Held-out check.** F on the 19 `extended` cities at that head, scored once and written up.
Their misses go in the PR body and the report as known limits. Tuning on them turns them into dev
data, and needs Will's call plus a new held-out set.

**L6: Hand off.**
- Publish the loop report to inspector-general (slug `2026-10-2x-intake-classify-tiers-loop`): the
  pass table, the final scorecards, the held-out result.
- Mark the PR ready.
- Run the merge-prs loop with Foreman.

### 3.4 One pass, step by step

1. Commit and push. Note the head SHA. Prompts are snapshotted when a run is set up, so a pass
   always starts **after** its commit lands.
2. `launch_tiers.py` at that head into `~/noetic/working/intake-tiers/pNN/`. It **sets up every run
   in the pass at once** (each run's prompts are copied at setup, so all of them carry this head),
   then **starts them in batches** (§3.8). Launch with python `os.setsid` (nohup/setsid fail on
   macOS), `BUREAU=<worktree>`, `CCS_PLAYWRIGHT_FROM=~/noetic/surveyor/package.json`, and
   `CONDUCTOR_SEAT` in each run's `.env`.
3. Watch `events.jsonl` (complete JSON lines only). A run is done when it parks at `1.5-scope`
   with exit 75. A run that fails before 1.4 is a **tool** failure:
   - fix it as a commit, and re-run that city in the same pass
   - count it in the pass row
   - never score it as a miss
4. `score_tiers.py --runs ~/noetic/working/intake-tiers/pNN/*` → `pNN/scorecard.md`.
5. Add the pass row to the PR body, and diagnose the misses (L2's three kinds).
6. Clean up disk: once a pass is scored, delete superseded F runs, keeping the frozen corpus and
   every scorecard. Stop and clean if free space falls under 5 GiB (13 GiB free on 2026-10-21).

### 3.5 The bar

**D11: The bar** (Will, 2026-10-21; was Q1).
On the 15 core cities, in two F passes in a row at one head:
- **gate**: 0 wrong, at most 1 `unknown`
- **tier**: Tier 1 vs Tier 2 right on all 9 gated cities (8 Tier 1 + Fremont)

The 15 core: Tier 1 is `austin-tx`, `fairfax-county-va`, `san-diego-ca`, `georgetown-tx`,
`round-rock-tx`, `montgomery-county-md`, `el-paso-tx` and `cedar-park-tx`. Tier 2 is
`fremont-ne`. Tier 3 is `lenox-twp-mi`, `conway-twp-mi`, `bangor-twp-mi`, `decorah-ia`,
`greencastle-pa` and `watertown-wi`.

### 3.6 Running unsupervised, and when to stop

**D12: The loop runs without Will** (Will, 2026-10-21; was Q2): "I want this job to be long running
without my supervision."
- **No approvals.** L0 through L5 run without asking: every pass, every batch, every commit and
  push to the bureau PR, every resume after a usage-window wait, disk cleanup.
- **The driving session keeps itself going.**
  - It watches runs in the background and is woken when a batch finishes; it doesn't poll in the
    foreground.
  - When the 5-hour window is full, it schedules a wake-up for the reset time `muni usage` shows,
    then resumes.
  - Its own context gets summarized as the loop grows long. So the PR body table (§3.7) and the
    `pNN/` scorecards are the record of where the loop is; a summarized session re-reads them
    before its next step.
- **The stop rules are the only brakes.** Each one stops the loop, leaves no run half-started, and
  files **one** inbox note for someone coming in cold: what happened, what was tried, the exact
  decision or command needed, what happens if it is ignored. The note uses
  `inbox add --to will --from intake-classify-loop --needs "<one line>"`, with the body on stdin.

| Stop rule | Trigger | Note priority |
|---|---|---|
| **Plateau** | three passes in a row with no gain on gate accuracy; the note carries the remaining misses and their diagnosis | normal |
| **Key doubt** | a miss diagnosed as **key**; never edit `golden-set.json` without Will | normal |
| **Spend** | a pass using more than 2× `p00`'s share of the 7-day window (§3.8) | normal |
| **Seat** | `personal` cannot run: its login has expired, or its 7-day window is above 85% | `--priority high` |
| **Disk** | free space under 5 GiB after cleaning every superseded run | `--priority high` |
| **Tool** | the same tool failure (not a classification miss) on a re-run after one fix attempt | normal |

- **The loop stops at L6 and checks in.** When the bar is met and the held-out pass is written up:
  - publish the IG report
  - mark the bureau PR ready
  - leave Will a note and stop
  
  Merging (the merge-prs loop with Foreman) starts on Will's go, as does merging the winston P1 PR.
  Until P1 merges, the loop runs the scorer from P1's branch.

### 3.7 What gets recorded

- **The PR body**: one table row per pass: `pass | head | kind (F15 / Fws / R15) | cities | gate
  right / wrong / unknown | tier right on gated | batches | 5h / 7d window used | list $ | minutes |
  what changed next`.
- **`~/noetic/working/intake-tiers/pNN/scorecard.{md,json}`**: the full detail; it survives disk cleanup.
- **The IG report** at L6.

### 3.8 Lane, billing and batches

**D9: Every run is local lane, subscription billing, on the `personal` account** (Will,
2026-10-21).
- Each run's `.env` pins `CONDUCTOR_SEAT=personal`, the El Paso recipe.
- Never `noetic`, and no AI Gateway or cloud.
- **Check `muni accounts` before each pass.** `personal`'s login expires 2026-10-22, the day after
  this spec. An expired login is the **Seat** stop rule (§3.6).

**D10: A pass is one group of runs, launched in batches.**
- **One group.** Every run in a pass shares one pass dir and one head, and is scored as one
  scorecard. Batching only changes when each run starts.
- **Set up all at once, start in batches.** `launch_tiers.py` sets up every run first, so a later
  batch can't pick up a newer commit. No commit lands on the branch until the whole pass is
  scored.
- **The first batch is a probe.** Start 3 runs: one Tier 1, one Tier 2, one Tier 3. Before
  starting, record `muni usage --refresh` for the pinned seat. When the batch parks at
  `1.5-scope`, record usage again and divide the change in the 5-hour and 7-day columns by 3. That
  is the per-run cost, written in the scorecard.
- **Later batches are sized from the probe.** Batch size = the runs that fit before the seat
  reaches 85% of its 5-hour window, at most 5. When fewer than 1 fits, wait for the window to
  reset (`muni usage` shows when) and continue on `personal`.
- **Batches mix tiers**, so a pass stopped half-way still shows a spread.
- **One batch at a time.** The next batch starts only when every run in the current one has
  parked at `1.5-scope`, failed, or been stopped.
- **A run cut off by the usage limit is resumed in place, never set up again.** Once the window
  resets, resume it with `conductor` advance on the same run dir: it keeps the pass's prompts.
  Count it in the pass row as `resumed`, not as a failure or a miss.
- **Replays (R) batch the same way** but are far smaller (one session, no web). Their probe is a
  replay batch of 5.
- **Record usage, not only dollars.** Subscription billing has no invoice per run, so the
  scorecard records the 5-hour and 7-day share each batch used. It also records the list-price
  `$` conductor reports, for comparison with the Austin loop.

## 4. Risks

- **Prospector folders track the tier.** All 9 gated core cities have a bureau
  `jurisdictions/<slug>/` folder (prospector trained them); none of the 6 Tier 3 cities do. If
  1.4 learned "no prospector material → Tier 3", it would score well and generalise badly. The 1.4
  prompt says seeds and prospector folders are leads, never evidence of a gate. The scorecard
  marks whether each miss had seeds, so the pattern would show.
- **Overfitting.** Fifteen cities, many passes. Guards: one change per commit with a stated
  target, generic prompts (D5), canaries, and the held-out L5.
- **Michigan-heavy Tier 3.** Three of six Tier 3 are Michigan townships. Parent §8.3 lists
  non-Michigan leads if L5 shows the classifier is tuned to the township pattern.
- **Discovery variance.** The same head can find different documents. That's why the bar needs
  two F passes at one head.

## 5. Open questions

None open. v1.1's Q1 and Q2 became D11 and D12; Q3 moved to §8 (2026-10-21).

## 6. Testing seams

**S1: the scorer over finished runs** (new): `score_tiers.py` reading run dirs against
`golden-set.json`.
- **Proves:** the loop's outcome, the bar (§3.5).
- **Prior art:** `runbooks/intake-score/scripts/score.py`.
- **Runs:** locally, after each pass.

**S2: the intake-prospecting contract tests** (existing):
`runbooks/intake-prospecting/tests/contracts.test.ts` + `tests/fixture.ts`.
- **Proves:** D1 and D2's ✔ rules: gate/tier consistency, derived `basis`, Tier 3's `none_found`
  evidence, Tier 2's `why_no_list`.
- **Runs:** in CI and locally: `node --test` for the TS contract tests, pytest for `scripts/`
  (`.github/workflows/ci.yml` already covers both).

## 7. PR plan

**P1: scorer + launcher** (`winston`)
- **Blocked by:** nothing.
- **Delivers:** D7, tested on the El Paso run at L0.
- **Tested at:** S1.
- **Door:** two-way.
- **Blast radius:** none.

**P2: classify by tier** (`bureau`, one PR, commits C1–C3 then one per loop change)
- **Blocked by:** P1 being built and tested. It does not have to merge; the loop runs the scorer
  from P1's branch (D12).
- **Delivers:** D1–D5, and the loop's tuned prompts.
- **Tested at:** S2 in CI; S1 for the bar.
- **Door:** two-way (revert).
- **Blast radius:** every intake-prospecting run's front half. Steps 2.1+ are unchanged because
  `basis` is derived. `intake-score` keeps reading old runs through its fallback.

## 8. Not yet specified

- The Tier 2 baseline checklist, and what the runbook does after 1.5 for Tier 2 (today it stops
  where `none_found` stops).
- How tier results reach the app or the jurisdiction page.
- A `tier` override in `1.5-scope`'s revise form, beside `edits.basis` (v1.1's Q3; Will,
  2026-10-21: not now). The loop doesn't need it, because runs park before 1.5 is answered. It's
  needed before a person uses the readout for real.

## 9. Out of scope

- Library DB comments as evidence: the prospector fold-in spec (D6).
- Folding intake-prospecting into prospector: its own spec.
- Steps 1.5 onward, except reading the renamed file.
- Growing the golden set: parent §8.3, only if L5 asks for it.
