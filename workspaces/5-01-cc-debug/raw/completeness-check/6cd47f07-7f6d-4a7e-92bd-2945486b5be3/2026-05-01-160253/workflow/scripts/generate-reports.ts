/**
 * Generate Completeness Check Reports
 *
 * Reads all per-grouping findings JSON files and produces:
 *   1. A consolidated summary report (completeness-check-consolidated-report.md)
 *   2. One detailed report per grouping (reports/<grouping>.md)
 *
 * Usage:
 *   npx tsx generate-reports.ts \
 *     --findingsDir=/path/to/output/findings \
 *     --outputDir=/path/to/output/reports
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

interface EvidenceLocation {
  documentId: string;
  sheetNumber?: number;
  label: string;
}

interface Finding {
  checklistItemId: string;
  status: 'pass' | 'fail' | 'unclear' | 'not-applicable';
  explanation: string;
  evidenceLocations: EvidenceLocation[];
}

interface GroupingResult {
  grouping: string;
  findings: Finding[];
  summary?: string;
}

const STATUS_ICON: Record<string, string> = {
  pass: 'PASS',
  fail: 'FAIL',
  unclear: '????',
  'not-applicable': 'N/A',
};

function main() {
  const { values } = parseArgs({
    options: {
      findingsDir: { type: 'string' },
      outputDir: { type: 'string' },
    },
    strict: true,
  });

  const { findingsDir, outputDir } = values;
  if (!findingsDir) throw new Error('--findingsDir is required');
  if (!outputDir) throw new Error('--outputDir is required');

  // Read all findings files
  const jsonFiles = fs.readdirSync(findingsDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      // Sort cc-1, cc-2, ..., cc-13 numerically
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });

  if (jsonFiles.length === 0) {
    throw new Error(`No .json files found in ${findingsDir}`);
  }

  const groupings: GroupingResult[] = [];
  for (const file of jsonFiles) {
    const raw = fs.readFileSync(path.join(findingsDir, file), 'utf-8');
    groupings.push(JSON.parse(raw));
  }

  // Ensure output directories exist
  const reportsDir = path.join(outputDir, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  // Compute totals
  let totalPass = 0, totalFail = 0, totalUnclear = 0, totalNA = 0;
  for (const g of groupings) {
    for (const f of g.findings) {
      if (f.status === 'pass') totalPass++;
      else if (f.status === 'fail') totalFail++;
      else if (f.status === 'unclear') totalUnclear++;
      else totalNA++;
    }
  }
  const totalItems = totalPass + totalFail + totalUnclear + totalNA;

  // --- Generate consolidated report ---
  const lines: string[] = [];
  lines.push('# Completeness Check — Consolidated Report');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total items | ${totalItems} |`);
  lines.push(`| Pass | ${totalPass} |`);
  lines.push(`| Fail | ${totalFail} |`);
  lines.push(`| Unclear | ${totalUnclear} |`);
  lines.push(`| Not applicable | ${totalNA} |`);
  lines.push('');

  // Failures summary (if any)
  const allFailures = groupings.flatMap(g =>
    g.findings.filter(f => f.status === 'fail').map(f => ({ grouping: g.grouping, ...f }))
  );
  if (allFailures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    lines.push('| Grouping | ID | Explanation |');
    lines.push('|----------|----|-------------|');
    for (const f of allFailures) {
      lines.push(`| ${f.grouping} | ${f.checklistItemId} | ${f.explanation} |`);
    }
    lines.push('');
  }

  // Unclear summary (if any)
  const allUnclear = groupings.flatMap(g =>
    g.findings.filter(f => f.status === 'unclear').map(f => ({ grouping: g.grouping, ...f }))
  );
  if (allUnclear.length > 0) {
    lines.push('## Unclear');
    lines.push('');
    lines.push('| Grouping | ID | Explanation |');
    lines.push('|----------|----|-------------|');
    for (const f of allUnclear) {
      lines.push(`| ${f.grouping} | ${f.checklistItemId} | ${f.explanation} |`);
    }
    lines.push('');
  }

  // Per-grouping summary table
  lines.push('## Results by Grouping');
  lines.push('');
  lines.push('| Grouping | Pass | Fail | Unclear | N/A | Summary |');
  lines.push('|----------|------|------|---------|-----|---------|');
  for (const g of groupings) {
    const counts = { pass: 0, fail: 0, unclear: 0, na: 0 };
    for (const f of g.findings) {
      if (f.status === 'pass') counts.pass++;
      else if (f.status === 'fail') counts.fail++;
      else if (f.status === 'unclear') counts.unclear++;
      else counts.na++;
    }
    const summary = g.summary ? g.summary.replace(/\|/g, '/') : '';
    lines.push(`| ${g.grouping} | ${counts.pass} | ${counts.fail} | ${counts.unclear} | ${counts.na} | ${summary} |`);
  }
  lines.push('');

  // Per-grouping item-level table
  lines.push('## All Items');
  lines.push('');
  for (const g of groupings) {
    lines.push(`### ${g.grouping}`);
    lines.push('');
    lines.push('| ID | Status | Explanation |');
    lines.push('|----|--------|-------------|');
    for (const f of g.findings) {
      lines.push(`| ${f.checklistItemId} | ${STATUS_ICON[f.status]} | ${f.explanation} |`);
    }
    lines.push('');
  }

  const consolidatedPath = path.join(outputDir, 'completeness-check-consolidated-report.md');
  fs.writeFileSync(consolidatedPath, lines.join('\n'));
  console.log(`Consolidated report: ${consolidatedPath}`);

  // --- Generate per-grouping detailed reports ---
  for (const g of groupings) {
    const dl: string[] = [];
    dl.push(`# ${g.grouping} — Detailed Report`);
    dl.push('');
    if (g.summary) {
      dl.push(`> ${g.summary}`);
      dl.push('');
    }

    for (const f of g.findings) {
      dl.push(`## ${f.checklistItemId} — ${STATUS_ICON[f.status]}`);
      dl.push('');
      dl.push(`**Explanation:** ${f.explanation}`);
      dl.push('');

      if (f.evidenceLocations.length > 0) {
        dl.push('**Evidence Locations:**');
        for (const ev of f.evidenceLocations) {
          const sheet = ev.sheetNumber != null ? `, Sheet ${ev.sheetNumber}` : '';
          dl.push(`- ${ev.label}${sheet} (${ev.documentId})`);
        }
      } else {
        dl.push('**Evidence Locations:** None');
      }
      dl.push('');
      dl.push('---');
      dl.push('');
    }

    const reportPath = path.join(reportsDir, `${g.grouping}.md`);
    fs.writeFileSync(reportPath, dl.join('\n'));
  }

  console.log(`Detailed reports: ${groupings.length} files in ${reportsDir}/`);
  console.log(`Totals: ${totalPass} pass, ${totalFail} fail, ${totalUnclear} unclear, ${totalNA} n/a (${totalItems} items)`);
}

main();
