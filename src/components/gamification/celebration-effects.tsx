"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export function CelebrationEffects({
  xp,
  levelUp,
  badgeNames,
}: {
  xp: number | null;
  levelUp: boolean;
  badgeNames: string[];
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (xp) {
      toast.success(`+${xp} XP`);
    }

    if (levelUp) {
      toast("Niveau supérieur !", {
        description: "Continue comme ça, ta progression s'accélère.",
      });
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    }

    for (const name of badgeNames) {
      toast(`Badge débloqué : ${name}`);
    }

    if (!levelUp && badgeNames.length > 0) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    }
  }, [xp, levelUp, badgeNames]);

  return null;
}
