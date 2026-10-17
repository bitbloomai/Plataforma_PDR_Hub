import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 8;
// Limite do bcrypt usado pelo Supabase Auth.
const MAX_LENGTH = 72;

function jsonError(message, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

/**
 * Confere a senha atual em um cliente isolado (sem cookies), para não
 * interferir na sessão do usuário logado.
 */
async function currentPasswordIsValid(email, password) {
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error) return false;

  // Encerra somente a sessão temporária da verificação (escopo local).
  await verifier.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (!currentPassword) return jsonError("Informe a senha atual.");
  if (newPassword.length < MIN_LENGTH) {
    return jsonError(`A nova senha deve ter pelo menos ${MIN_LENGTH} caracteres.`);
  }
  if (newPassword.length > MAX_LENGTH) {
    return jsonError(`A nova senha deve ter no máximo ${MAX_LENGTH} caracteres.`);
  }
  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return jsonError("A nova senha deve combinar letras e números.");
  }
  if (newPassword === currentPassword) {
    return jsonError("A nova senha deve ser diferente da senha atual.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return jsonError("Sessão expirada. Entre novamente.", 401);

  if (!(await currentPasswordIsValid(user.email, currentPassword))) {
    return jsonError("A senha atual está incorreta.", 400);
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    console.error("change-password", error.message);
    return jsonError(
      error.code === "same_password"
        ? "A nova senha deve ser diferente da senha atual."
        : error.code === "weak_password"
          ? "A nova senha é fraca demais. Use uma combinação mais forte."
          : "Não foi possível atualizar a senha. Tente novamente.",
      400
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
