import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startTest } from "@/lib/test/actions";
import { submitFreeformDomain } from "@/lib/goals/actions";
import { QuestPromptForm } from "@/components/quest/quest-prompt-form";
import { getDomainIcon } from "@/lib/domain-icons";
import { SubmitButton } from "@/components/quest/submit-button";
import { DeleteGoalButton } from "@/components/quest/delete-goal-button";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeGoals = user
    ? await prisma.userGoal.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        include: {
          domain: true,
          subdomain: true,
          goalTemplate: true,
          testSessions: { orderBy: { startedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Quelle est ta quête ?
        </h1>
        <p className="text-muted-foreground">
          Décris ce que tu veux apprendre, comme tu le ferais à un mentor. L&apos;Oracle
          façonnera ton domaine, ton objectif et ta première épreuve.
        </p>
      </div>

      {activeGoals.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-medium">Mes quêtes en cours</h2>
          <div className="flex flex-col gap-2">
            {activeGoals.map((goal) => {
              const latestSession = goal.testSessions[0];
              const Icon = getDomainIcon(goal.domain.icon);
              const goalTitle = goal.goalTemplate?.title ?? goal.customTitle ?? "Quête";
              return (
                <Card key={goal.id}>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <div className="flex flex-col">
                        <span className="font-medium">{goalTitle}</span>
                        <span className="text-sm text-muted-foreground">
                          {goal.domain.name} · {goal.subdomain.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {latestSession?.status === "IN_PROGRESS" ? (
                        <Button render={<Link href={`/test/${latestSession.id}`} />} nativeButton={false} size="sm">
                          Reprendre le test
                        </Button>
                      ) : latestSession?.status === "COMPLETED" ? (
                        <Badge variant="secondary">Test terminé</Badge>
                      ) : (
                        <form action={startTest}>
                          <input type="hidden" name="goalId" value={goal.id} />
                          <SubmitButton size="sm" pendingText="Le Grimoire tisse ton épreuve...">
                            Commencer le test
                          </SubmitButton>
                        </form>
                      )}
                      <DeleteGoalButton goalId={goal.id} goalTitle={goalTitle} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <QuestPromptForm action={submitFreeformDomain} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
