import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export class RobertoError extends Error {
  constructor(message, status = 400, code = "ROBERTO_ERROR") {
    super(message);
    this.name = "RobertoError";
    this.status = status;
    this.code = code;
  }
}

export async function getRobertoContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new RobertoError("Não autenticado.", 401, "UNAUTHENTICATED");
  }

  const { data: usuario, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("id,conta_id,auth_user_id,nome,email,ativo")
    .eq("auth_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();

  if (usuarioError) throw usuarioError;
  if (!usuario) {
    throw new RobertoError(
      "Usuário autenticado sem cadastro ativo na plataforma.",
      403,
      "INACTIVE_USER"
    );
  }

  const [{ data: conta, error: contaError }, { data: configuracao, error: configError }] =
    await Promise.all([
      supabaseAdmin
        .from("contas")
        .select("id,nome,nome_fantasia,ativo")
        .eq("id", usuario.conta_id)
        .maybeSingle(),
      supabaseAdmin
        .from("configuracoes")
        .select("moeda,locale,timezone,formato_data,nome_sistema,dias_vencimento_servico")
        .eq("conta_id", usuario.conta_id)
        .maybeSingle(),
    ]);

  if (contaError) throw contaError;
  if (configError) throw configError;
  if (!conta?.ativo) {
    throw new RobertoError("A conta vinculada está inativa.", 403, "INACTIVE_ACCOUNT");
  }

  return {
    usuario,
    conta,
    configuracao: configuracao || {
      moeda: "EUR",
      locale: "it-IT",
      timezone: "Europe/Rome",
      formato_data: "DD/MM/YYYY",
      nome_sistema: "PDR Hub",
      dias_vencimento_servico: 0,
    },
    db: supabaseAdmin,
  };
}

export async function logRobertoAudit(
  context,
  { entidade, acao, registroId, descricao, before = null, after = null }
) {
  const { error } = await context.db.from("auditoria").insert({
    conta_id: context.usuario.conta_id,
    usuario_id: context.usuario.id,
    entidade,
    acao,
    registro_id: registroId || null,
    descricao: `${descricao} Origem: Roberto.`,
    dados_anteriores: before,
    dados_novos: after,
  });

  if (error) {
    console.warn("Roberto: auditoria não registrada", error);
  }
}
