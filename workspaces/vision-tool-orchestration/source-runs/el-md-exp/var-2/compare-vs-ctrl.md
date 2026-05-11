# RUN_7_BACKUP_LOCAL_3_RUNS vs ctrl — verdict comparison

Apples-to-apples comparison: both runs are runs=3, both use the strict-majority predicate (2-of-3 runs must agree). Restricted to items where measure-distance ran successfully (≥1 pair returned a distance) on RUN_7.

## Headline

- **Items where measure-distance succeeded in RUN_7:** 15
- **Items where ctrl was *majority* `not-verifiable` AND RUN_7 produced a real verdict (pass/fail):** 4 (3 pass, 0 fail)
- **Items where ctrl was *unanimous* `not-verifiable` AND RUN_7 produced a real verdict (stricter):** 1

## Per-item verdict comparison

Moved column: ✓ = ctrl unanimously `not-verifiable` (3/3 runs); ◐ = ctrl majority `not-verifiable` but at least one run dissented; — = ctrl had a stable non-unverifiable verdict already, or RUN_7 also said `not-verifiable`.

| Item | ctrl majority | ctrl distribution | RUN_7 majority | RUN_7 distribution | Moved | Pairs measured |
|---|---|---|---|---|:---:|---:|
| `EL-1.37` | `not-verifiable` | not-verifiable:2,fail:1 | `not-verifiable` | not-verifiable:2,fail:1 | — | 13 |
| `EL-13.1` | `not-verifiable` | not-verifiable:2,fail:1 | `pass` | pass:2,fail:1 | ◐ | 15 |
| `EL-13.10` | `not-verifiable` | not-verifiable:2,fail:1 | `not-verifiable` | not-verifiable:2,pass:1 | — | 16 |
| `EL-13.12` | `not-verifiable` | not-verifiable:3 | `not-verifiable` | not-verifiable:1,n/a:1,fail:1 | — | 1 |
| `EL-13.14` | `not-verifiable` | not-verifiable:3 | `not-verifiable` | not-verifiable:2,fail:1 | — | 2 |
| `EL-13.19` | `not-verifiable` | not-verifiable:2,fail:1 | `n/a` | n/a:2,fail:1 | ◐ | 1 |
| `EL-13.2` | `n/a` | n/a:2,not-verifiable:1 | `pass` | pass:2,n/a:1 | — | 5 |
| `EL-13.21` | `not-verifiable` | not-verifiable:3 | `not-verifiable` | not-verifiable:2,pass:1 | — | 5 |
| `EL-13.22` | `not-verifiable` | not-verifiable:3 | `not-verifiable` | not-verifiable:2,pass:1 | — | 5 |
| `EL-13.23` | `not-verifiable` | not-verifiable:3 | `not-verifiable` | not-verifiable:2,pass:1 | — | 5 |
| `EL-13.27` | `n/a` | n/a:2,not-verifiable:1 | `not-verifiable` | not-verifiable:2,pass:1 | — | 6 |
| `EL-13.33` | `not-verifiable` | not-verifiable:3 | `pass` | pass:3 | ✓ | 5 |
| `EL-13.7` | `not-verifiable` | not-verifiable:2,fail:1 | `pass` | pass:3 | ◐ | 6 |
| `EL-2.1` | `fail` | fail:3 | `not-verifiable` | not-verifiable:3 | — | 9 |
| `EL-2.7` | `n/a` | n/a:2,not-verifiable:1 | `fail` | fail:1,n/a:1,not-verifiable:1 | — | 5 |

## Sample measurements (RUN_7, top items)

### `EL-1.37` — RUN_7 verdict: `not-verifiable` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Tree symbol labeled 'BM' in the southwest corner | Overhead electric line (OHE) along the southern boundary | 147.7 | medium |
| Westernmost tree symbol labeled 'M' in the southeast corner | Overhead electric line (OHE) along the southern boundary | 84.8 | medium |
| Middle tree symbol labeled 'M' in the southeast corner | Overhead electric line (OHE) along the southern boundary | 113.6 | medium |

### `EL-13.1` — RUN_7 verdict: `pass` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad west of Bldg. 1 (near Unit 101) | West exterior wall of Bldg. 1 | 27.8 | medium |
| Electrical Transformer Pad west of Bldg. 2 (near Unit 201) | West exterior wall of Bldg. 2 | 47.2 | medium |
| Electrical Transformer Pad west of Bldg. 8 (near Unit 801) | West exterior wall of Bldg. 8 | 13.4 | medium |

### `EL-13.10` — RUN_7 verdict: `not-verifiable` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad west of Bldg. 1 | west wall of Bldg. 1 | 21.3 | medium |
| Electrical Transformer Pad west of Bldg. 2 | west wall of Bldg. 2 | 50.5 | medium |
| Electrical Transformer Pad west of Bldg. 8 | west wall of Bldg. 8 | 53.0 | medium |

### `EL-13.12` — RUN_7 verdict: `not-verifiable` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| fire hydrant labeled 'FH' located east of Bldg 7 and west of Bldg 6 | Electrical Transformer Pad located east of Bldg 7 and west of Bldg 6, immediatel | 2.6 | medium |

### `EL-13.14` — RUN_7 verdict: `not-verifiable` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| northern electrical/transformer pad in the southwest corner of the site | shrubs or low vegetation immediately adjacent to the northern electrical/transfo | 0.0 | medium |
| southern electrical/transformer pad in the southwest corner of the site | shrubs or low vegetation immediately adjacent to the southern electrical/transfo | 0.3 | medium |

### `EL-13.19` — RUN_7 verdict: `n/a` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| transformer pad located south of the western entrance roundabout | fire lane adjacent to the western entrance roundabout | 1.6 | medium |

### `EL-13.2` — RUN_7 verdict: `pass` (ctrl: `n/a`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad on the northwest side of Building 1 | Retaining wall along the east property line | 382.7 | medium |
| Electrical Transformer Pad on the west side of Building 2 | Retaining wall along the east property line | 372.7 | medium |
| Electrical Transformer Pad on the west side of Building 8 | Retaining wall along the east property line | 395.2 | medium |

### `EL-13.21` — RUN_7 verdict: `not-verifiable` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad in the northwest corner near Bldg. 1 | nearest water line (marked 'W') | 10.8 | medium |
| Electrical Transformer Pad on the west side near Bldg. 2 | nearest water line (marked 'W') | 55.3 | medium |
| Electrical Transformer Pad in the southwest corner near Bldg. 8 | nearest water line (marked 'W') | 21.0 | medium |

### `EL-13.22` — RUN_7 verdict: `not-verifiable` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad west of Bldg 1 (near Unit 101) | nearest wastewater line (marked WW) | 51.2 | medium |
| Electrical Transformer Pad west of Bldg 2 (near Unit 201/202) | nearest wastewater line (marked WW) | 35.8 | medium |
| Electrical Transformer Pad west of Bldg 8 (near Unit 801/802) | nearest wastewater line (marked WW) | 136.5 | medium |

### `EL-13.23` — RUN_7 verdict: `not-verifiable` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad west of Bldg. 1 | nearest storm drain line (marked SD) | 76.7 | medium |
| Electrical Transformer Pad west of Bldg. 2 | nearest storm drain line (marked SD) | 51.1 | medium |
| Electrical Transformer Pad west of Bldg. 8 | nearest storm drain line (marked SD) | 19.2 | medium |

### `EL-13.27` — RUN_7 verdict: `not-verifiable` (ctrl: `n/a`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad west of Bldg. 1 | Overhead electric line (OHE) along the north boundary | 18.3 | medium |
| Electrical Transformer Pad west of Bldg. 1 | Overhead electric line (OHE) along the west boundary | 73.4 | medium |
| Electrical Transformer Pad west of Bldg. 2 | Overhead electric line (OHE) along the west boundary | 68.2 | medium |

### `EL-13.33` — RUN_7 verdict: `pass` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad left of Bldg. 1 (top left) | west property boundary line (LOC) | 38.5 | medium |
| Electrical Transformer Pad left of Bldg. 2 (middle left) | west property boundary line (LOC) | 36.9 | medium |
| Electrical Transformer Pad left of Bldg. 8 (bottom left) | west property boundary line (LOC) | 34.4 | medium |

### `EL-13.7` — RUN_7 verdict: `pass` (ctrl: `not-verifiable`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Transformer pad on the west side of the site, indicated by the 'Transformer Pad  | Back (eastern edge) of the adjacent 5' concrete sidewalk to the west | 3.5 | medium |
| Electrical Transformer Pad west of Building 1 | back of the nearest sidewalk to the west | 71.5 | medium |
| Electrical Transformer Pad west of Building 2 | back of the nearest sidewalk to the west | 15.6 | medium |

### `EL-2.1` — RUN_7 verdict: `not-verifiable` (ctrl: `fail`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Tree labeled 'B M' in southwest corner | OHE line along south property line | 2.0 | medium |
| Tree with circular symbol labeled 'M' near H.7 bubble in southeast area | OHE line along south property line | 3.2 | medium |
| Westernmost cloud-symbol tree labeled 'M' in southeast area | OHE line along south property line | 1.4 | medium |

### `EL-2.7` — RUN_7 verdict: `fail` (ctrl: `n/a`)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Electrical Transformer Pad west of Bldg. 1 | nearest tree symbol | 6.2 | medium |
| Electrical Transformer Pad west of Bldg. 2 | nearest tree symbol | 20.8 | medium |
| Electrical Transformer Pad west of Bldg. 8 | nearest tree symbol | 4.2 | medium |

