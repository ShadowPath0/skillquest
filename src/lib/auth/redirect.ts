import { prisma } from "@/lib/prisma";

export async function postAuthRedirectPath(userId: string): Promise<string> {
  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  if (!profile?.avatarEmblem) {
    return "/character";
  }

  const hasActivity = await prisma.xpEvent.findFirst({ where: { userId } });
  return hasActivity ? "/dashboard" : "/domains";
}
