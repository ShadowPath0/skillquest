import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkillRadarChart } from "@/components/report/skill-radar-chart";
import { generateProgram } from "@/lib/plan/actions";
import { CelebrationEffects } from "@/components/gamification/celebration-effects";

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
  EXPERT: "Expert",
};

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ xp?: string; levelUp?: string; badges?: string }>;
}) {
  const { sessionId } = await params;
  const { xp, levelUp, badges } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const report = await prisma.aiReport.findUnique({
    where: { testSessionId: sessionId },
    include: {
      testSession: { include: { goal: { include: { domain: true, subdomain: true, goalTemplate: true } } } },
    },
  });

  if (!report || report.userId !== user.id) {
    notFound();
  }

  const radar = report.radarJson as Record<string, number>;
  const strengths = report.strengthsJson as string[];
  const weaknesses = report.weaknessesJson as string[];
  const goal = report.testSession.goal;

  const radarData = Object.entries(radar).map(([skill, score]) => ({ skill, score }));

  const existingProgram = await prisma.weeklyProgram.findFirst({
    where: { basedOnReportId: report.id },
  });

  const isFinalExam = report.testSession.kind === "FINAL_EXAM";
  const placementReport = isFinalExam
    ? await prisma.aiReport.findFirst({
        where: { userId: user.id, testSession: { goalId: goal.id, kind: "PLACEMENT" } },
        orderBy: { createdAt: "asc" },
      })
    : null;
  const scoreDelta = placementReport ? report.globalScore - placementReport.globalScore : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <CelebrationEffects
        xp={xp ? Number(xp) : null}
        levelUp={levelUp === "1"}
        badgeNames={badges ? badges.split(",") : []}
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">
          {goal.domain.name} · {goal.subdomain.name}
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {goal.goalTemplate?.title ?? goal.customTitle}
        </h1>
      </div>

      {isFinalExam && placementReport ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Progression depuis le test de placement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Placement : {placementReport.globalScore}/100 ({LEVEL_LABELS[placementReport.level] ?? placementReport.level})
              </span>
              <span className="text-muted-foreground">
                Examen final : {report.globalScore}/100 ({LEVEL_LABELS[report.level] ?? report.level})
              </span>
            </div>
            <span
              className={`font-heading text-2xl font-semibold ${
                (scoreDelta ?? 0) >= 0 ? "text-emerald-500" : "text-destructive"
              }`}
            >
              {(scoreDelta ?? 0) >= 0 ? "+" : ""}
              {scoreDelta} points
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Score global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-4xl font-bold">{report.globalScore}</span>
            <span className="text-lg text-muted-foreground">/100</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Niveau</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="text-base">{LEVEL_LABELS[report.level] ?? report.level}</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Radar de compétences</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillRadarChart data={radarData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-emerald-500">Forces</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {strengths.map((s) => (
                <li key={s} className="text-sm">
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Points à travailler</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {weaknesses.map((w) => (
                <li key={w} className="text-sm">
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analyse IA</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{report.explanationMd}</p>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {!isFinalExam &&
          (existingProgram ? (
            <Button
              render={<Link href={`/plan/${existingProgram.id}`} />}
              nativeButton={false}
              size="lg"
            >
              Voir mon programme
            </Button>
          ) : (
            <form action={generateProgram}>
              <input type="hidden" name="reportId" value={report.id} />
              <Button type="submit" size="lg">
                Générer mon programme de 6 semaines
              </Button>
            </form>
          ))}
        <Button render={<Link href="/domains" />} nativeButton={false} size="lg" variant="outline">
          Retour à mes objectifs
        </Button>
      </div>
    </div>
  );
}
