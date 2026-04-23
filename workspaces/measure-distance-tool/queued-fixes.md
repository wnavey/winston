# Queued Fixes — measure-distance tool

Tracks fixes shipped since the last experiment run, so the next run captures
all improvements at once.

---

## Last experiment runs

| Field | v5.0 run5 (latest v5.0) | v5.1 run1 (first v5.1) |
|---|---|---|
| **Date** | 2026-04-20 | 2026-04-22 |
| **Guide set** | `el-md-exp` (items 1, 2, 13) | `el-md-exp` (items 1, 2, 3, 13) |
| **Training** | v5.0 | v5.1 |
| **Outputs** | `runs/v5.0/experiment-run5/` | `runs/v5.1/experiment-5.1-run1/` |
| **Key result** | 89% distance-only conversion rate (with implicit passes). 100% completion. First run with bbox fix. | First run on v5.1 retrained guides. |

---

## Fixes shipped since v5.0 run5

### Bureau

| PR | Status | Fix |
|---|---|---|
| **#248** | merged | **Fix two-call bbox mismatch** — Python now uses `localization["drawingBbox"]` for call 2 coordinates. Fixed ~2× distance inflation. |
| **#245** | merged | **Training v5.1** — retrained all Austin review guides. Item counts and deficiency text changed across all departments. |
| **#263** | in review | **zlu-md-exp** — new review guide subset (guides 15, 16, 32) for ZLU measure-distance experiments. |

---

## Known issues for next run

### Legend images not working (Phase B code is deployed but ineffective)

Phase B legend image code (bureau#243) IS running — `legend-search` events
appear in every call-dir. But all searches return 0 results because **Valley
View Townhomes lacks content_block embeddings**.

**Fix:** Run the embedding backfill from cityhall:
```bash
cd ~/cityhall
npx tsx scripts/backfill-content-block-embeddings.ts 63cead15-41f8-418c-b0ef-bd5c2b44719a
```

Once embeddings exist, the vector search will find legend blocks, crop them
at 300 DPI, and send the images to both Gemini calls. The fallback (15 KB
text dump) is what's been used in all runs so far.

### Distance sanity-check (deferred)

Run4 had 29% outliers >100 ft. Run5 (with the bbox fix) likely reduced this
significantly but hasn't been analyzed in detail. Investigate in the analysis
step before building a hard guard. Not blocking further runs.

### v5.0 → v5.1 classification drift

The v5.1 retrain (bureau#245, commit aed4f1b13) changed item counts and
deficiency text across all departments. Existing v5.0 classifications are
stale.

**Status:**
- ZLU v5.1: ✅ done (1,672 items, 35 guides)
- All others: ❌ need re-classification against v5.1 guides

---

## Training version tracking

| Version | Bureau commit | Key changes |
|---|---|---|
| **v5.0** | pre-aed4f1b13 | Original training. Runs 1-5 used this. |
| **v5.1** | aed4f1b13 (bureau#245) | Retrained all guides. experiment-5.1-run1 is first v5.1 run. |

## Guide classification status

| Dept | v5.0 | v5.1 |
|---|---|---|
| el | ✅ 770 items | ❌ needs re-run |
| el-md-exp | ✅ 101 items (human-reviewed) | ❌ needs re-run |
| zlu | ✅ 1,517 items | ✅ 1,672 items |
| eptp | ✅ 1,197 items | ❌ |
| fire | ✅ 831 items | ❌ (883 in v5.1) |
| fwp | ✅ 441 items | ❌ |
| park | ✅ 195 items | ❌ |
| sde | ✅ 2,438 items | ❌ |
| sduf | ✅ 492 items | ❌ |
| ta | ✅ 1,757 items | ❌ |
| wwp | ✅ 2,640 items | ❌ |

---

## Previously shipped fixes

### In v5.0 run5
Bureau: #241 (latency logging), #243 (legend images Phase B), #246 (checklist items arg fix), #248 (bbox mismatch)

### In v5.0 run4
Bureau: #235 (reasoning capture), #236 (Option A skip), #238 (two-call Gemini)
Conductor: #125 (600s timeout), Winston: #11 (viewer step toggle)

### In v5.0 run3
Bureau: #229 (axis swap), #232 (scale formula), #233 (bbox format), #234 (objectPairs)
Conductor: #122 (typed schema), #123 (array + JSON quoting)

### In v5.0 run2
Bureau: #221, #223, #224, #225, #226, #228
Conductor: #117, #118, #119, #121
