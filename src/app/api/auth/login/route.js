import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const DEFAULT_REDIRECT = "/panel";

export async function POST(request) {
  const { email, password, next } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Informe e-mail e senha." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: "Credenciais invalidas." },
      { status: 401 }
    );
  }

  return NextResponse.json({ redirectTo: sanitizeRedirect(next) });
}

function sanitizeRedirect(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  return value;
}

