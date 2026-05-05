# Rigorous metrics — `experiment-run6` (el-md-exp)

**Version:** `v5.0`  
**Total items in classification:** 101  
**Runs:** run-1, run-2, run-3  
**Per-call attribution available:** yes  
**Pair-level call dirs:** 41  
**Session-level call dirs (no metadata):** 13  

## Headline (binary should-call framing)

| Metric | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| **Recall** (should_call=yes) | 18 | 153 | **11.8%** |
| **Misuse** (should_call=no, real) | 3 | 150 | **2.0%** |
| Misuse — inflated (incl. over-tag) | 4 | 150 | 2.7% |

Real misuse counts cells where at least one pair-call's `applicableChecklistItems` list contained ONLY `should_call=no` items — i.e., the agent invoked MD specifically for an item that shouldn't have triggered the tool. Inflated misuse also counts cells where MD was legitimately invoked for a `should_call=yes` item and the agent over-attached a `should_call=no` item to the same call's tag list.

## Per-run recall

| Run | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| run-1 | 10 | 51 | 19.6% |
| run-2 | 3 | 51 | 5.9% |
| run-3 | 5 | 51 | 9.8% |

## By classification (diagnostic drill-down)

| Classification | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `horizontal` | 18 | 153 | 11.8% |
| `not-applicable` | 1 | 84 | 1.2% |
| `vertical-or-mixed` | 3 | 66 | 4.5% |

### Sub-classification (horizontal items only)

| Subclass | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `distance-only` | 8 | 108 | 7.4% |
| `distance-plus` | 10 | 45 | 22.2% |

## Diagnostic — over-tagged calls

3 pair-call(s) tagged both `should_call=yes` and `should_call=no` items in `applicableChecklistItems`. These are not tool misuse — the call legitimately measured a horizontal-item pair, but the agent over-attached tags. They inflate the misuse hit count without representing real misuse.
