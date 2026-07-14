import {
  Code2,
  Languages,
  Table,
  Users,
  FlaskConical,
  Palette,
  HeartPulse,
  Leaf,
  Music,
  Briefcase,
  ChefHat,
  Scale,
  Calculator,
  BookOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const DOMAIN_ICON_KEYS = [
  "code",
  "languages",
  "table",
  "users",
  "flask",
  "palette",
  "heart",
  "leaf",
  "music",
  "briefcase",
  "chef-hat",
  "scale",
  "calculator",
  "book",
  "sparkles",
] as const;

export type DomainIconKey = (typeof DOMAIN_ICON_KEYS)[number];

export const DOMAIN_ICONS: Record<DomainIconKey, LucideIcon> = {
  code: Code2,
  languages: Languages,
  table: Table,
  users: Users,
  flask: FlaskConical,
  palette: Palette,
  heart: HeartPulse,
  leaf: Leaf,
  music: Music,
  briefcase: Briefcase,
  "chef-hat": ChefHat,
  scale: Scale,
  calculator: Calculator,
  book: BookOpen,
  sparkles: Sparkles,
};

export function getDomainIcon(key: string | null | undefined): LucideIcon {
  return DOMAIN_ICONS[key as DomainIconKey] ?? Sparkles;
}
