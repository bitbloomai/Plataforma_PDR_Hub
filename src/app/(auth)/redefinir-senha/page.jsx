"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AuthCard,
  AuthLayoutShell,
} from "@/components/layout/auth-layout";

import { toast } from "@/lib/toast";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          "Não foi possível redefinir",
          data.error || "Tente novamente ou solicite um novo link."
        );
        return;
      }

      toast.success(
        "Senha atualizada",
        "Entre novamente utilizando sua nova senha."
      );

      router.replace(data.redirectTo || "/login");
      router.refresh();
    } catch {
      toast.error(
        "Erro ao redefinir senha",
        "Não foi possível conectar ao servidor."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayoutShell
      aside={
        <>
          <div className="flex flex-1 items-end px-12 pb-14 pt-16 xl:px-16 xl:pb-16">
            <div className="max-w-[590px]">
              <h2 className="max-w-[560px] text-[48px] font-semibold leading-[1.02] tracking-[-0.045em] text-white xl:text-[58px]">
                Sua operação,
                <span className="text-white/45">
                  {" "}
                  finalmente sob controle.
                </span>
              </h2>

              <p className="mt-6 max-w-[500px] text-[15px] leading-7 text-white/50">
                Centralize clientes, veículos, serviços, agenda, ordens,
                financeiro e toda a rotina da sua empresa em um único lugar.
              </p>
            </div>
          </div>
        </>
      }
    >
      {/* Logo */}
      <div className="mb-8">
        <Image
          src="/Logo_Completa.png"
          alt="Logo"
          width={180}
          height={52}
          priority
          className="h-auto w-auto max-w-[180px] object-contain"
        />
      </div>

      <AuthCard>
        {/* Cabeçalho */}
        <div className="mb-7">
          <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-foreground">
            Criar nova senha
          </h1>

          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Escolha uma nova senha para voltar a acessar sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nova senha */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-foreground"
            >
              Nova senha
            </label>

            <div className="group relative">
              <KeyRound
                className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                strokeWidth={1.8}
              />

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="
                  h-12
                  w-full
                  rounded-xl
                  border
                  border-border
                  bg-surface-2/55
                  pl-11
                  pr-12
                  text-sm
                  text-foreground
                  outline-none
                  transition-all
                  placeholder:text-muted-foreground/70
                  hover:border-border-strong
                  focus:border-primary
                  focus:bg-surface
                  focus:ring-4
                  focus:ring-primary/10
                "
              />

              <button
                type="button"
                aria-label={
                  showPassword ? "Ocultar senha" : "Mostrar senha"
                }
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                className="
                  absolute
                  right-2.5
                  top-1/2
                  inline-flex
                  size-8
                  -translate-y-1/2
                  items-center
                  justify-center
                  rounded-lg
                  text-muted-foreground
                  transition-colors
                  hover:bg-surface-3
                  hover:text-foreground
                "
              >
                {showPassword ? (
                  <EyeOff className="size-4" strokeWidth={1.8} />
                ) : (
                  <Eye className="size-4" strokeWidth={1.8} />
                )}
              </button>
            </div>

            <p className="text-[11px] leading-5 text-muted-foreground/80">
              Utilize pelo menos 8 caracteres.
            </p>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="
              group
              relative
              inline-flex
              h-12
              w-full
              items-center
              justify-center
              gap-2
              overflow-hidden
              rounded-xl
              bg-primary
              px-5
              text-sm
              font-semibold
              text-primary-foreground
              shadow-[0_8px_24px_rgba(242,194,27,0.18)]
              transition-all
              hover:bg-primary-hover
              hover:shadow-[0_10px_30px_rgba(242,194,27,0.25)]
              active:translate-y-px
              active:bg-primary-active
              disabled:pointer-events-none
              disabled:opacity-60
            "
          >
            <span>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </span>

            {!loading && (
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-7 border-t border-border pt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-foreground transition-colors hover:text-primary-hover"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Voltar para o login
          </Link>
        </div>
      </AuthCard>

      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/70">
        <LockKeyhole className="size-3" strokeWidth={1.8} />
        Ambiente protegido e acesso exclusivo para usuários autorizados.
      </div>
    </AuthLayoutShell>
  );
}