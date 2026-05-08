/**
 * Assemble Re-Review Script
 *
 * Final assembly step for re-reviews. Combines:
 * 1. Reconciled prior comments (with resolution status) from the comparison step
 * 2. LLM-rewritten headlines/summaries from the rewrite step
 * 3. Newly synthesized comments (if any new findings were found)
 *
 * Into a final review-comments.json in the same format as merge-simplified-comments.ts.
 *
 * Usage:
 *   npx tsx assemble-re-review.ts \
 *     --comparisonFile=/path/to/comparison-result.json \
 *     --rewrittenFile=/path/to/reconciled-comments-rewritten.json \
 *     --newSynthesisFolder=/path/to/05-synthesis \
 *     --factsFile=/path/to/facts.md \
 *     --outputFile=/path/to/review-comments.json \
 *     --bureauCommitHash=abc123 \
 *     --bureauArtifactPath=jurisdictions/austin/review-guides/sduf \
 *     --priorReviewId=uuid-of-prior-review
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// --- Types: comparison result ---

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

interface ConsolidatedFinding {
  ref: string;
  status: string;
  confidence: string;
  runCount: number;
  totalRuns: number;
  findings: Array<{
    run: string;
    status: string;
    comment: string | null;
    codeCitations: string[];
    applicableAreas: string[];
    sheetReferences: { documentId: string; sheetNumber: number }[];
    documentReferences: { documentId: string; label: string }[];
  }>;
}

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

interface ComparisonResult {
  reconciledComments: ReconciledComment[];
  newFindings: ConsolidatedFinding[];
  stats: {
    priorCommentCount: number;
    priorDetailCount: number;
    resolvedCount: number;
    outstandingCount: number;
    newFindingCount: number;
    matchRate: number;
  };
}

// --- Types: rewritten comments ---

interface Rewrite {
  commentIndex: number;
  headline: string;
  summary: string;
}

interface RewrittenFile {
  rewrites: Rewrite[];
}

// --- Types: new synthesis ---

interface SynthesizedComment {
  headline: string;
  summary: string;
  sheets: number[];
  applicableArea: string;
  severity: number;
  confidence: number;
  crossDep: string | null;
  attn: string | null;
  details: Array<{
    text: string;
    citation: string;
    sourceId: string;
    confidence: number;
    runComments: RunComment[];
  }>;
}

interface SynthesizedFile {
  comments: SynthesizedComment[];
}

// --- Types: output ---

interface OutputDetail {
  text: string;
  citation: string;
  sourceId: string;
  confidence: number;
  resolved?: boolean;
  runComments: RunComment[];
}

interface OutputComment {
  section: string;
  commentNumber: number;
  headline: string;
  summary: string;
  severity: number;
  confidence: number;
  sheets: number[];
  applicableArea: string;
  crossDep: string | null;
  attn: string | null;
  fullyResolved: boolean;
  priorCommentId: string | null;
  details: OutputDetail[];
}

// --- Helpers ---

function slugify(label: string, existing: Set<string>): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!base) base = 'section';
  let slug = base;
  let n = 2;
  while (existing.has(slug)) {
    slug = `${base}-${n++}`;
  }
  existing.add(slug);
  return slug;
}

function parseFactsMetadata(factsContent: string): {
  discipline: string;
  programs: { name: string; status: string; governs: string }[];
} {
  const programs: { name: string; status: string; governs: string }[] = [];

  const zoningMatch = factsContent.match(/\*\*Zoning\*\*:\s*(.+)/);
  if (zoningMatch) {
    programs.push({
      name: zoningMatch[1].trim(),
      status: 'Active',
      governs: 'Land use and development standards',
    });
  }

  const npMatch = factsContent.match(/\*\*Neighborhood Plan\*\*:\s*(.+)/);
  if (npMatch && npMatch[1].trim() !== 'None') {
    programs.push({
      name: npMatch[1].trim(),
      status: 'Active',
      governs: 'Neighborhood-level land use policies',
    });
  }

  const ldcMatch = factsContent.match(/\*\*LDC Exception\*\*:\s*(.+)/);
  if (ldcMatch) {
    programs.push({
      name: ldcMatch[1].trim(),
      status: 'Applied',
      governs: 'Code exception for redevelopment',
    });
  }

  const bszMatch = factsContent.match(/\*\*Barton Springs Zone\*\*:\s*Yes/);
  if (bszMatch) {
    programs.push({
      name: 'Barton Springs Zone',
      status: 'Active',
      governs: 'Environmental protection requirements',
    });
  }

  const discipline = 'Site/Civil Engineering';

  return { discipline, programs };
}

function buildRunCommentsFromFinding(finding: ConsolidatedFinding): RunComment[] {
  return finding.findings.map(f => {
    const runMatch = f.run.match(/(\d+)/);
    const runNum = runMatch ? parseInt(runMatch[1], 10) : 0;
    return {
      runNum,
      status: f.status,
      comment: f.comment || '',
    };
  });
}

// --- Main ---

function main() {
  const { values } = parseArgs({
    options: {
      comparisonFile: { type: 'string' },
      rewrittenFile: { type: 'string' },
      newSynthesisFolder: { type: 'string' },
      factsFile: { type: 'string' },
      outputFile: { type: 'string' },
      bureauCommitHash: { type: 'string' },
      bureauArtifactPath: { type: 'string' },
      priorReviewId: { type: 'string' },
    },
    strict: true,
  });

  const { comparisonFile, rewrittenFile, newSynthesisFolder, factsFile, outputFile, bureauCommitHash, bureauArtifactPath, priorReviewId } = values;

  if (!comparisonFile) throw new Error('--comparisonFile is required');
  if (!rewrittenFile) throw new Error('--rewrittenFile is required');
  if (!factsFile) throw new Error('--factsFile is required');
  if (!outputFile) throw new Error('--outputFile is required');

  if (!fs.existsSync(comparisonFile)) {
    throw new Error(`Comparison file not found: ${comparisonFile}`);
  }
  if (!fs.existsSync(rewrittenFile)) {
    throw new Error(`Rewritten file not found: ${rewrittenFile}`);
  }
  if (!fs.existsSync(factsFile)) {
    throw new Error(`Facts file not found: ${factsFile}`);
  }

  const comparison: ComparisonResult = JSON.parse(fs.readFileSync(comparisonFile, 'utf-8'));
  const rewritten: RewrittenFile = JSON.parse(fs.readFileSync(rewrittenFile, 'utf-8'));
  const factsContent = fs.readFileSync(factsFile, 'utf-8');
  const factsMeta = parseFactsMetadata(factsContent);

  const rewriteMap = new Map<number, Rewrite>();
  for (const rw of rewritten.rewrites) {
    rewriteMap.set(rw.commentIndex, rw);
  }

  // 1. Build reconciled output comments from prior comments
  const reconciledOutputComments: OutputComment[] = [];

  for (let i = 0; i < comparison.reconciledComments.length; i++) {
    const rc = comparison.reconciledComments[i];
    const prior = rc.priorComment;
    const rw = rewriteMap.get(i);

    const details: OutputDetail[] = rc.details.map(d => {
      const detail: OutputDetail = {
        text: d.priorDetail.text,
        citation: d.priorDetail.citation,
        sourceId: d.priorDetail.sourceId,
        confidence: d.priorDetail.confidence,
        resolved: d.resolved,
        runComments: d.resolved
          ? d.priorDetail.runComments
          : d.newFinding
            ? buildRunCommentsFromFinding(d.newFinding)
            : d.priorDetail.runComments,
      };
      return detail;
    });

    let severity = prior.severity;
    if (rc.allResolved) {
      severity = 0;
    } else if (rc.resolvedCount > 0 && rc.outstandingCount > 0) {
      const resolvedRatio = rc.resolvedCount / (rc.resolvedCount + rc.outstandingCount);
      if (resolvedRatio >= 0.5 && severity > 1) {
        severity = severity - 1;
      }
    }

    reconciledOutputComments.push({
      section: prior.section,
      commentNumber: prior.commentNumber,
      headline: rw ? rw.headline : prior.headline,
      summary: rw ? rw.summary : prior.summary,
      severity,
      confidence: prior.confidence,
      sheets: prior.sheets,
      applicableArea: prior.applicableArea,
      crossDep: prior.crossDep,
      attn: prior.attn,
      fullyResolved: rc.allResolved,
      priorCommentId: prior._dbId,
      details,
    });
  }

  // 2. Load new synthesized comments (if folder exists)
  const newOutputComments: OutputComment[] = [];
  let newSynthesisCount = 0;

  if (newSynthesisFolder && fs.existsSync(newSynthesisFolder)) {
    const files = fs.readdirSync(newSynthesisFolder)
      .filter(f => f.endsWith('.json'))
      .sort();

    for (const file of files) {
      const filePath = path.join(newSynthesisFolder, file);
      let parsed: SynthesizedFile;
      try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        console.warn(`Warning: skipping invalid JSON in ${filePath}`);
        continue;
      }

      if (!parsed.comments || !Array.isArray(parsed.comments)) {
        console.warn(`Warning: ${filePath} missing "comments" array, skipping`);
        continue;
      }

      for (const c of parsed.comments) {
        newSynthesisCount++;
        newOutputComments.push({
          section: '',
          commentNumber: 0,
          headline: c.headline,
          summary: c.summary,
          severity: c.severity,
          confidence: c.confidence,
          sheets: c.sheets,
          applicableArea: c.applicableArea,
          crossDep: c.crossDep,
          attn: c.attn,
          fullyResolved: false,
          priorCommentId: null,
          details: c.details.map(d => ({
            text: d.text,
            citation: d.citation,
            sourceId: d.sourceId,
            confidence: d.confidence,
            runComments: d.runComments,
          })),
        });
      }

      console.log(`Loaded new synthesis ${file}: ${parsed.comments.length} comments`);
    }
  }

  // 3. Collect all section slugs from prior comments, preserving order
  const sectionSlugs = new Set<string>();
  const sectionOrder: string[] = [];
  for (const c of reconciledOutputComments) {
    if (!sectionSlugs.has(c.section)) {
      sectionSlugs.add(c.section);
      sectionOrder.push(c.section);
    }
  }

  const CATCHALL_LABEL = 'Plan Documentation & Administrative';
  const usedSlugs = new Set<string>(sectionSlugs);
  const catchAllSlug = sectionSlugs.has('plan-documentation-administrative')
    ? 'plan-documentation-administrative'
    : slugify(CATCHALL_LABEL, usedSlugs);

  for (const c of newOutputComments) {
    c.section = catchAllSlug;
  }

  if (newOutputComments.length > 0 && !sectionSlugs.has(catchAllSlug)) {
    sectionOrder.push(catchAllSlug);
    sectionSlugs.add(catchAllSlug);
  }

  // 4. Build sections array
  const sections: { slug: string; label: string; summary: string }[] = sectionOrder.map(slug => {
    if (slug === catchAllSlug && !reconciledOutputComments.some(c => c.section === slug)) {
      return { slug, label: CATCHALL_LABEL, summary: 'New findings identified during re-review.' };
    }
    return { slug, label: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), summary: '' };
  });

  // 5. Sort: outstanding by severity desc, then resolved, then new
  const outstanding = reconciledOutputComments.filter(c => !c.fullyResolved);
  const resolved = reconciledOutputComments.filter(c => c.fullyResolved);

  outstanding.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));
  resolved.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));
  newOutputComments.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));

  const allComments = [...outstanding, ...resolved, ...newOutputComments];

  // 6. Assign commentNumber: inherited comments keep prior number, new get next available
  const maxInherited = Math.max(0, ...reconciledOutputComments.map(c => c.commentNumber));
  let nextNum = maxInherited + 1;
  for (const c of newOutputComments) {
    c.commentNumber = nextNum++;
  }

  // 7. Generate review date
  const now = new Date();
  const reviewDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // 8. Assemble final output
  const reReviewStats = {
    resolvedCount: comparison.stats.resolvedCount,
    outstandingCount: comparison.stats.outstandingCount,
    newCount: newSynthesisCount,
  };

  const output = {
    reviewData: {
      metadata: {
        discipline: factsMeta.discipline,
        reviewDate,
        programs: factsMeta.programs,
        bureauCommitHash: bureauCommitHash || null,
        bureauArtifactPath: bureauArtifactPath || null,
        priorReviewId: priorReviewId || null,
        reReviewStats,
      },
      sections,
      comments: allComments,
    },
  };

  // 9. Write output
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  // 10. Summary stats
  const totalDetails = allComments.reduce((sum, c) => sum + c.details.length, 0);

  console.log(`\n--- Re-Review Assembly Summary ---`);
  console.log(`Sections: ${sections.length}`);
  console.log(`Outstanding comments: ${outstanding.length}`);
  console.log(`Resolved comments: ${resolved.length}`);
  console.log(`New comments: ${newOutputComments.length}`);
  console.log(`Total comments: ${allComments.length}`);
  console.log(`Total details: ${totalDetails}`);
  console.log(`Resolved details: ${reReviewStats.resolvedCount}`);
  console.log(`Outstanding details: ${reReviewStats.outstandingCount}`);
  console.log(`Review date: ${reviewDate}`);
  console.log(`Prior review ID: ${priorReviewId || 'none'}`);
  console.log(`Written to: ${outputFile}`);
}

main();
