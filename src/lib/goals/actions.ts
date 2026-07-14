"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { generateDomainFromPrompt } from "@/lib/agents/domain-agent";

export async function submitFreeformDomain(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!prompt) {
    redirect(`/domains?error=${encodeURIComponent("Décris ce que tu veux apprendre.")}`);
  }

  const generated = await generateDomainFromPrompt(prompt);

  const domain = await prisma.domain.upsert({
    where: { slug: generated.domainSlug },
    update: {},
    create: {
      slug: generated.domainSlug,
      name: generated.domainName,
      description: generated.domainDescription,
      icon: generated.domainIcon,
      color: "gold",
    },
  });

  const subdomain = await prisma.subdomain.upsert({
    where: {
      domainId_slug: { domainId: domain.id, slug: generated.subdomainSlug },
    },
    update: {},
    create: {
      domainId: domain.id,
      slug: generated.subdomainSlug,
      name: generated.subdomainName,
    },
  });

  await prisma.userGoal.create({
    data: {
      userId: user.id,
      domainId: domain.id,
      subdomainId: subdomain.id,
      customTitle: generated.goalTitle,
    },
  });

  revalidatePath("/domains");
  redirect("/domains");
}

export async function deleteGoal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const goalId = String(formData.get("goalId") ?? "");
  const goal = await prisma.userGoal.findUnique({ where: { id: goalId } });

  if (!goal || goal.userId !== user.id) {
    redirect("/domains");
  }

  // WeeklyProgram references AiReport (via basedOnReportId), and AiReport cascades
  // from TestSession — programs must go first or the AiReport delete would violate
  // that foreign key.
  await prisma.$transaction([
    prisma.weeklyProgram.deleteMany({ where: { goalId } }),
    prisma.testSession.deleteMany({ where: { goalId } }),
    prisma.userGoal.delete({ where: { id: goalId } }),
  ]);

  revalidatePath("/domains");
  revalidatePath("/dashboard");
  redirect("/domains");
}
