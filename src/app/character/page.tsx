import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createCharacter, equipTitle } from "@/lib/character/actions";
import { EmblemPicker } from "@/components/character/emblem-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CharacterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });

  const unlockedTitles = profile?.unlockedTitles ?? [];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Crée ton personnage</CardTitle>
          <CardDescription>
            Choisis ton nom de héros et ton emblème avant de partir à l&apos;aventure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCharacter} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="heroName">Nom de héros</Label>
              <Input
                id="heroName"
                name="heroName"
                defaultValue={profile?.displayName}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Emblème</Label>
                <Link href="/shop" className="text-xs text-muted-foreground underline underline-offset-4">
                  Boutique ({profile?.coins ?? 0} pièces)
                </Link>
              </div>
              <EmblemPicker
                defaultValue={profile?.avatarEmblem ?? undefined}
                unlockedPremiumKeys={profile?.unlockedEmblems ?? []}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">
                Choisis un nom et un emblème pour continuer.
              </p>
            ) : null}
            <Button type="submit" size="lg">
              Commencer l&apos;aventure
            </Button>
          </form>
        </CardContent>
      </Card>

      {unlockedTitles.length > 0 ? (
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-lg">Titres</CardTitle>
            <CardDescription>
              Choisis le titre affiché à côté de ton nom.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <form action={equipTitle}>
                <input type="hidden" name="title" value="" />
                <Button
                  type="submit"
                  variant={!profile?.equippedTitle ? "default" : "outline"}
                  size="sm"
                >
                  Aucun titre
                </Button>
              </form>
              {unlockedTitles.map((title) => (
                <form action={equipTitle} key={title}>
                  <input type="hidden" name="title" value={title} />
                  <Button
                    type="submit"
                    variant={profile?.equippedTitle === title ? "default" : "outline"}
                    size="sm"
                  >
                    {title}
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
