# `el` feasibility-guide slug holds Environmental content, not Electrical — every SIR `el` discipline runs without its lens

> **Status:** Diagnosed 2026-08-04, fix NOT implemented. Root cause lives in **Bureau** (`bureau/jurisdictions/<slug>/feasibility-guides/el.md`), not in the SIR pipeline code. Discovered on the Louisville/Jefferson County SIR run `~/noetic/working/sir/hutton/car-wash-louisville-ky/2026-08-01-083311` — step **4.1** discipline **`el`** returned `domain-mismatch`, forcing `guide_coverage=mismatch-flagged` and `status: degraded`. **Presents as a per-run "degraded" flag — it is not a per-run defect; it is a systemic Bureau content bug affecting 45 of 46 jurisdictions.** The SIR pipeline already documents the swap as a known caveat in `bureau/pipelines/sir/4.1-disciplines/disciplines.json` (`_guide_filename_caveat`) but no one has fixed the guides.

## Summary

The ten SIR feasibility guides per jurisdiction are keyed by the **canonical discipline codes** in `bureau/docs/disciplines.md`, where **`el` = Electrical (infrastructure review)** and **`eptp` = Environmental Protection & Tree Preservation**. In almost every jurisdiction's guide set, the file named `el.md` is instead authored as an **Environmental** guide (karst, MS4 / post-construction water quality, air quality, contamination, wetlands), and there is **no electrical-infrastructure guide anywhere in the set**. The companion `eptp.md` is authored narrowly as "Erosion, Trees & Plants." This is the **legacy diligence-skill discipline mapping** (el⇒Environmental, eptp⇒erosion/trees) frozen into the guide files, and it conflicts with the canonical mapping the pipeline keys on.

What is **working correctly**: the pipeline's own guard. `4.1`'s brief makes each discipline read its guide's `## Domain` section and record `domain-match` / `domain-mismatch`, and `check_disciplines.py` propagates a mismatch into `guide_coverage` and degrades the step — so the defect is loud, not silent, at the pipeline layer. The `el` discipline agent also **worked around it correctly**: on the Louisville run it recorded the mismatch, reconstructed the electrical analysis from the recorded LG&E instrument + the LDC, and punted the environmental content to `eptp`. Nothing downstream is corrupted.

**Root cause, one sentence:** the SIR feasibility-guide sets were authored under the legacy `el = Environmental` discipline mapping, so `el.md` carries Environmental content and no Electrical guide exists — the discipline whose lens the `el` agent is supposed to apply is simply absent from Bureau for 45 of 46 jurisdictions.

## The bug in one diagram

```
CANONICAL (bureau/docs/disciplines.md)          GUIDE FILES ON DISK (bureau/jurisdictions/<j>/feasibility-guides/)
──────────────────────────────────────          ──────────────────────────────────────────────────────────────
 el   = Electrical (transformer, service,         el.md    = "# Environmental Feasibility"   ✗ WRONG DISCIPLINE
        undergrounding, EV-ready, gen noise)                  (karst / MS4 / air / contamination / wetlands)
 eptp = Environmental Protection & Tree           eptp.md  = "# Erosion, Trees & Plants Feasibility"  ~ narrowed
        Preservation (canopy, CRZ, buffers,                   (canopy / preservation / EPSC only)
        stream setbacks, disturbance permits)
                                                  (no electrical-infrastructure guide exists) ✗ MISSING

SIR 4.1 fan-out (disciplines.json roster keyed on CANONICAL codes)
   spawn el  ──reads──► el.md  ──`## Domain` says "Environmental"──►  agent records  domain-MISMATCH ✗
                                                                        │
   check_disciplines.py  ◄──────────────────────────────────────────────┘
        guide_coverage = mismatch-flagged  ──►  4.1 _health.json status = DEGRADED (correct, loud)
        el's ELECTRICAL analysis: reconstructed from instruments+code, NO GUIDE LENS  ⚠ silent quality gap
```

The `✗` at `el.md` is the single point of corruption; every `✓` after it (the mismatch record, the degrade, the workaround) is the pipeline behaving correctly on top of wrong input.

## Symptom (as observed)

- **Run:** `~/noetic/working/sir/hutton/car-wash-louisville-ky/2026-08-01-083311`, step `4.1-disciplines`, discipline `el`.
- **What the agent reported:** *"DOMAIN-MISMATCH. The assigned `jurisdictions/louisville/feasibility-guides/el.md` is an Environmental guide (karst / MSD water quality / contamination / APCD), not Electrical infrastructure … Recorded it, punted the environmental content to `eptp`, and analyzed electrical from the 3.4 research, the recorded LG&E instrument (INST 2024176896), and the Louisville LDC directly."*
- **What the run recorded:** `output/4.1-disciplines/_health.json` → `checks.guide_coverage: "mismatch-flagged"`, `status: "degraded"`; carried to the `4.4` gate readout as the run's one tool/knowledge-base defect.
- **Tempting-but-wrong first guess:** "the `el` agent misread its guide." It didn't — the guide's own `## Domain` section opens *"Environmental constraints other than floodplain … and tree/erosion."* The agent read it correctly; the file is the wrong discipline.

## Evidence chain

1. **Canonical mapping is Electrical.** `bureau/docs/disciplines.md:11-12`: *"**EL - Electrical: infrastructure review ("Electric"):** transformer setbacks, easements, undergrounding, EV-ready parking, screening, and generator noise."* and *"**EPTP - Environmental Protection & Tree Preservation ("Environmental"):** protected-tree thresholds, critical root zones, stream/creek setbacks, disturbance permits, and replacement ratios."* **The `el` slug is unambiguously Electrical; environmental protection is `eptp`.**

2. **Louisville `el.md` is Environmental.** `bureau/jurisdictions/louisville/feasibility-guides/el.md:1` = `# Environmental Feasibility — Louisville/Jefferson County Metro, KY`; its `## Domain` enumerates *"Karst terrain … Post-construction water-quality / MS4 … Air quality (APCD) … Contamination / brownfield … wetlands / WOTUS."* **Not one electrical-infrastructure topic is present.**

3. **No electrical guide exists in the set.** `grep -liE "electric|transformer|utility service|kV|feeder" bureau/jurisdictions/louisville/feasibility-guides/*.md` returns **nothing**. The `el` discipline has no guide to read in-domain; the mismatch is not recoverable by picking a different file.

4. **`eptp.md` absorbed the narrowed role.** `bureau/jurisdictions/louisville/feasibility-guides/eptp.md:1` = `# Erosion, Trees & Plants Feasibility`; its Domain says *"Steep-slope disturbance and post-construction water-quality volume are owned by `el`."* **The guide set is internally consistent with the legacy el⇒Environmental mapping — which is exactly why it reads clean per-file and only breaks against the canonical roster.**

5. **The pipeline already knew.** `bureau/pipelines/sir/4.1-disciplines/disciplines.json` → `_guide_filename_caveat`: *"the SIR-era feasibility guides written for several jurisdictions (odessa, ector-county) file ENVIRONMENTAL content under `el.md`, matching the legacy diligence skill's older mapping rather than the canonical one."* **The defect was documented as a caveat and worked around in the roster design, but the guides were never corrected.**

6. **It is near-universal, not a Louisville quirk.** Scanning `el.md`'s H1 across all 46 jurisdictions with a feasibility-guide set: **45 read `# Environmental Feasibility`**; the sole exception is **`austin/feasibility-guides/el.md` = `# Electrical & Utility Feasibility — Austin`**. **Every SIR run in any jurisdiction except Austin degrades on `el` and runs its electrical analysis without a guide.**

## Root cause

`bureau/jurisdictions/<slug>/feasibility-guides/el.md:1` is authored as an Environmental guide for 45 of 46 jurisdictions (all but `austin`). The canonical roster the SIR fan-out keys on (`bureau/pipelines/sir/4.1-disciplines/disciplines.json` → `disciplines[].name`, mirroring `bureau/docs/disciplines.md`) assigns `el` = Electrical, so the spawned `el` agent is handed an out-of-domain guide and there is no in-domain guide to hand it instead.

The missing invariant: **a feasibility-guide filename is a claim about its discipline scope, and nothing enforces that `<code>.md`'s content matches canonical `<code>`.** The guide's own `## Domain` section is the only place the mismatch is detectable, and that check lives at *run time* in the `el` brief — never at guide-authoring time. `disciplines.json`'s `_guide_filename_caveat` is prose documentation of the hazard, not a guard against it.

Near-miss / irony: `austin/el.md` proves the correct shape was known and authored at least once; the other 45 sets were generated under the legacy mapping and never reconciled.

## Impact

Enumerate every consumer of the `el` guide slug in a SIR run:

- **`4.1` `el` discipline (affected, deterministic).** In all 45 non-Austin jurisdictions the `el` agent gets `domain-mismatch` on every run. It does not die — it reconstructs electrical analysis from whatever instruments/code the run happens to carry — but it applies **no jurisdiction-specific electrical lens** (no local transformer-setback, undergrounding, EV-ready, or generator-noise regime), which is precisely what a feasibility guide exists to supply. ⚠ **This is a silent quality gap:** the environmental *content* still gets analyzed (under `el` or punted to `eptp`), so the run looks complete, but the Electrical discipline ships without its regulatory knowledge and nothing but the degrade flag records that.
- **`4.1` `guide_coverage` check + `_health.json` (affected, loud).** Forced to `mismatch-flagged` → `status: degraded` on every non-Austin run. This is correct behavior on bad input, but it means **every SIR run in 45 jurisdictions carries a permanent "degraded" §4 status** that is really a Bureau content bug, desensitizing readers to the degrade signal.
- **`4.4` HITL2 gate readout (affected).** The swap surfaces to the CTO as the run's one "knowledge-base defect," consuming gate attention on a systemic issue no per-run action closes.
- **`eptp` discipline (partially affected).** Gets the narrowed "Erosion, Trees & Plants" guide instead of full Environmental Protection & Tree Preservation; on the Louisville run it stretched its scope to absorb the environmental-condition analysis and self-reported `domain-match`, so it did not fail the check — but its guide is mis-scoped against canonical, so the coverage is by agent judgment, not by guide.
- **`austin` runs (unaffected).** `el.md` is correctly Electrical; `el` returns `domain-match`. This is the control case.
- **Downstream (`4.2`/`4.3`/§5) (unaffected).** They consume the discipline findings, which were produced correctly (via workaround). No corrupted figure propagates.

**Deterministic:** yes — fires on every non-Austin SIR run. **Logged when it fires:** yes, at the pipeline layer (`guide_coverage`, health warning, gate readout) — so it is not silent *that* it fired, only silent about the *electrical-analysis quality gap* underneath the flag.

Cheap detector: `for f in bureau/jurisdictions/*/feasibility-guides/el.md; do head -1 "$f" | grep -qi electric || echo "SWAP: $f"; done` lists every affected jurisdiction.

## Fix directions (not yet implemented — directions for the implementing agent, not a mandate)

1. **Fix the invariant (most principled): reconcile the guide sets to canonical.** For each non-Austin jurisdiction, author a real `el.md` = Electrical & Utility Feasibility (Austin's is the template — see Prior art), and re-home the current `el.md` Environmental content into `eptp.md` (merging with / superseding the narrow "Erosion, Trees & Plants" scope so `eptp` = full Environmental Protection & Tree Preservation per canonical). This is the largest change (≈45 jurisdictions × 2 files) and is the only one that gives the `el` discipline its lens. Sequence it behind a repeatable generator rather than by hand.
2. **Cheap guard so no new set regresses.** Add a Bureau lint (CI or a `validate` step) asserting that each `feasibility-guides/<code>.md`'s H1 / `## Domain` matches canonical `<code>` from `docs/disciplines.md`. This converts the current run-time-only `## Domain` check into an author-time gate and stops the next generated jurisdiction from shipping the swap.
3. **Detection/inventory pass over what exists.** Run the cheap detector above, record the 45 affected sets, and decide per-jurisdiction priority (jurisdictions with live/near-term SIR demand first). Repair hazard: none of the downstream artifacts key on the guide *text*, so re-authoring guides does not shift any id or citation — this is a low-blast-radius content fix, unlike an instrument re-extraction.

## Prior art

**`austin` already has the correct shape.** `bureau/jurisdictions/austin/feasibility-guides/el.md:1` = `# Electrical & Utility Feasibility — Austin`. Whatever authored Austin's set produced an in-domain Electrical guide and (presumably) a correctly-scoped `eptp`; that pair is the reference the other 45 should be brought to. Diff Austin's `el.md` / `eptp.md` domain framing against a legacy set to see the intended split.

## Reproduction / verification recipe

Cold-start, no prior context:

1. **Confirm the swap on Louisville:**
   `head -1 bureau/jurisdictions/louisville/feasibility-guides/el.md` → `# Environmental Feasibility — Louisville/Jefferson County Metro, KY` (should be Electrical).
2. **Confirm no electrical guide exists there:**
   `grep -liE "electric|transformer|utility service|kV|feeder" bureau/jurisdictions/louisville/feasibility-guides/*.md` → no output.
3. **Confirm canonical intent:** `sed -n '11,12p' bureau/docs/disciplines.md` → `el` = Electrical, `eptp` = Environmental Protection & Tree Preservation.
4. **Confirm systemic scope (45/46):**
   `for f in bureau/jurisdictions/*/feasibility-guides/el.md; do head -1 "$f" | grep -qi electric || echo "$f"; done` → 45 files; only `austin` is absent from the list.
5. **Confirm the run-level symptom:** in `~/noetic/working/sir/hutton/car-wash-louisville-ky/2026-08-01-083311/output/4.1-disciplines/`, `el.md`'s domain-verdict line records `domain-mismatch` and `_health.json` has `checks.guide_coverage: "mismatch-flagged"`, `status: "degraded"`.

**Acceptance test for the eventual fix:** after repair, `head -1 <j>/feasibility-guides/el.md` names Electrical for every jurisdiction, the detector in step 4 prints nothing, and a re-run of SIR `4.1` `el` on any repaired jurisdiction returns `domain-match` with `guide_coverage: ok`.
