"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2, Upload } from "lucide-react";

import {
  Button,
  Form,
  FormField,
  FormGrid,
  FormSection,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
} from "@/components/shared";
import { maskPersonDocument, maskPhone } from "@/lib/inputMasks";
import {
  ALLOWED_AVATAR_TYPES,
  AVATAR_BUCKET,
  EMPTY_TECHNICIAN_FORM,
  MAX_AVATAR_SIZE,
  TECHNICIAN_SELECT,
  cleanAlphaNumeric,
  cleanDocument,
  cleanText,
  countryMeta,
  fileExtension,
  getPhotoUrl,
  logAudit,
  normalizeCountry,
  phoneForDatabase,
  phoneForInput,
  removeAvatarFromStorage,
  resolveDocumentCountry,
  resolvePhoneCountry,
  technicianAuditSnapshot,
  uniqueUploadSuffix,
} from "@/lib/technicians";
import { toast } from "@/lib/toast";

import { Avatar } from "./technician-ui";

function formFromTechnician(technician) {
  if (!technician) return EMPTY_TECHNICIAN_FORM;

  const phoneCountry = resolvePhoneCountry(technician.telefone, technician.telefone_pais);
  const documentCountry = resolveDocumentCountry(
    technician.documento,
    technician.documento_pais
  );

  return {
    nome: technician.nome || "",
    email: technician.email || "",
    nacionalidade: technician.nacionalidade || "",
    telefone_pais: phoneCountry,
    telefone: phoneForInput(technician.telefone, phoneCountry),
    documento_pais: documentCountry,
    documento: technician.documento
      ? maskPersonDocument(technician.documento, documentCountry)
      : "",
    pagamento_tipo: technician.pagamento_tipo || "",
    banco_pais: technician.banco_pais || "IT",
    titular_pagamento: technician.titular_pagamento || "",
    chave_pix: technician.chave_pix || "",
    banco_nome: technician.banco_nome || "",
    agencia: technician.agencia || "",
    conta_bancaria: technician.conta_bancaria || "",
    iban: technician.iban || "",
    bic_swift: technician.bic_swift || "",
    dados_pagamento: technician.dados_pagamento || "",
    observacoes: technician.observacoes || "",
    ativo: technician.ativo !== false,
  };
}

/**
 * Modal de criação/edição de técnico. O estado inicial vem de `technician`
 * no momento da montagem; use uma `key` nova a cada abertura para reiniciar.
 */
export function TechnicianFormModal({ open, technician, me, supabase, onClose, onSaved }) {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(() => formFromTechnician(technician));
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const avatarPreviewUrl = useMemo(() => {
    if (avatarFile) return URL.createObjectURL(avatarFile);
    if (removeAvatar) return null;
    return technician ? getPhotoUrl(supabase, technician.foto_url) : null;
  }, [avatarFile, technician, removeAvatar, supabase]);

  useEffect(() => {
    return () => {
      if (avatarFile && avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarFile, avatarPreviewUrl]);

  function close() {
    if (saving) return;
    onClose?.();
  }

  function validateForm() {
    const nextErrors = {};

    if (!form.nome.trim()) nextErrors.nome = "Informe o nome do técnico.";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Informe um e-mail válido.";
    }

    if (form.pagamento_tipo === "pix" && !form.chave_pix.trim()) {
      nextErrors.chave_pix = "Informe a chave PIX.";
    }

    if (form.pagamento_tipo === "conta_br") {
      if (!form.banco_nome.trim()) nextErrors.banco_nome = "Informe o banco.";
      if (!form.agencia.trim()) nextErrors.agencia = "Informe a agência.";
      if (!form.conta_bancaria.trim()) {
        nextErrors.conta_bancaria = "Informe a conta.";
      }
    }

    if (form.pagamento_tipo === "iban") {
      const iban = cleanAlphaNumeric(form.iban) || "";
      if (!iban) nextErrors.iban = "Informe o IBAN.";
      else if (iban.length < 15 || iban.length > 34) {
        nextErrors.iban = "O IBAN deve possuir entre 15 e 34 caracteres.";
      }
    }

    if (avatarFile) {
      if (!ALLOWED_AVATAR_TYPES.includes(avatarFile.type)) {
        nextErrors.foto = "Use uma imagem JPG, PNG ou WebP.";
      } else if (avatarFile.size > MAX_AVATAR_SIZE) {
        nextErrors.foto = "A imagem deve ter no máximo 5 MB.";
      }
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleAvatarPick(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.warning("Formato não suportado", "Use uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.warning("Imagem muito grande", "O avatar pode ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
    setFormErrors((current) => ({ ...current, foto: undefined }));
  }

  async function uploadAvatar(file, currentContaId, technicianId) {
    const extension = fileExtension(file);
    const path = `tecnicos/${currentContaId}/${technicianId}-${uniqueUploadSuffix()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;
    return path;
  }

  function buildPaymentPayload() {
    const paymentType = cleanText(form.pagamento_tipo);

    return {
      pagamento_tipo: paymentType,
      banco_pais: paymentType ? cleanText(form.banco_pais) : null,
      titular_pagamento: paymentType ? cleanText(form.titular_pagamento) : null,
      chave_pix: paymentType === "pix" ? cleanText(form.chave_pix) : null,
      banco_nome:
        paymentType === "conta_br" || paymentType === "iban"
          ? cleanText(form.banco_nome)
          : null,
      agencia: paymentType === "conta_br" ? cleanText(form.agencia) : null,
      conta_bancaria:
        paymentType === "conta_br" ? cleanText(form.conta_bancaria) : null,
      iban: paymentType === "iban" ? cleanAlphaNumeric(form.iban) : null,
      bic_swift:
        paymentType === "iban" ? cleanAlphaNumeric(form.bic_swift) : null,
      dados_pagamento:
        paymentType === "outro" || form.dados_pagamento.trim()
          ? cleanText(form.dados_pagamento)
          : null,
    };
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!validateForm()) return;

    const currentContaId = me?.usuario?.conta_id;
    const currentUsuarioId = me?.usuario?.id;

    if (!currentContaId) {
      toast.error("Conta não identificada", "Recarregue a página e tente novamente.");
      return;
    }

    setSaving(true);

    const payload = {
      nome: form.nome.trim(),
      email: cleanText(form.email)?.toLowerCase() || null,
      nacionalidade: cleanText(form.nacionalidade),
      telefone_pais: normalizeCountry(form.telefone_pais),
      telefone: phoneForDatabase(form.telefone, form.telefone_pais),
      documento_pais: normalizeCountry(form.documento_pais, "BR"),
      documento: cleanDocument(form.documento, form.documento_pais),
      ...buildPaymentPayload(),
      observacoes: cleanText(form.observacoes),
      ativo: Boolean(form.ativo),
      updated_by: currentUsuarioId || null,
      updated_at: new Date().toISOString(),
    };

    let uploadedPath = null;
    let createdId = null;

    try {
      if (technician) {
        const before = technicianAuditSnapshot(technician);
        const oldPhotoPath = technician.foto_url;

        if (avatarFile) {
          uploadedPath = await uploadAvatar(avatarFile, currentContaId, technician.id);
          payload.foto_url = uploadedPath;
        } else if (removeAvatar) {
          payload.foto_url = null;
        }

        const { data, error: updateError } = await supabase
          .from("tecnicos")
          .update(payload)
          .eq("id", technician.id)
          .eq("conta_id", currentContaId)
          .select(TECHNICIAN_SELECT)
          .single();

        if (updateError) throw updateError;

        if ((avatarFile || removeAvatar) && oldPhotoPath) {
          await removeAvatarFromStorage(supabase, oldPhotoPath);
        }

        await logAudit(supabase, me, {
          action: "atualizar",
          recordId: data.id,
          description: `Técnico ${data.nome} atualizado.`,
          before,
          after: technicianAuditSnapshot(data),
        });

        toast.success("Técnico atualizado", "As alterações foram salvas com sucesso.");
        onSaved?.(data, { created: false });
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("tecnicos")
          .insert({
            ...payload,
            conta_id: currentContaId,
            created_by: currentUsuarioId || null,
          })
          .select(TECHNICIAN_SELECT)
          .single();

        if (insertError) throw insertError;
        createdId = inserted.id;

        let finalData = inserted;

        if (avatarFile) {
          uploadedPath = await uploadAvatar(avatarFile, currentContaId, inserted.id);

          const { data: withPhoto, error: photoUpdateError } = await supabase
            .from("tecnicos")
            .update({
              foto_url: uploadedPath,
              updated_by: currentUsuarioId || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inserted.id)
            .eq("conta_id", currentContaId)
            .select(TECHNICIAN_SELECT)
            .single();

          if (photoUpdateError) throw photoUpdateError;
          finalData = withPhoto;
        }

        await logAudit(supabase, me, {
          action: "criar",
          recordId: finalData.id,
          description: `Técnico ${finalData.nome} criado.`,
          after: technicianAuditSnapshot(finalData),
        });

        toast.success("Técnico criado", "O profissional já está disponível para a operação.");
        onSaved?.(finalData, { created: true });
      }
    } catch (saveError) {
      console.error("Salvar técnico", saveError);

      if (uploadedPath) {
        await removeAvatarFromStorage(supabase, uploadedPath);
      }

      if (createdId) {
        const { error: rollbackError } = await supabase
          .from("tecnicos")
          .delete()
          .eq("id", createdId)
          .eq("conta_id", currentContaId);

        if (rollbackError) {
          console.warn("Rollback do técnico não concluído", rollbackError);
        }
      }

      toast.error(
        "Não foi possível salvar",
        saveError?.message || "Verifique os dados e tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={technician ? "Editar técnico" : "Novo técnico"}
      description="Dados pessoais, contato e informações de pagamento do profissional."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="technician-form"
            loading={saving}
            leftIcon={technician ? Pencil : Plus}
          >
            {technician ? "Salvar alterações" : "Criar técnico"}
          </Button>
        </>
      }
    >
      <Form id="technician-form" onSubmit={handleSave}>
        <FormSection
          title="Foto do técnico"
          description="A imagem é armazenada no bucket público de perfis. JPG, PNG ou WebP de até 5 MB."
        >
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center">
            <Avatar
              technician={{ nome: form.nome || "Técnico" }}
              photoUrl={avatarPreviewUrl}
              size="lg"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {avatarFile
                  ? avatarFile.name
                  : technician?.foto_url && !removeAvatar
                    ? "Foto atual do cadastro"
                    : "Nenhuma foto selecionada"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ao trocar a foto, um novo nome de arquivo é gerado para evitar cache da imagem anterior.
              </p>
              {formErrors.foto ? (
                <p className="mt-2 text-xs font-medium text-danger">{formErrors.foto}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarPick}
              />
              <Button
                type="button"
                variant="outline"
                leftIcon={avatarPreviewUrl ? Upload : ImagePlus}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreviewUrl ? "Trocar foto" : "Escolher foto"}
              </Button>

              {avatarPreviewUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  leftIcon={Trash2}
                  onClick={() => {
                    setAvatarFile(null);
                    setRemoveAvatar(true);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Remover
                </Button>
              ) : null}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Dados principais"
          description="Identificação e contato do profissional."
        >
          <FormGrid>
            <FormField label="Nome" required error={formErrors.nome}>
              <Input
                value={form.nome}
                onChange={(event) =>
                  setForm((current) => ({ ...current, nome: event.target.value }))
                }
                placeholder="Ex.: Mateus Silva"
              />
            </FormField>

            <FormField label="Nacionalidade">
              <Select
                value={form.nacionalidade}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nacionalidade: event.target.value,
                  }))
                }
              >
                <option value="">Não informada</option>
                <option value="BR">🇧🇷 Brasileira</option>
                <option value="IT">🇮🇹 Italiana</option>
              </Select>
            </FormField>

            <FormField label="E-mail" error={formErrors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="tecnico@email.com"
              />
            </FormField>

            <FormField label="Telefone">
              <div className="flex gap-2">
                <Select
                  value={form.telefone_pais}
                  onChange={(event) => {
                    const nextCountry = event.target.value;
                    setForm((current) => ({
                      ...current,
                      telefone_pais: nextCountry,
                      telefone: maskPhone(
                        String(current.telefone || "").replace(/\D/g, ""),
                        nextCountry
                      ),
                    }));
                  }}
                  className="w-32 shrink-0"
                  aria-label="País do telefone"
                >
                  <option value="BR">🇧🇷 +55</option>
                  <option value="IT">🇮🇹 +39</option>
                </Select>
                <Input
                  type="tel"
                  value={form.telefone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      telefone: maskPhone(event.target.value, current.telefone_pais),
                    }))
                  }
                  placeholder={form.telefone_pais === "BR" ? "(31) 99999-9999" : "333 123 4567"}
                />
              </div>
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Documento"
          description="O documento é formatado conforme o país selecionado e salvo sem máscara."
        >
          <FormGrid>
            <FormField label="País do documento">
              <Select
                value={form.documento_pais}
                onChange={(event) => {
                  const nextCountry = event.target.value;
                  setForm((current) => ({
                    ...current,
                    documento_pais: nextCountry,
                    documento: "",
                  }));
                }}
              >
                <option value="BR">🇧🇷 Brasil · CPF</option>
                <option value="IT">🇮🇹 Itália · Codice Fiscale</option>
              </Select>
            </FormField>

            <FormField label={countryMeta(form.documento_pais, "BR").documentLabel}>
              <Input
                value={form.documento}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    documento: maskPersonDocument(event.target.value, current.documento_pais),
                  }))
                }
                placeholder={form.documento_pais === "BR" ? "000.000.000-00" : "RSSMRA85T10A562S"}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Pagamento"
          description="Escolha a forma principal para repasses. Os campos são internos e não aparecem nos cards."
        >
          <FormGrid>
            <FormField label="Forma principal de pagamento">
              <Select
                value={form.pagamento_tipo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pagamento_tipo: event.target.value,
                  }))
                }
              >
                <option value="">Não informada</option>
                <option value="pix">PIX</option>
                <option value="conta_br">Conta bancária brasileira</option>
                <option value="iban">IBAN / SEPA / conta internacional</option>
                <option value="outro">Outro</option>
              </Select>
            </FormField>

            {form.pagamento_tipo ? (
              <FormField label="País da conta">
                <Select
                  value={form.banco_pais}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      banco_pais: event.target.value,
                    }))
                  }
                >
                  <option value="BR">🇧🇷 Brasil</option>
                  <option value="IT">🇮🇹 Itália</option>
                  <option value="OUTRO">🌍 Outro / global</option>
                </Select>
              </FormField>
            ) : null}

            {form.pagamento_tipo ? (
              <FormField label="Titular da conta">
                <Input
                  value={form.titular_pagamento}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      titular_pagamento: event.target.value,
                    }))
                  }
                  placeholder="Nome do titular"
                />
              </FormField>
            ) : null}

            {form.pagamento_tipo === "pix" ? (
              <FormField label="Chave PIX" required error={formErrors.chave_pix}>
                <Input
                  value={form.chave_pix}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      chave_pix: event.target.value,
                    }))
                  }
                  placeholder="CPF, telefone, e-mail ou chave aleatória"
                />
              </FormField>
            ) : null}

            {form.pagamento_tipo === "conta_br" ? (
              <>
                <FormField label="Banco" required error={formErrors.banco_nome}>
                  <Input
                    value={form.banco_nome}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        banco_nome: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Sicoob"
                  />
                </FormField>

                <FormField label="Agência" required error={formErrors.agencia}>
                  <Input
                    value={form.agencia}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        agencia: event.target.value,
                      }))
                    }
                    placeholder="0001"
                  />
                </FormField>

                <FormField label="Conta" required error={formErrors.conta_bancaria}>
                  <Input
                    value={form.conta_bancaria}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        conta_bancaria: event.target.value,
                      }))
                    }
                    placeholder="12345-6"
                  />
                </FormField>
              </>
            ) : null}

            {form.pagamento_tipo === "iban" ? (
              <>
                <FormField label="Banco / instituição">
                  <Input
                    value={form.banco_nome}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        banco_nome: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Intesa Sanpaolo / Wise"
                  />
                </FormField>

                <FormField label="IBAN" required error={formErrors.iban}>
                  <Input
                    value={form.iban}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        iban: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="IT60X0542811101000000123456"
                  />
                </FormField>

                <FormField label="BIC / SWIFT">
                  <Input
                    value={form.bic_swift}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bic_swift: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="BCITITMM"
                  />
                </FormField>
              </>
            ) : null}
          </FormGrid>

          {form.pagamento_tipo ? (
            <FormField label="Informações adicionais de pagamento">
              <Textarea
                value={form.dados_pagamento}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dados_pagamento: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Observações sobre o recebimento, conta global, referência, instruções internas..."
              />
            </FormField>
          ) : null}
        </FormSection>

        <FormSection title="Operação" description="Status e observações internas.">
          <FormGrid>
            <FormField label="Técnico ativo">
              <div className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background px-3">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, ativo: checked }))
                  }
                  id="tecnico-ativo"
                />

                <label
                  htmlFor="tecnico-ativo"
                  className="cursor-pointer text-sm text-muted-foreground"
                >
                  {form.ativo
                    ? "Disponível para novos serviços"
                    : "Mantido apenas para histórico"}
                </label>
              </div>
            </FormField>
          </FormGrid>

          <FormField label="Observações">
            <Textarea
              value={form.observacoes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  observacoes: event.target.value,
                }))
              }
              rows={4}
              placeholder="Especialidades, disponibilidade, região de atuação, informações internas..."
            />
          </FormField>
        </FormSection>
      </Form>
    </Modal>
  );
}
