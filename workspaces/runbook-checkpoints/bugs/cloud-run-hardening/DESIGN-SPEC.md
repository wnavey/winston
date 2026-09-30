# Cloud run hardening: concurrent runs, fail-fast credentials, gateless parks, cancel

**Status:** Draft v1
**Date:** 2026-09-30
**Repos touched:** `cityhall-new` (reconcile pass launch gating, setup-script lock, seat-open error classification, gateless-park handling, new `POST /api/runs/:runId/cancel` route + staff UI button), `bureau` (captain preflight + fail-fast exit), `claude-plugins` (`trigger-cloud-runbook` gains `cancel`)
**Repos NOT touched:** `substation` (paused, on the path to deprecation), `conductor2`, `cityhall` (old app)

## Problem

On 2026-09-30 three cloud runs failed, and diagnosing them showed four defects in the cloud run engine. The secrets that did not match between substation and cityhall-new (`RUN_CALLBACK_SECRET`, `SEAT_TOKEN_KEY`) were the trigger, but they were one-off migration issues and are fixed (both rotated, seats re-registered, substation paused). They are not in scope. The four defects below are, because they will turn the next ordinary fault into the same wasted hour.

The runs, for evidence:

| Run | Runbook | Project | What happened |
|---|---|---|---|
| `33de5944-1f8f-4cc6-bf5e-4a70af792d31` | preprocessing-v4 | `23301a8a` (Lamar + Collier, v4) | Every captain call 401'd from the first second (15:26:15Z). The pass ran anyway for 52 min: 57 sheet reads, assemble, readout (~$100–130 list, subscription seat). Parked at `3.3-hitl` at 16:18. The park callback 401'd too, so the loop recovered exit 75 from disk at 17:10 and left the row `parked` with **no question**. Unresumable. |
| `8d068786-d390-49e4-bf9d-011a0b902087` | smoke | `ed9e7ec4` (test project) | Same 401s on its 18:12 pass. |
| `c4cbbae4-ebf2-4964-a445-49a64caba8cd` | smoke | `ed9e7ec4` | Sat `queued` for 45 min re-trying a seat it could not open ("sealed seat token failed authentication"). Could not be cancelled: no route writes `cancelled`. |
| `9085a814-5f13-463a-898a-45dd2a732ba9` | smoke | `ed9e7ec4` | Launched in the **same reconcile pass** as `c4cbbae4`, 2 s apart, in the same project sandbox. Its bureau sync hit `c4cbbae4`'s `/vercel/sandbox/bureau/.git/index.lock`: `setup exited 128`. |

The four defects:

1. **B1: two runs of one project collide in the shared sandbox.** One sandbox serves a whole project, but a pass launches every eligible run.
2. **B2: a pass keeps going after its run credentials are rejected.** The captain treats a 401 on its own run bearer as a narration hiccup. The loop treats a seat that cannot be opened as a transient error and retries it every lease.
3. **B3: a park whose callback was lost strands the run.** The loop records `parked` with no gate: nothing to answer, no badge, no way forward.
4. **B4: runs cannot be cancelled.** No API, no UI, no skill verb. Without it B1 cannot be avoided by hand either.

## B1: concurrent runs of one project collide

### What happens

`reconcile-pass.ts:87` walks the whole plan and calls `reconcileRun` for every row whose action is not `none`, bounded only by `MAX_LAUNCHES_PER_PASS = 5` (`reconcile-loop.ts:126`). Nothing asks whether another run of the same project was launched a moment earlier. The one per-project fact the pass computes, `busyProjects` (`reconcile-pass.ts:65-72`), is only used to stop a shared sandbox from being snapshotted while a sibling is active (`reconcile-plan.ts:75-82, 136-146`). It does not gate launches.

Every setup syncs bureau into one fixed path: `BUREAU=${BUREAU_PATH}` (`plan.ts:211`), then `git fetch`, `git checkout --force --detach`, `git clean -fdx runbooks`, `npm ci` (`plan.ts:223-227`). Two setups in one sandbox run those against the same clone at the same time. The second git process finds the first one's `index.lock` and exits 128.

Evidence (cityhall-new's copy of sandbox `conductor-ed9e7ec4-…`):

```
19:28:38.696Z  .setup/c4cbbae4…  starts  → setup-ok 19:32:22
19:28:40.684Z  .setup/9085a814…  starts  → section-exit=bureau 128
               fatal: Unable to create '/vercel/sandbox/bureau/.git/index.lock': File exists.
19:34:36.092Z  .setup/8d068786…  starts  → setup-ok
```

The collision on `index.lock` is the loud case. The quiet case is worse: run B's setup checks out and `npm ci`s `/vercel/sandbox/bureau` **while run A's captain is executing from it** (`captain.py` and `runbooks/lib` are run from that clone). A pass can have its runbook library swapped under it mid-run.

### Fix

- **D1. One active run per project.** A pass launches a run only when no other run of that project is `running` or was launched earlier in the same pass. Implementation: keep a `launchedProjects` set next to `busyProjects` in `reconcile-pass.ts`. A row whose project is already busy or already launched becomes `action: none` with reason `project sandbox busy with run <id>`, left `queued` for a later tick. Runs of one project are served in `created_at` order.
- **D2. Lock the bureau sync anyway.** Wrap the bureau section of the setup script (`plan.ts:211-230`) in `flock /vercel/sandbox/.bureau-sync.lock`, so a second setup waits instead of failing. This is insurance for any path D1 misses (a probe relaunch racing a queued launch, a future second cron).
- **D3. Say it in the console.** A run held back by D1 gets one checkpoint, `Waiting for run <id> on this project`, written once (`postCheckpointOnce`), so a `queued` run that is not moving explains itself.

Deliberately not done: per-run bureau clones or worktrees so runs of one project can run concurrently. It is the right long-term shape but it changes disk use and setup time for every run. See Q1.

## B2: fail fast when the run's credentials are rejected

### What happens: the run bearer

The captain's first act is a checkpoint, `Captain pass started` (`captain.py:1293-1309`). `note()` posts it and swallows any failure, by design: "a captain that cannot write a checkpoint still has a run to drive, so a failure here is printed and dropped" (`captain.py:265-282`). That is right for a network blip. It is wrong for a `401`, because a 401 on the run bearer means every later call this pass depends on will also fail: step checkpoints, events, gate questions, `publish/prepare`, and conductor's own park/done callback (same `CONDUCTOR_CALLBACK_TOKEN`). The pass's result is lost before it starts.

`33de5944` shows the cost. `pass.log`:

```
captain: Captain pass started
captain: checkpoint failed (POST /api/runs/33de5944-…/checkpoints -> 401 invalid_token: Invalid or expired token.)
captain: Parked · no waiting step named
captain: checkpoint failed (POST /api/runs/33de5944-…/checkpoints -> 401 invalid_token: Invalid or expired token.)
```

The first line is 15:26:15Z. Between the two failures conductor launched 62 steps over 3,126,827 ms, for a readout nobody could approve.

### What happens: the seat

`resolveSubscriptionToken` (`launch.ts:161`) turns the expected seat failures (no seat, not registered, retired) into `SeatUnavailableError`, which the loop turns into a question (D4 of the seat-resolution spec). A seal that will not open is different: `seat-crypto.ts:95` throws a plain `Error` ("sealed seat token failed authentication … re-register the seat"), and the file header says so on purpose (`launch.ts:153-154`). The loop's catch (`reconcile-loop.ts:1244-1256`) posts `Reconcile pass could not act on this run` once and leaves the claim to expire, so the run is retried every lease, forever. `c4cbbae4` did this from 18:44 to 19:28 with nothing on the run but that one checkpoint.

### Fix

- **D4. The captain preflights its bearer before it starts conductor.** First thing in `main()`, before `note("Captain pass started")`: `GET /api/runs/:runId` with the bearer (an allowlisted run-bearer route that returns a projection only). Outcomes:
  - `200`: continue.
  - `401` / `403`: print `captain: run bearer rejected by <SUBSTATION_URL> (HTTP <code>); not starting conductor` and exit with a new code, **`78` (`EX_CONFIG`)**, without running `conductor advance`. Nothing is spent.
  - Network error or `5xx`: retry briefly (3 × with backoff), then continue as today. Transient faults stay best-effort.
- **D5. The loop maps exit 78 to `failed` with a readable error.** `statusForExit` (`control-plane.ts:316`) gains `78 → failed`. The recovery path (`reconcile-loop.ts:1081-1090`) already reads the exit code from disk when no callback lands, which is exactly this case. It writes `error = 'run bearer rejected: the app that verifies callbacks does not recognise this run's token (RUN_CALLBACK_SECRET mismatch?)'` and a checkpoint with the same text. `failed` is terminal and shows on the runs list, which is the point.
- **D6. A mid-pass 401 also stops the captain.** If a later captain call to a run-bearer route returns 401/403 (the bearer was fine at preflight, then the verifying app changed), the captain stops repairing and posting, lets the current conductor step finish, and exits 78 at the next boundary. Q2 asks whether it should instead kill conductor at once.
- **D7. A seal that will not open is a seat problem, not a transient one.** In `resolveSubscriptionToken`, catch the seal-open failure and rethrow it as `SeatUnavailableError(seat, 'the stored token for this seat cannot be opened; re-register the seat')`. The existing D4 seat gate then parks the run with a question an operator can act on ("re-register, then Retry / Approve metered / Cancel"), instead of retrying it silently every lease.

## B3: a park whose callback was lost strands the run

### What happens

When a pass ends without a callback, the loop reads the exit code off the sandbox and writes the matching status (`reconcile-loop.ts:1081-1090`). For exit 75 that is `parked`, and the checkpoint says what went wrong: "the callback that names the waiting steps never landed, so no question was opened" (`reconcile-loop.ts:1098-1107`). The row is now `parked` with zero `runbook_hitl_questions`. The loop resumes a parked run only when a gate is answered, and there is no gate. The sandbox is snapshotted and stopped (checkpoint `Sandbox stopped (snapshotted)`, 17:30:26Z for `33de5944`). Nothing will ever touch the run again, and in the console it looks like any other run waiting on a person.

B2's D4–D6 remove the most likely cause (a rejected bearer), but a callback can also be lost to an app outage or a deploy mid-request, so the recovery path still needs a correct ending.

### Fix

- **D8. A recovered exit 75 opens an operator gate.** When the recovery path sets `parked` and the run has no open question, it opens one itself: kind `decision`, step = the waiting step read from the run directory (conductor's `park` event in `events.jsonl` names it, e.g. `{"kind":"park","step_path":"3.3-hitl",…}`), prompt `This run parked at <step>, but its callback never reached the app, so the step's own question was never opened. Resume re-runs the pass, which re-parks and opens it.` Options: **Resume** (queue a pass: conductor re-parks immediately at the same step and the callback, now working, opens the real question) and **Cancel** (B4).
- **D9. If the waiting step cannot be read, fail visibly.** No `park` event and no readable step: set `failed` with `error = 'parked without a recoverable waiting step; callback lost'`. A visible `failed` is better than an invisible `parked`.

Q3 asks whether a Resume should re-use the snapshot (keeps the finished work) or always re-launch setup.

## B4: runs cannot be cancelled

### What happens

`cancelled` is a valid status (`control-plane.ts:48, 280`) and the runs list treats it as terminal, but the only writer is the seat gate's "Cancel" branch (`seat-resolution.ts:343-347`). `GET /api/runs/:runId` is the only method on that route (`src/app/api/runs/[runId]/route.ts`). The skill says so: "Cancelling is not a thing yet" (`claude-plugins/…/trigger-cloud-runbook/SKILL.md:119`). On 2026-09-30 `c4cbbae4` could not be cancelled without a direct SQL `UPDATE`, it launched anyway, and it collided with the run that was meant to replace it (B1).

### Fix: the route

- **D10. `POST /api/runs/:runId/cancel`** in cityhall-new, body `{ reason?: string }`.
  - **Who:** Noetic staff by JWT, the run's own `triggered_by` user by personal key (`authenticate(request, { personalKey: true })`, `src/lib/api/auth.ts:51-62`), or the service role. Not the run bearer: a sandbox must not cancel its own run.
  - **Effect, in order:**
    1. Conditional update: `status = 'cancelled'`, `finished_at = now()`, `error = 'cancelled by <user email or id>' + (reason ? ': ' + reason : '')`, only where `status in ('queued','running','parked','failed')`. A row already `done` or `cancelled` returns `409 run_already_terminal` with its status.
    2. Close every open question on the run (mark it answered-by-cancel, so the console stops offering it).
    3. `deleteRunSecret` (already implied by `RUN_STATUSES_THAT_FORGET_SECRETS`, `control-plane.ts:303`).
    4. If the run has a live command (`sandbox_session_id` + `cmd_id`): kill that command. Stop and snapshot the sandbox only if no other run of the project is active (the same sibling check `stopSandbox` makes, `reconcile-loop.ts:843-860`).
    5. Checkpoint `Cancelled by <user>` with the reason.
  - **Response:** the run projection (same shape as `GET`).
- **D11. Late writers must not resurrect a cancelled run.** `parkForQuestion` already refuses `done`/`cancelled` (`operations/runs.ts:1011-1022`). Audit every other status writer (the callback's done/failed branches, the recovery path at `reconcile-loop.ts:1090` which already filters `.in('status', ['queued','running'])`, the seat gate, the publish commit) and make each one filter out `cancelled`. Add one test per writer.

### Fix: the skill

- **D12. `trigger-cloud-runbook` gains `cancel <run-id> [--reason <text>]`,** not a new skill: cancelling is the undo of this skill's launch, it uses the same personal key and the same `SUBSTATION_URL`, and the operator already knows where to find it. The SKILL.md procedure gets a Cancel section with the same STOP-for-go rule as launch (show the run's runbook, project, status and cost from `status <run-id>`, wait for an explicit go), and the "Cancelling is not a thing yet" rule is replaced. The script prints the resulting status line.

### Fix: the console

- **D13. A "Cancel run" button on `/runbook-runs/[runId]`** (`src/app/(app)/runbook-runs/[runId]/page.tsx`), staff only, shown while the run is not terminal. It opens a confirmation modal:
  - Title `Cancel this run?`, body naming the runbook, project and current status, and stating it cannot be undone.
  - A text field. The confirm button stays disabled until the field equals **`cancel <runbook>`** exactly (e.g. `cancel smoke`, `cancel preprocessing-v4`), case-sensitive, trimmed.
  - An optional reason field, passed through as `reason`.
  - On confirm, a server action (next to `answerQuestion` in `actions.ts`, behind `requireStaff()`) calls the same operation as D10, then refreshes the page. Errors (`409`, sandbox stop failure) show inline in the modal. A sandbox that fails to stop does not undo the cancel: the row is cancelled, the checkpoint says the stop failed, and the idle-stop in the loop picks it up.

## Out of scope

- The migration-specific failures: mismatched `RUN_CALLBACK_SECRET` / `SEAT_TOKEN_KEY`, the two reconcile crons overlapping, the misleading `invalid_token: Invalid or expired token` wording when a bearer fails HMAC. One-off, already fixed operationally.
- The 20-minute lease delay after setup (substation#295). Separate fix, tracked there.
- The recurring `Reconcile pass could not act on this run: Status code 404 is not ok` checkpoint on every setup. Unexplained; worth its own look.
- Salvaging `33de5944`. It will be re-run once these land, or sooner by hand.

## Implementation order

| # | Change | Repo | Depends on |
|---|---|---|---|
| 1 | D10 + D11: cancel route and the status-writer audit | cityhall-new | — |
| 2 | D13: console button + modal | cityhall-new | 1 |
| 3 | D12: skill `cancel` verb | claude-plugins | 1 deployed |
| 4 | D1 + D2 + D3: one active run per project, sync lock | cityhall-new | — |
| 5 | D5 + D7: exit 78 → failed, seal failure → seat gate | cityhall-new | — |
| 6 | D4 + D6: captain preflight and mid-pass stop | bureau | 5 deployed (else exit 78 reads as a crash) |
| 7 | D8 + D9: gateless park opens an operator gate | cityhall-new | 1 (the gate offers Cancel) |

## Decisions

- **D1** One active run per project; others stay `queued` in `created_at` order.
- **D2** `flock` around the bureau sync in the setup script.
- **D3** A held-back run says why, once.
- **D4** The captain preflights its bearer with `GET /api/runs/:runId`; 401/403 exits 78 without starting conductor.
- **D5** Exit 78 maps to `failed` with a readable error.
- **D6** A mid-pass 401/403 on a run-bearer route stops the captain at the next step boundary with exit 78.
- **D7** A seal that will not open becomes `SeatUnavailableError`, so the seat gate asks instead of the loop retrying.
- **D8** A recovered exit 75 with no open question opens an operator gate at the waiting step (Resume / Cancel).
- **D9** No recoverable waiting step means `failed`, not `parked`.
- **D10** `POST /api/runs/:runId/cancel`: staff JWT, the launcher's personal key, or service role; conditional update, close questions, forget secret, kill the command, stop the sandbox if no sibling is active, checkpoint.
- **D11** No status writer may overwrite `cancelled`; one test per writer.
- **D12** Cancel is a verb of `trigger-cloud-runbook`, with a STOP-for-go.
- **D13** Staff console button with a modal that requires typing `cancel <runbook>`.

## Open questions

- **Q1** Should runs of one project eventually run concurrently (per-run bureau worktree under the run dir) instead of D1's serialization? D1 is the safe default now.
- **Q2** On a mid-pass 401 (D6), finish the current step or kill conductor at once? Finishing wastes at most one step; killing may leave a half-written step folder.
- **Q3** Should the D8 Resume reuse the stopped snapshot (keeps finished steps, as `33de5944` would have wanted) or always run setup fresh? Reuse is cheaper but depends on the snapshot surviving the sandbox's snapshot expiry.
- **Q4** Should the run's launcher (not staff) also see the console Cancel button (D13), matching the API's personal-key rule (D10)?
- **Q5** Should `cancel` on a run with a live pass wait for the kill to confirm before responding, or respond once the row is updated and kill in the background?
