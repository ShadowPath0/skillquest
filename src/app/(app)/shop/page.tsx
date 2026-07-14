import { redirect } from "next/navigation";
import { Coins, Lock, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { PREMIUM_EMBLEMS } from "@/lib/character/emblems";
import { unlockEmblem } from "@/lib/character/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; unlocked?: string }>;
}) {
  const { error, unlocked } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUniqueOrThrow({ where: { id: user.id } });
  const unlockedSet = new Set(profile.unlockedEmblems);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Boutique</h1>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Coins className="size-4 text-primary" />
          {profile.coins} pièces
        </p>
      </div>

      {unlocked ? (
        <p className="text-sm text-emerald-500">Emblème débloqué !</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PREMIUM_EMBLEMS.map((emblem) => {
          const Icon = emblem.icon;
          const isUnlocked = unlockedSet.has(emblem.key);
          const canAfford = profile.coins >= (emblem.cost ?? 0);
          return (
            <Card key={emblem.key}>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-medium">{emblem.label}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Coins className="size-3.5" />
                      {emblem.cost}
                    </span>
                  </div>
                </div>
                {isUnlocked ? (
                  <span className="flex items-center gap-1 text-sm font-medium text-emerald-500">
                    <CheckCircle2 className="size-4" />
                    Débloqué
                  </span>
                ) : (
                  <form action={unlockEmblem}>
                    <input type="hidden" name="emblemKey" value={emblem.key} />
                    <Button type="submit" size="sm" disabled={!canAfford}>
                      {canAfford ? "Débloquer" : <Lock className="size-4" />}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
