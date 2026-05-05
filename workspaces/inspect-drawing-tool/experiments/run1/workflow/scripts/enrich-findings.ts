/**
 * Enrich Findings Script
 *
 * Reads findings JSONs + checklist markdown files, merges them into a single
 * enriched-findings.json that includes grouping titles and checklist item text.
 *
 * Usage:
 *   npx tsx enrich-findings.ts \
 *     --findingsDir=/path/to/output/findings \
 *     --checklistsDir=/path/to/checklists \
 *     --outputFile=/path/to/enriched-findings.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

interface EvidenceLocation {
  documentId: string;
  sheetNumber?: number;
  label: string;
}

interface RawFinding {
  checklistItemId: string;
  observation?: string;
  reasoning?: string;
  tools_used?: string[];
  status: 'pass' | 'fail' | 'unclear' | 'not-applicable';
  explanation: string;
  evidenceLocations: EvidenceLocation[];
}

interface RawGroupingResult {
  grouping: string;
  findings: RawFinding[];
  summary?: string;
}

type SourceType = 'citation' | 'document' | 'guideline';

type FailStatus = 'fail' | 'warn';

interface ChecklistMeta {
  id: string;
  itemText: string;
  condition: string;
  requirementSource: string;
  sourceType: SourceType;
  failStatus: FailStatus;
}

interface EnrichedFinding extends RawFinding {
  itemText: string;
  condition: string;
  requirementSource: string;
  sourceType: SourceType;
  failStatus: FailStatus;
}

function inferSourceType(value: string): SourceType {
  if (/^(Application Form|Application Sec|Submittal Checklist|General Site Plan|911 Addressing|AW Completeness|Template |Exhibit V|Table with|TxDOT|BSZ Operating)/i.test(value)) return 'document';
  if (/^(TIA Guidelines|PDOP)/i.test(value)) return 'guideline';
  if (value === 'Reviewer Convention') return 'document';
  return 'citation';
}

interface EnrichedGrouping {
  id: string;
  title: string;
  findings: EnrichedFinding[];
  summary?: string;
  counts: { pass: number; fail: number; unclear: number; notApplicable: number; total: number };
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+CC-\d+:\s*(.+)$/m);
  return match ? match[1].trim() : 'Unknown';
}

function extractChecklistItems(markdown: string): ChecklistMeta[] {
  const items: ChecklistMeta[] = [];
  const lines = markdown.split('\n');

  // Find the checklist table — look for header row with ID | Item
  let inTable = false;
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inTable) {
      if (trimmed.startsWith('| ID') && trimmed.includes('Item')) {
        inTable = true;
        continue;
      }
      continue;
    }

    // Skip separator row
    if (trimmed.startsWith('|--') || trimmed.startsWith('| --')) {
      headerPassed = true;
      continue;
    }

    if (!headerPassed) continue;

    // End of table
    if (!trimmed.startsWith('|')) {
      // Could be a sub-header like "### Application & Authorization" — keep scanning
      if (trimmed.startsWith('#')) {
        // New sub-section within checklist — table continues after next header row
        inTable = false;
        continue;
      }
      if (trimmed === '') continue;
      break;
    }

    // Parse table row. Supported formats:
    // 8-col: | ID | Item | Condition | Location | Location Binding | Requirement Source | Source Type | Fail Status |
    // 7-col: | ID | Item | Condition | Location | Location Binding | Requirement Source | Source Type |
    // 5-col: | ID | Item | Condition | Requirement Source | Source Type |
    // 4-col: | ID | Item | Condition | Regulation |
    const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length >= 7) {
      // 7+ column format with Location and Location Binding columns
      const failStatusRaw = cells.length >= 8 ? cells[7].toLowerCase().trim() : '';
      items.push({
        id: cells[0],
        itemText: cells[1],
        condition: cells[2],
        requirementSource: cells[5],
        sourceType: cells[6] as SourceType,
        failStatus: failStatusRaw === 'warn' ? 'warn' : 'fail',
      });
    } else if (cells.length >= 5) {
      items.push({
        id: cells[0],
        itemText: cells[1],
        condition: cells[2],
        requirementSource: cells[3],
        sourceType: cells[4] as SourceType,
        failStatus: 'fail',
      });
    } else if (cells.length >= 4) {
      items.push({
        id: cells[0],
        itemText: cells[1],
        condition: cells[2],
        requirementSource: cells[3],
        sourceType: inferSourceType(cells[3]),
        failStatus: 'fail',
      });
    }
  }

  return items;
}

function main() {
  const { values } = parseArgs({
    options: {
      findingsDir: { type: 'string' },
      checklistsDir: { type: 'string' },
      outputFile: { type: 'string' },
    },
    strict: true,
  });

  const { findingsDir, checklistsDir, outputFile } = values;
  if (!findingsDir) throw new Error('--findingsDir is required');
  if (!checklistsDir) throw new Error('--checklistsDir is required');
  if (!outputFile) throw new Error('--outputFile is required');

  // Read findings files
  const jsonFiles = fs.readdirSync(findingsDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });

  if (jsonFiles.length === 0) {
    throw new Error(`No .json files found in ${findingsDir}`);
  }

  // Read checklist markdown files and build lookup
  const checklistFiles = fs.readdirSync(checklistsDir)
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });

  const titlesByGrouping: Record<string, string> = {};
  const itemsByGrouping: Record<string, Record<string, ChecklistMeta>> = {};

  for (const file of checklistFiles) {
    const markdown = fs.readFileSync(path.join(checklistsDir, file), 'utf-8');
    const groupingId = path.basename(file, '.md');
    titlesByGrouping[groupingId] = extractTitle(markdown);
    const items = extractChecklistItems(markdown);
    itemsByGrouping[groupingId] = {};
    for (const item of items) {
      itemsByGrouping[groupingId][item.id] = item;
    }
  }

  // Merge
  const enrichedGroupings: EnrichedGrouping[] = [];
  let totalPass = 0, totalFail = 0, totalUnclear = 0, totalNA = 0;

  for (const file of jsonFiles) {
    const raw: RawGroupingResult = JSON.parse(
      fs.readFileSync(path.join(findingsDir, file), 'utf-8')
    );

    const groupingId = raw.grouping;
    const title = titlesByGrouping[groupingId] || 'Unknown';
    const itemLookup = itemsByGrouping[groupingId] || {};

    let pass = 0, fail = 0, unclear = 0, na = 0;

    const enrichedFindings: EnrichedFinding[] = raw.findings.map(f => {
      const meta = itemLookup[f.checklistItemId];
      if (f.status === 'pass') { pass++; totalPass++; }
      else if (f.status === 'fail') { fail++; totalFail++; }
      else if (f.status === 'unclear') { unclear++; totalUnclear++; }
      else { na++; totalNA++; }

      return {
        ...f,
        itemText: meta?.itemText || f.checklistItemId,
        condition: meta?.condition || '',
        requirementSource: meta?.requirementSource || '',
        sourceType: meta?.sourceType || 'citation',
        failStatus: meta?.failStatus || 'fail',
      };
    });

    enrichedGroupings.push({
      id: groupingId,
      title,
      findings: enrichedFindings,
      summary: raw.summary,
      counts: { pass, fail, unclear, notApplicable: na, total: pass + fail + unclear + na },
    });
  }

  const output = {
    groupings: enrichedGroupings,
    totals: {
      pass: totalPass,
      fail: totalFail,
      unclear: totalUnclear,
      notApplicable: totalNA,
      total: totalPass + totalFail + totalUnclear + totalNA,
    },
  };

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  console.log(`Enriched findings: ${enrichedGroupings.length} groupings, ${output.totals.total} items`);
  console.log(`Written to: ${outputFile}`);
}

main();
