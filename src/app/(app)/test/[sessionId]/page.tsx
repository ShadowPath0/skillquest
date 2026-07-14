import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { computeSkillTagCounts, selectNextQuestion } from "@/lib/adaptive/engine";
import { PLACEMENT_TEST_LENGTH } from "@/lib/test/constants";
import { completeTestSession } from "@/lib/test/complete";
import { buildCelebrationParams } from "@/lib/gamification/celebration-params";
import { TestRunner } from "@/components/test/test-runner";

export default async function TestSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: { goal: true },
  });

  if (!session || session.userId !== user.id) {
    notFound();
  }

  if (session.status === "COMPLETED") {
    redirect(`/report/${session.id}`);
  }
  if (session.status !== "IN_PROGRESS") {
    redirect("/domains");
  }

  const existingAnswers = await prisma.answer.findMany({
    where: { testSessionId: sessionId },
    select: { questionId: true },
  });
  const excludeIds = existingAnswers.map((a) => a.questionId);
  const answeredCount = excludeIds.length;

  if (answeredCount >= PLACEMENT_TEST_LENGTH) {
    // Answers reached the target length but /complete was never called
    // (e.g. the browser closed right after the last answer). Finish it now.
    const result = await completeTestSession(sessionId, user.id);
    redirect(`/report/${sessionId}?${buildCelebrationParams(result)}`);
  }

  const skillTagCounts = await computeSkillTagCounts(sessionId);
  const question = await selectNextQuestion({
    subdomainId: session.goal.subdomainId,
    difficulty: session.currentDifficulty,
    excludeIds,
    skillTagCounts,
  });

  if (!question) {
    // Pool exhausted before reaching the target length: finish with what we have.
    const result = await completeTestSession(sessionId, user.id);
    redirect(`/report/${sessionId}?${buildCelebrationParams(result)}`);
  }

  return (
    <TestRunner
      sessionId={session.id}
      initialProgress={{ answered: answeredCount, total: PLACEMENT_TEST_LENGTH }}
      initialQuestion={{
        id: question.id,
        type: question.type,
        promptMd: question.promptMd,
        choices: question.choicesJson as string[] | null,
        estimatedTimeSec: question.estimatedTimeSec,
      }}
    />
  );
}
