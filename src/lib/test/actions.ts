"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/jobs/queue";

// Les questions sont générées par un worker qui tourne en continu sur la machine de
// l'utilisateur (scripts/worker.ts), pas par la fonction Vercel elle-même : le
// tunnel gratuit prend souvent 90-200s par lot, largement au-delà de la durée max
// d'une fonction Vercel (60s). On empile juste les lots en file d'attente et on
// redirige tout de suite ; la page de test attend que les questions arrivent.
const BATCH_SIZE = 9;
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
  if (existingQuestions > 0) return;

  const alreadyQueued = await prisma.generationJob.findFirst({
    where: {
      type: "QUESTION_POOL",
      status: { in: ["PENDING", "PROCESSING"] },
      payloadJson: { path: ["subdomainId"], equals: subdomainId },
    },
  });
  if (alreadyQueued) return;

  const batchCount = Math.ceil(FULL_POOL_COUNT / BATCH_SIZE);
  for (let i = 0; i < batchCount; i++) {
    await enqueueJob("QUESTION_POOL", {
      domainId,
      subdomainId,
      domainName,
      subdomainName,
      goalTitle,
      count: BATCH_SIZE,
    });
  }
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

  await ensureQuestionPool({
    domainId: goal.domainId,
    subdomainId: goal.subdomainId,
    domainName: goal.domain.name,
    subdomainName: goal.subdomain.name,
    goalTitle: goal.goalTemplate?.title ?? goal.customTitle ?? goal.subdomain.name,
  });

  const session = await prisma.testSession.create({
    data: {
      userId: user.id,
      domainId: goal.domainId,
      goalId: goal.id,
      kind: "PLACEMENT",
    },
  });

  redirect(`/test/${session.id}`);
}

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
    },
  });

  redirect(`/test/${session.id}`);
}
