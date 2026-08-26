"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useState } from "react";

import { AuthCard } from "@/components/layout/auth-layout";
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

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error("Nao foi possivel criar a conta", data.error);
      return;
    }

    toast.success("Conta criada", "Seu usuario administrador esta pronto.");
    router.replace(data.redirectTo || "/panel");
    router.refresh();
  }

  return (
    <AuthCard
      title="Criar conta"
      description="Crie a conta principal e o primeiro usuario administrador."
      footer={
        <>
          Ja tem acesso?{" "}
          <Link href="/login" className="font-medium text-foreground">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="nome" className="text-sm font-medium">
            Seu nome
          </label>
          <input
            id="nome"
            name="nome"
            required
            value={form.nome}
            onChange={(event) =>
              setForm((current) => ({ ...current, nome: event.target.value }))
            }
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Nome do administrador"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contaNome" className="text-sm font-medium">
            Nome da conta
          </label>
          <input
            id="contaNome"
            name="contaNome"
            required
            value={form.contaNome}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                contaNome: event.target.value,
              }))
            }
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Nome da empresa"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="voce@empresa.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Senha
          </label>
          <div className="relative">
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
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Minimo de 8 caracteres"
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" strokeWidth={1.8} />
              ) : (
                <Eye className="size-4" strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-active disabled:opacity-60"
        >
          <UserPlus className="size-4" strokeWidth={1.8} />
          {loading ? "Criando..." : "Criar conta"}
        </button>
      </form>
    </AuthCard>
  );
}

