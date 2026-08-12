# Capturing the SIR Run Trace — working directory + Claude Code session logs → `sir-trace`

**Status:** Draft v2
**Date:** 2026-08-12
**Type:** Implementable spec. Introduces a new private Storage bucket **`sir-trace`** that holds a SIR run's complete internal trace: (1) the run **working directory** (moved out of `sir-artifacts`) and (2) the **Claude Code session logs** — the top-level orchestrator transcript plus every spawned sub-agent transcript, organized by **agent role**. Runs as the final best-effort step of the `upload-sir` skill.
**Repos touched:** `substation` (one additive migration — create the private `sir-trace` bucket with a cleared mime allowlist), `claude-plugins` (`plugins/noetic-tools/skills/upload-sir/scripts/publish.ts` — repoint the working-dir mirror + add the role-mapped session-log capture; and its `SKILL.md`). A one-time backfill of existing `sir-artifacts/full-run-output/*` objects into `sir-trace` (§8).
**Repos NOT touched:** `bureau`, `conductor`, `surveyor`, `cityhall`, `field-agent`. No `sir_artifact`/`site_intelligence_report` schema change — the trace is a bulk file dump, no DB rows.
**Supersedes:** the full-run-output mirror target from `claude-plugins` #195 (commit `a8cdfc20`). That mirror's *machinery* is reused; its *destination* moves from `sir-artifacts/full-run-output/<id>/v<v>/` to `sir-trace/<sir_uuid>/working_dir/` (§3, §8).

> **One-line goal:** On the initial (v0) publish of a SIR runbook run, mirror the run's entire internal trace — the working directory **and** the full agentic session-log tree, keyed by agent role — into a new private `sir-trace` bucket under `sir-trace/<sir_uuid>/`, so a run's complete behavior and provenance (which tool produced which artifact, what each phase orchestrator and worker actually did) is recoverable long after the laptop that ran it is gone.

---

## 1. Problem / motivation

Two kinds of internal record survive a SIR runbook run, and neither is durably captured in the right place:

1. **The working directory** — every phase output (geojson, per-discipline findings, figures, HITL readouts, tool-bugs). Today the full-run-output mirror (#195) dumps it into the **client** bucket `sir-artifacts` (under a `full-run-output/` prefix). Mixing internal run output into the client-artifact bucket is a poor separation of concerns.
2. **The Claude Code session logs** — the top-level orchestrator transcript and every sub-agent transcript (each phase orchestrator + every worker it spawns). These are the *only* record of how the run actually behaved: artifact provenance, failure forensics, backtest evidence. They are not captured at all — they live only on the operator's laptop and vanish when the working dir is archived or the machine is wiped.

This spec creates a dedicated internal bucket, **`sir-trace`**, and puts both there, cleanly separated from the client `sir-artifacts` bucket. It also makes the session logs *navigable* by decoding the opaque `agent-<id>.jsonl` files into a **role-labeled tree** (top-level, phase-1/2/3), because an undecoded pile of ~48 opaque transcript ids is not usefully auditable.

> **Concretely why the session logs matter:** in this very run, a session was able to prove that `parcel-rings.geojson` came from a direct keyless `curl` to `gis.hctx.net/.../HCAD/Parcels/MapServer/0` — **not** a surveyor-defined tool — purely by parsing the phase-1 orchestrator's transcript. That provenance is only answerable if the transcript is kept.

## 2. Verified current state (this harness, 2026-08-12)

All confirmed live this session (`CLAUDE_CONFIG_DIR=/Users/winston/.claude-personal`).

**Buckets (app project `mgxqsrjutswbciyrltwd`):** `sir-artifacts` exists (private); **`sir-trace` does not exist** — it must be created.

**Session-log locations (env-var discoverable, no path guessing):**
- Top-level transcript: `$CLAUDE_CONFIG_DIR/projects/<project-slug>/$CLAUDE_CODE_SESSION_ID.jsonl` — confirmed present and **actively growing** (it's the live conversation).
- Sub-agent transcripts: `$CLAUDE_CONFIG_DIR/projects/<project-slug>/$CLAUDE_CODE_SESSION_ID/subagents/agent-<agentId>.jsonl` — one per spawned agent (~48 this run). **All complete** by the time `upload-sir` runs (verified by reading several).
- Sidecar `tool-results/` dir next to `subagents/` (session-global offloaded tool outputs).

**The agent→role mapping is reconstructable (the key enabler for §4).** The top-level session log records every `Agent` spawn as a `tool_use` (with `description` + `subagent_type`) paired with a `tool_result` carrying the child's `agentId`. Verified extraction from this run's top-level log:

| agentId | subagent_type | spawn description |
|---|---|---|
| `ac27737ee7be62055` | general-purpose | **Phase 1 SIR orchestrator** |
| `a8da821eba8b47372` | general-purpose | **Phase 2 research orchestrator** |
| `a25511ac214c44e82` | general-purpose | **Phase 3 analysis + deliverable orchestrator** |
| `aa3f2f1889180bf50` | general-purpose | Records pull orchestrator *(top-level child, NOT a phase orchestrator)* |

And each phase orchestrator's own transcript records *its* `Agent` spawns (the phase-1 orchestrator log contains 4), so the **full spawn tree** is recoverable by recursively parsing transcripts. This is what lets us place opaque `agent-<id>.jsonl` files into named role directories.

> **Layout caveat (Q2):** the `<session-id>.jsonl` + `<session-id>/subagents/` split was verified in *this* `~/.claude-personal` harness. Stock Claude Code (`~/.claude/projects/…`) may differ. Discovery resolves the layout at runtime; it is not hardcoded.

## 3. Storage layout — the `sir-trace` bucket

One private bucket, keyed by SIR uuid, **no version dimension** (see D2 — trace is captured once, at initial publish; subsequent edits are not captured):

```
sir-trace/                                         # NEW private bucket (relaxed mime allowlist)
└── <sir_uuid>/
    ├── working_dir/                               # the run working directory, verbatim tree
    │   │                                          #   (moved here from sir-artifacts/full-run-output)
    │   ├── ADDENDUM.md
    │   ├── deliverable/… hitl/… phase-1-frame/… phase-2-research/… phase-3-deliverable/…
    │   └── _manifest.json                         # rel_path/storage_path/byte_size/sha256/mime + errors
    └── claude-code-session-logs/
        ├── _tree.json                             # the Rosetta stone: every agentId → {role, parent, description, subagent_type, storage_path}
        ├── top-level-sir-orchestrator-agent/
        │   ├── session.jsonl                      # the operator-facing top-level transcript
        │   ├── tool-results/…                     # session-global sidecar (see Q3)
        │   └── workers/                           # top-level-spawned NON-phase agents + their subtrees
        │       └── records-pull-orchestrator/
        │           ├── orchestrator.jsonl         # agent-aa3f2f1889180bf50.jsonl
        │           └── workers/agent-a902f828237252ce3.jsonl
        ├── phase-1-sir-orchestrator-agent/
        │   ├── orchestrator.jsonl                 # agent-ac27737ee7be62055.jsonl
        │   └── workers/agent-<id>.jsonl …         # its recursively-spawned workers (readers/reconcile/adversarial)
        ├── phase-2-sir-orchestrator-agent/
        │   ├── orchestrator.jsonl                 # agent-a8da821eba8b47372.jsonl
        │   └── workers/…                          # the research-leg workers
        └── phase-3-sir-orchestrator-agent/
            ├── orchestrator.jsonl                 # agent-a25511ac214c44e82.jsonl
            └── workers/…                          # the discipline + appendix-part workers
```

Rules:
- **`working_dir/`** is the full v0 run tree (including `deliverable/`), exactly what #195 mirrored — same `walkFiles` enumeration (recursive, cruft-subtracted, symlink-skip), just a new destination and **no `v<version>` segment**.
- **`claude-code-session-logs/`** is the role-mapped session-log tree of §4.
- The client deliverables remain, unchanged, as **rowed** `sir_artifact` objects in `sir-artifacts/sir/<sir_uuid>/v<version>/…`. `sir-artifacts` stays client-only; `sir-trace` is internal-only. This is the clean separation the move buys.

## 4. The agent→role mapping (the core new work)

The on-disk sub-agent files are named by opaque `agentId`, not by role. To produce the tree in §3, reconstruct the spawn hierarchy and label it:

1. **Enumerate direct children of the top-level.** Parse `<session-id>.jsonl` for `Agent` `tool_use`→`tool_result` pairs → a list of `(childAgentId, description, subagent_type)`. (Verified extractable — §2 table.)
2. **Classify each direct child by description** (case-insensitive):
   - `/phase\s*1\b.*orchestrat/` → **phase-1**
   - `/phase\s*2\b.*orchestrat/` → **phase-2**
   - `/phase\s*3\b.*orchestrat/` → **phase-3**
   - anything else (e.g. "Records pull orchestrator", a top-level adversarial reader) → **top-level** (nested under `top-level-…/workers/<slug-of-description>/`).
3. **Recurse.** For each agent, parse its own transcript (`subagents/agent-<id>.jsonl`) for *its* `Agent` spawns → build the complete parent→child tree. (Phase orchestrators spawn workers; workers may spawn sub-workers.)
4. **Assign a role bucket to every agent** = the role of its nearest ancestor that is a phase orchestrator, else top-level. So every descendant of the phase-1 orchestrator lands under `phase-1-sir-orchestrator-agent/`.
5. **Lay out the files** per §3 — the orchestrator's transcript as `orchestrator.jsonl` (or `session.jsonl` for top-level), descendants under `workers/`, preserving parent nesting where it aids navigation.
6. **Write `_tree.json`** decoding every opaque agentId → `{role, parent_agentId, description, subagent_type, storage_path}`. This is mandatory — it is the only thing that makes the opaque ids interpretable, and it is the single "did every transcript get placed?" verification surface for the log tree.

**Robustness / failure handling:**
- **Description-based classification is brittle** if the runbook changes its spawn wording. Mitigation: match on the runbook's known phase-orchestrator naming pattern, and any direct child that matches none of the phase patterns falls through to top-level (never dropped). An agent whose spawn record can't be found at all (orphan — e.g. a resumed agent) goes to `claude-code-session-logs/_unclassified/agent-<id>.jsonl` and is flagged in `_tree.json`. **No transcript is ever silently omitted.**
- **A sturdier long-term signal (Q1):** have the SIR runbook pass a stable machine role on each orchestrator spawn (e.g. a `label`/marker like `sir-role: phase-1-orchestrator`) so classification keys on an explicit tag rather than prose. Recommended as a small runbook follow-up; until then, description regex + fall-through is the mechanism.

## 5. Decisions

- **D1 — New private bucket `sir-trace`; internal trace leaves `sir-artifacts`.** Both the working-dir mirror and the session logs go to `sir-trace`, keeping the client `sir-artifacts` bucket to client-facing rowed deliverables only. The bucket is created private with a cleared mime allowlist (JSONL/geojson/arbitrary), mirroring the `sir-artifacts` §9 migration.
- **D2 — No version dimension; capture once, at the initial (v0) publish.** Paths are `sir-trace/<sir_uuid>/…` with no `v<version>`. The trace step runs only when `sir.action === 'create'` (initial publish) and is **skipped on a version bump** (`sir.action === 'version'`). Per the operator: only the v0 working directory + original run session are needed; subsequent revisions are not captured. Re-running the standalone subcommand overwrites (upsert) the single capture.
- **D3 — Working-dir mirror is repointed, not rebuilt.** Reuse #195's `walkFiles` + upload core verbatim; change only the destination (bucket `sir-trace`, prefix `<sir_uuid>/working_dir/`, drop the version segment). Factor the shared core into `mirrorTree(sb, srcRoot, bucket, prefix)`.
- **D4 — Session logs are role-mapped, not dumped.** The §4 algorithm produces the `top-level` / `phase-1/2/3` tree + `_tree.json`. A flat dump of opaque ids is explicitly rejected as un-auditable.
- **D5 — The top-level log is self-referential; capture is "as-of-upload."** The main `.jsonl` is written by the very session doing the upload, so it necessarily lacks its own tail (the trace-upload tool call, its result, the closing summary). `_tree.json` records `top_level_incomplete_tail: true` + `captured_at`. Sub-agent logs are complete. A truly-final main log needs a post-session hook (§7, out of scope).
- **D6 — Scope = the session (== the run for a dedicated SIR runbook session).** All agents in the session's `subagents/` dir are captured and role-mapped. Multi-purpose sessions / cross-session handoffs are the documented edge (Q4).
- **D7 — Secret redaction before upload is required for the session logs.** Transcripts contain raw `tool_result` bytes and may carry secret values that transited tool calls (this run sourced `field-agent/.env` and handled clerk creds + `AI_GATEWAY_API_KEY`). Before upload, run a streaming string-replace over each JSONL line, substituting exact matches of the process env's secret-looking values (`SUPABASE_*`, `*_SERVICE_ROLE_KEY`, `*_KEY`, `*_TOKEN`, `*_PASSWORD`, `AI_GATEWAY_*`, `*_USERNAME`) with `«REDACTED:<VARNAME>»`. `_tree.json` records `redacted: true` + a count (never the values). `--no-redact` is an explicit opt-in, never default. (Q5 — this catches env-sourced secrets, not inline-pasted ones.) The working-dir mirror keeps #195's behavior (no redaction — it's authored artifacts, not raw tool streams), but inherits the private bucket.
- **D8 — Best-effort inside `publish`, strict standalone.** Inside `publish()` the whole `sir-trace` step warns and never undoes the transactional deliverable publish. A standalone `sir-trace <sirId> <runDir>` subcommand (working-dir + session-logs in one) exits non-zero on any file error, for backfill/backtest.
- **D9 — No DB rows.** Bulk file dump verified by `_manifest.json` (working_dir) + `_tree.json` (session logs). No `substation` table change; the only substation touch is the bucket-create migration.

## 6. Implementation sketch

**`substation`:** one migration — create bucket `sir-trace` (`public = false`), clear its mime allowlist (copy the `sir-artifacts` policy from the §9 migration).

**`claude-plugins/…/upload-sir/scripts/publish.ts`:**
- Factor #195's core into `mirrorTree(sb, srcRoot, bucket, prefix, {redactEnvSecrets})` → `{ok, uploaded, total_bytes, errors, manifest}`.
- **Repoint working-dir:** replace the `uploadFullRunOutput(... 'full-run-output/<id>/v<v>')` call with `mirrorTree(sb, runDir, 'sir-trace', '<sir_uuid>/working_dir')` (no version).
- **Add `resolveSessionLogRoot(env)`** (§2 discovery) → `{mainLog, subagentsDir, toolResultsDir}` or `null` (skip-with-warning; overridable via `--config-dir`/`--session-id`).
- **Add `buildAgentTree(mainLog, subagentsDir)`** implementing §4 → the role-mapped placement plan + `_tree.json`.
- **Add `mirrorSessionLogs(sb, sessionRoot, '<sir_uuid>/claude-code-session-logs')`** — redact (D7), upload each transcript to its role path, write `_tree.json`.
- In `publish()`, **only when `sir.action === 'create'` and `plan.mirrorTrace !== false`:** run the working-dir mirror then the session-log mirror against `sir-trace`; fold results into `warnings`. On a version bump, skip (D2).
- New CLI: `case 'sir-trace': return sirTraceCmd(sb, rest[0] /*sirId*/, rest[1] /*runDir*/)` — resolves session root from env, runs both mirrors, `exit(1)` on any error.
- `SKILL.md`: document the bucket, the `<sir_uuid>/{working_dir,claude-code-session-logs}` layout, the role-mapping, the v0-only rule, the redaction default, the opt-out.

## 7. Out of scope
- A **post-session completion hook** to upload the *final complete* top-level log (closing the D5 tail gap) — a Claude Code session-end hook, not a mid-session skill step.
- A **read/replay/provenance UI** over the trace.
- **Cross-session stitching** for runs spanning a compaction/handoff (Q4).
- Capturing traces for **version bumps** (D2 — v0 only).

## 8. Migration / backfill
- **Create `sir-trace`** (the substation migration) before the skill writes to it; `publish` preflight asserts the bucket is reachable and skips-with-warning if absent.
- **Backfill existing `sir-artifacts/full-run-output/*`** into `sir-trace/<id>/working_dir/` via the standalone subcommand (only the Katy VA run `cceb8962-9851-4e08-9e69-0e022f043a0a` exists there today), then **retire** the old `sir-artifacts/full-run-output/` prefix. Session logs cannot be backfilled for past runs unless those laptops' `~/.claude*/projects` trees still exist (best-effort, per-run).

## 9. Open questions
- **Q1 — Robust role signal.** Should the SIR runbook tag each orchestrator spawn with an explicit machine role (`sir-role: phase-1-orchestrator`) so §4 classification keys on a tag, not prose? (Recommended follow-up.)
- **Q2 — Layout stability.** Confirm stock Claude Code (`~/.claude/projects/…`) sub-agent layout; discovery must handle both before we trust it broadly.
- **Q3 — `tool-results/` placement.** Session-global sidecar — keep as a shared dir under `top-level-…/`, or partition per owning agent (requires mapping each sidecar file to the agent that referenced it)? MVP: shared under top-level.
- **Q4 — Scope filter.** "Whole session" vs filter to agents referenced by this run. MVP: whole session (== run normally).
- **Q5 — Redaction sufficiency.** Env-value replacement misses inline-pasted / runtime-fetched secrets. Is env-redaction + a private bucket the acceptable bar, or do we need entropy-based token scrubbing / an access policy on the bucket?
- **Q6 — Size / retention.** The full session-log tree (with `tool-results/`) is a large multiple of the 112 MB working-dir mirror. Per-run cap, gzip-per-file, or lifecycle policy on `sir-trace`?

## 10. Acceptance
- The `sir-trace` bucket exists (private) and, after an initial `upload-sir`, contains `sir-trace/<sir_uuid>/working_dir/…` (the full run tree + `_manifest.json`) and `sir-trace/<sir_uuid>/claude-code-session-logs/` with the four role directories, per-agent transcripts placed correctly, and a `_tree.json` decoding every agentId.
- `_tree.json` `role` assignments match the run's actual spawn structure (spot-check: `ac27737…`→phase-1, `a8da821…`→phase-2, `a25511…`→phase-3, `aa3f2f…`→top-level/workers/records-pull).
- Known `process.env` secret values do not appear in any uploaded transcript; `_tree.json` reports `redacted: true` with a non-zero count when secrets were present.
- Nothing is written under `sir-artifacts/full-run-output/` anymore; the deliverable publish still succeeds if the `sir-trace` step is forced to fail (best-effort proven); the step is skipped on a version bump.
- The standalone `sir-trace <sirId> <runDir>` reproduces both mirrors for an already-published SIR and exits non-zero on any file error.
