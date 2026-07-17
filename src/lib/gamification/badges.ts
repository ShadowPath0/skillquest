import { prisma } from "@/lib/prisma";

type BadgeCriteria =
  | { type: "test_completed_count"; count: number }
  | { type: "streak"; days: number }
  | { type: "test_score"; minScore: number }
  | { type: "program_week_completed"; weekNumber: number }
  | { type: "program_completed" }
  | { type: "final_exam_completed" }
  | { type: "domains_explored"; count: number };

export async function evaluateBadges(userId: string) {
  const [
    badges,
    earnedBadges,
    profile,
    testCount,
    bestScore,
    completedWeeks,
    completedProgram,
    finalExamCompleted,
    exploredDomains,
  ] = await Promise.all([
    prisma.badge.findMany(),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    prisma.profile.findUniqueOrThrow({ where: { id: userId } }),
    prisma.testSession.count({ where: { userId, status: "COMPLETED" } }),
    prisma.testSession.aggregate({
      where: { userId, status: "COMPLETED" },
      _max: { globalScore: true },
    }),
    prisma.programWeek.findMany({
      where: { status: "completed", program: { userId } },
      select: { weekNumber: true },
    }),
    prisma.weeklyProgram.findFirst({ where: { userId, status: "COMPLETED" } }),
    prisma.testSession.findFirst({
      where: { userId, kind: "FINAL_EXAM", status: "COMPLETED" },
    }),
    prisma.userGoal.findMany({
      where: { userId },
      select: { domainId: true },
      distinct: ["domainId"],
    }),
  ]);

  const completedWeekNumbers = new Set(completedWeeks.map((w) => w.weekNumber));
  const earnedIds = new Set(earnedBadges.map((b) => b.badgeId));
  const newlyEarned: { id: string; name: string }[] = [];

  for (const badge of badges) {
    if (earnedIds.has(badge.id)) continue;

    const criteria = badge.criteriaJson as unknown as BadgeCriteria;
    let met = false;

    switch (criteria.type) {
      case "test_completed_count":
        met = testCount >= criteria.count;
        break;
      case "streak":
        met = profile.currentStreak >= criteria.days;
        break;
      case "test_score":
        met = (bestScore._max.globalScore ?? 0) >= criteria.minScore;
        break;
      case "program_week_completed":
        met = completedWeekNumbers.has(criteria.weekNumber);
        break;
      case "program_completed":
        met = Boolean(completedProgram);
        break;
      case "final_exam_completed":
        met = Boolean(finalExamCompleted);
        break;
      case "domains_explored":
        met = exploredDomains.length >= criteria.count;
        break;
    }

    if (met) {
      await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
      const freshProfile = await prisma.profile.findUniqueOrThrow({ where: { id: userId } });
      const unlockedTitles = badge.unlocksTitle && !freshProfile.unlockedTitles.includes(badge.unlocksTitle)
        ? [...freshProfile.unlockedTitles, badge.unlocksTitle]
        : freshProfile.unlockedTitles;
      await prisma.profile.update({
        where: { id: userId },
        data: { crystals: { increment: 1 }, unlockedTitles },
      });
      newlyEarned.push({ id: badge.id, name: badge.name });
    }
  }

  return newlyEarned;
}
