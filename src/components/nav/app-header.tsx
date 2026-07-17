import Link from "next/link";
import { Flame, Coins, Gem, Store, Crown } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { getEmblem } from "@/lib/character/emblems";

export function AppHeader({
  profile,
}: {
  profile: {
    displayName: string;
    avatarEmblem: string | null;
    equippedTitle?: string | null;
    currentLevel: number;
    xpTotal: number;
    currentStreak: number;
    coins: number;
    crystals: number;
  } | null;
}) {
  const emblem = getEmblem(profile?.avatarEmblem);
  const EmblemIcon = emblem?.icon;

  return (
    <header className="flex items-center justify-between border-b border-primary/25 bg-gradient-to-b from-card to-background px-6 py-3">
      <div className="flex items-center gap-6">
        <Link
          href="/dashboard"
          className="font-heading text-lg font-semibold tracking-wide text-primary"
        >
          SkillQuest
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/domains" className="text-muted-foreground hover:text-foreground">
            Quête
          </Link>
          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Store className="size-4" />
            Boutique
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Crown className="size-4" />
            Classement
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {profile ? (
          <div className="flex items-center gap-3 rounded-full border border-primary/30 bg-muted/60 px-3 py-1 text-sm">
            {EmblemIcon ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                <EmblemIcon className="size-3.5" />
              </span>
            ) : null}
            <span className="font-medium">
              {profile.displayName}
              {profile.equippedTitle ? `, ${profile.equippedTitle}` : ""}
            </span>
            <span className="font-heading font-medium text-primary">
              Niv. {profile.currentLevel}
            </span>
            <span className="text-muted-foreground">{profile.xpTotal} XP</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Flame className="size-4 text-accent-foreground" />
              {profile.currentStreak}
            </span>
            <Link
              href="/shop"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              title="Pièces — ouvrir la boutique"
            >
              <Coins className="size-4" />
              {profile.coins}
            </Link>
            <span className="flex items-center gap-1 text-muted-foreground" title="Cristaux">
              <Gem className="size-4" />
              {profile.crystals}
            </span>
          </div>
        ) : null}
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Déconnexion
          </Button>
        </form>
      </div>
    </header>
  );
}
