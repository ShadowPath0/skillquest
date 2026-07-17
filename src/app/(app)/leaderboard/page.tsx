import { redirect } from "next/navigation";
import { Crown, Medal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmblem } from "@/lib/character/emblems";
import { cn } from "@/lib/utils";

const RANK_MEDAL_COLOR = ["text-amber-400", "text-slate-300", "text-amber-700"];

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profiles, thresholds] = await Promise.all([
    prisma.profile.findMany({
      orderBy: { xpTotal: "desc" },
      take: 50,
    }),
    prisma.levelThreshold.findMany({ orderBy: { level: "asc" } }),
  ]);

  const titleByLevel = new Map(thresholds.map((t) => [t.level, t.title]));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Classement</h1>
        <p className="text-muted-foreground">Les aventuriers les plus expérimentés de SkillQuest.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top {profiles.length}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {profiles.map((profile, i) => {
            const emblem = getEmblem(profile.avatarEmblem);
            const EmblemIcon = emblem?.icon;
            const isCurrentUser = profile.id === user.id;
            const rank = i + 1;

            return (
              <div
                key={profile.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2",
                  isCurrentUser && "bg-primary/10 ring-1 ring-primary/40"
                )}
              >
                <span className="flex w-8 shrink-0 items-center justify-center font-heading text-sm font-semibold text-muted-foreground">
                  {rank <= 3 ? (
                    <Medal className={cn("size-5", RANK_MEDAL_COLOR[rank - 1])} />
                  ) : (
                    rank
                  )}
                </span>
                {EmblemIcon ? (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <EmblemIcon className="size-4" />
                  </span>
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Crown className="size-4" />
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {profile.displayName}
                    {profile.equippedTitle ? `, ${profile.equippedTitle}` : ""}
                    {isCurrentUser ? " (toi)" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Niveau {profile.currentLevel} · {titleByLevel.get(profile.currentLevel) ?? "Novice"}
                  </span>
                </div>
                <span className="shrink-0 font-heading font-medium text-primary">
                  {profile.xpTotal} XP
                </span>
              </div>
            );
          })}
          {profiles.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Personne n&apos;a encore rejoint l&apos;aventure.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
