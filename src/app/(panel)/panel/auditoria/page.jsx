"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button, Select, Table } from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeByConfig } from "@/lib/formatters";

const AVATAR_BUCKET = "perfis";

function getStoragePath(pathOrUrl) {
  if (!pathOrUrl) return null;
  const raw = String(pathOrUrl).trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, "").replace(/^perfis\//, "") || null;

  try {
    const url = new URL(raw);
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length)) || null;
  } catch {
    return null;
  }
}

function getPhotoUrl(supabase, pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const cleanPath = getStoragePath(pathOrUrl);
  if (!cleanPath) return null;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(cleanPath);
  return data?.publicUrl || null;
}

function getInitials(name) {
  return String(name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function AuditoriaPage() {
  const supabase = useMemo(() => createClient(), []);

  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const meResponse = await fetch("/api/me", {
        credentials: "include",
        cache: "no-store",
      });
      if (!meResponse.ok) throw new Error("Nao foi possivel carregar o usuario.");
      const meData = await meResponse.json();
      setMe(meData);

      const { data, error } = await supabase
        .from("auditoria")
        .select(
          "id, conta_id, usuario_id, entidade, acao, registro_id, descricao, dados_anteriores, dados_novos, created_at, usuario:usuarios(id,nome,email,foto_url)"
        )
        .eq("conta_id", meData.usuario.conta_id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      setRows(
        (data || []).map((item) => ({
          ...item,
          usuario: item.usuario
            ? {
                ...item.usuario,
                foto_url: getPhotoUrl(supabase, item.usuario.foto_url),
              }
            : null,
        }))
      );
    } catch (error) {
      console.error("Auditoria loadData", error);
      toast.error(error.message || "Nao foi possivel carregar a auditoria.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      loadData();
    });
    return () => cancelAnimationFrame(frameId);
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (entityFilter && row.entidade !== entityFilter) return false;
      if (actionFilter && row.acao !== actionFilter) return false;
      if (!term) return true;

      return [
        row.entidade,
        row.acao,
        row.descricao,
        row.registro_id,
        row.usuario?.nome,
        row.usuario?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [actionFilter, entityFilter, rows, search]);

  const entityOptions = useMemo(
    () =>
      [...new Set(rows.map((row) => row.entidade).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((value) => ({ value, label: value })),
    [rows]
  );

  const actionOptions = useMemo(
    () =>
      [...new Set(rows.map((row) => row.acao).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((value) => ({ value, label: value })),
    [rows]
  );

  const usersCount = useMemo(
    () => new Set(rows.map((row) => row.usuario_id).filter(Boolean)).size,
    [rows]
  );

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((row) => String(row.created_at || "").startsWith(today)).length;
  }, [rows]);

  const columns = useMemo(
    () => [
      {
        key: "created_at",
        header: "Data e hora",
        width: 170,
        render: (value) => (
          <span className="font-medium text-foreground">
            {formatDateTimeByConfig(value, me?.configuracao) || "-"}
          </span>
        ),
      },
      {
        key: "usuario",
        header: "Usuario",
        accessor: (row) => row.usuario?.nome || row.usuario?.email || "Sistema",
        render: (_, row) => {
          const user = row.usuario;
          const name = user?.nome || "Sistema";
          return (
            <div className="flex min-w-56 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-xs font-semibold text-foreground">
                {user?.foto_url ? (
                  <img src={user.foto_url} alt={name} className="h-full w-full object-cover" />
                ) : (
                  getInitials(name)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email || "Registro automatico"}</p>
              </div>
            </div>
          );
        },
      },
      {
        key: "entidade",
        header: "Modulo",
        render: (value) => (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground">
            {value}
          </span>
        ),
      },
      {
        key: "acao",
        header: "Acao",
        render: (value) => (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {value}
          </span>
        ),
      },
      {
        key: "descricao",
        header: "Descricao",
        accessor: "descricao",
        sortable: false,
        render: (value) => (
          <span className="block max-w-xl whitespace-normal text-muted-foreground">
            {value || "-"}
          </span>
        ),
      },
    ],
    [me?.configuracao]
  );

  return (
    <main className="space-y-5 p-4 sm:p-5 lg:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {me?.conta?.nome_fantasia || me?.conta?.nome || "Conta"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Auditoria</h2>
        </div>
        <Button variant="outline" leftIcon={RefreshCw} onClick={loadData} loading={loading}>
          Atualizar
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={ShieldCheck} label="Eventos registrados" value={rows.length} />
        <StatCard icon={UserRound} label="Usuarios envolvidos" value={usersCount} />
        <StatCard icon={CalendarClock} label="Movimentos hoje" value={todayCount} />
      </section>

      <Table
        data={filteredRows}
        columns={columns}
        loading={loading}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por usuario, modulo ou descricao..."
        pageSize={20}
        pageSizeOptions={[20, 50, 100]}
        initialSort={{ key: "created_at", direction: "desc" }}
        emptyMessage="Nenhuma movimentacao registrada."
        tableClassName="[&_tbody_td]:py-4"
        toolbar={
          <>
            <Select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
              placeholder="Todos os modulos"
              options={entityOptions}
              className="w-44"
            />
            <Select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              placeholder="Todas as acoes"
              options={actionOptions}
              className="w-40"
            />
            <Button
              variant="ghost"
              leftIcon={Activity}
              onClick={() => {
                setEntityFilter("");
                setActionFilter("");
                setSearch("");
              }}
            >
              Limpar
            </Button>
          </>
        }
      />
    </main>
  );
}
