"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_DIFFICULTY } from "@/lib/adaptive/engine";
import { generateQuestionPool } from "@/lib/agents/evaluation-agent";

// On génère un petit lot rapide en bloquant, puis le reste du pool en arrière-plan
// après la redirection, pour ne pas faire attendre l'utilisateur avant la première
// question. Des lots modérés (pas un seul énorme pool d'un coup) réduisent aussi le
// risque qu'une requête individuelle traîne trop longtemps sur le tunnel gratuit.
const FAST_BATCH_COUNT = 8;
const BACKGROUND_BATCH_COUNT = 10;
const FULL_POOL_COUNT = 54;

async function ensureQuestionPool({
  domainId,
  subdomainId,
  domainName,
  subdomainName,
  goalTitle,
}: {
  domainId: string;
  subdomainId: string;
  domainName: string;
  subdomainName: string;
  goalTitle: string;
}) {
  const existingQuestions = await prisma.question.count({ where: { subdomainId } });
  if (existingQuestions > 0) return true;

  await generateQuestionPool({
    domainId,
    subdomainId,
    domainName,
    subdomainName,
    goalTitle,
    count: FAST_BATCH_COUNT,
  });

  const generatedCount = await prisma.question.count({ where: { subdomainId } });
  if (generatedCount === 0) return false;

  const remainingBatches = Math.ceil((FULL_POOL_COUNT - FAST_BATCH_COUNT) / BACKGROUND_BATCH_COUNT);

  after(async () => {
    for (let i = 0; i < remainingBatches; i++) {
      try {
        await generateQuestionPool({
          domainId,
          subdomainId,
          domainName,
          subdomainName,
          goalTitle,
          count: BACKGROUND_BATCH_COUNT,
        });
      } catch (err) {
        console.error("ensureQuestionPool: lot d'arrière-plan échoué, on continue avec les suivants.", err);
      }
    }
  });

  return true;
}

export async function startTest(formData: FormData) {
  const goalId = String(formData.get("goalId") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const goal = await prisma.userGoal.findUnique({
    where: { id: goalId },
    include: { domain: true, subdomain: true, goalTemplate: true },
  });

  if (!goal || goal.userId !== user.id) {
    redirect("/domains");
  }

  const ready = await ensureQuestionPool({
    domainId: goal.domainId,
    subdomainId: goal.subdomainId,
    domainName: goal.domain.name,
    subdomainName: goal.subdomain.name,
    goalTitle: goal.goalTemplate?.title ?? goal.customTitle ?? goal.subdomain.name,
  });

  if (!ready) {
    redirect(
      `/domains?error=${encodeURIComponent(
        "Impossible de préparer l'épreuve pour cette quête. Réessaie."
      )}`
    );
  }

  const session = await prisma.testSession.create({
    data: {
      userId: user.id,
      domainId: goal.domainId,
      goalId: goal.id,
      kind: "PLACEMENT",
      currentDifficulty: DEFAULT_DIFFICULTY,
    },
  });

  redirect(`/test/${session.id}`);
}

const SKILL_LEVEL_START_DIFFICULTY: Record<string, number> = {
  BEGINNER: 1.5,
  INTERMEDIATE: 2.5,
  ADVANCED: 3.5,
  EXPERT: 4.5,
};

export async function startFinalExam(formData: FormData) {
  const programId = String(formData.get("programId") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const program = await prisma.weeklyProgram.findUnique({
    where: { id: programId },
    include: {
      goal: { include: { domain: true, subdomain: true, goalTemplate: true } },
    },
  });

  if (!program || program.userId !== user.id) {
    redirect("/domains");
  }

  const latestReport = await prisma.aiReport.findFirst({
    where: { userId: user.id, testSession: { goalId: program.goalId } },
    orderBy: { createdAt: "desc" },
  });
  const startDifficulty = latestReport
    ? (SKILL_LEVEL_START_DIFFICULTY[latestReport.level] ?? DEFAULT_DIFFICULTY)
    : DEFAULT_DIFFICULTY;

  await ensureQuestionPool({
    domainId: program.goal.domainId,
    subdomainId: program.goal.subdomainId,
    domainName: program.goal.domain.name,
    subdomainName: program.goal.subdomain.name,
    goalTitle:
      program.goal.goalTemplate?.title ?? program.goal.customTitle ?? program.goal.subdomain.name,
  });

  const session = await prisma.testSession.create({
    data: {
      userId: user.id,
      domainId: program.goal.domainId,
      goalId: program.goalId,
      kind: "FINAL_EXAM",
      currentDifficulty: startDifficulty,
    },
  });

  redirect(`/test/${session.id}`);
}
