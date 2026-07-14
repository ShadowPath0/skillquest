import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  computeSkillTagCounts,
  nextDifficulty,
  selectNextQuestion,
} from "@/lib/adaptive/engine";
import { gradeOpenAnswer } from "@/lib/agents/evaluation-agent";
import { PLACEMENT_TEST_LENGTH } from "@/lib/test/constants";

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

  let isCorrect: boolean;
  let score: number;
  let explanationMd = question.explanationMd;
  let aiGradingJson: Prisma.InputJsonValue | undefined;

  const correctAnswer = String(question.correctAnswerJson);

  const isFreeTextType =
    question.type === "OPEN" ||
    question.type === "PRACTICAL" ||
    question.type === "CASE_STUDY" ||
    question.type === "SCENARIO";

  if (isFreeTextType) {
    try {
      const grading = await gradeOpenAnswer({
        promptMd: question.promptMd,
        referenceAnswer: correctAnswer,
        userAnswer,
      });
      isCorrect = grading.isCorrect;
      score = grading.score;
      explanationMd = grading.feedbackMd;
      aiGradingJson = grading;
    } catch {
      // No CLAUDE_API_URL/CLAUDE_API_TOKEN configured or the call failed: fall back to a
      // neutral score rather than blocking the test flow.
      isCorrect = false;
      score = 0.5;
      explanationMd =
        "Correction automatique indisponible pour le moment. Voici la réponse de référence : " +
        correctAnswer;
    }
  } else {
    isCorrect = userAnswer.trim() === correctAnswer.trim();
    score = isCorrect ? 1 : 0;
  }

  const answeredCount = await prisma.answer.count({
    where: { testSessionId: sessionId },
  });

  await prisma.answer.create({
    data: {
      testSessionId: sessionId,
      questionId,
      userAnswerJson: userAnswer,
      isCorrect,
      score,
      timeSpentSec,
      difficultyAtTime: session.currentDifficulty,
      sequenceIndex: answeredCount,
      aiGradingJson,
    },
  });

  const updatedDifficulty = nextDifficulty(
    session.currentDifficulty,
    isCorrect,
    timeSpentSec,
    question.estimatedTimeSec
  );

  await prisma.testSession.update({
    where: { id: sessionId },
    data: { currentDifficulty: updatedDifficulty },
  });

  const totalAnswered = answeredCount + 1;
  const reachedLength = totalAnswered >= PLACEMENT_TEST_LENGTH;

  if (reachedLength) {
    return NextResponse.json({
      isCorrect,
      explanationMd,
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

  const next = await selectNextQuestion({
    subdomainId: goal.subdomainId,
    difficulty: updatedDifficulty,
    excludeIds,
    skillTagCounts,
  });

  if (!next) {
    return NextResponse.json({
      isCorrect,
      explanationMd,
      progress: { answered: totalAnswered, total: PLACEMENT_TEST_LENGTH },
      isComplete: true,
      nextQuestion: null,
    });
  }

  return NextResponse.json({
    isCorrect,
    explanationMd,
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
