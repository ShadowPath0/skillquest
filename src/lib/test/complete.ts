import { prisma } from "@/lib/prisma";
import { generateAiReport } from "@/lib/agents/analysis-agent";
import { awardXp, touchStreak } from "@/lib/gamification/xp";
import { evaluateBadges } from "@/lib/gamification/badges";

const BASE_XP_BY_KIND: Record<string, number> = {
  PLACEMENT: 100,
  FINAL_EXAM: 200,
  PRACTICE: 50,
};

const PENDING_GRADING_MAX_WAIT_MS = 90_000;
const PENDING_GRADING_POLL_INTERVAL_MS = 2_000;

// Les réponses libres sont notées en tâche de fond pendant que l'utilisateur avance
// dans le test : au moment de générer le rapport final, on attend que ces corrections
// arrivent plutôt que de figer des scores neutres provisoires dans le rapport.
async function waitForPendingGradings(sessionId: string) {
  const start = Date.now();
  while (Date.now() - start < PENDING_GRADING_MAX_WAIT_MS) {
    const pendingCount = await prisma.answer.count({
      where: { testSessionId: sessionId, pendingGrading: true },
    });
    if (pendingCount === 0) return;
    await new Promise((resolve) => setTimeout(resolve, PENDING_GRADING_POLL_INTERVAL_MS));
  }
  // Sécurité : on arrête d'attendre plutôt que de bloquer indéfiniment si une
  // correction en fond ne se termine jamais (échec silencieux du after()).
  await prisma.answer.updateMany({
    where: { testSessionId: sessionId, pendingGrading: true },
    data: { pendingGrading: false },
  });
}

export async function completeTestSession(sessionId: string, userId: string) {
  const session = await prisma.testSession.findUniqueOrThrow({ where: { id: sessionId } });

  await waitForPendingGradings(sessionId);

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
