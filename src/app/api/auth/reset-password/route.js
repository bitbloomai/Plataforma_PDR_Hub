import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const { password } = await request.json();

  if (!password || String(password).length < 8) {
    return NextResponse.json(
      { error: "A nova senha deve ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "A sessao de recuperacao expirou. Solicite um novo link." },
      { status: 401 }
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.json(
      { error: "Nao foi possivel atualizar a senha." },
      { status: 400 }
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({ redirectTo: "/login" });
}

