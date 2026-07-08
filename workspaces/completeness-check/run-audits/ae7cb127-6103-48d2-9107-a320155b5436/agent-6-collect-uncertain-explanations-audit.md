# Agent 6 — `collect-uncertain-explanations` step audit

**Review:** `ae7cb127-6103-48d2-9107-a320155b5436` · **Run:** `2026_07_07_ROW_fix_take_1`
**Step wall:** 571 ms (log `duration`, index 5) · **Verdict:** `HEALTHY WITH NOTES`

Script under audit: `cc-run-output/workflow/scripts/collect-uncertain-explanations.ts`
Inputs: `cc-run-output/output/uncertain-explanation-{inputs,results}/` (16 each).
Output: `cc-run-output/output/uncertain-explanations.json` (16 entries).

---

## Step purpose

Fan-in for the explain-uncertain agent cells. Merges each per-cell result JSON into a single map keyed by the item's `ref` (`grouping:ITEM-ID`), applying four safety guards imported from the CRC enrichment post-mortem: (1) ref cross-check, (2) attribution keyword heuristic, (3) forbidden-terms lint on the external field, (4) a >50% null-rate tripwire that hard-fails the workflow. Output feeds `enrich-findings` (index 6) and, transitively, `build-review-comments` (index 8).

## Guard logic (as-ran, cited)

- **Guard 1 — ref cross-check** (`collect-uncertain-explanations.ts:133-138`). Compares `result.ref` from the cell against `input.ref` from the stub. Mismatch nulls **both** external and internal fields, `failureReason='ref-mismatch'`. Deterministic anti-misattribution.
- **Guard 2 — attribution heuristic** (`:95-115`, `:152-157`). External prose must contain (a) any ≥5-char content keyword from `input.itemText` OR (b) a `sheet N` mention OR a ≥5-char word from any evidence label. Failure nulls **external only**, `failureReason='attribution-mismatch'`.
- **Guard 3 — forbidden-terms lint** (`:74-86`, `:160-166`). Six regexes on external prose: `run-reference` (`\brun\s*\d+\b|\bruns\b|\brun\b`), `vote-reference`, `internal-file` (`facts.md|blocks.md`), `block-reference`, `tool-reference` (`vision|semantic search|StructuredOutput`), `internal-idiom` (`checklist item`). Trip nulls **external only**, `failureReason='lint-reject'`; internal is preserved intentionally.
- **Guard 4 — tripwire** (`:231-237`). When `nullCount / total > 0.5`, `process.exit(1)`.
- **Also**: existsSync/JSON.parse failures → `failureReason='agent-failed'` (`:122-130`); both fields null but non-error → adopt cell's own `failureReason` (`:143-149`, fallback `'empty-output'`).

## What happened (evidence)

- **Fan-in completeness.** 16 stubs in, 16 results in, 16 entries out. `jq 'length'` on the output = 16. Every input filename exists as a result filename (1:1). No dropped items, no malformed JSON, no missing files. Wall 0.6 s matches log (`duration:571`, `logs/completeness-check.log`).
- **Ref cross-check integrity.** Every stub's `.ref` matches its counterpart cell's `.ref` (verified pairwise). Zero ref-mismatches — Guard 1 was never triggered.
- **Key format & downstream lookup.** Filenames encode the colon as `__` (e.g. `cc-23__CC-23-08.json`), but the output map keys off `input.ref` (unchanged, `cc-23:CC-23-08`) — consistent with the 16 uncertain refs in `consolidated-findings.json`. `enrich-findings` output confirms all 16 uncertain findings picked up the collected data (16 `consolidatedStatus=='uncertain'` findings in `enriched-findings.json`). No fragmented refs, no duplicates.
- **Guard 3 tripped once** on `cc-23:CC-23-08` (`failureReason='lint-reject'`, external nulled, internal preserved). The trigger is a **false positive**: the lint pattern for `run-reference` (`:75`) uses `\bruns\b` as a bare alternate, and the prose says *"the retaining wall **runs** along the southern portion of the site"* — a common English verb use, not a reference to multi-run machinery. The prose is on-topic and applicant-safe.
- **Guards 2 and 4 never fired.** 15/16 cells returned `failureReason: null` with populated external + internal. `nullCount/total = 1/16 = 6.25%` — well below the 50% tripwire.
- **Schema conformance.** All 16 cell result files carry exactly the four expected keys (`ref`, `uncertainExplanation`, `agentTraceUncertainExplanation`, `failureReason`). All 16 collected entries carry the three-key `CollectedEntry` shape. No silent coercion, no extra fields.
- **Log signals.** Grep of `completeness-check.log` shows step start/executing/complete (3 lines total for `collect-uncertain-explanations`). Zero `REF-MISMATCH`, `ATTRIBUTION-MISMATCH`, `LINT-REJECT`, or `TRIPWIRE` log lines. **This is a gap** — the script emits guard warnings via `console.warn`, but the conductor's script wrapper discarded stdout/stderr for this step: the "Collected 16 uncertain explanation(s): 15 ok, 1 null (lint-reject=1)" summary line (`:223-226`) and the specific `LINT-REJECT: cc-23:CC-23-08 — trips: run-reference` warning (`:163`) are unrecoverable from the pino log. The lint hit is only visible by reading `uncertain-explanations.json` directly.

## Root-cause analysis (the one nulled entry)

`cc-23:CC-23-08` (Sheet 15 retaining-wall / ROW question). Cell agent produced a paraphrased, applicant-safe external explanation and correctly self-reported `failureReason: null`. The collector's lint fired on the token `runs` in the phrase "the retaining wall runs along" — matching `\bruns\b` in `FORBIDDEN_PATTERNS[0]` (`:75`). This is the **run-reference guard being too permissive**: the intent is to block "Run 3 said …" idioms about multi-run consensus, but `\bruns\b` also matches the verb. Same for the bare `\brun\b` alternate. Because this was a single false positive, Guard 4 did not trip; the workflow proceeded without operator visibility.

Downstream, `enrich-findings` still emits `cc-23:CC-23-08` with an `explanation` (see `enriched-findings.json`) — the internal `agentTraceUncertainExplanation` is preserved, but the external short-form is `null`. Whether the applicant-facing report ends up with a blank explanation or falls back to the internal string depends on the format-reports/build-review-comments handling; that's for Agents 7–9.

## What went right

- Perfect fan-in symmetry: 16 → 16 → 16, no glob misses, no `existsSync` fallbacks tripped.
- Ref-keying is stable and matches the `grouping:ITEM-ID` convention used throughout the run (no colon-encoding leaked into keys, no fragmentation).
- Guard architecture is well-layered: hard `null-both` for misattribution, soft `null-external-keep-internal` for prose issues — internal traceability survives lint noise.
- Tripwire (Guard 4) is calibrated at the right layer (aggregate handoff failure) and would have caught the CRC-style 86% shipment.
- Sub-second step, no dependencies on external services.
- Zero-inputs branch is safe (`:190-200`) — writes `{}` and exits 0.

## What went wrong

- **Guard 3 false positive on `\bruns\b` / `\brun\b`.** The `run-reference` pattern (`:75`) over-matches ordinary English uses ("wall runs along", "runs adjacent to", "storm drain runs"). One out of 16 (6.25%) tripped this run; on a larger uncertain population the false-positive rate could plausibly reach 10–20% for site-plan prose that legitimately describes linear features. The narrow form `\brun\s*\d+\b` alone would have caught the intended idiom.
- **Guard warnings are invisible in the pino log.** The conductor step wrapper does not persist the script's stdout/stderr into `completeness-check.log`. The script's own summary line and per-cell warnings are only recoverable by re-deriving them from `uncertain-explanations.json` (as this audit had to). No structured log line records "lint-reject on cc-23:CC-23-08, pattern=run-reference".
- **No per-reason threshold.** Guard 4 only fires on aggregate >50%. A run where a systematic prompt regression caused e.g. 30% attribution-mismatches would ship silently and unnoticed by the collector.
- **Attribution check compares to potentially degenerate `itemText`.** If `prepare-uncertain-explanation-inputs` produced a stub with empty or wrong `itemText` (checklist join failure), the attribution heuristic would either false-positive (no keywords → trips) or false-negative (bogus keywords → passes vacuously). Not observed on this run (all 16 stubs had rich itemText and evidenceLocations — spot-checked `cc-23__CC-23-08.json`), but the guard is only as good as the stub. There is no `degenerate-input` failure reason to surface this class.

## Observability gaps & remediations

- **Emit a structured pino log line from the collector.** The `console.log`/`console.warn` calls (`:134`, `:154`, `:163`, `:223`, `:232`) are discarded by the conductor wrapper. Replace with pino writes to a well-known artifact (e.g. `output/uncertain-explanation-guards.jsonl`) with `{ref, guard, pattern, decision}` per row, plus a run summary blob `{total, ok, nullByReason}`. Then this audit could grep the log rather than reverse-engineering the collected map.
- **Tighten `run-reference` pattern.** Drop the bare `\bruns\b` and `\brun\b` alternates; keep `\brun\s*\d+\b`. Optionally add allowlists for domain terms ("runs along", "runs adjacent", "runoff") or lower-case-only anchoring.
- **Per-reason tripwires.** Add secondary thresholds: `lint-reject > 15%`, `attribution-mismatch > 20%`, `ref-mismatch > 0`. Each should log a distinct pino warning; only `ref-mismatch > 0` (a determinism violation) should exit non-zero at any count.
- **`degenerate-input` failure reason.** When `input.itemText` is empty or `input.perRunFindings` is empty, either surface the stub as unusable (`failureReason='degenerate-input'`, skip guards 2/3) or record a warning; today it silently passes the attribution check into a domain where the check has no signal.
- **Prefix-variant dedup warning at collect time.** Not observed on this run (all keys bare) but worth adding: if two collected keys share a common ITEM-ID with different grouping prefixes, warn. This defends against the fragmentation failure mode Agents 1/2 are watching for.
- **Restore stdout capture in the conductor script wrapper** so future audits don't need this workaround.

---

## Verdict: `HEALTHY WITH NOTES`

The collector did its job: 16 in, 16 out, correct keying, downstream lookup verified. One false-positive lint (Guard 3) nulled an on-topic external explanation for `cc-23:CC-23-08`; the internal trace was preserved. No missed real leaks in the shipped externals (spot-checked 3 for run/vote/tool framing — none present). Guards 1 and 4 vacuously happy but structurally correct. Chief observability gap: the script's warnings never reached the pino log.
