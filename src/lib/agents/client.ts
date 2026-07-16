import type { z } from "zod";

export const CLAUDE_API_URL = process.env.CLAUDE_API_URL;
export const CLAUDE_API_TOKEN = process.env.CLAUDE_API_TOKEN;

// Slightly above the VM wrapper's own internal timeout so we see its real error first.
const DEFAULT_TIMEOUT_MS = 65_000;
const MAX_TIMEOUT_MS = 220_000;
const STRUCTURED_MAX_TOKENS = 4096;

export async function callClaudeApi(prompt: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  if (!CLAUDE_API_URL || !CLAUDE_API_TOKEN) {
    throw new Error("CLAUDE_API_URL / CLAUDE_API_TOKEN non configurés.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${CLAUDE_API_URL.replace(/\/$/, "")}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLAUDE_API_TOKEN}`,
      },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`L'API Claude a répondu ${res.status}.`);
    }

    const data = (await res.json()) as { response?: string };
    if (typeof data.response !== "string") {
      throw new Error("Réponse de l'API Claude invalide.");
    }
    return data.response;
  } finally {
    clearTimeout(timer);
  }
}

// Le tunnel Cloudflare gratuit ("Quick Tunnel") n'a aucune garantie de disponibilité
// et coupe parfois une requête en cours (524) même sans dépasser aucun timeout côté
// serveur — un retry unique absorbe la plupart de ces échecs transitoires.
async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return withRetry(fn, retries - 1);
  }
}

// Le wrapper VM ne fait que passer le texte à `claude -p` : il n'y a pas de tool-use
// natif ici, donc le schéma JSON est décrit dans le prompt et la réponse est reparsée.
// Le JSON peut contenir des ``` littéraux dans des valeurs de chaîne (exemples de
// code) : le match doit être glouton jusqu'à la DERNIÈRE balise, pas la première,
// sous peine de couper la réponse au milieu d'une chaîne.
function extractJsonPayload(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*)```\s*$/i);
  const candidate = (fenced ? fenced[1] : text).trim();

  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("Aucun JSON exploitable dans la réponse.");
    }
    return candidate.slice(start, end + 1);
  }
}

export async function generateStructured<T extends z.ZodTypeAny>({
  system,
  user,
  schema,
  toolName,
  maxTokens = STRUCTURED_MAX_TOKENS,
}: {
  system: string;
  user: string;
  schema: T;
  toolName: string;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const jsonSchema = schema.toJSONSchema();
  const approxMaxChars = maxTokens * 4;

  const prompt = `${system}

${user}

Réponds UNIQUEMENT avec un objet JSON valide respectant exactement ce schéma JSON (aucun texte avant/après, aucune balise markdown) :
${JSON.stringify(jsonSchema)}

Ta réponse ne doit pas dépasser environ ${approxMaxChars} caractères.`;

  // Le wrapper CLI est lent (démarrage à froid + débit d'abonnement) : une grosse
  // génération structurée peut prendre bien plus que le timeout par défaut.
  const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(DEFAULT_TIMEOUT_MS, maxTokens * 20));

  return withRetry(async () => {
    const raw = await callClaudeApi(prompt, timeoutMs);

    try {
      const jsonText = extractJsonPayload(raw);
      const parsedRaw: unknown = JSON.parse(jsonText);
      return schema.parse(parsedRaw);
    } catch (err) {
      // Sans ce log, un échec d'extraction/validation ici est totalement silencieux
      // pour l'appelant (juste un repli déclenché) — impossible à diagnostiquer sinon.
      console.error(
        `generateStructured("${toolName}") a échoué:`,
        err,
        "\nRéponse brute (tronquée):",
        raw.slice(0, 2000)
      );
      throw new Error(`La génération structurée "${toolName}" a renvoyé un JSON invalide.`);
    }
  });
}

export async function generateText(prompt: string): Promise<string> {
  return withRetry(() => callClaudeApi(prompt));
}
