# Completeness Check runbook v2: follow-ups after the parity loop

**Status:** Draft v1
**Date:** 2026-10-05
**Parent spec:** `workspaces/completeness-check/runbook-v2-port/DESIGN-SPEC.md` (v2.2). This spec picks up where its §13 "Next steps" ends.
**Evidence:** Inspector General report `2026-10-03-cc-runbook-v2-parity-loop-native-vision`, and bureau draft PR **#1951** (branch `cc-v2-loop`, head `2aec1f2`).
**Repos touched:**
- `bureau`: merge #1951; guide rewording; the cc-compare acceptance band; the remaining acceptance runs.
- `conductor2`: ledger and seat accounting for the vision tool's child sessions.
- `substation` + `cityhall` (GitHub `noetic-inc/cityhall`): switch the CC trigger to the runbook.
- `claude-plugins`: captain-skill environment fixes.
- `winston`: amend parent §8.4.

**Repos NOT touched:** `conductor` (the legacy TS lane stays frozen until F8 retires it), `inspector-general` (IG for v2 runs stays the parent's §10 follow-up).

## 1. Problem

The parent spec's port is built. On 2026-10-03 it went through one subset run and five full runs on Lamar + Collier v4 (sv `6b9b85ed`), each scored by `cc-compare` against legacy reviews **A** `41a49412` (Opus 5) and **B** `196de05b` (Sonnet 5.5). Results (IG report §2):

| Measure | Value |
|---|---|
| Items v2 agrees with B on, of 192 (loops 1–5) | 180, 176, 179, 176, 178 |
| Items legacy A agrees with legacy B on | **176** |
| Wrong vs final answer key (38 rulings, 9 guide-ambiguous) | A 9 · B 6 · v2 gateway 9 · v2 Opus-native 10 · v2 Sonnet-native 10 and 14 |
| Vision errors, loops 2–5 | 0 of 219 calls (loop 1: 25 of 62, host sandbox) |
| Metered Claude spend | $0 (all subscription) |

v2 sits inside legacy's own run-to-run band, so the port is at parity. Several things are still open, and they fall into six groups:

1. **Native vision has one sample.** `visionMode: "claude"` with Opus scored 9 in its own loop and 10 against the final key, from a single run (loop 5). The two Sonnet runs (10 and 14) show how much one configuration can swing between runs.
2. **Native vision spend is invisible to conductor.** `bin/vision.ts` runs `runClaude` (`runbooks/completeness-check/bin/vision.ts:278`) as a child of the review cell, on the same seat. Conductor's ledger (`conductor2/src/ledger.rs:96-159`) and the seat debit (`conductor2/src/seat.rs:166-192`, `CONDUCTOR_BUDGET_USD`) only see the parent session. What went unseen:
   - Loop 4: 60 hidden sessions, **$26.0** list.
   - Loop 5: 52 hidden sessions, **$20.4** list.
   - The review agents themselves cost about $33 per run.
   - Seat-pick under-debited. In loop 5 Opus vision pushed the only allowlisted seat past its 85% ceiling, and `2.8-format` parked for about 2 h.
   - #1951 totals the hidden spend in `2.11-tool-usage` (`summary.vision_claude_sessions`) as observability only.
3. **Only the host lane has been tested.** Every loop ran on the host lane of a Mac with no podman. #1951 declares `sandbox: container` (`runbooks/completeness-check/runbook.yaml:14`) because the host OS sandbox blocked the vision CLI's network. The container lane, the Powerstation default since conductor `eae4ab0`, and the cloud lane have never run this runbook.
4. **The parent's acceptance bar can't be met.** §8.4 #1 requires "v2 wrong ≤ B wrong". B (6) is one favorable sample: legacy's own Opus run (A, 9) fails that bar in every loop. `acceptanceOf` hard-codes it (`runbooks/cc-compare/scripts/lib.ts:493-505`, `v2_wrong_le_b_wrong`).
5. **Four parent acceptance items never ran:**
   - §8.4 #2: forced outcomes.
   - §8.4 #3: the uncertain path at `runs=3`.
   - §8.4 #4: publish with `setCurrent:false`.
   - §8.4 #6: Tier-1 self-replay. Its `examples/lamar-v4-*` scenario is not curated.

   Every loop ran `publish:false`, `runs:1`, with no `forceOutcomes`.
6. **The guides cause most of the remaining disagreements.**
   - Nine rows are ruled `guide-ambiguous` (§4.5, table).
   - Seven items are wrong in three or more of the five v2 runs (§4.5). One is wrong in all five: **cc-5:ADR-07**, where v2 always says `pass`, B says `warn`, and the key says `warn`.

The cutover itself is also open: legacy CC still launches through substation's `workflow/run` Inngest function (`substation/src/inngest/functions/workflow-run.ts:35-38`, legacy `conductor-1` in a sandbox). That's the parent's §13.2 step 5.

## 2. Goals and non-goals

**Goals**
1. Merge #1951 with gateway vision still the default.
2. Decide whether native vision can become the default, on more than one sample (F2).
3. Make native vision's spend visible to the ledger and seat-pick (F3).
4. Run the runbook on the lanes it will live on: container, then cloud (F4).
5. Replace the impossible acceptance bar with a noise band (F6) and finish the parent's untested acceptance items (F7).
6. Cut the cityhall trigger over to the runbook, then retire legacy CC (F8).

**Non-goals**
- **Changing the review prompt.** The legacy rule "if a condition cannot be determined, treat the item as applicable" is what turns hedged vision answers into fails, and it stays for parity. Changing it is a post-parity experiment with its own loop.
- **New guide versions in this spec.** F5 lists the rows and the evidence; the rewording ships as a normal guide-version PR (`v2.8`), which moves the baseline tree off `e8df1601` (see D9).
- **IG ingestion of v2 runs.** That remains the parent's §10 follow-up.

## 3. Decisions

- **D1 Merge #1951 first, as is.** Every follow-up starts from it. `visionMode` keeps defaulting to `gateway`, so merging changes no current behaviour. The `answer-keys/lamar-v4.json` key (38 rulings) merges with it: Will reviewed the rulings indirectly through the loop and the IG report, and can still overrule any entry by editing the file.
- **D2 Native vision becomes the default only on evidence.** It needs three more Opus-native full runs (F2). It qualifies if all three, against the then-current key, are wrong ≤ max(A, B) and agree with B at least as often as A does (the F6 band), **and** F3 has shipped. Accuracy alone isn't enough while its spend is invisible.
- **D3 The ledger counts vision child sessions as ledger lines** (F3). They are written by conductor, not by `vision.ts`, so the bureau CLI never learns the ledger format. The mechanism is open (Q1).
- **D4 Container lane before cloud lane.** Powerstation runs F2's three samples in the container lane, which tests both at once. Cloud follows via the `trigger-cloud-runbook` skill once the container runs are green.
- **D5 The acceptance bar becomes a band** (F6). A v2 run passes when both hold:
  - its agreement with B is ≥ A's agreement with B;
  - its wrong count is ≤ max(A wrong, B wrong).

  Both are measured against the same key on the same guide subset. This amends parent §8.4 #1. `only_v2_wrong` stays reported but doesn't gate.
- **D6 Guide fixes go through guide versions, not the runbook.** F5 produces a list and a PR against `jurisdictions/austin/completeness-check/`, and never edits a prompt.
- **D7 The cutover keeps the legacy lane runnable for one release.** It switches the trigger and keeps `workflows/completeness-check/` and the legacy scripts, which the runbook still calls under D3 of the parent. Moving the scripts into the runbook is the retirement step.
- **D8 Environment fixes ship where the bug is.**
  - Captain skill (`claude-plugins`): the `.secret-names` list gains `SUPABASE_RUN_TOKEN` and `PUBLIC_SUPABASE_ANON_KEY`, and the launch line uses `nohup`, not `setsid`.
  - `conductor setup` (`conductor2`): picks the seat command that exists, `muni` or `dsd`.
  - Each Mac: install the dsd usage heartbeat LaunchAgent.
- **D9 The answer key is keyed to guide text.** After F5 rewords a row, entries whose `guide_sha256` no longer matches are reported as `guide-drift` (existing cc-compare behaviour), not re-scored. A reworded guide needs fresh baselines: a new legacy-equivalent reference, or v2-only self-consistency (Q5).

## 4. Follow-ups

### 4.1 F1: merge #1951
Mark #1951 ready, review it, merge it. It carries 10 fixes (IG report §3), the native vision mode, the cc-compare ambiguity support and the answer key. Before merging, rebase on main and rerun the CC and cc-compare test suites:
- `runbooks/completeness-check/scripts` pytest: 54 passing.
- `bin/vision.test.ts`: 15 passing.
- `cc-compare/scripts/test.mjs`: 28 node + 12 py passing.
- `run-examples`: 341/344. The 3 failures also fail on `main`.

### 4.2 F2: native vision samples
Three full runs with `{"visionMode":"claude"}`, using the merged default model `claude-opus-5-5`, on Powerstation's container lane (D4). Run them at least an hour apart, and compare each with `cc-compare` against the merged key. Expect 0–2 adjudications per run.

Record per run:
- wrong vs key, agreement with B, fail count;
- vision calls, errors, tiles;
- `vision_claude_sessions` spend;
- wall clock.

Decide D2 from the three runs.

### 4.3 F3: ledger accounting for vision child sessions
Every line `vision.ts` writes in claude mode already carries `session_id`, `usage`, `total_cost_usd` and `duration_ms`. The open question is how those reach conductor's ledger and seat debit (Q1). Whichever option, the result is: one ledger line per child session, `billing: subscription`, attributed to the calling node, and summed into `seat est` by `conductor status`. The seat debit counts it before the next seat pick.

### 4.4 F4: container and cloud lanes
- **Container:** F2's runs, on Powerstation.

  Check:
  - **The image has the vision CLI's dependencies.** That means `node`, the `claude` CLI and npm registry access for `bin/deps.sh` (or a pre-warmed `.cc-deps`).
  - **The child `claude -p` has a seat inside the box.** The box drops `CLAUDE_CONFIG_DIR` when it's unset (`conductor2/README.md`, "the default login"). Q3.
  - **Vision and search reach Supabase and the gateway** with no OS sandbox in the box.
- **Cloud:** one run through `trigger-cloud-runbook`, with `visionMode: gateway` first and then `claude`. The cloud launcher sets `CONDUCTOR_SANDBOX=host`. Confirm the host OS sandbox isn't enabled inside the microVM, or that its network allowlist covers Supabase and the gateway (Q4).

### 4.5 F5: guide rows

**Guide-ambiguous: accepted either way (9).** From `cc-compare` loop 5 `3.1-scorecard/ambiguous-items.json`:

| Ref | Accepts | The ambiguity |
|---|---|---|
| cc-1:CC-1-08 | fail / pass | "Current Tax Certificate" (singular) vs one per tax parcel (3 parcels, 1 certificate) |
| cc-1:CC-1-41 | pass / fail | "Submittal files not in PDF" binds to the plan set but the prose says every submittal |
| cc-13:AW-07 | pass / n-a | Condition "multiple buildings with dedicated meters" on a single-building site |
| cc-13:AW-22 | pass / fail | "Existing W/WW infrastructure" strictly on the utility plan vs anywhere in the set |
| cc-13:AW-27 | pass / fail | Location "utility plan" with an inferred binding |
| cc-13:AW-45 | pass / fail | Row says every existing structure, methodology says only multi-unit proposed structures |
| cc-23:CC-23-06 | fail / n-a | Whether parking bays in the ROW are "new roadway construction" |
| cc-24:CC-24-15 | pass / warn | Whether a "UCC# pending" acknowledgement counts as "referenced for AULCC" |
| cc-24:CC-24-16 | pass / warn | The same, for the License Agreement trigger |

**Wrong in ≥3 of 5 v2 runs (7)**, scored against the final key:

| Ref | Correct | v2 wrong | A | B | Cause |
|---|---|---|---|---|---|
| cc-5:ADR-07 | warn | **5/5** (always pass) | wrong | right | misread-document: the parking table's "PROJECT NAME" is "1700 South Lamar" |
| cc-1:CC-1-09 | pass | 4/5 | wrong | wrong | misread-document |
| cc-13:AW-21 | pass | 4/5 | wrong | right | misread-document |
| cc-22:CC-22-14 | pass | 4/5 | right | right | misread-document: the 106′ dimension ties to an existing driveway across Collier |
| cc-22:CC-22-25 | pass | 4/5 | wrong | right | misread-document: the open-circle ADA path linetype |
| cc-23:CC-23-07 | pass | 3/5 | wrong | right | misread-document |
| cc-24:CC-24-03 | n-a | 3/5 | right | wrong | misread-document |

F5 produces:
1. **A guide-version PR** rewording the 9 ambiguous rows. For each one, the "Condition", "Location" or "Validation Methodology" text names the intended reading.
2. **Per recurring-wrong item, a decision.**
   - A guide clarification, when the row underspecifies (e.g. ADR-07: does a parking table's "PROJECT NAME" count as the project name?).
   - Or a "known hard read" entry with no change, when the row is clear and the drawing is hard to read.

### 4.6 F6: acceptance band
- `runbooks/cc-compare/scripts/lib.ts` `acceptanceOf`: replace `v2_wrong_le_b_wrong` with `holds` per D5. Also report `agree_with_b`, `a_agree_with_b`, `max_legacy_wrong` and the two sub-results.
- `scorecard.md`: the acceptance line prints the band.
- Parent §8.4 #1: amended with a pointer here.

### 4.7 F7: parent acceptance items not yet run
Each is one paid run on Powerstation, compared only where comparable:
1. **Forced outcomes (§8.4 #2):**
   - Request: `reviewFiles: ["cc-3","cc-5","cc-13","cc-24"]`, `forceOutcomes: "1700-s-lamar-forced-outcomes.tsv"`.
   - Pass: `forced-outcomes-receipt.json` shows applied rows, and the comparison buckets them `forced`.
   - Also the first live test of `2.3`'s gateway LLM call.
2. **Uncertain path (§8.4 #3):** `runs: 3` on a small subset. Pass: ≥1 uncertain item, with `2.4–2.6` exercised. If none appears, raise `uncertainThreshold`.
3. **Publish (§8.4 #4):** `publish: true, setCurrent: false`. Pass:
   - a `reviews` row with `output_schema = 2026-03-completeness-check` and `is_current = false`;
   - the prior current row untouched;
   - comments rendering in the app by review id.
4. **Tier-1 replay (§8.4 #6):** curate `examples/lamar-v4-cc1-cc21` from a green run, following the examples rules, and turn on self-replay.

### 4.8 F8: cutover
1. Find the cityhall code that sends `workflow/run` for CC (Q2), and switch it to `POST /api/runs` for `completeness-check`. Map the legacy inputs to the runbook `Request` (parent §6), with `visionMode` defaulting to gateway.
2. One week of shadow use: CC runs through the runbook, and IG's legacy trigger stays dark for CC (parent Q8).
3. Retire legacy CC:
   - delete `workflows/completeness-check/workflow.yaml`;
   - move the scripts the runbook calls into `runbooks/completeness-check/scripts/legacy/`;
   - drop `MAX_WORKERS_CAP['completeness-check']` (`substation/src/inngest/functions/max-workers-cap.ts:23`).

## 5. Order of work

1. F1: merge #1951. No spend.
2. D8 environment fixes, as small PRs (claude-plugins, conductor2). No spend.
3. F3: the ledger change in conductor2. No spend. It must ship before F2's runs, which then measure it.
4. F2 + F4 container: three Opus-native full runs on Powerstation. Paid on subscription, about 3 × ($33 review + $20 vision) list, plus 0–2 adjudications each.
5. F6: the acceptance band. No spend. Rescore F2's runs with it.
6. F7: four acceptance runs. Paid, mostly small subsets.
7. F4 cloud: one gateway run and one claude run.
8. F5: the guide PR, then a fresh baseline per D9 and Q5.
9. F8: the cutover, then legacy retirement.

Every paid step needs Will's go on the exact request (`no-firing-without-green-light`).

## 6. Open questions

- **Q1 How do vision child sessions reach the ledger?**
  - (a) `vision.ts` appends a sidecar `vision-sessions.jsonl` that conductor folds into `ledger.jsonl` at node reap.
  - (b) conductor exports a ledger append path (e.g. `CONDUCTOR_LEDGER_SIDECAR`), and `vision.ts` writes the ledger shape directly.
  - (c) `vision.ts` launches the child through a conductor verb (`conductor agent --child`) instead of `claude -p`.

  Leaning (a): bureau stays ignorant of the ledger format, and conductor owns the fold. The seat debit also needs a pre-debit at launch (`CONDUCTOR_BUDGET_USD` already exists), not just a post-hoc line.
- **Q2 Where does cityhall send `workflow/run` for CC?** A literal search of cityhall `main` (`268f529`) finds the handler in substation (`workflow-run.ts:38`) but no sender. It may build the event name from a constant or go through an API route.
- **Q3 Container lane and the child `claude -p` seat.** Does the box mount the seat's `CLAUDE_CONFIG_DIR`, so the vision child inherits it? If the operator's seat is the default login (unset), the container lane drops it. Native vision would then have no auth inside the box.
- **Q4 Cloud lane OS sandbox.** With `CONDUCTOR_SANDBOX=host` in the microVM, is `.conductor/settings.json` `sandbox.enabled` true, which blocks vision network the way it did on the Mac? If so, does the cloud launcher need `sandbox: false` semantics for this runbook?
- **Q5 Baselines after the guide rewording.** A and B ran guide tree `e8df1601`. After F5 the key's entries drift, and there is no legacy run on the new text. The options:
  - (a) Run legacy once more on v2.8 as the new B.
  - (b) Switch to v2 self-consistency: N runs of the same config, scored against an adjudicated key.
  - (c) Keep v2.7-trimmed as the frozen parity fixture and test v2.8 separately.

  Leaning (c).
- **Q6 Native default model cost.** Opus vision cost less than Sonnet in total ($20.4 vs $26.0 list) because it made fewer calls. That's one run each. Should F2 also log per-call latency so the cutover can judge the wall-clock cost of `claude` mode (a 24 s median call vs about 10 s for Gemini)?
