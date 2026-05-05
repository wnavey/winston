# Rigorous metrics — `experiment-run3` (el-md-exp)

**Version:** `v5.0`  
**Total items in classification:** 101  
**Runs:** run-1, run-2, run-3  
**Per-call attribution available:** no  
**Pair-level call dirs:** 10  
**Session-level call dirs (no metadata):** 16  

> ⚠️ **Limitation:** This run predates per-call `applicableChecklistItems` attribution. Item-level recall cannot be computed — only agent-session-level. Numbers below reflect classification opportunities but the hit count is 0 because we cannot attribute calls to specific deficiency ids. See `compute-rigorous-metrics.py` or look at the legacy phase-1-cross-run-metrics.md for agent-session numbers.

## Headline (binary should-call framing)

| Metric | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| **Recall** (should_call=yes) | 0 | 153 | **0.0%** |
| **Misuse** (should_call=no, real) | 0 | 150 | **0.0%** |
| Misuse — inflated (incl. over-tag) | 0 | 150 | 0.0% |

Real misuse counts cells where at least one pair-call's `applicableChecklistItems` list contained ONLY `should_call=no` items — i.e., the agent invoked MD specifically for an item that shouldn't have triggered the tool. Inflated misuse also counts cells where MD was legitimately invoked for a `should_call=yes` item and the agent over-attached a `should_call=no` item to the same call's tag list.

## Per-run recall

| Run | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| run-1 | 0 | 51 | 0.0% |
| run-2 | 0 | 51 | 0.0% |
| run-3 | 0 | 51 | 0.0% |

## By classification (diagnostic drill-down)

| Classification | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `horizontal` | 0 | 153 | 0.0% |
| `not-applicable` | 0 | 84 | 0.0% |
| `vertical-or-mixed` | 0 | 66 | 0.0% |

### Sub-classification (horizontal items only)

| Subclass | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `distance-only` | 0 | 108 | 0.0% |
| `distance-plus` | 0 | 45 | 0.0% |
