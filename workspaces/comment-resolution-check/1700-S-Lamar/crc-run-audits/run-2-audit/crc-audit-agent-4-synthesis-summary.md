# CRC Audit — Executive Synthesis (Agent 4)

**Run:** `3703349c-ac08-44b8-8c10-2100adb89f5b` (Comment Resolution Check, 3-run medly)
**Submission (U1 plans):** `6b9b85ed-e992-4906-a222-b24ee836910c` · jurisdiction **austin** · crcGenerationNumber 1
**Shape:** 3 runs × 16 departments = 48 review cells · 205 consolidated checklist items
**When:** 2026-06-23, 15:44 → 16:46 local · **62.2 min** wall-clock · executor: conductor CLI (local)
**Synthesis of:** Agent 1 (performance/stability) · Agent 2 (vote variance) · Agent 3 (tool usage/observability)

---

## TL;DR

- **It worked.** Run completed cleanly — 48/48 cells produced output, full consolidate → enrich → rephrase → save chain ran, review row + comments written to DB. Zero fatal errors, no dropped or partial outputs.
- **It was slow, and tail-bound, not throughput-bound.** 62 min wall-clock; the per-item **review** agent step is ~89% of it. Most of the 39 worker slots sat idle (time-weighted avg ≈ 9 in-flight) while a handful of large-guide stragglers (crc-de, crc-sp) drained for the last ~28 min.
- **Top risk — the structured-output retry storm is STILL live.** 10 coercion-failure events across 7 cells, same documented double-wrap signature, ~50 wasted model calls. All recovered, so correctness held — but the bug's "zero events" closure criterion is **not met**, and it is the prime suspect behind both the slow tail and a new item-set-drift finding (below).
- **Top win — the 3-run medly is doing its job.** 64% of items unanimous, zero 3-way splits, and it visibly firmed up / corrected ~24 verdicts vs. the prior single-run review. Disagreement is contained to a known noisy cluster (crc-sp/de/tpw).
- **Biggest blind spot — vision is under-logged, and that hid a real bug.** The vision model's *response* is logged nowhere; behind that weak logging sat 11 failures from an unresolved `primary-site-plan` placeholder — a genuine document-resolution bug masquerading as transient noise.

---

## What went well

- **End-to-end reliability.** Every department emitted exactly 3 findings files; consolidation, enrichment, title-rephrase, and the DB saver all ran clean and sub-second (except the agent steps). The outer retry loop absorbed every transient failure — no cell was lost. (Agent 1 §1)
- **Medly quality signal.** 132/205 items unanimous (64%), 50 items (24%) a single-dissent 2-1, and **zero** three-way splits. Confidence tiers behaved as designed — no high-variance item reached `high` confidence. The medly also corrected 11 items to a clean 3-0 on a verdict different from the single-run history. (Agent 2 §3–4)
- **Semantic-search is fully observable.** Query, maxResults, mode, resultCount, and latency are all logged and 232/232 alignable to a department+run; 0 zero-result queries; healthy ~678 ms mean latency. The current run also produces genuine *per-item* tool attribution (a real improvement over the historical run's blanket `["vision"]` stamp). (Agent 3 §2a, §5)
- **Infrastructure headroom is fine.** maxWorkers=39 already exceeds the 48-cell / mostly-serial workload; no orchestrator serialization bottleneck. The levers are elsewhere. (Agent 1 §7)

---

## What needs attention — prioritized

### P0 — Structured-output retry storm (and its downstream blast radius)
**What:** 10 `agent.structured_output.coercion_failed` events across 7 cells, all the documented double-wrap shape (`topLevelKeys:["findings"]`, `must have required property 'grouping'` / `/findings: must be array`), each burning 5 internal attempts → ~50 wasted Sonnet calls, plus 5 outer-retry re-runs with 3–9 s exponential backoff. (Agent 1 §5)
**Why it matters — and the emergent cross-report link:** this is not just wasted spend. **Agent 1's retry storm and Agent 2's item-set drift are very likely the same phenomenon.** Agent 2 found that **run-2 decomposed crc-sp and crc-tpw into a *different set of atomic items*** than runs 1 & 3 — yielding 23 items scored by only 1–2 runs — and explicitly suspects the structured-output instability perturbed run-2's emission. The storm therefore costs us on three axes at once: (1) wall-clock (it dominates the slow tail — see P1), (2) wasted model calls, and (3) **taxonomy instability that no amount of voting can fix**, because the runs aren't even scoring the same items. Fixing the double-wrap is the single highest-leverage action in this audit.
**Where the detail lives:** Agent 1 §5 (signature, distribution, cost); Agent 2 §3.3 + §1 (decomposition drift, the 23 split items); bug doc `STRUCT-OUTPUT-RETRY-STORM.md`.

### P1 — Wall-clock is tail-bound on the largest guides
**What:** The review step is 55.5 min of the 62; the last cell finished +3332 s vs. a ~447 s median. The tail is the big guides (crc-de 33 items, crc-sp 49/58 items, crc-ca/crc-tpw 21–24) and any cell that also took the retry-storm penalty. ~28 min were spent draining stragglers while 30+ workers idled. (Agent 1 §4, §7)
**Why it matters:** raising worker count won't help (slots already exceed cells). The fix is to (a) kill the retry storm (P0) and (b) **split the largest guides into sub-cells** so no single agent serializes 30–49 items. Note these same guides (sp/de/tpw) are *also* Agent 2's variance epicenter and *also* where the decomposition drift lives — large guides are the common denominator across all three problem axes.
**Where the detail lives:** Agent 1 §4, §7–8.

### P1 — Vision response is logged nowhere; it hid a real doc-resolution bug
**What:** The vision *prompt* is captured (in the main pino log, 182 calls), but the model's *response text*, tokens, and latency are captured **nowhere** — the dedicated `vision-log.jsonl` is a coarse success/metadata sidecar. Of 13 vision errors (0 of which log an error reason), **11 were an unresolved `primary-site-plan` placeholder** — a literal string passed where a document UUID belonged, so the file never loaded and the model was never called. (Agent 3 §2b, §3)
**Why it matters:** this is the textbook case of weak observability hiding a code bug. Agent 1 flagged the 13 vision errors as a stability drag and asked whether the sheet IDs even exist in the U1 package; Agent 3 answered it — most aren't a rendering problem at all, they're a **document-resolution bug**. The vision answer drives every pass/fail verdict, yet a wrong vision call is currently undebuggable after the fact. Fix the placeholder substitution, and capture vision responses so the next such bug surfaces immediately.
**Where the detail lives:** Agent 3 §2b, §3, §6 (P1/P5 proposals); Agent 1 §6.

### P2 — No log ties a tool call to an atomic checklist item
**What:** Tool calls resolve only to a *department* (`item`+`runIndex`); `checklistItemId` is `null` on every vision and script-tool line, and the two JSONL sidecars carry no item/run keys at all. (Agent 3 §4)
**Why it matters:** you cannot ask "what did the agent look at to decide DE-6.1?" without a fragile positional/timestamp join. This is exactly the question P0/P1 investigations will need for the 13 chronically unstable items. Stamping `checklistItemId` on every tool line (Agent 3 P2/P3) turns those audits from forensics into a lookup.
**Where the detail lives:** Agent 3 §4, §6 (P2–P4).

### P2 — Chronically unstable items + crc-tpw's N/A dissent (human re-verify)
**What:** 13 items both disagreed within this run **and** flipped verdict vs. the prior review — concentrated in crc-de/sp/tpw (Agent 2 §4.3). Separately, 6 crc-tpw items have one run voting `not-applicable` while two vote `failed` — looks more like a run *skipping* an unscoreable item than a genuine N/A judgment. (Agent 2 §3.2, §4.3)
**Why it matters:** these are the items least safe to trust at face value; a human should re-verify them. The severity tie-break (`failed` wins) keeps the N/A dissent from changing outcomes, but it's a distinct failure mode worth a spot-check. Note this is a list to *review*, not a code bug.
**Where the detail lives:** Agent 2 §4.3 (the 13), §3.2 (TPW N/A pattern), §5 (per-dept).

---

## Cross-cutting insight — where the leverage is

The three reports converge on **two root-cause clusters**, and the same departments (crc-sp / crc-de / crc-tpw) sit at the center of both:

1. **Structured-output instability is the hub.** It directly causes wasted calls (Agent 1), is the prime suspect for run-2's item-set drift (Agent 2), and compounds the slow tail (Agent 1). One fix — eliminating the double-wrap — should simultaneously cut wall-clock well below 55 min, remove the 23 coverage-gap items, and stop the taxonomy from wobbling run-to-run. Pair it with **splitting the largest guides** so item-count stops serializing inside one agent. → *faster, cheaper, and lower-variance in one stroke.*

2. **Observability is a half-built bridge.** Semantic-search is fully traceable; vision is not (no response, no per-item key, no error reason) — and that single gap concealed a real document-resolution bug. **Capture vision responses + token/latency, stamp every tool call with `checklistItemId`, and record an explicit error reason on failures.** → *the next wrong verdict or doc-resolution bug becomes debuggable instead of invisible.*

Everything else (the 13 unstable items, the TPW N/A dissent) is downstream review work that these two fixes make tractable.

---

## Pointers (detail lives here)

| Topic | Report | Companion data |
|---|---|---|
| Outcome, timing, retry storm, concurrency, stability | `crc-audit-agent-1-performance-stability.md` | — |
| Vote variance, decomposition drift, cross-review flips, unstable items | `crc-audit-agent-2-high-variance-writeup.md` | `crc-audit-agent-2-current-run-votes.tsv` (205 items), `crc-audit-agent-2-running-variance-all-runs.tsv` (388 rows) |
| Tool usage, observability gaps, vision-error root cause, log proposals | `crc-audit-agent-3-observability-report.md` | `crc-audit-agent-3-tool-usage-current.tsv` (579 rows), `crc-audit-agent-3-tool-usage-running-tally.tsv` (205 rows) |
| Known bug | `STRUCT-OUTPUT-RETRY-STORM.md` | — |

---

## Open questions / data limitations

- **History is a 2-point series.** Only one prior CRC review exists for this submission version (`7e79e197`, 2026-06-19), and it was **single-run** — so it stores only a final status per item, no per-run votes. Cross-review "variance" is a final-status flip, not a vote-vs-vote comparison; a robust "chronically unstable" trend would want ≥3 reviews. (Agent 2 §4.1, §6)
- **Historical tool fidelity is low.** The prior review stamped a blanket `["vision"]` on all 183 comments — present and queryable, but not trustworthy as per-tool ground truth, so not directly comparable to this run's per-item attribution. (Agent 3 §5)
- **This run's vision responses are unrecoverable.** No artifact captured them; they survive only indirectly as the `observation`/`reasoning` text the agent wrote into findings. (Agent 3 §2b)
- **Per-cell timing is approximate.** `Item completed` lines omit `runIndex`, so claim→completion pairing is FIFO-per-department; the *ranking* of slow departments is reliable, exact per-cell maxima are estimates. (Agent 1 §3)
- **Retry-storm → decomposition-drift link is strongly suspected, not proven.** Agent 2 infers run-2's divergent crc-sp/crc-tpw item sets are tied to the structured-output instability; confirming the causal chain would need a clean re-run after the double-wrap fix (expect zero coercion events *and* a stable item set across runs). (Agent 1 §5 + Agent 2 §3.3)
