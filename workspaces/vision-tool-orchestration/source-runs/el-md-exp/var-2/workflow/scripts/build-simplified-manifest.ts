/**
 * Build Simplified Manifest Script
 *
 * Reads all per-grouping synthesized comment files (synthesize-simplified.schema.json format)
 * and builds a manifest for the section organizer agent.
 *
 * Each comment gets a stable ID in the format "{grouping}-{index}" (e.g. "de-4-0").
 * The manifest is a lightweight summary — just enough for the section organizer to make
 * grouping decisions without needing the full comment data.
 *
 * Usage:
 *   npx tsx build-simplified-manifest.ts \
 *     --synthesizedFolder=/path/to/04-synthesis \
 *     --outputFile=/path/to/04b-manifest.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

interface SimplifiedComment {
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
    runComments: Array<{ runNum: number; status: string; comment: string }>;
  }>;
}

interface SynthesizedFile {
  comments: SimplifiedComment[];
}

interface ManifestEntry {
  id: string;
  headline: string;
  firstCitation: string;
  applicableArea: string;
  severity: number;
  confidence: number;
}

function main() {
  const { values } = parseArgs({
    options: {
      synthesizedFolder: { type: 'string' },
      outputFile: { type: 'string' },
    },
    strict: true,
  });

  const { synthesizedFolder, outputFile } = values;

  if (!synthesizedFolder) throw new Error('--synthesizedFolder is required');
  if (!outputFile) throw new Error('--outputFile is required');

  const files = fs.readdirSync(synthesizedFolder)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .json files found in ${synthesizedFolder}`);
  }

  const manifest: ManifestEntry[] = [];

  for (const file of files) {
    const grouping = path.basename(file, '.json');
    const filePath = path.join(synthesizedFolder, file);
    const raw = fs.readFileSync(filePath, 'utf-8');

    let parsed: SynthesizedFile;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in ${filePath}`);
    }

    if (!parsed.comments || !Array.isArray(parsed.comments)) {
      throw new Error(`${filePath} missing "comments" array`);
    }

    for (let i = 0; i < parsed.comments.length; i++) {
      const comment = parsed.comments[i];
      const id = `${grouping}-${i}`;

      // First citation from the first detail, or empty
      const firstCitation = comment.details?.[0]?.citation ?? '';

      manifest.push({
        id,
        headline: comment.headline,
        firstCitation,
        applicableArea: comment.applicableArea,
        severity: comment.severity,
        confidence: comment.confidence,
      });
    }

    console.log(`Loaded ${file}: ${parsed.comments.length} comments`);
  }

  // Write manifest
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify({ comments: manifest }, null, 2));

  console.log(`\nManifest written: ${manifest.length} comments from ${files.length} groupings`);
  console.log(`Output: ${outputFile}`);
}

main();
