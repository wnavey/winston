/**
 * Merge Simplified Comments Script
 *
 * Final assembly step for the 2026-04-simplified review schema.
 * Reads per-grouping synthesized comment files + section assignments,
 * groups comments into sections, and outputs the final review-comments.json.
 *
 * Usage:
 *   npx tsx merge-simplified-comments.ts \
 *     --synthesizedFolder=/path/to/04-synthesis \
 *     --sectionAssignmentsFile=/path/to/04c-section-assignments.json \
 *     --factsFile=/path/to/facts.md \
 *     --outputFile=/path/to/review-comments.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// --- Types ---

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

interface SimplifiedCommentWithMeta extends SimplifiedComment {
  section: string;
  commentNumber: number;
}

interface SectionAssignment {
  label: string;
  summary: string;
  commentIds: string[];
}

interface SectionAssignmentsFile {
  sections: SectionAssignment[];
}

/**
 * Generate a URL-safe slug from a label, ensuring uniqueness.
 * Must match the PL/pgSQL and conductor versions exactly.
 */
function slugify(label: string, existing: Set<string>): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!base) base = 'section';
  let slug = base;
  let n = 2;
  while (existing.has(slug)) {
    slug = `${base}-${n++}`;
  }
  existing.add(slug);
  return slug;
}

// --- facts.md parsing ---

function parseFactsMetadata(factsContent: string): {
  discipline: string;
  programs: { name: string; status: string; governs: string }[];
} {
  const programs: { name: string; status: string; governs: string }[] = [];

  // Zoning
  const zoningMatch = factsContent.match(/\*\*Zoning\*\*:\s*(.+)/);
  if (zoningMatch) {
    programs.push({
      name: zoningMatch[1].trim(),
      status: 'Active',
      governs: 'Land use and development standards',
    });
  }

  // Neighborhood Plan
  const npMatch = factsContent.match(/\*\*Neighborhood Plan\*\*:\s*(.+)/);
  if (npMatch && npMatch[1].trim() !== 'None') {
    programs.push({
      name: npMatch[1].trim(),
      status: 'Active',
      governs: 'Neighborhood-level land use policies',
    });
  }

  // LDC Exceptions
  const ldcMatch = factsContent.match(/\*\*LDC Exception\*\*:\s*(.+)/);
  if (ldcMatch) {
    programs.push({
      name: ldcMatch[1].trim(),
      status: 'Applied',
      governs: 'Code exception for redevelopment',
    });
  }

  // Barton Springs Zone
  const bszMatch = factsContent.match(/\*\*Barton Springs Zone\*\*:\s*Yes/);
  if (bszMatch) {
    programs.push({
      name: 'Barton Springs Zone',
      status: 'Active',
      governs: 'Environmental protection requirements',
    });
  }

  // Discipline: default to Site/Civil Engineering
  const discipline = 'Site/Civil Engineering';

  return { discipline, programs };
}

// --- Main ---

function main() {
  const { values } = parseArgs({
    options: {
      synthesizedFolder: { type: 'string' },
      sectionAssignmentsFile: { type: 'string' },
      factsFile: { type: 'string' },
      outputFile: { type: 'string' },
      bureauCommitHash: { type: 'string' },
      bureauArtifactPath: { type: 'string' },
    },
    strict: true,
  });

  const { synthesizedFolder, sectionAssignmentsFile, factsFile, outputFile, bureauCommitHash, bureauArtifactPath } = values;

  if (!synthesizedFolder) throw new Error('--synthesizedFolder is required');
  if (!sectionAssignmentsFile) throw new Error('--sectionAssignmentsFile is required');
  if (!factsFile) throw new Error('--factsFile is required');
  if (!outputFile) throw new Error('--outputFile is required');

  // 1. Read all per-grouping synthesized files and build ID → comment map
  const commentMap = new Map<string, SimplifiedComment>();

  const files = fs.readdirSync(synthesizedFolder)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .json files found in ${synthesizedFolder}`);
  }

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
      const id = `${grouping}-${i}`;
      commentMap.set(id, parsed.comments[i]);
    }

    console.log(`Loaded ${file}: ${parsed.comments.length} comments`);
  }

  console.log(`Total comments: ${commentMap.size}`);

  // 2. Read section assignments
  if (!fs.existsSync(sectionAssignmentsFile)) {
    throw new Error(`Section assignments file not found: ${sectionAssignmentsFile}`);
  }
  const assignmentsRaw = fs.readFileSync(sectionAssignmentsFile, 'utf-8');
  const assignments: SectionAssignmentsFile = JSON.parse(assignmentsRaw);

  if (!assignments.sections || !Array.isArray(assignments.sections)) {
    throw new Error('Section assignments file missing "sections" array');
  }

  // 3. Read facts.md for metadata
  if (!fs.existsSync(factsFile)) {
    throw new Error(`Facts file not found: ${factsFile}`);
  }
  const factsContent = fs.readFileSync(factsFile, 'utf-8');
  const factsMeta = parseFactsMetadata(factsContent);

  // 4. Build sections from assignments, collecting comments per section
  const assignedIds = new Set<string>();
  const usedSlugs = new Set<string>();

  // Intermediate: sections with their comments for slug assignment
  const sectionData: { label: string; summary: string; comments: SimplifiedComment[] }[] = [];

  for (const assignment of assignments.sections) {
    const comments: SimplifiedComment[] = [];
    for (const id of assignment.commentIds) {
      const comment = commentMap.get(id);
      if (!comment) {
        console.warn(`Warning: section "${assignment.label}" references unknown comment ID "${id}"`);
        continue;
      }
      comments.push(comment);
      assignedIds.add(id);
    }
    if (comments.length > 0) {
      sectionData.push({ label: assignment.label, summary: assignment.summary, comments });
    }
  }

  // 5. Check for unassigned comments
  const unassigned: string[] = [];
  for (const id of commentMap.keys()) {
    if (!assignedIds.has(id)) {
      unassigned.push(id);
    }
  }

  if (unassigned.length > 0) {
    console.warn(`\nWarning: ${unassigned.length} comments not assigned to any section: ${unassigned.join(', ')}`);
    const catchAllComments = unassigned
      .map(id => commentMap.get(id)!)
      .filter(Boolean);

    if (catchAllComments.length > 0) {
      const catchAllSection = sectionData.find(s => s.label === 'Plan Documentation & Administrative');
      if (catchAllSection) {
        catchAllSection.comments.push(...catchAllComments);
      } else {
        sectionData.push({
          label: 'Plan Documentation & Administrative',
          summary: 'Unassigned comments that did not match a specific section.',
          comments: catchAllComments,
        });
      }
    }
  }

  // 6. Generate slugs for sections, build flat sections array (no comments)
  const sections: { slug: string; label: string; summary: string }[] = [];
  const allComments: SimplifiedCommentWithMeta[] = [];

  for (const sec of sectionData) {
    const slug = slugify(sec.label, usedSlugs);
    sections.push({ slug, label: sec.label, summary: sec.summary });

    // Collect comments with section slug (order within section preserved)
    for (const c of sec.comments) {
      allComments.push({ ...c, section: slug, commentNumber: 0 });
    }
  }

  // 7. Sort comments by severity descending (ties: preserve section order, then original order)
  allComments.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));
  // Assign commentNumber 1..N
  allComments.forEach((c, i) => { c.commentNumber = i + 1; });

  // 8. Generate review date
  const now = new Date();
  const reviewDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // 9. Assemble final output
  // The reviewData wrapper with metadata is required because the conductor
  // engine gates on parsed.reviewData?.metadata before saving to DB.
  const output = {
    reviewData: {
      metadata: {
        discipline: factsMeta.discipline,
        reviewDate,
        programs: factsMeta.programs,
        bureauCommitHash: bureauCommitHash || null,
        bureauArtifactPath: bureauArtifactPath || null,
      },
      sections,
      comments: allComments,
    },
  };

  // 10. Write output
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  // 11. Summary stats
  const totalDetails = allComments.reduce((sum, c) => sum + c.details.length, 0);

  console.log(`\n--- Summary ---`);
  console.log(`Sections: ${sections.length}`);
  console.log(`Total comments: ${allComments.length}`);
  console.log(`Total details: ${totalDetails}`);
  console.log(`Review date: ${reviewDate}`);
  console.log(`Discipline: ${factsMeta.discipline}`);
  console.log(`Programs: ${factsMeta.programs.length}`);
  if (unassigned.length > 0) {
    console.log(`Unassigned (added to catch-all): ${unassigned.length}`);
  }
  console.log(`Written to: ${outputFile}`);
}

main();
