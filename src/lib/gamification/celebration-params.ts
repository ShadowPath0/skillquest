export function buildCelebrationParams(result: {
  xpEarned: number;
  leveledUp: boolean;
  newBadges: { name: string }[];
}) {
  const params = new URLSearchParams();
  params.set("xp", String(result.xpEarned));
  if (result.leveledUp) params.set("levelUp", "1");
  if (result.newBadges.length) {
    params.set("badges", result.newBadges.map((b) => b.name).join(","));
  }
  return params.toString();
}
