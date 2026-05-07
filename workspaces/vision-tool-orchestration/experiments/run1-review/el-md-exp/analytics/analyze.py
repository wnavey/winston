#!/usr/bin/env python3
"""Analyze the el-md-exp vision-check experiment run 1.

Mirrors the CC run-3/4 analyzer but adapted for the review side:

- Ground truth source is `measure-distance-tool/analysis/guides/el-md-exp/
  item-classification.json` (per-deficiency JSON), not the CC TSV.
- Items are keyed by `deficiencyId` (e.g. `EL-2.1`) rather than
  `<grouping>:<item_id>`.
- The vision_check `inputs.checklistItemId` is in the form
  `el-md-exp:<deficiencyId>` (e.g. `el-md-exp:EL-2.1`) per the bureau
  experiment review.md guidance — split it on `:` for matching.

Reads:
- ../output/vision-check-calls/<callId>/metadata.json — one per call
- ../output/runs/run-*/findings/*.md.json — per-(run, guide) findings
- measure-distance-tool/analysis/guides/el-md-exp/item-classification.json

Writes:
- routing-by-classification.tsv  — one row per (deficiency × classification),
  with classifier route counts.
- vision-check-calls-audit.tsv   — one row per call, full per-call details
  (matches CC analyzer shape).
- summary stats (printed to stdout)

The headline question this run answers: *"is the classifier identifying
measurement-needed items?"* The actual measure-distance specialist execution
is deferred (dispatch falls back to generic via `measurement_arg_
construction_not_implemented`), so this analyzer flags the would-have-
called rate explicitly.
"""

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
EXP_OUTPUT = HERE.parent / "output"
CALLS_DIR = EXP_OUTPUT / "vision-check-calls"
RUNS_DIR = EXP_OUTPUT / "runs"
GROUND_TRUTH = (
    HERE.parent.parent.parent.parent.parent
    / "measure-distance-tool" / "analysis" / "guides" / "el-md-exp"
    / "item-classification.json"
)


def load_ground_truth():
    return json.loads(GROUND_TRUTH.read_text())["items"]


def load_calls():
    """Each metadata.json captures one vision_check invocation."""
    calls = []
    for call_dir in sorted(CALLS_DIR.iterdir()):
        if not call_dir.is_dir():
            continue
        meta_path = call_dir / "metadata.json"
        if not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text())
        inputs = meta["inputs"]
        # checklistItemId format: "<guideCode>:<deficiencyId>" — split for join.
        item_id_full = inputs.get("checklistItemId") or ""
        if ":" in item_id_full:
            guide, deficiency_id = item_id_full.split(":", 1)
        else:
            guide, deficiency_id = "", item_id_full
        calls.append({
            "callId": meta["callId"],
            "checklistItemIdFull": item_id_full,
            "guide": guide,
            "deficiencyId": deficiency_id,
            "checklistItemText": inputs.get("checklistItemText", ""),
            "question": inputs.get("question", ""),
            "documentId": inputs.get("documentId"),
            "sheetNum": inputs.get("sheetNum"),
            "regionHint": inputs.get("regionHint"),
            "problemType": meta["classifier"]["output"]["problemType"],
            "classifierConfidence": meta["classifier"]["output"]["confidence"],
            "classifierReasoning": meta["classifier"]["output"]["reasoning"],
            "specialistCalled": meta["dispatch"]["specialistCalled"],
            "dispatchSuccess": meta["dispatch"]["success"],
            "fallbackReason": meta["dispatch"].get("fallbackReason"),
        })
    return calls


def load_findings():
    """Per-(run, guide) findings. Schema is reviewExtended when
    logAllAgentTrace=true (each finding has an `agentTrace` object).
    """
    out = []
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir():
            continue
        run = run_dir.name
        findings_dir = run_dir / "findings"
        if not findings_dir.exists():
            continue
        for f in sorted(findings_dir.glob("*.md.json")):
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                trace = finding.get("agentTrace") or {}
                out.append({
                    "run": run,
                    "guide_file": f.name.replace(".md.json", ""),
                    "deficiencyId": finding.get("deficiencyId"),
                    "status": finding.get("status"),
                    "tools_used": trace.get("tools_used") or [],
                    "observation": trace.get("observation", ""),
                    "reasoning": trace.get("reasoning", ""),
                })
    return out


# Ground-truth mapping — defines which classifier route is "correct" per
# `classification` field. Drawn from the item-classification.json
# subClassifications + shouldCall mapping.
EXPECTED_ROUTE = {
    "horizontal": "measurement",
    "vertical-or-mixed": "drawing_inspect",
    "not-applicable": None,
}


def main():
    ground_truth = load_ground_truth()
    calls = load_calls()
    findings = load_findings()

    print("=" * 72)
    print("VISION-CHECK EXPERIMENT — REVIEW (el-md-exp) RUN 1 ANALYSIS")
    print("=" * 72)
    print()
    print(f"Ground-truth deficiencies: {len(ground_truth)}")
    print(f"Vision-check calls: {len(calls)}")
    print(f"Findings (across all runs): {len(findings)}")

    # ── Calls per deficiency ─────────────────────────────────────────
    calls_by_def = defaultdict(list)
    for c in calls:
        calls_by_def[c["deficiencyId"]].append(c)
    print(f"Distinct deficiencies called (via vision_check): {len(calls_by_def)}")

    # ── Classifier routing distribution ─────────────────────────────
    print("\n── CLASSIFIER ROUTING DISTRIBUTION ──")
    route_counter = Counter(c["problemType"] for c in calls)
    for route, count in route_counter.most_common():
        print(f"  -> {route}: {count}")

    # Specialist dispatch outcomes
    print("\n── SPECIALIST DISPATCH ──")
    spec_counter = Counter(c["specialistCalled"] for c in calls)
    for spec, count in spec_counter.most_common():
        print(f"  -> {spec}: {count}")
    fallbacks = [c for c in calls if c.get("fallbackReason")]
    if fallbacks:
        print(f"\n  Fallbacks: {len(fallbacks)} of {len(calls)}")
        for reason, count in Counter(c["fallbackReason"] for c in fallbacks).most_common():
            print(f"    - {reason}: {count}")

    # ── Routing accuracy by ground-truth classification ──────────────
    # For each call, check whether classifier route matches the expected
    # route (per ground truth). Count by classification bucket.
    print("\n── ROUTING ACCURACY (calls × ground truth) ──")
    confusion = defaultdict(lambda: defaultdict(int))
    unmatched = 0
    for c in calls:
        gt = ground_truth.get(c["deficiencyId"])
        if not gt:
            unmatched += 1
            continue
        cls = gt.get("classification", "unknown")
        confusion[cls][c["problemType"]] += 1

    if unmatched:
        print(f"  ({unmatched} calls did not match a ground-truth deficiency)")
    routes = sorted({c["problemType"] for c in calls})
    header = f"  {'classification':<22s}" + "".join(f"{r:>16s}" for r in routes) + f"{'total':>8s}{'expected':>16s}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for cls in sorted(confusion.keys()):
        row_total = sum(confusion[cls].values())
        cells = "".join(f"{confusion[cls][r]:>16d}" for r in routes)
        expected = EXPECTED_ROUTE.get(cls, "?") or "(skip)"
        print(f"  {cls:<22s}{cells}{row_total:>8d}{expected:>16s}")

    # ── Measurement hit rate ─────────────────────────────────────────
    # The headline question: when the classifier correctly identifies a
    # horizontal-distance item as `measurement`, do we have meaningful
    # signal? (Even though dispatch falls back to generic.)
    print("\n── MEASUREMENT-ROUTE HIT RATE ──")
    horizontal_calls = [
        c for c in calls
        if (gt := ground_truth.get(c["deficiencyId"])) and gt.get("classification") == "horizontal"
    ]
    measurement_routes = [c for c in horizontal_calls if c["problemType"] == "measurement"]
    print(f"  Calls on horizontal-distance items: {len(horizontal_calls)}")
    print(f"  Of those, classifier picked `measurement`: {len(measurement_routes)} = "
          f"{100 * len(measurement_routes) / max(1, len(horizontal_calls)):.1f}%")
    print(f"  Of those, dispatch fell back to generic (Phase B): "
          f"{sum(1 for c in measurement_routes if c.get('fallbackReason'))} of {len(measurement_routes)}")

    # Item-level coverage: how many distinct horizontal items did we
    # call vision_check on at least once across all 3 runs?
    horizontal_items = {iid for iid, gt in ground_truth.items()
                        if gt.get("classification") == "horizontal"}
    horizontal_called = {c["deficiencyId"] for c in horizontal_calls}
    print(f"\n  Horizontal items in ground truth: {len(horizontal_items)}")
    print(f"  Horizontal items where vision_check fired ≥1x (across 3 runs): "
          f"{len(horizontal_called)} = {100 * len(horizontal_called) / max(1, len(horizontal_items)):.1f}%")
    horizontal_hit_via_measurement = {
        c["deficiencyId"] for c in measurement_routes
    }
    print(f"  Horizontal items routed to `measurement` ≥1x: "
          f"{len(horizontal_hit_via_measurement)} = "
          f"{100 * len(horizontal_hit_via_measurement) / max(1, len(horizontal_items)):.1f}%")

    # ── Classifier confidence ────────────────────────────────────────
    if calls:
        confs = [c["classifierConfidence"] for c in calls]
        print(f"\n── CLASSIFIER CONFIDENCE ──")
        print(f"  mean: {sum(confs)/len(confs):.3f}, min: {min(confs):.2f}, max: {max(confs):.2f}")

    # ── Write audit TSV ──────────────────────────────────────────────
    audit_path = HERE / "vision-check-calls-audit.tsv"
    with audit_path.open("w") as out:
        w = csv.DictWriter(out, fieldnames=[
            "callId", "deficiencyId", "matched_classification", "matched_should_call",
            "classifier_route", "expected_route_strict", "route_correct_strict",
            "classifier_confidence", "classifier_reasoning",
            "specialist", "dispatch_success", "fallback_reason",
            "checklist_text_preview", "agent_question_preview",
        ], delimiter="\t")
        w.writeheader()
        for c in calls:
            gt = ground_truth.get(c["deficiencyId"], {})
            cls = gt.get("classification", "")
            expected = EXPECTED_ROUTE.get(cls, "?") or ""
            w.writerow({
                "callId": c["callId"],
                "deficiencyId": c["deficiencyId"],
                "matched_classification": cls,
                "matched_should_call": gt.get("shouldCall", ""),
                "classifier_route": c["problemType"],
                "expected_route_strict": expected,
                "route_correct_strict": "yes" if c["problemType"] == expected else "no",
                "classifier_confidence": c["classifierConfidence"],
                "classifier_reasoning": c["classifierReasoning"],
                "specialist": c["specialistCalled"],
                "dispatch_success": c["dispatchSuccess"],
                "fallback_reason": c.get("fallbackReason") or "",
                "checklist_text_preview": c["checklistItemText"][:100],
                "agent_question_preview": c["question"][:100],
            })
    print(f"\nWrote {audit_path.name} ({len(calls)} rows)")

    # ── Write per-deficiency summary TSV ─────────────────────────────
    rows = []
    for did, gt in sorted(ground_truth.items()):
        item_calls = calls_by_def.get(did, [])
        routes_seen = Counter(c["problemType"] for c in item_calls)
        any_specialist = ",".join(sorted({c["specialistCalled"] for c in item_calls})) if item_calls else ""
        rows.append({
            "deficiencyId": did,
            "classification": gt.get("classification", ""),
            "shouldCall": gt.get("shouldCall", ""),
            "subClassification": gt.get("subClassification", ""),
            "vision_check_called": len(item_calls),
            "routes": ",".join(f"{r}:{n}" for r, n in routes_seen.most_common()),
            "specialists_invoked": any_specialist,
        })
    summary_path = HERE / "routing-by-classification.tsv"
    with summary_path.open("w") as out:
        w = csv.DictWriter(out, fieldnames=rows[0].keys(), delimiter="\t")
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {summary_path.name} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
