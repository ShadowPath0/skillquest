import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/nav/app-header";
import { CoachWidget } from "@/components/coach/coach-widget";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });

  if (!profile?.avatarEmblem) {
    redirect("/character");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader profile={profile} />
      <main className="flex-1">{children}</main>
      <CoachWidget />
    </div>
  );
}
