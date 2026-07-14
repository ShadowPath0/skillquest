import { z } from "zod";
import { generateStructured } from "./client";
import { prisma } from "@/lib/prisma";
import { generateResourcesForSkills } from "./generator-agent";
import type { AnalysisWeakness } from "./analysis-agent";

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

function buildFallbackPlan(weaknessTitles: string[], goalTitle: string): PlanWeek[] {
  const focusSkills = weaknessTitles.length > 0 ? weaknessTitles : ["Bases générales"];
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
  const weaknesses = report.weaknessesJson as AnalysisWeakness[];

  let weeks = buildFallbackPlan(
    weaknesses.map((w) => w.title),
    goalTitle
  );

  try {
    const priorityRank: Record<AnalysisWeakness["priority"], number> = {
      critique: 0,
      important: 1,
      mineur: 2,
    };
    const weaknessesDetail = [...weaknesses]
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
      .map(
        (w) =>
          `- [${w.priority}] ${w.title} : ${w.explanation} Bonne approche attendue : ${w.correctApproach}`
      )
      .join("\n");

    const parsed = await generateStructured({
      schema: PlanSchema,
      toolName: "weekly_program",
      system:
        "Tu es l'agent Planificateur de SkillQuest, un formateur senior qui construit un programme de 6 semaines concret et progressif pour combler des lacunes précises identifiées lors d'un diagnostic. Réponds uniquement en français.",
      user: `Objectif : "${goalTitle}" (${goal.domain.name} / ${goal.subdomain.name}).
Niveau actuel : ${report.level} (score ${report.globalScore}/100).

Points faibles identifiés, par priorité décroissante :
${weaknessesDetail || "Aucun point faible précis identifié."}

Construis un programme de 6 semaines (weeks) qui suit cet arc :
- Semaines 1-2 : consolidation, en traitant en priorité les points faibles marqués "critique" puis "important".
- Semaines 3-5 : approfondissement et spécialisation sur les points faibles restants et les compétences avancées de l'objectif.
- Semaine 6 : synthèse et mise en situation complexe qui mobilise plusieurs compétences travaillées (équivalent d'un entretien technique ou d'un cas de synthèse), pas de nouvelle notion.

Pour chaque semaine : 2 à 5 objectifs (objectives), 1 à 5 compétences travaillées (skills), un volume horaire estimé (estimatedHours), une difficulté (difficulty, 1 à 5, progressant globalement sur les 6 semaines), et 3 à 5 missions journalières (missions) avec un titre, une description, une récompense en XP (xpReward, 50 à 500) et 2 à 6 tâches concrètes (tasks).

Contrainte importante : chaque semaine doit inclure au moins une mission qui est un exercice pratique substantiel (un cas concret à traiter, pas de la lecture passive), directement lié à un des points faibles listés ci-dessus plutôt qu'une répétition générique. Dans "description" de cette mission, précise explicitement que le résultat est à soumettre au Coach IA pour correction détaillée.`,
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
