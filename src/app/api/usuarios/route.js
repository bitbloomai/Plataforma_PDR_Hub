import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function currentUsuario() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Nao autenticado.", status: 401 };
  }

  const { data: usuario, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("id, conta_id, auth_user_id, nome, email, ativo")
    .eq("auth_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();

  if (usuarioError) throw usuarioError;
  if (!usuario) {
    return { error: "Usuario autenticado sem cadastro ativo.", status: 403 };
  }

  return { usuario };
}

async function logAudit({ usuario, acao, registroId, descricao, before, after }) {
  await supabaseAdmin.from("auditoria").insert({
    conta_id: usuario.conta_id,
    usuario_id: usuario.id,
    entidade: "usuarios",
    acao,
    registro_id: registroId || null,
    descricao,
    dados_anteriores: before || null,
    dados_novos: after || null,
  });
}

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  try {
    const current = await currentUsuario();
    if (current.error) return jsonError(current.error, current.status);

    const body = await request.json();
    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const ativo = body.ativo !== false;

    if (!nome || !email || password.length < 6) {
      return jsonError("Informe nome, email e uma senha com pelo menos 6 caracteres.", 400);
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          conta_id: current.usuario.conta_id,
        },
      });

    if (authError) {
      return jsonError(authError.message || "Nao foi possivel criar o acesso.", 400);
    }

    const payload = {
      conta_id: current.usuario.conta_id,
      auth_user_id: authData.user.id,
      nome,
      email,
      ativo,
    };

    const { data: usuario, error: insertError } = await supabaseAdmin
      .from("usuarios")
      .insert(payload)
      .select("id, conta_id, auth_user_id, nome, email, foto_url, ativo, ultimo_acesso, created_at")
      .single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw insertError;
    }

    await logAudit({
      usuario: current.usuario,
      acao: "criar",
      registroId: usuario.id,
      descricao: `Usuario ${nome} criado.`,
      after: usuario,
    });

    return NextResponse.json({ usuario }, { status: 201 });
  } catch (error) {
    console.error("POST /api/usuarios", error);
    return jsonError("Nao foi possivel criar o usuario.", 500);
  }
}

export async function PATCH(request) {
  try {
    const current = await currentUsuario();
    if (current.error) return jsonError(current.error, current.status);

    const body = await request.json();
    const id = String(body.id || "");
    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const ativo = body.ativo !== false;

    if (!id || !nome || !email) {
      return jsonError("Informe id, nome e email.", 400);
    }

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("usuarios")
      .select("id, conta_id, auth_user_id, nome, email, foto_url, ativo, ultimo_acesso, created_at")
      .eq("id", id)
      .eq("conta_id", current.usuario.conta_id)
      .maybeSingle();

    if (beforeError) throw beforeError;
    if (!before) return jsonError("Usuario nao encontrado.", 404);

    if (id !== current.usuario.id) {
      return jsonError("Voce so pode editar o seu proprio usuario.", 403);
    }

    if (before.email !== email) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        before.auth_user_id,
        {
          email,
          email_confirm: true,
          user_metadata: {
            nome,
            conta_id: current.usuario.conta_id,
          },
        }
      );

      if (authError) {
        return jsonError(authError.message || "Nao foi possivel atualizar o acesso.", 400);
      }
    }

    const { data: usuario, error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({
        nome,
        email,
        ativo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("conta_id", current.usuario.conta_id)
      .select("id, conta_id, auth_user_id, nome, email, foto_url, ativo, ultimo_acesso, created_at")
      .single();

    if (updateError) throw updateError;

    await logAudit({
      usuario: current.usuario,
      acao: "atualizar",
      registroId: id,
      descricao: `Usuario ${nome} atualizado.`,
      before,
      after: usuario,
    });

    return NextResponse.json({ usuario });
  } catch (error) {
    console.error("PATCH /api/usuarios", error);
    return jsonError("Nao foi possivel atualizar o usuario.", 500);
  }
}

export async function DELETE(request) {
  try {
    const current = await currentUsuario();
    if (current.error) return jsonError(current.error, current.status);

    const { id } = await request.json();
    if (!id) return jsonError("Informe o usuario.", 400);
    if (id !== current.usuario.id) {
      return jsonError("Voce so pode desativar o seu proprio usuario.", 403);
    }

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("usuarios")
      .select("id, conta_id, auth_user_id, nome, email, foto_url, ativo, ultimo_acesso, created_at")
      .eq("id", id)
      .eq("conta_id", current.usuario.conta_id)
      .maybeSingle();

    if (beforeError) throw beforeError;
    if (!before) return jsonError("Usuario nao encontrado.", 404);

    const { data: usuario, error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("conta_id", current.usuario.conta_id)
      .select("id, conta_id, auth_user_id, nome, email, foto_url, ativo, ultimo_acesso, created_at")
      .single();

    if (updateError) throw updateError;

    await logAudit({
      usuario: current.usuario,
      acao: "desativar",
      registroId: id,
      descricao: `Usuario ${before.nome} desativado.`,
      before,
      after: usuario,
    });

    return NextResponse.json({ usuario });
  } catch (error) {
    console.error("DELETE /api/usuarios", error);
    return jsonError("Nao foi possivel desativar o usuario.", 500);
  }
}
