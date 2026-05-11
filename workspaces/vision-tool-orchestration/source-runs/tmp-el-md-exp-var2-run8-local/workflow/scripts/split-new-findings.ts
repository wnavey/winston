/**
 * Split New Findings by Grouping
 *
 * Reads a comparison-result.json file containing newFindings (findings not
 * present in the prior review) and splits them into per-grouping files for
 * the synthesis pipeline. Each finding's ref has the format
 * "{grouping}:{checklistItemId}" — we group by the grouping prefix.
 *
 * Output format per grouping matches what the synthesis agent expects:
 * {
 *   "totalRuns": 3,
 *   "findings": [
 *     {
 *       "id": "de-4:SDUF-10.12",
 *       "flagged": [
 *         { "run": 1, "s": "f", "comment": "...", "codes": [...], "sheets": [...], "areas": [...] }
 *       ]
 *     }
 *   ]
 * }
 *
 * Usage:
 *   npx tsx split-new-findings.ts \
 *     --comparisonFile=/path/to/comparison-result.json \
 *     --outputFolder=/path/to/04-synthesis-input
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

interface PerRunFinding {
  run: string;
  status: string;
  comment: string | null;
  codeCitations: string[];
  applicableAreas: string[];
  sheetReferences: { documentId: string; sheetNumber: number }[];
  documentReferences: { documentId: string; label: string }[];
}

interface NewFinding {
  ref: string;
  status: string;
  confidence: string;
  runCount: number;
  totalRuns: number;
  findings: PerRunFinding[];
}

interface ComparisonResult {
  newFindings: NewFinding[];
}

interface SimplifiedFlagged {
  run: number;
  s: string;
  comment: string;
  codes: string[];
  sheets: number[];
  areas: string[];
}

interface SimplifiedFinding {
  id: string;
  flagged: SimplifiedFlagged[];
}

function main() {
  const { values } = parseArgs({
    options: {
      comparisonFile: { type: 'string' },
      outputFolder: { type: 'string' },
    },
    strict: true,
  });

  const { comparisonFile, outputFolder } = values;

  if (!comparisonFile) throw new Error('--comparisonFile is required');
  if (!outputFolder) throw new Error('--outputFolder is required');

  if (!fs.existsSync(comparisonFile)) {
    throw new Error(`Comparison file not found: ${comparisonFile}`);
  }

  const raw = fs.readFileSync(comparisonFile, 'utf-8');
  const parsed: ComparisonResult = JSON.parse(raw);
  const newFindings = parsed.newFindings;

  if (!Array.isArray(newFindings) || newFindings.length === 0) {
    console.log('No new findings to split');
    return;
  }

  const totalRuns = newFindings[0].totalRuns;

  const groupings = new Map<string, SimplifiedFinding[]>();

  for (const finding of newFindings) {
    const colonIdx = finding.ref.indexOf(':');
    const grouping = colonIdx >= 0 ? finding.ref.substring(0, colonIdx) : finding.ref;

    if (!groupings.has(grouping)) {
      groupings.set(grouping, []);
    }

    const flagged: SimplifiedFlagged[] = finding.findings.map(f => {
      const runMatch = f.run.match(/(\d+)/);
      const runNum = runMatch ? parseInt(runMatch[1], 10) : 0;

      const s = f.status === 'fail' ? 'f' : 'nv';

      const sheets = (f.sheetReferences || [])
        .map(sr => sr.sheetNumber)
        .filter((n): n is number => n != null);

      return {
        run: runNum,
        s,
        comment: f.comment || '',
        codes: f.codeCitations || [],
        sheets,
        areas: f.applicableAreas || [],
      };
    });

    groupings.get(grouping)!.push({
      id: finding.ref,
      flagged,
    });
  }

  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  for (const [grouping, findings] of groupings) {
    const output = {
      totalRuns,
      findings,
    };

    const filePath = path.join(outputFolder, `${grouping}.json`);
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    console.log(`${grouping}: ${findings.length} findings`);
  }

  console.log(`\nSplit ${newFindings.length} new findings into ${groupings.size} groupings`);
  console.log(`Output: ${outputFolder}`);
}

main();
