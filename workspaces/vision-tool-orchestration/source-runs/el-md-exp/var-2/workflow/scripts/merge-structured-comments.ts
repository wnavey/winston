/**
 * Merge Structured Comments Script
 *
 * Final step in the comment-structuring pipeline. Assembles review-comments.json
 * from per-cluster structured comment files, section assignments (with string IDs),
 * and project metadata from facts.md.
 *
 * Generates summaryByCategory and summaryByArea deterministically — no LLM needed.
 *
 * Usage:
 *   npx tsx merge-structured-comments.ts \
 *     --commentsFolder=/path/to/structured-comments \
 *     --assignmentsFile=/path/to/section-assignments.json \
 *     --factsFile=/path/to/facts.md \
 *     --outputFile=/path/to/review-comments.json \
 *     --schemaFile=/path/to/comment-structuring.schema.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// --- Input types ---

interface StructuredComment {
  title: string;
  status: 'fail' | 'not-verifiable';
  comment: string;
  issue: string;
  citation: string;
  sheets: string;
  applicableArea: string;
  resolution: string;
  confidence: 'high' | 'medium' | 'low';
  runCount: number;
  totalRuns: number;
  isCrossDepartment: boolean;
  crossDepartmentNote: string | null;
  isReviewerAttention: boolean;
  reviewerAttentionNote: string | null;
  sheetReferences: { documentId: string; sheetNumber: number; label: string }[];
  documentReferences: { documentId: string; label: string }[];
  sourceFindings: unknown[];
}

interface ClusterFile {
  comments: StructuredComment[];
}

interface Section {
  sectionName: string;
  comments: string[]; // String IDs like "1:0", "14:2"
}

interface AreaAssignment {
  id: string;
  area: string;
}

interface AssignmentsFile {
  sections: Section[];
  areaAssignments?: AreaAssignment[];
}

// --- Helpers ---

/** Parse a string ID like "1:0" into { file: "1.json", index: 0 } */
function parseCommentId(id: string): { file: string; index: number } {
  const colonIdx = id.indexOf(':');
  if (colonIdx === -1) {
    throw new Error(`Invalid comment ID "${id}" — expected format "file:index"`);
  }
  const filePart = id.substring(0, colonIdx);
  const indexPart = id.substring(colonIdx + 1);
  const index = parseInt(indexPart, 10);
  if (isNaN(index) || index < 0) {
    throw new Error(`Invalid comment ID "${id}" — index "${indexPart}" is not a valid non-negative integer`);
  }
  return { file: `${filePart}.json`, index };
}

/** Truncate a string to maxLen chars, appending "..." if truncated */
function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.substring(0, maxLen - 3) + '...';
}

// --- facts.md parsing ---

function parseFactsMetadata(factsContent: string): {
  projectName: string;
  address: string;
  programs: { name: string; status: string; governs: string }[];
  discipline: string;
} {
  // Project name: look for case number in title or Site Plan Details section
  let projectName = 'Unknown';
  const caseMatch = factsContent.match(/# Site Plan Review Facts:\s*(.+)/);
  if (caseMatch) {
    projectName = caseMatch[1].trim();
  }
  // Also check Site Plan Details for a more descriptive name
  const projectNameMatch = factsContent.match(/\*\*Project Name\*\*:\s*(.+)/);
  if (projectNameMatch) {
    projectName = projectNameMatch[1].trim();
  }

  // Address: look for official address in Property Identification
  let address = 'Unknown';
  const addressMatch = factsContent.match(/\*\*Address \(COA Official\)\*\*:\s*(.+)/);
  if (addressMatch) {
    address = addressMatch[1].trim();
  } else {
    // Fallback: look for any address field
    const fallbackAddress = factsContent.match(/\*\*Address[^*]*\*\*:\s*(.+)/);
    if (fallbackAddress) {
      address = fallbackAddress[1].trim();
    }
  }

  // Programs: parse from Zoning & Land Use and Code Compliance sections
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

  return { projectName, address, programs, discipline };
}

// --- Main ---

function main() {
  const { values } = parseArgs({
    options: {
      commentsFolder: { type: 'string' },
      assignmentsFile: { type: 'string' },
      factsFile: { type: 'string' },
      outputFile: { type: 'string' },
    },
    strict: true,
  });

  const { commentsFolder, assignmentsFile, factsFile, outputFile } = values;

  if (!commentsFolder) throw new Error('--commentsFolder is required');
  if (!assignmentsFile) throw new Error('--assignmentsFile is required');
  if (!factsFile) throw new Error('--factsFile is required');
  if (!outputFile) throw new Error('--outputFile is required');

  // 1. Read all per-cluster comment files
  const clusterFiles = fs.readdirSync(commentsFolder)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(path.basename(a, '.json'), 10);
      const numB = parseInt(path.basename(b, '.json'), 10);
      return numA - numB;
    });

  if (clusterFiles.length === 0) {
    throw new Error(`No .json files found in ${commentsFolder}`);
  }

  const commentsByFile = new Map<string, StructuredComment[]>();

  for (const file of clusterFiles) {
    const filePath = path.join(commentsFolder, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    let parsed: ClusterFile;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in ${filePath}`);
    }

    if (!parsed.comments || !Array.isArray(parsed.comments)) {
      throw new Error(`${filePath} missing "comments" array`);
    }

    commentsByFile.set(file, parsed.comments);
    console.log(`Loaded ${file}: ${parsed.comments.length} comments`);
  }

  // 2. Read section assignments
  if (!fs.existsSync(assignmentsFile)) {
    throw new Error(`Assignments file not found: ${assignmentsFile}`);
  }
  const assignments: AssignmentsFile = JSON.parse(fs.readFileSync(assignmentsFile, 'utf-8'));

  if (!assignments.sections || !Array.isArray(assignments.sections)) {
    throw new Error('Assignments file missing "sections" array');
  }

  console.log(`\nLoaded ${assignments.sections.length} sections from assignments`);

  // 2b. Build canonical area map from areaAssignments
  const idToArea = new Map<string, string>();
  if (assignments.areaAssignments && assignments.areaAssignments.length > 0) {
    for (const aa of assignments.areaAssignments) {
      idToArea.set(aa.id, aa.area);
    }
    console.log(`Loaded ${idToArea.size} area assignments (${new Set(idToArea.values()).size} unique areas)`);
  }

  // 3. Validate comment IDs — fail on invalid refs, warn on dupes/missing
  let invalidRefs = 0;
  const assignedIds = new Set<string>();
  let duplicateCount = 0;

  for (const section of assignments.sections) {
    // Filter out invalid and duplicate IDs in place
    const validIds: string[] = [];
    for (const id of section.comments) {
      const { file, index } = parseCommentId(id);
      const clusterComments = commentsByFile.get(file);
      if (!clusterComments) {
        console.warn(`  WARN: Section "${section.sectionName}" references unknown file "${file}" (from ID "${id}") — skipping`);
        invalidRefs++;
        continue;
      }
      if (index >= clusterComments.length) {
        console.warn(`  WARN: Section "${section.sectionName}" references ${file}[${index}] (from ID "${id}") but file only has ${clusterComments.length} comments — skipping`);
        invalidRefs++;
        continue;
      }
      if (assignedIds.has(id)) {
        console.warn(`  WARN: Duplicate ID "${id}" in section "${section.sectionName}" — skipping`);
        duplicateCount++;
        continue;
      }
      assignedIds.add(id);
      validIds.push(id);
    }
    section.comments = validIds;
  }

  if (invalidRefs > 0) {
    console.warn(`\n⚠ ${invalidRefs} invalid references in section assignments`);
  }
  if (duplicateCount > 0) {
    console.warn(`⚠ ${duplicateCount} duplicate IDs deduplicated`);
  }

  // Check for unassigned comments — will be added to catch-all section
  const totalAvailable = [...commentsByFile.values()].reduce((sum, c) => sum + c.length, 0);
  const unassignedIds: string[] = [];
  for (const [file, comments] of commentsByFile) {
    const baseName = path.basename(file, '.json');
    for (let i = 0; i < comments.length; i++) {
      const id = `${baseName}:${i}`;
      if (!assignedIds.has(id)) {
        unassignedIds.push(id);
      }
    }
  }
  if (unassignedIds.length > 0) {
    console.warn(`⚠ ${unassignedIds.length} comments not assigned — adding to "Other Issues" section`);
  }

  // 4. Read facts.md for project metadata
  if (!fs.existsSync(factsFile)) {
    throw new Error(`Facts file not found: ${factsFile}`);
  }
  const factsContent = fs.readFileSync(factsFile, 'utf-8');
  const factsMeta = parseFactsMetadata(factsContent);

  console.log(`Project: ${factsMeta.projectName}`);
  console.log(`Address: ${factsMeta.address}`);

  // 5. Assemble sections with comments, renumber sequentially
  let commentNumber = 1;
  const allComments: StructuredComment[] = [];

  const sections = assignments.sections.map((section) => {
    const numberedComments = section.comments.map(id => {
      const { file, index } = parseCommentId(id);
      const comment = commentsByFile.get(file)![index];
      const canonicalArea = idToArea.get(id);
      const numbered = {
        ...comment,
        applicableArea: canonicalArea || comment.applicableArea,
        commentNumber: commentNumber++,
      };
      allComments.push(numbered);
      return numbered;
    });

    return {
      sectionName: section.sectionName,
      comments: numberedComments,
    };
  }).filter(s => s.comments.length > 0)
    .map((s, idx) => ({ ...s, sectionNumber: idx + 1 }));

  // Add catch-all section for unassigned comments
  if (unassignedIds.length > 0) {
    const numberedUnassigned = unassignedIds.map(id => {
      const { file, index } = parseCommentId(id);
      const comment = commentsByFile.get(file)![index];
      const canonicalArea = idToArea.get(id);
      const numbered = {
        ...comment,
        applicableArea: canonicalArea || comment.applicableArea,
        commentNumber: commentNumber++,
      };
      allComments.push(numbered);
      return numbered;
    });
    sections.push({
      sectionNumber: sections.length + 1,
      sectionName: 'Other Issues',
      comments: numberedUnassigned,
    });
  }

  // 6. Generate summaries deterministically

  // summaryByCategory: one entry per section
  const summaryByCategory = sections.map(section => {
    const titles = [...new Set(section.comments.map(c => c.title))];
    const keyActions = truncate(titles.join('; '), 200);
    return {
      category: section.sectionName,
      issues: section.comments.length,
      keyActions,
    };
  });

  // summaryByArea: group all comments by applicableArea (now canonical from areaAssignments)
  const areaMap = new Map<string, StructuredComment[]>();
  for (const comment of allComments) {
    const area = comment.applicableArea || 'General';
    if (!areaMap.has(area)) {
      areaMap.set(area, []);
    }
    areaMap.get(area)!.push(comment);
  }

  const summaryByArea = [...areaMap.entries()]
    .sort((a, b) => b[1].length - a[1].length) // most issues first
    .map(([area, comments]) => {
      const titles = [...new Set(comments.map(c => c.title))];
      const primaryConcerns = truncate(titles.join('; '), 200);
      return {
        area,
        issues: comments.length,
        primaryConcerns,
      };
    });

  // 7. Compute metadata
  const totalIssues = allComments.length;
  const requiredCount = allComments.filter(c => c.status === 'fail').length;
  const recommendationCount = allComments.filter(c => c.status === 'not-verifiable').length;
  const crossDepartmentCount = allComments.filter(c => c.isCrossDepartment).length;
  const reviewerAttentionCount = allComments.filter(c => c.isReviewerAttention).length;

  const confidenceBreakdown = {
    high: allComments.filter(c => c.confidence === 'high').length,
    medium: allComments.filter(c => c.confidence === 'medium').length,
    low: allComments.filter(c => c.confidence === 'low').length,
  };

  // Collect unique applicable areas
  const uniqueAreas = new Set<string>();
  for (const c of allComments) {
    if (c.applicableArea) {
      uniqueAreas.add(c.applicableArea);
    }
  }
  const applicableAreas = [...uniqueAreas].sort().join(', ');

  // Review method
  const totalRuns = allComments.length > 0 ? allComments[0].totalRuns : 3;
  const reviewMethod = `Ensemble Review — ${totalRuns} independent passes with cross-run consolidation`;

  // Review status
  const reviewStatus = requiredCount > 0 ? 'Revisions Required' : 'Approved';

  // Review date
  const now = new Date();
  const reviewDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // 8. Assemble final output
  const output = {
    reviewData: {
      metadata: {
        discipline: factsMeta.discipline,
        projectName: factsMeta.projectName,
        address: factsMeta.address,
        applicableAreas,
        reviewStatus,
        reviewDate,
        reviewMethod,
        programs: factsMeta.programs,
        totalIssues,
        requiredCount,
        recommendationCount,
        crossDepartmentCount,
        reviewerAttentionCount,
        confidenceBreakdown,
        summaryByCategory,
        summaryByArea,
      },
      sections,
    },
  };

  // 9. Write output
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  // 10. Summary stats
  console.log(`\n--- Summary ---`);
  console.log(`Total comments: ${totalIssues}`);
  console.log(`Sections: ${sections.length}`);
  console.log(`  Required (fail): ${requiredCount}`);
  console.log(`  Recommendations (not-verifiable): ${recommendationCount}`);
  console.log(`  Cross-department: ${crossDepartmentCount}`);
  console.log(`  Reviewer attention: ${reviewerAttentionCount}`);
  console.log(`Confidence: ${confidenceBreakdown.high} high, ${confidenceBreakdown.medium} medium, ${confidenceBreakdown.low} low`);
  console.log(`Summary: ${summaryByCategory.length} categories, ${summaryByArea.length} areas`);
  console.log(`Review status: ${reviewStatus}`);
  console.log(`Written to: ${outputFile}`);

}

main();
