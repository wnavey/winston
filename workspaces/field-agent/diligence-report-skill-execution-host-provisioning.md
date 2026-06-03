# Host provisioning for the field-agent diligence worker

> **Status:** Reference (2026-06-02). The required host profile for running the
> real `noetic-tools:diligence-report` skill via field-agent. Companion to
> [`diligence-report-skill-execution.md`](./diligence-report-skill-execution.md).
>
> **Audience:** whoever provisions the box field-agent runs on (laptop today,
> always-on VM at Phase 3). The worker host — **not** any particular dev
> machine — is what these requirements describe.

---

## Run tiers

Not every dependency is needed for every run. Provision to the tier you intend
to exercise:

- **Tier 0 — scaffolding / dummy:** no skill invocation (`full_run=false`). Only
  needs the base worker (Node + Supabase + Inngest creds + built `noetic-pdf`).
  This is what ships in 2-A.1.
- **Tier 1 — address-only full run:** real skill, no attachments, no live county
  records. Produces a real SIR where surveyor/web-dependent disciplines land as
  `data-gap`. This is the **first real-run target** and needs only the
  ✅-required rows below.
- **Tier 2 — full-fidelity run:** attachments (concept plan → §9), live property
  records, and rich web research. Needs the **fast-follow** rows too.

Tiers 1 and 2 differ only by external-tool provisioning; the worker code is
identical. **Tier 2 tooling (surveyor, agent-browser, vision) is explicitly a
fast-follow — not a blocker for the first real run.**

---

## Dependency matrix

| # | Dependency | Needed for | Tier | Install / provision |
|---|---|---|---|---|
| 1 | **Node 22.4+** | worker runtime | 0 | nvm / system node |
| 2 | **field-agent `.env`** (`INNGEST_*`, `SUPABASE_*`) | event + status I/O | 0 | copy from `.env.example`, fill secrets |
| 3 | **Built `noetic-pdf` (`dist/`)** | Phase 5 render | 0 | `cd ../claude-plugins/plugins/noetic-tools/noetic-pdf && pnpm install && pnpm build` |
| 4 | **`@anthropic-ai/claude-agent-sdk` (pinned 0.2.74)** | skill invocation | 1 | `pnpm add @anthropic-ai/claude-agent-sdk@0.2.74` in field-agent |
| 5 | **Claude auth** — `ANTHROPIC_API_KEY` *(preferred)* or authed `claude` CLI | SDK auth | 1 | export `ANTHROPIC_API_KEY` (see Auth below) |
| 6 | **`claude-plugins` checkout** (`../claude-plugins`) | `noetic-tools` plugin discovery | 1 | sibling clone |
| 7 | **`bureau` checkout** (`../bureau`) with the jurisdiction's `feasibility-guides/` | Phase 0/3 discipline lenses | 1 | sibling clone; confirm `jurisdictions/<slug>/feasibility-guides/*.md` (10 disciplines) present |
| 8 | **`surveyor` checkout** (`../surveyor`) **+ county-site creds** | Phase 2 property records | 2 *(fast-follow)* | sibling clone + surveyor `.env` |
| 9 | **`agent-browser` (global) + Chrome** | Phase 2 web research | 2 *(fast-follow)* | `npm i -g agent-browser && agent-browser install` |
| 10 | **Poppler (`pdftoppm`) or ImageMagick (`magick`)** | Phase 1 vision (PDF→PNG) | 2 *(fast-follow)* | `brew install poppler imagemagick` |
| 11 | **Gemini API key** | Phase 1 dual-model vision | 2 *(fast-follow)* | export `GEMINI_API_KEY` |

### Important: the §9 Concept Plan Review path needs #10 **and** #11

Phase 1 vision extraction only runs when an attachment is present, but when it
*does* run it renders PDF pages to PNG (needs poppler/ImageMagick) **and** calls
Gemini (needs the key). If an attachment is present and either is missing, Phase
1 does **not** gracefully degrade to a data-gap — it fails. So:

- **Tier 1 (address-only) explicitly excludes attachments** and is unaffected.
- **Tier 2 must provision #10 + #11 before accepting attachment runs.**
- **Now handled in field-agent (PR #11):** `attachments.ts` gates download on
  `visionReady()` (`pdftoppm`/`magick` + `GEMINI_API_KEY`). On a non-vision host
  it **skips the download and notes it in `run-summary.json`**, so the run
  proceeds address-only instead of hard-failing Phase 1 — no cross-repo
  "refuse/strip" gate is required for safety (though cityhall may still choose to
  withhold attachments from under-provisioned workers as an optimization).

### Degradation without Tier-2 tools

Without surveyor (#8) and agent-browser (#9), a Tier-1 run **completes** but
surveyor/web-dependent disciplines collapse to `data-gap` (confirmed in Spike
C). That's an acceptable, honest first deliverable — not a failure.

---

## Auth: prefer an explicit API key

Spike A showed the SDK will authenticate via the host's logged-in `claude` CLI
credentials with no `ANTHROPIC_API_KEY`. That works locally but:

- it depends on interactive login state (brittle on a headless VM), and
- Anthropic's published guidance is to use API-key auth for SDK/agent use.

**Recommendation:** set `ANTHROPIC_API_KEY` explicitly on the worker host. It's
ToS-clean, survives the Phase 3 move to an always-on box, and removes a hidden
dependency on `claude` CLI login. CLI-credential inheritance stays as a
dev-convenience fallback only.

---

## Sibling-checkout layout

field-agent resolves bureau / surveyor / claude-plugins as **siblings**, no
hardcoded absolute paths:

```
<workspace>/
├── field-agent/        ← worker runs here
│   └── workspace/<diligenceRunId>/   ← per-run NOETIC_DILIGENCE_DIR (gitignored)
├── bureau/             ← NOETIC_BUREAU_DIR  (../bureau)
├── surveyor/           ← NOETIC_SURVEYOR_DIR (../surveyor)  [Tier 2]
└── claude-plugins/
    └── plugins/noetic-tools/
        ├── (the noetic-tools plugin — loaded by the SDK)
        └── noetic-pdf/ ← NOETIC_PDF_DIR
```

---

## Verification script

Run on the **worker host** before a real run. Reports each dependency by tier;
exits non-zero if any **Tier-1** dependency is missing.

```bash
#!/usr/bin/env bash
# preflight-diligence-host.sh — verify the field-agent diligence worker host.
# Run from the field-agent repo root.
set -uo pipefail
ok(){ printf '  ✅ %s\n' "$1"; }
bad(){ printf '  ❌ %s\n' "$1"; FAIL=1; }
warn(){ printf '  ⚠️  %s\n' "$1"; }
FAIL=0

echo "Tier 1 (required for any real run):"
node -e 'process.exit(+process.versions.node.split(".").map(Number).reduce((a,b,i)=>i?a:(a=b),0)>=22?0:1)' \
  && ok "Node $(node -v)" || bad "Node 22.4+ required (have $(node -v 2>/dev/null||echo none))"
[ -n "${ANTHROPIC_API_KEY:-}" ] && ok "ANTHROPIC_API_KEY set" \
  || { command -v claude >/dev/null && warn "no ANTHROPIC_API_KEY; falling back to claude CLI auth ($(claude --version 2>/dev/null|head -1))" \
       || bad "no ANTHROPIC_API_KEY and no claude CLI"; }
[ -d ../claude-plugins/plugins/noetic-tools ] && ok "noetic-tools plugin" || bad "../claude-plugins/plugins/noetic-tools missing"
[ -f ../claude-plugins/plugins/noetic-tools/noetic-pdf/dist/index.js ] && ok "noetic-pdf built" || bad "noetic-pdf dist/ not built (pnpm build)"
node -e 'require.resolve("@anthropic-ai/claude-agent-sdk")' 2>/dev/null && ok "claude-agent-sdk installed" || bad "claude-agent-sdk not installed"
ls ../bureau/jurisdictions/*/feasibility-guides/*.md >/dev/null 2>&1 && ok "bureau feasibility-guides present" || bad "../bureau feasibility-guides missing"
[ -n "${INNGEST_EVENT_KEY:-}" ] && [ -n "${SUPABASE_URL:-}" ] && ok "Inngest + Supabase env set" || warn "check .env (INNGEST_*, SUPABASE_*)"

echo "Tier 2 (full-fidelity / attachments — fast-follow):"
[ -d ../surveyor ] && ok "surveyor checkout" || warn "../surveyor missing → property-record disciplines = data-gap"
command -v agent-browser >/dev/null && ok "agent-browser (global)" || warn "agent-browser not installed → web research degraded"
{ command -v pdftoppm >/dev/null || command -v magick >/dev/null; } && ok "poppler/ImageMagick" || warn "no pdftoppm/magick → attachment (Phase 1) runs WILL FAIL"
[ -n "${GEMINI_API_KEY:-}" ] && ok "GEMINI_API_KEY set" || warn "no GEMINI_API_KEY → attachment (Phase 1) vision WILL FAIL"

echo; [ "$FAIL" = 0 ] && echo "Tier-1 ready ✅" || { echo "Tier-1 NOT ready ❌"; exit 1; }
```

---

## Cross-refs

- Skill-execution design: [`diligence-report-skill-execution.md`](./diligence-report-skill-execution.md)
- Long-step decision: [`diligence-report-long-step-adr.md`](./diligence-report-long-step-adr.md)
- field-agent roadmap: [`implementation-plan.md`](./implementation-plan.md)
