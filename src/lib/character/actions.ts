"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getEmblem } from "@/lib/character/emblems";

export async function createCharacter(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const heroName = String(formData.get("heroName") ?? "").trim();
  const avatarEmblem = String(formData.get("avatarEmblem") ?? "");
  const emblem = getEmblem(avatarEmblem);

  if (!heroName || !emblem) {
    redirect("/character?error=1");
  }

  if (emblem.cost) {
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile?.unlockedEmblems.includes(avatarEmblem)) {
      redirect("/character?error=1");
    }
  }

  await prisma.profile.update({
    where: { id: user.id },
    data: { displayName: heroName, avatarEmblem },
  });

  redirect("/domains");
}

export async function unlockEmblem(formData: FormData) {
  const key = String(formData.get("emblemKey") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const emblem = getEmblem(key);
  if (!emblem || !emblem.cost) {
    redirect("/shop");
  }

  const profile = await prisma.profile.findUniqueOrThrow({ where: { id: user.id } });

  if (profile.unlockedEmblems.includes(key)) {
    redirect("/shop");
  }

  if (profile.coins < emblem.cost) {
    redirect(`/shop?error=${encodeURIComponent("Pas assez de pièces.")}`);
  }

  await prisma.profile.update({
    where: { id: user.id },
    data: {
      coins: { decrement: emblem.cost },
      unlockedEmblems: { push: key },
    },
  });

  redirect("/shop?unlocked=1");
}

export async function equipTitle(formData: FormData) {
  const title = String(formData.get("title") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUniqueOrThrow({ where: { id: user.id } });

  if (title && !profile.unlockedTitles.includes(title)) {
    redirect("/character?error=1");
  }

  await prisma.profile.update({
    where: { id: user.id },
    data: { equippedTitle: title || null },
  });

  redirect("/character");
}
