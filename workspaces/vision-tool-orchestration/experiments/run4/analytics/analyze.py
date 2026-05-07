#!/usr/bin/env python3
"""Analyze the run-4 vision-check experiment against cc-vision-classification ground truth.

Run 4 is run 3 with the prompt-trim PR (bureau#306) live — "SINGLE entry
point" line dropped, "Tips for phrasing" section dropped, question field
description simplified to "Remember, it does not have your context."
Same schema, same analyzer, kept as a sibling so we can diff TSVs directly.

Originally for run 3 (note kept for context):

Run 3 differs from run 1 in ways this analyzer needs to know about:

1. Each vision_check call's metadata.json records `inputs.checklistItemId`
   (introduced in conductor#146 + bureau#305). That gives us EXACT call→item
   attribution. Fuzzy text matching is kept only as a fallback for calls
   that don't carry the id (shouldn't happen on run 3+).

2. Each call records both `inputs.checklistItemText` (canonical) AND
   `inputs.question` (agent-phrased). The audit TSV exposes both so we can
   inspect what the agent actually asked Gemini.

Reads:
- ../cc/output/vision-check-calls/<callId>/metadata.json
- ../cc/output/runs/run-*/findings/cc-*.md.json
- ../cc/output/rephrased-items.json  (fallback for fuzzy matching)
- cc-vision-classification/cc-classification.tsv
- bureau checklist markdown files

Writes:
- vision-call-invocation-metrics.tsv (one row per classified item — canonical)
- vision-check-calls-audit.tsv (one row per vision-check call — debug)
- summary stats (printed to stdout)
"""

import csv
import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

HERE = Path(__file__).parent.resolve()
CC_OUTPUT = HERE.parent / "cc" / "output"
CALLS_DIR = CC_OUTPUT / "vision-check-calls"
RUNS_DIR = CC_OUTPUT / "runs"
REPHRASED = CC_OUTPUT / "rephrased-items.json"
GRADES_TSV = HERE.parent.parent.parent.parent / "cc-vision-classification" / "cc-classification.tsv"
CHECKLIST_DIR = Path(
    "/Users/winston/noetic/bureau/jurisdictions/austin/completeness-check/v2.5-trimmed"
)

# Grade -> expected route mapping (for routing accuracy)
GRADE_TO_ROUTE = {
    "inspect-drawing-required": "drawing_inspect",
    "inspect-drawing-optional": "drawing_inspect",
    "vision-only": "generic",
    "no-tool": None,
}


# ── Data loaders ─────────────────────────────────────────────────────────


def load_grades():
    """Load ground-truth grades: (grouping, item_id) -> {grade, confidence, condition}."""
    grades = {}
    with GRADES_TSV.open() as f:
        for row in csv.DictReader(f, delimiter="\t"):
            grades[(row["grouping"], row["item_id"])] = {
                "grade": row["grade"],
                "confidence": row["confidence"],
                "condition": row["condition"],
            }
    return grades


def load_checklist_text():
    """Load checklist deficiency text from bureau markdown: (grouping, item_id) -> text."""
    item_text = {}
    for md_file in sorted(CHECKLIST_DIR.glob("cc-*.md")):
        grouping = md_file.stem
        for line in md_file.read_text().split("\n"):
            line = line.strip()
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.split("|")]
            if len(cells) < 3:
                continue
            item_id, deficiency = cells[1], cells[2]
            if item_id in ("ID", "----", "") or deficiency in ("Item", "------", ""):
                continue
            if "--" in item_id and len(item_id) < 4:
                continue
            item_text[(grouping, item_id)] = deficiency
    return item_text


def load_rephrased():
    """Load rephrased items: item_id -> text."""
    return json.loads(REPHRASED.read_text())


def load_calls():
    """Load all vision-check call metadata.

    Run 3+ records `inputs.checklistItemId` and `inputs.question` alongside
    the canonical text. Older runs (run 1) only have `checklistItemText`.
    Captures both shapes so downstream code can prefer the id when present.
    """
    calls = []
    for call_dir in sorted(CALLS_DIR.iterdir()):
        if not call_dir.is_dir():
            continue
        meta = json.loads((call_dir / "metadata.json").read_text())
        inputs = meta["inputs"]
        calls.append({
            "callId": meta["callId"],
            "checklistItemId": inputs.get("checklistItemId"),  # new in run 3
            "checklistItemText": inputs.get("checklistItemText", ""),
            "question": inputs.get("question", ""),  # new in run 3
            "documentId": inputs.get("documentId"),
            "regionHint": inputs.get("regionHint"),
            "problemType": meta["classifier"]["output"]["problemType"],
            "classifierConfidence": meta["classifier"]["output"]["confidence"],
            "classifierReasoning": meta["classifier"]["output"]["reasoning"],
            "specialistCalled": meta["dispatch"]["specialistCalled"],
            "dispatchSuccess": meta["dispatch"]["success"],
            "fallbackReason": meta["dispatch"].get("fallbackReason"),
            "startedAt": meta.get("startedAt"),
            "completedAt": meta.get("completedAt"),
        })
    return calls


def load_findings():
    """Load findings: list of {run, grouping, item_id, status, tools_used}."""
    out = []
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir():
            continue
        run = run_dir.name
        findings_dir = run_dir / "findings"
        if not findings_dir.exists():
            continue
        for f in sorted(findings_dir.glob("cc-*.md.json")):
            grouping = f.name.replace(".md.json", "")
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                out.append({
                    "run": run,
                    "grouping": grouping,
                    "item_id": finding["checklistItemId"],
                    "status": finding.get("status"),
                    "tools_used": finding.get("tools_used") or [],
                })
    return out


# ── Fuzzy matching ───────────────────────────────────────────────────────


def _normalize(s):
    return re.sub(r"[^a-z0-9 ]", "", s.lower())


def match_calls_to_items(calls, rephrased):
    """Match vision-check calls to (grouping, item_id) tuples.

    Run 3+: the call's `inputs.checklistItemId` is in the form
    `<grouping>:<item-id>` (e.g. `cc-22:CC-22-12`). We split it and use
    that exact match — no fuzzy matching, no ambiguity, score=1.0.

    Older runs: fall back to fuzzy matching against rephrased-items.json.
    The fallback score is whatever SequenceMatcher returns (usually
    0.6–0.95).

    Returns: list of (call, matched_grouping, matched_item_id, match_score).
    """
    results = []
    for call in calls:
        # Preferred path: exact id match (run 3+).
        item_id_full = call.get("checklistItemId")
        if item_id_full and ":" in item_id_full:
            grouping, item_id = item_id_full.split(":", 1)
            results.append((call, grouping, item_id, 1.0))
            continue

        # Fallback: fuzzy match against rephrased text (run 1).
        call_norm = _normalize(call.get("checklistItemText", ""))
        best_score = 0
        best_id = None
        for item_id, rtext in rephrased.items():
            score = SequenceMatcher(None, call_norm, _normalize(rtext)).ratio()
            if score > best_score:
                best_score = score
                best_id = item_id
        results.append((call, None, best_id, best_score))
    return results


# ── Helpers ──────────────────────────────────────────────────────────────


def _expected_tool(grade):
    if grade == "inspect-drawing-required":
        return "vision_check (drawing_inspect)"
    if grade == "inspect-drawing-optional":
        return "vision_check (drawing_inspect or generic)"
    if grade == "vision-only":
        return "vision_check (generic)"
    if grade == "no-tool":
        return "none"
    return "unknown"


# ── Main ─────────────────────────────────────────────────────────────────


def main():
    grades = load_grades()
    checklist_text = load_checklist_text()
    calls = load_calls()
    findings = load_findings()
    rephrased = load_rephrased()

    # Index findings by item
    findings_by_item = defaultdict(list)
    for f in findings:
        findings_by_item[(f["grouping"], f["item_id"])].append(f)

    # Match calls to items — exact via checklistItemId for run 3+, fuzzy
    # fallback for older runs. The 4-tuple is (call, grouping, item_id, score).
    matched = match_calls_to_items(calls, rephrased)
    item_to_grouping = {item_id: grouping for (grouping, item_id) in grades}

    # Index matched calls by item_id (threshold >= 0.60). For run 3 every
    # match is score=1.0 via the exact-id path; the threshold only matters
    # for the fuzzy fallback.
    item_calls = defaultdict(list)
    for call, _grouping, item_id, score in matched:
        if score >= 0.60:
            item_calls[item_id].append((score, call))

    # High-confidence matches for routing accuracy (threshold >= 0.65)
    high_conf_matches = [
        (call, item_id, score)
        for call, _grouping, item_id, score in matched
        if score >= 0.65
    ]

    # ── Write vision-call-invocation-metrics.tsv ─────────────────────────
    item_rows = []
    for (grouping, item_id), grade_info in sorted(grades.items()):
        grade = grade_info["grade"]
        condition = grade_info["condition"]
        deficiency = checklist_text.get((grouping, item_id), "")

        item_findings = findings_by_item.get((grouping, item_id), [])

        # vision_check was called for this item iff at least one
        # vision-check-calls/<id>/metadata.json recorded
        # `inputs.checklistItemId == "<grouping>:<item_id>"`. We use that
        # directly rather than relying on the agent's self-reported
        # `tools_used` field — different runs sometimes label the tool
        # "vision_check" (run 3) vs just "vision" (run 4) depending on
        # how the agent describes its action. The metadata.json record
        # is what conductor wrote at the call site, so it's authoritative.
        calls_for_item = item_calls.get(item_id, [])
        vc_called = bool(calls_for_item)
        if vc_called and calls_for_item:
            routes = [c["problemType"] for _, c in calls_for_item]
            specialists = [c["specialistCalled"] for _, c in calls_for_item]
            fallbacks = [c.get("fallbackReason") or "" for _, c in calls_for_item]
            actual = f"vision_check ({routes[0]} -> {specialists[0]})"
            if fallbacks[0]:
                actual += " [FALLBACK]"
        elif vc_called:
            actual = "vision_check (routing unknown)"
        else:
            actual = "not called"

        statuses = [f.get("status", "") for f in item_findings]
        status = statuses[0] if statuses else ""

        item_rows.append({
            "checklist_item_id": f"{grouping}:{item_id}",
            "checklist_item_deficiency_text": deficiency,
            "grade": grade,
            "condition": condition,
            "expected_vision_tool_call": _expected_tool(grade),
            "actual_vision_tool_call": actual,
            "finding_status": status,
        })

    metrics_path = HERE / "vision-call-invocation-metrics.tsv"
    with metrics_path.open("w") as out:
        w = csv.DictWriter(out, fieldnames=item_rows[0].keys(), delimiter="\t")
        w.writeheader()
        w.writerows(item_rows)

    # ── Write vision-check-calls-audit.tsv ───────────────────────────────
    audit_rows = []
    for call, grouping_match, item_id, score in matched:
        # Prefer the grouping from the exact-id path; fall back to the
        # grades index for fuzzy-matched calls.
        grouping = grouping_match or item_to_grouping.get(item_id, "")
        grade_info = grades.get((grouping, item_id), {})
        audit_rows.append({
            "callId": call["callId"],
            "matched_item_id": f"{grouping}:{item_id}" if grouping else (item_id or ""),
            "match_score": f"{score:.2f}",
            "match_method": "exact" if score == 1.0 else "fuzzy",
            "matched_grade": grade_info.get("grade", ""),
            "classifier_route": call["problemType"],
            "classifier_confidence": call["classifierConfidence"],
            "classifier_reasoning": call["classifierReasoning"],
            "specialist": call["specialistCalled"],
            "dispatch_success": call["dispatchSuccess"],
            "fallback_reason": call.get("fallbackReason", ""),
            "checklist_text_preview": call["checklistItemText"][:100],
            "agent_question_preview": call.get("question", "")[:100],
        })

    audit_path = HERE / "vision-check-calls-audit.tsv"
    with audit_path.open("w") as out:
        w = csv.DictWriter(out, fieldnames=audit_rows[0].keys(), delimiter="\t")
        w.writeheader()
        w.writerows(audit_rows)

    # ── Print summary stats ──────────────────────────────────────────────
    print("=" * 72)
    print("VISION-CHECK EXPERIMENT — CC ANALYSIS")
    print("=" * 72)
    print(f"\nDataset: {len(grades)} classified items, {len(findings)} findings, {len(calls)} vision-check calls")
    print(f"Wrote {metrics_path.name} ({len(item_rows)} rows)")
    print(f"Wrote {audit_path.name} ({len(audit_rows)} rows)")

    # Headline recall — sourced from item_calls (= unique item_ids in
    # the vision-check-calls metadata), not from the agent's self-reported
    # tools_used. See note in the metrics-tsv loop above.
    grade_stats = defaultdict(lambda: {"total": 0, "called": 0, "items_called": [], "items_not_called": []})
    for (grouping, item_id), grade_info in sorted(grades.items()):
        grade = grade_info["grade"]
        called = bool(item_calls.get(item_id))
        grade_stats[grade]["total"] += 1
        if called:
            grade_stats[grade]["called"] += 1
            grade_stats[grade]["items_called"].append(f"{grouping}/{item_id}")
        else:
            grade_stats[grade]["items_not_called"].append(f"{grouping}/{item_id}")

    print("\n── HEADLINE RECALL (vision_check called per ground-truth grade) ──")
    print(f"{'Grade':<28s} {'Called':>6s} / {'Total':>5s}   {'Rate':>6s}")
    print("-" * 55)
    should_call_total = 0
    should_call_called = 0
    for grade in ["inspect-drawing-required", "inspect-drawing-optional", "vision-only", "no-tool"]:
        s = grade_stats[grade]
        rate = 100 * s["called"] / s["total"] if s["total"] else 0
        print(f"  {grade:<26s} {s['called']:>6d} / {s['total']:>5d}   {rate:>5.1f}%")
        if grade in ("inspect-drawing-required", "inspect-drawing-optional", "vision-only"):
            should_call_total += s["total"]
            should_call_called += s["called"]
    headline_recall = 100 * should_call_called / should_call_total if should_call_total else 0
    print("-" * 55)
    print(f"  {'SHOULD-CALL (req+opt+vis)':<26s} {should_call_called:>6d} / {should_call_total:>5d}   {headline_recall:>5.1f}%")
    no_tool = grade_stats["no-tool"]
    misuse_rate = 100 * no_tool["called"] / no_tool["total"] if no_tool["total"] else 0
    print(f"\n  MISUSE (no-tool items called): {no_tool['called']}/{no_tool['total']} = {misuse_rate:.1f}%")

    # Required items detail
    print("\n── INSPECT-DRAWING-REQUIRED ITEMS (must-hit) ──")
    req = grade_stats["inspect-drawing-required"]
    print(f"  Called ({len(req['items_called'])}): {', '.join(req['items_called'])}")
    print(f"  Missed ({len(req['items_not_called'])}): {', '.join(req['items_not_called'])}")

    # Routing distribution
    print(f"\n── CLASSIFIER ROUTING DISTRIBUTION ({len(calls)} calls) ──")
    for route, count in sorted(Counter(c["problemType"] for c in calls).items(), key=lambda x: -x[1]):
        print(f"  classifier -> {route}: {count}")
    print()
    for spec, count in sorted(Counter(c["specialistCalled"] for c in calls).items(), key=lambda x: -x[1]):
        print(f"  specialist dispatched -> {spec}: {count}")

    # Routing accuracy confusion matrix
    print(f"\n── ROUTING ACCURACY (calls matched to ground truth, threshold ≥ 0.65) ──")
    confusion = defaultdict(lambda: defaultdict(int))
    low_conf = [(c, i, s) for c, _g, i, s in matched if s < 0.65]
    print(f"  Matched: {len(high_conf_matches)}/{len(calls)} calls (≥0.65 similarity)")
    print(f"  Unmatched: {len(low_conf)} calls (<0.65 similarity)")
    for call, item_id, score in high_conf_matches:
        grouping = item_to_grouping.get(item_id)
        if not grouping:
            continue
        grade_info = grades.get((grouping, item_id))
        if not grade_info:
            continue
        expected_route = GRADE_TO_ROUTE.get(grade_info["grade"], "unknown")
        confusion[expected_route or "none"][call["problemType"]] += 1
    all_routes = sorted(set(list(confusion.keys()) + [r for row in confusion.values() for r in row]))
    header = f"  {'expected':<20s}" + "".join(f"{r:>16s}" for r in all_routes) + f"{'total':>8s}"
    print(f"\n{header}")
    print("  " + "-" * (len(header) - 2))
    for expected in all_routes:
        row_total = sum(confusion[expected].values())
        cells = "".join(f"{confusion[expected][actual]:>16d}" for actual in all_routes)
        print(f"  {expected:<20s}{cells}{row_total:>8d}")
    print(f"\n  Per-route accuracy:")
    for expected in all_routes:
        row_total = sum(confusion[expected].values())
        correct = confusion[expected].get(expected, 0)
        acc = 100 * correct / row_total if row_total else 0
        print(f"    {expected}: {correct}/{row_total} = {acc:.1f}%")

    # Classifier confidence
    confs = [c["classifierConfidence"] for c in calls]
    print(f"\n── CLASSIFIER CONFIDENCE ──")
    print(f"  mean: {sum(confs)/len(confs):.3f}, min: {min(confs):.2f}, max: {max(confs):.2f}")

    # Dispatch analysis
    fallbacks = [c for c in calls if c.get("fallbackReason")]
    print(f"\n── DISPATCH ──")
    print(f"  Total: {len(calls)}, successes: {sum(1 for c in calls if c['dispatchSuccess'])}, fallbacks: {len(fallbacks)}")
    if fallbacks:
        reasons = Counter(c["fallbackReason"] for c in fallbacks)
        for reason, count in reasons.most_common():
            print(f"    {reason}: {count}")


if __name__ == "__main__":
    main()
