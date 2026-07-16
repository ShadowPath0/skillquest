import { z } from "zod";
import { generateStructured } from "./client";
import { prisma } from "@/lib/prisma";

const ResourceContent = z.object({
  title: z.string(),
  contentMd: z.string(),
});

const ResourceBatch = z.object({
  resources: z.array(ResourceContent),
});

/**
 * One consolidated resource (explanation + example + exercise) per unique
 * skill, generated once per domain and reused across programs — avoids
 * regenerating the same content on every weekly program.
 */
export async function generateResourcesForSkills(
  domainId: string,
  domainName: string,
  skills: string[]
) {
  const uniqueSkills = Array.from(new Set(skills)).slice(0, 12);
  if (uniqueSkills.length === 0) return;

  const existing = await prisma.resource.findMany({
    where: { domainId, skillTag: { in: uniqueSkills } },
    select: { skillTag: true },
  });
  const existingTags = new Set(existing.map((r) => r.skillTag));
  const missingSkills = uniqueSkills.filter((s) => !existingTags.has(s));
  if (missingSkills.length === 0) return;

  let contents: Map<string, z.infer<typeof ResourceContent>>;

  try {
    const parsed = await generateStructured({
      schema: ResourceBatch,
      toolName: "resource_batch",
      system:
        "Tu es l'agent Générateur de SkillQuest. Pour chaque compétence donnée, tu rédiges une fiche de ressource condensée en markdown : une explication claire, un exemple concret, puis un court exercice d'application. Réponds uniquement en français.",
      user: `Domaine : "${domainName}". Génère une ressource pour chacune de ces compétences, dans le même ordre : ${missingSkills.join(", ")}.
Pour chaque ressource : "title" (titre court) et "contentMd" (markdown avec une section Explication, une section Exemple, une section Exercice).`,
    });

    if (parsed.resources.length !== missingSkills.length) {
      throw new Error("La génération des ressources a échoué.");
    }
    contents = new Map(missingSkills.map((skill, i) => [skill, parsed.resources[i]]));
  } catch (err) {
    // No CLAUDE_API_URL/CLAUDE_API_TOKEN configured or the call failed: templated fallback.
    console.error("generateResourcesForSkills: appel IA échoué, repli sur le contenu template.", err);
    contents = new Map(
      missingSkills.map((skill) => [
        skill,
        {
          title: `Fiche : ${skill}`,
          contentMd: `## Explication\nNotions clés à connaître sur "${skill}" en ${domainName}.\n\n## Exemple\nUn exemple concret d'application de "${skill}".\n\n## Exercice\nMets en pratique "${skill}" sur un cas simple de ${domainName}.`,
        },
      ])
    );
  }

  await Promise.all(
    missingSkills.map((skill) => {
      const content = contents.get(skill)!;
      return prisma.resource.upsert({
        where: { domainId_skillTag: { domainId, skillTag: skill } },
        update: {},
        create: {
          domainId,
          skillTag: skill,
          title: content.title,
          contentMd: content.contentMd,
          aiGenerated: true,
        },
      });
    })
  );
}
