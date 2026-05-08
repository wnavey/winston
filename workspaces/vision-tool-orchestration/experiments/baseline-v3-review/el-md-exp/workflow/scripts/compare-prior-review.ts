/**
 * Compare Prior Review Script
 *
 * Deterministically compares new consolidated findings (from a re-review
 * 3x Haiku ensemble) against prior review comments to identify which
 * issues were resolved vs. still outstanding.
 *
 * Matching is by sourceId: each prior comment detail has a sourceId like
 * "sduf-10:SDUF-10.12", and each consolidated finding has a ref with
 * the same format. If a prior sourceId appears in the new findings, the
 * issue is still outstanding. If absent, it was resolved.
 *
 * Usage:
 *   npx tsx compare-prior-review.ts \
 *     --consolidatedFile=/path/to/consolidated-findings.json \
 *     --priorCommentsFile=/path/to/prior-review-comments.json \
 *     --outputFile=/path/to/comparison-result.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// --- Input types: consolidated findings ---

interface ConsolidatedFinding {
  ref: string;
  status: string;
  confidence: string;
  runCount: number;
  totalRuns: number;
  findings: unknown[];
}

// --- Input types: prior review comments ---

interface RunComment {
  runNum: number;
  status: string;
  comment: string;
}

interface PriorDetail {
  text: string;
  citation: string;
  sourceId: string;
  confidence: number;
  runComments: RunComment[];
}

interface PriorComment {
  _dbId: string;
  section: string;
  headline: string;
  summary: string;
  severity: number;
  confidence: number;
  sheets: number[];
  applicableArea: string;
  crossDep: string | null;
  attn: string | null;
  commentNumber: number;
  details: PriorDetail[];
}

// --- Output types ---

interface ReconciledDetail {
  sourceId: string;
  resolved: boolean;
  priorDetail: PriorDetail;
  newFinding: ConsolidatedFinding | null;
}

interface ReconciledComment {
  priorComment: PriorComment;
  details: ReconciledDetail[];
  allResolved: boolean;
  resolvedCount: number;
  outstandingCount: number;
}

interface ComparisonStats {
  priorCommentCount: number;
  priorDetailCount: number;
  resolvedCount: number;
  outstandingCount: number;
  newFindingCount: number;
  matchRate: number;
}

interface ComparisonResult {
  reconciledComments: ReconciledComment[];
  newFindings: ConsolidatedFinding[];
  stats: ComparisonStats;
}

// --- sourceId format validation ---

const SOURCE_ID_PATTERN = /^[a-zA-Z0-9\-]+:[a-zA-Z0-9\-\.]+$/;

function validateSourceId(sourceId: string): boolean {
  return SOURCE_ID_PATTERN.test(sourceId);
}

function main() {
  const { values } = parseArgs({
    options: {
      consolidatedFile: { type: 'string' },
      priorCommentsFile: { type: 'string' },
      outputFile: { type: 'string' },
    },
    strict: true,
  });

  const { consolidatedFile, priorCommentsFile, outputFile } = values;

  if (!consolidatedFile) throw new Error('--consolidatedFile is required');
  if (!priorCommentsFile) throw new Error('--priorCommentsFile is required');
  if (!outputFile) throw new Error('--outputFile is required');

  if (!fs.existsSync(consolidatedFile)) {
    throw new Error(`Consolidated findings file not found: ${consolidatedFile}`);
  }
  if (!fs.existsSync(priorCommentsFile)) {
    throw new Error(`Prior comments file not found: ${priorCommentsFile}`);
  }

  const consolidatedRaw = fs.readFileSync(consolidatedFile, 'utf-8');
  const consolidated: ConsolidatedFinding[] = JSON.parse(consolidatedRaw);

  const priorRaw = fs.readFileSync(priorCommentsFile, 'utf-8');
  const priorComments: PriorComment[] = JSON.parse(priorRaw);

  const newFindingRefs = new Set<string>(consolidated.map(f => f.ref));
  const refToFinding = new Map<string, ConsolidatedFinding>();
  for (const f of consolidated) {
    refToFinding.set(f.ref, f);
  }

  const matchedRefs = new Set<string>();
  let totalPriorDetails = 0;
  let totalResolved = 0;
  let totalOutstanding = 0;

  const reconciledComments: ReconciledComment[] = [];

  for (const comment of priorComments) {
    const reconciledDetails: ReconciledDetail[] = [];

    for (const detail of comment.details) {
      totalPriorDetails++;

      if (!validateSourceId(detail.sourceId)) {
        console.warn(`WARNING: sourceId "${detail.sourceId}" in comment #${comment.commentNumber} does not match expected {grouping}:{deficiencyId} pattern`);
      }

      const isOutstanding = newFindingRefs.has(detail.sourceId);

      if (isOutstanding) {
        matchedRefs.add(detail.sourceId);
        totalOutstanding++;
        reconciledDetails.push({
          sourceId: detail.sourceId,
          resolved: false,
          priorDetail: detail,
          newFinding: refToFinding.get(detail.sourceId)!,
        });
      } else {
        totalResolved++;
        reconciledDetails.push({
          sourceId: detail.sourceId,
          resolved: true,
          priorDetail: detail,
          newFinding: null,
        });
      }
    }

    const resolvedCount = reconciledDetails.filter(d => d.resolved).length;
    const outstandingCount = reconciledDetails.filter(d => !d.resolved).length;

    reconciledComments.push({
      priorComment: comment,
      details: reconciledDetails,
      allResolved: outstandingCount === 0,
      resolvedCount,
      outstandingCount,
    });
  }

  const newFindings = consolidated.filter(f => !matchedRefs.has(f.ref));

  const matchRate = totalPriorDetails > 0
    ? matchedRefs.size / totalPriorDetails
    : 0;

  if (matchRate < 0.5 && totalPriorDetails > 0) {
    console.warn(`WARNING: matchRate is ${(matchRate * 100).toFixed(1)}% — possible sourceId format mismatch between prior comments and new findings`);
  }

  const stats: ComparisonStats = {
    priorCommentCount: priorComments.length,
    priorDetailCount: totalPriorDetails,
    resolvedCount: totalResolved,
    outstandingCount: totalOutstanding,
    newFindingCount: newFindings.length,
    matchRate: Math.round(matchRate * 1000) / 1000,
  };

  const result: ComparisonResult = {
    reconciledComments,
    newFindings,
    stats,
  };

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

  console.log(`\n--- Comparison Summary ---`);
  console.log(`Prior comments: ${stats.priorCommentCount}`);
  console.log(`Prior details: ${stats.priorDetailCount}`);
  console.log(`Resolved: ${stats.resolvedCount}`);
  console.log(`Outstanding: ${stats.outstandingCount}`);
  console.log(`New findings (not in prior): ${stats.newFindingCount}`);
  console.log(`Match rate: ${(stats.matchRate * 100).toFixed(1)}%`);
  console.log(`Written to: ${outputFile}`);
}

main();
