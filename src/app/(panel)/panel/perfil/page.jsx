"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  Crop,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Form,
  FormField,
  FormGrid,
  ImageCropModal,
  Input,
  MAX_CROP_SOURCE_SIZE,
} from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeByConfig } from "@/lib/formatters";

const AVATAR_BUCKET = "perfis";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

function fileExtension(file) {
  const byName = String(file?.name || "")
    .split(".")
    .pop()
    ?.toLowerCase();

  if (["jpg", "jpeg", "png", "webp"].includes(byName)) {
    return byName === "jpeg" ? "jpg" : byName;
  }

  if (file?.type === "image/png") return "png";
  if (file?.type === "image/webp") return "webp";
  return "jpg";
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

const EMPTY_PASSWORD_FORM = { current: "", next: "", confirm: "" };

function passwordScore(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (password.length >= 12 || /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH_META = [
  { label: "Digite uma nova senha", bar: "bg-surface-3", text: "text-muted-foreground" },
  { label: "Fraca", bar: "bg-danger", text: "text-danger" },
  { label: "Razoável", bar: "bg-warning", text: "text-warning" },
  { label: "Boa", bar: "bg-success", text: "text-success" },
  { label: "Forte", bar: "bg-success", text: "text-success" },
];

function PasswordInput({ value, onChange, autoComplete, visible, onToggle }) {
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        maxLength={72}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
        aria-label={visible ? "Ocultar senhas" : "Mostrar senhas"}
        title={visible ? "Ocultar senhas" : "Mostrar senhas"}
      >
        {visible ? <EyeOff className="size-4" strokeWidth={1.8} /> : <Eye className="size-4" strokeWidth={1.8} />}
      </button>
    </div>
  );
}

function PasswordStrength({ password }) {
  const score = passwordScore(password);
  const meta = STRENGTH_META[score];

  return (
    <div className="w-full max-w-sm">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-colors ${score >= level ? meta.bar : "bg-surface-3"}`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        <span className={`font-medium ${meta.text}`}>{meta.label}</span>
        {" · "}Mínimo de 8 caracteres, com letras e números.
      </p>
    </div>
  );
}

export default function PerfilPage() {
  const supabase = useMemo(() => createClient(), []);

  const [me, setMe] = useState(null);
  const [form, setForm] = useState({
    nome: "",
    email: "",
  });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [cropSource, setCropSource] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropKey, setCropKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const meResponse = await fetch("/api/me", {
        credentials: "include",
        cache: "no-store",
      });
      if (!meResponse.ok) throw new Error("Nao foi possivel carregar o perfil.");
      const meData = await meResponse.json();
      setMe(meData);

      const { data, error } = await supabase
        .from("usuarios")
        .select("id, conta_id, auth_user_id, nome, email, foto_url, ultimo_acesso, created_at")
        .eq("id", meData.usuario.id)
        .eq("conta_id", meData.usuario.conta_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Perfil nao encontrado.");

      setForm({
        nome: data.nome || "",
        email: data.email || "",
      });
      setAvatarUrl(getPhotoUrl(supabase, data.foto_url));
      setAvatarFile(null);
      setRemoveAvatar(false);
      setPreviewUrl(null);
      setCropSource(null);
    } catch (error) {
      console.error("Perfil loadData", error);
      toast.error(error.message || "Nao foi possivel carregar o perfil.");
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Envie uma imagem JPG, PNG ou WebP.");
      return;
    }

    if (file.size > MAX_CROP_SOURCE_SIZE) {
      toast.error("A imagem deve ter ate 15 MB.");
      return;
    }

    openCrop(file);
  }

  function openCrop(file) {
    setCropSource(file);
    setCropKey((current) => current + 1);
    setCropOpen(true);
  }

  function handleCropConfirm(croppedFile) {
    if (croppedFile.size > MAX_AVATAR_SIZE) {
      toast.error("A imagem recortada ficou maior que 5 MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAvatarFile(croppedFile);
    setPreviewUrl(URL.createObjectURL(croppedFile));
    setRemoveAvatar(false);
    setCropOpen(false);
  }

  async function uploadAvatar(file) {
    const extension = fileExtension(file);
    const random = Math.random().toString(36).slice(2, 8);
    const path = `usuarios/${me.usuario.conta_id}/${me.usuario.id}-${Date.now()}-${random}.${extension}`;

    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (error) throw error;
    return path;
  }

  async function removeAvatarFromStorage(pathOrUrl) {
    const path = getStoragePath(pathOrUrl);
    if (!path) return;

    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    if (error) console.warn("Avatar antigo nao removido", error);
  }

  async function logAudit(before, after) {
    await supabase.from("auditoria").insert({
      conta_id: me.usuario.conta_id,
      usuario_id: me.usuario.id,
      entidade: "usuarios",
      acao: "atualizar_perfil",
      registro_id: me.usuario.id,
      descricao: "Perfil do usuario atualizado.",
      dados_anteriores: before,
      dados_novos: after,
    });
  }

  function updatePasswordField(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validatePasswordForm() {
    const errors = {};
    if (!passwordForm.current) errors.current = "Informe a senha atual.";
    if (passwordForm.next.length < 8) errors.next = "Use pelo menos 8 caracteres.";
    else if (!/[A-Za-z]/.test(passwordForm.next) || !/\d/.test(passwordForm.next)) {
      errors.next = "Combine letras e números.";
    } else if (passwordForm.next === passwordForm.current) {
      errors.next = "A nova senha deve ser diferente da atual.";
    }
    if (passwordForm.confirm !== passwordForm.next) errors.confirm = "As senhas não conferem.";
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function changePassword(event) {
    event.preventDefault();
    if (!validatePasswordForm()) return;

    setChangingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (/atual/i.test(payload.error || "")) {
          setPasswordErrors({ current: payload.error });
        }
        throw new Error(payload.error || "Nao foi possivel alterar a senha.");
      }

      if (me?.usuario?.id) {
        // Auditoria sem nenhum dado da senha.
        await supabase.from("auditoria").insert({
          conta_id: me.usuario.conta_id,
          usuario_id: me.usuario.id,
          entidade: "usuarios",
          acao: "alterar_senha",
          registro_id: me.usuario.id,
          descricao: "Senha de acesso alterada pelo proprio usuario.",
        });
      }

      setPasswordForm(EMPTY_PASSWORD_FORM);
      setPasswordErrors({});
      setShowPasswords(false);
      toast.success("Senha alterada com sucesso.");
    } catch (error) {
      toast.error(error.message || "Nao foi possivel alterar a senha.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!me?.usuario?.id) return;

    setSaving(true);
    let uploadedPath = null;
    try {
      const { data: before, error: beforeError } = await supabase
        .from("usuarios")
        .select("id, conta_id, auth_user_id, nome, email, foto_url, ultimo_acesso, created_at")
        .eq("id", me.usuario.id)
        .eq("conta_id", me.usuario.conta_id)
        .maybeSingle();

      if (beforeError) throw beforeError;
      if (!before) throw new Error("Perfil nao encontrado.");

      const payload = {
        nome: form.nome.trim(),
        updated_at: new Date().toISOString(),
      };

      if (!payload.nome) throw new Error("Informe seu nome.");

      if (avatarFile) {
        uploadedPath = await uploadAvatar(avatarFile);
        payload.foto_url = uploadedPath;
      } else if (removeAvatar) {
        payload.foto_url = null;
      }

      const { data: after, error: updateError } = await supabase
        .from("usuarios")
        .update(payload)
        .eq("id", me.usuario.id)
        .eq("conta_id", me.usuario.conta_id)
        .select("id, conta_id, auth_user_id, nome, email, foto_url, ultimo_acesso, created_at")
        .single();

      if (updateError) throw updateError;

      await supabase.auth.updateUser({
        data: {
          nome: payload.nome,
        },
      });

      if ((avatarFile || removeAvatar) && before.foto_url) {
        await removeAvatarFromStorage(before.foto_url);
      }

      await logAudit(before, after);
      sessionStorage.removeItem("panel.me.v1");
      toast.success("Perfil atualizado.");
      await loadData();
    } catch (error) {
      if (uploadedPath) await removeAvatarFromStorage(uploadedPath);
      toast.error(error.message || "Nao foi possivel salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  const displayedAvatar = removeAvatar ? null : previewUrl || avatarUrl;
  const displayName = form.nome || me?.usuario?.nome || "Usuario";

  return (
    <main className="space-y-5 p-4 sm:p-5 lg:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {me?.conta?.nome_fantasia || me?.conta?.nome || "Conta"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Meu perfil</h2>
        </div>
        <Button variant="outline" leftIcon={RefreshCw} onClick={loadData} loading={loading}>
          Atualizar
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col items-center text-center">
            <span className="relative grid size-36 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-3xl font-semibold text-foreground">
              {displayedAvatar ? (
                <img src={displayedAvatar} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                getInitials(displayName)
              )}
              <span className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full border border-border bg-surface text-primary shadow-sm">
                <Camera className="size-4" strokeWidth={1.8} />
              </span>
            </span>

            <h3 className="mt-4 text-lg font-semibold text-foreground">{displayName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{form.email}</p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-3.5 text-sm font-semibold text-foreground transition hover:bg-surface-2">
                <UploadCloud className="size-4" strokeWidth={1.8} />
                Alterar foto
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
              {avatarFile && cropSource ? (
                <Button variant="outline" leftIcon={Crop} onClick={() => openCrop(cropSource)}>
                  Ajustar
                </Button>
              ) : null}
              <Button
                variant="outline"
                leftIcon={Trash2}
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setAvatarFile(null);
                  setPreviewUrl(null);
                  setCropSource(null);
                  setRemoveAvatar(true);
                }}
                disabled={!displayedAvatar}
              >
                Remover
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              JPG, PNG ou WebP de ate 15 MB. Voce ajusta o enquadramento antes de salvar.
            </p>
          </div>
        </section>

        <div className="min-w-0 space-y-5">
        <Form onSubmit={saveProfile}>
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">Dados pessoais</h3>
              <p className="text-sm text-muted-foreground">
                Essas informacoes aparecem no header e nos registros de auditoria.
              </p>
            </div>
          </div>

          <FormGrid>
            <FormField label="Nome" required>
              <Input
                value={form.nome}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                required
              />
            </FormField>
            <FormField label="Email">
              <Input value={form.email} disabled />
            </FormField>
          </FormGrid>

          <FormGrid>
            <FormField label="Conta">
              <Input value={me?.conta?.nome_fantasia || me?.conta?.nome || ""} disabled />
            </FormField>
            <FormField label="Ultimo acesso">
              <Input value={formatDateTimeByConfig(me?.usuario?.ultimo_acesso, me?.configuracao) || "-"} disabled />
            </FormField>
          </FormGrid>

          <div className="flex pt-4 justify-end">
            <Button type="submit" leftIcon={Save} loading={saving} disabled={loading}>
              Salvar perfil
            </Button>
          </div>
        </section>
        </Form>

        <Form onSubmit={changePassword}>
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="size-5" strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Segurança</h3>
                <p className="text-sm text-muted-foreground">
                  Altere sua senha de acesso. Você continua conectado neste dispositivo.
                </p>
              </div>
            </div>

            {/* Ajuda gerenciadores de senha a associar a credencial correta. */}
            <input type="email" name="username" autoComplete="username" value={form.email} readOnly hidden />

            <FormGrid columns={3}>
              <FormField label="Senha atual" required error={passwordErrors.current}>
                <PasswordInput
                  value={passwordForm.current}
                  onChange={(value) => updatePasswordField("current", value)}
                  autoComplete="current-password"
                  visible={showPasswords}
                  onToggle={() => setShowPasswords((current) => !current)}
                />
              </FormField>
              <FormField label="Nova senha" required error={passwordErrors.next}>
                <PasswordInput
                  value={passwordForm.next}
                  onChange={(value) => updatePasswordField("next", value)}
                  autoComplete="new-password"
                  visible={showPasswords}
                  onToggle={() => setShowPasswords((current) => !current)}
                />
              </FormField>
              <FormField label="Confirmar nova senha" required error={passwordErrors.confirm}>
                <PasswordInput
                  value={passwordForm.confirm}
                  onChange={(value) => updatePasswordField("confirm", value)}
                  autoComplete="new-password"
                  visible={showPasswords}
                  onToggle={() => setShowPasswords((current) => !current)}
                />
              </FormField>
            </FormGrid>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <PasswordStrength password={passwordForm.next} />
              <Button
                type="submit"
                leftIcon={KeyRound}
                loading={changingPassword}
                disabled={!passwordForm.current || !passwordForm.next || !passwordForm.confirm}
              >
                Alterar senha
              </Button>
            </div>
          </section>
        </Form>
        </div>
      </div>

      <ImageCropModal
        key={cropKey}
        open={cropOpen}
        file={cropSource}
        title="Ajustar foto de perfil"
        onClose={() => setCropOpen(false)}
        onConfirm={handleCropConfirm}
      />
    </main>
  );
}
