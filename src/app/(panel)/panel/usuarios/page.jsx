"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, RefreshCw, Shield, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Form,
  FormField,
  FormGrid,
  Input,
  Modal,
  Switch,
  Table,
} from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeByConfig } from "@/lib/formatters";

const AVATAR_BUCKET = "perfis";
const EMPTY_FORM = {
  nome: "",
  email: "",
  password: "",
  ativo: true,
};

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

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-success/10 text-success"
          : "bg-muted-foreground/10 text-muted-foreground"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export default function UsuariosPage() {
  const supabase = useMemo(() => createClient(), []);

  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

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
        .from("usuarios")
        .select("id, conta_id, auth_user_id, nome, email, foto_url, ativo, ultimo_acesso, created_at")
        .eq("conta_id", meData.usuario.conta_id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setUsers(
        (data || []).map((user) => ({
          ...user,
          foto_url: getPhotoUrl(supabase, user.foto_url),
        }))
      );
    } catch (error) {
      console.error("Usuarios loadData", error);
      toast.error(error.message || "Nao foi possivel carregar os usuarios.");
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

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditingUser(user);
    setForm({
      nome: user.nome || "",
      email: user.email || "",
      password: "",
      ativo: user.ativo !== false,
    });
    setModalOpen(true);
  }

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios", {
        method: editingUser ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editingUser?.id,
          nome: form.nome,
          email: form.email,
          password: form.password,
          ativo: editingUser
            ? editingUser.id === me?.usuario?.id
              ? form.ativo
              : editingUser.ativo
            : true,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Nao foi possivel salvar o usuario.");

      toast.success(editingUser ? "Usuario atualizado." : "Usuario criado.");
      setModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error.message || "Nao foi possivel salvar o usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    if (user.id !== me?.usuario?.id) {
      toast.error("Voce so pode alterar o status do seu proprio usuario.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: user.id,
          nome: user.nome,
          email: user.email,
          ativo: !user.ativo,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Nao foi possivel atualizar o status.");

      toast.success(!user.ativo ? "Usuario ativado." : "Usuario desativado.");
      await loadData();
    } catch (error) {
      toast.error(error.message || "Nao foi possivel atualizar o status.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = users.filter((user) => user.ativo).length;
  const columns = useMemo(
    () => [
      {
        key: "nome",
        header: "Usuario",
        accessor: "nome",
        render: (_, user) => (
          <div className="flex min-w-60 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-xs font-semibold text-foreground">
              {user.foto_url ? (
                <img src={user.foto_url} alt={user.nome} className="h-full w-full object-cover" />
              ) : (
                getInitials(user.nome)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{user.nome}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: "ativo",
        header: "Status",
        render: (value) => <StatusBadge active={value} />,
      },
      {
        key: "ultimo_acesso",
        header: "Ultimo acesso",
        render: (value) => (
          <span className="text-muted-foreground">
            {formatDateTimeByConfig(value, me?.configuracao) || "-"}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "Criado em",
        render: (value) => (
          <span className="text-muted-foreground">
            {formatDateTimeByConfig(value, me?.configuracao) || "-"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        sortable: false,
        render: (_, user) => (
          <div className="flex justify-end gap-2">
            {user.id === me?.usuario?.id ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={Edit3}
                onClick={() => openEdit(user)}
              >
                Editar
              </Button>
            ) : null}
            {user.id === me?.usuario?.id ? (
              <Button
                variant={user.ativo ? "subtleDanger" : "success"}
                size="sm"
                leftIcon={user.ativo ? UserX : UserCheck}
                onClick={() => toggleActive(user)}
                disabled={saving}
              >
                {user.ativo ? "Desativar meu usuario" : "Ativar meu usuario"}
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [me?.configuracao, me?.usuario?.id, saving]
  );

  return (
    <main className="space-y-5 p-4 sm:p-5 lg:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {me?.conta?.nome_fantasia || me?.conta?.nome || "Conta"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Usuarios</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" leftIcon={RefreshCw} onClick={loadData} loading={loading}>
            Atualizar
          </Button>
          <Button leftIcon={Plus} onClick={openCreate}>
            Novo usuario
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-muted-foreground">Total de usuarios</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{users.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-muted-foreground">Ativos</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-muted-foreground">Permissao</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="size-4 text-primary" strokeWidth={1.8} />
            Acesso completo
          </p>
        </div>
      </section>

      <Table
        data={users}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Buscar usuario..."
        searchKeys={["nome", "email"]}
        pageSize={10}
        pageSizeOptions={[10, 20, 50]}
        emptyMessage="Nenhum usuario cadastrado."
        tableClassName="[&_tbody_td]:py-4"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? "Editar usuario" : "Novo usuario"}
        description="Usuarios ativos acessam todos os modulos da plataforma."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="usuario-form" loading={saving}>
              Salvar
            </Button>
          </>
        }
      >
        <Form id="usuario-form" onSubmit={saveUser}>
          <FormGrid>
            <FormField label="Nome" required>
              <Input
                value={form.nome}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                placeholder="Nome completo"
                required
              />
            </FormField>
            <FormField label="Email" required>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="usuario@email.com"
                required
              />
            </FormField>
          </FormGrid>

          {!editingUser ? (
            <FormField label="Senha inicial" required hint="Minimo de 6 caracteres.">
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                minLength={6}
                required
              />
            </FormField>
          ) : null}

          {editingUser?.id === me?.usuario?.id ? (
            <div className="rounded-lg border border-border bg-background p-4">
              <Switch
                label="Usuario ativo"
                description="Voce so pode alterar o status do seu proprio usuario."
                checked={form.ativo}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, ativo: checked }))}
              />
            </div>
          ) : null}
        </Form>
      </Modal>
    </main>
  );
}
