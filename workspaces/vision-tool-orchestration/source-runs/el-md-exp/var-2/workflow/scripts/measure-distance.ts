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
import {
  getPlanSetVersionId as libGetPlanSetVersionId,
  resolveSubmissionVersionId,
} from './lib/sheet-resolution.js';

/**
 * Build Vercel AI Gateway providerOptions from WORKFLOW_RUN_ID / RUN_LABEL
 * env vars stamped by the conductor orchestrator. Lets Vercel's Custom
 * Reporting API attribute cost/tokens to a specific workflow run.
 * Kept inline (not imported) because this script runs in the bureau
 * sandbox without conductor sources on the import path.
 */
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
    objectA: { type: 'string' },
    objectB: { type: 'string' },
    objectPairs: { type: 'string' },
    scaleInchesPerFoot: { type: 'string' },
    outputPath: { type: 'string' },
    localizationStrategy: { type: 'string', default: 'a-then-b' },
    reasoning: { type: 'string' },
    applicable_checklist_items: { type: 'string' },
  },
  strict: false,
});

let {
  projectId, documentId, sheetNum,
  scaleInchesPerFoot, outputPath, localizationStrategy,
} = values as Record<string, string>;

// Resolve submissionVersionId: explicit CLI arg first, fall back to
// WORKSPACE_PATH/workflow/status.json (conductor-managed flow), fail
// loudly if neither produces a value. The previous fallback to "latest
// plan_set_version by created_at" was a footgun — it could silently
// pick a different submission's plan_set_version when the same
// plan_set_id had versions across multiple submissions.
const submissionVersionId = resolveSubmissionVersionId(values.submissionVersionId as string);

const objectA = values.objectA as string | undefined;
const objectB = values.objectB as string | undefined;

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

// Parse object pairs: prefer --objectPairs JSON array, fall back to --objectA/--objectB
let pairs: Array<{objectA: string, objectB: string}> = [];
const objectPairsRaw = values.objectPairs as string | undefined;
if (objectPairsRaw) {
  pairs = JSON.parse(objectPairsRaw);
} else if (objectA && objectB) {
  pairs = [{ objectA, objectB }];
}
if (!pairs.length) {
  console.error('No object pairs provided. Use --objectPairs=\'[{"objectA":"...","objectB":"..."}]\' or --objectA/--objectB.');
  process.exit(1);
}

if (!documentId || !sheetNum || !scaleInchesPerFoot || !outputPath) {
  console.error('Missing required arguments. Required: documentId, sheetNum, scaleInchesPerFoot, outputPath, and objectPairs (or objectA+objectB). Optional: projectId (inferred from workspace if omitted), submissionVersionId (resolved from CLI or workflow/status.json).');
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
// Per-call identity (populated in main)
// ============================================================================

// Orchestrator-supplied context. These come from the conductor agent runner
// and attribute each invocation to a specific (run, checklist item) pair.
// Absent when the tool is invoked outside the conductor (e.g. ad-hoc CLI runs).
const CHECKLIST_ITEM = process.env.CHECKLIST_ITEM || undefined;
const CHECKLIST_INDEX = process.env.CHECKLIST_INDEX || undefined;
const RUN_INDEX = process.env.RUN_INDEX || undefined;

/**
 * Build a per-invocation ID that is safe for use as a directory name and
 * unique across parallel calls. Format:
 *   <iso-no-punct>-<4-char-random>[-<run>-<item>]
 * e.g. 20260415T180422Z-a3f9-run-1-5
 */
function makeCallId(): string {
  const ts = new Date().toISOString().replace(/[-:.]/g, '').replace(/T/, 'T').replace(/Z$/, 'Z');
  const rand = Math.random().toString(36).slice(2, 6);
  const suffixParts: string[] = [];
  if (RUN_INDEX) suffixParts.push(RUN_INDEX);
  if (CHECKLIST_ITEM) suffixParts.push(CHECKLIST_ITEM.replace(/\.(md|json)$/i, ''));
  const suffix = suffixParts.length ? `-${suffixParts.join('-')}` : '';
  return `${ts}-${rand}${suffix}`;
}

// Session-level callId — set once in main(). Per-pair callIds derive from this.
let sessionCallId = '';

// Active per-pair callId and callDir — updated as we iterate through pairs.
let callId = '';
let callDir = '';

// ============================================================================
// Logging
// ============================================================================

const logEntries: Array<Record<string, unknown>> = [];

function logEvent(event: string, data: Record<string, unknown> = {}) {
  // All events for a given invocation carry callId so they can be joined back
  // to the on-disk artifact directory during post-run analysis.
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
  // Per-call sidecar — no cross-call overwriting.
  if (!callDir) return;
  fs.mkdirSync(callDir, { recursive: true });
  fs.writeFileSync(path.join(callDir, 'events.jsonl'), logEntries.map((e) => JSON.stringify(e)).join('\n'));
}

// ============================================================================
// Supabase Helpers
// ============================================================================

/**
 * Resolve the plan_set_version for a given plan set, scoped to *this
 * workflow's submission*. Delegates to the shared sheet-resolution lib
 * so the scoping logic stays in one place.
 *
 * The previous inline implementation ordered `plan_set_version` by a
 * non-existent `version_number` column and silently fell back to "any
 * latest by created_at" — which could (and did) pick a different
 * submission's plan_set_version when the same plan_set_id had versions
 * across multiple submissions.
 */
async function getLatestPlanSetVersionId(planSetId: string): Promise<string | null> {
  return libGetPlanSetVersionId(planSetId, submissionVersionId, logEvent);
}

/**
 * Get the sheet_version_id for a specific sheet number within a plan set version.
 *
 * Queries the `sheet_version` table directly — the old `plan_set_version_sheet`
 * join table no longer exists; sheet_version now carries plan_set_version_id
 * and sheet_number as direct columns.
 */
async function getSheetVersionId(planSetVersionId: string, sheetNumber: number): Promise<string | null> {
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
 * Get all sheet_version_ids in a plan set version, with their sheet numbers.
 */
async function getAllSheetVersionIds(
  planSetVersionId: string,
): Promise<Array<{ sheetVersionId: string; sheetNumber: number }>> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('sheet_version')
    .select('id, sheet_number')
    .eq('plan_set_version_id', planSetVersionId);
  return (data ?? []).map(row => ({
    sheetVersionId: row.id,
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
    .select('storage_path, thumbnail_storage_path')
    .eq('id', sheetVersionId)
    .single();

  if (!data?.storage_path || !data?.thumbnail_storage_path) return null;

  return { pdfPath: data.storage_path, jpegPath: data.thumbnail_storage_path, bucket: 'submission-data' };
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

  // Find the largest drawing block by area.
  // The DB stores bounding_box in {x, y, width, height} format (normalized 0-1),
  // but the rest of the pipeline expects {x0, y0, x1, y1}. Convert on read.
  let best: Record<string, number> | null = null;
  let bestArea = 0;
  for (const block of blocks) {
    const bb = block.bounding_box as Record<string, number> | null;
    if (!bb) continue;
    const x0 = bb.x0 ?? bb.x ?? bb.left ?? 0;
    const y0 = bb.y0 ?? bb.y ?? bb.top ?? 0;
    const x1 = bb.x1
      ?? (bb.x != null && bb.width != null ? bb.x + bb.width : undefined)
      ?? bb.right ?? 1;
    const y1 = bb.y1
      ?? (bb.y != null && bb.height != null ? bb.y + bb.height : undefined)
      ?? bb.bottom ?? 1;
    const area = (x1 - x0) * (y1 - y0);
    if (area > bestArea) {
      bestArea = area;
      best = { x0, y0, x1, y1 };
    }
  }
  return best;
}

async function findLegendContext(pairObjects: Array<{objectA: string, objectB: string}>): Promise<{ source: string; context: string }> {
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
    const seen = new Set<string>();
    for (const pair of pairObjects) {
      for (const obj of [pair.objectA, pair.objectB]) {
        if (seen.has(obj)) continue;
        seen.add(obj);
        const lower = obj.toLowerCase();
        for (const [key, desc] of Object.entries(builtins)) {
          if (lower.includes(key)) {
            parts.push(`- ${obj}: ${desc}`);
            break;
          }
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
// Legend Block Images (Phase B)
// ============================================================================

interface LegendBlockImage {
  objectDescription: string;
  blockId: string;
  sheetNumber: number;
  category: string;
  description: string;
  similarity: number;
  imagePath: string;         // path to the cropped legend image
  imageBase64: string;       // base64-encoded JPEG for Gemini
}

/**
 * Find legend block images for the given object descriptions using vector
 * similarity search. Returns 0-2 images (one per unique legend block).
 *
 * Steps:
 * 1. Generate embedding for each object description
 * 2. Call search_content_blocks_hybrid RPC
 * 3. Post-filter to legend/symbol/diagram categories, take top-1 per object
 * 4. Deduplicate (if both objects match the same block)
 * 5. Fetch bounding_box for each matched block
 * 6. Download the block's sheet PDF and crop at 300 DPI
 */
async function findLegendBlockImages(
  objectDescriptions: string[],
  tmpDir: string,
  resolvedPlanSetVersionId: string | null,
): Promise<LegendBlockImage[]> {
  const LEGEND_CATEGORIES = new Set(['legend', 'symbol', 'diagram', 'key', 'abbreviations']);
  const supabase = getSupabase();
  const images: LegendBlockImage[] = [];
  const seenBlockIds = new Set<string>();

  // Use the plan_set_version that the review is actually running against.
  // This is resolved once in main() and passed in — no version walking needed.
  const psvId = resolvedPlanSetVersionId;

  logEvent('measure-distance:legend-search-init', {
    projectId,
    documentId,
    planSetVersionId: psvId,
    objectDescriptionCount: objectDescriptions.length,
  });

  for (const desc of objectDescriptions) {
    try {
      // Step 1: Generate embedding
      const embedding = await generateQueryEmbedding(desc);
      if (!embedding) {
        logEvent('measure-distance:legend-search', {
          objectDescription: desc.slice(0, 80),
          error: 'embedding generation failed (check OPENAI_API_KEY)',
          resultCount: 0,
        });
        continue;
      }

      // Step 2: Call hybrid search RPC, scoped to the specific plan_set_version
      // we're reviewing (not MAX version, which may lack embeddings).
      const { data: results, error } = await supabase.rpc('search_content_blocks_hybrid', {
        target_project_id: projectId,
        search_query: desc,
        query_embedding: JSON.stringify(embedding),
        max_results: 10,  // fetch 10, post-filter to legend categories
        target_plan_set_version_id: psvId,
      });

      if (error || !results?.length) {
        logEvent('measure-distance:legend-search', {
          objectDescription: desc.slice(0, 80),
          error: error ? `rpc error: ${error.message} (code: ${error.code})` : 'rpc returned 0 rows',
          resultCount: 0,
          searchedProjectId: projectId,
        });
        continue;
      }

      // Step 3: Post-filter to legend/symbol/diagram categories, take top-1
      const legendResults = (results as Array<Record<string, unknown>>).filter(
        (r) => LEGEND_CATEGORIES.has(String(r.category ?? '').toLowerCase())
      );

      logEvent('measure-distance:legend-search', {
        objectDescription: desc.slice(0, 80),
        totalResults: results.length,
        legendResults: legendResults.length,
        topCategory: legendResults[0]?.category,
        topSimilarity: legendResults[0]?.vector_similarity,
      });

      if (!legendResults.length) continue;
      const best = legendResults[0];
      const bestBlockId = String(best.block_id);

      // Step 4: Deduplicate
      if (seenBlockIds.has(bestBlockId)) continue;
      seenBlockIds.add(bestBlockId);

      // Step 5: Fetch bounding_box for this block
      const { data: blockData } = await supabase
        .from('content_block')
        .select('bounding_box')
        .eq('id', bestBlockId)
        .single();

      const bbox = blockData?.bounding_box as Record<string, number> | null;
      if (!bbox) {
        logEvent('measure-distance:legend-no-bbox', { blockId: bestBlockId });
        continue;
      }

      // Convert {x, y, width, height} to {x0, y0, x1, y1} if needed
      let normalizedBbox: Record<string, number>;
      if ('width' in bbox && 'height' in bbox) {
        normalizedBbox = {
          x0: bbox.x ?? 0,
          y0: bbox.y ?? 0,
          x1: (bbox.x ?? 0) + (bbox.width ?? 1),
          y1: (bbox.y ?? 0) + (bbox.height ?? 1),
        };
      } else {
        normalizedBbox = bbox;
      }

      // Step 6: Download the block's sheet and crop at 300 DPI
      // We need the sheet's PDF — resolve from sheet_version_id
      const sheetVersionId = String(best.sheet_version_id);
      const sheetNum = Number(best.sheet_number);

      // Resolve storage path for this sheet.
      // Column is storage_path (not pdf_storage_path) — same fix as bureau#226.
      const { data: svData } = await supabase
        .from('sheet_version')
        .select('storage_path, plan_set_version_id')
        .eq('id', sheetVersionId)
        .single();

      if (!svData?.storage_path) {
        logEvent('measure-distance:legend-no-pdf', { sheetVersionId, blockId: bestBlockId });
        continue;
      }

      // Determine bucket — try the new path format first
      const legendPdfPath = path.join(tmpDir, `legend-sheet-${sheetNum}.pdf`);
      let bucket = 'submission-data';
      try {
        await downloadAsset(svData.storage_path, legendPdfPath, bucket);
      } catch {
        // Fallback to legacy bucket
        bucket = 'site-plan-documents';
        try {
          await downloadAsset(svData.storage_path, legendPdfPath, bucket);
        } catch (e2) {
          logEvent('measure-distance:legend-download-failed', {
            sheetVersionId, path: svData.storage_path, error: String(e2),
          });
          continue;
        }
      }

      // Crop the legend block at 300 DPI
      const legendImgPath = path.join(tmpDir, `legend-block-${bestBlockId.slice(0, 8)}.jpg`);
      renderPdfRegion(legendPdfPath, normalizedBbox, legendImgPath, 300);

      // Read as base64 for Gemini
      const imgData = fs.readFileSync(legendImgPath);
      const base64 = imgData.toString('base64');

      images.push({
        objectDescription: desc,
        blockId: bestBlockId,
        sheetNumber: sheetNum,
        category: String(best.category),
        description: String(best.description ?? ''),
        similarity: Number(best.vector_similarity ?? 0),
        imagePath: legendImgPath,
        imageBase64: base64,
      });
    } catch (err) {
      logEvent('measure-distance:legend-error', {
        objectDescription: desc.slice(0, 80),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logEvent('measure-distance:legend-images', {
    queriedDescriptions: objectDescriptions.length,
    imagesFound: images.length,
    blocks: images.map(i => ({
      blockId: i.blockId,
      sheetNumber: i.sheetNumber,
      category: i.category,
      similarity: i.similarity,
    })),
  });

  return images;
}

/**
 * Generate a query embedding using OpenAI text-embedding-3-small.
 * Same approach as semantic-search-blocks.ts.
 */
async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logEvent('measure-distance:embedding-skip', { reason: 'OPENAI_API_KEY not set' });
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });
    if (!res.ok) {
      logEvent('measure-distance:embedding-error', {
        status: res.status,
        statusText: res.statusText,
        text: text.slice(0, 80),
      });
      return null;
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0]?.embedding ?? null;
  } catch (err) {
    logEvent('measure-distance:embedding-error', {
      error: err instanceof Error ? err.message : String(err),
      text: text.slice(0, 80),
    });
    return null;
  }
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
// Phase A: Refined crop rendering (two-call Gemini approach)
// ============================================================================

/**
 * Compute the refined crop region from call 1's coarse bounding boxes.
 * Returns a bbox in the same normalized 0-1 space as drawingBbox.
 *
 * Strategy:
 * - Union of objectA + objectB bboxes (mapped from 0-1000 Gemini space to 0-1)
 * - Expand by paddingFraction on each side
 * - Apply crop floor: never smaller than minFraction of the drawing area
 * - Clamp to [0, 1]
 */
function computeRefinedCropBbox(
  localization: Record<string, unknown>,
  drawingBbox: Record<string, number> | null,
  paddingFraction = 0.30,
  minFraction = 0.25,  // quadrant floor
): Record<string, number> {
  const objA = (localization.objectA ?? {}) as Record<string, unknown>;
  const objB = (localization.objectB ?? {}) as Record<string, unknown>;
  const bboxA = (objA.bbox ?? [0, 0, 1000, 1000]) as number[];  // [y0, x0, y1, x1] in 0-1000
  const bboxB = (objB.bbox ?? [0, 0, 1000, 1000]) as number[];

  // Convert from Gemini 0-1000 [y0, x0, y1, x1] to normalized 0-1 [x0, y0, x1, y1]
  const ax0 = bboxA[1] / 1000, ay0 = bboxA[0] / 1000, ax1 = bboxA[3] / 1000, ay1 = bboxA[2] / 1000;
  const bx0 = bboxB[1] / 1000, by0 = bboxB[0] / 1000, bx1 = bboxB[3] / 1000, by1 = bboxB[2] / 1000;

  // Union bbox
  let ux0 = Math.min(ax0, bx0);
  let uy0 = Math.min(ay0, by0);
  let ux1 = Math.max(ax1, bx1);
  let uy1 = Math.max(ay1, by1);

  // Add padding
  const pw = (ux1 - ux0) * paddingFraction;
  const ph = (uy1 - uy0) * paddingFraction;
  ux0 -= pw; uy0 -= ph; ux1 += pw; uy1 += ph;

  // Apply minimum size (quadrant floor)
  const w = ux1 - ux0;
  const h = uy1 - uy0;
  const minDim = Math.sqrt(minFraction);  // ~0.5 for 25% area
  if (w < minDim) {
    const cx = (ux0 + ux1) / 2;
    ux0 = cx - minDim / 2;
    ux1 = cx + minDim / 2;
  }
  if (h < minDim) {
    const cy = (uy0 + uy1) / 2;
    uy0 = cy - minDim / 2;
    uy1 = cy + minDim / 2;
  }

  // Clamp to [0, 1]
  ux0 = Math.max(0, ux0); uy0 = Math.max(0, uy0);
  ux1 = Math.min(1, ux1); uy1 = Math.min(1, uy1);

  // If drawingBbox is set, map from drawing-relative 0-1 to full-page 0-1
  if (drawingBbox) {
    const dw = drawingBbox.x1 - drawingBbox.x0;
    const dh = drawingBbox.y1 - drawingBbox.y0;
    return {
      x0: drawingBbox.x0 + ux0 * dw,
      y0: drawingBbox.y0 + uy0 * dh,
      x1: drawingBbox.x0 + ux1 * dw,
      y1: drawingBbox.y0 + uy1 * dh,
    };
  }
  return { x0: ux0, y0: uy0, x1: ux1, y1: uy1 };
}

/**
 * Render a subregion of a PDF page at high DPI using PyMuPDF.
 * Returns the path to the rendered JPEG.
 *
 * bbox is in normalized 0-1 coordinates relative to the full page.
 */
function renderPdfRegion(
  pdfPath: string,
  bbox: Record<string, number>,
  outPath: string,
  dpi = 300,
): string {
  const tmpDir = path.dirname(outPath);
  fs.mkdirSync(tmpDir, { recursive: true });
  // Use a unique script name per invocation to avoid races if pairs ever run in parallel
  const scriptPath = path.join(tmpDir, `_render_region_${Date.now()}.py`);
  fs.writeFileSync(scriptPath, `
import sys, json
import fitz  # PyMuPDF

bbox = json.loads(sys.argv[1])
pdf_path = sys.argv[2]
out_path = sys.argv[3]
dpi = int(sys.argv[4])

doc = fitz.open(pdf_path)
page = doc[0]
rect = page.rect

# Convert normalized 0-1 bbox to PDF points
clip = fitz.Rect(
    rect.x0 + bbox["x0"] * rect.width,
    rect.y0 + bbox["y0"] * rect.height,
    rect.x0 + bbox["x1"] * rect.width,
    rect.y0 + bbox["y1"] * rect.height,
)

pix = page.get_pixmap(dpi=dpi, clip=clip)
# Save as JPEG via PIL for quality control
from PIL import Image
img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
img.save(out_path, "JPEG", quality=92)
print(json.dumps({"width": pix.width, "height": pix.height}))
`);

  const pythonBin = process.env.WORKSPACE_PATH
    ? `${process.env.WORKSPACE_PATH}/venv/bin/python3`
    : 'python3';

  const result = execFileSync(
    pythonBin,
    [scriptPath, JSON.stringify(bbox), pdfPath, outPath, String(dpi)],
    { stdio: ['pipe', 'pipe', 'inherit'], timeout: 30_000, encoding: 'utf-8' },
  );

  logEvent('measure-distance:refined-render', {
    bbox,
    dpi,
    outPath: path.basename(outPath),
    ...(result.trim() ? JSON.parse(result.trim()) : {}),
  });

  return outPath;
}

// ============================================================================
// Option B: Gemini Vision (via Vercel AI Gateway)
// ============================================================================

/**
 * Capture of what was sent to / received from Gemini, written into
 * the per-call artifact directory for offline audit and replay. All
 * fields are optional so the struct can be filled incrementally.
 */
interface OptionBArtifacts {
  prompt?: string;
  rawResponse?: string;
  parsedResponse?: unknown;
  geminiConfidence?: number;
  success?: boolean;
  failureReason?: string;
}

async function localizeWithGemini(
  croppedJpegPath: string,
  legendContext: string,
  drawingBbox: Record<string, number> | null,
  artifacts: OptionBArtifacts,
  pairObjectA: string,
  pairObjectB: string,
  artifactPrefix = '',  // e.g., 'call1-' or 'call2-' for two-call mode
  legendImages: LegendBlockImage[] = [],
): Promise<Record<string, unknown> | null> {
  // When legend images are available, use a short reference instead of the
  // full 15 KB text dump. The images do the context heavy lifting.
  let symbolSection = '';
  if (legendImages.length > 0) {
    const refs = legendImages.map((li, idx) => {
      const imgNum = idx + 2;  // image 1 is the main drawing; legend images are 2, 3, ...
      return `- Image ${imgNum}: Legend from sheet ${li.sheetNumber} — "${li.description}"`;
    }).join('\n');
    symbolSection = `\n## Symbol Reference\nThe following legend images show the symbols relevant to the objects you are looking for. Use them to visually match the correct features on the main drawing.\n${refs}\n`;
  } else if (legendContext) {
    // Fallback: no legend images found, send the text dump as before
    symbolSection = `\n## Symbol Reference\nThe following legend information describes what symbols look like on this drawing:\n${legendContext}\n`;
  }

  const prompt = `You are analyzing an engineering site plan drawing. Locate these two objects on the image and return their positions.
${symbolSection}
## Objects to Locate

Object A: ${pairObjectA}
Object B: ${pairObjectB}

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
    "nearestPoint": [y, x],
    "confidence": 0.0-1.0,
    "description": "what you identified as this object"
  },
  "objectB": {
    "found": true/false,
    "bbox": [y0, x0, y1, x1],
    "nearestPoint": [y, x],
    "confidence": 0.0-1.0,
    "description": "what you identified as this object"
  }
}`;

  artifacts.prompt = prompt;

  // Persist the prompt + cropped image immediately so debugging is
  // possible even if the call times out or throws before we reach the
  // end-of-main metadata write.
  if (callDir) {
    fs.mkdirSync(callDir, { recursive: true });
    fs.writeFileSync(path.join(callDir, `${artifactPrefix}prompt.txt`), prompt);
    try {
      fs.copyFileSync(croppedJpegPath, path.join(callDir, `${artifactPrefix}cropped.jpg`));
    } catch {
      // Cropped image may not exist yet (cropJpeg failure); non-fatal for logging.
    }
  }

  logEvent(`measure-distance:option-b${artifactPrefix ? `-${artifactPrefix.replace('-', '')}` : ''}`, {
    cropRegion: drawingBbox,
    symbolContextSource: legendContext ? 'legend' : 'none',
    legendImageCount: legendImages.length,
    promptLength: prompt.length,
    artifactPrefix: artifactPrefix || undefined,
  });

  // Persist legend images to the call-dir for debugging
  if (callDir && legendImages.length > 0) {
    for (let i = 0; i < legendImages.length; i++) {
      try {
        fs.copyFileSync(legendImages[i].imagePath, path.join(callDir, `${artifactPrefix}legend-${i}.jpg`));
      } catch { /* non-fatal */ }
    }
  }

  try {
    const imageData = fs.readFileSync(croppedJpegPath);
    const base64 = imageData.toString('base64');

    // Build multi-image content array: main drawing + legend images
    const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string }> = [
      { type: 'text', text: prompt },
      { type: 'image', image: base64, mimeType: 'image/jpeg' },
    ];
    // Append legend images (referenced as image 2, image 3, ... in the prompt)
    for (const li of legendImages) {
      contentParts.push({ type: 'image', image: li.imageBase64, mimeType: 'image/jpeg' });
    }

    const t_gemini = Date.now();
    const res = await generateText({
      model: gateway('google/gemini-3.1-pro-preview'),
      messages: [
        {
          role: 'user',
          content: contentParts as any,
        },
      ],
      ...buildGatewayProviderOptions('measure-distance'),
    });

    artifacts.rawResponse = res.text;
    if (callDir) {
      fs.writeFileSync(path.join(callDir, `${artifactPrefix}response.txt`), res.text);
    }

    // Parse the JSON response — strip markdown code fences if present
    let jsonText = res.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const result = JSON.parse(jsonText);
    artifacts.parsedResponse = result;

    const objA = result.objectA ?? {};
    const objB = result.objectB ?? {};
    const geminiConfidence = Math.min(objA.confidence ?? 0, objB.confidence ?? 0);
    artifacts.geminiConfidence = geminiConfidence;

    if (!objA.found || !objB.found) {
      const failureReason = `Objects not found: A=${objA.found}, B=${objB.found}`;
      artifacts.success = false;
      artifacts.failureReason = failureReason;
      logEvent('measure-distance:option-b-result', {
        success: false,
        failureReason,
        geminiConfidence,
      });
      return null;
    }

    artifacts.success = true;
    logEvent('measure-distance:option-b-result', {
      success: true,
      geminiConfidence,
    });

    const localization = {
      method: 'vision',
      objectA: objA,
      objectB: objB,
      drawingBbox,
    };
    if (callDir) {
      fs.writeFileSync(
        path.join(callDir, `${artifactPrefix}localization.json`),
        JSON.stringify(localization, null, 2),
      );
    }
    return localization;
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    artifacts.success = false;
    artifacts.failureReason = failureReason;
    logEvent('measure-distance:option-b-result', {
      success: false,
      failureReason,
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

  // Generate a session-level callId. Per-pair callIds derive from this.
  sessionCallId = makeCallId();
  callId = sessionCallId;

  // Shared session directory for assets downloaded once.
  const sessionDir = path.join(path.dirname(outputPath), 'measure-distance-calls', sessionCallId);
  fs.mkdirSync(sessionDir, { recursive: true });
  // Point callDir to session for the shared-setup logging phase.
  callDir = sessionDir;

  logEvent('measure-distance:start', {
    projectId, documentId, submissionVersionId, sheetNum, strategy,
    scaleInchesPerFoot,
    reasoning: (values.reasoning as string) || undefined,
    pairCount: pairs.length,
    pairs: pairs.map((p, i) => ({ pairIndex: i, objectA: p.objectA, objectB: p.objectB })),
    sessionDir,
  });

  // ---- Shared setup (once per invocation) ----

  // Step 0: Resolve the plan_set_version ONCE. All downstream queries
  // (storage paths, drawing bbox, legend context, legend images) use this
  // same version so they're all looking at the same set of sheets.
  const resolvedPlanSetVersionId = await getLatestPlanSetVersionId(documentId);
  if (!resolvedPlanSetVersionId) {
    console.error(`Could not resolve plan_set_version for documentId ${documentId}`);
    process.exit(1);
  }
  logEvent('measure-distance:resolved-version', {
    documentId,
    planSetVersionId: resolvedPlanSetVersionId,
  });

  // Step 1: Resolve storage paths from sheet_version DB records.
  const tmpDir = path.join(sessionDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const storagePaths = await getSheetStoragePaths(documentId, parseInt(sheetNum));
  const pdfStoragePath = storagePaths?.pdfPath ?? `${projectId}/${documentId}/${sheetNum}.pdf`;
  const jpegStoragePath = storagePaths?.jpegPath ?? `${projectId}/${documentId}/dpi120-p${sheetNum}.jpg`;
  const bucket = storagePaths?.bucket ?? 'site-plan-documents';

  const [pdfPath, jpegPath] = await Promise.all([
    downloadAsset(pdfStoragePath, path.join(tmpDir, 'sheet.pdf'), bucket),
    downloadAsset(jpegStoragePath, path.join(tmpDir, 'sheet.jpg'), bucket),
  ]);

  // Step 2: Find drawing block bbox, legend context, and legend block images
  const [drawingBbox, legendInfo] = await Promise.all([
    findDrawingBlockBbox(),
    findLegendContext(pairs),
  ]);

  // Step 2b: Find legend block images via vector search (Phase B).
  // Collect unique object descriptions across all pairs for deduplication.
  const allObjectDescriptions = [
    ...new Set(pairs.flatMap(p => [p.objectA, p.objectB]))
  ];
  const legendBlockImages = await findLegendBlockImages(allObjectDescriptions, tmpDir, resolvedPlanSetVersionId);

  logEvent('measure-distance:assets', {
    pdfPath: pdfStoragePath,
    jpegPath: jpegStoragePath,
    drawingBlockBbox: drawingBbox,
    legendBlockFound: legendInfo.source !== 'none',
    legendSource: legendInfo.source,
    legendLength: legendInfo.context.length,
    legendBlockImageCount: legendBlockImages.length,
  });

  // Persist legend context (shared across pairs).
  fs.writeFileSync(path.join(sessionDir, 'legend.txt'), legendInfo.context || '');

  // Step 3: Crop the drawing area (shared across pairs for Option B).
  const sharedCroppedPath = path.join(tmpDir, 'cropped-drawing.jpg');
  cropJpeg(jpegPath, drawingBbox, sharedCroppedPath);

  // ---- Per-pair loop ----

  const measurements: Array<Record<string, unknown>> = [];

  for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
    const pair = pairs[pairIdx];
    const pairCallId = pairs.length === 1 ? sessionCallId : `${sessionCallId}-p${pairIdx}`;
    const pairCallDir = pairs.length === 1
      ? sessionDir
      : path.join(path.dirname(outputPath), 'measure-distance-calls', pairCallId);

    // Update module-level state so logEvent and writeSidecarLog target the right pair.
    callId = pairCallId;
    callDir = pairCallDir;
    fs.mkdirSync(pairCallDir, { recursive: true });

    logEvent('measure-distance:pair-start', {
      pairIndex: pairIdx,
      objectA: pair.objectA,
      objectB: pair.objectB,
    });

    // Copy shared assets into pair's callDir so each pair is self-contained
    // for debugging (viewer, manifest builder). For single-pair runs
    // pairCallDir === sessionDir so no copy needed.
    if (pairCallDir !== sessionDir) {
      try { fs.copyFileSync(sharedCroppedPath, path.join(pairCallDir, 'cropped.jpg')); } catch { /* ok */ }
      try { fs.copyFileSync(path.join(sessionDir, 'legend.txt'), path.join(pairCallDir, 'legend.txt')); } catch { /* ok */ }
      // Copy sheet assets so the viewer can show all three images per pair:
      //   1. tmp/sheet.jpg  — full downloaded sheet
      //   2. call1-cropped.jpg — drawing-block crop (created later by localizeWithGemini)
      //   3. call2-cropped.jpg — refined high-DPI crop (created later by localizeWithGemini)
      const pairTmpDir = path.join(pairCallDir, 'tmp');
      fs.mkdirSync(pairTmpDir, { recursive: true });
      try { fs.copyFileSync(path.join(tmpDir, 'sheet.jpg'), path.join(pairTmpDir, 'sheet.jpg')); } catch { /* ok */ }
      try { fs.copyFileSync(path.join(tmpDir, 'sheet.pdf'), path.join(pairTmpDir, 'sheet.pdf')); } catch { /* ok */ }
    }

    // Option A: vector path matching via Python — DISABLED (v1 stub).
    // The stub always fails after spending 60-80s extracting vector paths.
    // With objectPairs batching, that wasted time per pair causes the
    // 120s conductor timeout to kill multi-pair calls. Skip straight to
    // Option B until real pattern matching is implemented.
    let localization: Record<string, unknown> | null = null;
    const optionBArtifacts: OptionBArtifacts = {};

    if (strategy === 'a-only') {
      // Only honor a-only if explicitly requested (for future testing).
      // a-then-b now means just-b since Option A always fails.
      try {
        const result = callPython({
          mode: 'option-a',
          pdfPath,
          objectA: pair.objectA,
          objectB: pair.objectB,
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
          pairIndex: pairIdx,
        });
      }
    }

    // Option B: Gemini Vision — two-call approach
    //   Call 1 (coarse): drawing-block crop at 120 DPI → rough bboxes
    //   Call 2 (refined): high-DPI crop of the region of interest → precise nearestPoints
    let call1Localization: Record<string, unknown> | null = null;
    const call1Artifacts: OptionBArtifacts = {};
    // Tracks which call's artifacts are the final ones — 'call2-' on success,
    // 'call1-' when falling back to coarse localization.
    let usedCallPrefix = 'call2-';

    if (!localization) {
      call1Localization = await localizeWithGemini(
        sharedCroppedPath,
        legendInfo.context,
        drawingBbox,
        call1Artifacts,
        pair.objectA,
        pair.objectB,
        'call1-',
        legendBlockImages,
      );

      // Attempt call 2 (refined) if call 1 succeeded
      if (call1Localization) {
        try {
          const refinedBbox = computeRefinedCropBbox(call1Localization, drawingBbox);
          const refinedCropPath = path.join(tmpDir, `refined-crop-p${pairIdx}.jpg`);

          logEvent('measure-distance:refined-crop', {
            pairIndex: pairIdx,
            refinedBbox,
            coarseBboxA: (call1Localization.objectA as Record<string, unknown>)?.bbox,
            coarseBboxB: (call1Localization.objectB as Record<string, unknown>)?.bbox,
          });

          renderPdfRegion(pdfPath, refinedBbox, refinedCropPath, 300);

          const call2Artifacts: OptionBArtifacts = {};
          const call2Localization = await localizeWithGemini(
            refinedCropPath,
            legendInfo.context,
            refinedBbox,  // call 2's drawingBbox is the refined region in full-page coords
            call2Artifacts,
            pair.objectA,
            pair.objectB,
            'call2-',
            legendBlockImages,
          );

          if (call2Localization) {
            // Use call 2's precise localization for compute-distance.
            // The refinedBbox is in full-page normalized coords, so the
            // Python compute-distance code maps 0-1000 through it correctly.
            localization = call2Localization;
            // Merge call2 artifacts into the main optionBArtifacts for metadata
            Object.assign(optionBArtifacts, {
              prompt: call2Artifacts.prompt,
              rawResponse: call2Artifacts.rawResponse,
              parsedResponse: call2Artifacts.parsedResponse,
              geminiConfidence: call2Artifacts.geminiConfidence,
              success: call2Artifacts.success,
            });
          } else {
            // Call 2 failed — fall back to call 1's coarse localization
            logEvent('measure-distance:call2-fallback', {
              pairIndex: pairIdx,
              reason: call2Artifacts.failureReason ?? 'call2 returned null',
            });
            localization = call1Localization;
            Object.assign(optionBArtifacts, call1Artifacts);
            usedCallPrefix = 'call1-';
          }
        } catch (error) {
          // Refined crop or call 2 threw — fall back to call 1
          const msg = error instanceof Error ? error.message : String(error);
          logEvent('measure-distance:call2-error', { pairIndex: pairIdx, error: msg });
          localization = call1Localization;
          Object.assign(optionBArtifacts, call1Artifacts);
          usedCallPrefix = 'call1-';
        }
      } else {
        // Call 1 failed entirely — propagate its artifacts
        Object.assign(optionBArtifacts, call1Artifacts);
        usedCallPrefix = 'call1-';
      }
    }

    // Per-pair metadata record
    const pairMetadata: Record<string, unknown> = {
      callId: pairCallId,
      callDir: pairCallDir,
      sessionCallId,
      runIndex: RUN_INDEX,
      checklistItem: CHECKLIST_ITEM,
      checklistIndex: CHECKLIST_INDEX,
      startedAt: new Date(startTime).toISOString(),
      strategy,
      pairIndex: pairIdx,
      reasoning: (values.reasoning as string) || undefined,
      applicableChecklistItems: values.applicable_checklist_items
        ? JSON.parse(values.applicable_checklist_items as string)
        : undefined,
      inputs: {
        projectId,
        documentId,
        sheetNum,
        objectA: pair.objectA,
        objectB: pair.objectB,
        scaleInchesPerFoot,
      },
      assets: {
        pdfStoragePath,
        jpegStoragePath,
        bucket,
        drawingBbox,
        legendSource: legendInfo.source,
        legendPath: 'legend.txt',
        croppedImagePath: optionBArtifacts.prompt ? `${usedCallPrefix}cropped.jpg` : null,
      },
      optionB: optionBArtifacts.prompt
        ? {
            promptPath: `${usedCallPrefix}prompt.txt`,
            responsePath: optionBArtifacts.rawResponse ? `${usedCallPrefix}response.txt` : null,
            success: optionBArtifacts.success ?? false,
            failureReason: optionBArtifacts.failureReason,
            geminiConfidence: optionBArtifacts.geminiConfidence,
            parsedResponsePath: optionBArtifacts.parsedResponse ? `${usedCallPrefix}localization.json` : null,
            usedCall: usedCallPrefix === 'call2-' ? 2 : 1,
          }
        : { skipped: true },
      call1: call1Artifacts.prompt
        ? {
            promptPath: 'call1-prompt.txt',
            responsePath: call1Artifacts.rawResponse ? 'call1-response.txt' : null,
            success: call1Artifacts.success ?? false,
            geminiConfidence: call1Artifacts.geminiConfidence,
            parsedResponsePath: call1Artifacts.parsedResponse ? 'call1-localization.json' : null,
          }
        : undefined,
    };

    function writePairMetadata(extra: Record<string, unknown>): void {
      const final = { ...pairMetadata, ...extra, elapsedMs: Date.now() - startTime };
      fs.writeFileSync(path.join(pairCallDir, 'metadata.json'), JSON.stringify(final, null, 2));
    }

    // Distance computation + debug image (delegate to Python)
    if (!localization) {
      const measurement = {
        pairIndex: pairIdx,
        objectA: pair.objectA,
        objectB: pair.objectB,
        distanceFeet: null as number | null,
        confidence: 'unable',
        callId: pairCallId,
        callDir: pairCallDir,
        warnings: ['Could not locate one or both objects on the sheet'],
      };
      logEvent('measure-distance:result', {
        pairIndex: pairIdx,
        distanceFeet: null, confidence: 'unable', method: 'none',
        fallbackUsed: strategy === 'a-then-b',
        elapsed_ms: Date.now() - startTime,
      });
      writePairMetadata({
        result: { distanceFeet: null, confidence: 'unable', method: 'none' },
      });
      writeSidecarLog();
      measurements.push(measurement);
      continue;
    }

    try {
      const stdout = callPython({
        mode: 'compute-distance',
        pdfPath,
        localization: JSON.stringify(localization),
        scaleInchesPerFoot,
        drawingBbox: JSON.stringify(drawingBbox),
        objectA: pair.objectA,
        objectB: pair.objectB,
        outputPath,
        sheetNum,
        legendSource: legendInfo.source,
        callDir: pairCallDir,
      });

      const pyResult = JSON.parse(stdout.trim());
      logEvent('measure-distance:result', {
        pairIndex: pairIdx,
        distanceFeet: pyResult.distanceFeet,
        confidence: pyResult.confidence,
        method: pyResult.localization?.method,
        fallbackUsed: pyResult.localization?.fallbackUsed,
        elapsed_ms: Date.now() - startTime,
      });

      writePairMetadata({
        result: {
          distanceFeet: pyResult.distanceFeet,
          distanceInches: pyResult.distanceInches,
          confidence: pyResult.confidence,
          method: pyResult.localization?.method,
          debugImagePath: pyResult.debugImagePath
            ? path.relative(pairCallDir, pyResult.debugImagePath)
            : null,
        },
      });
      writeSidecarLog();

      measurements.push({
        pairIndex: pairIdx,
        objectA: pair.objectA,
        objectB: pair.objectB,
        distanceFeet: pyResult.distanceFeet,
        confidence: pyResult.confidence,
        callId: pairCallId,
        callDir: pairCallDir,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logEvent('measure-distance:compute-error', { pairIndex: pairIdx, error: message });
      writePairMetadata({ error: message });
      writeSidecarLog();

      measurements.push({
        pairIndex: pairIdx,
        objectA: pair.objectA,
        objectB: pair.objectB,
        distanceFeet: null,
        confidence: 'error',
        callId: pairCallId,
        callDir: pairCallDir,
        error: message,
      });
    }
  }

  // ---- Write combined output ----

  const output = {
    measurements,
    sharedContext: {
      documentId,
      sheetNum,
      scaleInchesPerFoot,
      drawingBbox,
      legendSource: legendInfo.source,
      strategy,
      reasoning: (values.reasoning as string) || undefined,
      applicableChecklistItems: values.applicable_checklist_items
        ? JSON.parse(values.applicable_checklist_items as string)
        : undefined,
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(`measure-distance failed: ${error}`);
  writeSidecarLog();
  process.exit(1);
});
