# Rigorous metrics — `experiment-run7.2` (el-md-exp)

**Version:** `v5.0`  
**Total items in classification:** 101  
**Runs:** run-1, run-2, run-3  
**Per-call attribution available:** yes  
**Pair-level call dirs:** 51  
**Session-level call dirs (no metadata):** 11  

## Headline (binary should-call framing)

| Metric | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| **Recall** (should_call=yes) | 20 | 153 | **13.1%** |
| **Misuse** (should_call=no, real) | 3 | 150 | **2.0%** |
| Misuse — inflated (incl. over-tag) | 3 | 150 | 2.0% |

Real misuse counts cells where at least one pair-call's `applicableChecklistItems` list contained ONLY `should_call=no` items — i.e., the agent invoked MD specifically for an item that shouldn't have triggered the tool. Inflated misuse also counts cells where MD was legitimately invoked for a `should_call=yes` item and the agent over-attached a `should_call=no` item to the same call's tag list.

## Per-run recall

| Run | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| run-1 | 6 | 51 | 11.8% |
| run-2 | 7 | 51 | 13.7% |
| run-3 | 7 | 51 | 13.7% |

## By classification (diagnostic drill-down)

| Classification | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `horizontal` | 20 | 153 | 13.1% |
| `not-applicable` | 0 | 84 | 0.0% |
| `vertical-or-mixed` | 3 | 66 | 4.5% |

### Sub-classification (horizontal items only)

| Subclass | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `distance-only` | 10 | 108 | 9.3% |
| `distance-plus` | 10 | 45 | 22.2% |
