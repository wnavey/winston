/**
 * Extract-Measurement-Pairs Tool
 *
 * Converts a reviewing agent's free-form measurement question into a
 * concrete list of (objectA, objectB) pairs that the existing
 * `measure-distance` tool can consume.
 *
 * This is the arg-construction step that the vision_check classifier
 * routes to when it picks `problemType=measurement`. Without this step,
 * measurement-routed calls fall through to generic vision and the
 * deficiency check returns an unstructured answer.
 *
 * Pipeline:
 *   1. Resolve plan_set_version + sheet_version + PDF for documentId/sheetNum.
 *   2. Find the largest category=drawing content_block on the sheet.
 *   3. Render that block to JPEG via inspect-drawing-impl.py (reused).
 *   4. Call Gemini Vision with the cropped drawing + the agent's
 *      question + the checklist deficiency text. Use the structured-
 *      output prompt in prompts/extract-measurement-pairs/.
 *   5. Parse, validate, write per-call artifacts + the script output.
 *
 * Output shape (written to `outputPath`):
 *   {
 *     pairs: [{objectA, objectB}, ...],   // empty if no pairs found
 *     explanation: "...",                  // always populated
 *     callId: "...",
 *     model: "google/gemini-3.1-pro-preview"
 *   }
 *
 * The caller (conductor's vision-check dispatch) decides what to do
 * with the result: ≥1 pairs → invoke measure-distance; 0 pairs →
 * return `explanation` to the agent as the vision_check answer.
 *
 * Future-improvement notes:
 *   - Coarse-bbox emission to skip measure-distance's call 1 (see
 *     plan in winston/workspaces/vision-tool-orchestration/).
 *   - Multi-drawing-block enumeration (we currently use largest only,
 *     same as inspect-drawing).
 *   - Scale extraction from the title block (currently caller hardcodes).
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import {
  findLargestDrawingBlock,
  resolveSheetPdf,
  type Bbox,
  type DrawingBlockPick,
  type LogFn,
} from './lib/sheet-resolution.js';

// ESM-safe SCRIPT_DIR.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Vercel AI Gateway provider options (inlined; bureau scripts run sandboxed)
// ============================================================================

function buildGatewayProviderOptions(tool: string) {
  const runId = process.env.WORKFLOW_RUN_ID?.trim();
  const runLabel = process.env.RUN_LABEL?.trim();
  const tags: string[] = [`tool:${tool}`];
  if (runLabel) tags.push(`label:${runLabel}`);
  return {
    providerOptions: {
      gateway: {
        ...(runId ? { user: runId } : {}),
        tags,
      },
    },
  };
}

// ============================================================================
// CLI Args
// ============================================================================

const { values } = parseArgs({
  options: {
    projectId: { type: 'string' },
    documentId: { type: 'string' },
    sheetNum: { type: 'string' },
    question: { type: 'string' },
    checklistItemId: { type: 'string' },
    checklistItemText: { type: 'string' },
    regionHint: { type: 'string' },
    classifierReasoning: { type: 'string' },
    outputPath: { type: 'string' },
    dpi: { type: 'string', default: '150' },
  },
  strict: false,
});

let {
  projectId,
  documentId,
  sheetNum,
  question,
  checklistItemId,
  checklistItemText,
  regionHint,
  outputPath,
  dpi,
} = values as Record<string, string>;

// Infer projectId from workspace if not provided — same pattern as
// inspect-drawing.ts and measure-distance.ts.
if (!projectId) {
  const workspacePath = process.env.WORKSPACE_PATH;
  if (workspacePath) {
    const projectsDir = path.join(workspacePath, 'projects');
    if (fs.existsSync(projectsDir)) {
      const entries = fs
        .readdirSync(projectsDir)
        .filter((e) => !e.startsWith('.') && fs.statSync(path.join(projectsDir, e)).isDirectory());
      if (entries.length === 1) {
        projectId = entries[0];
        console.error(`Inferred projectId from workspace: ${projectId}`);
      }
    }
  }
}

if (!documentId || !sheetNum || !question || !outputPath) {
  console.error(
    'Missing required arguments. Required: documentId, sheetNum, question, outputPath. Optional: projectId (inferred from workspace), checklistItemId, checklistItemText, regionHint, classifierReasoning, dpi.',
  );
  process.exit(1);
}

const dpiNum = Number.parseInt(dpi, 10);
if (Number.isNaN(dpiNum) || dpiNum < 72 || dpiNum > 600) {
  console.error(`Invalid dpi: ${dpi}. Must be an integer in [72, 600].`);
  process.exit(1);
}

// ============================================================================
// Per-call identity + logging
// ============================================================================

const CHECKLIST_ITEM = process.env.CHECKLIST_ITEM || undefined;
const RUN_INDEX = process.env.RUN_INDEX || undefined;

function makeCallId(): string {
  const ts = new Date().toISOString().replace(/[-:.]/g, '').replace(/Z$/, 'Z');
  const rand = Math.random().toString(36).slice(2, 6);
  const suffixParts: string[] = [];
  if (RUN_INDEX) suffixParts.push(RUN_INDEX);
  if (CHECKLIST_ITEM) suffixParts.push(CHECKLIST_ITEM.replace(/\.(md|json)$/i, ''));
  const suffix = suffixParts.length ? `-${suffixParts.join('-')}` : '';
  return `${ts}-${rand}${suffix}`;
}

let callId = '';
let callDir = '';
const logEntries: Array<Record<string, unknown>> = [];

const logEvent: LogFn = (event, data = {}) => {
  const entry = {
    event,
    timestamp: Date.now(),
    callId,
    ...(RUN_INDEX !== undefined ? { runIndex: RUN_INDEX } : {}),
    ...(CHECKLIST_ITEM !== undefined ? { checklistItem: CHECKLIST_ITEM } : {}),
    ...data,
  };
  logEntries.push(entry);
  console.error(JSON.stringify(entry));
};

function writeSidecarLog() {
  if (!callDir) return;
  fs.mkdirSync(callDir, { recursive: true });
  fs.writeFileSync(
    path.join(callDir, 'events.jsonl'),
    logEntries.map((e) => JSON.stringify(e)).join('\n'),
  );
}

// ============================================================================
// PDF region rendering — reuse inspect-drawing-impl.py.
// ============================================================================

function renderPdfRegion(
  pdfPath: string,
  bbox: Bbox,
  outPath: string,
  renderDpi: number,
): { width: number; height: number } {
  // Same Python helper as inspect-drawing — it's a generic
  // PyMuPDF-backed render-region implementation despite its name.
  const implPath = path.join(SCRIPT_DIR, 'inspect-drawing-impl.py');
  const pythonBin = process.env.WORKSPACE_PATH
    ? `${process.env.WORKSPACE_PATH}/venv/bin/python3`
    : 'python3';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const result = execFileSync(
    pythonBin,
    [
      implPath,
      '--mode=render-region',
      `--pdfPath=${pdfPath}`,
      `--bbox=${JSON.stringify(bbox)}`,
      `--outPath=${outPath}`,
      `--dpi=${renderDpi}`,
    ],
    { stdio: ['pipe', 'pipe', 'inherit'], timeout: 30_000, encoding: 'utf-8' },
  );

  const trimmed = result.trim();
  if (!trimmed) return { width: 0, height: 0 };
  return JSON.parse(trimmed) as { width: number; height: number };
}

// ============================================================================
// Prompt template
// ============================================================================

function loadPromptTemplate(): string {
  const promptPath = path.resolve(
    SCRIPT_DIR,
    '..',
    'prompts',
    'extract-measurement-pairs',
    'extract-measurement-pairs.md',
  );
  return fs.readFileSync(promptPath, 'utf-8');
}

function buildPrompt(): string {
  const template = loadPromptTemplate();
  const regionHintBlock = regionHint
    ? `\n## Region hint (from the calling agent)\n\nThe agent suggests focusing on: "${regionHint}". Use it if it aligns with what you see; otherwise rely on the full cropped drawing.\n`
    : '';

  return template
    .replace(/\{\{\s*question\s*\}\}/g, question)
    .replace(/\{\{\s*checklistItemText\s*\}\}/g, checklistItemText || '(not provided)')
    .replace(/\{\{\s*regionHintBlock\s*\}\}/g, regionHintBlock);
}

// ============================================================================
// Gemini call
// ============================================================================

interface GeminiResponse {
  objectPairs?: Array<{ objectA?: string; objectB?: string }>;
  explanation?: string;
}

async function callGemini(
  croppedJpegPath: string,
  prompt: string,
): Promise<{ raw: string; parsed: GeminiResponse | null; error?: string }> {
  const imageData = fs.readFileSync(croppedJpegPath);
  const base64 = imageData.toString('base64');

  const t = Date.now();
  let raw = '';
  try {
    const res = await generateText({
      model: gateway('google/gemini-3.1-pro-preview'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: base64, mimeType: 'image/jpeg' },
          ] as any,
        },
      ],
      ...buildGatewayProviderOptions('extract-measurement-pairs'),
    });
    raw = res.text;
    logEvent('extract-measurement-pairs:gemini-response', {
      durationMs: Date.now() - t,
      responseLength: raw.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('extract-measurement-pairs:gemini-error', { error: message, durationMs: Date.now() - t });
    return { raw, parsed: null, error: message };
  }

  let jsonText = raw.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return { raw, parsed: JSON.parse(jsonText) as GeminiResponse };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('extract-measurement-pairs:json-parse-error', { error: message });
    return { raw, parsed: null, error: `JSON parse failed: ${message}` };
  }
}

// ============================================================================
// Output assembly
// ============================================================================

interface ObjectPair {
  objectA: string;
  objectB: string;
}

interface FinalResult {
  pairs: ObjectPair[];
  explanation: string;
  callId: string;
  model: string;
  _meta: Record<string, unknown>;
}

function assembleResult(
  parsed: GeminiResponse | null,
  raw: string,
  geminiError: string | undefined,
  cropBbox: Bbox,
  drawingBlock: DrawingBlockPick | null,
  promptLength: number,
): FinalResult {
  const validationNotes: string[] = [];
  const meta: Record<string, unknown> = {
    callId,
    cropBbox,
    drawingBlock,
    model: 'google/gemini-3.1-pro-preview',
    promptLength,
    validationNotes,
  };

  if (!parsed) {
    validationNotes.push(geminiError || 'No structured response from Gemini.');
    meta.rawResponse = raw;
    return {
      pairs: [],
      explanation:
        'The drawing could not be analysed for measurement pairs (model returned no parseable structured response).',
      callId,
      model: 'google/gemini-3.1-pro-preview',
      _meta: meta,
    };
  }

  // Validate + normalise pairs.
  const rawPairs = Array.isArray(parsed.objectPairs) ? parsed.objectPairs : [];
  const pairs: ObjectPair[] = [];
  for (const p of rawPairs) {
    const a = typeof p?.objectA === 'string' ? p.objectA.trim() : '';
    const b = typeof p?.objectB === 'string' ? p.objectB.trim() : '';
    if (!a || !b) {
      validationNotes.push(
        `Dropped malformed pair: ${JSON.stringify(p)} (missing objectA or objectB).`,
      );
      continue;
    }
    pairs.push({ objectA: a, objectB: b });
  }

  let explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '';
  if (!explanation) {
    explanation = pairs.length > 0
      ? `Identified ${pairs.length} measurement pair${pairs.length === 1 ? '' : 's'} from the drawing.`
      : 'No measurement pairs were identified, and the model did not provide an explanation.';
    validationNotes.push('Explanation field was empty; supplied a default.');
  }

  return {
    pairs,
    explanation,
    callId,
    model: 'google/gemini-3.1-pro-preview',
    _meta: meta,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  callId = makeCallId();
  callDir = path.join(path.dirname(outputPath), 'extract-measurement-pairs-calls', callId);
  fs.mkdirSync(callDir, { recursive: true });

  logEvent('extract-measurement-pairs:start', {
    projectId,
    documentId,
    sheetNum,
    question,
    checklistItemId: checklistItemId || undefined,
    checklistItemText: checklistItemText || undefined,
    regionHint: regionHint || undefined,
    classifierReasoning: (values.classifierReasoning as string) || undefined,
    dpi: dpiNum,
  });

  const sheetNumberInt = Number.parseInt(sheetNum, 10);
  if (Number.isNaN(sheetNumberInt)) {
    logEvent('extract-measurement-pairs:fatal', {
      reason: `sheetNum=${sheetNum} is not parseable as an integer`,
    });
    writeSidecarLog();
    process.exit(1);
  }

  const tmpDir = path.join(callDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  // Resolve plan_set + sheet + PDF.
  let resolved;
  try {
    resolved = await resolveSheetPdf({
      documentId,
      sheetNumber: sheetNumberInt,
      pdfLocalPath: path.join(tmpDir, 'sheet.pdf'),
      logEvent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('extract-measurement-pairs:fatal', { reason: message });
    writeSidecarLog();
    process.exit(1);
  }

  // Find largest drawing block. If none, fall back to full sheet so we
  // can still attempt the extraction (matches inspect-drawing's behaviour).
  const drawingBlock = await findLargestDrawingBlock(resolved.sheetVersionId, logEvent);
  const cropBbox: Bbox = drawingBlock
    ? drawingBlock.bbox
    : { x0: 0, y0: 0, x1: 1, y1: 1 };
  if (!drawingBlock) {
    logEvent('extract-measurement-pairs:crop-fallback', {
      reason: 'no category=drawing content_block found; falling back to full-sheet',
    });
  }

  // Render the cropped region to JPEG.
  const croppedPath = path.join(callDir, 'cropped.jpg');
  const renderResult = renderPdfRegion(resolved.pdfPath, cropBbox, croppedPath, dpiNum);
  logEvent('extract-measurement-pairs:rendered', {
    outPath: 'cropped.jpg',
    dpi: dpiNum,
    width: renderResult.width,
    height: renderResult.height,
  });

  // Build prompt.
  const prompt = buildPrompt();
  fs.writeFileSync(path.join(callDir, 'prompt.txt'), prompt);

  // Gemini call.
  const { raw, parsed, error } = await callGemini(croppedPath, prompt);
  if (raw) fs.writeFileSync(path.join(callDir, 'response.txt'), raw);

  // Assemble + validate.
  const result = assembleResult(parsed, raw, error, cropBbox, drawingBlock, prompt.length);

  // Write per-call metadata.json.
  const metadata = {
    callId,
    inputs: {
      projectId,
      documentId,
      sheetNum,
      question,
      checklistItemId: checklistItemId || null,
      checklistItemText: checklistItemText || null,
      regionHint: regionHint || null,
      classifierReasoning: (values.classifierReasoning as string) || null,
      dpi: dpiNum,
    },
    cropBbox,
    drawingBlock,
    renderResult,
    result,
    timing: { startedAt: logEntries[0]?.timestamp, finishedAt: Date.now() },
  };
  fs.writeFileSync(path.join(callDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Agent-facing output (for runBureauScript on the caller side).
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        pairs: result.pairs,
        explanation: result.explanation,
        callId: result.callId,
        model: result.model,
      },
      null,
      2,
    ),
  );

  logEvent('extract-measurement-pairs:done', {
    pairsFound: result.pairs.length,
    hadExplanation: result.explanation.length > 0,
  });
  writeSidecarLog();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logEvent('extract-measurement-pairs:fatal', { error: message });
  writeSidecarLog();
  console.error(message);
  process.exit(1);
});
