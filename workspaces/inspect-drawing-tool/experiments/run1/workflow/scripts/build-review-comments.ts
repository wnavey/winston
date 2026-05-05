/**
 * Build Review Comments Script
 *
 * Reads enriched-findings.json and rephrased-items.json (from the format-reports agent)
 * and produces review-comments.json in the shape expected by conductor's saveReviewToDb().
 *
 * Usage:
 *   npx tsx build-review-comments.ts \
 *     --enrichedFile=/path/to/enriched-findings.json \
 *     --rephrasedFile=/path/to/rephrased-items.json \
 *     --outputFile=/path/to/review-comments.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

interface EvidenceLocation {
  documentId: string;
  sheetNumber?: number;
  label: string;
}

interface ResolutionDetails {
  type: 'standard_note_diff';
  expected: string;
  actual: string;
  referenceUrl: string;
}

interface EnrichedFinding {
  checklistItemId: string;
  observation?: string;
  reasoning?: string;
  tools_used?: string[];
  status: 'pass' | 'fail' | 'unclear' | 'not-applicable';
  explanation: string;
  resolution?: string | null;
  resolutionDetails?: ResolutionDetails | null;
  evidenceLocations: EvidenceLocation[];
  itemText: string;
  condition: string;
  requirementSource: string;
  sourceType: string;
  failStatus?: 'fail' | 'warn';
  // Forced outcome metadata (set by apply-forced-outcomes script)
  forced?: boolean;
  forcedReason?: string;
  forcedStatus?: string;
  organicStatus?: string;
}

interface EnrichedGrouping {
  id: string;
  title: string;
  findings: EnrichedFinding[];
  summary?: string;
  counts: { pass: number; fail: number; unclear: number; notApplicable: number; total: number };
}

interface EnrichedData {
  groupings: EnrichedGrouping[];
  totals: { pass: number; fail: number; unclear: number; notApplicable: number; total: number };
}

function main() {
  const { values } = parseArgs({
    options: {
      enrichedFile: { type: 'string' },
      rephrasedFile: { type: 'string' },
      outputFile: { type: 'string' },
      checklistVersion: { type: 'string' },
      bureauCommitHash: { type: 'string' },
      bureauArtifactPath: { type: 'string' },
      commentNumberingMapFile: { type: 'string' },
      totalRuns: { type: 'string' },
      consolidatedFile: { type: 'string' },
    },
    strict: true,
  });

  const { enrichedFile, rephrasedFile, outputFile, checklistVersion, bureauCommitHash, bureauArtifactPath, commentNumberingMapFile, totalRuns: totalRunsStr, consolidatedFile } = values;
  if (!enrichedFile) throw new Error('--enrichedFile is required');
  if (!rephrasedFile) throw new Error('--rephrasedFile is required');
  if (!outputFile) throw new Error('--outputFile is required');

  const enriched: EnrichedData = JSON.parse(fs.readFileSync(enrichedFile, 'utf-8'));
  const rephrased: Record<string, string> = JSON.parse(fs.readFileSync(rephrasedFile, 'utf-8'));

  // Load optional comment numbering map (checklist_id → comment_number)
  const numberingMap = new Map<string, number>();
  if (commentNumberingMapFile && fs.existsSync(commentNumberingMapFile) && fs.statSync(commentNumberingMapFile).isFile()) {
    const lines = fs.readFileSync(commentNumberingMapFile, 'utf-8').split('\n');
    for (const line of lines.slice(1)) { // skip header
      const [checklistId, numStr] = line.split('\t');
      if (checklistId && numStr) {
        numberingMap.set(checklistId.trim(), parseInt(numStr.trim(), 10));
      }
    }
    console.log(`Loaded comment numbering map: ${numberingMap.size} entries from ${commentNumberingMapFile}`);
  }

  // Load consolidated findings for multi-run metadata (ref → per-run data)
  const parsedTotalRuns = parseInt(totalRunsStr || '1', 10) || 1;
  interface ConsolidatedItem {
    ref: string;
    confidence: 'high' | 'medium' | 'low';
    runCount: number;
    totalRuns: number;
    perRunFindings: {
      run: string;
      status: string;
      explanation: string;
      observation?: string;
      reasoning?: string;
      evidenceLocations: { documentId: string; sheetNumber?: number; label: string }[];
    }[];
  }
  const consolidatedMap = new Map<string, ConsolidatedItem>();
  if (parsedTotalRuns > 1 && consolidatedFile && fs.existsSync(consolidatedFile) && fs.statSync(consolidatedFile).isFile()) {
    const items: ConsolidatedItem[] = JSON.parse(fs.readFileSync(consolidatedFile, 'utf-8'));
    for (const item of items) {
      consolidatedMap.set(item.ref, item);
    }
    console.log(`Loaded consolidated findings: ${consolidatedMap.size} items from ${consolidatedFile}`);
  }

  // When a map is loaded, start the fallback counter above the max mapped number to avoid collisions
  let commentNumber = numberingMap.size > 0
    ? Math.max(...numberingMap.values()) + 1
    : 1;
  let warnCount = 0;
  let unclearCoercedCount = 0;

  const sections = enriched.groupings.map((grouping, idx) => {
    const comments = grouping.findings.map(finding => {
      const title = rephrased[finding.checklistItemId] || finding.itemText;

      // Overlay fail → warn for items tagged as warn-level in the checklist
      const isWarnOverlay = finding.status === 'fail' && finding.failStatus === 'warn';
      const isForcedWarn = finding.forcedStatus === 'warn';
      if (isWarnOverlay || isForcedWarn) warnCount++;

      const sheetRefs = finding.evidenceLocations
        .filter(ev => ev.sheetNumber != null)
        .map(ev => ({
          documentId: ev.documentId,
          sheetNumber: ev.sheetNumber!,
          label: ev.label,
        }));

      const docRefs = finding.evidenceLocations
        .filter(ev => ev.sheetNumber == null)
        .map(ev => ({
          documentId: ev.documentId,
          label: ev.label,
        }));

      const sheetsText = sheetRefs.length > 0
        ? sheetRefs.map(s => `Sheet ${s.sheetNumber}`).join(', ')
        : '';

      const agentTrace = (finding.observation || finding.reasoning || finding.tools_used || finding.forced)
        ? {
            ...(finding.observation ? { observation: finding.observation } : {}),
            ...(finding.reasoning ? { reasoning: finding.reasoning } : {}),
            ...(finding.tools_used ? { tools_used: finding.tools_used } : {}),
            ...(finding.forced ? { forced: true } : {}),
            ...(finding.forcedReason ? { forcedReason: finding.forcedReason } : {}),
            ...(finding.organicStatus ? { organicStatus: finding.organicStatus } : {}),
          }
        : null;

      // Forced items use their explicitly set status; organic items use the warn overlay
      let effectiveStatus = finding.forcedStatus
        ? finding.forcedStatus
        : isWarnOverlay ? 'warn' : finding.status;

      // Coerce unclear → warn at the DB-write boundary (checklist files stay unchanged)
      if (effectiveStatus === 'unclear') {
        effectiveStatus = 'warn';
        warnCount++;
        unclearCoercedCount++;
      }

      const checklistRef = `${grouping.id}:${finding.checklistItemId}`;
      const consolidated = consolidatedMap.get(checklistRef);
      let assignedNumber: number;
      if (numberingMap.size > 0) {
        const mappedNumber = numberingMap.get(checklistRef);
        if (mappedNumber == null) {
          console.warn(`WARNING: ${checklistRef} not found in numbering map, assigning fallback ${commentNumber}`);
        }
        assignedNumber = mappedNumber ?? commentNumber++;
      } else {
        assignedNumber = commentNumber++;
      }

      const comment = {
        commentNumber: assignedNumber,
        title,
        status: effectiveStatus,
        comment: finding.explanation,
        issue: '',
        citation: finding.requirementSource,
        citationType: finding.sourceType,
        agentTrace,
        sheets: sheetsText,
        applicableArea: grouping.title,
        resolution: (finding.status === 'fail') ? (finding.resolution || '') : '',
        resolutionDetails: (finding.status === 'fail') ? (finding.resolutionDetails || null) : null,
        confidence: consolidated?.confidence ?? 'high',
        runCount: consolidated?.runCount ?? 1,
        totalRuns: consolidated?.totalRuns ?? parsedTotalRuns,
        isCrossDepartment: false,
        crossDepartmentNote: null,
        isReviewerAttention: false,
        reviewerAttentionNote: null,
        sheetReferences: sheetRefs,
        documentReferences: docRefs,
        sourceFindings: [{
          ref: checklistRef,
          confidence: consolidated?.confidence ?? 'high',
          runCount: consolidated?.runCount ?? 1,
          totalRuns: consolidated?.totalRuns ?? parsedTotalRuns,
          perRunFindings: consolidated?.perRunFindings.map(prf => ({
            run: prf.run,
            status: prf.status,
            comment: prf.explanation,
            observation: prf.observation || undefined,
            reasoning: prf.reasoning || undefined,
            codeCitations: [finding.requirementSource].filter(Boolean),
            applicableAreas: [grouping.title],
            sheetReferences: prf.evidenceLocations
              .filter(ev => ev.sheetNumber != null)
              .map(ev => ({ documentId: ev.documentId, sheetNumber: ev.sheetNumber!, label: ev.label })),
            documentReferences: prf.evidenceLocations
              .filter(ev => ev.sheetNumber == null)
              .map(ev => ({ documentId: ev.documentId, label: ev.label })),
          })) ?? [{
            run: 'run-1',
            status: finding.status,
            comment: finding.explanation,
            codeCitations: [finding.requirementSource].filter(Boolean),
            applicableAreas: [grouping.title],
            sheetReferences: sheetRefs.map(s => ({
              documentId: s.documentId,
              sheetNumber: s.sheetNumber,
              label: s.label,
            })),
            documentReferences: docRefs.map(d => ({
              documentId: d.documentId,
              label: d.label,
            })),
          }],
        }],
      };

      return comment;
    });

    return {
      sectionNumber: idx + 1,
      sectionName: grouping.title,
      comments,
    };
  });

  const output = {
    reviewData: {
      metadata: {
        reviewType: 'completeness_check',
        discipline: 'Completeness Check',
        departmentCode: 'cc',
        departmentName: 'Completeness Check',
        checklistVersion: checklistVersion || 'unknown',
        bureauCommitHash: bureauCommitHash || null,
        bureauArtifactPath: bureauArtifactPath || null,
        totalItems: enriched.totals.total,
        passCount: enriched.totals.pass,
        failCount: enriched.totals.fail - (warnCount - unclearCoercedCount),
        warnCount,
        unclearCount: enriched.totals.unclear - unclearCoercedCount,
        notApplicableCount: enriched.totals.notApplicable,
      },
      sections,
    },
  };

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  const totalComments = sections.reduce((sum, s) => sum + s.comments.length, 0);
  console.log(`Built review-comments.json: ${sections.length} sections, ${totalComments} comments`);
  console.log(`Written to: ${outputFile}`);
}

main();
