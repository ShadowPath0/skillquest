"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { postAuthRedirectPath } from "@/lib/auth/redirect";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    await ensureProfile(
      data.user.id,
      data.user.email ?? email,
      data.user.user_metadata?.display_name
    );
  }

  revalidatePath("/", "layout");
  redirect(data.user ? await postAuthRedirectPath(data.user.id) : "/domains");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "");

  const headersList = await headers();
  const origin = headersList.get("origin");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    await ensureProfile(data.user.id, data.user.email ?? email, displayName);
  }

  revalidatePath("/", "layout");

  if (data.session && data.user) {
    // Email confirmation disabled on this Supabase project: already logged in.
    redirect(await postAuthRedirectPath(data.user.id));
  }

  redirect("/signup?checkEmail=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
