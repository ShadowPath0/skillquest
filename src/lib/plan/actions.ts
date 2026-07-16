"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/jobs/queue";
import { awardXp, touchStreak } from "@/lib/gamification/xp";
import { evaluateBadges } from "@/lib/gamification/badges";
import { buildCelebrationParams } from "@/lib/gamification/celebration-params";

export async function generateProgram(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const report = await prisma.aiReport.findUnique({
    where: { id: reportId },
    include: { testSession: true },
  });

  if (!report || report.userId !== user.id) {
    redirect("/domains");
  }

  const existing = await prisma.weeklyProgram.findFirst({
    where: { basedOnReportId: reportId },
  });

  if (existing) {
    redirect(`/plan/${existing.id}`);
  }

  // Le programme est construit par le worker (voir scripts/worker.ts), sans la
  // contrainte de durée d'une fonction Vercel : on empile la tâche et on redirige
  // vers une page d'attente qui se met à jour toute seule jusqu'à ce qu'il soit prêt.
  const alreadyQueued = await prisma.generationJob.findFirst({
    where: {
      type: "WEEKLY_PROGRAM",
      status: { in: ["PENDING", "PROCESSING"] },
      payloadJson: { path: ["aiReportId"], equals: reportId },
    },
  });
  if (!alreadyQueued) {
    await enqueueJob("WEEKLY_PROGRAM", {
      goalId: report.testSession.goalId,
      aiReportId: report.id,
    });
  }

  redirect(`/plan/pending/${reportId}`);
}

export async function completeMission(formData: FormData) {
  const missionId = String(formData.get("missionId") ?? "");
  const programId = String(formData.get("programId") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const mission = await prisma.dailyMission.findUnique({
    where: { id: missionId },
    include: { programWeek: { include: { program: true } } },
  });

  if (!mission || mission.programWeek.program.userId !== user.id) {
    redirect(`/plan/${programId}`);
  }

  if (mission.status !== "completed") {
    await prisma.dailyMission.update({
      where: { id: missionId },
      data: { status: "completed", completedAt: new Date() },
    });

    const { leveledUp } = await awardXp(
      user.id,
      mission.xpReward,
      mission.title,
      "daily_mission",
      mission.id
    );
    await touchStreak(user.id);

    const weekMissions = await prisma.dailyMission.findMany({
      where: { programWeekId: mission.programWeekId },
    });
    const doneCount = weekMissions.filter((m) => m.status === "completed").length;
    const progressPct = Math.round((doneCount / weekMissions.length) * 100);
    const weekCompleted = progressPct === 100;

    await prisma.programWeek.update({
      where: { id: mission.programWeekId },
      data: {
        progressPct,
        status: weekCompleted ? "completed" : "in_progress",
      },
    });

    if (weekCompleted) {
      const allWeeks = await prisma.programWeek.findMany({
        where: { programId: mission.programWeek.programId },
      });
      if (allWeeks.every((w) => w.id === mission.programWeekId || w.status === "completed")) {
        await prisma.weeklyProgram.update({
          where: { id: mission.programWeek.programId },
          data: { status: "COMPLETED" },
        });
      }
    }

    const newBadges = await evaluateBadges(user.id);
    const query = buildCelebrationParams({ xpEarned: mission.xpReward, leveledUp, newBadges });
    redirect(`/plan/${programId}?${query}`);
  }

  redirect(`/plan/${programId}`);
}
