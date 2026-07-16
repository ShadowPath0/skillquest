import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { waitForAvailableQuestion } from "@/lib/adaptive/engine";
import { enqueueJob } from "@/lib/jobs/queue";
import { PLACEMENT_TEST_LENGTH } from "@/lib/test/constants";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (session.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "session_closed" }, { status: 409 });
  }

  const body = await request.json();
  const questionId = String(body.questionId ?? "");
  const userAnswer = String(body.userAnswer ?? "");
  const timeSpentSec = Math.max(1, Number(body.timeSpentSec) || 1);

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  const alreadyAnswered = await prisma.answer.findFirst({
    where: { testSessionId: sessionId, questionId },
  });
  if (alreadyAnswered) {
    return NextResponse.json({ error: "already_answered" }, { status: 409 });
  }

  const correctAnswer = String(question.correctAnswerJson);
  const isFreeTextType =
    question.type === "OPEN" ||
    question.type === "PRACTICAL" ||
    question.type === "CASE_STUDY" ||
    question.type === "SCENARIO";

  // Les réponses libres notées par IA ne bloquent plus le passage à la question
  // suivante : elles partent avec un score neutre et une note "en attente", corrigées
  // en tâche de fond.
  const pendingGrading = isFreeTextType;
  const isCorrect = isFreeTextType ? false : userAnswer.trim() === correctAnswer.trim();
  const score = isFreeTextType ? 0.5 : isCorrect ? 1 : 0;

  const answeredCount = await prisma.answer.count({
    where: { testSessionId: sessionId },
  });

  const answer = await prisma.answer.create({
    data: {
      testSessionId: sessionId,
      questionId,
      userAnswerJson: userAnswer,
      isCorrect,
      score,
      timeSpentSec,
      difficultyAtTime: question.difficulty,
      sequenceIndex: answeredCount,
      pendingGrading,
    },
  });

  if (isFreeTextType) {
    await enqueueJob("GRADE_ANSWER", {
      answerId: answer.id,
      promptMd: question.promptMd,
      referenceAnswer: correctAnswer,
      userAnswer,
    });
  }

  const totalAnswered = answeredCount + 1;
  const reachedLength = totalAnswered >= PLACEMENT_TEST_LENGTH;

  if (reachedLength) {
    return NextResponse.json({
      progress: { answered: totalAnswered, total: PLACEMENT_TEST_LENGTH },
      isComplete: true,
      nextQuestion: null,
    });
  }

  const goal = await prisma.userGoal.findUniqueOrThrow({ where: { id: session.goalId } });
  const excludeIds = (
    await prisma.answer.findMany({
      where: { testSessionId: sessionId },
      select: { questionId: true },
    })
  ).map((a) => a.questionId);

  const next = await waitForAvailableQuestion({
    subdomainId: goal.subdomainId,
    excludeIds,
    maxWaitMs: 50_000,
  });

  if (!next) {
    return NextResponse.json({
      progress: { answered: totalAnswered, total: PLACEMENT_TEST_LENGTH },
      isComplete: true,
      nextQuestion: null,
    });
  }

  return NextResponse.json({
    progress: { answered: totalAnswered, total: PLACEMENT_TEST_LENGTH },
    isComplete: false,
    nextQuestion: {
      id: next.id,
      type: next.type,
      promptMd: next.promptMd,
      choices: next.choicesJson,
      estimatedTimeSec: next.estimatedTimeSec,
    },
  });
}
