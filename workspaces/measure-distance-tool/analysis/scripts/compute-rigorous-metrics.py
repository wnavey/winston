#!/usr/bin/env python3
"""Compute rigorous per-(item × run) measure-distance metrics for one or all experiment runs.

Methodology:
- Numerator: distinct (run × deficiency_id) cells where the agent made AT LEAST ONE
  measure-distance call. Multiple internal pair-calls for the same item count once.
- Denominator: every (item × run) cell in the corpus, optionally filtered by
  classification (should_call=yes for recall, should_call=no for misuse).

Per-call attribution is read from `applicableChecklistItems` in each pair-level
metadata.json. Available from experiment-run4 onward; earlier runs only have
`checklistItem` (the .md file), which lets us compute agent-session-level recall
but not per-deficiency-id recall.

Usage:
  ./compute-rigorous-metrics.py                           # process all runs with call data
  ./compute-rigorous-metrics.py --run experiment-run7     # single run
  ./compute-rigorous-metrics.py --guide-set el-md-exp     # different guide set (future)

Outputs to ../rigorous-metrics/<run-id>.{md,json}.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ANALYSIS = HERE.parent
WORKSPACE = ANALYSIS.parent
RUNS_ROOT = WORKSPACE / "runs"
CLASSIFICATION_PATHS = {
    "el-md-exp": ANALYSIS / "guides" / "el-md-exp" / "item-classification.json",
}


def load_classification(guide_set: str) -> dict:
    p = CLASSIFICATION_PATHS[guide_set]
    return json.loads(p.read_text())


def discover_runs(guide_set: str) -> list[Path]:
    """Find every experiment-run* directory with a measure-distance-calls/ folder."""
    runs: list[Path] = []
    for version_dir in sorted(RUNS_ROOT.iterdir()):
        if not version_dir.is_dir():
            continue
        guide_dir = version_dir / guide_set
        if not guide_dir.is_dir():
            continue
        for run_dir in sorted(guide_dir.iterdir()):
            if not run_dir.is_dir():
                continue
            if not run_dir.name.startswith("experiment-run"):
                continue
            if not (run_dir / "measure-distance-calls").is_dir():
                continue
            runs.append(run_dir)
    return runs


def is_pair_dir_name(name: str) -> bool:
    """Pair-level dirs end in -p<N>; session-level dirs do not."""
    parts = name.rsplit("-", 1)
    return len(parts) == 2 and parts[1].startswith("p") and parts[1][1:].isdigit()


def collect_calls(run_dir: Path) -> dict:
    """Walk measure-distance-calls/ and return a structured summary.

    Returns: {
      'pair_calls': [...],         # per-pair metadata records (dict)
      'session_calls': [...],      # session-level dirs (no metadata.json)
      'has_attribution': bool,     # True if any pair has applicableChecklistItems
      'total_pair_dirs': int,
      'total_session_dirs': int,
    }
    """
    calls_dir = run_dir / "measure-distance-calls"
    pair_calls: list[dict] = []
    session_calls: list[dict] = []
    has_attribution = False

    for sub in sorted(calls_dir.iterdir()):
        if not sub.is_dir():
            continue
        meta_path = sub / "metadata.json"
        if not meta_path.exists():
            session_calls.append({"dir": sub.name})
            continue
        try:
            m = json.loads(meta_path.read_text())
        except Exception:
            continue
        applicable = m.get("applicableChecklistItems") or []
        record = {
            "dir": sub.name,
            "is_pair": is_pair_dir_name(sub.name),
            "runIndex": m.get("runIndex"),
            "checklistItem": m.get("checklistItem"),
            "pairIndex": m.get("pairIndex"),
            "applicable": [it.get("checklist_id") for it in applicable if it.get("checklist_id")],
            "objectA": (m.get("inputs") or {}).get("objectA"),
            "objectB": (m.get("inputs") or {}).get("objectB"),
            "result_distance_ft": (m.get("result") or {}).get("distance_ft"),
            "elapsed_ms": m.get("elapsedMs"),
        }
        if applicable:
            has_attribution = True
        if record["is_pair"]:
            pair_calls.append(record)
        else:
            session_calls.append(record)

    return {
        "pair_calls": pair_calls,
        "session_calls": session_calls,
        "has_attribution": has_attribution,
        "total_pair_dirs": len(pair_calls),
        "total_session_dirs": len(session_calls),
    }


def discover_run_indices(run_dir: Path) -> list[str]:
    """Return list of run-N directories under run_dir."""
    runs: list[str] = []
    for sub in sorted(run_dir.iterdir()):
        if sub.is_dir() and sub.name.startswith("run-"):
            runs.append(sub.name)
    return runs


def build_metrics(run_dir: Path, guide_set: str) -> dict:
    classification = load_classification(guide_set)
    items = classification["items"]  # deficiency_id -> {classification, shouldCall, ...}
    run_indices = discover_run_indices(run_dir) or ["run-1", "run-2", "run-3"]
    calls = collect_calls(run_dir)
    pair_calls = calls["pair_calls"]

    # Per-(run, deficiency_id) call count from pair-level applicableChecklistItems
    cell_calls: dict[tuple[str, str], int] = defaultdict(int)
    # Per-(run, deficiency_id) "no-only" calls: pair-calls whose applicable list
    # contained ONLY should_call=no items. Used to distinguish real misuse from
    # over-tag-induced misuse.
    cell_no_only_calls: dict[tuple[str, str], int] = defaultdict(int)
    # Per-(run, item_md) — useful for runs without per-deficiency attribution
    session_calls: dict[tuple[str, str], int] = defaultdict(int)

    for c in pair_calls:
        run = c["runIndex"]
        item_md = c["checklistItem"]
        if run and item_md:
            session_calls[(run, item_md)] += 1
        # Classify the pair-call by whether any applicable item is should_call=yes
        applicable_classes = [items.get(d, {}).get("shouldCall", "?") for d in c["applicable"]]
        is_no_only = bool(c["applicable"]) and all(s == "no" for s in applicable_classes)
        for did in c["applicable"]:
            if run:
                cell_calls[(run, did)] += 1
                if is_no_only:
                    cell_no_only_calls[(run, did)] += 1

    # If pair-level attribution is missing, fall back to session-level counts using
    # session-level dir names (which carry runIndex but not deficiency ids).
    if not calls["has_attribution"]:
        for c in calls["session_calls"]:
            d = c.get("dir") or ""
            # naming pattern: <ts>-<sid>-run-<N>-<groupingNumber>
            parts = d.split("-")
            try:
                run_idx = parts.index("run") + 1
                run = f"run-{parts[run_idx]}"
                grouping_num = parts[run_idx + 1]
                item_md = f"{grouping_num}.md"
                session_calls[(run, item_md)] += 1
            except (ValueError, IndexError):
                pass

    # Compute per-(item × run) coverage by classification + shouldCall
    by_should: dict[str, dict] = {
        "yes": {"opportunities": 0, "hits": 0, "items": []},
        "no": {"opportunities": 0, "hits": 0, "real_hits": 0, "items": []},
    }
    by_classification: dict[str, dict] = defaultdict(lambda: {"opportunities": 0, "hits": 0})
    by_subclass: dict[str, dict] = defaultdict(lambda: {"opportunities": 0, "hits": 0})
    per_run_recall: dict[str, dict] = {r: {"opportunities": 0, "hits": 0} for r in run_indices}

    for did, item in items.items():
        sc = item["shouldCall"]
        cls = item["classification"]
        sub = item.get("subClassification") or "(none)"
        for run in run_indices:
            n_calls = cell_calls.get((run, did), 0)
            n_no_only = cell_no_only_calls.get((run, did), 0)
            hit = 1 if n_calls > 0 else 0
            real_misuse_hit = 1 if (sc == "no" and n_no_only > 0) else 0
            by_should[sc]["opportunities"] += 1
            by_should[sc]["hits"] += hit
            if sc == "no":
                by_should[sc]["real_hits"] += real_misuse_hit
            by_classification[cls]["opportunities"] += 1
            by_classification[cls]["hits"] += hit
            by_subclass[sub]["opportunities"] += 1
            by_subclass[sub]["hits"] += hit
            if sc == "yes":
                per_run_recall[run]["opportunities"] += 1
                per_run_recall[run]["hits"] += hit
            by_should[sc].setdefault("cells", []).append({
                "run": run, "deficiency_id": did, "classification": cls,
                "subClassification": sub, "calls": n_calls,
                "no_only_calls": n_no_only if sc == "no" else None,
            })

    # Headline numbers
    yes = by_should["yes"]
    no = by_should["no"]
    recall = (yes["hits"] / yes["opportunities"]) if yes["opportunities"] else 0.0
    # Misuse uses "real_hits" — only cells with at least one no-only call
    # (a pair-call whose applicable list had no should_call=yes items).
    misuse = (no["real_hits"] / no["opportunities"]) if no["opportunities"] else 0.0
    misuse_inflated = (no["hits"] / no["opportunities"]) if no["opportunities"] else 0.0

    # Did the same call serve >1 item? Check for inflation from over-tagging.
    over_tagged_misuse_calls = 0
    for c in pair_calls:
        applicable_classes = [items.get(d, {}).get("shouldCall", "?") for d in c["applicable"]]
        # if any of the applicable items is should_call=no but at least one is should_call=yes,
        # the call is "real but over-tagged"
        if "no" in applicable_classes and "yes" in applicable_classes:
            over_tagged_misuse_calls += 1

    return {
        "run_id": run_dir.name,
        "version": run_dir.parent.parent.name,
        "guide_set": guide_set,
        "total_items": len(items),
        "run_indices": run_indices,
        "calls_summary": {
            "pair_call_dirs": calls["total_pair_dirs"],
            "session_call_dirs": calls["total_session_dirs"],
            "has_per_call_attribution": calls["has_attribution"],
        },
        "headline": {
            "recall": round(recall, 4),
            "recall_hits": yes["hits"],
            "recall_opportunities": yes["opportunities"],
            "misuse": round(misuse, 4),
            "misuse_hits": no["real_hits"],
            "misuse_opportunities": no["opportunities"],
            "misuse_inflated": round(misuse_inflated, 4),
            "misuse_inflated_hits": no["hits"],
            "misuse_note": (
                "Real misuse: cells where at least one pair-call's applicableChecklistItems "
                "list contained ONLY should_call=no items. Inflated count includes cells where "
                "the call legitimately tagged a should_call=yes item but ALSO over-tagged a "
                "should_call=no item."
            ),
        },
        "by_classification": {
            k: {**v, "rate": round(v["hits"] / v["opportunities"], 4) if v["opportunities"] else 0.0}
            for k, v in by_classification.items()
        },
        "by_subclass": {
            k: {**v, "rate": round(v["hits"] / v["opportunities"], 4) if v["opportunities"] else 0.0}
            for k, v in by_subclass.items()
        },
        "per_run_recall": {
            r: {**v, "rate": round(v["hits"] / v["opportunities"], 4) if v["opportunities"] else 0.0}
            for r, v in per_run_recall.items()
        },
        "diagnostics": {
            "over_tagged_calls": over_tagged_misuse_calls,
            "over_tagged_calls_note": (
                "Calls where applicableChecklistItems lists both should_call=yes and should_call=no items. "
                "Real misuse rate is 0 if every misuse hit traces back to a call also tagging a should_call=yes item."
            ),
        },
    }


def render_md(metrics: dict) -> str:
    h = metrics["headline"]
    cs = metrics["calls_summary"]
    out: list[str] = []
    out.append(f"# Rigorous metrics — `{metrics['run_id']}` ({metrics['guide_set']})")
    out.append("")
    out.append(f"**Version:** `{metrics['version']}`  ")
    out.append(f"**Total items in classification:** {metrics['total_items']}  ")
    out.append(f"**Runs:** {', '.join(metrics['run_indices'])}  ")
    out.append(f"**Per-call attribution available:** {'yes' if cs['has_per_call_attribution'] else 'no'}  ")
    out.append(f"**Pair-level call dirs:** {cs['pair_call_dirs']}  ")
    out.append(f"**Session-level call dirs (no metadata):** {cs['session_call_dirs']}  ")
    out.append("")

    if not cs["has_per_call_attribution"]:
        out.append("> ⚠️ **Limitation:** This run predates per-call `applicableChecklistItems` attribution. "
                   "Item-level recall cannot be computed — only agent-session-level. Numbers below "
                   "reflect classification opportunities but the hit count is 0 because we cannot "
                   "attribute calls to specific deficiency ids. See `compute-rigorous-metrics.py` "
                   "or look at the legacy phase-1-cross-run-metrics.md for agent-session numbers.")
        out.append("")

    out.append("## Headline (binary should-call framing)")
    out.append("")
    out.append("| Metric | Hits | Opportunities | Rate |")
    out.append("|---|---:|---:|---:|")
    out.append(f"| **Recall** (should_call=yes) | {h['recall_hits']} | {h['recall_opportunities']} | "
               f"**{h['recall']*100:.1f}%** |")
    out.append(f"| **Misuse** (should_call=no, real) | {h['misuse_hits']} | {h['misuse_opportunities']} | "
               f"**{h['misuse']*100:.1f}%** |")
    out.append(f"| Misuse — inflated (incl. over-tag) | {h['misuse_inflated_hits']} | "
               f"{h['misuse_opportunities']} | {h['misuse_inflated']*100:.1f}% |")
    out.append("")
    out.append(
        "Real misuse counts cells where at least one pair-call's `applicableChecklistItems` "
        "list contained ONLY `should_call=no` items — i.e., the agent invoked MD specifically "
        "for an item that shouldn't have triggered the tool. Inflated misuse also counts cells "
        "where MD was legitimately invoked for a `should_call=yes` item and the agent "
        "over-attached a `should_call=no` item to the same call's tag list."
    )
    out.append("")

    out.append("## Per-run recall")
    out.append("")
    out.append("| Run | Hits | Opportunities | Rate |")
    out.append("|---|---:|---:|---:|")
    for r, v in metrics["per_run_recall"].items():
        out.append(f"| {r} | {v['hits']} | {v['opportunities']} | {v['rate']*100:.1f}% |")
    out.append("")

    out.append("## By classification (diagnostic drill-down)")
    out.append("")
    out.append("| Classification | Hits | Opportunities | Rate |")
    out.append("|---|---:|---:|---:|")
    order = ["horizontal", "not-applicable", "vertical-or-mixed"]
    for k in order:
        v = metrics["by_classification"].get(k)
        if v is None:
            continue
        out.append(f"| `{k}` | {v['hits']} | {v['opportunities']} | {v['rate']*100:.1f}% |")
    out.append("")

    out.append("### Sub-classification (horizontal items only)")
    out.append("")
    out.append("| Subclass | Hits | Opportunities | Rate |")
    out.append("|---|---:|---:|---:|")
    for k in ("distance-only", "distance-plus"):
        v = metrics["by_subclass"].get(k)
        if v is None:
            continue
        out.append(f"| `{k}` | {v['hits']} | {v['opportunities']} | {v['rate']*100:.1f}% |")
    out.append("")

    diag = metrics["diagnostics"]
    if diag["over_tagged_calls"] > 0:
        out.append("## Diagnostic — over-tagged calls")
        out.append("")
        out.append(f"{diag['over_tagged_calls']} pair-call(s) tagged both `should_call=yes` and "
                   "`should_call=no` items in `applicableChecklistItems`. These are not tool misuse — "
                   "the call legitimately measured a horizontal-item pair, but the agent over-attached "
                   "tags. They inflate the misuse hit count without representing real misuse.")
        out.append("")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", help="Single run directory name (e.g. experiment-run7)")
    parser.add_argument("--guide-set", default="el-md-exp")
    args = parser.parse_args()

    runs = discover_runs(args.guide_set)
    if args.run:
        runs = [r for r in runs if r.name == args.run]
        if not runs:
            print(f"No matching run found for {args.run}", file=sys.stderr)
            return 1

    out_dir = ANALYSIS / "rigorous-metrics"
    out_dir.mkdir(parents=True, exist_ok=True)

    summary_rows: list[dict] = []
    for run_dir in runs:
        metrics = build_metrics(run_dir, args.guide_set)
        run_id = metrics["run_id"]
        (out_dir / f"{run_id}.json").write_text(json.dumps(metrics, indent=2))
        (out_dir / f"{run_id}.md").write_text(render_md(metrics))
        summary_rows.append({
            "run": run_id,
            "version": metrics["version"],
            "has_attribution": metrics["calls_summary"]["has_per_call_attribution"],
            "pair_dirs": metrics["calls_summary"]["pair_call_dirs"],
            "recall": metrics["headline"]["recall"],
            "recall_hits": metrics["headline"]["recall_hits"],
            "recall_opp": metrics["headline"]["recall_opportunities"],
            "misuse": metrics["headline"]["misuse"],
            "misuse_hits": metrics["headline"]["misuse_hits"],
            "misuse_opp": metrics["headline"]["misuse_opportunities"],
            "distance_only_rate": metrics["by_subclass"].get("distance-only", {}).get("rate", 0.0),
            "distance_plus_rate": metrics["by_subclass"].get("distance-plus", {}).get("rate", 0.0),
        })
        h = metrics["headline"]
        print(f"{run_id}: recall={h['recall']*100:.1f}% "
              f"({h['recall_hits']}/{h['recall_opportunities']})  "
              f"misuse={h['misuse']*100:.1f}% "
              f"({h['misuse_hits']}/{h['misuse_opportunities']})  "
              f"attribution={metrics['calls_summary']['has_per_call_attribution']}")

    # Cross-run summary
    summary = {"runs": summary_rows}
    (out_dir / "cross-run-summary.json").write_text(json.dumps(summary, indent=2))

    md = ["# Cross-run rigorous metrics — el-md-exp",
          "",
          "Single source of truth comparing every experiment run on the same per-(item × run) framing.",
          "",
          "**Source guide set:** `el-md-exp` (EL guides 1, 2, 13 — 101 items: 51 horizontal "
          "[36 distance-only + 15 distance-plus], 28 not-applicable, 22 vertical-or-mixed)",
          "",
          "**Methodology:** binary should-call grade per item × run-index. Recall = % of "
          "should-call cells where the agent made ≥1 measure-distance call. Misuse = % of "
          "should-not-call cells where the agent made a call. Per-deficiency-id attribution "
          "from `applicableChecklistItems` in pair-level `metadata.json`. Multiple internal "
          "pair-calls for the same item count once. See "
          "[`scripts/compute-rigorous-metrics.py`](../scripts/compute-rigorous-metrics.py).",
          "",
          "**Why this replaces the legacy phase-1 metrics:** the prior `phase-1-*-metrics.md` "
          "docs reported recall as high as 46% on distance-only items, but used "
          "(a) agent-session-level attribution (any call by an agent counted every eligible "
          "item in that session as 'invoked') and (b) a much smaller denominator (≈26 instead "
          "of 108). The rigorous framing here counts only the cells where the agent actually "
          "tagged the deficiency_id. See the [methodology section](#methodology) below.",
          "",
          "## Headline",
          "",
          "| Run | Pair dirs | Attr | Recall | Misuse (real) | distance-only | distance-plus |",
          "|---|---:|:---:|---:|---:|---:|---:|"]
    for r in summary_rows:
        attr = "✅" if r["has_attribution"] else "❌"
        if r["has_attribution"]:
            md.append(
                f"| `{r['run']}` | {r['pair_dirs']} | {attr} | "
                f"{r['recall']*100:.1f}% ({r['recall_hits']}/{r['recall_opp']}) | "
                f"{r['misuse']*100:.1f}% ({r['misuse_hits']}/{r['misuse_opp']}) | "
                f"{r['distance_only_rate']*100:.1f}% | "
                f"{r['distance_plus_rate']*100:.1f}% |"
            )
        else:
            md.append(
                f"| `{r['run']}` | {r['pair_dirs']} | {attr} | n/a | n/a | n/a | n/a |"
            )
    md.append("")
    md.append("Runs with `Attr ❌` predate per-call `applicableChecklistItems` attribution; "
              "rigorous per-(item × run) recall is unanswerable for them. Agent-session-level "
              "numbers for those runs live in the legacy "
              "[`../phase-1-cross-run-metrics.md`](../phase-1-cross-run-metrics.md).")
    md.append("")
    md.append("## Per-run detail")
    md.append("")
    for r in summary_rows:
        md.append(f"- [`{r['run']}`](./{r['run']}.md)")
    md.append("")
    md.append("## Methodology")
    md.append("")
    md.append("Three reasons the rigorous framing differs from the legacy phase-1 metrics:")
    md.append("")
    md.append("1. **Numerator: per-(deficiency × run) cells, not agent-sessions.** Legacy "
              "metrics counted any agent that made ≥1 call as having 'invoked' MD on every "
              "eligible item in that session. Here we only count the specific deficiency_ids "
              "the agent tagged in `applicableChecklistItems`.")
    md.append("2. **Denominator: every horizontal × run cell, not a baseline-NV subset.** "
              "Legacy metrics filtered the denominator to items whose baseline verdict was "
              "`not-verifiable` (the conversion-eligible subset). The rigorous denominator is "
              "every horizontal item × every run-index, regardless of baseline verdict.")
    md.append("3. **Misuse separates real from over-tag.** A pair-call can list multiple "
              "deficiencies in `applicableChecklistItems`. If the call legitimately measured "
              "a `should_call=yes` item and the agent over-attached a `should_call=no` item "
              "to the same call, that's not real misuse. Real misuse only counts cells where "
              "at least one pair-call had ONLY `should_call=no` items in its applicable list.")
    md.append("")
    md.append("**Pair-call collapse:** if measure-distance produces N internal pair-calls for "
              "a single agent-tool invocation (e.g. measuring 5 trees against an OHE for one "
              "checklist item), all N count as one hit on that (item × run) cell.")
    md.append("")
    (out_dir / "README.md").write_text("\n".join(md))

    print(f"\nWrote {len(runs)} per-run reports + cross-run-summary.{{json,md}} to {out_dir.relative_to(WORKSPACE.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
