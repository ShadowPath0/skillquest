import { prisma } from "@/lib/prisma";
import type { GenerationJobType } from "@prisma/client";

export async function enqueueJob(type: GenerationJobType, payload: object) {
  return prisma.generationJob.create({
    data: { type, payloadJson: payload },
  });
}

// Attend qu'une condition (déterminée par le job, ex. "la ligne attendue existe
// maintenant en base") se réalise, sans jamais dépasser maxWaitMs — le worker
// n'a pas cette contrainte, mais les pages/routes Vercel qui appellent ceci
// restent bornées par leur propre maxDuration.
export async function pollUntil<T>(
  check: () => Promise<T | null>,
  { maxWaitMs = 20_000, intervalMs = 2_000 }: { maxWaitMs?: number; intervalMs?: number } = {}
): Promise<T | null> {
  const start = Date.now();
  while (true) {
    const result = await check();
    if (result) return result;
    if (Date.now() - start >= maxWaitMs) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
