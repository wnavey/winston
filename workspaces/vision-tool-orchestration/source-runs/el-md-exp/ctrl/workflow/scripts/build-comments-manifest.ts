/**
 * Build Comments Manifest Script
 *
 * Reads all per-cluster structured comment files and produces a single
 * lightweight manifest with just the fields the organize-sections agent needs.
 * This replaces having the agent read 79 individual JSON files.
 *
 * Usage:
 *   npx tsx build-comments-manifest.ts \
 *     --commentsFolder=/path/to/structured-comments \
 *     --outputFile=/path/to/comments-manifest.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

interface ManifestEntry {
  id: string;
  title: string;
  citation: string;
  applicableArea: string;
  status: string;
  confidence: string;
  isCrossDepartment: boolean;
}

function main() {
  const { values } = parseArgs({
    options: {
      commentsFolder: { type: 'string' },
      outputFile: { type: 'string' },
    },
    strict: true,
  });

  const { commentsFolder, outputFile } = values;

  if (!commentsFolder) throw new Error('--commentsFolder is required');
  if (!outputFile) throw new Error('--outputFile is required');

  const jsonFiles = fs.readdirSync(commentsFolder)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(path.basename(a, '.json'), 10);
      const numB = parseInt(path.basename(b, '.json'), 10);
      return numA - numB;
    });

  if (jsonFiles.length === 0) {
    throw new Error(`No .json files found in ${commentsFolder}`);
  }

  const comments: ManifestEntry[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(commentsFolder, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    let parsed: { comments: Array<Record<string, unknown>> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in ${filePath}`);
    }

    if (!parsed.comments || !Array.isArray(parsed.comments)) {
      throw new Error(`${filePath} missing "comments" array`);
    }

    const baseName = path.basename(file, '.json');
    for (let i = 0; i < parsed.comments.length; i++) {
      const c = parsed.comments[i];
      comments.push({
        id: `${baseName}:${i}`,
        title: c.title as string,
        citation: c.citation as string,
        applicableArea: c.applicableArea as string,
        status: c.status as string,
        confidence: c.confidence as string,
        isCrossDepartment: c.isCrossDepartment as boolean,
      });
    }
  }

  const manifest = { comments };

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2));

  console.log(`Built manifest: ${comments.length} comments from ${jsonFiles.length} files`);
  console.log(`Written to: ${outputFile}`);
}

main();
