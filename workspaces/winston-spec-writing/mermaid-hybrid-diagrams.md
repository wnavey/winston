# Mermaid.js for winston HTML specs — hybrid-approach exploration

**Status:** Exploration / prototype (no skill changes yet)
**Date:** 2026-08-06
**Prototype:** `workspaces/diligence/sir-pipelines/architecture-overview-mermaid.html` (+ `assets/mermaid.min.js`)
**Compared against:** `workspaces/diligence/sir-pipelines/architecture-overview.html` (the hand-authored original)

## TL;DR

We tested whether [Mermaid.js](https://mermaid.js.org) could replace the hand-authored inline-SVG
diagrams in winston HTML specs. Verdict: **yes, as a narrow hybrid** — keep the spec-kit for page
chrome, swap only the *diagram* components for Mermaid, vendor one `mermaid.min.js`, and add a small
post-render "decoration" pass to recover the things Mermaid's DSL can't express (per-actor colors,
subtitles). The prototype reaches near-parity with the original hand-authored sequence diagram from
~30 lines of readable Mermaid source + a reusable ~40-line decorator, versus ~96 lines of
hand-computed SVG coordinates. `agent-browser` renders the file and screenshots it, which closes the
"the agent writes the diagram blind" gap.

## What Mermaid is, and is it free

Mermaid is a JS library that renders diagrams (sequence, flowchart, ER, state, class, gantt, …) from
a terse Markdown-like text syntax. It is **open source under the MIT license** — free for commercial
use. (There is a separate paid "Mermaid Chart" SaaS editor; the core library we'd embed is fully
free.) GitHub/GitLab/Notion/Obsidian render it natively inside ```` ```mermaid ```` fences.

## Why this came up

Two real arguments for Mermaid over hand-rolled diagrams:

1. **The agent writes far less.** A dense sequence diagram is ~30 lines of Mermaid vs. ~96 lines of
   hand-computed `<svg>` coordinates. Less to author, fewer tokens, less of the fiddly error-prone part.
2. **Layout is offloaded to an engine.** The bugs the `winston-spec` skill explicitly blames on
   hand-rolled diagram CSS — *"smushed labels, badges overlapping borders, long flows clipping
   off-screen"* — are layout-engine problems. Mermaid's dagre layout solves them by never making the
   author do pixel math at all. Same goal the spec-kit chases by pre-solving CSS once; Mermaid attacks
   it more directly.

## What the winston-spec skill currently mandates (for context)

`~/.claude/skills/winston-spec/SKILL.md` ("HTML specs" section) + `assets/`:

- **All** HTML-spec diagrams are built from the **spec-kit** (`assets/spec-kit.css` is the "single
  source of truth"); hand-rolled per-spec CSS is forbidden.
- The kit ships specific components (boxes-and-arrows use-case flows, ER entity boxes, relationships
  panel, state machine, card grid) documented in `assets/COMPONENTS.md`, with `assets/gallery.html`
  as a visual regression check.
- CSS is **inlined** into each spec (CSP-safe, self-contained, no `<link>`/external refs).
- New component needed → **extend the kit first** (CSS + COMPONENTS.md + gallery.html + version bump),
  then use it. The kit is meant to grow.

Mermaid is a philosophical departure from this (it's a general engine with its own styling), which is
why the hybrid keeps the kit for everything *except* the diagram interior.

## The hybrid approach

- Keep the spec-kit for **page chrome**: masthead, sticky tabs, panels, callouts, card grids, the
  `.seqcap` legend, the collapsible `§6` step-detail cards.
- Swap only the **diagram** (sequence/flow/state/ER) for a `<pre class="mermaid">` block.
- Vendor **one** `mermaid.min.js` in `assets/`, referenced via a relative `<script src>` (not a CDN).
- Bake the theme + a post-render decoration pass into what would become `spec-template.html`.

### The prototype

`architecture-overview-mermaid.html` is the original file **byte-for-byte**, with only the single
inline-SVG sequence diagram (step 1.2, the runner→agent→tools lifeline chain) swapped for Mermaid,
plus the vendored script + a themed `mermaid.initialize()` and decorator. Everything else (all three
tabs, every other component) is untouched — a true apples-to-apples swap.

## Validation: agent-browser closes the "writes blind" gap

A standing objection to Mermaid is that the SVG is generated in the browser at load time, so the
author can't see the result before shipping. `agent-browser` removes that objection:

```
agent-browser --allow-file-access open "file://…/architecture-overview-mermaid.html#pipeline"
agent-browser wait --load networkidle && agent-browser wait 2000
agent-browser eval '…verify actor fills / subtitle count…'
agent-browser screenshot mermaid.png     # ← an image the agent can actually look at
```

This is a repeatable render → verify → screenshot loop. It also caught a real gotcha: the diagram
lives in an initially-hidden tab (`display:none`), a classic Mermaid zero-width failure mode — we
confirmed the sequence diagram renders fine there (intrinsic size), but only because we *looked*.

## What survived the swap cleanly (wins)

- All 7 lifelines; **solid call arrows vs. dashed return arrows** preserved.
- Every self-call (`fetch origin/main`, `render_boundary_overlay`, `OSM/Overpass`, `agent-browser
  capture`, `visual QA gate`) renders as a loop arc.
- Numbered return badges ①–⑥ carried through, matching the collapsible detail list below.
- **Zero layout bugs** — no smushing, no clipping, even spacing. The exact bug class the skill worries
  about, eliminated by the layout engine.
- Kit chrome (tabs, legend, step-detail cards) fully intact.

## The fidelity gaps — and how we closed them

The first pass lost three things vs. the hand-authored original. Two were fixable; one is a genuine
Mermaid limitation.

### 1. Per-actor colors — FIXED via a decoration pass

Mermaid's base theme paints **all** participants one `actorBkg`, and there is **no DSL syntax** for
per-participant color (the `box` keyword only groups a colored *band* behind multiple actors). But the
rendered actor boxes are `rect.actor-top` elements matchable by their label text, so a post-render
pass recolors them deterministically and appends the subtitle line. This is the standard community
approach and would live **once** in the template, driven by a color map:

```js
const ACTORS = {
  'Runner':       { c:'#35526b', sub:'pipeline_runner.py' },
  '1.2 Agent':    { c:'#bb4d00', sub:'opus' },
  'preflight.sh': { c:'#6b3fa0', sub:'diligence skill' },
  // …one row per actor, colors mirror the spec-kit steel-blue ramp + ember/purple/green
};
function decorateActors(svg){
  const rects = Array.from(svg.querySelectorAll('rect.actor-top'));
  svg.querySelectorAll('text.actor-box').forEach(t => {
    const info = ACTORS[(t.textContent||'').trim()]; if(!info) return;
    const tx = parseFloat(t.getAttribute('x'));
    const rect = rects.find(r => { const x=+r.getAttribute('x'), w=+r.getAttribute('width');
                                   return tx>=x-2 && tx<=x+w+2; });
    if (rect){ rect.setAttribute('fill',info.c); rect.setAttribute('stroke',info.c);
               rect.setAttribute('height', +rect.getAttribute('height')+15); /* room for subtitle */ }
    /* recolor label white, shift up, append a <text> subtitle tspan below */
  });
}
```

Result: Runner navy, **1.2 Agent ember**, preflight/parcel-geo purple, det.scripts slate, visual walk
green, run tree dark-navy — each with its subtitle. Matches the original palette.

**Caveat:** the decorator is keyed on actor **label strings**. Rename an actor → update the color map.
Same maintenance burden as editing `fill=` in a hand-authored SVG, just relocated.

### 2. Red hard-stop guard positions — FIXED via `Note right of`

The guards (`non-READY ⇒ STOP`, `stopped/failed ⇒ STOP`, `degraded = non-blocking`) first floated
far-left because `Note over A` centers a wide box on the Agent lifeline and spills into the gap.
Spanning notes (`Note over A,P`) had **no visible effect** — Mermaid kept centering on the first
actor. `Note right of A` **does** work: it pins each guard just right of the Agent lifeline, under its
badge — exactly where the original puts them.

### 3. Guards can't be *inline* on the arrow label — genuine Mermaid limitation

The original fuses each guard as a second, red-colored sub-line onto the return-arrow's own label. A
Mermaid message label is single-color / single-line, so the guards render as small red **notes on
their own row** instead of inline under the arrow text. Minor vertical-spacing cost; not a placement
problem. This is the one thing hand-authored SVG still does that Mermaid can't.

## Gotchas found while building it

- **The on-load trigger is finicky.** A `mermaid.run().then(decorate)` **silently didn't fire** (the
  render promise no-op'd on an already-processed node); decoration only worked when injected by hand.
  The robust fix is auto-render (`startOnLoad:true`) + a `requestAnimationFrame` poll that waits until
  `.seqfig svg rect.actor-top` exists, then decorates. Get this right once in the template and trust it.
- **Hidden-tab rendering.** Diagrams in `display:none` panels render fine for sequence diagrams
  (intrinsic size) but this is a known Mermaid weak spot for width-dependent diagram types — worth a
  render check whenever a diagram lives in a non-default tab.
- **Vendored file is ~3.5 MB.** As a shared `assets/mermaid.min.js` referenced by `<script src>`,
  that's one copy and fine for winston (committed HTML opened in a browser). But it **breaks the
  skill's "inline everything, CSP-safe, no external refs" rule** — and if a spec were ever published
  as a Claude **Artifact**, the strict CSP would block the relative script unless all 3.5 MB were
  inlined into that one file. So: fine for winston repo specs, a problem for Artifact-published specs.

## Recommendation

Adopt a **narrow hybrid**, not a wholesale switch:

- Use **Mermaid** for sequence / flowchart / state / ER diagrams — where auto-layout is the big win
  and the diagram is mostly boxes + arrows.
- **Keep the existing spec-kit `.dfg` boxes-and-arrows component** for cases where per-node color
  carries *meaning* (it already does per-node color natively, and for a 3–6 box flow it's trivial).
- If we proceed: add to the spec-kit **once** — the vendored `mermaid.min.js`, the themed
  `mermaid.initialize()`, the `decorateActors` pass, and a `COMPONENTS.md` entry + `gallery.html`
  instance documenting the Mermaid diagram type and the `Note right of` / color-map conventions.
  Then it's reusable for every future spec (the kit-is-meant-to-grow protocol).

## Explicitly NOT done

- No changes to the `winston-spec` skill, `spec-kit.css`, `COMPONENTS.md`, or `gallery.html`.
- No inlining of `mermaid.min.js` (kept as a vendored `assets/` file for the prototype).
- Only one diagram converted (the step-1.2 sequence diagram); the rest of the file is the original.

## Files

- `workspaces/diligence/sir-pipelines/architecture-overview-mermaid.html` — the hybrid prototype.
- `workspaces/diligence/sir-pipelines/assets/mermaid.min.js` — vendored Mermaid v11 (MIT), ~3.5 MB.
- `workspaces/diligence/sir-pipelines/architecture-overview.html` — the original, for comparison.
