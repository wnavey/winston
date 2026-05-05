# Rigorous metrics — `experiment-run6.2` (el-md-exp)

**Version:** `v5.0`  
**Total items in classification:** 101  
**Runs:** run-1, run-2, run-3  
**Per-call attribution available:** yes  
**Pair-level call dirs:** 22  
**Session-level call dirs (no metadata):** 8  

## Headline (binary should-call framing)

| Metric | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| **Recall** (should_call=yes) | 13 | 153 | **8.5%** |
| **Misuse** (should_call=no, real) | 0 | 150 | **0.0%** |
| Misuse — inflated (incl. over-tag) | 2 | 150 | 1.3% |

Real misuse counts cells where at least one pair-call's `applicableChecklistItems` list contained ONLY `should_call=no` items — i.e., the agent invoked MD specifically for an item that shouldn't have triggered the tool. Inflated misuse also counts cells where MD was legitimately invoked for a `should_call=yes` item and the agent over-attached a `should_call=no` item to the same call's tag list.

## Per-run recall

| Run | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| run-1 | 2 | 51 | 3.9% |
| run-2 | 4 | 51 | 7.8% |
| run-3 | 7 | 51 | 13.7% |

## By classification (diagnostic drill-down)

| Classification | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `horizontal` | 13 | 153 | 8.5% |
| `not-applicable` | 2 | 84 | 2.4% |
| `vertical-or-mixed` | 0 | 66 | 0.0% |

### Sub-classification (horizontal items only)

| Subclass | Hits | Opportunities | Rate |
|---|---:|---:|---:|
| `distance-only` | 5 | 108 | 4.6% |
| `distance-plus` | 8 | 45 | 17.8% |

## Diagnostic — over-tagged calls

7 pair-call(s) tagged both `should_call=yes` and `should_call=no` items in `applicableChecklistItems`. These are not tool misuse — the call legitimately measured a horizontal-item pair, but the agent over-attached tags. They inflate the misuse hit count without representing real misuse.
