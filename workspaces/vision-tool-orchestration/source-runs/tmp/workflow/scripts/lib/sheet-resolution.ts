/**
 * Shared sheet-resolution helpers for review-workflow scripts.
 *
 * Centralises the Supabase-backed lookup chain that any script
 * cropping a sheet PDF needs to walk:
 *
 *   documentId (plan_set_id) + sheetNum
 *     → plan_set_version_id  (scoped to this workflow's submission)
 *     → sheet_version_id
 *     → storage_path           (the sheet PDF in submission-data)
 *     → content_block(s)       (largest category=drawing, or by id)
 *
 * Plus PDF download + bbox normalisation utilities.
 *
 * Adopted by: extract-measurement-pairs.ts.
 *
 * `inspect-drawing.ts` and `measure-distance.ts` carry inline copies of
 * these helpers from before this module existed — migrating them is a
 * follow-up, gated on regression-testing the existing flows.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type LogFn = (event: string, data?: Record<string, unknown>) => void;

const noopLog: LogFn = () => {};

export function getSupabase(): SupabaseClient {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

/**
 * Read the workflow's submissionVersionId from workflow/status.json.
 *
 * Conductor writes status.json before any step runs, with the validated
 * workflow inputs under `inputs`. Returns null when WORKSPACE_PATH is
 * unset, status.json is missing/unparseable, or the field is absent —
 * caller falls back to "latest by created_at" so test-script replays
 * keep working.
 */
export function loadSubmissionVersionId(): string | null {
  const workspacePath = process.env.WORKSPACE_PATH;
  if (!workspacePath) return null;
  const statusPath = path.join(workspacePath, 'workflow', 'status.json');
  if (!fs.existsSync(statusPath)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(statusPath, 'utf-8')) as {
      inputs?: Record<string, unknown>;
    };
    const id = state?.inputs?.submissionVersionId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function getPlanSetVersionId(
  planSetId: string,
  logEvent: LogFn = noopLog,
): Promise<string | null> {
  const supabase = getSupabase();
  const submissionVersionId = loadSubmissionVersionId();

  if (submissionVersionId) {
    const { data } = await supabase
      .from('plan_set_version')
      .select('id')
      .eq('plan_set_id', planSetId)
      .eq('submission_version_id', submissionVersionId)
      .maybeSingle();
    if (data?.id) return data.id as string;
    logEvent('sheet-resolution:plan-set-version-scope-miss', {
      planSetId,
      submissionVersionId,
      reason: 'no plan_set_version found for (plan_set_id, submission_version_id)',
    });
    return null;
  }

  const { data } = await supabase
    .from('plan_set_version')
    .select('id')
    .eq('plan_set_id', planSetId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function getSheetVersionId(
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
  return (data?.id as string) ?? null;
}

export async function getSheetPdfStoragePath(sheetVersionId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('sheet_version')
    .select('storage_path')
    .eq('id', sheetVersionId)
    .single();
  return (data?.storage_path as string) ?? null;
}

export type Bbox = { x0: number; y0: number; x1: number; y1: number };

/**
 * Normalize the DB bbox shape — content_block.bounding_box may be
 * stored as either {x0,y0,x1,y1} or {x,y,width,height}.
 */
export function normalizeBbox(bb: Record<string, number> | null): Bbox | null {
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

export interface DrawingBlockPick {
  bbox: Bbox;
  blockId: string;
  /** Fraction of page area (in normalized 0–1 space). */
  areaFraction: number;
  /** Ratio of picked block area to the second-largest, if any. */
  dominanceRatio: number | null;
}

/**
 * Find the largest category='drawing' content_block on a sheet.
 *
 * Logs the full distribution of considered blocks under the
 * `sheet-resolution:drawing-blocks-considered` event so post-hoc
 * analysis can answer "how dominant was the picked block?" without a
 * separate DB join.
 */
export async function findLargestDrawingBlock(
  sheetVersionId: string,
  logEvent: LogFn = noopLog,
): Promise<DrawingBlockPick | null> {
  const supabase = getSupabase();
  const { data: blocks } = await supabase
    .from('content_block')
    .select('id, bounding_box, category')
    .eq('sheet_version_id', sheetVersionId)
    .eq('category', 'drawing');
  if (!blocks?.length) {
    logEvent('sheet-resolution:drawing-blocks-considered', { count: 0, blocks: [] });
    return null;
  }

  type Sized = { id: string; bbox: Bbox; area: number };
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
    logEvent('sheet-resolution:drawing-blocks-considered', {
      count: blocks.length,
      blocks: [],
      reason: 'all bounding_box entries failed to normalize',
    });
    return null;
  }

  sized.sort((a, b) => b.area - a.area);
  const best = sized[0];
  const dominanceRatio =
    sized.length > 1 && sized[1].area > 0 ? best.area / sized[1].area : null;

  logEvent('sheet-resolution:drawing-blocks-considered', {
    count: sized.length,
    pickedBlockId: best.id,
    pickedAreaFraction: best.area,
    pickedDominanceRatio: dominanceRatio,
    blocks: sized.map((s) => ({
      blockId: s.id,
      areaFraction: s.area,
      bbox: s.bbox,
    })),
  });

  return {
    bbox: best.bbox,
    blockId: best.id,
    areaFraction: best.area,
    dominanceRatio,
  };
}

export async function findBlockById(blockId: string): Promise<Bbox | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('content_block')
    .select('bounding_box')
    .eq('id', blockId)
    .single();
  if (!data?.bounding_box) return null;
  return normalizeBbox(data.bounding_box as Record<string, number>);
}

export async function downloadAsset(
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

/**
 * Resolve the full sheet+PDF chain in one call. Convenience for scripts
 * that always need plan_set_version → sheet_version → pdfPath end-to-end.
 *
 * Throws on any missing link, so callers that want graceful fallback
 * should use the lower-level helpers directly.
 */
export async function resolveSheetPdf(args: {
  documentId: string;
  sheetNumber: number;
  pdfLocalPath: string;
  logEvent?: LogFn;
}): Promise<{
  planSetVersionId: string;
  sheetVersionId: string;
  pdfStoragePath: string;
  pdfPath: string;
}> {
  const { documentId, sheetNumber, pdfLocalPath, logEvent = noopLog } = args;

  const planSetVersionId = await getPlanSetVersionId(documentId, logEvent);
  if (!planSetVersionId) {
    throw new Error(
      `Could not resolve plan_set_version for documentId=${documentId}`,
    );
  }
  const sheetVersionId = await getSheetVersionId(planSetVersionId, sheetNumber);
  if (!sheetVersionId) {
    throw new Error(
      `Could not resolve sheet_version for planSetVersionId=${planSetVersionId} sheetNumber=${sheetNumber}`,
    );
  }
  const pdfStoragePath = await getSheetPdfStoragePath(sheetVersionId);
  if (!pdfStoragePath) {
    throw new Error(
      `Could not resolve storage_path for sheet_version_id=${sheetVersionId}`,
    );
  }
  const pdfPath = await downloadAsset(pdfStoragePath, pdfLocalPath);
  return { planSetVersionId, sheetVersionId, pdfStoragePath, pdfPath };
}
