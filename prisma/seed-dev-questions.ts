/**
 * Dev-only fixture: hand-authored questions for one subdomain (dev-web-react),
 * used to exercise the adaptive test engine end-to-end before a real
 * ANTHROPIC_API_KEY is configured. Production pools should be generated via
 * src/lib/agents/evaluation-agent.ts (generateQuestionPool).
 */
import { PrismaClient, Prisma, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

type SeedQuestion = {
  type: QuestionType;
  difficulty: number;
  promptMd: string;
  choices: string[] | null;
  correctAnswer: string;
  explanationMd: string;
  skillTags: string[];
  estimatedTimeSec: number;
};

const QUESTIONS: SeedQuestion[] = [
  {
    type: "TRUE_FALSE",
    difficulty: 1,
    promptMd: "En React, le JSX est obligatoire pour écrire des composants.",
    choices: ["Vrai", "Faux"],
    correctAnswer: "Faux",
    explanationMd:
      "JSX est une commodité syntaxique ; on peut écrire des composants avec `React.createElement` directement.",
    skillTags: ["Bases React"],
    estimatedTimeSec: 30,
  },
  {
    type: "MCQ",
    difficulty: 1,
    promptMd: "Quel hook permet de gérer un état local dans un composant fonction ?",
    choices: ["useEffect", "useState", "useContext", "useMemo"],
    correctAnswer: "useState",
    explanationMd: "`useState` retourne une paire [valeur, setter] pour gérer un état local.",
    skillTags: ["Hooks"],
    estimatedTimeSec: 30,
  },
  {
    type: "MCQ",
    difficulty: 1.5,
    promptMd: "Que représente `props` dans un composant React ?",
    choices: [
      "L'état interne du composant",
      "Les données passées par le composant parent",
      "Le DOM virtuel du composant",
      "Les styles CSS du composant",
    ],
    correctAnswer: "Les données passées par le composant parent",
    explanationMd: "`props` est en lecture seule et transmis du parent vers l'enfant.",
    skillTags: ["Bases React"],
    estimatedTimeSec: 30,
  },
  {
    type: "OPEN",
    difficulty: 2,
    promptMd: "Explique en une phrase la différence entre `state` et `props`.",
    choices: null,
    correctAnswer:
      "`props` est passé par le parent et en lecture seule, `state` est géré et modifiable localement par le composant lui-même.",
    explanationMd: "L'important est de mentionner la source des données et la mutabilité.",
    skillTags: ["Bases React"],
    estimatedTimeSec: 60,
  },
  {
    type: "MCQ",
    difficulty: 2,
    promptMd: "Quel hook exécute un effet de bord après le rendu du composant ?",
    choices: ["useState", "useRef", "useEffect", "useCallback"],
    correctAnswer: "useEffect",
    explanationMd: "`useEffect` s'exécute après le rendu, et peut être conditionné par un tableau de dépendances.",
    skillTags: ["Hooks"],
    estimatedTimeSec: 30,
  },
  {
    type: "TRUE_FALSE",
    difficulty: 2.5,
    promptMd:
      "Un tableau de dépendances vide (`[]`) passé à `useEffect` fait exécuter l'effet à chaque rendu.",
    choices: ["Vrai", "Faux"],
    correctAnswer: "Faux",
    explanationMd: "Un tableau vide fait exécuter l'effet une seule fois, après le montage initial.",
    skillTags: ["Hooks"],
    estimatedTimeSec: 30,
  },
  {
    type: "MCQ",
    difficulty: 2.5,
    promptMd: "Quelle bibliothèque de state management global est la plus légère et minimaliste ?",
    choices: ["Redux", "Zustand", "MobX", "Recoil"],
    correctAnswer: "Zustand",
    explanationMd:
      "Zustand propose une API minimaliste basée sur des hooks, sans boilerplate de reducers/actions.",
    skillTags: ["Gestion d'état"],
    estimatedTimeSec: 30,
  },
  {
    type: "OPEN",
    difficulty: 3,
    promptMd: "Pourquoi utilise-t-on une `key` unique dans une liste rendue avec `.map()` en React ?",
    choices: null,
    correctAnswer:
      "La `key` aide React à identifier quels éléments ont changé, été ajoutés ou supprimés, pour optimiser le reconciliation du DOM virtuel et éviter des bugs d'état sur les mauvais éléments.",
    explanationMd: "L'important est de mentionner la reconciliation/diffing et l'identification stable des éléments.",
    skillTags: ["Performance", "Bases React"],
    estimatedTimeSec: 60,
  },
  {
    type: "MCQ",
    difficulty: 3,
    promptMd: "Quel hook permet de mémoïser une valeur calculée coûteuse entre les rendus ?",
    choices: ["useMemo", "useCallback", "useRef", "useLayoutEffect"],
    correctAnswer: "useMemo",
    explanationMd: "`useMemo` recalcule la valeur seulement quand une dépendance change.",
    skillTags: ["Hooks", "Performance"],
    estimatedTimeSec: 30,
  },
  {
    type: "TRUE_FALSE",
    difficulty: 3.5,
    promptMd: "`useCallback` mémoïse une fonction, `useMemo` mémoïse une valeur.",
    choices: ["Vrai", "Faux"],
    correctAnswer: "Vrai",
    explanationMd: "C'est la distinction clé entre ces deux hooks d'optimisation.",
    skillTags: ["Hooks", "Performance"],
    estimatedTimeSec: 30,
  },
  {
    type: "OPEN",
    difficulty: 3.5,
    promptMd: "Décris un cas où un `useEffect` mal utilisé peut causer une boucle infinie de rendus.",
    choices: null,
    correctAnswer:
      "Si l'effet modifie un état qui est aussi une de ses dépendances (ou une dépendance qui change de référence à chaque rendu, comme un objet/fonction recréé), l'effet se redéclenche indéfiniment.",
    explanationMd: "L'important est de mentionner la dépendance qui change à chaque rendu et le setState dans l'effet.",
    skillTags: ["Hooks", "Performance"],
    estimatedTimeSec: 90,
  },
  {
    type: "MCQ",
    difficulty: 4,
    promptMd: "Dans le contexte du Server-Side Rendering (Next.js App Router), que sont les Server Components ?",
    choices: [
      "Des composants qui s'exécutent uniquement côté client",
      "Des composants qui s'exécutent côté serveur et n'envoient pas de JS au client par défaut",
      "Des composants qui remplacent complètement les hooks React",
      "Des composants réservés aux API routes",
    ],
    correctAnswer:
      "Des composants qui s'exécutent côté serveur et n'envoient pas de JS au client par défaut",
    explanationMd:
      "Les Server Components réduisent le JS envoyé au client et peuvent accéder directement aux ressources serveur (DB, fichiers).",
    skillTags: ["Architecture"],
    estimatedTimeSec: 45,
  },
  {
    type: "OPEN",
    difficulty: 4,
    promptMd: "Explique la différence entre le rendu côté serveur (SSR) et la génération statique (SSG).",
    choices: null,
    correctAnswer:
      "Le SSR génère le HTML à chaque requête sur le serveur, alors que le SSG génère le HTML à l'avance (au build), servi tel quel ensuite. Le SSR convient aux contenus dynamiques/personnalisés, le SSG aux contenus stables.",
    explanationMd: "L'important est le moment de génération (requête vs build) et le cas d'usage.",
    skillTags: ["Architecture"],
    estimatedTimeSec: 90,
  },
  {
    type: "MCQ",
    difficulty: 4.5,
    promptMd: "Quelle approche de test est la plus adaptée pour vérifier le comportement utilisateur d'un composant React ?",
    choices: [
      "Snapshot testing exhaustif de tous les composants",
      "Tests unitaires isolant l'implémentation interne (état privé)",
      "Tests axés comportement avec Testing Library, simulant les interactions utilisateur",
      "Tests end-to-end uniquement, sans tests de composants",
    ],
    correctAnswer:
      "Tests axés comportement avec Testing Library, simulant les interactions utilisateur",
    explanationMd:
      "React Testing Library encourage à tester ce que l'utilisateur voit/fait plutôt que les détails d'implémentation.",
    skillTags: ["Tests"],
    estimatedTimeSec: 45,
  },
  {
    type: "OPEN",
    difficulty: 5,
    promptMd:
      "Un composant liste de 10 000 éléments devient lent au scroll. Décris deux techniques concrètes pour améliorer les performances.",
    choices: null,
    correctAnswer:
      "Virtualisation de la liste (ex. react-window/react-virtual) pour ne monter que les éléments visibles, et mémoïsation des éléments de liste (React.memo, useMemo/useCallback) pour éviter les re-rendus inutiles ; éventuellement la pagination/infinite scroll pour réduire le volume chargé.",
    explanationMd:
      "L'important est de citer la virtualisation et au moins une technique de réduction des re-rendus.",
    skillTags: ["Performance", "Architecture"],
    estimatedTimeSec: 120,
  },
  {
    type: "MCQ",
    difficulty: 5,
    promptMd: "Quel est le principal risque d'utiliser un `useEffect` pour synchroniser un état dérivé d'un autre état ?",
    choices: [
      "Aucun risque, c'est l'approche recommandée",
      "Un rendu supplémentaire inutile et une source de bugs de synchronisation évitable en calculant la valeur directement pendant le rendu",
      "Cela empêche l'utilisation de TypeScript",
      "Cela désactive le mode strict de React",
    ],
    correctAnswer:
      "Un rendu supplémentaire inutile et une source de bugs de synchronisation évitable en calculant la valeur directement pendant le rendu",
    explanationMd:
      "Un état dérivé devrait être calculé directement pendant le rendu (éventuellement avec useMemo), pas synchronisé via un effet.",
    skillTags: ["Hooks", "Architecture"],
    estimatedTimeSec: 60,
  },
];

async function main() {
  const domain = await prisma.domain.findUnique({ where: { slug: "informatique" } });
  if (!domain) {
    throw new Error("Domaine informatique introuvable : lance d'abord `npm run db:seed`.");
  }

  const subdomain = await prisma.subdomain.findUnique({
    where: { domainId_slug: { domainId: domain.id, slug: "dev-web-react" } },
  });

  if (!subdomain) {
    throw new Error("Sous-domaine dev-web-react introuvable : lance d'abord `npm run db:seed`.");
  }

  const existingCount = await prisma.question.count({ where: { subdomainId: subdomain.id } });
  if (existingCount > 0) {
    console.log(`Le pool contient déjà ${existingCount} questions pour dev-web-react, seed ignoré.`);
    return;
  }

  await prisma.question.createMany({
    data: QUESTIONS.map((q) => ({
      domainId: subdomain.domainId,
      subdomainId: subdomain.id,
      type: q.type,
      difficulty: q.difficulty,
      promptMd: q.promptMd,
      choicesJson: q.choices ?? Prisma.JsonNull,
      correctAnswerJson: q.correctAnswer,
      explanationMd: q.explanationMd,
      skillTags: q.skillTags,
      estimatedTimeSec: q.estimatedTimeSec,
      aiGenerated: false,
    })),
  });

  console.log(`${QUESTIONS.length} questions de démo insérées pour dev-web-react.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
