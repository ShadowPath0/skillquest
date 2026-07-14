import { prisma } from "@/lib/prisma";

export async function awardXp(
  userId: string,
  amount: number,
  reason: string,
  sourceType: string,
  sourceId?: string
) {
  await prisma.xpEvent.create({
    data: { userId, amount, reason, sourceType, sourceId },
  });

  const coinsEarned = Math.max(1, Math.round(amount / 5));

  const profile = await prisma.profile.update({
    where: { id: userId },
    data: { xpTotal: { increment: amount }, coins: { increment: coinsEarned } },
  });

  const newLevel = await computeLevelForXp(profile.xpTotal);
  const leveledUp = newLevel !== profile.currentLevel;

  if (leveledUp) {
    const crystalsEarned = newLevel - profile.currentLevel;
    await prisma.profile.update({
      where: { id: userId },
      data: { currentLevel: newLevel, crystals: { increment: crystalsEarned } },
    });
  }

  return { xpTotal: profile.xpTotal, level: newLevel, leveledUp };
}

async function computeLevelForXp(xp: number) {
  const thresholds = await prisma.levelThreshold.findMany({ orderBy: { level: "asc" } });
  let level = 1;
  for (const t of thresholds) {
    if (xp >= t.xpRequired) level = t.level;
    else break;
  }
  return level;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function touchStreak(userId: string) {
  const profile = await prisma.profile.findUniqueOrThrow({ where: { id: userId } });
  const today = startOfDay(new Date());
  const last = profile.lastActivityAt ? startOfDay(profile.lastActivityAt) : null;

  let currentStreak = profile.currentStreak;
  if (!last) {
    currentStreak = 1;
  } else {
    const diffDays = Math.round((today.getTime() - last.getTime()) / 86_400_000);
    if (diffDays === 1) currentStreak += 1;
    else if (diffDays > 1) currentStreak = 1;
    // diffDays === 0: already counted today, leave as-is.
  }

  const longestStreak = Math.max(profile.longestStreak, currentStreak);

  await prisma.profile.update({
    where: { id: userId },
    data: { currentStreak, longestStreak, lastActivityAt: new Date() },
  });

  return currentStreak;
}
