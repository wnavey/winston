# local-runs/

Conductor invocation scripts that mirror specific Inngest `workflow/run`
events but run conductor directly on the local machine — bypassing
Substation, Inngest, and Vercel Sandbox.

## When to use

- The production sandbox path is hanging (no LLM activity, function
  paused on `wait-for-conductor`, no `workflow_runs` row written) and we
  want to know whether conductor itself crashes locally.
- We want a stack trace from a conductor failure that's currently being
  swallowed by the detached sandbox subprocess.
- We're iterating on a conductor change and don't want to round-trip
  through merge-to-main → Vercel deploy → sandbox cold-start for each
  attempt.

If the local run completes cleanly, the bug is environmental
(deployment, sandbox cold-start, env var propagation). If it crashes,
the stack trace points us at the source.

## Conventions

- One script per Inngest event we want to mirror. Filename matches the
  `runLabel` suffix in lowercase-kebab.
- Each script's `run-label` ends with `_LOCAL` so the local run never
  collides with the production run on `workflow_runs.inputs.runLabel`.
- Scripts must be run from the conductor repo root. Each script
  asserts this with a `src/index.ts` existence check.

## Pre-run setup (one-time)

1. Make sure your local conductor repo is on the commit you want to
   test (typically `origin/main` to reproduce the prod hang).
2. Ensure bureau is checked out at a path conductor can resolve, or
   pass `--bureau-path=/abs/path/to/bureau` to the script command.
3. Source your `.env` so the required env vars are exported:
   - `PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AI_GATEWAY_API_KEY` (or whatever the AI Gateway env name is —
     check `conductor/src/shared/env-validator.ts`)
   - `ANTHROPIC_API_KEY` (for the agent itself)
4. Optionally set `WORKSPACE_PATH` to a directory you can inspect
   (e.g. `/tmp/run5-backup-local`); otherwise conductor picks a tmpdir
   default.

## Running

```bash
cd /Users/winston/noetic/conductor
bash /Users/winston/noetic/winston/workspaces/vision-tool-orchestration/local-runs/run-5-backup-local.sh
```
