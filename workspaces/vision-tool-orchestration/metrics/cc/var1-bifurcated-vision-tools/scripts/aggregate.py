#!/usr/bin/env python3
"""Aggregate ../per-item-run.tsv → ../per-item.tsv with majority vote.

The majority-vote rule (locked-in 2026-05-07):

  vision was "invoked" for an item if a STRICT majority of that item's
  runs called vision. Ties (e.g. 1/2 runs) fail. Equivalently:
  ``2 * runs_called > runs_total``.

This handles varying run counts across variants (one variant might have
runs=3, another runs=1) without changing the rule.

Output schema (../per-item.tsv):
  item_id, runs_total, runs_called, total_calls, vision_invoked, tool_called

For var1 cc the agent has both ``vision`` and ``inspect-drawing``
exposed; ``tool_called`` ∈ {none, generic-vision, inspect-drawing}.
The post-vote tool reflects whichever value got the most votes among
runs that called *something*; for var1 cc this matters when one run
went to inspect-drawing and another to vision (rare in practice).
"""

import csv
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACE = HERE.parent.parent.parent.parent
IN_TSV = HERE.parent / "per-item-run.tsv"
OUT_TSV = HERE.parent / "per-item.tsv"


def majority(called, total):
    """Strict-majority rule. Ties fail."""
    return 2 * called > total


def main():
    by_item = defaultdict(list)
    with IN_TSV.open() as f:
        for r in csv.DictReader(f, delimiter="\t"):
            by_item[r["item_id"]].append(r)

    rows = []
    for item_id, run_rows in sorted(by_item.items()):
        runs_total = len(run_rows)
        runs_called = sum(1 for r in run_rows if r["tool_called"] != "none")
        total_calls = sum(int(r["call_count"]) for r in run_rows)
        invoked = majority(runs_called, runs_total)

        if invoked:
            # Among calling runs, what tool got the majority vote?
            # ctrl-baseline: only ever 'generic-vision' (single non-none value),
            # so trivial. For richer variants we'll revisit ties.
            tool_votes = defaultdict(int)
            for r in run_rows:
                if r["tool_called"] != "none":
                    tool_votes[r["tool_called"]] += 1
            tool_called = max(tool_votes, key=tool_votes.get)
        else:
            tool_called = "none"

        rows.append({
            "item_id": item_id,
            "runs_total": runs_total,
            "runs_called": runs_called,
            "total_calls": total_calls,
            "vision_invoked": "yes" if invoked else "no",
            "tool_called": tool_called,
        })

    with OUT_TSV.open("w") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["item_id", "runs_total", "runs_called", "total_calls", "vision_invoked", "tool_called"],
            delimiter="\t",
        )
        w.writeheader()
        w.writerows(rows)

    invoked = sum(1 for r in rows if r["vision_invoked"] == "yes")
    print(f"Wrote {OUT_TSV.relative_to(WORKSPACE.parent.parent)} ({len(rows)} rows)")
    print(f"  vision_invoked: yes={invoked}  no={len(rows) - invoked}")


if __name__ == "__main__":
    main()
