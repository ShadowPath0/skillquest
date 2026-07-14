import {
  Sword,
  Shield,
  Wand2,
  ScrollText,
  Crown,
  Flame,
  Gem,
  Compass,
  Feather,
  Anvil,
  Moon,
  Sun,
  Skull,
  Sparkles,
  Castle,
  Swords,
  Trophy,
  Key,
  Hammer,
  Telescope,
  type LucideIcon,
} from "lucide-react";

export type Emblem = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Coin cost to unlock. Undefined = free, available at character creation. */
  cost?: number;
};

export const EMBLEMS: Emblem[] = [
  { key: "sword", label: "Épée", icon: Sword },
  { key: "shield", label: "Bouclier", icon: Shield },
  { key: "wand", label: "Baguette", icon: Wand2 },
  { key: "scroll", label: "Parchemin", icon: ScrollText },
  { key: "crown", label: "Couronne", icon: Crown },
  { key: "flame", label: "Flamme", icon: Flame },
  { key: "gem", label: "Gemme", icon: Gem },
  { key: "compass", label: "Boussole", icon: Compass },
  { key: "feather", label: "Plume", icon: Feather },
  { key: "anvil", label: "Enclume", icon: Anvil },
  { key: "moon", label: "Lune", icon: Moon },
  { key: "sun", label: "Soleil", icon: Sun },
  { key: "skull", label: "Crâne", icon: Skull },
  { key: "sparkles", label: "Étincelles", icon: Sparkles },
];

export const PREMIUM_EMBLEMS: Emblem[] = [
  { key: "castle", label: "Château", icon: Castle, cost: 200 },
  { key: "swords", label: "Épées croisées", icon: Swords, cost: 250 },
  { key: "trophy", label: "Trophée", icon: Trophy, cost: 300 },
  { key: "key", label: "Clé ancienne", icon: Key, cost: 200 },
  { key: "hammer", label: "Marteau", icon: Hammer, cost: 250 },
  { key: "telescope", label: "Télescope", icon: Telescope, cost: 350 },
];

export const ALL_EMBLEMS: Emblem[] = [...EMBLEMS, ...PREMIUM_EMBLEMS];

export function getEmblem(key: string | null | undefined): Emblem | undefined {
  return ALL_EMBLEMS.find((e) => e.key === key);
}
