# Browser handoff — a hosted browser a person takes over at a HITL gate, and the agent gets back

**Status:** Draft v1
**Date:** 2026-09-24
**Repos touched:** `conductor2` (`noetic-browser hold` / `release` / `attach`; `browser.rs` reap respects a hold), `bureau` (the captain forwards the live view onto a `hands` card; site-research's acquire step holds its browser; a smoke fixture), `substation` (a `hands` answer lands as the file the gate declares), `cityhall` (the live view embedded on the card, `frame-src`), `claude-plugins` (the `agent-browser` skill's hosted-browser section names the new verbs)
**Repos NOT touched:** `conductor2`'s callback and scheduler (the one-at-a-time fix is conductor2#114, already cut), `dsd`
**Parent:** `../DESIGN-SPEC.md` v2 §"Vercel browser" (which already says a `hands` gate carries the vendor's live-view URL and that parking stops the browser — this spec replaces the second half), `../cloud-captain/DESIGN-SPEC.md` (the captain that authors the card)
**Fixture:** bureau#1787 (smoke's animal quiz — three chained gates whose answers a person reads off a web page) and conductor2#114 (a chain of gates asks one question at a time)

## Problem

A sir run gets its clerk documents from county websites, and those sites put up walls an agent cannot pass: an account it has to create, a login it does not hold, a checkout, a CAPTCHA a solve could not clear. On the local lane this is solved and ordinary. The acquire step leaves its **headed Chrome open at the page**, writes what it needs a person to do, and a person at the machine does it (`bureau/runbooks/site-research/steps/9.8-acquire/prompt.md:14`, "leave your headed browser session open at that page … what he does at the page it is sitting on"); the `9.7-hands` gate parks the run until `hands-done.json` says each item was done or declined (`9.7-hands/contract.test.ts:27-38`).

On the cloud lane the same run cannot do this at all, and the reasons are four separate gaps, each verified 2026-09-24:

1. **There is no browser to leave open.** A Vercel sandbox has no display. A cloud step rents a browser from Browser Use Cloud through `noetic-browser` (`conductor2/containers/bin/noetic-browser`, at `/usr/local/bin` in the image), which creates it, binds an `agent-browser` session to its CDP URL, and records `{id, cdp_url, live_url, …}` in the step's `scratch/browser.json` (`:126-127`). That browser runs on the vendor's machines, not in the sandbox — but **conductor stops it on every step exit**: `browser::reap` runs after every agent attempt and every script step (`conductor2/src/verbs/agent.rs:263`, `:987`), and reap is `stop --all` over the record (`noetic-browser:265-274`). The step that hit the wall ends when it parks, and its browser dies with it.

2. **Nothing puts the live view on the card.** The vocabulary exists end to end: the CLI takes `ask --live-view-url` for a `hands` question and puts it in the payload (`bureau/runbooks/lib/runbook_hitl_cli.py:637`, `:343`); `runbook_hitl_questions` has a `live_view_url` column and a `hands` kind; the console's hands card renders "Open live browser view ↗" with the credential warning and a **Mark done** button (`cityhall/src/lib/runbook-runs/RunbookHITLQuestion.svelte:73`, `:368-392`, origin/main). But no producer fills it. The cloud captain's `ask` has no live-view parameter (`bureau/runbooks/lib/captain.py:190-192`) and passes none at park (`:531-538`); conductor's callback `Gate` carries no such field (`conductor2/src/callback.rs:58-70`). Prod (`mgxqsrjutswbciyrltwd`, all time): **77 `decision` rows, 2 `operator`, 0 `hands`, 0 with a live URL.**

3. **A cloud `hands` answer lands in the wrong file.** The reconcile loop writes every decided gate's answer to `<step>/decision.json` and `decision.md` (`substation/src/lib/reconcile-loop.ts:438-456`, `plan.ts:625-631`, origin/main). The hands gate's contract reads `hands-done.json` (`9.7-hands/contract.test.ts:38`). The decide controller accepts a schema-less `hands` answer precisely so a person can close one (`decide-controller.ts:148-150`), and then the file it produces satisfies nothing. A cloud run that reaches `9.7-hands` with items parks forever.

4. **Until this week, a chain of gates was asked all at once.** Conductor listed every `runner: none` step whose contract fails as open at exit 75, reached or not; smoke run `7c2561b4` (2026-09-24) opened four cards on its first park, three about an animal nothing had drawn. Fixed in conductor2#114: a gate is open only once its inputs are in. This spec assumes it.

What the local lane has and the cloud lane lacks is one thing: **a browser that outlives the step, that a person can act in, and that the next step can pick back up.**

## 1. The shape of a handoff

A handoff is a gate, not a mid-step pause. A runbook never suspends an agent mid-thought; the step that hits the wall finishes, a `runner: none` gate parks the run, and the step that continues the work starts as a fresh session that reads the run directory. Site-research already has this shape (`9.8-acquire` → `9.7-hands` → `9.8-acquire` again, reading `hands-done.json`). The cloud lane adds one thing to it: the browser survives the gap.

The walk, for a cloud sir run that needs an account on a clerk site:

1. **The acquire step** opens a hosted browser (`noetic-browser open --timeout 240`), navigates to the portal, and meets the account wall.
2. It writes the hands item (`needs-hands.json` + `needs-hands.md`: portal, document, what the person does at the page it is on), **holds** the browser (`noetic-browser hold`), and exits. Its contract passes; the item is recorded, not resolved.
3. **The hands gate** parks the run (exit 75). The captain authors the question and, because the gate's input step holds a browser, puts that browser's live-view URL and its expiry on the card. The sandbox stops and snapshots (substation#284). The browser keeps running at the vendor: the sandbox only ever held a websocket to it, and disconnecting CDP does not stop a Browser Use browser ([concepts/browser](https://docs.browser-use.com/concepts/browser)).
4. **The person** opens the live view in their own browser, creates the account, logs in, and presses **Mark done**. The live view is interactive by default and embeds in an iframe ([cloud/browser/live-preview](https://docs.browser-use.com/cloud/browser/live-preview)).
5. **Substation** writes `hands-done.json` into the gate's folder and resumes the sandbox from its snapshot; the run directory, the scratch record included, comes back intact.
6. **The acquire step runs again** as a fresh session, reads `hands-done.json`, and **attaches** to the recorded browser (`noetic-browser attach`, which re-binds an `agent-browser` session to the recorded CDP URL). It is inside the person's logged-in session and continues the pull.
7. When it is done for real it pulls its downloads, **releases** the hold, and stops the browser, which also ends the live URL. Conductor's reap at step exit is the backstop.

The hosted browser lives **at most 240 minutes** and the vendor offers no extend — `PATCH /browsers/{id}` takes only `{"action":"stop"}` ([api-v4/browsers/update](https://docs.browser-use.com/cloud/api-v4/browsers/update-browser-session)). **The MVP accepts this** (Will, 2026-09-24): a person who takes longer than four hours finds the browser gone, the resumed step opens a fresh one and records the gap as a hands item again. Profiles, which would carry the login across that boundary, are §7.

## 2. Decisions

- **D1 — A hold is a field in the step's own browser record, and reap honours it.** `noetic-browser hold [--name NAME] [--until ISO]` sets `hold_until` on the record in `scratch/browser.json` (default: the browser's own `timeoutAt`, so a hold never outlives the browser). `reap` skips a browser whose `hold_until` is in the future and says so on stderr; `release` clears it; a hold past its time is reaped as today. `browser.rs`'s ledger charge is unchanged — a held browser is still charged as unsettled until it stops, which is the safe direction (`browser.rs:44-55`). No new state anywhere else: the record already exists, and it travels with the run directory through the snapshot.

- **D2 — The handoff is a gate; the step that meets the wall finishes.** No step pauses mid-run and no agent session is resumed. The acquire step's job at a wall is to record the item, hold the browser, and pass its contract. The gate is the pause; the re-run is the continuation. This is the site-research pattern as written, on both lanes.

- **D3 — The captain puts the live view on the card.** At a `hands` park, `captain.park` reads every held record under the gate's input steps' `scratch/browser.json` and passes the first one's `live_url` as `--live-view-url`, plus a `payload.browser = {name, id, expires_at}` so the card can print the deadline. `captain.ask` gains the two parameters; `runbook_hitl_cli.py` already carries them. The callback path stays what it is (a card with no live URL); cloud-captain D4's rule holds — the captain wins, the callback is the backstop for a captain that died before asking.

- **D4 — Substation writes the file a `hands` gate declares.** For a decided gate of kind `hands`, the reconcile loop writes `<step>/hands-done.json` instead of `decision.json`. The MVP answer shape is the card's existing `{hands_done: true}`, projected to one `{document, outcome: "done", note}` row per item of the input step's `needs-hands.json` (carried onto the card as `payload.items` at ask time, so substation has the list without reading the sandbox). A per-item done/declined card is Q3. `decision.md` is still written beside it so a person reading the folder sees who closed the gate.

- **D5 — The resumed step attaches; it never re-opens a browser it holds.** `noetic-browser attach [--name NAME]` re-binds an `agent-browser` session to the recorded `cdp_url` (bind first, always — the same rule `open` follows, `noetic-browser:113-118`), after confirming with `GET /browsers/{id}` that the browser is still `active`. An expired or stopped browser is reported as such, the record is marked `stopped_at`, and the step opens a fresh one — logged out, which it records as a new hands item rather than pretending. The acquire prompt says: *when `hands-done.json` is present, `attach` before anything else.*

- **D6 — The step that consumes the answer stops the browser.** `release` then `stop`, in its own epilogue; reap at exit is the backstop, and a hold whose time has passed no longer protects anything. A live URL is a credential that drives the browser for its whole life, so its life ends with the gate that needed it.

- **D7 — The card embeds the live view.** The vendor's documented snippet (`<iframe src=liveUrl allow="autoplay">`) inside the hands card, the link kept beside it for a new tab, the credential warning as today, and the expiry from `payload.browser`. `live.browser-use.com` joins the CSP source list in `cityhall/src/hooks.server.ts:230` as `frame-src` (the header is `Report-Only` today, `:347-371`, so the embed works either way; listing it keeps the report clean and survives enforcement).

- **D8 — Cloud only, and only when a key is present.** On a lane with no `BROWSER_USE_API_KEY` every `noetic-browser` verb is a no-op, as today (`noetic-browser:24-26`): the local lane keeps its headed Chrome and the person at the keyboard. A local run's hands card therefore carries no live view, which is correct — the browser is on the operator's own screen.

- **D9 — Proxyless stays the default for a handoff.** The residential exit IP rotates between requests (2026-09-08 probe), and a portal that binds a login to an IP would drop the person's session before the agent got back. A step escalates to `--proxy` only for a site that refused the datacenter IP, as the browser-discipline reference already says, and the card says so when it did.

## 3. What each repo changes

| repo | change |
|---|---|
| `conductor2` | `noetic-browser`: `hold`, `release`, `attach`; `reap` skips a live hold; `open` records `timeout_at`. `browser.rs`: `still_running` names a held browser as *held*, not as leaked. Tests: `tests/smoke-noetic-browser.sh` (the one CI runs) gains hold/release/attach cases against the mock. |
| `bureau` | `captain.py`: `ask(live_view_url=, browser=)`; `park` reads held records for a `hands` gate. `runbook_hitl_cli.py`: `--browser-json` beside `--live-view-url`. `site-research/9.8-acquire/prompt.md`: hold on a hands item, attach on `hands-done.json`, release+stop when done. Smoke: the §5 fixture. |
| `substation` | `reconcile-loop.ts`: a `hands` gate's answer lands as `hands-done.json` (D4). `decide-controller.ts`: unchanged (a schema-less hands answer is already accepted). |
| `cityhall` | `RunbookHITLQuestion.svelte`: iframe + expiry on the hands card. `hooks.server.ts`: `frame-src live.browser-use.com`. |
| `claude-plugins` | `agent-browser/SKILL.md` hosted section (and its vendored copy in the image): the three verbs and when a step uses them. |

## 4. Sequencing

| | what | repo | why here |
|---|---|---|---|
| **R1** | `hold` / `release` / `attach`, reap honours a hold | conductor2 | everything else is pointless while reap kills the browser at step exit |
| **R2** | `hands-done.json` from a hands answer (D4) | substation | the gate cannot close in the cloud without it, handoff or not |
| **R3** | captain forwards the live view (D3) | bureau | the card is blank without it |
| **R4** | smoke fixture (§5), run in the cloud | bureau | the pilot; proves R1–R3 together before a real portal |
| **R5** | iframe + CSP (D7) | cityhall | the link works from R3; the embed is the finish |
| **R6** | site-research `9.8-acquire` holds and attaches (D5, D6) | bureau | the real consumer |
| **R7** | skill text | claude-plugins | with R6 |

R2 is independent of the rest and is a bug on its own: it closes the "cloud run parks forever at 9.7-hands" case.

## 5. The smoke fixture

Smoke's quiz (bureau#1787) already asks a person three things they read off a Wikipedia page, one gate at a time. The handoff fixture adds the browser to that conversation, **off by default** (`directives.hands: true`) because it spends a hosted browser and two agent steps:

- **`2.10-open`** (worker, `skills: [agent-browser]`): opens the hosted browser at the drawn animal's article, holds it, writes `needs-hands.json` with one item — *"in the live browser, open the article of one animal linked from this page's first paragraph, and leave the browser there"* — and `needs-hands.md`.
- **`2.11-hands`** (`runner: none`, outputs `hands-done.json?`): the hands gate. The captain puts the live view on the card.
- **`2.12-return`** (worker): attaches, records the URL the browser is on and the page title into `handoff.json`, releases, stops.

The contract on `2.12-return` is the whole point: **the URL the person left the browser at is a different Wikipedia article than the one `2.10-open` opened.** That is the only check that proves a person's actions in the live browser reached the resumed agent, which is the login primitive itself. Without the key (a local run) `2.10-open` opens a local headed session instead and the check is the same.

**Acceptance for the pilot:** a cloud smoke run with `hands: true` parks at `2.11-hands` with a card whose iframe shows the article; a person navigates in it and presses Mark done; the run resumes, `handoff.json` names the page the person chose, and `noetic-browser list` in the step shows the browser stopped and priced. Then the same on site-research against a portal with a free account wall (GSCCCA's limited-use account is the known case).

## 6. Cost and exposure

A held browser bills **$0.02 per browser-hour** while it waits ([pricing](https://browser-use.com/pricing)); a four-hour hold is eight cents, charged to the step's ledger line when it settles. The live URL is a bearer credential with no expiry of its own; today any Noetic member can read the row that carries it (SELECT policy on `runbook_hitl_questions`). The MVP accepts that on the same footing as the readout and attachments the card already shows, bounded by D6 — the URL is dead once the gate closes. Q1 asks whether it should be narrower.

## 7. Deferred, deliberately

- **Profiles.** Browser Use persists cookies and login state to a profile (`profileId` on create; [concepts/profile](https://docs.browser-use.com/concepts/profile)), so a browser opened after the four-hour cap could come up logged in. The MVP accepts the cap instead; profiles are the next step once a real portal has been crossed once, and they raise their own questions (one profile per site or per run; where a shared login lives; whether write-back happens on stop or continuously — unverified).
- **Per-item done/declined on the card** (Q3). The MVP's Mark done marks every item done.
- **The callback shipping a live URL** as the un-captained backstop (Q4).
- **A hosted browser for a remote operator on the local lane** (Q6). Local runs keep the headed Chrome.

## 8. Open questions

- **Q1 — Who may see the live URL?** The row is readable by every Noetic member. Is the card's audience (`specialist` / `engineer`) enough, or does the URL need to be served only to the person the gate is assigned to?
- **Q2 — Hold default.** The browser's own timeout (up to 240 min) or something shorter, given a held browser bills while it waits and a person may never come? Draft: the browser's timeout; the cost is cents.
- **Q3 — Per-item outcomes.** `hands-done.json` carries `done | declined` per document. The card's single button cannot say *declined*. Render one row per `payload.items` entry with done/declined, or accept all-done for the MVP?
- **Q4 — Should conductor's callback also carry the live URL** (read from the upstream step's `scratch/browser.json` at park), so a card is complete even when the captain dies before asking? Draft: no conductor2 callback change; the captain is the lane.
- **Q5 — IP-bound sessions.** Proxyless is the default and its IP should be stable within a browser, but that is asserted, not measured. Confirm on the pilot portal before trusting a login across a park.
- **Q6 — Local lane, remote operator.** When the operator is not at the machine running a local run, should the local lane rent a hosted browser too? Out of scope here; the key's presence already decides which browser a step uses.
