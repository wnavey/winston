# Bugs found on the first anchor run: a crashing surface walk, a publish contract that passes on failure, an inflated fit metric, and a run with no `zod`

> **Status:** diagnosed 2026-09-28 to 2026-10-01 during the first `anchor-geometry` run. **One of six fixed** (B4, cartographer#34, merged as `754cb5a`). B1 is worked around in that run's copy only. The rest are open.
> **Discovered on:** run `car-wash-anchor-1` (`runbook_runs.id` `e840f996-46fc-4da1-a109-a3b6fc6d109a`, dir `~/noetic/working/cartographer-geometry/car-wash-anchor-1`). The run anchored cartographer file `bebccffa-baaa-444e-a800-2b760f90ef78` (plat instrument 2024178771) to SIR `caac753c-128b-4311-8d10-2480be0268eb`. It published anchor `e94fae93-b3b6-42e5-9a24-fd16c476bee1` and 8 `geo` rows.
> **Root causes live in:** bureau `runbooks/anchor-geometry` (B1, B2), cartographer `src/lib/geometry/anchor.ts` (B3), cartographer anchor scripts (B4, fixed) and conductor2 `setup` (B5). B6 is machine config.
> **Related:** [`../ANCHOR-RUNS-PLAN.md`](../ANCHOR-RUNS-PLAN.md) (the plan this run executed), [`../DESIGN-SPEC.md`](../DESIGN-SPEC.md) (§3.6 runbook, §3.8 accuracy, D11 auto-accept).

## Summary

The anchoring math is right. Frame-1 solved at rung 1 (`printed_coordinates`, class `survey`) from 28 printed State Plane boxes. Every residual is 0.17–0.31 ft, rotation against grid north is 0.0095°, and the scale is 1.00017. LOT 2 and LOT 3 sit about 3 ft from their county parcels (4401 and 4403 Fegenbush Ln), all shifted the same way. **The solver, the correspond agent, the check agent and the HITL plumbing all worked as designed.** The run published correctly once the bugs below were worked around.

The bugs are in the machinery around the math. Three made the run fail or stop:
- **B1:** every script step's contract crashes on a symlinked directory.
- **B4:** publish could not upload its overlay.
- **B5:** every contract died on a missing `zod`.

One would have let a failed run report success (**B2**). One makes every multi-lot frame with mixed-source targets miss auto-accept for a reason that isn't real (**B3**).

| # | Bug | Where | Severity | State |
|---|---|---|---|---|
| B1 | A symlinked directory in a step's `ws/` crashes the surface walk (EISDIR) | bureau `anchor-geometry/scripts/carto` + `lib/contract-helpers.ts` | Blocks every script step of every anchor run | **Open.** Run-copy workaround only |
| B2 | `5.1-publish` contract passes when publish failed | bureau `anchor-geometry/steps/5.1-publish/contract.test.ts` | ⚠️ Silent: a run can end "complete" with nothing written | **Open** |
| B3 | Ring metrics over a union outline count the target's interior lines | cartographer `src/lib/geometry/anchor.ts` | Wrong `auto_accept_suggested`, misleading readout | **Open** |
| B4 | Render wrote no PNG; publish uploaded SVG, which the bucket rejects | cartographer anchor `render.ts` / `publish.ts` | Blocked publish | **Fixed** (cartographer#34); two residuals |
| B5 | `conductor setup` silently skips `node_modules` when the source checkout has none | conductor2 `src/verbs/setup.rs` | Every contract fails on `zod` | **Open** |
| B6 | Default `CONDUCTOR_SEAT_CMD` can't pick a seat on Will's Mac | machine config / `dsd seat` allowlist | Agent steps can't launch until the line is removed | **Open** (config) |

Not a bug, recorded so nobody re-raises it: the anchor row's `run_slug` is `car-wash-2024178771-run5`, which is **by design**. `run_slug` names the extraction run the frame came from, and the anchor run's own slug is `anchor_run_slug = 'car-wash-anchor-1'` (substation `20260925140000_cartographer_anchors.sql:25-27`).

## The bugs in one diagram

```
 1.1 inputs ─► 1.2 fetch ─► 2.1 correspond ─► 3.1 solve ─► 3.2 render ─► 3.3 check ─► 4.1 HITL ─► 5.1 publish
                                (agent)          │              │              │                         │
                                                 │ ✓ math       │ ✗ B4: no PNG │                         │ ✗ B4: SVG upload
                                                 │ ✓ rung 1     │   (magick)   │                         │   rejected by bucket
                                                 │ ✗ B3: union  │              │ readout repeats the     │ ✗ B2: contract passes
                                                 │   metrics →  │              │ 25.73/209 ft numbers it │   on the failure
                                                 │   auto_accept│              │ can't explain           │
                                                 │   = false    │              │                         │
 every contract ──── ✗ B5: ERR_MODULE_NOT_FOUND 'zod' (run copy has no node_modules)
 every script step ─ ✗ B1: ws/inputs → ../1.2-fetch/ws/inputs (dir symlink) → surfaceFiles → sha256(dir) → EISDIR
```

---

## B1: a symlinked directory in `ws/` crashes every script step's contract

### Symptom

`3.1-solve` produced a correct `ws/anchors.json` (rung 1, residuals 0.17–0.31 ft), and its contract still failed:

```
3.1-solve: contract failing
  FAIL  3.1-solve > the step folder holds nothing outside its declared outputs, scratch/ and worktree/: …
        EISDIR: illegal operation on a directory, read
  7 passed, 1 failed
```

**Tempting wrong guesses:**
- *A stray directory.* No: `ws/` is a declared output, and the stray list is empty.
- *A broken solve.* No: every other rule passes.

### Evidence chain

1. **The step folder holds directory symlinks.** `bureau/runbooks/anchor-geometry/scripts/carto:21` runs `ws.py` before each cartographer script. `ws.py:20` (`LINKS`) links `inputs → 1.2-fetch/ws/inputs`, a directory, and `overlays → 3.2-render/ws/overlays`, also a directory. It does this with `dst.symlink_to(src)` (`ws.py:46`). After 3.1:
   ```
   3.1-solve/ws/anchors.json                         (real file)
   3.1-solve/ws/correspondences.json -> …/2.1-correspond/correspondences.json
   3.1-solve/ws/inputs -> …/1.2-fetch/ws/inputs      (directory symlink)
   ```
2. **The surface walk reads a directory symlink as a file.** `bureau/runbooks/lib/contract-helpers.ts:682-690` `surfaceFiles` uses `readdirSync(…, { withFileTypes: true })`, and `Dirent.isDirectory()` is **false for a symlink**, so line 688 returns `ws/inputs` as a file path.
3. **The manifest then hashes it.** `manifestBody` (`contract-helpers.ts:792-797`) calls `sha256(p)` (`:615`), which does `readFileSync` on a directory. That throws EISDIR inside the last surface rule.
4. **1.2-fetch passes because its `ws/inputs` is a real directory.** Only steps that *link* an upstream directory crash: 3.1 (`inputs`), 3.2 (`inputs`), and 5.1 (`inputs` and `overlays`, when present).

### Root cause

`carto` leaves its reading links on the step's surface after the script has run, and `surfaceFiles` has no rule for a symlink to a directory.

### Impact

Every anchor run on every machine fails at 3.1 until someone works around it. Nothing is lost or wrong, but the run stops. The car-wash run used this workaround, in its run copy only (commit `e5f728b` in `$RUN/runbooks`): after the script, `carto` deletes the directory links from `ws/`. Palm Bay and Conroe will hit the bug again from bureau main.

### Fix directions (not yet implemented)

1. **Drop the reading links once the script has run** (the run-copy workaround, ported). In `carto`, replace `exec bun …` with a run, then `find "$ws" -maxdepth 1 -type l -exec test -d {} \; -exec rm {} \;`, then `exit $rc`. The contracts read upstream files from their real folders (e.g. `3.1-solve/contract.test.ts:74` reads `1.2-fetch/ws/inputs/target.json`), so nothing depends on the links.
2. **Or make `surfaceFiles` symlink-aware.** Skip a symlink whose target is outside the step folder; it is a reference, not this step's output. This change touches every runbook's contracts, so it needs a wider review.

### Verification

Run any anchor run from bureau main through 3.1. It should pass with no EISDIR, and `ls -la 3.1-solve/ws` should show no directory symlinks.

---

## B2: the `5.1-publish` contract passes when publish failed

### Symptom

Publish failed on its first attempt (B4) before writing any row, and `conductor status` reported `5.1-publish  valid`. Another `advance` would have printed `run complete` with nothing in prod.

### Evidence chain

1. **The contract checks only that a log file exists.** `bureau/runbooks/anchor-geometry/steps/5.1-publish/contract.test.ts:13-16`:
   ```ts
   it('the step did what the ruling said: publish.log on publish, SKIPPED.md on stop', () => {
     const d = readJson<{ status: string }>(join(dir, '..', '4.1-hitl'), 'decision.json');
     if (d.status === 'publish') expect(existsSync(join(dir, 'publish.log')), 'publish.log').toBe(true);
     else expect(existsSync(join(dir, 'SKIPPED.md')), 'SKIPPED.md').toBe(true);
   });
   ```
2. **The wrapper writes that log before it checks the exit code.** `bureau/runbooks/anchor-geometry/scripts/publish.py:51-53`:
   ```py
   (out / "publish.log").write_text(f"{p.stdout}{p.stderr}")
   if p.returncode != 0:
       sys.exit(f"publish.ts failed:\n{p.stderr}{p.stdout}")
   ```
   So a failed publish leaves `publish.log` holding the stack trace, and that file satisfies the rule.
3. **Reproduced on the failed attempt's folder.** The setaside copy is at `$RUN/.voided/5.1-publish-20260928T140924/`, and its `publish.log` ends `error: Uploading …/frame-1.svg failed: mime type image/svg+xml is not supported`. Copied beside a `4.1-hitl/decision.json` whose status is `publish`, the contract prints **`pass 3, fail 0`**, with no `ws/publish.json` present.

### Impact

⚠️ **Silent.** Any publish failure counts as a pass: a DB error, an RPC error, an upload error, or a crash after the anchor row but before the `geo` rows. The run reports complete, and `run-update --status done` follows. The car-wash run caught it only because the captain read the advance output. **Cheap detector:** a `publish` ruling with no `5.1-publish/ws/publish.json`.

### Fix directions (not yet implemented). Changing a contract needs Will's sign-off.

1. **Require `ws/publish.json` on a publish ruling.** It is written only on success (`publish.ts` writes it last). Check that it names one anchor per frame in `4.1-hitl/decision.json`, with `status` matching each frame's ruling and `geo_ids` non-empty for every accepted frame.
2. **Belt and braces:** have `publish.py` write the log to `publish.error.log` on a non-zero exit, so a failed run never leaves the success file.

### Verification

The repro above should fail rule 1 once the fix lands. A successful run (e.g. this run's current `5.1-publish`) should still pass.

---

## B3: ring metrics over a union outline count the target's interior lines

### Symptom

Frame-1 placed every lot within a few feet of its target, yet `solve.ts` reported **mean boundary distance 25.73 ft and Hausdorff 209.05 ft**. That makes `auto_accept_suggested` false, because `AUTO_ACCEPT.meanDistFt` is 5 (`anchor.ts:45`). The vision check (`3.3-check/check.md`) wrote: *"I cannot find either number anywhere on the overlay."* Someone reading the console sees a 209 ft error that isn't there.

### Evidence chain

1. **The same transform, measured per lot, is fine.** Computed with `anchor.ts`'s own `polygonIoU`/`meanBoundaryDistance`/`hausdorff` on the run's inputs and the solved params:

   | Lot vs target | IoU | mean dist | Hausdorff |
   |---|---|---|---|
   | LOT 1 vs SIR traverse "Lot 1" | 0.98 | 1.58 ft | 40.08 ft (the traverse straightened the LOT 1/LOT 2 curve) |
   | LOT 2 vs 4401 Fegenbush (county) | 0.96 | 2.45 ft | 9.44 ft |
   | LOT 3 vs 4403 Fegenbush (county) | 0.97 | 2.15 ft | 2.84 ft |
   | LOT 2 + LOT 3 together vs both county rings | — | 2.18 ft | 9.44 ft |
   | **All three, as `ringMetrics` computes it** | 0.99 | **25.73 ft** | **209.05 ft** |

   **The inflation appears only when the target set mixes sources.**
2. **`ringMetrics` measures a union outline** (`anchor.ts:708-715`, built by `fitSets` at `:687`). `hausdorff` and `meanBoundaryDistance` sample each set with `outlineSamples` (`:391`). That function drops a ring's sample when it lies within **`margin = 0.5` ft** of another ring in the same set, so the line two lots share drops out.
3. **That works for the fit set and fails for this target set.** The plat lots share their lines exactly, so every interior sample is dropped and the fit outline is the true outer boundary. The targets are two county rings plus the SIR's hand-built traverse ring, and their shared lines sit a few feet apart. **No interior sample falls within 0.5 ft of the neighbouring ring, so the target's "outline" keeps the interior lines.** Each surviving interior sample is measured to the nearest fit-outline point, up to about 200 ft away across LOT 3 (it's a long thin lot). Hence a Hausdorff of 209 ft and a mean pulled to 25.73 ft.

### Impact

- `auto_accept_suggested` is wrong for any multi-lot frame whose targets don't share lines within 0.5 ft. That is most real cases, because county parcels from one layer rarely coincide to half a foot.
- D11 can't be judged until this is fixed: its thresholds would be calibrated against a broken metric.
- The `cartographer_anchors.metrics` stored for `e94fae93` carries the inflated numbers.
- **IoU and area ratio are unaffected**: they rasterize the union and don't use outlines.

### Fix directions (not yet implemented)

1. **Measure per matched pair, then aggregate.** For each `same_as` / `union_of` match, measure the placed figure against its own target(s). Report the worst Hausdorff and the length-weighted mean. Keep the union only for IoU. This matches what the check agent and the operator actually judge.
2. **Or union the target set geometrically** (polygon union, then the outline) instead of the 0.5 ft sample-drop heuristic. That is more principled for "frame vs. county", but it needs a polygon-union dependency that `anchor.ts` avoided on purpose (`:388-389`).
3. **Store per-lot metrics too**, so the readout and spec v3 §3.8 can quote them.

### Verification

Re-solve the car-wash correspondences, in a scratch copy of `3.1-solve` against the same inputs. Mean distance should come out near 2 ft, Hausdorff should be at most 40 ft (the LOT 1 traverse curve), and `auto_accept_suggested` should flip to true. That also needs the grid check, which passes.

---

## B4 (fixed): render wrote no PNG, and publish uploaded SVG, which the bucket rejects

**Fixed by cartographer#34** (squash `754cb5a`, merged 2026-10-01).

- **Symptom:** `5.1-publish` failed: `Uploading bebccffa-…/anchors/car-wash-anchor-1/frame-1.svg failed: mime type image/svg+xml is not supported`.
- **Cause, part 1 (render):** `render.ts` rasterized the overlay only through `magick`. On this Mac, Homebrew's ImageMagick uses its own MSVG renderer, which failed first with `unable to read font` and, given a font, with `non-conforming drawing primitive definition` on the overlay's paths. So only the SVG was written.
- **Cause, part 2 (publish):** `publish.ts` looped over `['png','svg']` and uploaded every format present. The `cartographer-files` bucket allows only `application/pdf, image/png, image/jpeg` (substation `20260923120000_cartographer_geometry_evidence.sql:184-186`).
- **The fix:**
  - `render.ts` falls back to `/usr/bin/sips` on macOS, which renders the full 1600×1892 overlay correctly.
  - `publish.ts` uploads one overlay per anchor, PNG first. The car-wash re-run published `…/anchors/car-wash-anchor-1/frame-1.png`.
- **Residuals (open, small):**
  1. Foreman's suggestion on #34: `render.ts` doesn't delete an existing `overlays/<frame>.png` first. If every rasterizer fails on a re-render, the old PNG stays and looks current. Delete it before the loop.
  2. On a host with neither a working `magick` nor `sips` (Linux or a cloud sandbox), there's still no PNG, and publish still tries the SVG and fails. Either skip the SVG upload and leave `overlay_path` null, or add `image/svg+xml` to the bucket (a substation migration).

---

## B5: `conductor setup` silently skips `node_modules` when the source checkout has none

### Symptom

On a fresh `conductor init`, the first contract (`1.1-inputs`) failed:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'zod' imported from …/car-wash-anchor-1/runbooks/lib/contract-helpers.ts
```

### Evidence chain

1. **Setup copies the runbooks without `node_modules`, then materializes the contracts' packages from the source checkout's `lib/node_modules`.** See `conductor2/src/verbs/setup.rs:84-91`, which calls `materialize_node_modules(&runbooks_root.join("lib").join("node_modules"), …)`.
2. **When that source is missing, it returns `Ok` without a word.** `setup.rs:266-269`:
   ```rust
   fn materialize_node_modules(src: &Path, dest: &Path) -> Result<()> {
       if !src.exists() {
           return Ok(());
       }
   ```
3. **On 2026-09-28 this machine's bureau checkout had no `runbooks/lib/node_modules`.** It had only the older root-level `runbooks/node_modules` (birth time 2026-09-01). `runbooks/lib/node_modules` has a birth time of **2026-10-01 07:07**, three days after the run. So setup found nothing, wrote nothing, and said nothing.

### Impact

Every contract in a run made on a checkout like that fails at import, and the cause isn't named. Workaround used on the car-wash run: `ln -s ~/noetic/bureau/runbooks/node_modules $RUN/runbooks/node_modules` (gitignored in the run copy).

### Fix directions (not yet implemented)

1. **Make the missing source an error** naming the fix (`npm install` in `<bureau>/runbooks/lib`), whenever the copied runbooks contain any `contract.test.ts`.
2. Or fall back to `runbooks/node_modules` when `lib/node_modules` is absent, with a warning.

### Verification

Move `bureau/runbooks/lib/node_modules` aside, run `conductor setup` on any runbook, and confirm it refuses with that message. Restore the folder; setup should succeed and `$RUN/runbooks/lib/node_modules/zod` should exist.

---

## B6: the default `CONDUCTOR_SEAT_CMD` can't pick a seat on Will's Mac

`conductor init` writes `CONDUCTOR_SEAT_CMD='dsd seat pick --wait 900'` into `$RUN/.env`. On this machine, `dsd seat status` shows `allowlist: max-*` and `owner: will — seats:` (none), so an unpinned pick finds nothing. Agent steps would wait out the 900 s and fail.

- **Workaround on the car-wash run (as ANCHOR-RUNS-PLAN §5 says):** delete the line, so steps use the ambient Claude login.
- **An earlier session's workaround:** `~/noetic/scratch/extract-geometry-v2/seat-pick.sh` pins `--seat noetic` then `personal`.

**Fix direction:** register this machine's accounts in the seat allowlist, or have `init` omit the line when `dsd seat status` lists no eligible seat. This is a Machinist or Will config call, not a code bug in the runbook.

---

## Not filed as bugs (design questions for spec v3)

- **Open figures go in as closed polygons.** The VARIABLE WIDTH CROSS-ACCESS ESMT "GRANTED" figure has `closure_error` 40.63 ft: two sides are never printed on the plat, and the extraction closed it with a straight chord. Publish wrote it as a closed `geo` polygon, with `closure_error` stored on the row. Whether an open figure should publish as a line, be held back, or be flagged is a v3 open question (it relates to Q9).
- **Accept is per frame.** The operator can't accept the lots and hold back one figure. The check agent asked to hold back the cross-access easement and there was no way to do it.

## Reproduction / verification recipe (all bugs)

```sql
-- the published anchor and its rows (B3's stored metrics live here)
select status, method, accuracy_class, run_slug, anchor_run_slug, metrics->>'mean_dist_ft', metrics->>'hausdorff_ft', metrics->>'auto_accept_suggested'
from cartographer_anchors where id = 'e94fae93-b3b6-42e5-9a24-fd16c476bee1';
select kind, label, method, srid_local, properties->>'anchor_id' from geo
where sir_id = 'caac753c-128b-4311-8d10-2480be0268eb' and method = 'anchored';   -- 8 rows
```

- **Run artifacts:** `~/noetic/working/cartographer-geometry/car-wash-anchor-1/`.
  - `3.1-solve/ws/anchors.json`: B3 numbers.
  - `3.3-check/check.md`: the readout that can't explain them.
  - `.voided/5.1-publish-20260928T140924/publish.log`: the B2/B4 failure.
  - `runbooks/` git log, commit `e5f728b`: the B1 workaround.
- **B1:** run 3.1 of any anchor run from bureau main, and expect EISDIR until it's fixed.
- **B2:** the contract on a copy of the voided publish folder, as in B2 item 3.
- **B3:** the per-lot table above; recompute it with `anchor.ts` exports on `1.2-fetch/ws/inputs/*` and the params in `3.1-solve/ws/anchors.json`.
- **B5:** the move-aside test above.
