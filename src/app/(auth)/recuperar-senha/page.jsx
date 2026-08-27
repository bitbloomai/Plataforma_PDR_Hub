"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";

import {
  AuthCard,
  AuthLayoutShell,
} from "@/components/layout/auth-layout";

import { toast } from "@/lib/toast";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          "Não foi possível enviar",
          data.error || "Verifique o e-mail informado e tente novamente."
        );
        return;
      }

      toast.success(
        "E-mail enviado",
        data.message ||
          "Enviamos um link para você redefinir sua senha."
      );
    } catch {
      toast.error(
        "Erro ao enviar",
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
            Recuperar senha
          </h1>

          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Informe seu e-mail e enviaremos um link seguro para você criar
            uma nova senha.
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
              {loading ? "Enviando..." : "Enviar link de recuperação"}
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