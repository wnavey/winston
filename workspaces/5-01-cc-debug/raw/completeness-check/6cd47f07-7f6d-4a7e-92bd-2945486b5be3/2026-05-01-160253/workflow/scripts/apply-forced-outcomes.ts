/**
 * Apply Forced Outcomes Script
 *
 * Reads a TSV of forced checklist outcomes and patches per-grouping findings
 * in findingsDir/ with agent-generated narratives for each forced item.
 *
 * The TSV has 3 columns: checklist_id (composite, e.g. cc-3:AF-01),
 * status (pass/fail/warn/not-applicable), explanation (human reason for forcing).
 *
 * For each forced item, calls Claude to generate natural observation/reasoning/
 * resolution text, then overwrites the organic finding in the per-grouping JSON.
 * Forced findings are tagged with forced/forcedReason/organicStatus/forcedStatus
 * so downstream scripts can distinguish them.
 *
 * Exits early (no-op) if no TSV file is provided or it contains no entries.
 *
 * Usage:
 *   npx tsx apply-forced-outcomes.ts \
 *     --forceOutcomesFile=/path/to/forced-outcomes.tsv \
 *     --findingsDir=/path/to/output/findings \
 *     --checklistsDir=/path/to/checklists
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// --- Types ---

interface ForcedOutcome {
  checklistId: string;   // composite: "cc-3:AF-01"
  grouping: string;      // parsed: "cc-3"
  itemId: string;        // parsed: "AF-01"
  status: 'pass' | 'fail' | 'warn' | 'not-applicable';
  explanation: string;
}

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
  // Forced outcome metadata (added by this script)
  forced?: boolean;
  forcedReason?: string;
  forcedStatus?: string;
  organicStatus?: string;
}

interface GroupingResult {
  grouping: string;
  findings: AgentFinding[];
  summary?: string;
}

const VALID_STATUSES = new Set(['pass', 'fail', 'warn', 'not-applicable']);

// --- TSV Parsing ---

function parseTsv(content: string): ForcedOutcome[] {
  const lines = content.split('\n');
  const outcomes: ForcedOutcome[] = [];

  for (const line of lines.slice(1)) { // skip header
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split('\t');
    if (parts.length < 3) {
      console.warn(`WARNING: Skipping malformed TSV line (need 3+ columns): ${trimmed}`);
      continue;
    }

    const [checklistId, status, ...explanationParts] = parts;
    const explanation = explanationParts.join('\t').trim();
    const cleanId = checklistId.trim();
    const cleanStatus = status.trim().toLowerCase();

    if (!VALID_STATUSES.has(cleanStatus)) {
      console.warn(`WARNING: Invalid status "${cleanStatus}" for ${cleanId}, skipping`);
      continue;
    }

    const colonIdx = cleanId.indexOf(':');
    if (colonIdx < 0) {
      console.warn(`WARNING: checklist_id "${cleanId}" missing composite format (grouping:itemId), skipping`);
      continue;
    }

    outcomes.push({
      checklistId: cleanId,
      grouping: cleanId.slice(0, colonIdx),
      itemId: cleanId.slice(colonIdx + 1),
      status: cleanStatus as ForcedOutcome['status'],
      explanation,
    });
  }

  return outcomes;
}

// --- Checklist Item Text Extraction ---

function extractChecklistItemTexts(
  checklistsDir: string,
): Map<string, string> {
  const lookup = new Map<string, string>();
  const files = fs.readdirSync(checklistsDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const markdown = fs.readFileSync(path.join(checklistsDir, file), 'utf-8');
    const groupingId = path.basename(file, '.md');
    const lines = markdown.split('\n');
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
      if (trimmed.startsWith('|--') || trimmed.startsWith('| --')) {
        headerPassed = true;
        continue;
      }
      if (!headerPassed) continue;
      if (!trimmed.startsWith('|')) {
        if (trimmed.startsWith('#')) { inTable = false; headerPassed = false; continue; }
        if (trimmed === '') continue;
        break;
      }
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 2) {
        lookup.set(`${groupingId}:${cells[0]}`, cells[1]);
      }
    }
  }

  return lookup;
}

// --- Claude API Call ---

interface GeneratedNarrative {
  checklistId: string;
  observation: string;
  reasoning: string;
  explanation: string;
  resolution: string | null;
}

async function generateForcedNarratives(
  outcomes: ForcedOutcome[],
  organicFindings: Map<string, AgentFinding>,
  checklistContext: Map<string, string>,
  model: string,
): Promise<Map<string, GeneratedNarrative>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for forced outcome narrative generation');
  }

  const items = outcomes.map(o => {
    const organic = organicFindings.get(o.checklistId);
    return {
      checklistId: o.checklistId,
      forcedStatus: o.status,
      forcedExplanation: o.explanation,
      organicStatus: organic?.status ?? 'unknown',
      organicObservation: organic?.observation ?? '',
      organicReasoning: organic?.reasoning ?? '',
      organicExplanation: organic?.explanation ?? '',
      checklistItemText: checklistContext.get(o.checklistId) ?? '',
    };
  });

  const systemPrompt = `You generate review finding narratives for a site plan completeness check. For each item you receive:
- The forced status (what the human has determined the correct outcome is)
- The human's explanation for why this outcome is being forced
- The organic agent result (what the AI originally determined)
- The checklist item text (what this item checks for)

For each item, produce:
- observation: What was observed on the plan (1-3 sentences). Reference specific sheets/content when the organic finding mentioned them. Acknowledge what was found or not found.
- reasoning: Why this status is correct (2-4 sentences). Incorporate the human's forced explanation naturally. If the organic result differed, briefly note why (e.g., a preprocessing bug, misidentified content). Do not be defensive — state the reasoning matter-of-factly.
- explanation: A concise 6-30 word summary of the determination. Start with the status context (e.g., "Required fire standard notes are present on the plan." for a forced pass).
- resolution: For fail/warn status, provide corrective action text (1-2 sentences). For pass/not-applicable, set to null.

Respond with ONLY a JSON array (no markdown fences). Each element: { "checklistId": "...", "observation": "...", "reasoning": "...", "explanation": "...", "resolution": "..." | null }`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: Math.max(4096, items.length * 300),
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(items) }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    content: { type: string; text?: string }[];
  };

  const textBlock = data.content.find(b => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('No text content in API response');
  }

  // Parse JSON — handle possible markdown code fences
  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const results: GeneratedNarrative[] = JSON.parse(jsonText);

  const map = new Map<string, GeneratedNarrative>();
  for (const r of results) {
    map.set(r.checklistId, r);
  }

  return map;
}

// --- Main ---

async function main() {
  const { values } = parseArgs({
    options: {
      forceOutcomesFile: { type: 'string' },
      findingsDir: { type: 'string' },
      checklistsDir: { type: 'string' },
      model: { type: 'string' },
    },
    strict: true,
  });

  const { forceOutcomesFile, findingsDir, checklistsDir } = values;
  const model = values.model || 'claude-sonnet-4-5-20250929';
  if (!findingsDir) throw new Error('--findingsDir is required');
  if (!checklistsDir) throw new Error('--checklistsDir is required');

  // Early exit if no forced outcomes file
  if (
    !forceOutcomesFile ||
    !fs.existsSync(forceOutcomesFile) ||
    !fs.statSync(forceOutcomesFile).isFile()
  ) {
    console.log('No forced outcomes file provided or file not found — skipping.');
    return;
  }

  const tsvContent = fs.readFileSync(forceOutcomesFile, 'utf-8');
  const outcomes = parseTsv(tsvContent);

  if (outcomes.length === 0) {
    console.log('Forced outcomes file is empty — skipping.');
    return;
  }

  console.log(`Loaded ${outcomes.length} forced outcomes from ${forceOutcomesFile}`);

  // Read per-grouping findings
  const findingFiles = fs.readdirSync(findingsDir).filter(f => f.endsWith('.json'));
  const groupingResults = new Map<string, { fileName: string; data: GroupingResult }>();

  for (const file of findingFiles) {
    const raw = fs.readFileSync(path.join(findingsDir, file), 'utf-8');
    const data: GroupingResult = JSON.parse(raw);
    groupingResults.set(data.grouping, { fileName: file, data });
  }

  // Build organic findings lookup (composite ID -> finding)
  const organicFindings = new Map<string, AgentFinding>();
  for (const [, { data }] of groupingResults) {
    for (const finding of data.findings) {
      const ref = `${data.grouping}:${finding.checklistItemId}`;
      organicFindings.set(ref, finding);
    }
  }

  // Build checklist item text lookup
  const checklistContext = extractChecklistItemTexts(checklistsDir);

  // Validate forced outcomes reference existing findings
  const missing: string[] = [];
  for (const o of outcomes) {
    if (!organicFindings.has(o.checklistId)) {
      missing.push(o.checklistId);
    }
  }
  if (missing.length > 0) {
    console.warn(
      `WARNING: ${missing.length} forced items not found in organic findings: ${missing.join(', ')}`,
    );
  }

  const validOutcomes = outcomes.filter(o => organicFindings.has(o.checklistId));
  if (validOutcomes.length === 0) {
    console.log('No valid forced outcomes match organic findings — skipping.');
    return;
  }

  // Generate narratives via Claude
  console.log(`Generating narratives for ${validOutcomes.length} forced items using ${model}...`);
  const narratives = await generateForcedNarratives(
    validOutcomes,
    organicFindings,
    checklistContext,
    model,
  );

  // Patch findings in-place
  let patched = 0;
  const affectedGroupings = new Set<string>();

  for (const outcome of validOutcomes) {
    const narrative = narratives.get(outcome.checklistId);
    if (!narrative) {
      console.warn(`WARNING: No narrative generated for ${outcome.checklistId}`);
      continue;
    }

    const groupingEntry = groupingResults.get(outcome.grouping);
    if (!groupingEntry) continue;

    const findingIdx = groupingEntry.data.findings.findIndex(
      f => f.checklistItemId === outcome.itemId,
    );
    if (findingIdx < 0) continue;

    const organic = groupingEntry.data.findings[findingIdx];

    // "warn" is derived downstream from fail + checklist failStatus metadata.
    // Store the underlying status in the finding, and the user's intended status
    // in forcedStatus so build-review-comments can apply it directly.
    const findingStatus = outcome.status === 'warn' ? 'fail' : outcome.status;

    groupingEntry.data.findings[findingIdx] = {
      ...organic,
      status: findingStatus as AgentFinding['status'],
      observation: narrative.observation,
      reasoning: narrative.reasoning,
      explanation: narrative.explanation,
      resolution: narrative.resolution,
      tools_used: organic.tools_used || [],
      forced: true,
      forcedReason: outcome.explanation,
      forcedStatus: outcome.status,
      organicStatus: organic.status,
    };

    affectedGroupings.add(outcome.grouping);
    patched++;
  }

  // Write back affected grouping files
  for (const grouping of affectedGroupings) {
    const entry = groupingResults.get(grouping)!;
    fs.writeFileSync(
      path.join(findingsDir, entry.fileName),
      JSON.stringify(entry.data, null, 2),
    );
  }

  console.log(`Patched ${patched} findings across ${affectedGroupings.size} groupings`);
  console.log(`Updated files in: ${findingsDir}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
