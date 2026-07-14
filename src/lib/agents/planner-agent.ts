import { z } from "zod";
import { generateStructured } from "./client";
import { prisma } from "@/lib/prisma";
import { generateResourcesForSkills } from "./generator-agent";

const DailyMissionSchema = z.object({
  dayNumber: z.number().int().min(1).max(5),
  title: z.string(),
  description: z.string(),
  xpReward: z.number().int().min(50).max(500),
  tasks: z.array(z.string()).min(2).max(6),
});

const WeekSchema = z.object({
  weekNumber: z.number().int().min(1).max(6),
  objectives: z.array(z.string()).min(2).max(5),
  skills: z.array(z.string()).min(1).max(5),
  estimatedHours: z.number().min(1).max(20),
  difficulty: z.number().min(1).max(5),
  missions: z.array(DailyMissionSchema).min(3).max(5),
});

const PlanSchema = z.object({
  weeks: z.array(WeekSchema).length(6),
});

type PlanWeek = z.infer<typeof WeekSchema>;

function buildFallbackPlan(weaknesses: string[], goalTitle: string): PlanWeek[] {
  const focusSkills = weaknesses.length > 0 ? weaknesses : ["Bases générales"];
  const weeks: PlanWeek[] = [];

  for (let w = 1; w <= 6; w++) {
    const focusSkill = focusSkills[(w - 1) % focusSkills.length];
    const missions = [];
    for (let d = 1; d <= 5; d++) {
      missions.push({
        dayNumber: d,
        title: `Pratique : ${focusSkill}`,
        description: `Renforce tes compétences en ${focusSkill} avec des exercices ciblés.`,
        xpReward: 100 + d * 10,
        tasks: [
          `Lire une ressource sur ${focusSkill}`,
          `Faire 5 exercices sur ${focusSkill}`,
          "Réviser les erreurs précédentes",
        ],
      });
    }
    weeks.push({
      weekNumber: w,
      objectives: [`Progresser en ${focusSkill}`, `Se rapprocher de l'objectif : ${goalTitle}`],
      skills: [focusSkill],
      estimatedHours: 5,
      difficulty: Math.min(5, 1 + w * 0.5),
      missions,
    });
  }

  return weeks;
}

export async function generateWeeklyProgram(goalId: string, aiReportId: string) {
  const [goal, report] = await Promise.all([
    prisma.userGoal.findUniqueOrThrow({
      where: { id: goalId },
      include: { domain: true, subdomain: true, goalTemplate: true },
    }),
    prisma.aiReport.findUniqueOrThrow({ where: { id: aiReportId } }),
  ]);

  const goalTitle = goal.goalTemplate?.title ?? goal.customTitle ?? "Progresser";
  const weaknesses = report.weaknessesJson as string[];

  let weeks = buildFallbackPlan(weaknesses, goalTitle);

  try {
    const parsed = await generateStructured({
      schema: PlanSchema,
      toolName: "weekly_program",
      system:
        "Tu es l'agent Planificateur de SkillQuest. Tu construis un programme de 6 semaines, concret et progressif, pour aider un utilisateur à progresser vers son objectif. Réponds uniquement en français.",
      user: `Objectif : "${goalTitle}" (${goal.domain.name} / ${goal.subdomain.name}).
Niveau actuel : ${report.level} (score ${report.globalScore}/100).
Points faibles à travailler en priorité : ${weaknesses.join(", ")}.

Génère un programme de 6 semaines (weeks), chacune avec : 2 à 5 objectifs (objectives), 1 à 5 compétences travaillées (skills), un volume horaire estimé (estimatedHours, en heures), une difficulté (difficulty, 1 à 5), et 3 à 5 missions journalières (missions) avec un titre, une description courte, une récompense en XP (xpReward, 50 à 500) et 2 à 6 tâches concrètes (tasks). La difficulté doit progresser globalement sur les 6 semaines, en priorisant d'abord les points faibles identifiés.`,
      maxTokens: 8192,
    });

    weeks = parsed.weeks;
  } catch {
    // No CLAUDE_API_URL/CLAUDE_API_TOKEN configured or the call failed: keep the fallback plan.
  }

  const program = await prisma.weeklyProgram.create({
    data: {
      userId: goal.userId,
      goalId: goal.id,
      basedOnReportId: aiReportId,
      weeks: {
        create: weeks.map((week) => ({
          weekNumber: week.weekNumber,
          objectivesJson: week.objectives,
          skillsJson: week.skills,
          estimatedHours: week.estimatedHours,
          difficulty: week.difficulty,
          missions: {
            create: week.missions.map((mission) => ({
              dayNumber: mission.dayNumber,
              title: mission.title,
              description: mission.description,
              xpReward: mission.xpReward,
              tasksJson: mission.tasks,
            })),
          },
        })),
      },
    },
  });

  const allSkills = weeks.flatMap((week) => week.skills);
  await generateResourcesForSkills(goal.domainId, goal.domain.name, allSkills);

  return program;
}
