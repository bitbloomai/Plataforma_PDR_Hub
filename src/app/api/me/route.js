//src/app/api/me/route.js

import { NextResponse } from "next/server";

import { fetchLatestExchangeRates, normalizeCurrency } from "@/lib/currency";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function resolvePublicProfileUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const cleanPath = pathOrUrl
    .replace(/^\/+/, "")
    .replace(/^perfis\//, "");

  const { data } = supabaseAdmin.storage
    .from("perfis")
    .getPublicUrl(cleanPath);

  return data?.publicUrl || null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select(
        "id, conta_id, auth_user_id, nome, email, foto_url, ativo, ultimo_acesso, created_at"
      )
      .eq("auth_user_id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (usuarioError) throw usuarioError;

    if (!usuario) {
      return NextResponse.json(
        { error: "Usuário autenticado sem cadastro ativo na plataforma." },
        { status: 403 }
      );
    }

    const [{ data: conta, error: contaError }, { data: configuracao, error: configError }] =
      await Promise.all([
        supabaseAdmin
          .from("contas")
          .select("id, nome, nome_fantasia, foto_url, ativo")
          .eq("id", usuario.conta_id)
          .maybeSingle(),
        supabaseAdmin
          .from("configuracoes")
          .select(
            "moeda, locale, timezone, formato_data, nome_sistema, dias_vencimento_servico"
          )
          .eq("conta_id", usuario.conta_id)
          .maybeSingle(),
      ]);

    if (contaError) throw contaError;
    if (configError) throw configError;

    if (!conta?.ativo) {
      return NextResponse.json(
        { error: "A conta vinculada a este usuário está inativa." },
        { status: 403 }
      );
    }

    const baseConfiguracao = configuracao || {
      moeda: "EUR",
      locale: "it-IT",
      timezone: "Europe/Rome",
      formato_data: "DD/MM/YYYY",
      nome_sistema: "Gestao de Servicos",
      dias_vencimento_servico: 0,
    };
    const currency = normalizeCurrency(baseConfiguracao.moeda);
    let cambio = { base: "EUR", quote: currency, rates: { EUR: 1 }, date: null, provider: "fallback" };

    try {
      cambio = await fetchLatestExchangeRates(currency);
    } catch (rateError) {
      console.warn("GET /api/me cambio", rateError);
    }

    return NextResponse.json(
      {
        usuario: {
          id: usuario.id,
          conta_id: usuario.conta_id,
          auth_user_id: usuario.auth_user_id,
          nome: usuario.nome,
          email: usuario.email,
          foto_url: resolvePublicProfileUrl(usuario.foto_url),
          ultimo_acesso: usuario.ultimo_acesso,
          created_at: usuario.created_at,
        },
        conta: conta
          ? {
              ...conta,
              foto_url: resolvePublicProfileUrl(conta.foto_url),
            }
          : null,
        configuracao: {
          ...baseConfiguracao,
          moeda: currency,
          cambio,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/me", error);

    return NextResponse.json(
      { error: "Não foi possível carregar os dados do usuário." },
      { status: 500 }
    );
  }
}
