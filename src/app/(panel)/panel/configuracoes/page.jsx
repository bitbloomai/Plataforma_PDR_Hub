"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Form,
  FormField,
  FormGrid,
  FormSection,
  Input,
  Select,
  Switch,
  Textarea,
} from "@/components/shared";
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

/**
 * REGIÕES DA ITÁLIA
 */
const ITALY_REGION_OPTIONS = [
  { value: "Abruzzo", label: "Abruzzo" },
  { value: "Basilicata", label: "Basilicata" },
  { value: "Calabria", label: "Calabria" },
  { value: "Campania", label: "Campania" },
  {
    value: "Emilia-Romagna",
    label: "Emilia-Romagna",
  },
  {
    value: "Friuli-Venezia Giulia",
    label: "Friuli-Venezia Giulia",
  },
  { value: "Lazio", label: "Lazio" },
  { value: "Liguria", label: "Liguria" },
  { value: "Lombardia", label: "Lombardia" },
  { value: "Marche", label: "Marche" },
  { value: "Molise", label: "Molise" },
  { value: "Piemonte", label: "Piemonte" },
  { value: "Puglia", label: "Puglia" },
  { value: "Sardegna", label: "Sardegna" },
  { value: "Sicilia", label: "Sicilia" },
  { value: "Toscana", label: "Toscana" },
  {
    value: "Trentino-Alto Adige",
    label: "Trentino-Alto Adige",
  },
  { value: "Umbria", label: "Umbria" },
  {
    value: "Valle d'Aosta",
    label: "Valle d'Aosta",
  },
  { value: "Veneto", label: "Veneto" },
];

/**
 * ESTADOS DO BRASIL
 */
const BRAZIL_STATE_OPTIONS = [
  { value: "AC", label: "AC - Acre" },
  { value: "AL", label: "AL - Alagoas" },
  { value: "AP", label: "AP - Amapá" },
  { value: "AM", label: "AM - Amazonas" },
  { value: "BA", label: "BA - Bahia" },
  { value: "CE", label: "CE - Ceará" },
  { value: "DF", label: "DF - Distrito Federal" },
  { value: "ES", label: "ES - Espírito Santo" },
  { value: "GO", label: "GO - Goiás" },
  { value: "MA", label: "MA - Maranhão" },
  { value: "MT", label: "MT - Mato Grosso" },
  {
    value: "MS",
    label: "MS - Mato Grosso do Sul",
  },
  { value: "MG", label: "MG - Minas Gerais" },
  { value: "PA", label: "PA - Pará" },
  { value: "PB", label: "PB - Paraíba" },
  { value: "PR", label: "PR - Paraná" },
  { value: "PE", label: "PE - Pernambuco" },
  { value: "PI", label: "PI - Piauí" },
  {
    value: "RJ",
    label: "RJ - Rio de Janeiro",
  },
  {
    value: "RN",
    label: "RN - Rio Grande do Norte",
  },
  {
    value: "RS",
    label: "RS - Rio Grande do Sul",
  },
  { value: "RO", label: "RO - Rondônia" },
  { value: "RR", label: "RR - Roraima" },
  {
    value: "SC",
    label: "SC - Santa Catarina",
  },
  { value: "SP", label: "SP - São Paulo" },
  { value: "SE", label: "SE - Sergipe" },
  { value: "TO", label: "TO - Tocantins" },
];

/**
 * Retorna as opções de estado/região de acordo com o país.
 */
function getRegionOptions(country) {
  const normalizedCountry = String(country || "")
    .trim()
    .toLowerCase();

  if (
    normalizedCountry === "brasil" ||
    normalizedCountry === "brazil"
  ) {
    return BRAZIL_STATE_OPTIONS;
  }

  if (
    normalizedCountry === "italia" ||
    normalizedCountry === "itália" ||
    normalizedCountry === "italy"
  ) {
    return ITALY_REGION_OPTIONS;
  }

  /**
   * Se o país não estiver reconhecido,
   * disponibilizamos as duas listas para não
   * quebrar um registro antigo.
   */
  return [
    ...ITALY_REGION_OPTIONS,
    ...BRAZIL_STATE_OPTIONS,
  ];
}

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
   * Lista de regiões/estados baseada no país informado.
   */
  const regionOptions = useMemo(() => {
    const options = getRegionOptions(accountForm.pais);

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
  }, [accountForm.pais, accountForm.estado_regiao]);

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
                <Input
                  value={accountForm.telefone}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      telefone: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Documento">
                <Input
                  value={accountForm.documento}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      documento: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="País">
                <Input
                  value={accountForm.pais}
                  onChange={(event) => {
                    const newCountry =
                      event.target.value;

                    setAccountForm((current) => ({
                      ...current,
                      pais: newCountry,
                    }));
                  }}
                />
              </FormField>
            </FormGrid>

            <FormGrid columns={4}>
              <FormField
                label="Endereço"
                className="sm:col-span-2"
              >
                <Input
                  value={accountForm.endereco}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      endereco: event.target.value,
                    }))
                  }
                />
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

              {/* SELECT DE ESTADO / REGIÃO */}
              <FormField label="Estado / Região">
                <Select
                  value={accountForm.estado_regiao}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      estado_regiao:
                        event.target.value,
                    }))
                  }
                  options={regionOptions}
                />
              </FormField>

              <FormField label="CEP">
                <Input
                  value={accountForm.cep}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      cep: event.target.value,
                    }))
                  }
                />
              </FormField>
            </FormGrid>

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
