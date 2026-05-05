# Rigorous metrics — `experiment-run5` (el-md-exp)

**Version:** `v5.0`  
**Total items in classification:** 101  
**Runs:** run-1, run-2, run-3  
**Per-call attribution available:** yes  
**Pair-level call dirs:** 50  
**Session-level call dirs (no metadata):** 12  

## Headline (binary should-call framing)

| Metric | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| **Recall** (should_call=yes) | 20 | 153 | **13.1%** |
| **Misuse** (should_call=no, real) | 3 | 150 | **2.0%** |
| Misuse — inflated (incl. over-tag) | 4 | 150 | 2.7% |

Real misuse counts cells where at least one pair-call's `applicableChecklistItems` list contained ONLY `should_call=no` items — i.e., the agent invoked MD specifically for an item that shouldn't have triggered the tool. Inflated misuse also counts cells where MD was legitimately invoked for a `should_call=yes` item and the agent over-attached a `should_call=no` item to the same call's tag list.

## Per-run recall

| Run | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| run-1 | 9 | 51 | 17.6% |
| run-2 | 5 | 51 | 9.8% |
| run-3 | 6 | 51 | 11.8% |

## By classification (diagnostic drill-down)

| Classification | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `horizontal` | 20 | 153 | 13.1% |
| `not-applicable` | 1 | 84 | 1.2% |
| `vertical-or-mixed` | 3 | 66 | 4.5% |

### Sub-classification (horizontal items only)

| Subclass | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `distance-only` | 12 | 108 | 11.1% |
| `distance-plus` | 8 | 45 | 17.8% |

## Diagnostic — over-tagged calls

3 pair-call(s) tagged both `should_call=yes` and `should_call=no` items in `applicableChecklistItems`. These are not tool misuse — the call legitimately measured a horizontal-item pair, but the agent over-attached tags. They inflate the misuse hit count without representing real misuse.
