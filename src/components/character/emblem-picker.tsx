"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { EMBLEMS, PREMIUM_EMBLEMS } from "@/lib/character/emblems";
import { cn } from "@/lib/utils";

export function EmblemPicker({
  defaultValue,
  unlockedPremiumKeys = [],
}: {
  defaultValue?: string;
  unlockedPremiumKeys?: string[];
}) {
  const [selected, setSelected] = useState(defaultValue ?? EMBLEMS[0].key);
  const unlockedSet = new Set(unlockedPremiumKeys);
  const allEmblems = [...EMBLEMS, ...PREMIUM_EMBLEMS];

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="avatarEmblem" value={selected} />
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {allEmblems.map((emblem) => {
          const Icon = emblem.icon;
          const isSelected = selected === emblem.key;
          const isLocked = Boolean(emblem.cost) && !unlockedSet.has(emblem.key);
          return (
            <button
              key={emblem.key}
              type="button"
              disabled={isLocked}
              onClick={() => setSelected(emblem.key)}
              title={isLocked ? `${emblem.label} (verrouillé, ${emblem.cost} pièces)` : emblem.label}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 bg-card transition-colors",
                isLocked
                  ? "cursor-not-allowed border-border text-muted-foreground/40"
                  : isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {isLocked ? (
                <Lock className="absolute top-1 right-1 size-3" />
              ) : null}
              <Icon className="size-6" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
