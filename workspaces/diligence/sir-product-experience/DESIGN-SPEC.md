# SIR Product Experience — North Star & Roadmap

**Status:** Draft v1
**Date:** 2026-07-27
**Author:** Will (with Jason's product briefing + Sal's viewer prototype as inputs)
**Type:** Program-level north-star spec. Deliberately high-altitude. Spawns child specs (see §12); does not itself specify tables, endpoints, or components to implementation depth.

**Repos touched (eventually):** `cityhall` (all client/staff UI + chat APIs), `substation` (persistence, run/artifact tables, Inngest, storage, email), `claude-plugins` (`diligence-report` skill — new sync/emit steps + MCP surface), `field-agent` (headless runner convergence, later phases)
**Repos NOT touched:** `conductor`, `bureau`, `quarry`, `navalbase`, `radar`, `inspector-general` (IG stays the debugging tool; this product lives in the main app — see §2.3)

---

## 0. What this document is (and isn't)

This is spec **#1** of an expected multi-spec, multi-day effort to turn the Site Intelligence Report (SIR) from a hand-cranked, one-or-two-a-week artisanal deliverable into a **product** we can run 4–10×/week. Its job is to establish the **shared vocabulary, the domain model, the load-bearing architectural decisions, and a phased roadmap** — so that every child spec (intake, delivery viewer, collaboration surface, internal telemetry view, rich map viewer) can be written against a common frame and sequenced deliberately.

It is intentionally **not** exhaustive. Where a decision is genuinely the operator's to make, it's captured as a numbered Open Decision (§11) with a recommended default, not resolved by fiat. Perfection is not the goal here; a correct frame and momentum are.

**Three inputs fused into this spec:**
1. **Jason's product briefing** (voice transcript, 2026-07-22) — authoritative on **workflow, scope, and priority**.
2. **Sal's SIR-viewer prototype** (`index.html` + `HANDOFF.md`) — authoritative on **client/internal viewer IA, interaction model, and visual feel**; explicitly *not* authoritative on scope, priority, or data schema.
3. **The codebase as it actually is today** (verified below) — authoritative on **what already exists**, which turns out to be a lot more than either input assumes.

---

## 1. Problem

Today an SIR is produced and delivered by a chain of manual, tool-hopping steps that does not scale:

- **Intake** arrives ad hoc (email to Heidi, a Slack message, PDFs dragged into a temp folder on a Mac Mini). No structured request, no queue, no status.
- **Execution** is a long interactive Claude Code session using the `diligence-report` skill, run on a work laptop / Mac Mini. Output lands **on local disk only** (verified §2.4) — nothing is persisted anywhere the rest of the org can see.
- **Regulatory review** (the HITL1 fact-check and HITL3 report-review, done by Sal, soon also Garrett) happens over **PDF → Google Doc → Slack → copy-paste back into Claude Code**. Feedback is unstructured, lives in Google Docs, and has to be manually re-fed to the agent (sometimes by making a Google Doc temporarily public so the agent can read its images).
- **Delivery** is: the tech lead assembles a Google Drive folder (PDF + Word + supporting docs), gets a share link, and emails it (often via Heidi) to the client.
- The client gets a **150–300 page PDF** and a Drive folder. No web view, no way to ask questions, no history, no login.

Every one of these steps is a person moving bytes between tools by hand. At 1–2 SIRs/week it's survivable; at the target of **4–10/week** it collapses. The friction is concentrated at the **interfaces**: client↔Noetic (intake + delivery) and tech-lead↔regulatory-specialist (review collaboration). That is where this program invests.

**Non-goal / explicit constraint from Jason:** *Do not replace the `diligence-report` skill or its interactive human-in-the-loop execution model.* The flexibility of driving the research collaboratively in Claude Code — going off-script, adding research waves, debugging a jurisdiction integration mid-run — is load-bearing to report quality and stays. We build **around** the skill, not over it. (This constraint is the single most important framing decision in the whole program — see §3.1.)

---

## 2. Current state (verified against the codebase, 2026-07-27)

Both inputs under-describe how much already exists. Grounding the roadmap in reality:

### 2.1 Intake chat — shipped, further along than the briefing implies

The "Feasibility Intake" chat is real and shipped behind the `feasibility-intake` flag, on the existing `project → submission → intake conversation` model:

- UI: `cityhall/src/routes/(app)/project/[projectId]/submission/[submissionId]/intake/[conversationId]/+page.svelte` — composer, drag-drop upload, live right-panel of captured "tier" sections, RCM (Rich Card Message) cards, Supabase Realtime.
- Chat API: `cityhall/src/routes/api/chat/intake/+server.ts` — AI-SDK endpoint (Haiku 4.5, Sonnet A/B behind `intake-chat-use-sonnet`), with **three** agent tools already: `updateIntakeNotes`, `askClarifyingQuestion`, and **`requestDiligenceRun`** (fires a real run — see §2.3).
- System prompt: `cityhall/src/lib/prompts/intake-system.ts` — "Noetic's onboarding interviewer for a Feasibility Research engagement (Site Intelligence Report)"; Tier 1 Site Details (required) / Tier 2 planned development / Tier 3 Documents.
- Upload → background Gemini extraction → `document_section` population is shipped end-to-end across cityhall + substation (see the `feasibility-intake-chat` winston workspace for the full PR trail).

**Implication:** Jason's "client→Noetic intake" phase is ~70% *productizing what exists* (adding the client-facing request list, draft state, and queue), not building from zero.

### 2.2 cityhall stack (the app this product lives in)

SvelteKit 2 / Svelte 5 runes, Vite, TypeScript strict, **UnoCSS** (Wind4 preset), Vercel deploy. AI via Vercel AI SDK (`@ai-sdk/anthropic|google|openai`), Langfuse tracing. **`maplibre-gl` is already a dependency** — Sal's map choice is native. Auth = Supabase SSR + **RLS as the authorization boundary**, `project_access` table + `get_user_project_access_level`/`user_can_see_project` RPCs, `organizations`/`organization_members`, **masquerade/impersonation** for admins, and an **`is_noetic_admin` RPC** (→ this is the entitlement that gates Sal's "Noetic-internal" evidence layer). Package manager: **bun**. Heavy processing lives in **substation** (Hono + Inngest); cityhall is frontend + thin chat APIs.

### 2.3 Two runners of the same skill already exist — and neither matches the target alone

This is the crux of the whole program.

- **Runner A — interactive Claude Code** (Jason's Mac Mini workflow, in production today). Has the HITL gates. Writes **only to local disk**. No Supabase persistence.
- **Runner B — `field-agent` headless** (built + merged, in validation per `winston/workspaces/field-agent/`). A cloud trigger publishes an Inngest event → a laptop-side worker consumes via Inngest Connect → invokes the **same** skill in place via `@anthropic-ai/claude-agent-sdk` (Model A: shared skill, field-agent owns only the harness) → uploads deliverables to storage (`submission-data/diligence/<run-id>/`) and upserts `diligence_runs` (`dlr_…`) + `diligence_artifacts` (kinds: `site_intelligence_report`, `research_appendix`, `supporting_document_copy`) rows → cityhall shows live status at `/project/[id]/diligence-runs/[runId]/`. **But it is headless — it pre-resolves / drops the human gates.**

Target = **Runner A's HITL + Runner B's persistence.** Runner B already built the persistence plumbing (tables, storage layout, realtime, signed URLs, the run-status page). Runner A is the quality/flexibility engine Jason won't give up. The program's job is to **marry them** (§3.1).

### 2.4 The diligence pipeline writes nothing to Supabase today

Verified: the `diligence-report` / `diligence-replay-phase-5` / `audit-diligence-run` skills contain **zero** `supabase|storage|upload` calls. `SKILL.md`: *"Does not auto-publish — deliverables land in the working directory; the user decides what to send."* A completed interactive run is **purely on-disk**. Run identity is a `diligenceRunId` UUID used only as a directory name. So diligence-run persistence is **net-new** for Runner A. (Runner B does persist — its schema is the reference/target to converge on.)

On-disk run layout (v9, canonical — `working-dir.md`):
```
$NOETIC_DILIGENCE_DIR/
├── location-resolution/         # canonical address+lat/lon+parcel, mcp-calls.jsonl, boundary overlay PNG, geometry-summary.json
├── seed-site-data.md + seed-site-data/{site-orientation.png, visual-walk/, access-trace/}
├── run-manifest/{phase0..5.json, learn-back*.json}  +  run-manifest.json   # ← machine-readable telemetry rollup
├── hitl/{ledger.md, intake-transcript.md, hitl1-site-orientation.md, pull-receipt.md}
└── sir/
    ├── source-pdfs/                                   # client-supplied PDFs
    ├── phase1-extraction/                             # vision PNGs + extraction md
    ├── phase2-research/*.md                           # 9 research files (+ portal-recipes)
    ├── phase3-disciplines/*.md                        # 10 discipline files
    ├── synthesis/{issue-matrix.md, recovery-log.md, regulatory-briefing.md, scrub-log.md}
    └── deliverable/
        ├── site-intelligence-report.pdf               # THE deliverable, ~180–340pp
        ├── site-intelligence-report.docx              # dual-format sibling
        ├── pages.tsx                                   # RDS Report-mode <ReportDocument> source
        ├── research-appendix.md
        └── supporting-documents/*.pdf                 # concept plan, plat, clerk instruments
```
Plus the surveyor workspace (separate repo) with `output/{run-status.json, facts.md}`, `intermediate/research-findings.jsonl` (a tool-call event log = MCP provenance), and downloaded clerk PDFs.

### 2.5 There is NO structured findings JSON — this is the biggest data-contract fact

Sal's viewer assumes a rich `findings[]` model (per-finding severity, confidence `[V]/[P]/[I]`, `geo` pins, `provenance`, `punchlist`, `dataGaps`, `conflicts`). **The pipeline emits none of it as data.** Findings exist only as:
1. **Markdown prose** — each `phase3-disciplines/<slug>.md` finding is a text block (`### topic` / `**Severity:**` / `**Citation:**` / `**Finding:**` / `**Implication:**` / `**Recommended next step:**`); `synthesis/issue-matrix.md` is a severity-grouped markdown table (`## Significant` / `## Moderate` / `## Notes` / `## Data Gaps` / `## Opportunities`, columns `Discipline | Topic | Code/source | Plan implication`).
2. **Hand-authored JSX** in `pages.tsx` — `<FindingBlock severity= discipline= topic= citation= finding= implication= nextStep=>`, `<RiskCard>`, `<ConstraintMatrix rows=…>`, `<DataGapTable rows=…>`. Closest thing to a schema, but inline JSX literals, not extractable JSON.

The **only** machine-readable findings signal today is **aggregate counts** in `run-manifest.json` (`phase3.payload.disciplines[].severity_counts`, `phase4.payload.issue_matrix.by_severity`, `run-manifest.json.data_gaps[]`).

The severity vocabulary *does* exist as a fixed set (lowercase, 6 values: `significant, moderate, note, data-gap, opportunity` + the RDS `SeverityLevel` type). Confidence `V/P/I` exists as a *display convention* (a text tag in prose), not a field. The 10 disciplines and 5-part Part I–V schema are both confirmed and stable.

**Implication:** a **structured-findings normalization layer** must be built. It does not exist. Everything in Sal's viewer that is richer than "render the PDF/HTML" depends on it. This is the pivot point that separates the cheap delivery MVP from the expensive rich viewer (§3.2, §10).

### 2.6 Sal's prototype — what to keep

Authoritative on IA/interaction/feel: map-anchored layout (map = left ~62%, report rail = right ~38%), the **Finding Block as the atom**, the **one-view/two-audience toggle** (client vs Noetic-internal evidence layer), exec-summary-forward progressive disclosure (verdict + severity dashboard → Top Risks as full blocks → Moderate/Opportunity as compact rows → exhaustive filterable matrix in a Findings tab), DATA_GAP / not-applicable as first-class states, bidirectional map↔report linkage, and the steel-blue/Lexend/Lora visual system. **Not** authoritative on: exact schema field names, feature scope/priority, or that it must be map-first in the MVP. It is vanilla-JS + CDN and cannot run under cityhall's CSP; it is a spec, not source.

---

## 3. The two load-bearing architectural decisions

### 3.1 The app is a collaboration + persistence layer around an interactive Claude Code engine

We keep **Runner A (interactive Claude Code)** as the execution engine for the foreseeable future (Jason's constraint, §1). Therefore:

- **A run must be synced from local disk into Supabase** so the app can display, collaborate on, and deliver it. Two sub-options (Open Decision **Q1**):
  - **(a) Sync bridge (recommended for MVP):** add a step/skill that uploads a completed-or-in-progress on-disk run into the **existing** `diligence_runs` / `diligence_artifacts` tables + `submission-data/diligence/<run-id>/` storage that Runner B already defined. Cheapest path to momentum; reuses the run-status page, realtime, and signed-URL machinery already shipped.
  - **(b) Evolve field-agent into interactive-aware:** teach Runner B to **pause at HITL gates and surface them to the app** (the app becomes the HITL surface; the runner blocks on a DB signal). Elegant long-term convergence to one runner, but a much larger build and it fights Jason's "I want to stay in Claude Code" preference. **Defer to a later phase.**
- **The agent reads and writes review feedback through the database via MCP**, not copy-paste. Jason described this exactly: the specialist leaves DB-backed comments, the tech lead adds threaded instructions, then in Claude Code says "go read the HITL1 feedback" and the agent pulls the threads directly (the Noetic MCP server — `library_*`, `storage_*`, `reports_*` tools, and new diligence-review tools — is the conduit). This kills the Google-Doc / Slack / copy-paste loop.

**Consequence:** the interactive Claude Code session and the web app are two clients of the **same Supabase run record**. The session writes artifacts + reads review threads; the app reads artifacts + writes review threads + delivers. The DB is the synchronization point. This is the spine of the entire product.

### 3.2 The structured-findings normalization layer is the pivot between "cheap" and "rich"

Everything the client/staff can do with **the PDF/HTML as a document** (view, scroll, download, chat-over-contents, leave a note) needs **no** structured findings — it needs only the deliverable artifacts, which exist today. Everything Sal's viewer does **beyond a document** (map pins, per-finding cards, severity dashboards, filterable constraint matrix, the internal evidence/provenance layer) needs the **normalized findings model**, which does not exist.

Therefore the roadmap is deliberately staged so the **document-grade delivery MVP ships first** (high value, low cost, kills the most-hated manual step) and the **structured layer + rich map viewer comes after** (high value, high cost, needs new pipeline emit + real GIS). See §10.

The normalization layer, when built, should be **emitted by the pipeline at Phase 5**, not reverse-engineered by the app from PDF (Open Decision **Q2**): the skill already hand-authors `<FindingBlock>`/`<ConstraintMatrix>`/`<DataGapTable>` — the cheapest reliable source of a `findings.json` is to have the skill **write the same data it's already putting into JSX** to a sibling JSON file. `issue-matrix.md` (severity-grouped, discipline-keyed) is the natural spine; per-discipline markdown fills detail; manifest severity counts validate completeness.

---

## 4. The target experience — three surfaces + a shared object

The product is **one app (cityhall / app.noeticbuild.com)** presenting **one SIR object** through three lenses, gated by entitlement:

1. **Client surface** — request (intake), track status, view (web + PDF/Word download), and chat about their report. Client entitlement.
2. **Staff collaboration surface** — the tech-lead ↔ regulatory-specialist review loop: assign, fact-check (HITL1), report-review (HITL3), threaded DB-backed comments with images, state machine, agent-readable. Noetic-staff entitlement.
3. **Internal "under-the-covers" surface** — how the SIR was made: run telemetry, which APIs/MCP tools were called, surveyor health, which docs were pulled and why, source conflicts, data gaps, cost/token spend. Noetic-staff entitlement. (This is Sal's "Noetic-internal evidence layer" toggle *plus* Jason's operational/observability ask, which is broader than Sal's — it includes the run manifest and surveyor telemetry, not just per-finding provenance.)

Sal's dual-audience toggle is the *client ↔ internal-evidence* flip within the viewer; surfaces 2 and 3 are broader staff tooling that the toggle is one entry point into.

---

## 5. Domain model (high level)

The SIR object and its lifecycle. Field names are illustrative, not final (child specs formalize against the existing `diligence_runs`/`diligence_artifacts` schema):

- **SIR engagement** = a `submission` of type `feasibility` under a `project` (already the model, §2.1). One project may hold several SIRs over time.
- **SIR run** = a `diligence_run` (`dlr_…`, exists). Carries the lifecycle state (§6), the assigned regulatory specialist, the assigned tech lead, and links to artifacts + review threads.
- **Artifacts** = `diligence_artifacts` rows (exist; extend kinds). Split by audience:
  - *Client-facing:* the SIR PDF, the Word doc, the web-renderable `pages.tsx`/HTML, supporting documents.
  - *Internal-only:* phase1–3 markdown, synthesis (issue-matrix, recovery-log, regulatory-briefing, scrub-log), `run-manifest*.json`, `location-resolution/mcp-calls.jsonl`, surveyor `run-status.json` + `research-findings.jsonl`, HITL ledger, cost/token telemetry.
- **Findings** (net-new, §2.5/§3.2) = normalized `finding` records: `{discipline, severity, topic, citation, finding, implication, nextStep, confidence, provenance[], geo?}` — the Finding-Block atom, emitted by the pipeline.
- **Review threads** (net-new) = DB-backed comment threads, one per HITL stage (HITL1 facts, HITL3 report), each thread anchorable to the run-as-a-whole or to a specific fact/finding/section, supporting text + links + pasted images, with a submit/lock action and back-and-forth between specialist and tech lead. This is what the agent reads via MCP.
- **Delivery** = a share record: either an authenticated client view (RLS) or a **security-through-obscurity time-limited URL** (Jason: default is no-login, link good for ~1–2 months, then require an account for history). Chat history is **scoped per user** (two people at the same client org don't see each other's chats).
- **Entitlement** = `is_noetic_admin` / `project_access` gate the client vs staff vs internal surfaces (Sal's point: the internal layer is a **permission**, never a UI toggle that could leak Part V to a client bundle).

---

## 6. SIR lifecycle state machine (high level)

The states the object moves through, and whose court the ball is in. (Exact names TBD in a child spec; this is the shape.)

```
draft ─────────────► requested ─────────► research_hitl1 ─────► hitl1_review ──┐
(client editing      (client submitted;   (tech lead running    (specialist    │
 intake, not sent)    in Noetic's queue)   Phase 0–2 in CC)       validating     │
                                                                  facts)         │
                                                                                 ▼
   ┌──────────────────────────────────────────────────────  hitl1_feedback_locked
   ▼                                                          (tech lead read threads, ready)
research_deep ──────► report_draft ──────► hitl3_review ─────► hitl3_feedback_locked
(Phase 2.5–5 in CC,   (SIR draft            (specialist         (tech lead read threads)
 tech-lead HITL2       published to app)     reviewing draft)          │
 stays IN Claude Code,                                                 ▼
 no app UI needed)                                            finalize ──► delivered
                                                              (human "looks good,   (client can view/
                                                               deliver to client")   download/chat)
```

Key notes:
- **HITL2** (deep-research unblocking — county-clerk CAPTCHAs, GIS debugging, paid-pull authorization) stays **entirely in Claude Code**; no app UI (Jason was explicit). The app only needs to reflect the *state*, not host the interaction.
- Transitions between specialist and tech lead are **manual** (Jason: "this is not automated; we just see the state changed / are notified"). The app provides visibility + notifications; humans pull the trigger.
- The specialist chooses at submit-time **whether they want to see it again** (re-review loop) — a first-class flag on the review submission.

---

## 7. Surface A — Client intake (productize existing)

Mostly exists (§2.1). Net-new work:
- **Client request list** with status pills: `draft` (their court, resumable), `in progress` (Noetic's court), `delivered`. Maps to §6 states, collapsed for the client.
- **Draft vs submit**: the intake conversation already captures site + use + attachments; add the explicit "send to Noetic" action that flips `draft → requested` and enqueues.
- **Staff-initiated intake**: any staff member (Heidi, Jason) can do the intake in-UI on a client's behalf (Jason: clients who'd rather email us). This is just the same intake UI with a "create on behalf of org X" entry.
- Everything else (chat, upload, Gemini extraction, tier sections) is shipped.

Child spec: `intake-productization`.

## 8. Surface B — Delivery + client viewer + report chat

The **highest-value, lowest-cost** surface and Jason's stated #1. Two tiers:

- **B1 — Document-grade delivery (MVP, needs no findings layer):**
  - Sync a finalized run into Supabase (§3.1a).
  - Web view of the SIR: render the existing `pages.tsx`/HTML as an **infinite-scroll web page** (Jason's "feels like a web page, broken up with magazine-like full-bleed pages for the site-orientation spreads"). RDS Report-mode already targets HTML+PDF from one source.
  - **Download PDF + Word.**
  - **Secure delivery**: time-limited obscurity URL (default, no login) OR authenticated client login for history. `submission-data/diligence/<run-id>/` + signed URLs already exist.
  - **"Your report is ready" email** (substation).
- **B2 — Report chat:** "Ask Noetic about my report." V1 = the report contents as context (like dropping the 300-page PDF into a chat), **no live research tools** (Jason: research-on-demand is phase 3–4). Per-user-scoped chat history. Uses the AI-SDK infra already in cityhall.

Child specs: `sir-delivery-and-web-viewer`, `report-chat`.

## 9. Surface C — Staff review collaboration (kills the Google-Doc/Slack loop)

The other big investment Jason described, and the one that most directly de-risks scaling the *human* side (Sal + Garrett). High level:
- **Assignment**: tech lead assigns a run to a regulatory specialist (Sal or Garrett).
- **HITL1 fact-check view**: the specialist sees the full intake + the agent's bulleted **facts** (HITL1 output) with clickable source links, drills out to GIS/county/city sites to validate, and leaves **DB-backed comments** — anchorable to a specific fact or the whole set, text + links + **pasted images/screenshots** (with arrows drawn, etc.). Comments accumulate in **draft** until the specialist **submits** (state → `hitl1_review` → on submit, ready for tech lead).
- **Threaded back-and-forth**: tech lead reads the threads in-app, adds instructions as **comments-on-comments** (one thread per fact + one for the whole HITL1), then either kicks back to the specialist or **locks** it.
- **Agent reads locked feedback via MCP** — no copy-paste (§3.1). Tech lead in Claude Code says "read HITL1 feedback and proceed / let's discuss."
- **HITL3 report-review view**: same pattern over the **report draft**. MVP = open-ended notes + images (like a Google Doc); **section-anchored highlight-comments are an explicit phase-2 nice-to-have** (Jason deferred them).

Child spec: `staff-review-collaboration` (likely the largest child spec; may split HITL1 and HITL3).

## 9b. Surface D — Internal "under-the-covers" view

Jason's operational ask + Sal's internal-evidence layer. Once §3.1a syncs the *internal* artifacts into Supabase, this surface is **cheap** — it's largely a structured browser over data that already exists on disk:
- **Run telemetry**: `run-manifest*.json` per-phase status, gate outcomes, cost/token/tool-use (`run-summary.json`), timings.
- **Provenance / "what APIs did we call"**: `location-resolution/mcp-calls.jsonl`, surveyor `research-findings.jsonl` (tool-call event log), portal recipes.
- **Surveyor health**: `output/run-status.json` (per-phase status, doc-search coverage, pdfs downloaded vs paid-tier skipped, warnings).
- **Source conflicts + data gaps**: from synthesis + manifest `data_gaps[]`.
- **The per-finding evidence layer** (Sal's toggle) — arrives with the findings normalization layer (§3.2), so the *rich* version of this surface is gated on that; the *manifest/telemetry* version is not.
- Reuse where possible: `audit-diligence-run` and `inspector-general` already reason over these artifacts — this surface is the productized, always-on version of that.

Child spec: `internal-run-observability`.

## 9c. Surface E — Rich map-anchored viewer (the "wow", later)

Sal's full vision: map-left + report-rail-right, Finding-Block atom, dual-audience toggle, constraint layers, 2D/2.5D/3D. **Gated on two prerequisites** (§3.2): (1) the findings normalization layer, and (2) **real GIS geometry** (parcel, FEMA flood, wetlands/NWI, buildable analysis, frontage, utility lines) sourced from the pipeline — Sal's prototype GIS is hand-authored placeholder and is called out as "the single biggest fidelity gap." Deliberately sequenced last of the client-facing surfaces because it is the most expensive and its prerequisites are net-new. When built: SvelteKit components + UnoCSS + `maplibre-gl` (already present), tiles served from an allowlisted/self-hosted origin to satisfy cityhall's CSP.

Child spec: `rich-sir-viewer` (depends on `findings-normalization`).

---

## 10. Phased roadmap (momentum-first)

Sequenced so each phase ships standalone value and the cheapest high-value work comes first. Rough, not contractual.

| Phase | Deliverable | Why here | Depends on | New pipeline work? |
|---|---|---|---|---|
| **P0** | **Run-sync bridge**: finalized on-disk run → Supabase (`diligence_runs` + `diligence_artifacts` + storage), reusing Runner B's schema. | Unblocks *everything*. Nothing about a run is in Supabase today (§2.4). | — | Yes: a skill step / small tool that uploads the run dir. |
| **P1** | **Delivery MVP (Surface B1)**: web viewer (HTML infinite-scroll), PDF/Word download, secure obscurity-URL delivery, "ready" email, client request list + status. | Jason's #1; kills the Google-Drive step; needs no findings layer. | P0 | No |
| **P2** | **Report chat (Surface B2)**: contents-only Q&A, per-user history. | High client value; AI infra already present. | P1 | No |
| **P3** | **Staff review collaboration (Surface C)**: HITL1 + HITL3 DB-backed threads, assignment, agent-reads-via-MCP. | Kills the Slack/Google-Doc loop; de-risks the human side of scaling. | P0 + MCP review tools | Skill: read/write review threads via MCP. |
| **P4** | **Internal observability (Surface D)**: telemetry/provenance/surveyor-health browser. | Cheap once P0 syncs internal artifacts; Jason wants it. | P0 | No (consumes manifests) |
| **P5** | **Findings normalization layer**: pipeline emits `findings.json` at Phase 5. | Prerequisite for the rich viewer + the rich internal evidence layer. | — (pipeline change) | **Yes — the key net-new emit.** |
| **P6** | **Rich map viewer (Surface E)** + real GIS. | The wow; most expensive; both prereqs now met. | P5 + real GIS | GIS geometry emit. |
| **P7+** | field-agent interactive convergence (§3.1b), research-on-demand chat tools, mobile responsive, section-anchored review comments. | Long-term; explicitly deferred by Jason. | various | — |

**Recommended first deliverable to build momentum:** P0 + a thin slice of P1 — sync one real finalized run into Supabase and render its existing HTML in an authenticated web view with PDF/Word download. That single vertical slice replaces the Google-Drive delivery step end-to-end for one report, proves the run-sync bridge, and is demoable within the first push. (Open Decision **Q3** confirms whether delivery-first or collaboration-first — Jason was genuinely torn; recommendation is delivery-first for cost/impact.)

---

## 11. Open decisions (for Will/Jason — recommendations given, not resolved)

- **Q1 — Run persistence approach.** (a) Sync bridge from interactive on-disk runs into the existing tables *[recommended for MVP]*, vs (b) evolve field-agent into interactive-aware. **Rec: (a) now, (b) as P7 convergence.**
- **Q2 — Findings JSON source.** Emit `findings.json` from the pipeline at Phase 5 (write the same data already going into JSX) *[recommended]* vs reverse-engineer from PDF/markdown in the app. **Rec: emit from pipeline.**
- **Q3 — First surface.** Delivery-first (B) *[recommended: Jason's stated #1, cheapest, kills worst friction]* vs collaboration-first (C, de-risks the human bottleneck at scale). **Genuinely Jason's call — he was torn.**
- **Q4 — Where does the runner live long-term?** Keep interactive Claude Code on a Mac Mini indefinitely, vs invest in field-agent as the primary. Affects how much to build into (b). **Rec: revisit after P3.**
- **Q5 — Report web-render fidelity.** Does the RDS Report-mode `pages.tsx` render to acceptable HTML directly, or do we render server-side to HTML as a P0 artifact? (Determines whether the web viewer consumes `pages.tsx` client-side or a pre-rendered HTML artifact.) **Rec: pre-render an HTML artifact at sync time; verify with one real report.**
- **Q6 — Obscurity-URL security envelope.** Link lifetime (Jason floated 1–2 months), revocation, whether chat is allowed on an unauthenticated obscurity link, per-user chat scoping when there's no login. **Needs a small security pass.**
- **Q7 — Do we need a linear "Full report" web view at all, or does PDF download cover it** once the rich viewer exists? (Sal flagged this.) **Rec: keep the linear HTML view as the P1 MVP viewer regardless; rich viewer is additive.**

---

## 12. Child specs this document spawns

Each becomes its own winston DESIGN-SPEC under `workspaces/diligence/`:
1. `run-sync-bridge` (P0) — the on-disk → Supabase persistence contract; reconcile with Runner B's schema.
2. `intake-productization` (Surface A) — client request list, draft/submit, staff-on-behalf-of.
3. `sir-delivery-and-web-viewer` (P1) — viewer, downloads, secure delivery, email.
4. `report-chat` (P2).
5. `staff-review-collaboration` (P3) — likely split HITL1 / HITL3; includes the MCP review-thread tool contract.
6. `internal-run-observability` (P4).
7. `findings-normalization` (P5) — the pipeline emit + schema; the linchpin for the rich viewer.
8. `rich-sir-viewer` (P6) — Sal's prototype productized; depends on #7 + real GIS.

---

## 13. Scope boundaries (explicitly deferred)

- Replacing or automating the interactive HITL execution (Jason's hard constraint).
- Research-on-demand tools in the client chat (phase 3–4 per Jason).
- Mobile-optimized viewer (nice-to-have; desktop-first).
- Section-anchored highlight-comments in report review (Jason deferred to phase 2–3).
- 3D massing from real concept-plan geometry (keep "not survey-grade" honesty if ever built).
- Any change to `conductor`/`bureau`/review-workflow subsystems — this program is the diligence/SIR product only.
