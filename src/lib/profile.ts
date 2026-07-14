import { prisma } from "@/lib/prisma";

export async function ensureProfile(
  id: string,
  email: string,
  displayName?: string | null
) {
  return prisma.profile.upsert({
    where: { id },
    update: {},
    create: {
      id,
      email,
      displayName: displayName?.trim() || email.split("@")[0],
    },
  });
}
