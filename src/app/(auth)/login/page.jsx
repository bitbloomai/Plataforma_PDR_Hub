"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useState } from "react";

import {
  AuthCard,
  AuthLayoutShell,
} from "@/components/layout/auth-layout";

import { toast } from "@/lib/toast";

export default function LoginPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/panel";

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          next,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          "Não foi possível entrar",
          data.error || "Verifique suas credenciais e tente novamente."
        );

        return;
      }

      router.replace(data.redirectTo || "/panel");
      router.refresh();
    } catch {
      toast.error(
        "Erro ao entrar",
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
          

          {/* Conteúdo */}
          <div className="flex flex-1 items-end pt-16 px-12 pb-14 xl:px-16 xl:pb-16">
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
          <div className="mb-3 flex items-center gap-2">
          </div>

          <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-foreground">
            Área de login
          </h1>

          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Entre com suas credenciais para acessar sua operação.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* E-mail */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-foreground"
            >
              E-mail
            </label>

            <div className="group relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                strokeWidth={1.8}
              />

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="voce@empresa.com"
                className="
                  h-12
                  w-full
                  rounded-xl
                  border
                  border-border
                  bg-surface-2/55
                  pl-11
                  pr-4
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
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="password"
                className="text-[13px] font-medium text-foreground"
              >
                Senha
              </label>

              <Link
                href="/recuperar-senha"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Esqueceu a senha?
              </Link>
            </div>

            <div className="group relative">
              <LockKeyhole
                className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                strokeWidth={1.8}
              />

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Digite sua senha"
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
              {loading ? "Entrando..." : "Entrar na plataforma"}
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
          <p className="text-[13px] text-muted-foreground">
            Ainda não possui uma conta?{" "}
            <Link
              href="/signup"
              className="font-semibold text-foreground transition-colors hover:text-primary-hover"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </AuthCard>

      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/70">
        <LockKeyhole className="size-3" strokeWidth={1.8} />
        Ambiente protegido e acesso exclusivo para usuários autorizados.
      </div>
    </AuthLayoutShell>
  );
}