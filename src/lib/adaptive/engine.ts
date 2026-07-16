import { prisma } from "@/lib/prisma";
import type { Question } from "@prisma/client";

// Pas de sélection adaptative : c'est un test d'évaluation qui pose les 50 questions
// générées, dans l'ordre où elles ont été générées — pas un test qui ajuste la
// difficulté question par question.
export async function selectNextQuestion({
  subdomainId,
  excludeIds,
}: {
  subdomainId: string;
  excludeIds: string[];
}): Promise<Question | null> {
  return prisma.question.findFirst({
    where: {
      subdomainId,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

// Le pool est généré par un worker qui tourne sans contrainte de temps (voir
// scripts/worker.ts) : on patiente un peu avant de conclure qu'il n'y a plus de
// questions, plutôt que de terminer le test prématurément.
export async function waitForAvailableQuestion({
  subdomainId,
  excludeIds,
  maxWaitMs = 20_000,
}: {
  subdomainId: string;
  excludeIds: string[];
  maxWaitMs?: number;
}): Promise<Question | null> {
  const start = Date.now();
  while (true) {
    const next = await selectNextQuestion({ subdomainId, excludeIds });
    if (next) return next;
    if (Date.now() - start >= maxWaitMs) return null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
