/**
 * Cross-Run Consolidation for Completeness Check
 *
 * Reads per-grouping findings from each run's findings/ directory, performs
 * majority vote on status across runs, assigns confidence tiers, and writes:
 *   - consolidated-findings.json (full multi-run data)
 *   - per-grouping files in findingsDir/ (same format enrich-findings expects)
 *
 * Unlike the review workflow's cross-run-consolidate (which only tracks fails),
 * this script handles all 4 CC statuses: pass, fail, unclear, not-applicable.
 * Every checklist item gets a final status via majority vote.
 *
 * When runCount=1, this is a passthrough: copies run-1/findings/* to findingsDir/.
 *
 * Usage:
 *   npx tsx cross-run-consolidate-cc.ts \
 *     --runsDir=/path/to/output/runs \
 *     --findingsDir=/path/to/output/findings \
 *     --runCount=3
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// --- Types matching completeness agent output ---

interface EvidenceLocation {
  documentId: string;
  sheetNumber?: number;
  label: string;
}

interface AgentFinding {
  checklistItemId: string;
  observation?: string;
  reasoning?: string;
  tools_used?: string[];
  status: 'pass' | 'fail' | 'unclear' | 'not-applicable';
  explanation: string;
  resolution?: string | null;
  resolutionDetails?: unknown;
  evidenceLocations: EvidenceLocation[];
}

interface GroupingResult {
  grouping: string;
  findings: AgentFinding[];
  summary?: string;
}

// --- Per-run finding for consolidated output ---

interface PerRunFinding {
  run: string;
  status: 'pass' | 'fail' | 'unclear' | 'not-applicable';
  explanation: string;
  observation?: string;
  reasoning?: string;
  evidenceLocations: EvidenceLocation[];
}

interface ConsolidatedItem {
  ref: string;                    // e.g., "cc-13:AW-01"
  grouping: string;               // e.g., "cc-13"
  checklistItemId: string;        // e.g., "AW-01"
  status: 'pass' | 'fail' | 'unclear' | 'not-applicable';
  confidence: 'high' | 'medium' | 'low';
  runCount: number;
  totalRuns: number;
  perRunFindings: PerRunFinding[];
  // Winning run's full finding (used for downstream enrich-findings compatibility)
  winningFinding: AgentFinding;
}

type Status = 'pass' | 'fail' | 'unclear' | 'not-applicable';

// Severity order for tie-breaking: fail > unclear > not-applicable > pass
const STATUS_SEVERITY: Record<Status, number> = {
  'fail': 3,
  'unclear': 2,
  'not-applicable': 1,
  'pass': 0,
};

/**
 * Majority vote across runs for a single checklist item.
 * Returns the winning status and confidence level.
 */
function majorityVote(
  statuses: Status[],
  totalRuns: number,
): { status: Status; confidence: 'high' | 'medium' | 'low' } {
  const counts = new Map<Status, number>();
  for (const s of statuses) {
    counts.set(s, (counts.get(s) || 0) + 1);
  }

  // Find max count
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) maxCount = count;
  }

  // Get all statuses tied at max count
  const tied: Status[] = [];
  for (const [status, count] of counts) {
    if (count === maxCount) tied.push(status);
  }

  // Break ties by severity (higher severity wins)
  tied.sort((a, b) => STATUS_SEVERITY[b] - STATUS_SEVERITY[a]);
  const winner = tied[0];

  // Confidence: unanimous = high (compared against totalRuns, not actual runs found —
  // missing runs intentionally prevent high confidence)
  const confidence: 'high' | 'medium' | 'low' =
    maxCount >= totalRuns ? 'high' :
    maxCount >= 2 ? 'medium' :
    'low';

  return { status: winner, confidence };
}

function main() {
  const { values } = parseArgs({
    options: {
      runsDir: { type: 'string' },
      findingsDir: { type: 'string' },
      runCount: { type: 'string' },
    },
    strict: true,
  });

  const { runsDir, findingsDir, runCount: runCountStr } = values;
  if (!runsDir) throw new Error('--runsDir is required');
  if (!findingsDir) throw new Error('--findingsDir is required');
  if (!runCountStr) throw new Error('--runCount is required');

  const totalRuns = parseInt(runCountStr, 10);
  if (isNaN(totalRuns) || totalRuns < 1) {
    throw new Error(`--runCount must be a positive integer, got: ${runCountStr}`);
  }

  // Special case: single run = passthrough (copy files, no consolidation)
  if (totalRuns === 1) {
    const srcDir = path.join(runsDir, 'run-1', 'findings');
    if (!fs.existsSync(srcDir)) {
      throw new Error(`Single-run findings directory not found: ${srcDir}`);
    }
    if (!fs.existsSync(findingsDir)) fs.mkdirSync(findingsDir, { recursive: true });
    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      fs.copyFileSync(path.join(srcDir, file), path.join(findingsDir, file));
    }
    console.log(`Single run: copied ${files.length} findings files to ${findingsDir}`);
    return;
  }

  // --- Multi-run consolidation ---

  // 1. Read all runs' findings
  // Key: ref (grouping:checklistItemId) → array of { run, finding }
  const itemMap = new Map<string, { run: string; finding: AgentFinding; grouping: string }[]>();
  // Track all grouping results for rebuilding per-grouping output
  const groupingSummaries = new Map<string, string[]>(); // grouping → summaries from each run

  let runsFound = 0;
  for (let i = 1; i <= totalRuns; i++) {
    const runName = `run-${i}`;
    const runFindingsDir = path.join(runsDir, runName, 'findings');

    if (!fs.existsSync(runFindingsDir)) {
      console.warn(`WARNING: Missing ${runFindingsDir} — skipping ${runName}`);
      continue;
    }
    runsFound++;

    const files = fs.readdirSync(runFindingsDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    for (const file of files) {
      const raw = fs.readFileSync(path.join(runFindingsDir, file), 'utf-8');
      let data: GroupingResult;
      try {
        data = JSON.parse(raw);
      } catch {
        console.warn(`WARNING: Skipping ${runName}/${file} — invalid JSON`);
        continue;
      }

      if (data.summary) {
        const existing = groupingSummaries.get(data.grouping) || [];
        existing.push(data.summary);
        groupingSummaries.set(data.grouping, existing);
      }

      for (const finding of data.findings) {
        const ref = `${data.grouping}:${finding.checklistItemId}`;
        const entries = itemMap.get(ref) || [];
        entries.push({ run: runName, finding, grouping: data.grouping });
        itemMap.set(ref, entries);
      }
    }
  }

  if (runsFound === 0) {
    throw new Error(`No valid run directories found in ${runsDir}`);
  }

  console.log(`Loaded ${runsFound}/${totalRuns} runs, ${itemMap.size} unique checklist items`);

  // 2. Majority vote for each item
  const consolidated: ConsolidatedItem[] = [];

  for (const [ref, entries] of itemMap) {
    const statuses = entries.map(e => e.finding.status);
    const { status, confidence } = majorityVote(statuses, totalRuns);

    // Pick the "winning" finding: prefer a finding that matches the voted status,
    // from the earliest run for determinism
    const winningEntry = entries.find(e => e.finding.status === status) || entries[0];

    consolidated.push({
      ref,
      grouping: winningEntry.grouping,
      checklistItemId: winningEntry.finding.checklistItemId,
      status,
      confidence,
      runCount: entries.length,
      totalRuns,
      perRunFindings: entries.map(e => ({
        run: e.run,
        status: e.finding.status,
        explanation: e.finding.explanation,
        observation: e.finding.observation,
        reasoning: e.finding.reasoning,
        evidenceLocations: e.finding.evidenceLocations,
      })),
      winningFinding: winningEntry.finding,
    });
  }

  // 3. Write consolidated-findings.json
  const consolidatedPath = path.join(path.dirname(runsDir), 'consolidated-findings.json');
  const consolidatedDir = path.dirname(consolidatedPath);
  if (!fs.existsSync(consolidatedDir)) fs.mkdirSync(consolidatedDir, { recursive: true });
  fs.writeFileSync(consolidatedPath, JSON.stringify(consolidated, null, 2));

  // 4. Write per-grouping files to findingsDir (same format enrich-findings expects)
  if (!fs.existsSync(findingsDir)) fs.mkdirSync(findingsDir, { recursive: true });

  const groupingMap = new Map<string, ConsolidatedItem[]>();
  for (const item of consolidated) {
    const existing = groupingMap.get(item.grouping) || [];
    existing.push(item);
    groupingMap.set(item.grouping, existing);
  }

  for (const [grouping, items] of groupingMap) {
    const output: GroupingResult = {
      grouping,
      findings: items.map(item => item.winningFinding),
      summary: groupingSummaries.get(grouping)?.[0] || '',
    };
    const filePath = path.join(findingsDir, `${grouping}.md.json`);
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  }

  // 5. Summary stats
  const highCount = consolidated.filter(f => f.confidence === 'high').length;
  const medCount = consolidated.filter(f => f.confidence === 'medium').length;
  const lowCount = consolidated.filter(f => f.confidence === 'low').length;
  const statusCounts = {
    pass: consolidated.filter(f => f.status === 'pass').length,
    fail: consolidated.filter(f => f.status === 'fail').length,
    unclear: consolidated.filter(f => f.status === 'unclear').length,
    'not-applicable': consolidated.filter(f => f.status === 'not-applicable').length,
  };

  console.log(`\nConsolidated: ${consolidated.length} items`);
  console.log(`  Confidence: ${highCount} high (${totalRuns}/${totalRuns}), ${medCount} medium (2+/${totalRuns}), ${lowCount} low (1/${totalRuns})`);
  console.log(`  Status: ${statusCounts.pass} pass, ${statusCounts.fail} fail, ${statusCounts.unclear} unclear, ${statusCounts['not-applicable']} n/a`);
  console.log(`  Grouping files written to: ${findingsDir}`);
  console.log(`  Consolidated JSON: ${consolidatedPath}`);
}

main();
