/**
 * Semantic Search Blocks Tool
 *
 * Searches the project's content blocks by meaning (vector similarity), not
 * just exact phrases. Use when looking for a concept ("ADA accessibility
 * disclaimer", "fire department standard notes") that may not appear by
 * exact wording on the candidate sheets.
 *
 * Calls the Supabase RPC `search_content_blocks_hybrid` directly:
 *   1. Generate query embedding via OpenAI text-embedding-3-small
 *   2. Call hybrid search (keyword + vector) RPC scoped to the project
 *   3. Falls back to keyword-only RPC if OPENAI_API_KEY is missing
 *
 * The returned blocks include sheet_number / sheet_label / category /
 * description / content preview so the agent can decide which sheets to
 * read in detail.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CLI Args
// ============================================================================

const { values } = parseArgs({
  options: {
    projectId: { type: 'string' },
    query: { type: 'string' },
    maxResults: { type: 'string' },
    outputPath: { type: 'string' },
  },
  strict: false,
});

let { projectId, query, maxResults, outputPath } = values as Record<string, string>;

// Infer projectId from workspace if not provided. The agent often omits it
// since it's a workflow-level input, not a per-search parameter. The projects
// directory contains exactly one subdirectory named after the project ID.
if (!projectId) {
  const workspacePath = process.env.WORKSPACE_PATH;
  if (workspacePath) {
    const projectsDir = path.join(workspacePath, 'projects');
    if (fs.existsSync(projectsDir)) {
      const entries = fs
        .readdirSync(projectsDir)
        .filter(
          (e) => !e.startsWith('.') && fs.statSync(path.join(projectsDir, e)).isDirectory(),
        );
      if (entries.length === 1) {
        projectId = entries[0];
        console.error(`Inferred projectId from workspace: ${projectId}`);
      }
    }
  }
}

if (!query || !outputPath) {
  console.error(
    'Missing required arguments. Required: query, outputPath. Optional: projectId (inferred from workspace), maxResults.',
  );
  process.exit(1);
}
if (!projectId) {
  console.error('projectId not provided and could not be inferred from workspace.');
  process.exit(1);
}

const maxResultsNum = maxResults ? Number.parseInt(maxResults, 10) : 15;
if (Number.isNaN(maxResultsNum) || maxResultsNum < 1 || maxResultsNum > 50) {
  console.error('maxResults must be an integer between 1 and 50.');
  process.exit(1);
}

// ============================================================================
// Clients
// ============================================================================

function getSupabase() {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

// Use raw fetch to avoid pulling in additional embedding-SDK deps
async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[semantic-search-blocks] OPENAI_API_KEY not set, falling back to keyword-only');
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
      const body = await res.text();
      console.error(`[semantic-search-blocks] OpenAI embeddings error ${res.status}: ${body}`);
      return null;
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0]?.embedding ?? null;
  } catch (err) {
    console.error('[semantic-search-blocks] Failed to generate query embedding:', err);
    return null;
  }
}

// ============================================================================
// Logging (sidecar)
// ============================================================================

const logEntries: Array<Record<string, unknown>> = [];

function logEvent(event: string, data: Record<string, unknown> = {}) {
  const entry = { event, timestamp: Date.now(), ...data };
  logEntries.push(entry);
  console.error(JSON.stringify(entry));
}

function writeSidecarLog() {
  const logDir = path.dirname(outputPath);
  const logPath = path.join(logDir, 'semantic-search-blocks-log.jsonl');
  fs.mkdirSync(logDir, { recursive: true });
  // Append JSONL (one entry per line) so concurrent agent workers don't overwrite each other
  const lines = logEntries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(logPath, lines);
}

// ============================================================================
// Main
// ============================================================================

interface HybridResult {
  block_id: string;
  sheet_version_id: string;
  sheet_id: string;
  sheet_number: number;
  sheet_label: string | null;
  plan_set_version_id: string;
  category: string;
  description: string;
  content: string | null;
  combined_rank: number;
  keyword_rank: number;
  vector_similarity: number;
}

interface KeywordResult {
  block_id: string;
  sheet_version_id: string;
  sheet_id: string;
  sheet_number: number;
  sheet_label: string | null;
  plan_set_version_id: string;
  category: string;
  description: string;
  content: string | null;
  rank: number;
}

const CONTENT_PREVIEW_LENGTH = 500;

function truncate(text: string | null, maxLen: number): string | null {
  if (!text) return null;
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

async function main() {
  const startTime = Date.now();
  logEvent('semantic-search-blocks:start', { projectId, query, maxResults: maxResultsNum });

  const supabase = getSupabase();
  const queryEmbedding = await generateQueryEmbedding(query);

  let mode: 'hybrid' | 'keyword' = 'keyword';
  let results: Array<HybridResult | KeywordResult> = [];

  if (queryEmbedding) {
    const { data, error } = await supabase.rpc('search_content_blocks_hybrid', {
      target_project_id: projectId,
      search_query: query,
      query_embedding: JSON.stringify(queryEmbedding),
      max_results: maxResultsNum,
    });
    if (error) {
      logEvent('semantic-search-blocks:hybrid-error', { error: error.message });
      console.error(`[semantic-search-blocks] Hybrid RPC failed, falling back to keyword: ${error.message}`);
    } else {
      mode = 'hybrid';
      results = (data ?? []) as HybridResult[];
    }
  }

  if (mode === 'keyword') {
    const { data, error } = await supabase.rpc('search_content_blocks_keyword', {
      target_project_id: projectId,
      search_query: query,
      max_results: maxResultsNum,
    });
    if (error) {
      logEvent('semantic-search-blocks:keyword-error', { error: error.message });
      const failure = {
        query,
        projectId,
        mode: 'error',
        error: error.message,
        results: [],
      };
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(failure, null, 2));
      writeSidecarLog();
      console.log(JSON.stringify(failure, null, 2));
      return;
    }
    results = (data ?? []) as KeywordResult[];
  }

  const formatted = results.map((r) => ({
    sheetNumber: r.sheet_number,
    sheetLabel: r.sheet_label,
    category: r.category,
    description: r.description,
    contentPreview: truncate(r.content, CONTENT_PREVIEW_LENGTH),
    relevance:
      mode === 'hybrid'
        ? {
            combined: (r as HybridResult).combined_rank,
            keyword: (r as HybridResult).keyword_rank,
            semantic: (r as HybridResult).vector_similarity,
          }
        : { rank: (r as KeywordResult).rank },
    blockId: r.block_id,
    sheetVersionId: r.sheet_version_id,
  }));

  const output = {
    query,
    projectId,
    mode,
    resultCount: formatted.length,
    results: formatted,
    elapsed_ms: Date.now() - startTime,
  };

  logEvent('semantic-search-blocks:result', {
    mode,
    resultCount: formatted.length,
    elapsed_ms: Date.now() - startTime,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  writeSidecarLog();
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(`semantic-search-blocks failed: ${error}`);
  writeSidecarLog();
  process.exit(1);
});
