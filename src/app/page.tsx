import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
          SkillQuest
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Forge ton personnage, choisis ta quête, et transforme la montée en
          compétences en véritable aventure.
        </p>
      </div>
      <div className="flex gap-3">
        {user ? (
          <Button render={<Link href="/domains" />} nativeButton={false} size="lg">
            Continuer l&apos;aventure
          </Button>
        ) : (
          <>
            <Button render={<Link href="/signup" />} nativeButton={false} size="lg">
              Commencer
            </Button>
            <Button
              render={<Link href="/login" />}
              nativeButton={false}
              size="lg"
              variant="outline"
            >
              Se connecter
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
