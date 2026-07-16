import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { PollUntilReady } from "@/components/shared/poll-until-ready";

export default async function PlanPendingPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const report = await prisma.aiReport.findUnique({ where: { id: reportId } });
  if (!report || report.userId !== user.id) {
    notFound();
  }

  const program = await prisma.weeklyProgram.findFirst({
    where: { basedOnReportId: reportId },
  });

  if (program) {
    redirect(`/plan/${program.id}`);
  }

  return <PollUntilReady message="Le Planificateur prépare ton programme de 6 semaines..." />;
}
