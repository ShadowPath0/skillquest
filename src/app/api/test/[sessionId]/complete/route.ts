import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { completeTestSession } from "@/lib/test/complete";
import { buildCelebrationParams } from "@/lib/gamification/celebration-params";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await prisma.testSession.findUnique({ where: { id: sessionId } });

  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (session.status === "IN_PROGRESS") {
    const result = await completeTestSession(sessionId, user.id);
    const query = buildCelebrationParams(result);
    return NextResponse.json({ redirectTo: `/report/${sessionId}?${query}` });
  }

  return NextResponse.json({ redirectTo: `/report/${sessionId}` });
}
