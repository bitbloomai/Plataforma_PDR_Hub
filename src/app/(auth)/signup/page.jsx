"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import {
  AuthCard,
  AuthLayoutShell,
} from "@/components/layout/auth-layout";

import { toast } from "@/lib/toast";

export default function SignupPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    contaNome: "",
    email: "",
    password: "",
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(
          "Não foi possível criar a conta",
          data.error
        );

        return;
      }

      toast.success(
        "Conta criada",
        "Seu usuário administrador está pronto."
      );

      router.replace(data.redirectTo || "/panel");
      router.refresh();
    } catch {
      toast.error(
        "Erro ao criar conta",
        "Não foi possível conectar ao servidor."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClassName = `
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
  `;

  return (
    <AuthLayoutShell
      aside={
        <>
          <div className="flex flex-1 items-end px-12 pt-16 pb-14 xl:px-16 xl:pb-16">
            <div className="max-w-[590px]">

              <h2 className="text-[48px] font-semibold leading-[1.02] tracking-[-0.045em] text-white xl:text-[58px]">
                Menos improviso.
                <span className="text-white/45">
                  {" "}
                  Mais gestão.
                </span>
              </h2>

              <p className="mt-6 max-w-[500px] text-[15px] leading-7 text-white/50">
                Estruture sua empresa, acompanhe os serviços e transforme
                a rotina da operação em informação útil para tomar decisões.
              </p>

            </div>
          </div>
        </>
      }
    >
      <div className="mb-7">
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
        <div className="mb-7">
          <div className="mb-3 flex items-center gap-2">
          </div>

          <h1 className="text-[30px] font-semibold tracking-[-0.035em]">
            Crie sua conta
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Configure sua empresa e seu primeiro usuário administrador.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            id="nome"
            label="Seu nome"
            icon={UserRound}
            placeholder="Nome do administrador"
            value={form.nome}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                nome: event.target.value,
              }))
            }
            className={inputClassName}
          />

          <Field
            id="contaNome"
            label="Empresa"
            icon={Building2}
            placeholder="Nome da empresa"
            value={form.contaNome}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                contaNome: event.target.value,
              }))
            }
            className={inputClassName}
          />

          <Field
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            icon={Mail}
            placeholder="voce@empresa.com"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            className={inputClassName}
          />

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-[13px] font-medium"
            >
              Senha
            </label>

            <div className="group relative">
              <LockKeyhole
                className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                strokeWidth={1.8}
              />

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                required
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Mínimo de 8 caracteres"
                className={`${inputClassName} pr-12`}
              />

              <button
                type="button"
                aria-label={
                  showPassword ? "Ocultar senha" : "Mostrar senha"
                }
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                className="absolute right-2.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="
              group
              mt-2
              inline-flex
              h-12
              w-full
              items-center
              justify-center
              gap-2
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
            {loading ? "Criando conta..." : "Criar minha conta"}

            {!loading && (
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            )}
          </button>
        </form>

        <div className="mt-7 border-t border-border pt-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            Já possui uma conta?{" "}
            <Link
              href="/login"
              className="font-semibold text-foreground transition-colors hover:text-primary-hover"
            >
              Entrar
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthLayoutShell>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  className,
  type = "text",
  ...props
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-[13px] font-medium text-foreground"
      >
        {label}
      </label>

      <div className="group relative">
        <Icon
          className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
          strokeWidth={1.8}
        />

        <input
          {...props}
          id={id}
          name={id}
          type={type}
          required
          className={className}
        />
      </div>
    </div>
  );
}