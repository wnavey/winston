/**
 * Merge and Score Evals
 *
 * Reads N per-run scoring files, scores each, then computes the union (ensemble recall):
 * an issue is "caught" if ANY run caught it. This is deterministic and matches the
 * ensemble's theoretical guarantee — no separate consolidated agent eval needed.
 *
 * Usage:
 *   npx tsx merge-and-score-evals.ts \
 *     --runsDir=/path/to/output/eval \
 *     --outputPath=/path/to/output/eval/scoring.json \
 *     --runCount=3 \
 *     --discipline=ud \
 *     --disciplineName="Urban Design"
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

interface Evaluation {
  atomic_issue_id: string;
  caught: boolean;
  finding_ref: string | null;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ScoringInput {
  discipline: string;
  discipline_name: string;
  evaluations: Evaluation[];
}

interface ScoredResult {
  evaluations: Evaluation[];
  total: number;
  caught: number;
  missed: number;
  score_pct: number;
  missed_issues: string[];
  low_confidence_issues: string[];
}

interface MergedOutput {
  discipline: string;
  discipline_name: string;
  consolidated: ScoredResult;
  per_run: Record<string, ScoredResult>;
}

function scoreEvaluations(evaluations: Evaluation[]): ScoredResult {
  const total = evaluations.length;
  const caughtCount = evaluations.filter((e) => e.caught).length;
  const missedCount = total - caughtCount;
  const scorePct = total > 0 ? Math.round((caughtCount / total) * 1000) / 10 : 0;

  const missedIssues = evaluations.filter((e) => !e.caught).map((e) => e.atomic_issue_id);
  const lowConfidenceIssues = evaluations
    .filter((e) => e.confidence === 'medium' || e.confidence === 'low')
    .map((e) => e.atomic_issue_id);

  return {
    evaluations,
    total,
    caught: caughtCount,
    missed: missedCount,
    score_pct: scorePct,
    missed_issues: missedIssues,
    low_confidence_issues: lowConfidenceIssues,
  };
}

/**
 * Compute union recall: issue is caught if ANY run caught it.
 * Takes the best (most confident, then caught-first) evaluation per issue.
 */
function computeUnion(perRunData: Record<string, ScoringInput>): Evaluation[] {
  const runKeys = Object.keys(perRunData);
  if (runKeys.length === 0) return [];

  // Collect all unique issue IDs (in order from first run)
  const issueIds = perRunData[runKeys[0]].evaluations.map((e) => e.atomic_issue_id);

  const confidenceRank: Record<string, number> = { high: 3, medium: 2, low: 1 };

  return issueIds.map((issueId) => {
    // Gather this issue's evaluation from every run
    const candidates = runKeys
      .map((runKey) => perRunData[runKey].evaluations.find((e) => e.atomic_issue_id === issueId))
      .filter((e): e is Evaluation => e !== undefined);

    // Union: caught if any run caught it
    const caughtCandidates = candidates.filter((e) => e.caught);

    if (caughtCandidates.length === 0) {
      // Not caught by any run — use highest-confidence miss for evidence
      const best = candidates.sort(
        (a, b) => (confidenceRank[b.confidence] ?? 0) - (confidenceRank[a.confidence] ?? 0)
      )[0];
      return best ?? candidates[0];
    }

    // Caught — pick the highest-confidence caught evaluation
    const best = caughtCandidates.sort(
      (a, b) => (confidenceRank[b.confidence] ?? 0) - (confidenceRank[a.confidence] ?? 0)
    )[0];
    return best;
  });
}

function main() {
  const { values } = parseArgs({
    options: {
      runsDir: { type: 'string' },
      outputPath: { type: 'string' },
      runCount: { type: 'string' },
    },
    strict: true,
  });

  const { runsDir, outputPath, runCount: runCountStr } = values;

  if (!runsDir || !outputPath || !runCountStr) {
    throw new Error('--runsDir, --outputPath, and --runCount are all required');
  }

  const runCount = parseInt(runCountStr, 10);

  // Read and score each per-run eval
  const perRunData: Record<string, ScoringInput> = {};
  const perRun: Record<string, ScoredResult> = {};
  let discipline = '';
  let disciplineName = '';

  for (let i = 1; i <= runCount; i++) {
    const runKey = `run-${i}`;
    const runPath = path.join(runsDir, `scoring-${runKey}.json`);

    if (!fs.existsSync(runPath)) {
      console.warn(`Warning: ${runPath} not found, skipping ${runKey}`);
      continue;
    }

    const runData: ScoringInput = JSON.parse(fs.readFileSync(runPath, 'utf-8'));

    if (!Array.isArray(runData.evaluations)) {
      console.warn(`Warning: ${runPath} has no evaluations array, skipping ${runKey}`);
      continue;
    }

    perRunData[runKey] = runData;
    perRun[runKey] = scoreEvaluations(runData.evaluations);
    discipline = discipline || runData.discipline;
    disciplineName = disciplineName || runData.discipline_name;

    console.log(`${runKey}: ${perRun[runKey].caught}/${perRun[runKey].total} (${perRun[runKey].score_pct}%)`);
  }

  // Compute union (ensemble recall) deterministically from per-run evals
  const unionEvaluations = computeUnion(perRunData);
  const consolidated = scoreEvaluations(unionEvaluations);

  console.log(`union (ensemble): ${consolidated.caught}/${consolidated.total} (${consolidated.score_pct}%)`);

  const output: MergedOutput = {
    discipline,
    discipline_name: disciplineName,
    consolidated,
    per_run: perRun,
  };

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nMerged ${Object.keys(perRun).length} per-run evals → ${outputPath}`);
}

main();
