"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

const RPG_COLORS = ["#d4a537", "#f0c869", "#2f855a", "#b5651d", "#8b2635"];

function fireLevelUpBurst() {
  const duration = 1200;
  const end = Date.now() + duration;
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 65,
      origin: { x: 0, y: 0.65 },
      colors: RPG_COLORS,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 65,
      origin: { x: 1, y: 0.65 },
      colors: RPG_COLORS,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({
    particleCount: 160,
    spread: 100,
    startVelocity: 45,
    origin: { y: 0.55 },
    colors: RPG_COLORS,
  });
}

function fireBadgeBurst() {
  confetti({
    particleCount: 60,
    spread: 50,
    startVelocity: 30,
    scalar: 0.8,
    origin: { y: 0.6 },
    colors: RPG_COLORS,
    shapes: ["star"],
  });
}

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
      toast("⚔️ Niveau supérieur !", {
        description: "Ta légende s'écrit un peu plus à chaque épreuve.",
        duration: 5000,
      });
      fireLevelUpBurst();
    }

    badgeNames.forEach((name, i) => {
      setTimeout(() => {
        toast(`🏆 Badge débloqué : ${name}`, { duration: 4500 });
        fireBadgeBurst();
      }, levelUp ? 500 + i * 400 : i * 400);
    });
  }, [xp, levelUp, badgeNames]);

  return null;
}
