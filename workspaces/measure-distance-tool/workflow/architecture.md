# Review 4.3 — Architecture

## Overview

Review 4.3 = Review 4.2 + the **measure-distance ruler tool** for clearance verification.

```
┌─────────────────────────────────────────────────────────────────┐
│                        REVIEW 4.3 WORKFLOW                      │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Review   │───▶│Consolidate│───▶│ Structure │───▶│ Organize │  │
│  │   Runs    │    │  (script) │    │ Comments  │    │ Sections │  │
│  │  (agent)  │    │           │    │  (agent)  │    │ (agent)  │  │
│  └────┬─────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                                         │
│       │ tools:                                                  │
│       ├── 👁  vision (Gemini 3.1 Pro via Vercel AI Gateway)     │
│       └── 📏 measure-distance ◄── NEW                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### What triggers the ruler tool?

```
┌────────────────┐     reads      ┌──────────────────────────────┐
│   Checklist    │───────────────▶│        Review Agent          │
│     Item       │                │                              │
│                │                │  "transformer pad must be    │
│  "Verify 5ft  │                │   5ft from tree CRZ..."      │
│   clearance"  │                │                              │
│                │                │  I need to MEASURE this.     │
└────────────────┘                │  → calls measure-distance    │
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │     Measure-Distance Tool    │
                                  │                              │
                                  │  objectA: "transformer pad"  │
                                  │  objectB: "heritage oak CRZ" │
                                  │  scale: 20 ft/in             │
                                  │                              │
                                  │  result: 4.7 ft (HIGH conf)  │
                                  └──────────────────────────────┘
```

### Data flow after review

```
Review Runs ──▶ Consolidated Findings ──▶ Structured Comments ──▶ DB
                                                                  │
                                                          ┌───────┴───────┐
                                                          │review_comments│
                                                          │  .output_json │
                                                          │  .agent_trace │◄── tools_used:
                                                          └───────────────┘    ["measure-distance"]
                                                                  │
                                                                  ▼
                                                          ┌───────────────┐
                                                          │Inspector Gen. │
                                                          │  eval + audit │
                                                          └───────────────┘
```

---

## Measure-Distance Tool — Detailed Architecture

### TS / Python Split

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    measure-distance.ts (TypeScript)                      │
│                         ORCHESTRATOR                                    │
│                                                                         │
│  1. Download assets from Supabase Storage                               │
│     ├── single-page PDF  ──▶  tmp/sheet.pdf                            │
│     └── 120 DPI JPEG     ──▶  tmp/sheet.jpg                            │
│                                                                         │
│  2. Query Supabase DB                                                   │
│     ├── Drawing block bbox (largest "drawing" category block)           │
│     └── Legend context (search ALL sheets for legend/symbol blocks)     │
│                                                                         │
│  3. Delegate Option A to Python ─────────────────────────┐              │
│                                                          │              │
│  4. If Option A fails:                                   │              │
│     ├── Crop JPEG to drawing region                      │              │
│     ├── Call Gemini 3.1 Pro via Vercel AI Gateway        │              │
│     │   (generateText + gateway() from @ai-sdk/gateway)  │              │
│     └── Get localization: bboxes + nearest points        │              │
│                                                          │              │
│  5. Delegate distance computation to Python ─────────────┤              │
│                                                          │              │
│  6. Write sidecar log + return JSON result               │              │
└──────────────────────────────────────────────────────────┼──────────────┘
                                                           │
                    ┌──────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  measure-distance-impl.py (Python)                      │
│                      COMPUTATION MODULE                                 │
│                                                                         │
│  --mode=option-a                    --mode=compute-distance             │
│  ┌───────────────────────┐          ┌─────────────────────────────┐     │
│  │ PyMuPDF get_drawings()│          │ Map Gemini coords → PDF pts │     │
│  │ Filter to drawing bbox│          │ Extract paths in each bbox  │     │
│  │ Cluster by proximity  │          │ Vector refinement (if paths)│     │
│  │ Pattern match (v1 stub│          │ Compute min distance        │     │
│  │   — logs, falls back) │          │ Convert pts → feet via scale│     │
│  └───────────────────────┘          │ Generate debug PNG          │     │
│                                     └─────────────────────────────┘     │
│  No Supabase. No Gemini. No API keys. Pure math.                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Two-Tier Object Localization

```
                         ┌─────────────────┐
                         │  Need to locate  │
                         │  two objects on  │
                         │    the sheet     │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                             │
          ┌──────────────────┐                   │
          │   OPTION A       │                   │
          │   Vector Match   │                   │
          │   (Python/PyMuPDF)│                   │
          │                  │                   │
          │ • Extract paths  │                   │
          │ • Cluster shapes │                   │
          │ • Match patterns │                   │
          │   (v1: stub)     │                   │
          └────────┬─────────┘                   │
                   │                              │
              ┌────┴────┐                         │
              │ Found?  │                         │
              └────┬────┘                         │
            yes/   \no                            │
           ┌──┘     └──────────────┐              │
           ▼                       ▼              │
    ┌─────────────┐     ┌──────────────────┐      │
    │  Use vector │     │    OPTION B       │◄─── or strategy=b-only
    │  locations  │     │  Gemini Vision    │
    │             │     │  (TS/AI Gateway)  │
    └──────┬──────┘     │                  │
           │            │ • Crop to drawing│
           │            │ • Build symbol   │
           │            │   context:       │
           │            │   ┌────────────┐ │
           │            │   │ 1. Legend   │ │
           │            │   │  (all shts)│ │
           │            │   ├────────────┤ │
           │            │   │ 2. Built-in│ │
           │            │   │  symbols   │ │
           │            │   └────────────┘ │
           │            │ • Send to Gemini │
           │            │   3.1 Pro        │
           │            └────────┬─────────┘
           │                     │
           └──────────┬──────────┘
                      ▼
            ┌──────────────────┐
            │    DISTANCE      │
            │   COMPUTATION    │
            │  (Python/PyMuPDF)│
            │                  │
            │ • Vector refine  │
            │   (if paths in   │
            │    Gemini bboxes)│
            │ • pts → feet     │
            │ • Debug image    │
            └──────────────────┘
```

### Legend Context Resolution

```
Agent says: "measure distance between transformer pad and heritage oak CRZ"

         ┌────────────────────────────────────────┐
         │  Search legend blocks across ALL sheets │
         └────────────────────┬───────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │  Legend found?       │
                   └──────────┬──────────┘
                         yes/ \no
                   ┌────────┘ └────────────┐
                   ▼                       ▼
    ┌──────────────────────┐   ┌────────────────────────┐
    │ Use legend text:     │   │ Use built-in symbols:  │
    │                      │   │                        │
    │ "[T label] Existing  │   │ transformer: rectangle │
    │  Transformer Pad"    │   │   with T or XFMR       │
    │                      │   │                        │
    │ "[dashed circle]     │   │ CRZ: dashed circle     │
    │  Critical Root Zone" │   │   centered on trunk    │
    │                      │   │                        │
    │ source: "cross-sheet"│   │ source: "builtin"      │
    └──────────┬───────────┘   └────────────┬───────────┘
               └──────────┬─────────────────┘
                          ▼
               ┌─────────────────────┐
               │ Symbol context sent │
               │ to Gemini with the  │
               │ cropped drawing     │
               └─────────────────────┘
```

### Observability Flow

```
┌───────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  measure-     │     │   Sidecar Log        │     │  Supabase        │
│  distance.ts  │────▶│   measure-distance-  │────▶│  Storage         │
│               │     │   log.json           │     │  (auto-upload)   │
└───────────────┘     └──────────────────────┘     └────────┬─────────┘
                                                            │
                      ┌──────────────────────┐              │
                      │  review-saver.ts     │◄─────────────┘
                      │  reads sidecar log   │   (at save time via
                      │  on workflow complete │    workspacePath)
                      └──────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │  review_comments     │
                      │  .agent_trace = {    │
                      │    tools_used:       │
                      │      ["measure-      │
                      │       distance"],    │
                      │    measurements:     │
                      │      [{ distFt: 4.7, │
                      │         conf: "high" │
                      │         method: ...}]│
                      │  }                   │
                      └──────────┬───────────┘
                                 │
                      ┌──────────┴───────────┐
                      │  Inspector General   │
                      │  • ig_eval_data      │
                      │  • ig_eval_annot.    │
                      │  • Audit scores      │
                      │                      │
                      │  Query: "which       │
                      │  comments used the   │
                      │  ruler tool, and     │
                      │  were they correct?" │
                      └──────────────────────┘
```
