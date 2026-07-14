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
        "Tu es l'agent Évaluation de SkillQuest. Tu génères des questions de test de niveau variées, précises et sans ambiguïté, destinées à un test de placement adaptatif. Réponds uniquement en français.",
      user: `Génère ${count} questions de test de niveau pour le domaine "${domainName}" / sous-domaine "${subdomainName}", pour un utilisateur visant l'objectif "${goalTitle}".
Varie les 6 types de questions et répartis les difficultés de 1 (débutant) à 5 (expert) sur toute l'échelle.
Pour les QCM (type MCQ) : fournis exactement 4 choix dans "choices", dont un seul correct ; "correctAnswer" doit être le texte exact du choix correct.
Pour vrai/faux (type TRUE_FALSE) : "choices" doit être ["Vrai","Faux"] et "correctAnswer" l'un des deux.
Pour les questions ouvertes (type OPEN) : "choices" doit être null et "correctAnswer" doit décrire une réponse de référence servant à la correction IA.
Pour les exercices pratiques (type PRACTICAL) : "promptMd" décrit une tâche concrète à réaliser (ex. "Écris une fonction qui..."), "choices" doit être null et "correctAnswer" décrit une solution de référence.
Pour les études de cas (type CASE_STUDY) : "promptMd" présente une mise en situation détaillée suivie d'une question d'analyse, "choices" doit être null et "correctAnswer" décrit les points clés attendus dans la réponse.
Pour les mises en situation (type SCENARIO) : "promptMd" décrit un scénario avec un choix ou un jugement à faire, "choices" doit être null et "correctAnswer" décrit la démarche ou décision attendue.
Chaque question doit avoir 1 à 3 "skillTags" courts et cohérents entre eux (ex. "Hooks", "Gestion d'état").`,
      maxTokens: 8192,
    });

    questions = parsed.questions;
  } catch {
    // No CLAUDE_API_URL/CLAUDE_API_TOKEN configured or the call failed: fall back to a
    // small generic pool so a freeform domain never gets stuck without questions.
    questions = buildFallbackQuestionPool(subdomainName, goalTitle);
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
    promptMd: `Je me sens à l'aise avec les notions de niveau ${difficulty}/5 en ${subdomainName}.`,
    choices: ["Vrai", "Faux"],
    correctAnswer: "Vrai",
    explanationMd: "Auto-évaluation : il n'y a pas de bonne réponse universelle, elle t'aide à situer ton niveau ressenti.",
    skillTags: ["Bases"],
    estimatedTimeSec: 20,
  }),
  MCQ: (difficulty, subdomainName) => ({
    type: "MCQ",
    difficulty,
    promptMd: `Parmi ces approches, laquelle correspond le mieux à un niveau ${difficulty}/5 en ${subdomainName} ?`,
    choices: ["Approche débutante", "Approche intermédiaire", "Approche avancée", "Approche experte"],
    correctAnswer: "Approche intermédiaire",
    explanationMd: "Question générique de repli : il n'y a pas de correction fine possible sans clé Claude.",
    skillTags: ["Bases"],
    estimatedTimeSec: 30,
  }),
  OPEN: (difficulty, subdomainName, goalTitle) => ({
    type: "OPEN",
    difficulty,
    promptMd: `Explique ce que tu sais déjà sur "${goalTitle}" (niveau de difficulté visé : ${difficulty}/5).`,
    choices: null,
    correctAnswer: `Une réponse détaillée et concrète en lien avec ${subdomainName}.`,
    explanationMd: "Correction automatique indisponible sans clé Claude : réponse de référence générique.",
    skillTags: ["Pratique"],
    estimatedTimeSec: 60,
  }),
  PRACTICAL: (difficulty, subdomainName) => ({
    type: "PRACTICAL",
    difficulty,
    promptMd: `Décris comment tu t'y prendrais pour réaliser un exercice pratique de niveau ${difficulty}/5 en ${subdomainName}.`,
    choices: null,
    correctAnswer: `Une démarche concrète, étape par étape, adaptée à ${subdomainName}.`,
    explanationMd: "Correction automatique indisponible sans clé Claude : réponse de référence générique.",
    skillTags: ["Pratique"],
    estimatedTimeSec: 90,
  }),
  CASE_STUDY: (difficulty, subdomainName, goalTitle) => ({
    type: "CASE_STUDY",
    difficulty,
    promptMd: `Mise en situation (niveau ${difficulty}/5) : on te confie un projet lié à "${goalTitle}". Comment analyserais-tu la situation et par où commencerais-tu ?`,
    choices: null,
    correctAnswer: `Une analyse structurée du contexte de ${subdomainName} et un plan d'action priorisé.`,
    explanationMd: "Correction automatique indisponible sans clé Claude : réponse de référence générique.",
    skillTags: ["Analyse"],
    estimatedTimeSec: 120,
  }),
  SCENARIO: (difficulty, subdomainName) => ({
    type: "SCENARIO",
    difficulty,
    promptMd: `Scénario (niveau ${difficulty}/5) : face à une décision délicate en ${subdomainName}, quelle démarche adopterais-tu ?`,
    choices: null,
    correctAnswer: `Une démarche de décision raisonnée, en lien avec les bonnes pratiques de ${subdomainName}.`,
    explanationMd: "Correction automatique indisponible sans clé Claude : réponse de référence générique.",
    skillTags: ["Jugement"],
    estimatedTimeSec: 90,
  }),
};

function buildFallbackQuestionPool(
  subdomainName: string,
  goalTitle: string
): z.infer<typeof GeneratedQuestion>[] {
  const types = Object.keys(FALLBACK_QUESTION_BUILDERS) as z.infer<typeof PoolQuestionType>[];
  const difficulties = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  return types.flatMap((type) =>
    difficulties.map((difficulty) =>
      FALLBACK_QUESTION_BUILDERS[type](difficulty, subdomainName, goalTitle)
    )
  );
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
      "Tu es l'agent Évaluation de SkillQuest. Tu corriges une réponse ouverte à une question de test en comparant avec la réponse de référence, avec bienveillance mais rigueur. Réponds uniquement en français.",
    user: `Question : ${promptMd}\n\nRéponse de référence : ${referenceAnswer}\n\nRéponse de l'utilisateur : ${userAnswer}\n\nÉvalue si la réponse de l'utilisateur est correcte (isCorrect), donne un score entre 0 et 1 (score), et une explication courte (feedbackMd) qui indique ce qui est juste ou manquant.`,
  });
}
