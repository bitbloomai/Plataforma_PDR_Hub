import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_REDIRECT = "/panel";

export async function POST(request) {
  const { nome, contaNome, email, password } = await request.json();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const userName = String(nome || "").trim();
  const accountName = String(contaNome || "").trim();

  if (!userName || !accountName || !normalizedEmail || !password) {
    return NextResponse.json(
      { error: "Preencha todos os campos obrigatorios." },
      { status: 400 }
    );
  }

  if (String(password).length < 8) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        nome: userName,
        conta_nome: accountName,
        papel: "admin",
      },
    });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || "Nao foi possivel criar o usuario." },
      { status: 400 }
    );
  }

  const authUserId = authData.user.id;

  try {
    const { data: conta, error: contaError } = await supabaseAdmin
      .from("contas")
      .insert({
        nome: accountName,
        nome_fantasia: accountName,
        email: normalizedEmail,
      })
      .select("id")
      .single();

    if (contaError) {
      throw contaError;
    }

    const { error: usuarioError } = await supabaseAdmin.from("usuarios").insert({
      conta_id: conta.id,
      auth_user_id: authUserId,
      nome: userName,
      email: normalizedEmail,
      ultimo_acesso: new Date().toISOString(),
    });

    if (usuarioError) {
      throw usuarioError;
    }

    const { error: configuracoesError } = await supabaseAdmin
      .from("configuracoes")
      .insert({
        conta_id: conta.id,
        nome_sistema: accountName,
      });

    if (configuracoesError) {
      throw configuracoesError;
    }
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    return NextResponse.json(
      { error: error.message || "Nao foi possivel preparar a conta." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (signInError) {
    return NextResponse.json({ redirectTo: "/login" });
  }

  return NextResponse.json({ redirectTo: DEFAULT_REDIRECT });
}
