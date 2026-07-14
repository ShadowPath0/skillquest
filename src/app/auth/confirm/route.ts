import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { postAuthRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const explicitNext = searchParams.get("next");

  if (token_hash && type) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error && data.user) {
      await ensureProfile(
        data.user.id,
        data.user.email ?? "",
        data.user.user_metadata?.display_name
      );
      const next = explicitNext ?? (await postAuthRedirectPath(data.user.id));
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/error`);
}
