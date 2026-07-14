import { PrismaClient, BadgeCategory } from "@prisma/client";

const prisma = new PrismaClient();

const DOMAINS = [
  {
    slug: "informatique",
    name: "Informatique",
    description: "Développement logiciel, data et cloud",
    icon: "code",
    color: "violet",
    subdomains: [
      {
        slug: "dev-web-react",
        name: "Développement web (React)",
        goals: [
          {
            title: "Devenir développeur React",
            description:
              "Maîtriser React, les hooks, la gestion d'état et l'écosystème moderne du frontend.",
          },
          {
            title: "Renforcer mes bases JavaScript/TypeScript",
            description:
              "Consolider la syntaxe, l'asynchrone et le typage avant d'aller plus loin en frontend.",
          },
        ],
      },
      {
        slug: "data-science",
        name: "Data Science",
        goals: [
          {
            title: "Préparer un entretien Data Scientist",
            description:
              "Réviser statistiques, machine learning, SQL et études de cas d'entretien.",
          },
        ],
      },
      {
        slug: "cloud-aws",
        name: "Cloud AWS",
        goals: [
          {
            title: "Préparer une certification AWS",
            description:
              "Couvrir les services cœur AWS, l'architecture cloud et les bonnes pratiques de sécurité.",
          },
        ],
      },
    ],
  },
  {
    slug: "langues",
    name: "Langues",
    description: "Compréhension, expression et vocabulaire",
    icon: "languages",
    color: "cyan",
    subdomains: [
      {
        slug: "anglais",
        name: "Anglais",
        goals: [
          {
            title: "Améliorer son anglais général",
            description:
              "Progresser en grammaire, vocabulaire et compréhension à l'oral comme à l'écrit.",
          },
          {
            title: "Anglais professionnel",
            description:
              "Être à l'aise en réunion, email et présentation en contexte professionnel.",
          },
        ],
      },
    ],
  },
  {
    slug: "bureautique",
    name: "Bureautique",
    description: "Outils de productivité du quotidien",
    icon: "table",
    color: "blue",
    subdomains: [
      {
        slug: "excel",
        name: "Excel",
        goals: [
          {
            title: "Maîtriser Excel",
            description:
              "Des formules de base aux tableaux croisés dynamiques et à l'automatisation.",
          },
        ],
      },
    ],
  },
  {
    slug: "management",
    name: "Management",
    description: "Gestion d'équipe et de projet",
    icon: "users",
    color: "black",
    subdomains: [
      {
        slug: "gestion-equipe",
        name: "Gestion d'équipe",
        goals: [
          {
            title: "Devenir un meilleur manager",
            description:
              "Développer la communication, la délégation et la gestion des conflits.",
          },
        ],
      },
    ],
  },
];

// Level 1 → 20, XP requirement growing roughly quadratically.
const LEVEL_TITLES = [
  "Novice", "Apprenti", "Débutant confirmé", "Étudiant assidu", "Praticien",
  "Praticien confirmé", "Compétent", "Compétent avancé", "Expert en herbe", "Expert",
  "Expert confirmé", "Spécialiste", "Spécialiste avancé", "Vétéran", "Vétéran confirmé",
  "Maître", "Maître avancé", "Grand maître", "Légende en devenir", "Légende",
];

function xpForLevel(level: number) {
  return Math.round(50 * level * level);
}

const STARTER_BADGES = [
  {
    slug: "premier-pas",
    name: "Premier pas",
    description: "Terminer son premier test de niveau",
    iconUrl: "footprints",
    category: BadgeCategory.MILESTONE,
    criteriaJson: { type: "test_completed_count", count: 1 },
    unlocksTitle: "l'Aventurier",
  },
  {
    slug: "serie-3-jours",
    name: "Série de 3 jours",
    description: "Maintenir une série de 3 jours consécutifs",
    iconUrl: "flame",
    category: BadgeCategory.STREAK,
    criteriaJson: { type: "streak", days: 3 },
  },
  {
    slug: "serie-7-jours",
    name: "Série de 7 jours",
    description: "Maintenir une série de 7 jours consécutifs",
    iconUrl: "flame",
    category: BadgeCategory.STREAK,
    criteriaJson: { type: "streak", days: 7 },
  },
  {
    slug: "perfectionniste",
    name: "Perfectionniste",
    description: "Obtenir un score de 100% sur un test",
    iconUrl: "star",
    category: BadgeCategory.SKILL,
    criteriaJson: { type: "test_score", minScore: 100 },
    unlocksTitle: "le Perfectionniste",
  },
  {
    slug: "premiere-semaine",
    name: "Première semaine bouclée",
    description: "Terminer la première semaine d'un programme",
    iconUrl: "calendar-check",
    category: BadgeCategory.ACHIEVEMENT,
    criteriaJson: { type: "program_week_completed", weekNumber: 1 },
  },
  {
    slug: "programme-termine",
    name: "Programme terminé",
    description: "Terminer un programme de 6 semaines complet",
    iconUrl: "trophy",
    category: BadgeCategory.ACHIEVEMENT,
    criteriaJson: { type: "program_completed" },
    unlocksTitle: "le Diplômé",
  },
];

async function main() {
  for (const domain of DOMAINS) {
    const createdDomain = await prisma.domain.upsert({
      where: { slug: domain.slug },
      update: {
        name: domain.name,
        description: domain.description,
        icon: domain.icon,
        color: domain.color,
      },
      create: {
        slug: domain.slug,
        name: domain.name,
        description: domain.description,
        icon: domain.icon,
        color: domain.color,
      },
    });

    for (const subdomain of domain.subdomains) {
      const createdSubdomain = await prisma.subdomain.upsert({
        where: {
          domainId_slug: { domainId: createdDomain.id, slug: subdomain.slug },
        },
        update: { name: subdomain.name },
        create: {
          domainId: createdDomain.id,
          slug: subdomain.slug,
          name: subdomain.name,
        },
      });

      for (const goal of subdomain.goals) {
        const existing = await prisma.goalTemplate.findFirst({
          where: { subdomainId: createdSubdomain.id, title: goal.title },
        });
        if (!existing) {
          await prisma.goalTemplate.create({
            data: {
              subdomainId: createdSubdomain.id,
              title: goal.title,
              description: goal.description,
            },
          });
        }
      }
    }
  }

  for (let level = 1; level <= LEVEL_TITLES.length; level++) {
    await prisma.levelThreshold.upsert({
      where: { level },
      update: { xpRequired: xpForLevel(level), title: LEVEL_TITLES[level - 1] },
      create: {
        level,
        xpRequired: xpForLevel(level),
        title: LEVEL_TITLES[level - 1],
      },
    });
  }

  for (const badge of STARTER_BADGES) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: {
        name: badge.name,
        description: badge.description,
        iconUrl: badge.iconUrl,
        category: badge.category,
        criteriaJson: badge.criteriaJson,
        unlocksTitle: badge.unlocksTitle ?? null,
      },
      create: badge,
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
