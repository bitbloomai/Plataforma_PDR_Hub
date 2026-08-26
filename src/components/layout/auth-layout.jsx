import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AuthLayoutShell({ children }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/Logo_Completa.png"
              alt="Logo da plataforma"
              width={190}
              height={64}
              priority
              className="h-auto w-40 sm:w-48"
            />
          </Link>

          <ThemeToggle />
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_440px] lg:py-12">
          <section className="hidden max-w-xl space-y-6 lg:block">
            <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
              Gestao de servicos automotivos
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight text-foreground">
                Controle operacional e financeiro em uma unica plataforma.
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                Organize oficinas, tecnicos, veiculos, servicos e repasses com
                dados separados por conta desde o primeiro acesso.
              </p>
            </div>

            <div className="grid max-w-lg grid-cols-3 gap-3">
              {["Servicos", "Financeiro", "Equipe"].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="mb-3 h-1.5 w-8 rounded-full bg-primary" />
                  <p className="text-sm font-medium text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="w-full">{children}</section>
        </div>
      </div>
    </main>
  );
}

export function AuthCard({ title, description, children, footer }) {
  return (
    <div className="mx-auto w-full max-w-[440px] rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {children}

      {footer ? (
        <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

