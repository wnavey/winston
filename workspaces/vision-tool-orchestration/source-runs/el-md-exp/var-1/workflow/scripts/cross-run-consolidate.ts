/**
 * Cross-Run Consolidation Script
 *
 * Reads per-item findings JSON files directly from each run's findings/
 * directory, matches findings by ref across runs, assigns confidence tiers
 * (high=N/N, medium=2+/N, low=1/N), and writes consolidated output.
 *
 * Also writes:
 *   - flagged-findings.json per run (flat array for eval agents)
 *   - runs-manifest.json (for eval checklist)
 *
 * This is deterministic — no LLM needed. Refs are stable across runs
 * because they derive from the checklist structure ({grouping}:{deficiencyId}).
 *
 * Usage:
 *   npx tsx cross-run-consolidate.ts \
 *     --runsDir=/path/to/output/runs \
 *     --outputPath=/path/to/output/consolidated-findings.json \
 *     --runCount=3
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// --- Per-item findings file (agent structured output) ---

interface Finding {
  deficiencyId: string;
  status: string;
  codeCitations?: string[];
  applicableAreas?: string[];
  sheetReferences?: { documentId: string; sheetNumber: number }[];
  documentReferences?: { documentId: string; label: string }[];
  comment: string | null;
}

interface FindingsFile {
  grouping: string;
  findings: Finding[];
}

// --- Flattened finding with ref (intermediate) ---

interface FlaggedFinding {
  ref: string;
  status: string;
  comment: string | null;
  codeCitations: string[];
  applicableAreas: string[];
  sheetReferences: { documentId: string; sheetNumber: number }[];
  documentReferences: { documentId: string; label: string }[];
}

// --- Output schema ---

interface PerRunFinding {
  run: string;
  status: 'fail' | 'not-verifiable';
  comment: string | null;
  codeCitations: string[];
  applicableAreas: string[];
  sheetReferences: { documentId: string; sheetNumber: number }[];
  documentReferences: { documentId: string; label: string }[];
}

interface ConsolidatedFinding {
  ref: string;
  status: 'fail' | 'not-verifiable';
  confidence: 'high' | 'medium' | 'low';
  runCount: number;
  totalRuns: number;
  findings: PerRunFinding[];
}

// --- Confidence tier sort order (high first) ---

const CONFIDENCE_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// --- Runtime validation (guards against malformed output) ---

const VALID_STATUSES = new Set(['fail', 'not-verifiable']);
const VALID_CONFIDENCES = new Set(['high', 'medium', 'low']);

function validateConsolidated(findings: ConsolidatedFinding[]): void {
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const label = `consolidated[${i}] (ref=${JSON.stringify(f.ref ?? null)})`;

    if (typeof f.ref !== 'string' || f.ref.length === 0) {
      throw new Error(`${label}: ref must be a non-empty string`);
    }
    if (!VALID_STATUSES.has(f.status)) {
      throw new Error(`${label}: status must be "fail" or "not-verifiable", got ${JSON.stringify(f.status)}`);
    }
    if (!VALID_CONFIDENCES.has(f.confidence)) {
      throw new Error(`${label}: confidence must be "high", "medium", or "low", got ${JSON.stringify(f.confidence)}`);
    }
    if (!Number.isInteger(f.runCount) || f.runCount < 1) {
      throw new Error(`${label}: runCount must be a positive integer, got ${f.runCount}`);
    }
    if (!Number.isInteger(f.totalRuns) || f.totalRuns < 1) {
      throw new Error(`${label}: totalRuns must be a positive integer, got ${f.totalRuns}`);
    }
    if (f.runCount > f.totalRuns) {
      throw new Error(`${label}: runCount (${f.runCount}) must not exceed totalRuns (${f.totalRuns})`);
    }
    if (!Array.isArray(f.findings) || f.findings.length === 0) {
      throw new Error(`${label}: findings must be a non-empty array`);
    }
    for (let j = 0; j < f.findings.length; j++) {
      const pf = f.findings[j];
      const pfLabel = `${label} findings[${j}]`;
      if (typeof pf.run !== 'string' || pf.run.length === 0) {
        throw new Error(`${pfLabel}: run must be a non-empty string`);
      }
      if (!VALID_STATUSES.has(pf.status)) {
        throw new Error(`${pfLabel}: status must be "fail" or "not-verifiable", got ${JSON.stringify(pf.status)}`);
      }
      if (!Array.isArray(pf.codeCitations) || !pf.codeCitations.every((s: unknown) => typeof s === 'string')) {
        throw new Error(`${pfLabel}: codeCitations must be an array of strings`);
      }
      if (!Array.isArray(pf.applicableAreas) || !pf.applicableAreas.every((s: unknown) => typeof s === 'string')) {
        throw new Error(`${pfLabel}: applicableAreas must be an array of strings`);
      }
      if (!Array.isArray(pf.sheetReferences) || !pf.sheetReferences.every((s: unknown) => {
        const obj = s as Record<string, unknown>;
        return typeof obj === 'object' && obj !== null && typeof obj.documentId === 'string' && Number.isInteger(obj.sheetNumber);
      })) {
        throw new Error(`${pfLabel}: sheetReferences must be an array of { documentId: string, sheetNumber: number }`);
      }
      if (!Array.isArray(pf.documentReferences) || !pf.documentReferences.every((s: unknown) => {
        const obj = s as Record<string, unknown>;
        return typeof obj === 'object' && obj !== null && typeof obj.documentId === 'string' && typeof obj.label === 'string';
      })) {
        throw new Error(`${pfLabel}: documentReferences must be an array of { documentId: string, label: string }`);
      }
    }
  }
}

// --- Read per-item findings files from a run's findings/ directory ---

function collectFromRun(findingsDir: string): FlaggedFinding[] {
  if (!fs.existsSync(findingsDir)) {
    throw new Error(`Findings directory not found: ${findingsDir}`);
  }

  const files = fs.readdirSync(findingsDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(a.replace('.md.json', '').replace('.json', ''));
      const numB = parseInt(b.replace('.md.json', '').replace('.json', ''));
      return numA - numB;
    });

  const flagged: FlaggedFinding[] = [];
  const seenRefs = new Set<string>();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(findingsDir, file), 'utf-8');
    let data: FindingsFile;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn(`WARNING: Skipping ${file} — invalid JSON`);
      continue;
    }
    for (const finding of data.findings) {
      if (finding.status === 'fail' || finding.status === 'not-verifiable') {
        const ref = `${data.grouping.toLowerCase()}:${finding.deficiencyId}`;
        if (seenRefs.has(ref)) {
          console.warn(`WARNING: Duplicate ref ${ref} in ${file} — skipping`);
          continue;
        }
        seenRefs.add(ref);
        flagged.push({
          ref,
          status: finding.status,
          comment: finding.comment,
          codeCitations: finding.codeCitations ?? [],
          applicableAreas: finding.applicableAreas ?? [],
          sheetReferences: finding.sheetReferences ?? [],
          documentReferences: finding.documentReferences ?? [],
        });
      }
    }
  }
  return flagged;
}

function main() {
  const { values } = parseArgs({
    options: {
      runsDir: { type: 'string' },
      outputPath: { type: 'string' },
      runCount: { type: 'string' },
    },
    strict: true,
  });

  const { runsDir, outputPath, runCount: runCountStr } = values;

  if (!runsDir) throw new Error('--runsDir is required');
  if (!outputPath) throw new Error('--outputPath is required');
  if (!runCountStr) throw new Error('--runCount is required');

  const totalRuns = parseInt(runCountStr, 10);
  if (isNaN(totalRuns) || totalRuns < 1) {
    throw new Error(`--runCount must be a positive integer, got: ${runCountStr}`);
  }

  // 1. Read per-item findings from each run, build refs, write flagged-findings.json per run
  const refMap = new Map<string, PerRunFinding[]>();
  const runKeys: string[] = [];

  for (let i = 1; i <= totalRuns; i++) {
    const runName = `run-${i}`;
    const findingsDir = path.join(runsDir, runName, 'findings');

    if (!fs.existsSync(findingsDir)) {
      console.warn(`WARNING: Missing ${findingsDir} — skipping ${runName}`);
      continue;
    }

    const flagged = collectFromRun(findingsDir);
    console.log(`${runName}: ${flagged.length} flagged findings`);

    // Write per-run flattened file (used by eval agents)
    const flaggedPath = path.join(runsDir, runName, 'flagged-findings.json');
    fs.writeFileSync(flaggedPath, JSON.stringify(flagged, null, 2));

    runKeys.push(runName);

    for (const f of flagged) {
      const perRun: PerRunFinding = {
        run: runName,
        status: f.status as 'fail' | 'not-verifiable',
        comment: f.comment,
        codeCitations: f.codeCitations,
        applicableAreas: f.applicableAreas,
        sheetReferences: f.sheetReferences,
        documentReferences: f.documentReferences,
      };

      const existing = refMap.get(f.ref);
      if (existing) {
        existing.push(perRun);
      } else {
        refMap.set(f.ref, [perRun]);
      }
    }
  }

  if (runKeys.length === 0) {
    throw new Error(`No valid run directories found in ${runsDir}`);
  }

  // Write manifest for downstream checklist steps (e.g., per-run eval)
  const manifestPath = path.join(runsDir, 'runs-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ runs: runKeys }, null, 2));
  console.log(`Manifest: ${manifestPath}`);

  console.log(`\nLoaded ${runKeys.length}/${totalRuns} runs, ${refMap.size} unique refs`);

  // 2. Build consolidated findings with confidence tiers
  const consolidated: ConsolidatedFinding[] = [];

  for (const [ref, findings] of refMap) {
    const runCount = findings.length;

    // Confidence: high if all runs flagged it, medium if 2+, low if only 1
    const confidence: 'high' | 'medium' | 'low' =
      runCount >= totalRuns ? 'high' : runCount >= 2 ? 'medium' : 'low';

    // Best status: "fail" wins over "not-verifiable"
    const status: 'fail' | 'not-verifiable' = findings.some(f => f.status === 'fail')
      ? 'fail'
      : 'not-verifiable';

    consolidated.push({
      ref,
      status,
      confidence,
      runCount,
      totalRuns,
      findings,
    });
  }

  // 3. Sort: confidence (high first), then ref (natural sort)
  consolidated.sort((a, b) => {
    const confDiff = CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
    if (confDiff !== 0) return confDiff;
    return a.ref.localeCompare(b.ref, undefined, { numeric: true });
  });

  // 4. Validate and write output
  validateConsolidated(consolidated);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(consolidated, null, 2));

  // 5. Summary stats
  const highCount = consolidated.filter(f => f.confidence === 'high').length;
  const medCount = consolidated.filter(f => f.confidence === 'medium').length;
  const lowCount = consolidated.filter(f => f.confidence === 'low').length;
  const failCount = consolidated.filter(f => f.status === 'fail').length;
  const notVerifiableCount = consolidated.filter(f => f.status === 'not-verifiable').length;

  console.log(`\nConsolidated: ${consolidated.length} findings`);
  console.log(`  Confidence: ${highCount} high (${totalRuns}/${totalRuns}), ${medCount} medium (2+/${totalRuns}), ${lowCount} low (1/${totalRuns})`);
  console.log(`  Status: ${failCount} fail, ${notVerifiableCount} not-verifiable`);
  console.log(`Written to: ${outputPath}`);
}

main();
