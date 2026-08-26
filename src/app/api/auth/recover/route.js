import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const { email } = await request.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return NextResponse.json(
      { error: "Informe o e-mail da conta." },
      { status: 400 }
    );
  }

  const requestUrl = new URL(request.url);
  const redirectTo = new URL("/api/auth/callback", requestUrl.origin);
  redirectTo.searchParams.set("next", "/redefinir-senha");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: redirectTo.toString(),
  });

  if (error) {
    return NextResponse.json(
      { error: "Nao foi possivel enviar o e-mail de recuperacao." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: "Se o e-mail existir, voce recebera um link em instantes.",
  });
}

