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

const PriorityLevel = z.enum(["critique", "important", "mineur"]);

const StrengthItem = z.object({
  title: z.string(),
  explanation: z.string(),
});

const WeaknessItem = z.object({
  title: z.string(),
  priority: PriorityLevel,
  explanation: z.string(),
  correctApproach: z.string(),
  relatedSkillTags: z.array(z.string()).max(3),
});

const AnalysisResult = z.object({
  strengths: z.array(StrengthItem).min(1).max(5),
  weaknesses: z.array(WeaknessItem).min(1).max(6),
  explanationMd: z.string(),
});

export type AnalysisStrength = z.infer<typeof StrengthItem>;
export type AnalysisWeakness = z.infer<typeof WeaknessItem>;

function stringifyAnswer(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

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
  const fallbackStrengthTags = sortedSkills.slice(0, 2).map(([tag]) => tag);
  const fallbackWeaknessTags = sortedSkills.slice(-2).map(([tag]) => tag);

  let strengths: AnalysisStrength[] = (
    fallbackStrengthTags.length ? fallbackStrengthTags : ["Bases générales"]
  ).map((tag) => ({
    title: tag,
    explanation: `Bon score sur les questions liées à "${tag}".`,
  }));
  let weaknesses: AnalysisWeakness[] = (
    fallbackWeaknessTags.length ? fallbackWeaknessTags : ["À approfondir"]
  ).map((tag) => ({
    title: tag,
    priority: "important" as const,
    explanation: `Score plus faible sur les questions liées à "${tag}".`,
    correctApproach: `Revoir les notions de base autour de "${tag}" et s'exercer davantage.`,
    relatedSkillTags: [tag],
  }));
  let explanationMd = `Score global de ${globalScore}/100, niveau ${LEVEL_LABELS_FR[level]}. Continue à t'exercer sur les compétences les moins maîtrisées.`;

  try {
    const missedDetails = answers
      .filter((a) => !a.isCorrect)
      .slice(0, 12)
      .map((a) => {
        const grading = a.aiGradingJson as { feedbackMd?: string } | null;
        const lines = [
          `- Question : ${a.question.promptMd}`,
          `  Réponse donnée par l'utilisateur : ${stringifyAnswer(a.userAnswerJson)}`,
          `  Réponse attendue / référence : ${stringifyAnswer(a.question.correctAnswerJson)}`,
        ];
        if (grading?.feedbackMd) {
          lines.push(`  Correction déjà donnée lors du test : ${grading.feedbackMd}`);
        }
        lines.push(`  Compétences liées : ${a.question.skillTags.join(", ")}`);
        return lines.join("\n");
      })
      .join("\n\n");

    const correctHighlights = answers
      .filter((a) => a.isCorrect)
      .slice(0, 8)
      .map((a) => `- ${a.question.promptMd} (tags: ${a.question.skillTags.join(", ")})`)
      .join("\n");

    const parsed = await generateStructured({
      schema: AnalysisResult,
      toolName: "analysis_result",
      system:
        "Tu es l'agent Analyse de SkillQuest, un expert du domaine testé qui corrige comme un formateur senior : précis, direct, et concentré sur les enjeux réels plutôt que sur des généralités. Pour chaque point faible, tu identifies l'erreur exacte à partir de la vraie réponse donnée, tu expliques pourquoi elle compte concrètement dans la pratique du métier (pas juste \"c'est faux\"), et tu donnes la bonne approche avec son raisonnement, comme dans une vraie correction d'examen professionnel. Réponds uniquement en français.",
      user: `Objectif de l'utilisateur : "${session.goal.goalTemplate?.title ?? session.goal.customTitle}" (${session.goal.domain.name} / ${session.goal.subdomain.name}).
Score global : ${globalScore}/100 (niveau ${level}).
Scores par compétence : ${JSON.stringify(radar)}.

Réponses incorrectes ou incomplètes (réponse donnée vs réponse attendue) :
${missedDetails || "Aucune erreur notable."}

Réponses correctes notables :
${correctHighlights || "Aucune."}

Consignes :
- "weaknesses" (2 à 6 points) : des erreurs PRÉCISES basées sur les vraies réponses ci-dessus, pas des thèmes vagues du type "à améliorer en X". Pour chaque point : "title" (nom court et précis du problème), "priority" ("critique" si l'erreur a un vrai enjeu pratique, réglementaire ou de sécurité dans ce métier, "important" si c'est un concept clé mal maîtrisé, "mineur" sinon), "explanation" (pourquoi c'est une erreur ET pourquoi ça compte concrètement en situation réelle), "correctApproach" (la bonne réponse ou pratique, expliquée avec son raisonnement — pas juste énoncée), "relatedSkillTags".
- Trie "weaknesses" par priorité décroissante : les points "critique" en premier.
- "strengths" (1 à 5 points) : ce qui est vraiment maîtrisé, avec une brève explication de ce qui le prouve dans les réponses.
- "explanationMd" (3 à 5 phrases) : synthèse directe du niveau atteint et de la priorité n°1 à traiter en premier.`,
      maxTokens: 6144,
    });

    strengths = parsed.strengths;
    weaknesses = parsed.weaknesses;
    explanationMd = parsed.explanationMd;
  } catch (err) {
    // No CLAUDE_API_URL/CLAUDE_API_TOKEN configured or the call failed: keep the
    // heuristic strengths/weaknesses/explanation computed above.
    console.error("generateAiReport: appel IA échoué, repli sur l'analyse heuristique.", err);
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
