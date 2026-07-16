import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/jobs/queue";
import { awardXp, touchStreak } from "@/lib/gamification/xp";
import { evaluateBadges } from "@/lib/gamification/badges";

const BASE_XP_BY_KIND: Record<string, number> = {
  PLACEMENT: 100,
  FINAL_EXAM: 200,
  PRACTICE: 50,
};

// Bornés bien en dessous de la durée max d'une fonction Vercel (60s) : la correction
// des réponses libres et la génération du rapport tournent sur le worker local, sans
// cette contrainte, donc on n'attend ici qu'un court instant avant de laisser la page
// de rapport prendre le relais (elle patiente à son tour, côté client).
const PENDING_GRADING_MAX_WAIT_MS = 20_000;
const PENDING_GRADING_POLL_INTERVAL_MS = 2_000;

// Les réponses libres sont notées par des GRADE_ANSWER en file d'attente, traités par
// le worker dans l'ordre de création — donc avant la tâche AI_REPORT créée juste après
// ici. On patiente un court instant (best-effort, borné très en dessous des 60s de
// Vercel) pour que les corrections déjà en cours aient une chance d'arriver avant de
// figer le score global ; celles qui n'ont pas fini restent en file, pas perdues.
async function waitForPendingGradings(sessionId: string) {
  const start = Date.now();
  while (Date.now() - start < PENDING_GRADING_MAX_WAIT_MS) {
    const pendingCount = await prisma.answer.count({
      where: { testSessionId: sessionId, pendingGrading: true },
    });
    if (pendingCount === 0) return;
    await new Promise((resolve) => setTimeout(resolve, PENDING_GRADING_POLL_INTERVAL_MS));
  }
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

  await enqueueJob("AI_REPORT", { testSessionId: sessionId });

  const baseXp = BASE_XP_BY_KIND[session.kind] ?? BASE_XP_BY_KIND.PLACEMENT;
  const reason =
    session.kind === "FINAL_EXAM" ? "Examen final terminé" : "Test de placement terminé";
  const xpEarned = baseXp + Math.round(globalScore);
  const { leveledUp } = await awardXp(userId, xpEarned, reason, "test_session", sessionId);
  await touchStreak(userId);
  const newBadges = await evaluateBadges(userId);

  return { xpEarned, leveledUp, newBadges };
}
