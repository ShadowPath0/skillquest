import { prisma } from "@/lib/prisma";
import type { AnalysisWeakness } from "./analysis-agent";

export type CoachContext = {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

export async function buildCoachContext(
  userId: string,
  conversationId: string,
  domainId: string | null
): Promise<CoachContext> {
  const [history, activeGoal, latestReport] = await Promise.all([
    prisma.coachMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.userGoal.findFirst({
      where: { userId, status: "ACTIVE", ...(domainId ? { domainId } : {}) },
      include: { domain: true, subdomain: true, goalTemplate: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiReport.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const systemParts = [
    "Tu es l'agent Coach de SkillQuest, un assistant pédagogique personnel. Tu réponds aux questions, expliques les erreurs, reformules des notions et donnes des exemples concrets, comme un professeur particulier. Sois concis, bienveillant et pédagogue. Réponds en français.",
  ];

  if (activeGoal) {
    systemParts.push(
      `L'utilisateur travaille sur l'objectif "${activeGoal.goalTemplate?.title ?? activeGoal.customTitle}" dans ${activeGoal.domain.name} / ${activeGoal.subdomain.name}.`
    );
  }

  if (latestReport) {
    const weaknesses = (latestReport.weaknessesJson as AnalysisWeakness[])
      .map((w) => `${w.title} (priorité ${w.priority})`)
      .join(", ");
    systemParts.push(
      `Son dernier diagnostic : score ${latestReport.globalScore}/100, niveau ${latestReport.level}. Points faibles identifiés : ${weaknesses}.`
    );
  }

  return {
    system: systemParts.join("\n"),
    messages: history.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  };
}

// Le wrapper VM est un simple prompt-texte, sans rôles multi-tours natifs : on aplatit
// system + historique en un seul texte que `claude -p` reçoit comme prompt.
export function buildCoachPrompt(context: CoachContext): string {
  const transcript = context.messages
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.content}`)
    .join("\n\n");

  return `${context.system}

Voici la conversation jusqu'ici :

${transcript}

Réponds maintenant en tant qu'Assistant, dans la continuité de cette conversation.`;
}
