/**
 * Join Structured Comments Script
 *
 * Rejoins split cluster files after structure-comments has processed them.
 * When cluster-findings splits an oversized cluster into sub-files (e.g.,
 * 7-a.json, 7-b.json), this script merges their structured outputs back
 * into a single file (7.json) so downstream steps see only N.json files.
 *
 * Usage:
 *   npx tsx join-structured-comments.ts \
 *     --commentsFolder=/path/to/structured-comments
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

const SPLIT_FILE_PATTERN = /^(\d+)-([a-z]+)\.json$/;

interface StructuredCommentsFile {
  comments: Array<Record<string, unknown>>;
}

function main() {
  const { values } = parseArgs({
    options: {
      commentsFolder: { type: 'string' },
    },
    strict: true,
  });

  const { commentsFolder } = values;

  if (!commentsFolder) throw new Error('--commentsFolder is required');
  if (!fs.existsSync(commentsFolder)) {
    throw new Error(`Comments folder not found: ${commentsFolder}`);
  }

  const allFiles = fs.readdirSync(commentsFolder).filter(f => f.endsWith('.json'));

  // Identify split files and group by numeric prefix
  const splitGroups = new Map<string, string[]>();
  for (const file of allFiles) {
    const match = file.match(SPLIT_FILE_PATTERN);
    if (match) {
      const num = match[1];
      if (!splitGroups.has(num)) {
        splitGroups.set(num, []);
      }
      splitGroups.get(num)!.push(file);
    }
  }

  if (splitGroups.size === 0) {
    console.log('No split files found — nothing to join.');
    return;
  }

  let totalComments = 0;

  for (const [num, files] of splitGroups) {
    // Sort by suffix letter (a, b, c, ...)
    files.sort();

    const mergedComments: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const filePath = path.join(commentsFolder, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      let parsed: StructuredCommentsFile;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON in ${filePath}`);
      }

      if (!parsed.comments || !Array.isArray(parsed.comments)) {
        throw new Error(`${filePath} missing "comments" array`);
      }

      mergedComments.push(...parsed.comments);
    }

    // Write merged file
    const outFile = path.join(commentsFolder, `${num}.json`);
    const merged: StructuredCommentsFile = { comments: mergedComments };
    fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));

    // Delete split files
    for (const file of files) {
      fs.unlinkSync(path.join(commentsFolder, file));
    }

    totalComments += mergedComments.length;
    console.log(`Joined ${files.join(' + ')} → ${num}.json (${mergedComments.length} comments)`);
  }

  console.log(`\nRejoined ${splitGroups.size} clusters, ${totalComments} total comments.`);
}

main();
