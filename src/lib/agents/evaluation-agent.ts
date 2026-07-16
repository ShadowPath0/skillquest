import { z } from "zod";
import { generateStructured } from "./client";
import { prisma } from "@/lib/prisma";
import { Prisma, type QuestionType } from "@prisma/client";

const PoolQuestionType = z.enum([
  "MCQ",
  "TRUE_FALSE",
  "OPEN",
  "PRACTICAL",
  "CASE_STUDY",
  "SCENARIO",
]);

const GeneratedQuestion = z.object({
  type: PoolQuestionType,
  difficulty: z.number().min(1).max(5),
  promptMd: z.string(),
  choices: z.array(z.string()).nullable(),
  correctAnswer: z.string(),
  explanationMd: z.string(),
  skillTags: z.array(z.string()).min(1).max(3),
  estimatedTimeSec: z.number().int().min(15).max(600),
});

const GeneratedQuestionPool = z.object({
  questions: z.array(GeneratedQuestion),
});

export async function generateQuestionPool({
  domainId,
  subdomainId,
  domainName,
  subdomainName,
  goalTitle,
  count = 20,
}: {
  domainId: string;
  subdomainId: string;
  domainName: string;
  subdomainName: string;
  goalTitle: string;
  count?: number;
}) {
  let questions: z.infer<typeof GeneratedQuestion>[];
  let aiGenerated = true;

  try {
    const parsed = await generateStructured({
      schema: GeneratedQuestionPool,
      toolName: "question_pool",
      system:
        "Tu es l'agent Évaluation de SkillQuest, un expert du domaine testé qui rédige des questions au niveau d'un examen professionnel ou d'une certification métier : précises, sans ambiguïté, et ancrées dans des situations réelles plutôt que des généralités théoriques. Réponds uniquement en français.",
      user: `Génère ${count} questions de test de niveau pour le domaine "${domainName}" / sous-domaine "${subdomainName}", pour un utilisateur visant l'objectif "${goalTitle}".
Varie les 6 types de questions et répartis les difficultés de 1 (débutant) à 5 (expert) sur toute l'échelle.
Pour les QCM (type MCQ) : fournis exactement 4 choix dans "choices", dont un seul correct ; "correctAnswer" doit être le texte exact du choix correct. Les distracteurs doivent être plausibles (des erreurs fréquentes réelles), pas absurdes.
Pour vrai/faux (type TRUE_FALSE) : "choices" doit être ["Vrai","Faux"] et "correctAnswer" l'un des deux.
Pour les questions ouvertes (type OPEN) : "choices" doit être null et "correctAnswer" doit décrire une réponse de référence précise et complète servant à la correction IA.
Pour les exercices pratiques (type PRACTICAL) : "promptMd" décrit une tâche concrète à réaliser (ex. "Écris une fonction qui..."), "choices" doit être null et "correctAnswer" décrit une solution de référence.
Pour les études de cas (type CASE_STUDY) : "promptMd" présente une mise en situation détaillée et réaliste (avec des détails concrets, pas un cas abstrait) suivie d'une question d'analyse, "choices" doit être null et "correctAnswer" décrit les points clés attendus dans la réponse.
Pour les mises en situation (type SCENARIO) : "promptMd" décrit un scénario concret avec un choix ou un jugement à faire, "choices" doit être null et "correctAnswer" décrit la démarche ou décision attendue et pourquoi.
Chaque question doit avoir 1 à 3 "skillTags" courts et cohérents entre eux (ex. "Hooks", "Gestion d'état").
Évite les questions vagues ou purement définitionnelles ("Qu'est-ce que X ?") sauf aux difficultés 1-2 : aux difficultés 3-5, teste l'application, l'analyse d'un cas, ou la distinction entre deux notions proches souvent confondues.`,
      maxTokens: Math.min(8192, Math.max(2048, count * 1200)),
    });

    questions = parsed.questions;
  } catch (err) {
    // No CLAUDE_API_URL/CLAUDE_API_TOKEN configured or the call failed: fall back to a
    // small generic pool so a freeform domain never gets stuck without questions.
    console.error("generateQuestionPool: appel IA échoué, repli sur le pool générique.", err);
    questions = buildFallbackQuestionPool(subdomainName, goalTitle, count);
    aiGenerated = false;
  }

  await prisma.question.createMany({
    data: questions.map((q) => ({
      domainId,
      subdomainId,
      type: q.type as QuestionType,
      difficulty: q.difficulty,
      promptMd: q.promptMd,
      choicesJson: q.choices ?? Prisma.JsonNull,
      correctAnswerJson: q.correctAnswer,
      explanationMd: q.explanationMd,
      skillTags: q.skillTags,
      estimatedTimeSec: q.estimatedTimeSec,
      aiGenerated,
    })),
  });

  return questions.length;
}

const FALLBACK_QUESTION_BUILDERS: Record<
  z.infer<typeof PoolQuestionType>,
  (
    difficulty: number,
    subdomainName: string,
    goalTitle: string
  ) => z.infer<typeof GeneratedQuestion>
> = {
  TRUE_FALSE: (difficulty, subdomainName) => ({
    type: "TRUE_FALSE",
    difficulty,
    promptMd: `Je maîtrise déjà les bases de ${subdomainName}.`,
    choices: ["Vrai", "Faux"],
    correctAnswer: "Vrai",
    explanationMd: "Auto-évaluation : il n'y a pas de bonne réponse universelle, elle t'aide à situer ton niveau ressenti.",
    skillTags: ["Bases"],
    estimatedTimeSec: 20,
  }),
  MCQ: (difficulty, subdomainName) => ({
    type: "MCQ",
    difficulty,
    promptMd: `Parmi ces approches, laquelle correspond le mieux à ton niveau actuel en ${subdomainName} ?`,
    choices: ["Approche débutante", "Approche intermédiaire", "Approche avancée", "Approche experte"],
    correctAnswer: "Approche intermédiaire",
    explanationMd: "Question générique de repli : il n'y a pas de correction fine possible sans clé Claude.",
    skillTags: ["Bases"],
    estimatedTimeSec: 30,
  }),
  OPEN: (difficulty, subdomainName, goalTitle) => ({
    type: "OPEN",
    difficulty,
    promptMd: `Explique ce que tu sais déjà sur "${goalTitle}".`,
    choices: null,
    correctAnswer: `Une réponse détaillée et concrète en lien avec ${subdomainName}.`,
    explanationMd: "Correction automatique indisponible sans clé Claude : réponse de référence générique.",
    skillTags: ["Pratique"],
    estimatedTimeSec: 60,
  }),
  PRACTICAL: (difficulty, subdomainName) => ({
    type: "PRACTICAL",
    difficulty,
    promptMd: `Décris comment tu t'y prendrais pour réaliser un exercice pratique en ${subdomainName}.`,
    choices: null,
    correctAnswer: `Une démarche concrète, étape par étape, adaptée à ${subdomainName}.`,
    explanationMd: "Correction automatique indisponible sans clé Claude : réponse de référence générique.",
    skillTags: ["Pratique"],
    estimatedTimeSec: 90,
  }),
  CASE_STUDY: (difficulty, subdomainName, goalTitle) => ({
    type: "CASE_STUDY",
    difficulty,
    promptMd: `Mise en situation : on te confie un projet lié à "${goalTitle}". Comment analyserais-tu la situation et par où commencerais-tu ?`,
    choices: null,
    correctAnswer: `Une analyse structurée du contexte de ${subdomainName} et un plan d'action priorisé.`,
    explanationMd: "Correction automatique indisponible sans clé Claude : réponse de référence générique.",
    skillTags: ["Analyse"],
    estimatedTimeSec: 120,
  }),
  SCENARIO: (difficulty, subdomainName) => ({
    type: "SCENARIO",
    difficulty,
    promptMd: `Scénario : face à une décision délicate en ${subdomainName}, quelle démarche adopterais-tu ?`,
    choices: null,
    correctAnswer: `Une démarche de décision raisonnée, en lien avec les bonnes pratiques de ${subdomainName}.`,
    explanationMd: "Correction automatique indisponible sans clé Claude : réponse de référence générique.",
    skillTags: ["Jugement"],
    estimatedTimeSec: 90,
  }),
};

function buildFallbackQuestionPool(
  subdomainName: string,
  goalTitle: string,
  count: number
): z.infer<typeof GeneratedQuestion>[] {
  const types = Object.keys(FALLBACK_QUESTION_BUILDERS) as z.infer<typeof PoolQuestionType>[];
  const difficulties = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  const full = types.flatMap((type) =>
    difficulties.map((difficulty) =>
      FALLBACK_QUESTION_BUILDERS[type](difficulty, subdomainName, goalTitle)
    )
  );

  // Respecte le count demandé : sinon, un lot d'arrière-plan volontairement petit qui
  // tombe en repli inonderait le pool de dizaines de doublons génériques.
  return full.slice(0, Math.max(1, count));
}

const OpenAnswerGrading = z.object({
  isCorrect: z.boolean(),
  score: z.number().min(0).max(1),
  feedbackMd: z.string(),
});

export async function gradeOpenAnswer({
  promptMd,
  referenceAnswer,
  userAnswer,
}: {
  promptMd: string;
  referenceAnswer: string;
  userAnswer: string;
}) {
  return generateStructured({
    schema: OpenAnswerGrading,
    toolName: "open_answer_grading",
    system:
      "Tu es l'agent Évaluation de SkillQuest, un expert du domaine qui corrige avec la rigueur d'un formateur senior : précis, factuel, sans complaisance mais bienveillant. Réponds uniquement en français.",
    user: `Question : ${promptMd}\n\nRéponse de référence : ${referenceAnswer}\n\nRéponse de l'utilisateur : ${userAnswer}\n\nÉvalue si la réponse de l'utilisateur est correcte (isCorrect) et donne un score entre 0 et 1 (score) reflétant la justesse et la complétude.\n\nDans feedbackMd (3 à 5 phrases) : si la réponse est fausse ou incomplète, explique précisément ce qui est erroné ou manquant, donne la réponse correcte en expliquant son raisonnement (pas juste l'énoncer), et si c'est pertinent pourquoi ça compte en pratique. Si la réponse est juste, confirme-le brièvement et complète si un point utile manque.`,
  });
}
