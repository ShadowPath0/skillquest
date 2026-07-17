import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/agents/client";
import { buildCoachContext, buildCoachPrompt } from "@/lib/agents/coach-agent";

export const maxDuration = 60;

const FALLBACK_MESSAGE =
  "Le coach IA n'est pas disponible pour le moment (API Claude non configurée). Réessaie une fois l'API renseignée.";

// Le wrapper VM ne streame pas token par token : on simule un effet de frappe en
// découpant la réponse complète, pour garder le contrat de flux existant côté front.
const SIMULATED_CHUNK_SIZE = 6;
const SIMULATED_CHUNK_DELAY_MS = 20;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const message = String(body.message ?? "").trim();
  const domainId = body.domainId ? String(body.domainId) : null;
  let conversationId = body.conversationId ? String(body.conversationId) : null;

  if (!message) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  if (conversationId) {
    const conversation = await prisma.coachConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } else {
    const conversation = await prisma.coachConversation.create({
      data: { userId: user.id, domainId, title: message.slice(0, 60) },
    });
    conversationId = conversation.id;
  }

  await prisma.coachMessage.create({
    data: { conversationId, role: "USER", content: message },
  });

  const context = await buildCoachContext(user.id, conversationId, domainId);
  const finalConversationId = conversationId;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let full = "";
      try {
        full = (await generateText(buildCoachPrompt(context))).trim();
        if (!full) {
          full = FALLBACK_MESSAGE;
        }
        for (let i = 0; i < full.length; i += SIMULATED_CHUNK_SIZE) {
          controller.enqueue(encoder.encode(full.slice(i, i + SIMULATED_CHUNK_SIZE)));
          await new Promise((resolve) => setTimeout(resolve, SIMULATED_CHUNK_DELAY_MS));
        }
      } catch (err) {
        // Sans ce log, toute panne (mauvaise config, timeout, tunnel indisponible...)
        // affiche le même message générique côté utilisateur, sans aucune trace côté
        // serveur pour distinguer la vraie cause.
        console.error("coach chat: appel IA échoué.", err);
        full = FALLBACK_MESSAGE;
        controller.enqueue(encoder.encode(full));
      } finally {
        await prisma.coachMessage.create({
          data: { conversationId: finalConversationId, role: "ASSISTANT", content: full },
        });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": finalConversationId,
    },
  });
}
