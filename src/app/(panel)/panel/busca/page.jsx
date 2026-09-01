"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  Car,
  ClipboardList,
  History,
  RefreshCw,
  Search,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Input } from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { withSourceCurrency } from "@/lib/currency";
import { formatDateByConfig, formatMoneyByConfig } from "@/lib/formatters";

const RESULT_LIMIT = 8;

function normalizeQuery(value) {
  return String(value || "").trim();
}

function ilike(term) {
  return `%${term.replaceAll("%", "").replaceAll(",", " ")}%`;
}

function getQueryFromUrl() {
  if (typeof window === "undefined") return "";
  return normalizeQuery(new URLSearchParams(window.location.search).get("q"));
}

function ResultSection({ title, icon: Icon, href, rows, emptyText, children }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{rows.length} resultado(s)</p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
        >
          Abrir modulo
          <ArrowRight className="size-3.5" strokeWidth={1.8} />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {rows.length ? children : (
          <div className="px-4 py-5 text-sm text-muted-foreground">{emptyText}</div>
        )}
      </div>
    </section>
  );
}

function ResultItem({ href, title, subtitle, meta }) {
  return (
    <Link
      href={href}
      className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface-2/70"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {meta ? (
        <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {meta}
        </span>
      ) : null}
    </Link>
  );
}

export default function BuscaPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = normalizeQuery(searchParams.get("q"));

  const [me, setMe] = useState(null);
  const [query, setQuery] = useState(urlQuery);
  const [searched, setSearched] = useState(urlQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    servicos: [],
    oficinas: [],
    tecnicos: [],
    veiculos: [],
    financeiro: [],
    auditoria: [],
  });

  const runSearch = useCallback(
    async (rawQuery) => {
      const term = normalizeQuery(rawQuery);
      setSearched(term);

      if (!term) {
        setResults({
          servicos: [],
          oficinas: [],
          tecnicos: [],
          veiculos: [],
          financeiro: [],
          auditoria: [],
        });
        return;
      }

      setLoading(true);
      try {
        const meResponse = await fetch("/api/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!meResponse.ok) throw new Error("Nao foi possivel carregar o usuario.");
        const meData = await meResponse.json();
        setMe(meData);

        const contaId = meData.usuario.conta_id;
        const like = ilike(term);

        const [
          servicosResult,
          oficinasResult,
          tecnicosResult,
          veiculosResult,
          financeiroResult,
          auditoriaResult,
        ] = await Promise.all([
          supabase
            .from("servicos")
            .select("id,data_servico,valor,moeda,status,descricao,oficina:oficinas(nome),veiculo:veiculos(placa,marca,modelo)")
            .eq("conta_id", contaId)
            .or(`descricao.ilike.${like},observacoes.ilike.${like}`)
            .order("created_at", { ascending: false })
            .limit(RESULT_LIMIT),
          supabase
            .from("oficinas")
            .select("id,nome,responsavel,email,telefone,cidade,estado_regiao,ativo")
            .eq("conta_id", contaId)
            .or(`nome.ilike.${like},responsavel.ilike.${like},email.ilike.${like},telefone.ilike.${like},cidade.ilike.${like}`)
            .order("nome", { ascending: true })
            .limit(RESULT_LIMIT),
          supabase
            .from("tecnicos")
            .select("id,nome,email,telefone,documento,ativo")
            .eq("conta_id", contaId)
            .or(`nome.ilike.${like},email.ilike.${like},telefone.ilike.${like},documento.ilike.${like}`)
            .order("nome", { ascending: true })
            .limit(RESULT_LIMIT),
          supabase
            .from("veiculos")
            .select("id,placa,marca,modelo,ano,cor,chassi")
            .eq("conta_id", contaId)
            .or(`placa.ilike.${like},marca.ilike.${like},modelo.ilike.${like},cor.ilike.${like},chassi.ilike.${like}`)
            .order("placa", { ascending: true })
            .limit(RESULT_LIMIT),
          supabase
            .from("movimentacoes_financeiras")
            .select("id,tipo,origem,descricao,valor,moeda,status,data_competencia,servico_id")
            .eq("conta_id", contaId)
            .or(`descricao.ilike.${like},origem.ilike.${like},status.ilike.${like}`)
            .order("data_competencia", { ascending: false })
            .limit(RESULT_LIMIT),
          supabase
            .from("auditoria")
            .select("id,entidade,acao,descricao,created_at,usuario:usuarios(nome,email)")
            .eq("conta_id", contaId)
            .or(`entidade.ilike.${like},acao.ilike.${like},descricao.ilike.${like}`)
            .order("created_at", { ascending: false })
            .limit(RESULT_LIMIT),
        ]);

        const errors = [
          servicosResult.error,
          oficinasResult.error,
          tecnicosResult.error,
          veiculosResult.error,
          financeiroResult.error,
          auditoriaResult.error,
        ].filter(Boolean);

        if (errors.length) throw errors[0];

        setResults({
          servicos: servicosResult.data || [],
          oficinas: oficinasResult.data || [],
          tecnicos: tecnicosResult.data || [],
          veiculos: veiculosResult.data || [],
          financeiro: financeiroResult.data || [],
          auditoria: auditoriaResult.data || [],
        });
      } catch (error) {
        console.error("Busca global", error);
        toast.error(error.message || "Nao foi possivel buscar.");
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setQuery(urlQuery);
      runSearch(urlQuery);
    });

    return () => cancelAnimationFrame(frameId);
  }, [runSearch, urlQuery]);

  function submit(event) {
    event.preventDefault();
    const term = normalizeQuery(query);
    router.push(`/panel/busca${term ? `?q=${encodeURIComponent(term)}` : ""}`);
    runSearch(term);
  }

  const total = Object.values(results).reduce((sum, list) => sum + list.length, 0);
  const config = me?.configuracao;

  return (
    <main className="space-y-5 p-4 sm:p-5 lg:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {me?.conta?.nome_fantasia || me?.conta?.nome || "Busca global"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Resultados</h2>
        </div>
        <Button variant="outline" leftIcon={RefreshCw} onClick={() => runSearch(query)} loading={loading}>
          Atualizar
        </Button>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-3 sm:p-4">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.8}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar placa, oficina, tecnico, servico, financeiro..."
            className="h-12 pl-9 pr-28"
          />
          <Button type="submit" className="absolute right-1 top-1 h-10">
            Buscar
          </Button>
        </label>
      </form>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">
          {searched
            ? `${total} resultado(s) para "${searched}".`
            : "Digite um termo para buscar em toda a plataforma."}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ResultSection
          title="Servicos"
          icon={ClipboardList}
          href="/panel/servicos"
          rows={results.servicos}
          emptyText="Nenhum servico encontrado."
        >
          {results.servicos.map((service) => (
            <ResultItem
              key={service.id}
              href="/panel/servicos"
              title={`${service.veiculo?.placa || "Sem placa"} - ${service.oficina?.nome || "Sem oficina"}`}
              subtitle={[service.descricao, formatDateByConfig(service.data_servico, config)].filter(Boolean).join(" | ")}
              meta={formatMoneyByConfig(service.valor, withSourceCurrency(config, service.moeda))}
            />
          ))}
        </ResultSection>

        <ResultSection
          title="Oficinas"
          icon={Building2}
          href="/panel/oficinas"
          rows={results.oficinas}
          emptyText="Nenhuma oficina encontrada."
        >
          {results.oficinas.map((office) => (
            <ResultItem
              key={office.id}
              href="/panel/oficinas"
              title={office.nome}
              subtitle={[office.responsavel, office.email, office.cidade].filter(Boolean).join(" | ")}
              meta={office.ativo ? "Ativa" : "Inativa"}
            />
          ))}
        </ResultSection>

        <ResultSection
          title="Tecnicos"
          icon={Wrench}
          href="/panel/tecnicos"
          rows={results.tecnicos}
          emptyText="Nenhum tecnico encontrado."
        >
          {results.tecnicos.map((technician) => (
            <ResultItem
              key={technician.id}
              href="/panel/tecnicos"
              title={technician.nome}
              subtitle={[technician.email, technician.telefone, technician.documento].filter(Boolean).join(" | ")}
              meta={technician.ativo ? "Ativo" : "Inativo"}
            />
          ))}
        </ResultSection>

        <ResultSection
          title="Veiculos"
          icon={Car}
          href="/panel/veiculos"
          rows={results.veiculos}
          emptyText="Nenhum veiculo encontrado."
        >
          {results.veiculos.map((vehicle) => (
            <ResultItem
              key={vehicle.id}
              href="/panel/veiculos"
              title={vehicle.placa}
              subtitle={[vehicle.marca, vehicle.modelo, vehicle.ano, vehicle.cor].filter(Boolean).join(" | ")}
              meta={vehicle.chassi || ""}
            />
          ))}
        </ResultSection>

        <ResultSection
          title="Financeiro"
          icon={Banknote}
          href="/panel/financeiro"
          rows={results.financeiro}
          emptyText="Nenhuma movimentacao encontrada."
        >
          {results.financeiro.map((movement) => (
            <ResultItem
              key={movement.id}
              href="/panel/financeiro"
              title={movement.descricao}
              subtitle={[movement.tipo, movement.origem, formatDateByConfig(movement.data_competencia, config)].filter(Boolean).join(" | ")}
              meta={formatMoneyByConfig(movement.valor, withSourceCurrency(config, movement.moeda))}
            />
          ))}
        </ResultSection>

        <ResultSection
          title="Auditoria"
          icon={History}
          href="/panel/auditoria"
          rows={results.auditoria}
          emptyText="Nenhum evento encontrado."
        >
          {results.auditoria.map((audit) => (
            <ResultItem
              key={audit.id}
              href="/panel/auditoria"
              title={`${audit.entidade} - ${audit.acao}`}
              subtitle={[audit.descricao, audit.usuario?.nome || audit.usuario?.email].filter(Boolean).join(" | ")}
              meta={audit.created_at ? formatDateByConfig(audit.created_at, config) : ""}
            />
          ))}
        </ResultSection>
      </div>
    </main>
  );
}
