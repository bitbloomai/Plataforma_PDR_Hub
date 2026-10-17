"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Form,
  FormField,
  FormGrid,
  FormSection,
  Input,
  SearchableSelect,
  Select,
  Switch,
  Textarea,
} from "@/components/shared";
import {
  applyPattern,
  countryOptions,
  findCountry,
  localPhone,
  phoneWithDialCode,
} from "@/lib/countries";
import { createClient } from "@/lib/supabase/client";

const ACCOUNT_FIELDS = [
  "nome",
  "nome_fantasia",
  "email",
  "telefone",
  "documento",
  "endereco",
  "cidade",
  "estado_regiao",
  "cep",
  "pais",
  "ativo",
];

const CONFIG_FIELDS = [
  "moeda",
  "locale",
  "timezone",
  "formato_data",
  "nome_sistema",
  "dias_vencimento_servico",
  "observacoes",
];

const DEFAULT_ACCOUNT = {
  nome: "",
  nome_fantasia: "",
  email: "",
  telefone: "",
  documento: "",
  endereco: "",
  cidade: "",
  estado_regiao: "",
  cep: "",
  pais: "Italia",
  ativo: true,
};

const DEFAULT_CONFIG = {
  moeda: "EUR",
  locale: "it-IT",
  timezone: "Europe/Rome",
  formato_data: "DD/MM/YYYY",
  nome_sistema: "Gestao de Servicos",
  dias_vencimento_servico: 0,
  observacoes: "",
};

function normalizeForm(data, defaults) {
  return Object.keys(defaults).reduce((payload, key) => {
    payload[key] = data?.[key] ?? defaults[key];
    return payload;
  }, {});
}

/**
 * MOEDAS
 */
const CURRENCY_OPTIONS = [
  { value: "EUR", label: "\u20AC EUR - Euro" },
  { value: "BRL", label: "R$ BRL - Real brasileiro" },
  { value: "USD", label: "$ USD - Dolar americano" },
  { value: "ARS", label: "$ ARS - Peso argentino" },
  { value: "CAD", label: "$ CAD - Dolar canadense" },
  { value: "MXN", label: "$ MXN - Peso mexicano" },
  { value: "CHF", label: "CHF - Franco suico" },
  { value: "GBP", label: "\u00A3 GBP - Libra esterlina" },
  { value: "AUD", label: "$ AUD - Dolar australiano" },
  { value: "JPY", label: "\u00A5 JPY - Iene japones" },
  { value: "CLP", label: "$ CLP - Peso chileno" },
];

/**
 * LOCALE
 */
const LOCALE_OPTIONS = [
  { value: "it-IT", label: "\uD83C\uDDEE\uD83C\uDDF9 Italia - Italiano", timezone: "Europe/Rome", dateFormat: "DD/MM/YYYY" },
  { value: "pt-BR", label: "\uD83C\uDDE7\uD83C\uDDF7 Brasil - Portugues", timezone: "America/Sao_Paulo", dateFormat: "DD/MM/YYYY" },
  { value: "en-US", label: "\uD83C\uDDFA\uD83C\uDDF8 English (Estados Unidos)", timezone: "America/Chicago", dateFormat: "MM/DD/YYYY" },
  { value: "es-AR", label: "\uD83C\uDDE6\uD83C\uDDF7 Argentina - Espanol", timezone: "America/Argentina/Buenos_Aires", dateFormat: "DD/MM/YYYY" },
  { value: "en-CA", label: "\uD83C\uDDE8\uD83C\uDDE6 Canada - English", timezone: "America/Toronto", dateFormat: "YYYY-MM-DD" },
  { value: "fr-CA", label: "\uD83C\uDDE8\uD83C\uDDE6 Canada - Francais", timezone: "America/Toronto", dateFormat: "YYYY-MM-DD" },
  { value: "de-DE", label: "\uD83C\uDDE9\uD83C\uDDEA Alemanha - Deutsch", timezone: "Europe/Berlin", dateFormat: "DD/MM/YYYY" },
  { value: "fr-FR", label: "\uD83C\uDDEB\uD83C\uDDF7 Franca - Francais", timezone: "Europe/Paris", dateFormat: "DD/MM/YYYY" },
  { value: "es-ES", label: "\uD83C\uDDEA\uD83C\uDDF8 Espanha - Espanol", timezone: "Europe/Madrid", dateFormat: "DD/MM/YYYY" },
  { value: "en-GB", label: "\uD83C\uDDEC\uD83C\uDDE7 Reino Unido - English", timezone: "Europe/London", dateFormat: "DD/MM/YYYY" },
  { value: "es-MX", label: "\uD83C\uDDF2\uD83C\uDDFD Mexico - Espanol", timezone: "America/Mexico_City", dateFormat: "DD/MM/YYYY" },
  { value: "de-CH", label: "\uD83C\uDDE8\uD83C\uDDED Suica - Deutsch", timezone: "Europe/Zurich", dateFormat: "DD/MM/YYYY" },
  { value: "en-AU", label: "\uD83C\uDDE6\uD83C\uDDFA Australia - English", timezone: "Australia/Sydney", dateFormat: "DD/MM/YYYY" },
  { value: "es-CL", label: "\uD83C\uDDE8\uD83C\uDDF1 Chile - Espanol", timezone: "America/Santiago", dateFormat: "DD/MM/YYYY" },
];

/**
 * TIMEZONE
 */
const TIMEZONE_OPTIONS = [
  { value: "Europe/Rome", label: "Europe/Rome - Italia" },
  {
    value: "America/Sao_Paulo",
    label: "America/Sao_Paulo - Brasil",
  },
  { value: "America/Chicago", label: "America/Chicago - Estados Unidos" },
  { value: "America/New_York", label: "America/New_York - Estados Unidos" },
  { value: "America/Denver", label: "America/Denver - Estados Unidos" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos_Aires - Argentina" },
  { value: "America/Toronto", label: "America/Toronto - Canada" },
  { value: "America/Mexico_City", label: "America/Mexico_City - Mexico" },
  { value: "America/Santiago", label: "America/Santiago - Chile" },
  { value: "Europe/Berlin", label: "Europe/Berlin - Alemanha" },
  { value: "Europe/Paris", label: "Europe/Paris - Franca" },
  { value: "Europe/Madrid", label: "Europe/Madrid - Espanha" },
  { value: "Europe/London", label: "Europe/London - Reino Unido" },
  { value: "Europe/Zurich", label: "Europe/Zurich - Suica" },
  { value: "America/Asuncion", label: "America/Asuncion - Paraguai" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul - Turquia" },
  { value: "Australia/Sydney", label: "Australia/Sydney - Australia" },
  { value: "UTC", label: "UTC" },
];

/**
 * FORMATO DE DATA
 */
const DATE_FORMAT_OPTIONS = [
  {
    value: "DD/MM/YYYY",
    label: "DD/MM/YYYY - 27/08/2026",
  },
  {
    value: "YYYY-MM-DD",
    label: "YYYY-MM-DD - 2026-08-27",
  },
  {
    value: "MM/DD/YYYY",
    label: "MM/DD/YYYY - 08/27/2026",
  },
];

function getLocaleDefaults(locale) {
  const option = LOCALE_OPTIONS.find((item) => item.value === locale);
  if (option?.timezone) return option;

  if (locale === "pt-BR") {
    return { timezone: "America/Sao_Paulo", dateFormat: "DD/MM/YYYY" };
  }

  if (locale === "it-IT") {
    return { timezone: "Europe/Rome", dateFormat: "DD/MM/YYYY" };
  }

  if (locale === "en-US") {
    return { timezone: "America/Chicago", dateFormat: "MM/DD/YYYY" };
  }

  return { timezone: "Europe/Rome", dateFormat: "DD/MM/YYYY" };
}

export default function ConfiguracoesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [me, setMe] = useState(null);
  const [accountForm, setAccountForm] =
    useState(DEFAULT_ACCOUNT);

  const [configForm, setConfigForm] =
    useState(DEFAULT_CONFIG);

  const [initialSnapshot, setInitialSnapshot] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /**
   * País selecionado: define rótulos, máscaras e a lista de regiões.
   */
  const country = useMemo(() => findCountry(accountForm.pais), [accountForm.pais]);

  const accountCountryOptions = useMemo(() => {
    const options = countryOptions();
    // Registro antigo com país fora da lista continua visível no select.
    if (accountForm.pais && !country) {
      return [{ value: accountForm.pais, label: accountForm.pais }, ...options];
    }
    return options;
  }, [accountForm.pais, country]);

  /**
   * Sugestão de preferências (idioma, moeda, fuso) conforme o país da conta.
   */
  const suggestedPreferences = useMemo(() => {
    const defaults = country?.defaults || {};
    const changes = {};
    if (defaults.locale && LOCALE_OPTIONS.some((item) => item.value === defaults.locale) && defaults.locale !== configForm.locale) {
      changes.locale = defaults.locale;
    }
    if (defaults.moeda && CURRENCY_OPTIONS.some((item) => item.value === defaults.moeda) && defaults.moeda !== configForm.moeda) {
      changes.moeda = defaults.moeda;
    }
    if (defaults.timezone && TIMEZONE_OPTIONS.some((item) => item.value === defaults.timezone) && defaults.timezone !== configForm.timezone) {
      changes.timezone = defaults.timezone;
    }
    return Object.keys(changes).length ? changes : null;
  }, [configForm.locale, configForm.moeda, configForm.timezone, country]);

  function changeCountry(nextCountryName) {
    const next = findCountry(nextCountryName);

    setAccountForm((current) => {
      const local = localPhone(current.telefone, current.pais);
      const regionStillValid = next?.regions?.some((item) => item.value === current.estado_regiao);

      return {
        ...current,
        pais: nextCountryName,
        telefone: next ? phoneWithDialCode(local, nextCountryName) : current.telefone,
        estado_regiao: regionStillValid ? current.estado_regiao : "",
        documento: next ? applyPattern(current.documento, next.documentPattern) : current.documento,
        cep: next ? applyPattern(current.cep, next.postalPattern) : current.cep,
      };
    });
  }

  function applySuggestedPreferences() {
    if (!suggestedPreferences) return;
    setConfigForm((current) => {
      const next = { ...current, ...suggestedPreferences };
      if (suggestedPreferences.locale) {
        next.formato_data = getLocaleDefaults(suggestedPreferences.locale).dateFormat || current.formato_data;
      }
      return next;
    });
  }

  /**
   * Lista de regiões/estados baseada no país informado.
   */
  const regionOptions = useMemo(() => {
    const options = country?.regions || [];

    /**
     * Se já existir um valor salvo no banco e ele não
     * estiver na lista, adiciona temporariamente para
     * evitar que o Select fique vazio.
     */
    const currentRegion = accountForm.estado_regiao;

    if (
      currentRegion &&
      !options.some(
        (option) => option.value === currentRegion
      )
    ) {
      return [
        {
          value: currentRegion,
          label: currentRegion,
        },
        ...options,
      ];
    }

    return options;
  }, [accountForm.estado_regiao, country]);

  const documentPlaceholder =
    country?.documentPlaceholder ||
    country?.documentPattern?.replace(/#/g, "0").replace(/\*/g, "X") ||
    "";
  const postalPlaceholder =
    country?.postalPlaceholder ||
    country?.postalPattern?.replace(/#/g, "0").replace(/\*/g, "X") ||
    "";

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const meResponse = await fetch("/api/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (!meResponse.ok) {
        throw new Error(
          "Não foi possível carregar o usuário."
        );
      }

      const meData = await meResponse.json();

      setMe(meData);

      const [
        { data: account, error: accountError },
        { data: config, error: configError },
      ] = await Promise.all([
        supabase
          .from("contas")
          .select(ACCOUNT_FIELDS.join(","))
          .eq("id", meData.usuario.conta_id)
          .maybeSingle(),

        supabase
          .from("configuracoes")
          .select(
            `id, conta_id, ${CONFIG_FIELDS.join(",")}`
          )
          .eq("conta_id", meData.usuario.conta_id)
          .maybeSingle(),
      ]);

      if (accountError) {
        throw accountError;
      }

      if (configError) {
        throw configError;
      }

      const nextAccount = normalizeForm(
        account,
        DEFAULT_ACCOUNT
      );

      const nextConfig = normalizeForm(
        config,
        DEFAULT_CONFIG
      );

      setAccountForm(nextAccount);
      setConfigForm(nextConfig);

      setInitialSnapshot({
        account: nextAccount,
        config: nextConfig,
      });
    } catch (error) {
      console.error(
        "Configuracoes loadData",
        error
      );

      toast.error(
        error.message ||
          "Não foi possível carregar as configurações."
      );
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

  async function logAudit(after) {
    if (!me?.usuario?.conta_id) return;

    await supabase.from("auditoria").insert({
      conta_id: me.usuario.conta_id,
      usuario_id: me.usuario.id,
      entidade: "configuracoes",
      acao: "atualizar",
      registro_id: me.usuario.conta_id,
      descricao:
        "Configurações da conta atualizadas.",
      dados_anteriores: initialSnapshot,
      dados_novos: after,
    });
  }

  async function saveSettings(event) {
    event.preventDefault();

    if (!me?.usuario?.conta_id) return;

    setSaving(true);

    try {
      const now = new Date().toISOString();

      const accountPayload = {
        ...accountForm,
        updated_at: now,
      };

      const configPayload = {
        ...configForm,
        conta_id: me.usuario.conta_id,

        moeda: CURRENCY_OPTIONS.some(
          (option) =>
            option.value === configForm.moeda
        )
          ? configForm.moeda
          : "EUR",

        locale: LOCALE_OPTIONS.some(
          (option) =>
            option.value === configForm.locale
        )
          ? configForm.locale
          : "it-IT",

        timezone: TIMEZONE_OPTIONS.some(
          (option) =>
            option.value === configForm.timezone
        )
          ? configForm.timezone
          : "Europe/Rome",

        formato_data: DATE_FORMAT_OPTIONS.some(
          (option) =>
            option.value === configForm.formato_data
        )
          ? configForm.formato_data
          : "DD/MM/YYYY",

        dias_vencimento_servico: Number(
          configForm.dias_vencimento_servico || 0
        ),

        updated_at: now,
      };

      const [
        { error: accountError },
        { error: configError },
      ] = await Promise.all([
        supabase
          .from("contas")
          .update(accountPayload)
          .eq("id", me.usuario.conta_id),

        supabase
          .from("configuracoes")
          .upsert(configPayload, {
            onConflict: "conta_id",
          }),
      ]);

      if (accountError) {
        throw accountError;
      }

      if (configError) {
        throw configError;
      }

      await logAudit({
        account: accountPayload,
        config: configPayload,
      });

      sessionStorage.removeItem("panel.me.v1");

      toast.success("Configurações salvas.");

      await loadData();
    } catch (error) {
      console.error(
        "Configuracoes saveSettings",
        error
      );

      toast.error(
        error.message ||
          "Não foi possível salvar as configurações."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-5 p-4 sm:p-5 lg:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {me?.conta?.nome_fantasia ||
              me?.conta?.nome ||
              "Conta"}
          </p>

          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Configurações
          </h2>
        </div>

        <Button
          variant="outline"
          leftIcon={RefreshCw}
          onClick={loadData}
          loading={loading}
        >
          Atualizar
        </Button>
      </div>

      <Form
        onSubmit={saveSettings}
        className="space-y-5"
      >
        {/* CONTA */}
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <FormSection
            title="Conta"
            description="Dados principais usados em cadastros, filtros e exibição interna."
          >
            <FormGrid>
              <FormField
                label="Nome da conta"
                required
              >
                <Input
                  value={accountForm.nome}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      nome: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>

              <FormField label="Nome fantasia">
                <Input
                  value={accountForm.nome_fantasia}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      nome_fantasia:
                        event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Email">
                <Input
                  type="email"
                  value={accountForm.email}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Telefone">
                <div className="flex min-w-0">
                  {country ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-l-lg border border-r-0 border-border bg-surface-2 px-3 text-sm text-muted-foreground">
                      <span aria-hidden="true">{country.flag}</span>+{country.dialCode}
                    </span>
                  ) : null}
                  <Input
                    type="tel"
                    value={country ? localPhone(accountForm.telefone, accountForm.pais) : accountForm.telefone}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        telefone: country
                          ? phoneWithDialCode(event.target.value, current.pais)
                          : event.target.value,
                      }))
                    }
                    placeholder={country?.phonePattern.replace(/#/g, "0")}
                    className={country ? "rounded-l-none" : undefined}
                    aria-label={country ? `Telefone (+${country.dialCode})` : "Telefone"}
                  />
                </div>
              </FormField>

              <FormField label="País">
                <Select
                  value={accountForm.pais}
                  onChange={(event) => changeCountry(event.target.value)}
                  options={accountCountryOptions}
                  placeholder="Selecione o país"
                />
              </FormField>

              <FormField label={country?.documentLabel || "Documento"}>
                <Input
                  value={accountForm.documento}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      documento: country
                        ? applyPattern(event.target.value, country.documentPattern)
                        : event.target.value,
                    }))
                  }
                  placeholder={documentPlaceholder}
                  maxLength={country?.documentPattern.length}
                />
              </FormField>
            </FormGrid>

            <FormGrid columns={3}>
              <FormField label={country?.regionLabel || "Estado / Região"}>
                {regionOptions.length ? (
                  <SearchableSelect
                    value={accountForm.estado_regiao}
                    onChange={(value) =>
                      setAccountForm((current) => ({
                        ...current,
                        estado_regiao: value || "",
                      }))
                    }
                    options={regionOptions}
                    placeholder={`Selecione ${(country?.regionLabel || "a região").toLowerCase()}`}
                    searchPlaceholder="Buscar..."
                  />
                ) : (
                  <Input
                    value={accountForm.estado_regiao}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        estado_regiao: event.target.value,
                      }))
                    }
                  />
                )}
              </FormField>

              <FormField label="Cidade">
                <Input
                  value={accountForm.cidade}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      cidade: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label={country?.postalLabel || "Código postal"}>
                <Input
                  value={accountForm.cep}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      cep: country
                        ? applyPattern(event.target.value, country.postalPattern)
                        : event.target.value,
                    }))
                  }
                  placeholder={postalPlaceholder}
                  maxLength={country?.postalPattern.length}
                />
              </FormField>
            </FormGrid>

            <FormField label="Endereço">
              <Input
                value={accountForm.endereco}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    endereco: event.target.value,
                  }))
                }
                placeholder="Rua, número, complemento"
              />
            </FormField>

            {suggestedPreferences ? (
              <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foreground">
                  Ajustar as preferências para {country.flag} {country.label}?{" "}
                  <span className="text-muted-foreground">
                    {[
                      suggestedPreferences.locale && `Idioma ${suggestedPreferences.locale}`,
                      suggestedPreferences.moeda && `Moeda ${suggestedPreferences.moeda}`,
                      suggestedPreferences.timezone && `Fuso ${suggestedPreferences.timezone}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </p>
                <Button type="button" variant="outline" size="sm" leftIcon={Wand2} onClick={applySuggestedPreferences}>
                  Aplicar
                </Button>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-background p-4">
              <Switch
                label="Conta ativa"
                description="Contas inativas bloqueiam o acesso dos usuários vinculados."
                checked={accountForm.ativo}
                onCheckedChange={(checked) =>
                  setAccountForm((current) => ({
                    ...current,
                    ativo: checked,
                  }))
                }
              />
            </div>
          </FormSection>
        </section>

        {/* PREFERÊNCIAS */}
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <FormSection
            title="Preferências da plataforma"
            description="Parâmetros padrão usados nos módulos operacionais e financeiros."
          >
            <FormGrid columns={3}>
              <FormField label="Nome do sistema">
                <Input
                  value={configForm.nome_sistema}
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      nome_sistema:
                        event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Moeda">
                <Select
                  value={configForm.moeda}
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      moeda: event.target.value,
                    }))
                  }
                  options={CURRENCY_OPTIONS}
                />
              </FormField>

              {/* SELECT DE LOCALE */}
              <FormField label="Locale">
                <Select
                  value={configForm.locale}
                  onChange={(event) => {
                    const locale = event.target.value;
                    const defaults = getLocaleDefaults(locale);

                    setConfigForm((current) => ({
                      ...current,
                      locale,
                      timezone: defaults.timezone,
                      formato_data: defaults.dateFormat,
                    }));
                  }}
                  options={LOCALE_OPTIONS}
                />
              </FormField>

              <FormField label="Timezone">
                <Select
                  value={configForm.timezone}
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                  options={TIMEZONE_OPTIONS}
                />
              </FormField>

              {/* SELECT DE FORMATO DE DATA */}
              <FormField label="Formato de data">
                <Select
                  value={configForm.formato_data}
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      formato_data:
                        event.target.value,
                    }))
                  }
                  options={DATE_FORMAT_OPTIONS}
                />
              </FormField>

              <FormField label="Dias para vencimento">
                <Input
                  type="number"
                  min={0}
                  value={
                    configForm.dias_vencimento_servico
                  }
                  onChange={(event) =>
                    setConfigForm((current) => ({
                      ...current,
                      dias_vencimento_servico:
                        event.target.value,
                    }))
                  }
                />
              </FormField>
            </FormGrid>

            <FormField label="Observações">
              <Textarea
                value={configForm.observacoes}
                onChange={(event) =>
                  setConfigForm((current) => ({
                    ...current,
                    observacoes:
                      event.target.value,
                  }))
                }
                rows={4}
              />
            </FormField>
          </FormSection>
        </section>

        <div className="sticky bottom-4 flex justify-end">
          <Button
            type="submit"
            leftIcon={Save}
            loading={saving}
            disabled={loading}
          >
            Salvar configurações
          </Button>
        </div>
      </Form>
    </main>
  );
}
