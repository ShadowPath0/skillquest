import { z } from "zod";
import { generateStructured } from "./client";
import { prisma } from "@/lib/prisma";
import type { SkillLevel } from "@prisma/client";

function levelFromScore(score: number): SkillLevel {
  if (score >= 85) return "EXPERT";
  if (score >= 65) return "ADVANCED";
  if (score >= 40) return "INTERMEDIATE";
  return "BEGINNER";
}

const LEVEL_LABELS_FR: Record<SkillLevel, string> = {
  BEGINNER: "débutant",
  INTERMEDIATE: "intermédiaire",
  ADVANCED: "avancé",
  EXPERT: "expert",
};

const AnalysisResult = z.object({
  strengths: z.array(z.string()).min(1).max(5),
  weaknesses: z.array(z.string()).min(1).max(5),
  explanationMd: z.string(),
});

export async function generateAiReport(testSessionId: string) {
  const session = await prisma.testSession.findUniqueOrThrow({
    where: { id: testSessionId },
    include: {
      answers: { include: { question: true }, orderBy: { sequenceIndex: "asc" } },
      goal: { include: { domain: true, subdomain: true, goalTemplate: true } },
    },
  });

  const answers = session.answers;
  const globalScore =
    answers.length > 0
      ? Math.round((answers.reduce((sum, a) => sum + a.score, 0) / answers.length) * 100)
      : 0;
  const level = levelFromScore(globalScore);

  const skillTotals: Record<string, { sum: number; count: number }> = {};
  for (const answer of answers) {
    for (const tag of answer.question.skillTags) {
      skillTotals[tag] ??= { sum: 0, count: 0 };
      skillTotals[tag].sum += answer.score;
      skillTotals[tag].count += 1;
    }
  }
  const radar = Object.fromEntries(
    Object.entries(skillTotals).map(([tag, { sum, count }]) => [
      tag,
      Math.round((sum / count) * 100),
    ])
  );

  const sortedSkills = Object.entries(radar).sort((a, b) => b[1] - a[1]);
  const fallbackStrengths = sortedSkills.slice(0, 2).map(([tag]) => tag);
  const fallbackWeaknesses = sortedSkills.slice(-2).map(([tag]) => tag);

  let strengths = fallbackStrengths.length ? fallbackStrengths : ["Bases générales"];
  let weaknesses = fallbackWeaknesses.length ? fallbackWeaknesses : ["À approfondir"];
  let explanationMd = `Score global de ${globalScore}/100, niveau ${LEVEL_LABELS_FR[level]}. Continue à t'exercer sur les compétences les moins maîtrisées.`;

  try {
    const missedQuestions = answers
      .filter((a) => !a.isCorrect)
      .slice(0, 8)
      .map((a) => `- ${a.question.promptMd} (tags: ${a.question.skillTags.join(", ")})`)
      .join("\n");

    const parsed = await generateStructured({
      schema: AnalysisResult,
      toolName: "analysis_result",
      system:
        "Tu es l'agent Analyse de SkillQuest. Tu analyses les résultats d'un test de niveau et rédiges un retour bienveillant, précis et actionnable. Réponds uniquement en français.",
      user: `Objectif de l'utilisateur : "${session.goal.goalTemplate?.title ?? session.goal.customTitle}" (${session.goal.domain.name} / ${session.goal.subdomain.name}).
Score global : ${globalScore}/100 (niveau ${level}).
Scores par compétence : ${JSON.stringify(radar)}.
Questions ratées :
${missedQuestions || "Aucune"}

Génère : 2 à 5 points forts (strengths), 2 à 5 points faibles concrets (weaknesses), et une explication (explanationMd, 3-5 phrases) qui explique le niveau atteint, pourquoi certaines réponses étaient incorrectes en termes généraux, et quels concepts revoir en priorité.`,
    });

    strengths = parsed.strengths;
    weaknesses = parsed.weaknesses;
    explanationMd = parsed.explanationMd;
  } catch {
    // No CLAUDE_API_URL/CLAUDE_API_TOKEN configured or the call failed: keep the
    // heuristic strengths/weaknesses/explanation computed above.
  }

  const report = await prisma.aiReport.upsert({
    where: { testSessionId },
    update: {
      globalScore,
      level,
      radarJson: radar,
      strengthsJson: strengths,
      weaknessesJson: weaknesses,
      explanationMd,
    },
    create: {
      testSessionId,
      userId: session.userId,
      globalScore,
      level,
      radarJson: radar,
      strengthsJson: strengths,
      weaknessesJson: weaknesses,
      explanationMd,
    },
  });

  for (const [skillName, score] of Object.entries(radar)) {
    await prisma.skillCompetency.upsert({
      where: {
        userId_domainId_skillName: {
          userId: session.userId,
          domainId: session.domainId,
          skillName,
        },
      },
      update: { score },
      create: {
        userId: session.userId,
        domainId: session.domainId,
        skillName,
        score,
      },
    });
  }

  return report;
}
