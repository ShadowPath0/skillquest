import { z } from "zod";
import { generateStructured, IS_VERCEL } from "./client";
import { slugify } from "@/lib/slug";
import { DOMAIN_ICON_KEYS } from "@/lib/domain-icons";

const DomainSuggestion = z.object({
  domainName: z.string(),
  domainDescription: z.string(),
  domainIcon: z.enum(DOMAIN_ICON_KEYS),
  subdomainName: z.string(),
  goalTitle: z.string(),
  goalDescription: z.string(),
  skillCategories: z.array(z.string()).min(2).max(6),
});

export type GeneratedDomain = z.infer<typeof DomainSuggestion> & {
  domainSlug: string;
  subdomainSlug: string;
};

export async function generateDomainFromPrompt(input: string): Promise<GeneratedDomain> {
  try {
    const parsed = await generateStructured({
      schema: DomainSuggestion,
      toolName: "domain_suggestion",
      system:
        "Tu es l'agent Domaine de SkillQuest. À partir d'une phrase libre décrivant ce qu'un utilisateur veut apprendre, tu identifies le domaine, le sous-domaine et un objectif clair et motivant, adaptés à n'importe quel sujet (technique, artistique, professionnel, académique...). Réponds uniquement en français.",
      user: `Texte de l'utilisateur : "${input}"

Donne :
- domainName : nom du domaine large (ex. "Informatique", "Cuisine", "Langues", "Droit")
- domainDescription : une phrase décrivant le domaine
- domainIcon : l'icône la plus représentative parmi la liste fournie
- subdomainName : le sous-domaine précis correspondant exactement au texte de l'utilisateur
- goalTitle : l'objectif reformulé de façon claire et motivante (3 à 8 mots)
- goalDescription : une phrase expliquant l'objectif
- skillCategories : 2 à 6 catégories de compétences courtes qui structureront un radar de compétences pour ce sujet`,
      // submitFreeformDomain est une Server Action : elle ne peut pas déclarer de
      // maxDuration (interdit dans un fichier "use server"), donc sa durée dépend du
      // défaut de la plateforme sur Vercel. On force un timeout court pour être sûr
      // de retomber sur le repli heuristique avant que la plateforme ne tue la
      // fonction, plutôt que de risquer une erreur brute côté utilisateur.
      timeoutMs: IS_VERCEL ? 8_000 : undefined,
    });

    return {
      ...parsed,
      domainSlug: slugify(parsed.domainName) || "domaine",
      subdomainSlug: slugify(parsed.subdomainName) || "general",
    };
  } catch (err) {
    // No CLAUDE_API_URL/CLAUDE_API_TOKEN configured or the call failed: derive a domain
    // directly from the raw input rather than blocking the user.
    console.error("generateDomainFromPrompt: appel IA échoué, repli heuristique.", err);
    return buildFallbackDomain(input);
  }
}

function buildFallbackDomain(input: string): GeneratedDomain {
  const cleaned = input.trim().replace(/\s+/g, " ");
  const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return {
    domainName: title,
    domainDescription: `Progresser en ${cleaned}.`,
    domainIcon: "sparkles",
    domainSlug: slugify(title) || "domaine",
    subdomainName: title,
    subdomainSlug: slugify(title) || "general",
    goalTitle: title,
    goalDescription: `Développer ses compétences en ${cleaned}.`,
    skillCategories: ["Bases", "Pratique", "Théorie"],
  };
}
