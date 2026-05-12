/**
 * Inspect-Drawing Tool — Phase 1 (single-pass MVP)
 *
 * Answers a structured question about a site plan sheet's drawing area
 * using Gemini Vision. Distinct from the generic `vision` tool: scoped to
 * drawing-region reasoning (lines, symbols, spatial relationships), with
 * a typed structured output the calling agent can branch on.
 *
 * Pipeline (single pass):
 *   1. Resolve plan_set_version + sheet_version from documentId/sheetNum.
 *   2. Download sheet PDF.
 *   3. Resolve crop region from `cropMode`:
 *        - drawing (default): largest category='drawing' content_block
 *        - full-sheet:        whole page
 *        - block:<id>:        a specific content block by id
 *      If `cropMode=drawing` resolves to no drawing block, auto-fall back
 *      to full-sheet and flag in `_meta.cropFallback`.
 *   4. Render the crop region to JPEG via PyMuPDF at the configured DPI.
 *   5. Build the prompt from the template at prompts/inspect-drawing/inspect-drawing.md
 *      with the question, expectedAnswerType, and regionHint substituted in.
 *   6. Call Gemini once. Parse JSON. Run validation rules:
 *        - boolean classification ∈ {yes, partial} with empty evidence  → unanswerable
 *        - count > 0 with evidence.length !== count                      → unanswerable
 *   7. Write per-call artifacts and the result JSON.
 *
 * Phase 2 (two-pass refined crop) and Phase 3 (per-question reference
 * images) are not implemented yet. See the design plan in
 * winston/workspaces/inspect-drawing-tool/design-plan.md.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createClient } from '@supabase/supabase-js';
import {
  getPlanSetVersionId as libGetPlanSetVersionId,
  resolveSubmissionVersionId,
} from './lib/sheet-resolution.js';

// ESM-safe equivalent of CommonJS SCRIPT_DIR (this script runs under tsx as ESM).
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
    submissionVersionId: { type: 'string' },
    question: { type: 'string' },
    expectedAnswerType: { type: 'string', default: 'boolean' },
    cropMode: { type: 'string', default: 'drawing' },
    regionHint: { type: 'string' },
    reasoning: { type: 'string' },
    applicable_checklist_items: { type: 'string' },
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
  expectedAnswerType,
  cropMode,
  regionHint,
  outputPath,
  dpi,
} = values as Record<string, string>;

// Resolve submissionVersionId: explicit CLI arg first, fall back to
// WORKSPACE_PATH/workflow/status.json (conductor-managed flow). Fail
// loudly if neither is available — see lib/sheet-resolution.ts for why
// the previous "latest by created_at" fallback was a footgun.
const submissionVersionId = resolveSubmissionVersionId(values.submissionVersionId as string);

// Infer projectId from workspace if not provided — same pattern as
// measure-distance and semantic-search-blocks.
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
    'Missing required arguments. Required: documentId, sheetNum, question, outputPath. Optional: projectId (inferred from workspace), submissionVersionId (resolved from CLI or workflow/status.json), expectedAnswerType, cropMode, regionHint, dpi.',
  );
  process.exit(1);
}
if (!projectId) {
  console.error('projectId not provided and could not be inferred from workspace.');
  process.exit(1);
}
if (!submissionVersionId) {
  console.error(
    'Could not resolve submissionVersionId — neither --submissionVersionId CLI arg nor WORKSPACE_PATH/workflow/status.json provided one. Bureau scripts cannot safely guess which submission to scope plan_set_version lookups to.',
  );
  process.exit(1);
}

const VALID_ANSWER_TYPES = new Set(['boolean', 'count', 'description']);
if (!VALID_ANSWER_TYPES.has(expectedAnswerType)) {
  console.error(
    `Invalid expectedAnswerType: ${expectedAnswerType}. Must be one of boolean, count, description.`,
  );
  process.exit(1);
}

const dpiNum = Number.parseInt(dpi, 10);
if (Number.isNaN(dpiNum) || dpiNum < 72 || dpiNum > 600) {
  console.error(`Invalid dpi: ${dpi}. Must be an integer in [72, 600].`);
  process.exit(1);
}

// cropMode forms:
//   drawing
//   full-sheet
//   block:<contentBlockId>
let cropModeKind: 'drawing' | 'full-sheet' | 'block';
let cropModeBlockId: string | undefined;
if (cropMode === 'drawing') {
  cropModeKind = 'drawing';
} else if (cropMode === 'full-sheet') {
  cropModeKind = 'full-sheet';
} else if (cropMode.startsWith('block:')) {
  cropModeKind = 'block';
  cropModeBlockId = cropMode.slice('block:'.length);
  if (!cropModeBlockId) {
    console.error('cropMode=block:<id> requires a content block id after the colon.');
    process.exit(1);
  }
} else {
  console.error(
    `Invalid cropMode: ${cropMode}. Must be 'drawing', 'full-sheet', or 'block:<contentBlockId>'.`,
  );
  process.exit(1);
}

// ============================================================================
// Supabase
// ============================================================================

function getSupabase() {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

async function getSheetVersionId(
  planSetVersionId: string,
  sheetNumber: number,
): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('sheet_version')
    .select('id')
    .eq('plan_set_version_id', planSetVersionId)
    .eq('sheet_number', sheetNumber)
    .single();
  return data?.id ?? null;
}

/**
 * Fetch the PDF storage path for a sheet, given its already-resolved
 * sheet_version_id. Caller is expected to have run libGetPlanSetVersionId
 * + getSheetVersionId once and to pass the result here.
 */
async function getSheetPdfStoragePath(sheetVersionId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('sheet_version')
    .select('storage_path')
    .eq('id', sheetVersionId)
    .single();
  return data?.storage_path ?? null;
}

interface CropResolution {
  bbox: Record<string, number>; // {x0,y0,x1,y1} normalized 0-1
  source: 'drawing-block' | 'full-sheet' | 'specified-block';
  blockId?: string;
  fallbackFromDrawing?: boolean;
}

/**
 * Normalize the DB bbox shape — content_block.bounding_box may be
 * stored as either {x0,y0,x1,y1} or {x,y,width,height}.
 */
function normalizeBbox(bb: Record<string, number> | null): Record<string, number> | null {
  if (!bb) return null;
  const x0 = bb.x0 ?? bb.x ?? bb.left ?? 0;
  const y0 = bb.y0 ?? bb.y ?? bb.top ?? 0;
  const x1 =
    bb.x1 ??
    (bb.x != null && bb.width != null ? bb.x + bb.width : undefined) ??
    bb.right ??
    1;
  const y1 =
    bb.y1 ??
    (bb.y != null && bb.height != null ? bb.y + bb.height : undefined) ??
    bb.bottom ??
    1;
  return { x0, y0, x1, y1 };
}

async function findLargestDrawingBlock(
  sheetVersionId: string,
): Promise<Record<string, number> | null> {
  const supabase = getSupabase();
  const { data: blocks } = await supabase
    .from('content_block')
    .select('id, bounding_box, category')
    .eq('sheet_version_id', sheetVersionId)
    .eq('category', 'drawing');
  if (!blocks?.length) {
    logEvent('inspect-drawing:drawing-blocks-considered', { count: 0, blocks: [] });
    return null;
  }

  // Compute area for every drawing block on the sheet so we can log the full
  // distribution before picking the largest. Lets post-hoc analysis answer
  // "how often was the picked block dominant vs co-equal with others?" without
  // a separate DB join.
  type Sized = { id: string; bbox: Record<string, number>; area: number };
  const sized: Sized[] = [];
  for (const block of blocks) {
    const bb = normalizeBbox(block.bounding_box as Record<string, number> | null);
    if (!bb) continue;
    sized.push({
      id: block.id as string,
      bbox: bb,
      area: (bb.x1 - bb.x0) * (bb.y1 - bb.y0),
    });
  }
  if (!sized.length) {
    logEvent('inspect-drawing:drawing-blocks-considered', {
      count: blocks.length,
      blocks: [],
      reason: 'all bounding_box entries failed to normalize',
    });
    return null;
  }

  sized.sort((a, b) => b.area - a.area);
  const best = sized[0];

  logEvent('inspect-drawing:drawing-blocks-considered', {
    count: sized.length,
    pickedBlockId: best.id,
    pickedAreaFraction: best.area,
    pickedDominanceRatio:
      sized.length > 1 && sized[1].area > 0 ? best.area / sized[1].area : null,
    blocks: sized.map((s) => ({
      blockId: s.id,
      areaFraction: s.area,
      bbox: s.bbox,
    })),
  });

  return best.bbox;
}

async function findBlockById(blockId: string): Promise<Record<string, number> | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('content_block')
    .select('bounding_box')
    .eq('id', blockId)
    .single();
  if (!data?.bounding_box) return null;
  return normalizeBbox(data.bounding_box as Record<string, number>);
}

async function downloadAsset(
  storagePath: string,
  localPath: string,
  bucket = 'submission-data',
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) {
    throw new Error(`Failed to download from ${bucket}: ${storagePath}: ${error?.message}`);
  }
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
  return localPath;
}

// ============================================================================
// Per-call identity + logging
// ============================================================================

const CHECKLIST_ITEM = process.env.CHECKLIST_ITEM || undefined;
const CHECKLIST_INDEX = process.env.CHECKLIST_INDEX || undefined;
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

function logEvent(event: string, data: Record<string, unknown> = {}) {
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
}

function writeSidecarLog() {
  if (!callDir) return;
  fs.mkdirSync(callDir, { recursive: true });
  fs.writeFileSync(
    path.join(callDir, 'events.jsonl'),
    logEntries.map((e) => JSON.stringify(e)).join('\n'),
  );
}

// ============================================================================
// PDF region rendering (delegates to inspect-drawing-impl.py)
// ============================================================================

function renderPdfRegion(
  pdfPath: string,
  bbox: Record<string, number>,
  outPath: string,
  renderDpi: number,
): { width: number; height: number } {
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

/**
 * Load the prompt template, lifted from prompts/inspect-drawing/inspect-drawing.md
 * at runtime so it can be iterated on without rebuilding the script.
 *
 * Template uses {{ question }}, {{ expectedAnswerType }}, {{ regionHint }},
 * {{ regionHintBlock }} placeholders.
 */
function loadPromptTemplate(): string {
  // Template lives at <workflow>/prompts/inspect-drawing/inspect-drawing.md.
  // SCRIPT_DIR here is .../completeness-check/scripts.
  const promptPath = path.resolve(
    SCRIPT_DIR,
    '..',
    'prompts',
    'inspect-drawing',
    'inspect-drawing.md',
  );
  return fs.readFileSync(promptPath, 'utf-8');
}

function buildPrompt(): string {
  const template = loadPromptTemplate();
  const regionHintBlock = regionHint
    ? `\n## Region hint (hypothesis from the calling agent)\n\nThe agent suggests the relevant area is: "${regionHint}".\n\nTreat this as a hint, not a constraint. If the hint looks correct, use it. If it does not match what you actually see, locate the correct region yourself and answer based on that. Set \`regionHintHonored=false\` if you had to relocate.\n`
    : '\n## Region hint\n\nNone provided. Search the cropped region as a whole.\n';

  return template
    .replace(/\{\{\s*question\s*\}\}/g, question)
    .replace(/\{\{\s*expectedAnswerType\s*\}\}/g, expectedAnswerType)
    .replace(/\{\{\s*regionHintBlock\s*\}\}/g, regionHintBlock);
}

// ============================================================================
// Gemini call
// ============================================================================

interface GeminiResponse {
  answerText?: string;
  classification?: 'yes' | 'no' | 'partial' | null;
  count?: number | null;
  unanswerable?: boolean;
  confidence?: number;
  evidence?: Array<{
    bbox?: number[]; // [y0, x0, y1, x1] in 0-1000
    description?: string;
  }>;
  reasoning?: string;
  regionHintHonored?: boolean;
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
      ...buildGatewayProviderOptions('inspect-drawing'),
    });
    raw = res.text;
    logEvent('inspect-drawing:gemini-response', {
      durationMs: Date.now() - t,
      responseLength: raw.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('inspect-drawing:gemini-error', { error: message, durationMs: Date.now() - t });
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
    logEvent('inspect-drawing:json-parse-error', { error: message });
    return { raw, parsed: null, error: `JSON parse failed: ${message}` };
  }
}

// ============================================================================
// Output validation + assembly
// ============================================================================

interface EvidenceItem {
  bbox: [number, number, number, number]; // [y0, x0, y1, x1] Gemini 0-1000
  bboxAbsolute: { x0: number; y0: number; x1: number; y1: number }; // page-relative 0-1
  description: string;
}

/**
 * Map a Gemini 0-1000 [y0,x0,y1,x1] bbox (relative to the cropped image)
 * back to absolute page-relative 0-1 [x0,y0,x1,y1] using the crop's bbox.
 */
function geminiBboxToAbsolute(
  geminiBbox: number[],
  cropBbox: Record<string, number>,
): { x0: number; y0: number; x1: number; y1: number } {
  const [gy0, gx0, gy1, gx1] = geminiBbox;
  // Gemini uses 0-1000 normalized. Map to 0-1 within the crop, then to page coords.
  const cw = cropBbox.x1 - cropBbox.x0;
  const ch = cropBbox.y1 - cropBbox.y0;
  return {
    x0: cropBbox.x0 + (gx0 / 1000) * cw,
    y0: cropBbox.y0 + (gy0 / 1000) * ch,
    x1: cropBbox.x0 + (gx1 / 1000) * cw,
    y1: cropBbox.y0 + (gy1 / 1000) * ch,
  };
}

interface FinalResult {
  answerText: string;
  classification: 'yes' | 'no' | 'partial' | null;
  count: number | null;
  unanswerable: boolean;
  confidence: number;
  evidence: EvidenceItem[];
  reasoning: string;
  regionHintHonored: boolean | null;
  _meta: Record<string, unknown>;
}

function assembleResult(
  parsed: GeminiResponse | null,
  raw: string,
  geminiError: string | undefined,
  cropBbox: Record<string, number>,
  cropResolution: CropResolution,
  promptLength: number,
): FinalResult {
  const validationNotes: string[] = [];

  if (!parsed) {
    validationNotes.push(geminiError || 'No structured response from Gemini.');
    return {
      answerText:
        'The model did not return a parseable structured response. See _meta.rawResponse and validationNotes.',
      classification: null,
      count: null,
      unanswerable: true,
      confidence: 0,
      evidence: [],
      reasoning: '',
      regionHintHonored: null,
      _meta: {
        callId,
        expectedAnswerType,
        cropMode,
        cropResolution,
        cropBbox,
        model: 'google/gemini-3.1-pro-preview',
        promptLength,
        rawResponse: raw,
        validationNotes,
      },
    };
  }

  // Map evidence bboxes from Gemini space to page-relative absolute coordinates.
  const evidence: EvidenceItem[] = (parsed.evidence ?? [])
    .filter((e) => Array.isArray(e.bbox) && e.bbox.length === 4)
    .map((e) => {
      const bb = e.bbox as number[];
      return {
        bbox: [bb[0], bb[1], bb[2], bb[3]] as [number, number, number, number],
        bboxAbsolute: geminiBboxToAbsolute(bb, cropBbox),
        description: e.description ?? '',
      };
    });

  let classification: 'yes' | 'no' | 'partial' | null =
    expectedAnswerType === 'boolean' && parsed.classification != null
      ? (parsed.classification as 'yes' | 'no' | 'partial')
      : null;
  let count: number | null =
    expectedAnswerType === 'count' && typeof parsed.count === 'number' ? parsed.count : null;
  let unanswerable = parsed.unanswerable === true;

  // Validation rule: positive boolean classification with no evidence → unanswerable.
  if (
    expectedAnswerType === 'boolean' &&
    (classification === 'yes' || classification === 'partial') &&
    evidence.length === 0
  ) {
    validationNotes.push(
      `classification=${classification} but evidence is empty; downgrading to unanswerable.`,
    );
    unanswerable = true;
    classification = null;
  }

  // Validation rule: count > 0 with mismatched evidence length → unanswerable.
  if (expectedAnswerType === 'count' && count != null && count > 0 && evidence.length !== count) {
    validationNotes.push(
      `count=${count} but evidence.length=${evidence.length}; downgrading to unanswerable.`,
    );
    unanswerable = true;
    count = null;
  }

  // Validation rule: unanswerable=true must null out typed fields.
  if (unanswerable) {
    classification = null;
    count = null;
  }

  const confidence =
    typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : unanswerable
        ? 0
        : 0.5;

  return {
    answerText: parsed.answerText ?? '',
    classification,
    count,
    unanswerable,
    confidence,
    evidence,
    reasoning: parsed.reasoning ?? '',
    regionHintHonored:
      typeof parsed.regionHintHonored === 'boolean' ? parsed.regionHintHonored : null,
    _meta: {
      callId,
      expectedAnswerType,
      cropMode,
      cropResolution,
      cropBbox,
      model: 'google/gemini-3.1-pro-preview',
      promptLength,
      validationNotes,
    },
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  callId = makeCallId();
  callDir = path.join(path.dirname(outputPath), 'inspect-drawing-calls', callId);
  fs.mkdirSync(callDir, { recursive: true });

  let applicableChecklistItems: unknown = undefined;
  if (values.applicable_checklist_items) {
    try {
      applicableChecklistItems = JSON.parse(values.applicable_checklist_items as string);
    } catch {
      applicableChecklistItems = values.applicable_checklist_items;
    }
  }

  logEvent('inspect-drawing:start', {
    projectId,
    documentId,
    submissionVersionId,
    sheetNum,
    question,
    expectedAnswerType,
    cropMode,
    regionHint: regionHint || undefined,
    reasoning: (values.reasoning as string) || undefined,
    applicableChecklistItems,
    dpi: dpiNum,
  });

  // Resolve plan_set + sheet_version once. Scoped by submissionVersionId
  // (resolved at module load from the CLI arg or workflow/status.json) so
  // we always look up the plan_set_version tied to *this* workflow's
  // submission rather than guessing.
  const planSetVersionId = await libGetPlanSetVersionId(
    documentId,
    submissionVersionId,
    logEvent,
  );
  if (!planSetVersionId) {
    logEvent('inspect-drawing:fatal', {
      reason: `Could not resolve plan_set_version for documentId=${documentId}`,
    });
    writeSidecarLog();
    process.exit(1);
  }
  const sheetNumberInt = Number.parseInt(sheetNum, 10);
  if (Number.isNaN(sheetNumberInt)) {
    logEvent('inspect-drawing:fatal', {
      reason: `sheetNum=${sheetNum} is not parseable as an integer`,
    });
    writeSidecarLog();
    process.exit(1);
  }
  const sheetVersionId = await getSheetVersionId(planSetVersionId, sheetNumberInt);
  if (!sheetVersionId) {
    logEvent('inspect-drawing:fatal', {
      reason: `Could not resolve sheet_version for planSetVersionId=${planSetVersionId} sheetNumber=${sheetNumberInt}`,
    });
    writeSidecarLog();
    process.exit(1);
  }

  // Resolve the PDF storage path. We re-use sheetVersionId here instead of
  // re-running libGetPlanSetVersionId + getSheetVersionId inside a
  // dedicated lookup helper (saves two Supabase round-trips per call).
  const pdfStoragePath = await getSheetPdfStoragePath(sheetVersionId);
  if (!pdfStoragePath) {
    logEvent('inspect-drawing:fatal', {
      reason: `Could not resolve storage_path for sheet_version_id=${sheetVersionId}`,
    });
    writeSidecarLog();
    process.exit(1);
  }
  const bucket = 'submission-data';

  const tmpDir = path.join(callDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const pdfPath = await downloadAsset(pdfStoragePath, path.join(tmpDir, 'sheet.pdf'), bucket);

  // Resolve crop bbox.
  const fullSheetBbox = { x0: 0, y0: 0, x1: 1, y1: 1 };
  let cropResolution: CropResolution;

  if (cropModeKind === 'full-sheet') {
    cropResolution = { bbox: fullSheetBbox, source: 'full-sheet' };
  } else if (cropModeKind === 'block') {
    const bb = await findBlockById(cropModeBlockId!);
    if (!bb) {
      logEvent('inspect-drawing:fatal', {
        reason: `cropMode=block:${cropModeBlockId} but no content_block with that id was found.`,
      });
      writeSidecarLog();
      process.exit(1);
    }
    cropResolution = { bbox: bb, source: 'specified-block', blockId: cropModeBlockId };
  } else {
    // drawing
    let bb: Record<string, number> | null = null;
    bb = await findLargestDrawingBlock(sheetVersionId);
    if (!bb) {
      logEvent('inspect-drawing:crop-fallback', {
        reason: 'no category=drawing content_block found; falling back to full-sheet',
      });
      cropResolution = {
        bbox: fullSheetBbox,
        source: 'full-sheet',
        fallbackFromDrawing: true,
      };
    } else {
      cropResolution = { bbox: bb, source: 'drawing-block' };
    }
  }

  logEvent('inspect-drawing:crop-resolved', {
    cropMode,
    source: cropResolution.source,
    bbox: cropResolution.bbox,
    fallbackFromDrawing: cropResolution.fallbackFromDrawing,
  });

  // Render the cropped region to JPEG.
  const croppedPath = path.join(callDir, 'cropped.jpg');
  const renderResult = renderPdfRegion(pdfPath, cropResolution.bbox, croppedPath, dpiNum);
  logEvent('inspect-drawing:rendered', {
    outPath: 'cropped.jpg',
    dpi: dpiNum,
    width: renderResult.width,
    height: renderResult.height,
  });

  // Build prompt.
  const prompt = buildPrompt();
  fs.writeFileSync(path.join(callDir, 'prompt.txt'), prompt);

  // Single Gemini call.
  const { raw, parsed, error } = await callGemini(croppedPath, prompt);
  if (raw) fs.writeFileSync(path.join(callDir, 'response.txt'), raw);

  // Assemble + validate.
  const result = assembleResult(parsed, raw, error, cropResolution.bbox, cropResolution, prompt.length);

  // Write metadata.json (everything we'd want for the viewer + post-hoc analysis).
  const metadata = {
    callId,
    inputs: {
      projectId,
      documentId,
      sheetNum,
      question,
      expectedAnswerType,
      cropMode,
      regionHint: regionHint || null,
      reasoning: (values.reasoning as string) || null,
      applicableChecklistItems: applicableChecklistItems ?? null,
      dpi: dpiNum,
    },
    cropResolution,
    renderResult,
    result,
    timing: { startedAt: logEntries[0]?.timestamp, finishedAt: Date.now() },
  };
  fs.writeFileSync(path.join(callDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Write the agent-facing output.
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  logEvent('inspect-drawing:done', {
    answerType: expectedAnswerType,
    classification: result.classification,
    count: result.count,
    unanswerable: result.unanswerable,
    confidence: result.confidence,
    evidenceCount: result.evidence.length,
  });
  writeSidecarLog();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logEvent('inspect-drawing:fatal', { error: message });
  writeSidecarLog();
  console.error(message);
  process.exit(1);
});
