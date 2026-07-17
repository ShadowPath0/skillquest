// Worker à lancer en continu sur la machine qui héberge claude-api-vm (à côté de
// celui-ci, pas à sa place). Il traite les GenerationJob en file d'attente sans
// contrainte de durée (contrairement à Vercel, plafonné à 60s sur le plan gratuit),
// et écrit les résultats directement en base via Prisma. Lancer avec `npm run worker`.
import { prisma } from "../src/lib/prisma";
import { generateQuestionPool, gradeOpenAnswer } from "../src/lib/agents/evaluation-agent";
import { generateAiReport } from "../src/lib/agents/analysis-agent";
import { generateWeeklyProgram } from "../src/lib/agents/planner-agent";

const POLL_INTERVAL_MS = 3_000;

type QuestionPoolPayload = {
  domainId: string;
  subdomainId: string;
  domainName: string;
  subdomainName: string;
  goalTitle: string;
  count: number;
};

type GradeAnswerPayload = {
  answerId: string;
  promptMd: string;
  referenceAnswer: string;
  userAnswer: string;
};

type AiReportPayload = {
  testSessionId: string;
};

type WeeklyProgramPayload = {
  goalId: string;
  aiReportId: string;
};

async function processJob(job: {
  id: string;
  type: string;
  payloadJson: unknown;
}) {
  switch (job.type) {
    case "QUESTION_POOL": {
      const p = job.payloadJson as QuestionPoolPayload;
      await generateQuestionPool(p);
      break;
    }
    case "GRADE_ANSWER": {
      const p = job.payloadJson as GradeAnswerPayload;
      try {
        const grading = await gradeOpenAnswer({
          promptMd: p.promptMd,
          referenceAnswer: p.referenceAnswer,
          userAnswer: p.userAnswer,
        });
        await prisma.answer.update({
          where: { id: p.answerId },
          data: {
            isCorrect: grading.isCorrect,
            score: grading.score,
            aiGradingJson: grading,
            pendingGrading: false,
          },
        });
      } catch (err) {
        console.error("GRADE_ANSWER: correction échouée, score neutre conservé.", err);
        await prisma.answer.update({
          where: { id: p.answerId },
          data: { pendingGrading: false },
        });
      }
      break;
    }
    case "AI_REPORT": {
      const p = job.payloadJson as AiReportPayload;
      await generateAiReport(p.testSessionId);
      break;
    }
    case "WEEKLY_PROGRAM": {
      const p = job.payloadJson as WeeklyProgramPayload;
      await generateWeeklyProgram(p.goalId, p.aiReportId);
      break;
    }
    default:
      throw new Error(`Type de tâche inconnu: ${job.type}`);
  }
}

async function loop() {
  console.log("Worker SkillQuest démarré, en attente de tâches...");
  while (true) {
    // Une connexion Prisma inactive peut être fermée par le pooler Supabase entre
    // deux tâches (le worker est censé tourner 24/7 sans surveillance) : une erreur
    // ici ne doit jamais arrêter la boucle, juste faire réessayer au tour suivant.
    let job;
    try {
      job = await prisma.generationJob.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
    } catch (err) {
      console.error("Erreur en récupérant la prochaine tâche, nouvelle tentative bientôt.", err);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    try {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "PROCESSING" },
      });

      console.log(`Traitement de la tâche ${job.id} (${job.type})...`);
      const start = Date.now();

      await processJob(job);
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "DONE" },
      });
      console.log(`Tâche ${job.id} terminée en ${Math.round((Date.now() - start) / 1000)}s.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Tâche ${job.id} échouée:`, err);
      try {
        await prisma.generationJob.update({
          where: { id: job.id },
          data: { status: "FAILED", error: message },
        });
      } catch (updateErr) {
        console.error(`Impossible de marquer la tâche ${job.id} comme échouée.`, updateErr);
      }
    }
  }
}

// Filet de sécurité supplémentaire : si une erreur imprévue s'échappe malgré tout
// de loop() (plutôt que de couper le process, ce qui exigerait un redémarrage
// manuel), on relance la boucle après une courte pause.
async function main() {
  while (true) {
    try {
      await loop();
    } catch (err) {
      console.error("Erreur inattendue dans le worker, redémarrage dans 5s.", err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main();
