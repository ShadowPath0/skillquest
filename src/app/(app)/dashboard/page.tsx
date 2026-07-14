import Link from "next/link";
import { Flame, Trophy, Award, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkillRadarChart } from "@/components/report/skill-radar-chart";
import { XpHistoryChart } from "@/components/dashboard/xp-history-chart";
import { AnimatedXpBar } from "@/components/gamification/animated-xp-bar";
import { AnimatedBadgeList } from "@/components/gamification/animated-badge-list";
import { getMotivationNudge } from "@/lib/agents/motivation-agent";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, thresholds, skillCompetencies, xpEvents, userBadges, activeGoals, programs] =
    await Promise.all([
      prisma.profile.findUnique({ where: { id: user.id } }),
      prisma.levelThreshold.findMany({ orderBy: { level: "asc" } }),
      prisma.skillCompetency.findMany({ where: { userId: user.id } }),
      prisma.xpEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      prisma.userBadge.findMany({ where: { userId: user.id }, include: { badge: true } }),
      prisma.userGoal.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        include: { domain: true, subdomain: true, goalTemplate: true },
      }),
      prisma.weeklyProgram.findMany({ where: { userId: user.id } }),
    ]);

  const programByGoalId = new Map(programs.map((p) => [p.goalId, p]));

  if (!profile) {
    redirect("/domains");
  }

  const currentThreshold = thresholds.find((t) => t.level === profile.currentLevel);
  const nextThreshold = thresholds.find((t) => t.level === profile.currentLevel + 1);
  const levelProgressPct = nextThreshold
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((profile.xpTotal - (currentThreshold?.xpRequired ?? 0)) /
              (nextThreshold.xpRequired - (currentThreshold?.xpRequired ?? 0))) *
              100
          )
        )
      )
    : 100;

  const radarData = skillCompetencies.map((s) => ({ skill: s.skillName, score: Math.round(s.score) }));

  let cumulative = 0;
  const xpByDay = new Map<string, number>();
  for (const event of xpEvents) {
    cumulative += event.amount;
    const day = event.createdAt.toISOString().slice(0, 10);
    xpByDay.set(day, cumulative);
  }
  const xpChartData = Array.from(xpByDay.entries()).map(([date, xp]) => ({ date, xp }));

  const motivationNudge = getMotivationNudge({
    lastActivityAt: profile.lastActivityAt,
    currentStreak: profile.currentStreak,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Bonjour {profile.displayName}
        </h1>
        <p className="text-muted-foreground">
          {currentThreshold?.title ?? "Novice"} · Niveau {profile.currentLevel}
        </p>
      </div>

      {motivationNudge ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center gap-3">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <p className="text-sm">{motivationNudge.message}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Progression</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              {profile.xpTotal} XP
              {nextThreshold ? ` · ${nextThreshold.xpRequired} XP pour le niveau ${nextThreshold.level}` : " · Niveau max atteint"}
            </span>
            <span className="text-muted-foreground">{levelProgressPct}%</span>
          </div>
          <AnimatedXpBar percent={levelProgressPct} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3">
            <Flame className="size-8 text-orange-500" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{profile.currentStreak}</span>
              <span className="text-sm text-muted-foreground">jours de série</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Trophy className="size-8 text-amber-500" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{profile.longestStreak}</span>
              <span className="text-sm text-muted-foreground">meilleure série</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Award className="size-8 text-violet-500" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{userBadges.length}</span>
              <span className="text-sm text-muted-foreground">badges obtenus</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeGoals.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Mes objectifs</h2>
          <div className="flex flex-col gap-2">
            {activeGoals.map((goal) => {
              const program = programByGoalId.get(goal.id);
              return (
                <Card key={goal.id}>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {goal.goalTemplate?.title ?? goal.customTitle}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {goal.domain.name} · {goal.subdomain.name}
                      </span>
                    </div>
                    {program ? (
                      <Button render={<Link href={`/plan/${program.id}`} />} nativeButton={false} size="sm">
                        Mon programme
                      </Button>
                    ) : (
                      <Badge variant="secondary">Actif</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Choisis un domaine pour commencer ton premier diagnostic.
            </p>
            <Button render={<Link href="/domains" />} nativeButton={false} size="sm">
              Choisir un domaine
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>XP gagnée</CardTitle>
        </CardHeader>
        <CardContent>
          <XpHistoryChart data={xpChartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compétences</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillRadarChart data={radarData} />
        </CardContent>
      </Card>

      {userBadges.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedBadgeList names={userBadges.map((ub) => ub.badge.name)} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
