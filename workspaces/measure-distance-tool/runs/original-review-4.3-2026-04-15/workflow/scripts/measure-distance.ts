/**
 * Measure Distance Tool
 *
 * Measures the distance between two identified features on a site plan sheet.
 * TypeScript orchestrates: Supabase queries, image cropping, Gemini Vision call.
 * Python handles: PDF vector extraction, distance computation, debug images.
 *
 * Two-tier localization:
 *   Option A: Vector path matching via PyMuPDF (handled by Python)
 *   Option B: Gemini Vision via Vercel AI Gateway (handled here in TS)
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CLI Args
// ============================================================================

const { values } = parseArgs({
  options: {
    projectId: { type: 'string' },
    documentId: { type: 'string' },
    sheetNum: { type: 'string' },
    objectA: { type: 'string' },
    objectB: { type: 'string' },
    scaleInchesPerFoot: { type: 'string' },
    outputPath: { type: 'string' },
    localizationStrategy: { type: 'string', default: 'a-then-b' },
  },
  strict: false,
});

let {
  projectId, documentId, sheetNum, objectA, objectB,
  scaleInchesPerFoot, outputPath, localizationStrategy,
} = values as Record<string, string>;

// Infer projectId from workspace if not provided — the agent often omits it
// since it's a workflow-level input, not a per-measurement parameter.
// The projects directory contains exactly one subdirectory named after the project ID.
if (!projectId) {
  const workspacePath = process.env.WORKSPACE_PATH;
  if (workspacePath) {
    const projectsDir = path.join(workspacePath, 'projects');
    if (fs.existsSync(projectsDir)) {
      const entries = fs.readdirSync(projectsDir).filter(
        e => !e.startsWith('.') && fs.statSync(path.join(projectsDir, e)).isDirectory()
      );
      if (entries.length === 1) {
        projectId = entries[0];
        console.error(`Inferred projectId from workspace: ${projectId}`);
      }
    }
  }
}

if (!documentId || !sheetNum || !objectA || !objectB || !scaleInchesPerFoot || !outputPath) {
  console.error('Missing required arguments. Required: documentId, sheetNum, objectA, objectB, scaleInchesPerFoot, outputPath. Optional: projectId (inferred from workspace if omitted).');
  process.exit(1);
}

if (!projectId) {
  console.error('projectId not provided and could not be inferred from workspace.');
  process.exit(1);
}

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabase() {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ============================================================================
// Logging
// ============================================================================

const logEntries: Array<Record<string, unknown>> = [];

function logEvent(event: string, data: Record<string, unknown> = {}) {
  const entry = { event, timestamp: Date.now(), ...data };
  logEntries.push(entry);
  console.error(JSON.stringify(entry));
}

function writeSidecarLog() {
  const logDir = path.dirname(outputPath);
  const logPath = path.join(logDir, 'measure-distance-log.json');
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(logEntries, null, 2));
}

// ============================================================================
// Supabase Helpers
// ============================================================================

/**
 * Get the latest plan_set_version id for a given plan set (documentId = plan_set.id).
 */
async function getLatestPlanSetVersionId(planSetId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('plan_set_version')
    .select('id')
    .eq('plan_set_id', planSetId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();
  return data?.id ?? null;
}

/**
 * Get the sheet_version_id for a specific sheet number within a plan set version.
 */
async function getSheetVersionId(planSetVersionId: string, sheetNumber: number): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('plan_set_version_sheet')
    .select('sheet_version_id')
    .eq('plan_set_version_id', planSetVersionId)
    .eq('sheet_number', sheetNumber)
    .single();
  return data?.sheet_version_id ?? null;
}

/**
 * Get all sheet_version_ids in a plan set version, with their sheet numbers.
 */
async function getAllSheetVersionIds(
  planSetVersionId: string,
): Promise<Array<{ sheetVersionId: string; sheetNumber: number }>> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('plan_set_version_sheet')
    .select('sheet_version_id, sheet_number')
    .eq('plan_set_version_id', planSetVersionId);
  return (data ?? []).map(row => ({
    sheetVersionId: row.sheet_version_id,
    sheetNumber: row.sheet_number,
  }));
}

/**
 * Get the storage paths for a sheet version from the DB.
 * Returns null if not found; caller falls back to legacy site-plan-documents bucket.
 */
async function getSheetStoragePaths(
  planSetId: string,
  sheetNumber: number,
): Promise<{ pdfPath: string; jpegPath: string; bucket: string } | null> {
  const planSetVersionId = await getLatestPlanSetVersionId(planSetId);
  if (!planSetVersionId) return null;

  const sheetVersionId = await getSheetVersionId(planSetVersionId, sheetNumber);
  if (!sheetVersionId) return null;

  const supabase = getSupabase();
  const { data } = await supabase
    .from('sheet_version')
    .select('file_path, thumbnail_path')
    .eq('id', sheetVersionId)
    .single();

  if (!data?.file_path || !data?.thumbnail_path) return null;

  return { pdfPath: data.file_path, jpegPath: data.thumbnail_path, bucket: 'submission-data' };
}

// ============================================================================
// Supabase Queries
// ============================================================================

async function findDrawingBlockBbox(): Promise<Record<string, number> | null> {
  const supabase = getSupabase();

  // documentId = plan_set.id (same UUID as old site_plan_documents.id via backfill)
  const planSetVersionId = await getLatestPlanSetVersionId(documentId);
  if (!planSetVersionId) return null;

  const sheetVersionId = await getSheetVersionId(planSetVersionId, parseInt(sheetNum));
  if (!sheetVersionId) return null;

  const { data: blocks } = await supabase
    .from('content_block')
    .select('bounding_box, category')
    .eq('sheet_version_id', sheetVersionId)
    .eq('category', 'drawing');

  if (!blocks?.length) return null;

  // Find the largest drawing block by area
  let best: Record<string, number> | null = null;
  let bestArea = 0;
  for (const block of blocks) {
    const bb = block.bounding_box as Record<string, number> | null;
    if (!bb) continue;
    const x0 = bb.x0 ?? bb.left ?? 0;
    const y0 = bb.y0 ?? bb.top ?? 0;
    const x1 = bb.x1 ?? bb.right ?? 1;
    const y1 = bb.y1 ?? bb.bottom ?? 1;
    const area = (x1 - x0) * (y1 - y0);
    if (area > bestArea) {
      bestArea = area;
      best = { x0, y0, x1, y1 };
    }
  }
  return best;
}

async function findLegendContext(): Promise<{ source: string; context: string }> {
  const supabase = getSupabase();

  // documentId = plan_set.id; use its latest version to find all sheets
  const planSetVersionId = await getLatestPlanSetVersionId(documentId);
  if (!planSetVersionId) return { source: 'none', context: '' };

  const sheetEntries = await getAllSheetVersionIds(planSetVersionId);
  if (!sheetEntries.length) return { source: 'none', context: '' };

  const sheetVersionIds = sheetEntries.map(e => e.sheetVersionId);
  const sheetNumById = new Map(sheetEntries.map(e => [e.sheetVersionId, e.sheetNumber]));

  // Search for legend blocks across all sheet versions
  const { data: blocks } = await supabase
    .from('content_block')
    .select('description, content, sheet_version_id')
    .in('sheet_version_id', sheetVersionIds);

  const legendBlocks: Array<{ content: string; pageNumber: number | null }> = [];
  for (const block of blocks ?? []) {
    const desc = (block.description ?? '').toLowerCase();
    const content = (block.content ?? '').toLowerCase();
    if (
      desc.includes('legend') || desc.includes('symbol') ||
      desc.includes('abbreviat') || desc.includes('line type') ||
      desc.includes('key notes') || content.startsWith('legend')
    ) {
      const sheetNumber = sheetNumById.get(block.sheet_version_id) ?? null;
      legendBlocks.push({ content: block.content ?? '', pageNumber: sheetNumber });
    }
  }

  if (!legendBlocks.length) {
    // Fall back to built-in symbol reference
    const builtins: Record<string, string> = {
      'transformer': "Rectangle or square with 'T' or 'XFMR' label inside",
      'critical root zone': 'Dashed circle centered on tree trunk symbol, labeled CRZ',
      'crz': 'Dashed circle centered on tree trunk symbol, labeled CRZ',
      'fire hydrant': "Circle with 'FH' label or circle-with-cross symbol",
      'water meter': "Small rectangle with 'WM' label",
    };
    const parts: string[] = [];
    for (const obj of [objectA, objectB]) {
      const lower = obj.toLowerCase();
      for (const [key, desc] of Object.entries(builtins)) {
        if (lower.includes(key)) {
          parts.push(`- ${obj}: ${desc}`);
          break;
        }
      }
    }
    return {
      source: parts.length ? 'builtin' : 'none',
      context: parts.join('\n'),
    };
  }

  const legendText = legendBlocks
    .map(lb => `[Legend from sheet ${lb.pageNumber}]\n${lb.content}`)
    .join('\n\n');
  return { source: 'cross-sheet', context: legendText };
}

async function downloadAsset(
  storagePath: string,
  localPath: string,
  bucket = 'submission-data',
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error(`Failed to download from ${bucket}: ${storagePath}: ${error?.message}`);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
  return localPath;
}

// ============================================================================
// Image Cropping
// ============================================================================

function cropJpeg(
  jpegPath: string,
  bbox: Record<string, number> | null,
  outPath: string,
): string {
  if (!bbox) {
    fs.copyFileSync(jpegPath, outPath);
    return outPath;
  }

  // Write a temp Python script instead of using -c (avoids shell quoting issues)
  const tmpDir = path.dirname(outPath);
  fs.mkdirSync(tmpDir, { recursive: true });
  const scriptPath = path.join(tmpDir, '_crop.py');
  fs.writeFileSync(scriptPath, `
import sys, json
from PIL import Image
bbox = json.loads(sys.argv[1])
img = Image.open(sys.argv[2])
w, h = img.size
crop_box = (int(bbox["x0"]*w), int(bbox["y0"]*h), int(bbox["x1"]*w), int(bbox["y1"]*h))
img.crop(crop_box).save(sys.argv[3], "JPEG", quality=90)
`);

  const pythonBin = process.env.WORKSPACE_PATH
    ? `${process.env.WORKSPACE_PATH}/venv/bin/python3`
    : 'python3';

  execFileSync(pythonBin, [scriptPath, JSON.stringify(bbox), jpegPath, outPath], {
    stdio: ['pipe', 'pipe', 'inherit'],
    timeout: 10_000,
  });
  return outPath;
}

// ============================================================================
// Option B: Gemini Vision (via Vercel AI Gateway)
// ============================================================================

async function localizeWithGemini(
  croppedJpegPath: string,
  legendContext: string,
  drawingBbox: Record<string, number> | null,
): Promise<Record<string, unknown> | null> {
  const symbolSection = legendContext
    ? `\n## Symbol Reference\nThe following legend information describes what symbols look like on this drawing:\n${legendContext}\n`
    : '';

  const prompt = `You are analyzing an engineering site plan drawing. Locate these two objects on the image and return their positions.
${symbolSection}
## Objects to Locate

Object A: ${objectA}
Object B: ${objectB}

## Instructions

1. Find each object on the drawing
2. Return a bounding box for each object (normalized 0-1000 coordinates relative to the image)
3. Return the point on each object's boundary that is nearest to the other object
4. Rate your confidence (0.0 to 1.0) for each localization

Return your response as JSON with this exact schema:
{
  "objectA": {
    "found": true/false,
    "bbox": [y0, x0, y1, x1],
    "nearestPoint": [x, y],
    "confidence": 0.0-1.0,
    "description": "what you identified as this object"
  },
  "objectB": {
    "found": true/false,
    "bbox": [y0, x0, y1, x1],
    "nearestPoint": [x, y],
    "confidence": 0.0-1.0,
    "description": "what you identified as this object"
  }
}`;

  logEvent('measure-distance:option-b', {
    cropRegion: drawingBbox,
    symbolContextSource: legendContext ? 'legend' : 'none',
  });

  try {
    const imageData = fs.readFileSync(croppedJpegPath);
    const base64 = imageData.toString('base64');

    const res = await generateText({
      model: gateway('google/gemini-3.1-pro-preview'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: base64, mimeType: 'image/jpeg' },
          ],
        },
      ],
    });

    // Parse the JSON response — strip markdown code fences if present
    let jsonText = res.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const result = JSON.parse(jsonText);

    const objA = result.objectA ?? {};
    const objB = result.objectB ?? {};

    if (!objA.found || !objB.found) {
      logEvent('measure-distance:option-b-result', {
        success: false,
        failureReason: `Objects not found: A=${objA.found}, B=${objB.found}`,
        geminiConfidence: Math.min(objA.confidence ?? 0, objB.confidence ?? 0),
      });
      return null;
    }

    logEvent('measure-distance:option-b-result', {
      success: true,
      geminiConfidence: Math.min(objA.confidence ?? 0, objB.confidence ?? 0),
    });

    return {
      method: 'vision',
      objectA: objA,
      objectB: objB,
      drawingBbox,
    };
  } catch (error) {
    logEvent('measure-distance:option-b-result', {
      success: false,
      failureReason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// Python Delegation (vector matching + distance computation + debug image)
// ============================================================================

function callPython(args: Record<string, string>): string {
  const implPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'measure-distance-impl.py',
  );

  const pythonBin = process.env.WORKSPACE_PATH
    ? `${process.env.WORKSPACE_PATH}/venv/bin/python3`
    : 'python3';

  // Use execFileSync with args array to avoid shell quoting issues
  const cliArgs = [implPath];
  for (const [k, v] of Object.entries(args)) {
    cliArgs.push(`--${k}=${v}`);
  }

  return execFileSync(pythonBin, cliArgs, {
    env: process.env,
    encoding: 'utf-8',
    timeout: 90_000,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = Date.now();
  const strategy = localizationStrategy ?? 'a-then-b';

  logEvent('measure-distance:start', {
    projectId, documentId, sheetNum, objectA, objectB, strategy,
  });

  // Step 1: Resolve storage paths from sheet_version DB records.
  // documentId = plan_set.id (same UUID as old site_plan_documents.id via backfill).
  // Falls back to legacy site-plan-documents bucket paths if new records not found.
  const tmpDir = path.join(path.dirname(outputPath), 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const storagePaths = await getSheetStoragePaths(documentId, parseInt(sheetNum));
  const pdfStoragePath = storagePaths?.pdfPath ?? `${projectId}/${documentId}/${sheetNum}.pdf`;
  const jpegStoragePath = storagePaths?.jpegPath ?? `${projectId}/${documentId}/dpi120-p${sheetNum}.jpg`;
  const bucket = storagePaths?.bucket ?? 'site-plan-documents';

  const [pdfPath, jpegPath] = await Promise.all([
    downloadAsset(pdfStoragePath, path.join(tmpDir, 'sheet.pdf'), bucket),
    downloadAsset(jpegStoragePath, path.join(tmpDir, 'sheet.jpg'), bucket),
  ]);

  // Step 2: Find drawing block bbox and legend context
  const [drawingBbox, legendInfo] = await Promise.all([
    findDrawingBlockBbox(),
    findLegendContext(),
  ]);

  logEvent('measure-distance:assets', {
    pdfPath: pdfStoragePath,
    jpegPath: jpegStoragePath,
    drawingBlockBbox: drawingBbox,
    legendBlockFound: legendInfo.source !== 'none',
    legendSource: legendInfo.source,
  });

  // Step 3: Option A — delegate to Python for vector matching
  let localization: Record<string, unknown> | null = null;

  if (strategy === 'a-then-b' || strategy === 'a-only') {
    try {
      const result = callPython({
        mode: 'option-a',
        pdfPath,
        objectA,
        objectB,
        drawingBbox: JSON.stringify(drawingBbox),
        outputPath,
      });
      const parsed = JSON.parse(result.trim());
      if (parsed.success) {
        localization = parsed.localization;
      }
    } catch {
      logEvent('measure-distance:option-a-result', {
        success: false,
        failureReason: 'Python option-a call failed',
      });
    }
  }

  // Step 4: Option B — Gemini Vision (TS-native via Vercel AI Gateway)
  if (!localization && (strategy === 'a-then-b' || strategy === 'b-only')) {
    const croppedPath = path.join(tmpDir, 'cropped-drawing.jpg');
    cropJpeg(jpegPath, drawingBbox, croppedPath);
    localization = await localizeWithGemini(croppedPath, legendInfo.context, drawingBbox);
  }

  // Step 5: Distance computation + debug image (delegate to Python)
  if (!localization) {
    const result = {
      distanceFeet: null,
      distanceInches: null,
      confidence: 'unable',
      localization: { method: 'none', fallbackUsed: strategy === 'a-then-b', legendSource: legendInfo.source },
      objectA: { description: objectA, found: false },
      objectB: { description: objectB, found: false },
      warnings: ['Could not locate one or both objects on the sheet'],
    };
    logEvent('measure-distance:result', {
      distanceFeet: null, confidence: 'unable', method: 'none',
      fallbackUsed: strategy === 'a-then-b',
      elapsed_ms: Date.now() - startTime,
    });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    writeSidecarLog();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Call Python for distance computation with the localization result
  try {
    const stdout = callPython({
      mode: 'compute-distance',
      pdfPath,
      localization: JSON.stringify(localization),
      scaleInchesPerFoot,
      drawingBbox: JSON.stringify(drawingBbox),
      objectA,
      objectB,
      outputPath,
      sheetNum,
      legendSource: legendInfo.source,
    });

    // Python writes the output file and prints the result
    const result = JSON.parse(stdout.trim());
    logEvent('measure-distance:result', {
      distanceFeet: result.distanceFeet,
      confidence: result.confidence,
      method: result.localization?.method,
      fallbackUsed: result.localization?.fallbackUsed,
      elapsed_ms: Date.now() - startTime,
    });

    writeSidecarLog();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('measure-distance:compute-error', { error: message });
    writeSidecarLog();
    console.error(`Distance computation failed: ${message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`measure-distance failed: ${error}`);
  writeSidecarLog();
  process.exit(1);
});
