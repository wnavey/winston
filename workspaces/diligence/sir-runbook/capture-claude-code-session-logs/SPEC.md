# Capturing Claude Code Session Logs on SIR Publish

**Status:** Draft v1
**Date:** 2026-08-12
**Type:** Implementable spec. Extends the `upload-sir` skill with a final, best-effort step that mirrors the **Claude Code session logs** of the SIR runbook session (the top-level orchestrator transcript + every spawned sub-agent transcript) to Supabase Storage, alongside the run.
**Repos touched:** `claude-plugins` only — `plugins/noetic-tools/skills/upload-sir/scripts/publish.ts` (new step + subcommand) and its `SKILL.md` (document the step). No schema, no new bucket, no other repo.
**Repos NOT touched:** `substation` (no DB rows — bulk file dump only, same as the full-run-output mirror), `bureau`, `conductor`, `surveyor`, `cityhall`, `field-agent`.
**Builds on:** the **full-run-output mirror** (`claude-plugins` #195, commit `a8cdfc20`) — this feature is a structural twin of it. Reuses the same bucket, the same best-effort semantics, the same manifest pattern, the same `walkFiles`/upload machinery.

> **One-line goal:** After a SIR runbook run is published — deliverable rows written, files uploaded, the full run directory mirrored, geo rows written — also mirror the **Claude Code session logs** (this session's top-level transcript + all of its sub-agent transcripts) to a non-client Storage prefix, so a run's *complete* agentic trace (every tool call, every command, every sub-agent report) is recoverable for audit, debugging, backtests, and provenance — the way this very session reconstructed exactly which tool produced `parcel-rings.geojson`.

---

## 1. Problem / motivation

A SIR runbook run's on-disk **artifacts** (the deliverable, the phase folders) are now fully captured: the deliverable rows land in `site_intelligence_report` + `sir_artifact`, and the full-run-output mirror (#195) dumps the entire working directory to `sir-artifacts/full-run-output/<sir_id>/v<version>/`.

What is **not** captured is *how the run actually behaved* — the agentic trace. Each phase orchestrator and each worker it spawns runs as a Claude Code sub-agent whose complete transcript (every `tool_use`, every `tool_result`, every reasoning turn, every sub-agent report) is written to a JSONL log on the operator's machine. Those logs are the only record of:

- **Provenance of every artifact** — e.g. *which* county tool or raw endpoint produced a geometry file. (Demonstrated in practice: a session was able to prove `parcel-rings.geojson` came from a direct keyless `curl` to `gis.hctx.net/.../HCAD/Parcels/MapServer/0`, **not** a surveyor-defined tool, purely by parsing the phase-1 orchestrator's transcript.)
- **Failure forensics** — what a degraded records pull actually tried, where a tool 403'd, what a worker silently fell back to.
- **Backtest evidence** — comparing runbook behavior across prompt/tooling versions.
- **Cost/behavior analysis** — model routing, retries, fan-out shape.

Today those logs live only on the laptop that ran the session and are never persisted with the run. When the working directory is archived or the machine is wiped, the trace is gone. This spec persists it.

## 2. Verified current state (this harness, 2026-08-12)

All paths and env vars below were confirmed live this session (background job on `darwin`, `CLAUDE_CONFIG_DIR=/Users/winston/.claude-personal`).

- **Top-level session transcript** lives at the *project* level, named by session id:
  ```
  $CLAUDE_CONFIG_DIR/projects/<project-slug>/$CLAUDE_CODE_SESSION_ID.jsonl
  ```
  e.g. `…/projects/-Users-winston-noetic/1d046856-4242-46f7-8d13-ab591e0dc82a.jsonl`. Confirmed present and **actively growing** (mtime seconds old, size increasing) — it is the live conversation log.
- **Sub-agent transcripts** live in a per-session directory (sibling to the `.jsonl`, same session-id stem), one file per spawned agent:
  ```
  $CLAUDE_CONFIG_DIR/projects/<project-slug>/$CLAUDE_CODE_SESSION_ID/subagents/agent-<agentId>.jsonl
  ```
  This SIR session had **~48+** such files (three phase orchestrators + every researcher/discipline/records/appendix worker). By the time `upload-sir` runs (the very end of the run), **every sub-agent has completed** — its JSONL is final and fully flushed (confirmed by reading several completed ones this session).
- **A sidecar `tool-results/` directory** sits next to `subagents/` (offloaded large tool outputs referenced from the transcripts). Present with ~24 entries this session.
- **Discovery env vars are set in-process:** `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_SESSION_ID` (and `CLAUDE_CODE_CHILD_SESSION`). The `<project-slug>` segment is the sanitized cwd (`-Users-winston-noetic`) and is resolvable as the parent dir of the session dir. **No path guessing is required.**
- **Storage target already exists:** the `sir-artifacts` bucket (app project `mgxqsrjutswbciyrltwd`), private, with the relaxed mime allowlist from the §9 migration the full-run-output mirror already depends on.

> **Layout caveat (see Q2).** The `<session-id>.jsonl` at project root + `<session-id>/subagents/` split was verified in *this* harness (a custom `~/.claude-personal` config dir). Stock Claude Code uses `~/.claude/projects/…` and may not split sub-agents into a `subagents/` subdir. Discovery must resolve the layout at runtime, not hardcode it.

## 3. Architecture — a structural twin of the full-run-output mirror

The full-run-output mirror (#195) already established every primitive this feature needs:

| Primitive | full-run-output (#195) | session-logs (this spec) |
|---|---|---|
| Bucket | `sir-artifacts` | `sir-artifacts` (same) |
| Prefix | `full-run-output/<sir_id>/v<version>/` | `session-logs/<sir_id>/v<version>/` (distinct top-level prefix) |
| Source | the run **working directory** | the **Claude Code session log tree** (resolved from env) |
| Enumeration | `walkFiles(runDir)` (recursive, cruft-subtracted, symlink-skip) | `walkFiles(sessionLogRoot)` (reuse verbatim) |
| DB rows | none (bulk dump) | none (same) |
| Verification | one `_manifest.json` at the prefix root | one `_manifest.json` (same shape) |
| Inside `publish` | best-effort (warns, never fails the txn) | best-effort (same) |
| Standalone | `full-run-output <sirId> <version> <runDir>` | `session-logs <sirId> <version>` (session resolved from env) |
| Opt out | `mirrorFullRunOutput: false` | `mirrorSessionLogs: false` |

So implementation is: **factor the mirror's upload+manifest core** (already isolated as `uploadFullRunOutput`) into a reusable `mirrorTree(sb, srcRoot, storagePrefix, {sirId, version})`, then call it a second time against the resolved session-log root.

### 3.1 What gets captured (the capture set)

Mirror the session-log tree preserving its on-disk shape under the prefix:

```
session-logs/<sir_id>/v<version>/
├── _manifest.json                       # rel_path / storage_path / byte_size / sha256 / mime + errors + capture metadata
├── session.jsonl                        # the top-level session transcript ($CLAUDE_CODE_SESSION_ID.jsonl)
├── subagents/
│   ├── agent-<id>.jsonl                 # every spawned sub-agent (phase orchestrators + workers)
│   └── …
└── tool-results/                        # sidecar offloaded tool outputs (see Q3 — may be default-on or opt-in)
    └── …
```

### 3.2 Discovery (resolve the session-log root)

Runtime resolution, env-first, no hardcoding:

1. `cfg = $CLAUDE_CONFIG_DIR` (fallback `$HOME/.claude` then `$HOME/.claude-personal`).
2. `sid = $CLAUDE_CODE_SESSION_ID`.
3. Find the project dir under `cfg/projects/*` that contains either `<sid>.jsonl` or a `<sid>/` dir (there is exactly one).
4. Main log = `cfg/projects/<proj>/<sid>.jsonl`; sub-agent dir = `cfg/projects/<proj>/<sid>/subagents/`; sidecar = `…/<sid>/tool-results/`.
5. If neither the main log nor the subagents dir resolves → **skip with a warning** (`session-logs: could not resolve session transcript root`), never fail the publish. Allow overrides via `--config-dir` / `--session-id` for the standalone/backfill path.

### 3.3 Where it slots into `publish`

Ordered **last**, after every other write (matches the operator's stated ordering):

```
org → project → site_intelligence_report → sir_artifact rows → upload deliverable bytes
    → full-run-output mirror (#195) → [geo rows, where a geo step exists] → SESSION-LOGS mirror (this spec)
    → append sir-publishing-record.json
```

Geo-row writing is a separate concern (see `../../sir-geometry/…`); this step simply runs after it where present. Session-logs is intentionally the final artifact step because it is the most self-referential (§ D5) — the later it runs, the more of the session it captures.

## 4. Decisions

- **D1 — Attach to `upload-sir`, as a best-effort twin of full-run-output.** New `mirrorSessionLogs` step inside `publish()` + a standalone `session-logs <sirId> <version>` subcommand for re-run/backfill/backtest. Reuses the extracted `mirrorTree` core. Rationale: identical mechanics; no reason to build a second uploader.
- **D2 — Non-client, isolated prefix.** `session-logs/<sir_id>/v<version>/` is its own top-level prefix in `sir-artifacts` — **never** under the deliverable path `sir/<id>/v<v>/`, so nothing that enumerates client deliverables ever sees it. Same isolation rationale (#195 D) as full-run-output. Session logs are internal forensic data, not client artifacts, and carry the runbook "process vocabulary" that is deliberately kept out of client-facing text.
- **D3 — Capture set = main + sub-agents (+ tool-results).** The main transcript alone is not enough — the substantive work happens in sub-agents (phase orchestrators + workers), and their transcripts are where provenance lives. Include `tool-results/` so the logs are self-contained/replayable (subject to Q3 on size).
- **D4 — Env-driven discovery, runtime layout resolution.** Resolve from `CLAUDE_CONFIG_DIR` + `CLAUDE_CODE_SESSION_ID`; do not hardcode the `~/.claude-personal` layout (Q2). A missing/unresolvable root is a skip-with-warning, never a hard failure.
- **D5 — The top-level log is self-referential; capture is "as-of-upload," with a documented tail gap.** The main `.jsonl` is being written by the very session doing the upload, so at capture time it necessarily lacks its own tail: the `tool_use` that performs the session-logs upload, that call's `tool_result`, and the session's closing summary are not yet written/flushed. This is an **inherent** limitation — a complete main log cannot be produced from inside the session. The manifest records `main_log_incomplete_tail: true` and a `captured_at` timestamp so consumers know. **Sub-agent logs do not have this problem** — they are complete. A truly-complete final main log, if needed, must come from a post-session hook (out of scope; § 7).
- **D6 — Scope = the session, not strictly the run.** The sub-agent dir holds every agent *this session* spawned. For a dedicated SIR runbook session (the normal operating model) session == run and this is exactly right. Caveat: a session that did multiple things, or a run that spanned a compaction/handoff into a second session id, would over- or under-capture. MVP mirrors the whole session and documents the assumption; an optional mtime-window / referenced-agent filter is a follow-up (Q4).
- **D7 — Secret handling is the gating policy call.** Session logs are far more sensitive than the deliverable or even the full-run-output mirror: they contain full chain-of-thought, every raw `tool_result`, and potentially **secret values that transited tool calls** (this run sourced `field-agent/.env` and handled clerk creds + `AI_GATEWAY_API_KEY`; any value ever echoed into a Bash result is in a transcript). MVP requires, at minimum, (a) the isolated private prefix of D2, and (b) a **redaction pass** over the process env's secret-looking values (`SUPABASE_*`, `*_SERVICE_ROLE_KEY`, `*_KEY`, `*_TOKEN`, `*_PASSWORD`, `AI_GATEWAY_*`, `*_USERNAME`) — replace exact value matches with `«REDACTED:<VARNAME>»` in each JSONL line before upload. This is streaming string replacement, not parsing. Uploading logs with **no** redaction requires an explicit operator opt-in (`--no-redact`), never the default. (See Q5 — redaction is best-effort, not a guarantee.)
- **D8 — No per-file DB rows.** Same as full-run-output: a bulk dump verified by one `_manifest.json`. No schema change, no `substation` touch.
- **D9 — Best-effort inside `publish`, strict standalone.** A per-file failure (or an unresolvable root) inside `publish` warns and never undoes the transactional deliverable publish. The standalone `session-logs` subcommand surfaces the same errors and **exits non-zero** on any file error, so a backtest/backfill can see a partial capture.
- **D10 — Versioned like the mirror.** Keyed by `sir_id` + `version`. A version bump captures a fresh snapshot of *the current* session (which may differ from the session that produced v0). Carry-forward does not apply — logs are a point-in-time capture, always re-captured whole.

## 5. Implementation sketch (`publish.ts`)

- Extract the #195 core into `async function mirrorTree(sb, srcRoot, prefix, {sirId, version, redactEnvSecrets})` returning `{ok, uploaded, total_bytes, errors, manifest_path}`.
  - `uploadFullRunOutput` becomes `mirrorTree(sb, runDir, 'full-run-output/…', …)`.
  - Session-logs becomes `mirrorTree(sb, sessionLogRoot, 'session-logs/…', {…, redactEnvSecrets: true})`.
- Add `resolveSessionLogRoot(env)` implementing § 3.2 (returns `{mainLog, subagentsDir, toolResultsDir}` or `null`).
- Redaction (D7): when `redactEnvSecrets`, build the secret-value set from `process.env` filtered by the D7 key patterns (dropping empties and very short values), and run a string-replace over each file's bytes before upload. Record `redacted: true` + the count of distinct secrets scrubbed in the manifest (never the values).
- In `publish()`, after the full-run-output step (and any geo step), if `plan.mirrorSessionLogs !== false`: resolve the root, call `mirrorTree`, fold `uploaded`/`errors` into `warnings` exactly as #195 does.
- New CLI dispatch: `case 'session-logs': return sessionLogsCmd(sb, rest[0], rest[1])` — resolves the root from env (or `--config-dir`/`--session-id`), calls `mirrorTree`, `out(res)`, `exit(1)` on `!res.ok`.
- `SKILL.md`: document the step, the prefix, the opt-out flag, the self-referential caveat, and the redaction default.

## 6. Manifest shape (`session-logs/<sir_id>/v<version>/_manifest.json`)

```json
{
  "site_intelligence_report_id": "<uuid>",
  "version": 0,
  "captured_at": "<iso8601>",
  "session_id": "<CLAUDE_CODE_SESSION_ID>",
  "config_dir": "<CLAUDE_CONFIG_DIR>",
  "main_log_incomplete_tail": true,
  "redacted": true,
  "redacted_secret_count": 6,
  "file_count": 49,
  "total_bytes": 123456789,
  "error_count": 0,
  "files": [{ "rel_path": "session.jsonl", "storage_path": "session-logs/…", "byte_size": 1772761, "sha256": "…", "mime_type": "application/x-ndjson" }],
  "errors": []
}
```

## 7. Out of scope

- **A post-session completion hook** that uploads the *final complete* main log (closing the D5 tail gap). Worth doing separately — a Claude Code `Stop`/session-end hook, not a step inside a skill that runs mid-session.
- **A read/replay UI** for these logs (a viewer over the JSONL, provenance queries).
- **Cross-session stitching** for runs that spanned a compaction/handoff (D6).
- **Any schema / `geo` / deliverable change** — this feature only adds a Storage prefix.

## 8. Open questions

- **Q1 — Direct env var for the main transcript path?** We derive it (§ 3.2). If the harness exposes the main transcript path directly (an env var), prefer that — it is sturdier than deriving from `<session-id>.jsonl`.
- **Q2 — Layout stability across harness versions.** Verified against this `~/.claude-personal` layout. Confirm stock Claude Code (`~/.claude/projects/…`) — does it split sub-agents into `<session-id>/subagents/`, or store them differently? Discovery must handle both; needs a second observed layout before we trust it broadly.
- **Q3 — Include `tool-results/` by default?** It can be large. Default-on for completeness, or opt-in for size? Lean default-on, with a size guard/log if it dominates.
- **Q4 — Scope filter (D6).** Is "whole session" acceptable, or do we filter to agents referenced by this run (by mtime window, or by cross-referencing agent ids that appear in the run's artifacts)? MVP: whole session; revisit if multi-run sessions become common.
- **Q5 — Redaction sufficiency (D7).** Env-value string replacement catches secrets that flowed *from the environment*. It will not catch a secret that was pasted inline or fetched at runtime and never lived in `process.env`. Is env-value redaction + a private isolated prefix an acceptable bar, or do we need a stronger scrub (entropy-based token detection) / an explicit "logs may contain secrets" access policy on the prefix?
- **Q6 — Retention / size cap.** Session logs can be hundreds of MB (this run's tree, with tool-results, is a large multiple of the 112 MB full-run-output mirror). Any per-run cap, compression (gzip each JSONL before upload), or lifecycle policy?

## 9. Acceptance

- Running `upload-sir` on a completed SIR runbook run leaves, in `sir-artifacts/session-logs/<sir_id>/v0/`: `session.jsonl`, every `subagents/agent-*.jsonl`, `tool-results/*` (if enabled), and a `_manifest.json` whose `file_count` matches the local file count and whose `error_count` is 0.
- The standalone `session-logs <sirId> <version>` subcommand reproduces the same capture for an already-published SIR and exits non-zero on any file error.
- Known secret values present in `process.env` do not appear in any uploaded JSONL (spot-checked), and `_manifest.json` reports `redacted: true` with a non-zero `redacted_secret_count` when secrets were present.
- The deliverable publish still succeeds even if the session-logs step is forced to fail (best-effort proven).
- The prefix is invisible to any deliverable enumeration (it lives under `session-logs/`, not `sir/<id>/`).
