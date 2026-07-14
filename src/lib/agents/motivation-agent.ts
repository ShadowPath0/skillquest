export type MotivationNudge = {
  message: string;
  tone: "warning" | "info";
};

const STREAK_RISK_MESSAGES = [
  "Ta série est en jeu ! Reviens aujourd'hui pour ne pas la perdre.",
  "Un pas de plus aujourd'hui et ta série continue de grandir.",
  "Ne laisse pas ta flamme s'éteindre — une petite mission suffit pour la sauver.",
];

const INACTIVITY_MESSAGES = [
  "Ton aventure t'attend ! Reviens poursuivre ta quête.",
  "Ça fait un moment... ton personnage a hâte de progresser à nouveau.",
  "Une pause, c'est bien, mais ta quête n'avance pas sans toi.",
];

function pick(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getMotivationNudge(profile: {
  lastActivityAt: Date | null;
  currentStreak: number;
}): MotivationNudge | null {
  if (!profile.lastActivityAt) return null;

  const daysSince = Math.round(
    (startOfDay(new Date()) - startOfDay(profile.lastActivityAt)) / 86_400_000
  );

  if (daysSince >= 4) {
    return { message: pick(INACTIVITY_MESSAGES), tone: "warning" };
  }

  if (daysSince === 1 && profile.currentStreak > 0) {
    return { message: pick(STREAK_RISK_MESSAGES), tone: "warning" };
  }

  return null;
}
