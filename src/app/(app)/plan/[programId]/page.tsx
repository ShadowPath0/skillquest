import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { completeMission } from "@/lib/plan/actions";
import { startFinalExam } from "@/lib/test/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CelebrationEffects } from "@/components/gamification/celebration-effects";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ xp?: string; levelUp?: string; badges?: string }>;
}) {
  const { programId } = await params;
  const { xp, levelUp, badges } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const program = await prisma.weeklyProgram.findUnique({
    where: { id: programId },
    include: {
      goal: { include: { domain: true, subdomain: true, goalTemplate: true } },
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: { missions: { orderBy: { dayNumber: "asc" } } },
      },
    },
  });

  if (!program || program.userId !== user.id) {
    notFound();
  }

  const resources = await prisma.resource.findMany({
    where: { domainId: program.goal.domainId },
  });
  const resourcesBySkill = new Map(resources.map((r) => [r.skillTag, r]));

  const finalExamSession =
    program.status === "COMPLETED"
      ? await prisma.testSession.findFirst({
          where: { goalId: program.goalId, kind: "FINAL_EXAM" },
          orderBy: { startedAt: "desc" },
        })
      : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <CelebrationEffects
        xp={xp ? Number(xp) : null}
        levelUp={levelUp === "1"}
        badgeNames={badges ? badges.split(",") : []}
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">
          {program.goal.domain.name} · {program.goal.subdomain.name}
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Programme : {program.goal.goalTemplate?.title ?? program.goal.customTitle}
        </h1>
      </div>

      {program.status === "COMPLETED" ? (
        <Card className="border-primary/40">
          <CardContent className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="size-8 text-primary" />
              <div className="flex flex-col">
                <span className="font-heading font-medium">Programme terminé !</span>
                <span className="text-sm text-muted-foreground">
                  Mesure ta progression avec l&apos;examen final.
                </span>
              </div>
            </div>
            {!finalExamSession ? (
              <form action={startFinalExam}>
                <input type="hidden" name="programId" value={program.id} />
                <Button type="submit">Passer l&apos;examen final</Button>
              </form>
            ) : finalExamSession.status === "IN_PROGRESS" ? (
              <Button render={<Link href={`/test/${finalExamSession.id}`} />} nativeButton={false}>
                Reprendre l&apos;examen
              </Button>
            ) : (
              <Button render={<Link href={`/report/${finalExamSession.id}`} />} nativeButton={false}>
                Voir mon résultat
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="1">
        <TabsList>
          {program.weeks.map((week) => (
            <TabsTrigger key={week.id} value={String(week.weekNumber)}>
              Semaine {week.weekNumber}
            </TabsTrigger>
          ))}
        </TabsList>

        {program.weeks.map((week) => {
          const objectives = week.objectivesJson as string[];
          const skills = week.skillsJson as string[];
          const weekResources = skills
            .map((s) => resourcesBySkill.get(s))
            .filter((r): r is NonNullable<typeof r> => Boolean(r));

          return (
            <TabsContent key={week.id} value={String(week.weekNumber)} className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Semaine {week.weekNumber}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {objectives.map((o) => (
                      <li key={o} className="text-sm text-muted-foreground">
                        · {o}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {week.estimatedHours}h estimées · difficulté {week.difficulty.toFixed(1)}/5
                    </span>
                    <span>{week.progressPct}%</span>
                  </div>
                  <Progress value={week.progressPct} />
                </CardContent>
              </Card>

              {weekResources.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Ressources</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {weekResources.map((resource) => (
                      <div key={resource.id} className="flex flex-col gap-1">
                        <span className="font-medium">{resource.title}</span>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {resource.contentMd}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex flex-col gap-3">
                {week.missions.map((mission) => {
                  const tasks = mission.tasksJson as string[];
                  const isDone = mission.status === "completed";
                  return (
                    <Card key={mission.id}>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              {DAY_LABELS[mission.dayNumber - 1] ?? `Jour ${mission.dayNumber}`}
                            </span>
                            <span className="font-medium">{mission.title}</span>
                            <span className="text-sm text-muted-foreground">
                              {mission.description}
                            </span>
                          </div>
                          <Badge variant="secondary">+{mission.xpReward} XP</Badge>
                        </div>
                        <ul className="flex flex-col gap-1">
                          {tasks.map((t) => (
                            <li key={t} className="text-sm text-muted-foreground">
                              · {t}
                            </li>
                          ))}
                        </ul>
                        {isDone ? (
                          <span className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                            <CheckCircle2 className="size-4" />
                            Mission terminée
                          </span>
                        ) : (
                          <form action={completeMission}>
                            <input type="hidden" name="missionId" value={mission.id} />
                            <input type="hidden" name="programId" value={program.id} />
                            <Button type="submit" size="sm">
                              Marquer comme fait
                            </Button>
                          </form>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
