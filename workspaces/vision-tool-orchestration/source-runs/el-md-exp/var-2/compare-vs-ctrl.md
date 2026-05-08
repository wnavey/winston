# RUN_6_BACKUP_LOCAL vs ctrl — verdict comparison

Restricted to items where measure-distance ran successfully (≥1 pair returned a distance) in RUN_6_BACKUP_LOCAL. ctrl is el-md-exp baseline (runs=3, no measure-distance, no vision_check — agent has only generic `vision`). RUN_6 is runs=1 with the full var-2 chain (vision_check → extract-measurement-pairs → measure-distance) post bureau#324 + conductor#154.

## Headline

- **Items where measure-distance succeeded in RUN_6:** 8
- **Items where ctrl was *majority* `not-verifiable` AND RUN_6 produced a real verdict:** 6 (4 pass, 2 fail)
- **Items where ctrl was *unanimous* `not-verifiable` AND RUN_6 produced a real verdict (stricter):** 3

## Per-item verdict comparison

Moved column: ✓ = ctrl was unanimously `not-verifiable` (3/3 runs); ◐ = ctrl was majority `not-verifiable` but at least one run dissented; — = ctrl had a stable verdict already, or RUN_6 also said `not-verifiable`.

| Item | ctrl (runs=3 majority) | ctrl distribution | RUN_6 status | Moved | Pairs measured |
|---|---|---|---|:---:|---:|
| `EL-1.1` | `not-verifiable` | not-verifiable:3 | `pass` | ✓ | 2 |
| `EL-1.14` | `not-verifiable` | not-verifiable:3 | `fail` | ✓ | 1 |
| `EL-1.37` | `not-verifiable` | not-verifiable:2,fail:1 | `fail` | ◐ | 4 |
| `EL-1.8` | `fail` | fail:2,not-verifiable:1 | `fail` | — | 6 |
| `EL-1.9` | `not-verifiable` | not-verifiable:2,n/a:1 | `pass` | ◐ | 2 |
| `EL-13.10` | `not-verifiable` | not-verifiable:2,fail:1 | `pass` | ◐ | 5 |
| `EL-13.12` | `not-verifiable` | not-verifiable:3 | `pass` | ✓ | 2 |
| `EL-13.13` | `not-verifiable` | not-verifiable:3 | `not-verifiable` | — | 2 |

## Sample distances (RUN_6, top items)

### `EL-1.1` — RUN_6 verdict: `pass` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| South wall of Bldg. 8 | OHE line running along the southern boundary | 25.3 | medium |
| South wall of Bldg. 7 | OHE line running along the southern boundary | 29.7 | medium |

### `EL-1.14` — RUN_6 verdict: `fail` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Concrete retaining wall running along the south property line | OHE (overhead electric) line running parallel to the south property line | 1.0 | medium |

### `EL-1.37` — RUN_6 verdict: `fail` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| proposed mitigation tree (labeled 'M') in the southwest corner | overhead electric (OHE) line on the southern boundary | 2.4 | medium |
| westernmost proposed mitigation tree (labeled 'M') in the southeast corner clust | overhead electric (OHE) line on the southern boundary | 0.9 | medium |
| middle proposed mitigation tree (labeled 'M' with wavy outline) in the southeast | overhead electric (OHE) line on the southern boundary | 3.9 | medium |

### `EL-1.8` — RUN_6 verdict: `fail` (ctrl: `fail`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| OHE (overhead electric) line along the western boundary | westernmost edge of Building 1 | 88.5 | medium |
| OHE (overhead electric) line along the western boundary | westernmost edge of Building 2 | 128.0 | medium |
| OHE (overhead electric) line along the western boundary | westernmost edge of Building 8 | 125.2 | medium |

### `EL-1.9` — RUN_6 verdict: `pass` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Sidewalk Easement Fence near the northwest corner | OHE line on the western boundary | 47.0 | medium |
| Crete Fence on the southern boundary | OHE line on the southern boundary | 14.4 | medium |

### `EL-13.10` — RUN_6 verdict: `pass` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad located west of Bldg. 1 | West exterior wall of Bldg. 1 | 34.6 | medium |
| Electrical Transformer Pad located west of Bldg. 2 | West exterior wall of Bldg. 2 | 14.3 | medium |
| Electrical Transformer Pad located west of Bldg. 8 | West exterior wall of Bldg. 8 | 13.3 | medium |

### `EL-13.12` — RUN_6 verdict: `pass` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Transformer pad labeled 'Transformer Pad (Typ.)' west of Bldg 8 | Fire hydrant labeled 'FH' southeast of Bldg 7 near the driveway curve | 275.6 | medium |
| Transformer pad labeled 'Transformer Pad (Typ.)' west of Bldg 8 | Fire hydrant located on the eastern property line, east of Bldg 5 | 387.0 | medium |

### `EL-13.13` — RUN_6 verdict: `not-verifiable` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| equipment pad (transformer) in the shaded area in the southwest corner of the si | tree immediately north of the southwest equipment pad | 10.2 | medium |
| equipment pad (transformer) in the shaded area in the southwest corner of the si | tree immediately south of the southwest equipment pad | 21.1 | medium |

