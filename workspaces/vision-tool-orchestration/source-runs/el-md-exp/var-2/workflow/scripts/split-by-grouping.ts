/**
 * Split Consolidated Findings by Grouping
 *
 * Reads the single consolidated-findings.json file and splits it into
 * per-grouping files for the simplified synthesis pipeline. Each finding's
 * ref has the format "{grouping}:{checklistItemId}" — we group by the
 * grouping prefix.
 *
 * This replaces the clustering step for the 2026-04-simplified schema.
 * Instead of semantic clustering via embeddings, we use the natural
 * grouping from the review guide structure.
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
 *   npx tsx split-by-grouping.ts \
 *     --inputFile=/path/to/consolidated-findings.json \
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

interface ConsolidatedFinding {
  ref: string;
  status: string;
  confidence: string;
  runCount: number;
  totalRuns: number;
  findings: PerRunFinding[];
}

interface ConsolidatedFile {
  totalRuns: number;
  findings: ConsolidatedFinding[];
}

interface SimplifiedFlagged {
  run: number;
  s: string;  // "f" or "nv"
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
      inputFile: { type: 'string' },
      outputFolder: { type: 'string' },
    },
    strict: true,
  });

  const { inputFile, outputFolder } = values;

  if (!inputFile) throw new Error('--inputFile is required');
  if (!outputFolder) throw new Error('--outputFolder is required');

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}`);
  }

  const raw = fs.readFileSync(inputFile, 'utf-8');
  const parsed = JSON.parse(raw);

  // The consolidated-findings.json can be either:
  // - A flat array of findings (current format on main)
  // - An object with { totalRuns, findings } (alternate format)
  const findings: ConsolidatedFinding[] = Array.isArray(parsed) ? parsed : parsed.findings;
  if (!Array.isArray(findings) || findings.length === 0) {
    throw new Error('Input file has no findings (expected array or { findings: [...] })');
  }

  // Derive totalRuns from the first finding
  const totalRuns = findings[0].totalRuns;

  // Group findings by their grouping prefix (everything before the first ":")
  const groupings = new Map<string, SimplifiedFinding[]>();

  for (const finding of findings) {
    const colonIdx = finding.ref.indexOf(':');
    const grouping = colonIdx >= 0 ? finding.ref.substring(0, colonIdx) : finding.ref;

    if (!groupings.has(grouping)) {
      groupings.set(grouping, []);
    }

    // Convert to simplified format expected by synthesis agent
    const flagged: SimplifiedFlagged[] = finding.findings.map(f => {
      // Extract run number from "run-1" format
      const runMatch = f.run.match(/(\d+)/);
      const runNum = runMatch ? parseInt(runMatch[1], 10) : 0;

      // Map status to short form
      const s = f.status === 'fail' ? 'f' : 'nv';

      // Extract sheet numbers from sheetReferences
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

  // Write per-grouping files
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

  console.log(`\nSplit ${findings.length} findings into ${groupings.size} groupings`);
  console.log(`Output: ${outputFolder}`);
}

main();
