import { prisma } from "@/lib/prisma";
import type { Question } from "@prisma/client";

export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 5;
export const DEFAULT_DIFFICULTY = 2.5;
const DIFFICULTY_STEP = 0.4;

/**
 * Elo-like heuristic step, not calibrated IRT: real item-response calibration
 * needs empirical response data that doesn't exist yet at Phase 1.
 */
export function nextDifficulty(
  current: number,
  isCorrect: boolean,
  timeSpentSec: number,
  estimatedTimeSec: number
): number {
  const speedFactor =
    timeSpentSec <= estimatedTimeSec * 0.6
      ? 1.2
      : timeSpentSec >= estimatedTimeSec * 1.5
        ? 0.8
        : 1;
  const delta = DIFFICULTY_STEP * speedFactor * (isCorrect ? 1 : -1);
  const next = current + delta;
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, Number(next.toFixed(2))));
}

export async function computeSkillTagCounts(
  testSessionId: string
): Promise<Record<string, number>> {
  const answers = await prisma.answer.findMany({
    where: { testSessionId },
    include: { question: { select: { skillTags: true } } },
  });

  const counts: Record<string, number> = {};
  for (const answer of answers) {
    for (const tag of answer.question.skillTags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

export async function selectNextQuestion({
  subdomainId,
  difficulty,
  excludeIds,
  skillTagCounts,
}: {
  subdomainId: string;
  difficulty: number;
  excludeIds: string[];
  skillTagCounts: Record<string, number>;
}): Promise<Question | null> {
  const candidates = await prisma.question.findMany({
    where: {
      subdomainId,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    },
  });

  if (candidates.length === 0) return null;

  let best: Question | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const difficultyGap = Math.abs(candidate.difficulty - difficulty);
    const tagCounts = candidate.skillTags.map((tag) => skillTagCounts[tag] ?? 0);
    // Prefer questions covering skill tags with fewer prior answers, so the
    // radar chart ends up with data spread across skills, not just one.
    const coverageScore = tagCounts.length ? Math.min(...tagCounts) * 0.15 : 0;
    const score = difficultyGap + coverageScore;

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}
