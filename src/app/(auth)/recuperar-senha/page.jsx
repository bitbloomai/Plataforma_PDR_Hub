"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { useState } from "react";

import { AuthCard } from "@/components/layout/auth-layout";
import { toast } from "@/lib/toast";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    const response = await fetch("/api/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error("Nao foi possivel enviar", data.error);
      return;
    }

    toast.success("E-mail enviado", data.message);
  }

  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe seu e-mail para receber o link de redefinicao."
      footer={
        <Link href="/login" className="font-medium text-foreground">
          Voltar para o login
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="voce@empresa.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-active disabled:opacity-60"
        >
          <Mail className="size-4" strokeWidth={1.8} />
          {loading ? "Enviando..." : "Enviar link"}
        </button>
      </form>
    </AuthCard>
  );
}

