import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  computeSkillTagCounts,
  nextDifficulty,
  waitForAvailableQuestion,
} from "@/lib/adaptive/engine";
import { gradeOpenAnswer } from "@/lib/agents/evaluation-agent";
import { PLACEMENT_TEST_LENGTH } from "@/lib/test/constants";

async function gradeInBackground(
  answerId: string,
  promptMd: string,
  referenceAnswer: string,
  userAnswer: string
) {
  try {
    const grading = await gradeOpenAnswer({ promptMd, referenceAnswer, userAnswer });
    await prisma.answer.update({
      where: { id: answerId },
      data: {
        isCorrect: grading.isCorrect,
        score: grading.score,
        aiGradingJson: grading,
        pendingGrading: false,
      },
    });
  } catch (err) {
    console.error("gradeInBackground: correction différée échouée, score neutre conservé.", err);
    await prisma.answer.update({
      where: { id: answerId },
      data: { pendingGrading: false },
    });
  }
}

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
  // en tâche de fond. La difficulté reste stable ce tour-ci plutôt que de deviner.
  let isCorrect: boolean;
  let score: number;
  let updatedDifficulty: number;
  const pendingGrading = isFreeTextType;

  if (isFreeTextType) {
    isCorrect = false;
    score = 0.5;
    updatedDifficulty = session.currentDifficulty;
  } else {
    isCorrect = userAnswer.trim() === correctAnswer.trim();
    score = isCorrect ? 1 : 0;
    updatedDifficulty = nextDifficulty(
      session.currentDifficulty,
      isCorrect,
      timeSpentSec,
      question.estimatedTimeSec
    );
  }

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
      difficultyAtTime: session.currentDifficulty,
      sequenceIndex: answeredCount,
      pendingGrading,
    },
  });

  if (isFreeTextType) {
    after(() => gradeInBackground(answer.id, question.promptMd, correctAnswer, userAnswer));
  }

  await prisma.testSession.update({
    where: { id: sessionId },
    data: { currentDifficulty: updatedDifficulty },
  });

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
  const skillTagCounts = await computeSkillTagCounts(sessionId);

  const next = await waitForAvailableQuestion({
    subdomainId: goal.subdomainId,
    difficulty: updatedDifficulty,
    excludeIds,
    skillTagCounts,
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
