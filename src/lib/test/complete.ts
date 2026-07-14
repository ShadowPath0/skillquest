import { prisma } from "@/lib/prisma";
import { generateAiReport } from "@/lib/agents/analysis-agent";
import { awardXp, touchStreak } from "@/lib/gamification/xp";
import { evaluateBadges } from "@/lib/gamification/badges";

const BASE_XP_BY_KIND: Record<string, number> = {
  PLACEMENT: 100,
  FINAL_EXAM: 200,
  PRACTICE: 50,
};

export async function completeTestSession(sessionId: string, userId: string) {
  const session = await prisma.testSession.findUniqueOrThrow({ where: { id: sessionId } });

  const answers = await prisma.answer.findMany({ where: { testSessionId: sessionId } });
  const globalScore =
    answers.length > 0
      ? Math.round((answers.reduce((sum, a) => sum + a.score, 0) / answers.length) * 100)
      : 0;

  await prisma.testSession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED", completedAt: new Date(), globalScore },
  });

  await generateAiReport(sessionId);

  const baseXp = BASE_XP_BY_KIND[session.kind] ?? BASE_XP_BY_KIND.PLACEMENT;
  const reason =
    session.kind === "FINAL_EXAM" ? "Examen final terminé" : "Test de placement terminé";
  const xpEarned = baseXp + Math.round(globalScore);
  const { leveledUp } = await awardXp(userId, xpEarned, reason, "test_session", sessionId);
  await touchStreak(userId);
  const newBadges = await evaluateBadges(userId);

  return { xpEarned, leveledUp, newBadges };
}
