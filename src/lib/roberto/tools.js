import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { buildDreSnapshot } from "@/lib/dre-rules";
import { todayISO } from "@/lib/dates";
import {
  buildServiceFinancialRows,
  buildServiceTechnicianRows,
  cleanText,
  isSettledStatus,
  normalizePlate,
  roundMoney,
  safeNumber,
  SERVICE_STATUSES,
  validateServiceDraft,
} from "@/lib/service-rules";
import { logRobertoAudit, RobertoError } from "@/lib/roberto/context";

const MAX_RESULTS = 50;
const AUTO_ORIGINS = ["servico", "repasse_tecnico"];

const stringProperty = (description) => ({ type: "string", description });
const booleanProperty = (description) => ({ type: "boolean", description });
const numberProperty = (description) => ({ type: "number", description });
const idProperty = (description) => ({ type: "string", description });

function objectSchema(properties, required = []) {
  return { type: "object", properties, required, additionalProperties: false };
}

function tool(name, description, parameters) {
  return { type: "function", function: { name, description, parameters } };
}

const periodProperties = {
  periodo: {
    type: "string",
    enum: [
      "todos",
      "hoje",
      "ontem",
      "esta_semana",
      "este_mes",
      "mes_passado",
      "ultimos_30_dias",
      "personalizado",
    ],
    description: "Período predefinido. Use personalizado com data_inicio e data_fim.",
  },
  data_inicio: stringProperty("Data inicial YYYY-MM-DD para período personalizado."),
  data_fim: stringProperty("Data final YYYY-MM-DD para período personalizado."),
};

export const ROBERTO_TOOLS = [
  tool(
    "buscar_oficinas",
    "Busca ou lista oficinas da conta. Use antes de qualquer escrita quando houver nome ambíguo.",
    objectSchema({
      busca: stringProperty("Parte do nome da oficina; vazio lista."),
      ativo: booleanProperty("Filtrar por status ativo/inativo."),
      id: idProperty("ID exato para detalhes."),
      limite: numberProperty("Máximo de resultados, entre 1 e 50."),
    })
  ),
  tool(
    "buscar_tecnicos",
    "Busca técnicos e, opcionalmente, seus serviços e repasses. Não solicite dados bancários sem pedido explícito.",
    objectSchema({
      busca: stringProperty("Parte do nome do técnico; vazio lista."),
      ativo: booleanProperty("Filtrar por status ativo/inativo."),
      id: idProperty("ID exato para detalhes."),
      incluir_resumo: booleanProperty("Incluir totais de serviços e repasses."),
      limite: numberProperty("Máximo de resultados, entre 1 e 50."),
      ...periodProperties,
    })
  ),
  tool(
    "buscar_veiculos",
    "Busca veículos por placa, marca ou modelo e pode trazer histórico resumido.",
    objectSchema({
      busca: stringProperty("Placa, marca ou modelo; vazio lista."),
      id: idProperty("ID exato para detalhes."),
      incluir_historico: booleanProperty("Incluir serviços recentes do veículo."),
      limite: numberProperty("Máximo de resultados, entre 1 e 50."),
    })
  ),
  tool(
    "buscar_servicos",
    "Consulta serviços com oficina, veículo, técnicos, valores, status e financeiro automático.",
    objectSchema({
      busca: stringProperty("Texto livre para placa, oficina, veículo ou descrição."),
      id: idProperty("ID exato do serviço."),
      oficina_id: idProperty("ID exato da oficina."),
      tecnico_id: idProperty("ID exato do técnico."),
      veiculo_id: idProperty("ID exato do veículo."),
      status: { type: "string", enum: SERVICE_STATUSES, description: "Status do serviço." },
      limite: numberProperty("Máximo de resultados, entre 1 e 50."),
      ...periodProperties,
    })
  ),
  tool(
    "consultar_financeiro",
    "Consulta contas a receber/pagar, atrasos, recebimentos, pagamentos, rankings e margens.",
    objectSchema({
      tipo: { type: "string", enum: ["todos", "receita", "despesa"] },
      status: { type: "string", enum: ["todos", "pendente", "pago", "atrasado"] },
      oficina_id: idProperty("Filtrar pela oficina exata."),
      tecnico_id: idProperty("Filtrar pelo técnico exato."),
      origem: { type: "string", enum: ["todos", "servico", "repasse_tecnico", "manual"] },
      limite: numberProperty("Máximo de lançamentos detalhados, entre 1 e 50."),
      ...periodProperties,
    })
  ),
  tool(
    "consultar_dre",
    "Calcula a DRE pelo mesmo critério da tela: competência, grupos e categorias reais.",
    objectSchema({ ...periodProperties })
  ),
  tool(
    "consultar_auditoria",
    "Consulta o histórico de auditoria da conta.",
    objectSchema({
      busca: stringProperty("Texto na descrição, ação ou entidade."),
      entidade: stringProperty("Módulo/entidade, por exemplo servicos ou financeiro."),
      acao: stringProperty("Ação, por exemplo criar, atualizar, pagar ou excluir."),
      registro_id: idProperty("ID exato do registro afetado."),
      limite: numberProperty("Máximo de resultados, entre 1 e 50."),
      ...periodProperties,
    })
  ),
  tool(
    "consultar_usuarios",
    "Lista usuários da conta sem expor credenciais ou metadados sensíveis.",
    objectSchema({ busca: stringProperty("Nome ou e-mail."), ativo: booleanProperty("Status."), limite: numberProperty("1 a 50.") })
  ),
  tool(
    "consultar_configuracoes",
    "Consulta dados operacionais e preferências da conta, como moeda, locale, timezone e vencimento.",
    objectSchema({})
  ),
  tool(
    "ajuda_plataforma",
    "Explica como usar uma funcionalidade real do PDR Hub.",
    objectSchema({
      assunto: {
        type: "string",
        enum: ["servicos", "oficinas", "tecnicos", "veiculos", "financeiro", "dre", "auditoria", "usuarios", "configuracoes", "busca"],
      },
    }, ["assunto"])
  ),
  tool(
    "preparar_oficina",
    "Valida e prepara criação ou edição de oficina. Nunca grava antes da confirmação do usuário.",
    objectSchema({
      operacao: { type: "string", enum: ["criar", "editar"] },
      id: idProperty("Obrigatório na edição."),
      nome: stringProperty("Nome da oficina, obrigatório na criação."),
      responsavel: stringProperty("Responsável."),
      email: stringProperty("E-mail."),
      telefone: stringProperty("Telefone."),
      documento: stringProperty("Partita IVA ou Codice Fiscale."),
      pec: stringProperty("PEC."),
      codice_destinatario: stringProperty("Codice Destinatario/SDI, até 7 caracteres."),
      endereco: stringProperty("Endereço."),
      cidade: stringProperty("Cidade."),
      estado_regiao: stringProperty("Região/estado."),
      cep: stringProperty("CEP/CAP."),
      pais: stringProperty("País."),
      observacoes: stringProperty("Observações internas."),
      ativo: booleanProperty("Status ativo."),
    }, ["operacao"])
  ),
  tool(
    "preparar_tecnico",
    "Valida e prepara criação ou edição de técnico. Forma de pagamento é opcional; campos bancários dependem do tipo.",
    objectSchema({
      operacao: { type: "string", enum: ["criar", "editar"] },
      id: idProperty("Obrigatório na edição."),
      nome: stringProperty("Nome, obrigatório na criação."),
      email: stringProperty("E-mail."),
      telefone: stringProperty("Telefone."),
      telefone_pais: { type: "string", enum: ["BR", "IT", "OUTRO"] },
      nacionalidade: stringProperty("Nacionalidade."),
      documento: stringProperty("Documento sem máscara."),
      documento_pais: { type: "string", enum: ["BR", "IT", "OUTRO"] },
      pagamento_tipo: { type: "string", enum: ["", "pix", "conta_br", "iban", "outro"] },
      banco_pais: { type: "string", enum: ["BR", "IT", "OUTRO"] },
      titular_pagamento: stringProperty("Titular."),
      chave_pix: stringProperty("Obrigatória para PIX."),
      banco_nome: stringProperty("Obrigatório para conta brasileira."),
      agencia: stringProperty("Obrigatória para conta brasileira."),
      conta_bancaria: stringProperty("Obrigatória para conta brasileira."),
      iban: stringProperty("Obrigatório para IBAN; 15 a 34 caracteres."),
      bic_swift: stringProperty("BIC/SWIFT."),
      dados_pagamento: stringProperty("Informações adicionais."),
      observacoes: stringProperty("Observações internas."),
      ativo: booleanProperty("Status ativo."),
    }, ["operacao"])
  ),
  tool(
    "preparar_veiculo",
    "Valida e prepara criação ou edição de veículo. Nunca grava antes da confirmação.",
    objectSchema({
      operacao: { type: "string", enum: ["criar", "editar"] },
      id: idProperty("Obrigatório na edição."),
      placa: stringProperty("Placa, obrigatória na criação."),
      marca: stringProperty("Marca."),
      modelo: stringProperty("Modelo."),
      ano: numberProperty("Ano."),
      cor: stringProperty("Cor."),
      chassi: stringProperty("Chassi."),
      observacoes: stringProperty("Observações."),
    }, ["operacao"])
  ),
  tool(
    "preparar_servico",
    "Valida e prepara criação, edição ou mudança de status de serviço usando as regras financeiras reais. Na criação, se o veículo ainda não estiver cadastrado, envie seus dados em veiculo: o servidor reutiliza uma placa existente ou cadastra o veículo junto com o serviço, na mesma confirmação.",
    objectSchema({
      operacao: { type: "string", enum: ["criar", "editar", "alterar_status"] },
      id: idProperty("Obrigatório em edição/status."),
      oficina_id: idProperty("ID exato da oficina."),
      veiculo_id: idProperty("ID exato do veículo."),
      veiculo: {
        ...objectSchema({
          placa: stringProperty("Placa obrigatória."),
          marca: stringProperty("Marca opcional."),
          modelo: stringProperty("Modelo opcional."),
          ano: numberProperty("Ano opcional."),
          cor: stringProperty("Cor opcional."),
          chassi: stringProperty("Chassi opcional."),
          observacoes: stringProperty("Observações opcionais."),
        }, ["placa"]),
        description: "Use na criação quando não houver veiculo_id. Se a placa já existir na conta, o veículo existente será reutilizado; caso contrário, será cadastrado automaticamente com o serviço.",
      },
      data_servico: stringProperty("Data YYYY-MM-DD."),
      valor: numberProperty("Valor total positivo."),
      status: { type: "string", enum: SERVICE_STATUSES },
      tecnicos: {
        type: "array",
        description: "Técnicos e percentuais deste serviço.",
        items: objectSchema({ tecnico_id: idProperty("ID exato."), percentual: numberProperty("Percentual > 0 e <= 100.") }, ["tecnico_id", "percentual"]),
      },
      descricao: stringProperty("Descrição."),
      observacoes: stringProperty("Observações."),
    }, ["operacao"])
  ),
  tool(
    "preparar_financeiro",
    "Prepara baixa ou reabertura de um lançamento financeiro. Sempre exige confirmação.",
    objectSchema({
      operacao: { type: "string", enum: ["liquidar", "reabrir"] },
      id: idProperty("ID exato da movimentação."),
      data_pagamento: stringProperty("Data YYYY-MM-DD; na baixa, usa hoje se omitida."),
      forma_pagamento: stringProperty("Forma de pagamento/recebimento."),
      observacoes: stringProperty("Observações."),
    }, ["operacao", "id"])
  ),
];

function limitOf(value, fallback = 12) {
  return Math.max(1, Math.min(MAX_RESULTS, Number(value) || fallback));
}

function cleanSearch(value) {
  return String(value || "").trim().replaceAll("%", "").replaceAll(",", " ").slice(0, 100);
}

function dateAtNoon(value) {
  return new Date(`${value}T12:00:00`);
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function resolvePeriod(args, timezone) {
  const preset = args?.periodo || "todos";
  const today = dateAtNoon(todayISO(timezone));
  if (preset === "todos") return { from: null, to: null };
  if (preset === "personalizado") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args?.data_inicio || "") || !/^\d{4}-\d{2}-\d{2}$/.test(args?.data_fim || "")) {
      throw new RobertoError("Para período personalizado, informe data_inicio e data_fim em YYYY-MM-DD.");
    }
    if (args.data_inicio > args.data_fim) throw new RobertoError("O período informado é inválido.");
    return { from: args.data_inicio, to: args.data_fim };
  }

  if (preset === "hoje") return { from: isoDate(today), to: isoDate(today) };
  if (preset === "ontem") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: isoDate(yesterday), to: isoDate(yesterday) };
  }
  if (preset === "esta_semana") {
    const start = new Date(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return { from: isoDate(start), to: isoDate(today) };
  }
  if (preset === "mes_passado") {
    return {
      from: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1, 12)),
      to: isoDate(new Date(today.getFullYear(), today.getMonth(), 0, 12)),
    };
  }
  if (preset === "ultimos_30_dias") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { from: isoDate(start), to: isoDate(today) };
  }
  return {
    from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1, 12)),
    to: isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0, 12)),
  };
}

function applyDateRange(query, column, range) {
  let next = query;
  if (range.from) next = next.gte(column, range.from);
  if (range.to) next = next.lte(column, range.to);
  return next;
}

function throwIfDb(error) {
  if (error) throw error;
}

function publicError(error, fallback) {
  if (error instanceof RobertoError) throw error;
  console.error("Roberto tool", error);
  throw new RobertoError(fallback, 500, "DATABASE_ERROR");
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

async function searchOffices(args, context) {
  try {
    let query = context.db
      .from("oficinas")
      .select("id,nome,responsavel,email,telefone,documento,pec,codice_destinatario,endereco,cidade,estado_regiao,cep,pais,observacoes,ativo,created_at,updated_at")
      .eq("conta_id", context.usuario.conta_id);
    if (args.id) query = query.eq("id", args.id);
    if (typeof args.ativo === "boolean") query = query.eq("ativo", args.ativo);
    const search = cleanSearch(args.busca);
    if (search) query = query.ilike("nome", `%${search}%`);
    const { data, error } = await query.order("ativo", { ascending: false }).order("nome").limit(limitOf(args.limite));
    throwIfDb(error);
    return { ok: true, total: data.length, oficinas: data };
  } catch (error) {
    publicError(error, "Não foi possível consultar as oficinas.");
  }
}

async function searchTechnicians(args, context) {
  try {
    let query = context.db
      .from("tecnicos")
      .select("id,nome,email,telefone,telefone_pais,nacionalidade,documento,documento_pais,observacoes,ativo,created_at,updated_at")
      .eq("conta_id", context.usuario.conta_id);
    if (args.id) query = query.eq("id", args.id);
    if (typeof args.ativo === "boolean") query = query.eq("ativo", args.ativo);
    const search = cleanSearch(args.busca);
    if (search) query = query.ilike("nome", `%${search}%`);
    const { data, error } = await query.order("ativo", { ascending: false }).order("nome").limit(limitOf(args.limite));
    throwIfDb(error);

    if (!args.incluir_resumo || !data.length) {
      return { ok: true, total: data.length, tecnicos: data };
    }

    const ids = data.map((item) => item.id);
    const range = resolvePeriod(args, context.configuracao.timezone);
    let linksQuery = context.db
      .from("servicos_tecnicos")
      .select("tecnico_id,valor_repasse,moeda,percentual,servico:servicos!inner(id,data_servico,valor,moeda,status,oficina:oficinas(nome),veiculo:veiculos(placa,marca,modelo))")
      .eq("conta_id", context.usuario.conta_id)
      .in("tecnico_id", ids);
    if (range.from) linksQuery = linksQuery.gte("servico.data_servico", range.from);
    if (range.to) linksQuery = linksQuery.lte("servico.data_servico", range.to);
    let movementsQuery = context.db
      .from("movimentacoes_financeiras")
      .select("tecnico_id,valor,moeda,status,data_competencia,data_pagamento")
      .eq("conta_id", context.usuario.conta_id)
      .eq("origem", "repasse_tecnico")
      .in("tecnico_id", ids);
    movementsQuery = applyDateRange(movementsQuery, "data_competencia", range);

    const [linksResult, movementsResult] = await Promise.all([linksQuery.limit(5000), movementsQuery.limit(5000)]);
    throwIfDb(linksResult.error);
    throwIfDb(movementsResult.error);

    const summaries = new Map(ids.map((id) => [id, { servicos: 0, valor_servicos: 0, repasses: 0, pago: 0, pendente: 0 }]));
    (linksResult.data || []).forEach((link) => {
      const summary = summaries.get(link.tecnico_id);
      if (!summary) return;
      summary.servicos += 1;
      summary.valor_servicos += safeNumber(link.servico?.valor);
    });
    (movementsResult.data || []).forEach((movement) => {
      const summary = summaries.get(movement.tecnico_id);
      if (!summary) return;
      const value = safeNumber(movement.valor);
      summary.repasses += value;
      if (isSettledStatus(movement.status)) summary.pago += value;
      else summary.pendente += value;
    });

    return {
      ok: true,
      periodo: range,
      total: data.length,
      tecnicos: data.map((item) => ({ ...item, resumo: summaries.get(item.id) })),
    };
  } catch (error) {
    publicError(error, "Não foi possível consultar os técnicos.");
  }
}

async function searchVehicles(args, context) {
  try {
    let query = context.db
      .from("veiculos")
      .select("id,placa,marca,modelo,ano,cor,chassi,observacoes,created_at,updated_at")
      .eq("conta_id", context.usuario.conta_id);
    if (args.id) query = query.eq("id", args.id);
    const search = cleanSearch(args.busca);
    if (search) {
      const plate = normalizePlate(search);
      query = query.or(`placa.ilike.%${plate || search}%,marca.ilike.%${search}%,modelo.ilike.%${search}%`);
    }
    const { data, error } = await query.order("placa").limit(limitOf(args.limite));
    throwIfDb(error);

    if (!args.incluir_historico || !data.length) return { ok: true, total: data.length, veiculos: data };
    const { data: services, error: serviceError } = await context.db
      .from("servicos")
      .select("id,veiculo_id,data_servico,valor,moeda,status,descricao,oficina:oficinas(id,nome),servicos_tecnicos(tecnico:tecnicos(id,nome),percentual,valor_repasse,moeda)")
      .eq("conta_id", context.usuario.conta_id)
      .in("veiculo_id", data.map((item) => item.id))
      .order("data_servico", { ascending: false })
      .limit(250);
    throwIfDb(serviceError);
    return {
      ok: true,
      total: data.length,
      veiculos: data.map((vehicle) => ({
        ...vehicle,
        historico: (services || []).filter((service) => service.veiculo_id === vehicle.id).slice(0, 12),
      })),
    };
  } catch (error) {
    publicError(error, "Não foi possível consultar os veículos.");
  }
}

async function searchServices(args, context) {
  try {
    const range = resolvePeriod(args, context.configuracao.timezone);
    let query = context.db
      .from("servicos")
      .select("id,oficina_id,veiculo_id,data_servico,valor,moeda,status,descricao,observacoes,created_at,updated_at,oficina:oficinas(id,nome,ativo),veiculo:veiculos(id,placa,marca,modelo,ano,cor),servicos_tecnicos(tecnico_id,percentual,valor_repasse,moeda,tecnico:tecnicos(id,nome,ativo)),movimentacoes_financeiras(id,tipo,origem,valor,moeda,status,data_competencia,data_vencimento,data_pagamento,tecnico_id)")
      .eq("conta_id", context.usuario.conta_id);
    if (args.id) query = query.eq("id", args.id);
    if (args.oficina_id) query = query.eq("oficina_id", args.oficina_id);
    if (args.veiculo_id) query = query.eq("veiculo_id", args.veiculo_id);
    if (args.status) query = query.eq("status", args.status);
    query = applyDateRange(query, "data_servico", range);
    const { data, error } = await query.order("data_servico", { ascending: false }).order("created_at", { ascending: false }).limit(limitOf(args.limite));
    throwIfDb(error);

    const search = cleanSearch(args.busca).toLocaleLowerCase();
    const technicianFiltered = args.tecnico_id
      ? data.filter((service) =>
          (service.servicos_tecnicos || []).some((link) => link.tecnico_id === args.tecnico_id)
        )
      : data;
    const filtered = search
      ? technicianFiltered.filter((service) =>
          [
            service.oficina?.nome,
            service.veiculo?.placa,
            service.veiculo?.marca,
            service.veiculo?.modelo,
            service.descricao,
            service.observacoes,
            ...(service.servicos_tecnicos || []).map((link) => link.tecnico?.nome),
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase()
            .includes(search)
        )
      : technicianFiltered;
    return { ok: true, periodo: range, total: filtered.length, servicos: filtered };
  } catch (error) {
    publicError(error, "Não foi possível consultar os serviços.");
  }
}

async function queryFinancial(args, context) {
  try {
    const range = resolvePeriod(args, context.configuracao.timezone);
    let query = context.db
      .from("movimentacoes_financeiras")
      .select("id,categoria_id,servico_id,tecnico_id,oficina_id,tipo,origem,descricao,valor,moeda,status,data_competencia,data_vencimento,data_pagamento,forma_pagamento,observacoes,oficina:oficinas(id,nome),tecnico:tecnicos(id,nome),categoria:categorias_financeiras(id,nome,grupo_dre)")
      .eq("conta_id", context.usuario.conta_id);
    if (args.tipo && args.tipo !== "todos") query = query.eq("tipo", args.tipo);
    if (args.status === "pago") query = query.in("status", ["pago", "recebido", "paid"]);
    if (args.status === "pendente" || args.status === "atrasado") query = query.eq("status", "pendente");
    if (args.oficina_id) query = query.eq("oficina_id", args.oficina_id);
    if (args.tecnico_id) query = query.eq("tecnico_id", args.tecnico_id);
    if (args.origem && args.origem !== "todos" && args.origem !== "manual") query = query.eq("origem", args.origem);
    if (args.origem === "manual") query = query.not("origem", "in", '("servico","repasse_tecnico")');
    query = applyDateRange(query, "data_competencia", range);
    const { data, error } = await query.order("data_competencia", { ascending: false }).limit(5000);
    throwIfDb(error);

    const today = todayISO(context.configuracao.timezone);
    const rows = (data || []).filter(
      (row) => args.status !== "atrasado" || (!isSettledStatus(row.status) && row.data_vencimento && row.data_vencimento < today)
    );
    const totals = { receitas: 0, despesas: 0, recebido: 0, pago: 0, a_receber: 0, a_pagar: 0, atrasado: 0 };
    const offices = new Map();
    const technicians = new Map();
    rows.forEach((row) => {
      const value = safeNumber(row.valor);
      const paid = isSettledStatus(row.status);
      if (row.tipo === "receita") {
        totals.receitas += value;
        if (paid) totals.recebido += value;
        else totals.a_receber += value;
        if (row.oficina?.id) offices.set(row.oficina.id, (offices.get(row.oficina.id) || { id: row.oficina.id, nome: row.oficina.nome, valor: 0, quantidade: 0 }));
        if (row.oficina?.id) {
          offices.get(row.oficina.id).valor += value;
          offices.get(row.oficina.id).quantidade += 1;
        }
      } else {
        totals.despesas += value;
        if (paid) totals.pago += value;
        else totals.a_pagar += value;
        if (row.tecnico?.id) technicians.set(row.tecnico.id, (technicians.get(row.tecnico.id) || { id: row.tecnico.id, nome: row.tecnico.nome, valor: 0, quantidade: 0 }));
        if (row.tecnico?.id) {
          technicians.get(row.tecnico.id).valor += value;
          technicians.get(row.tecnico.id).quantidade += 1;
        }
      }
      if (!paid && row.data_vencimento && row.data_vencimento < today) totals.atrasado += value;
    });
    totals.resultado = totals.receitas - totals.despesas;
    totals.margem = totals.receitas > 0 ? (totals.resultado / totals.receitas) * 100 : 0;

    return {
      ok: true,
      periodo: range,
      total_lancamentos: rows.length,
      totais: totals,
      ranking_oficinas: [...offices.values()].sort((a, b) => b.valor - a.valor).slice(0, 10),
      ranking_tecnicos: [...technicians.values()].sort((a, b) => b.valor - a.valor).slice(0, 10),
      lancamentos: rows.slice(0, limitOf(args.limite)),
    };
  } catch (error) {
    publicError(error, "Não foi possível consultar o financeiro.");
  }
}

async function queryDre(args, context) {
  try {
    const range = resolvePeriod({ ...args, periodo: args.periodo || "este_mes" }, context.configuracao.timezone);
    let query = context.db
      .from("movimentacoes_financeiras")
      .select("id,tipo,origem,valor,moeda,status,data_competencia,categoria:categorias_financeiras(id,nome,tipo,grupo_dre,cor,ativo)")
      .eq("conta_id", context.usuario.conta_id);
    query = applyDateRange(query, "data_competencia", range);
    const { data, error } = await query.limit(10000);
    throwIfDb(error);
    return { ok: true, periodo: range, dre: buildDreSnapshot(data || []) };
  } catch (error) {
    publicError(error, "Não foi possível calcular a DRE.");
  }
}

async function queryAudit(args, context) {
  try {
    const range = resolvePeriod(args, context.configuracao.timezone);
    let query = context.db
      .from("auditoria")
      .select("id,usuario_id,entidade,acao,registro_id,descricao,dados_anteriores,dados_novos,created_at,usuario:usuarios(id,nome,email)")
      .eq("conta_id", context.usuario.conta_id);
    if (args.entidade) query = query.eq("entidade", args.entidade);
    if (args.acao) query = query.eq("acao", args.acao);
    if (args.registro_id) query = query.eq("registro_id", args.registro_id);
    if (range.from) query = query.gte("created_at", `${range.from}T00:00:00`);
    if (range.to) query = query.lte("created_at", `${range.to}T23:59:59.999`);
    const search = cleanSearch(args.busca);
    if (search) query = query.or(`descricao.ilike.%${search}%,entidade.ilike.%${search}%,acao.ilike.%${search}%`);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(limitOf(args.limite));
    throwIfDb(error);
    return { ok: true, periodo: range, total: data.length, auditoria: data };
  } catch (error) {
    publicError(error, "Não foi possível consultar a auditoria.");
  }
}

async function queryUsers(args, context) {
  try {
    let query = context.db
      .from("usuarios")
      .select("id,nome,email,ativo,ultimo_acesso,created_at")
      .eq("conta_id", context.usuario.conta_id);
    if (typeof args.ativo === "boolean") query = query.eq("ativo", args.ativo);
    const search = cleanSearch(args.busca);
    if (search) query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await query.order("ativo", { ascending: false }).order("nome").limit(limitOf(args.limite));
    throwIfDb(error);
    return { ok: true, total: data.length, usuarios: data };
  } catch (error) {
    publicError(error, "Não foi possível consultar os usuários.");
  }
}

const HELP = {
  servicos: "Abra Serviços e use Novo serviço. Selecione oficina, data, veículo existente ou cadastre um pela placa, informe valor, ao menos um técnico e o percentual de cada técnico. A soma não pode superar 100%. Ao salvar, o recebível e os repasses pendentes são gerados. Serviços com financeiro liquidado têm edição financeira e cancelamento bloqueados.",
  oficinas: "Em Oficinas, use Nova oficina. Apenas o nome é obrigatório; os demais dados fiscais, contato e endereço são opcionais. A tela também permite editar, inativar, vincular técnicos e consultar o resumo operacional.",
  tecnicos: "Em Técnicos, use Novo técnico. O nome é obrigatório. A forma de pagamento é opcional; ao escolher PIX, conta brasileira ou IBAN, a tela exige os campos correspondentes. O detalhe mostra serviços e repasses.",
  veiculos: "Veículos são identificados principalmente pela placa. Um veículo pode ser cadastrado durante o serviço ou localizado na tela Veículos, onde aparece o histórico de atendimentos.",
  financeiro: "Em Financeiro você consulta receitas e despesas automáticas ou manuais. Use a ação de baixa para marcar receita como recebida ou despesa como paga, informando data e, opcionalmente, forma. A reabertura volta o lançamento para pendente.",
  dre: "A DRE usa a data de competência e agrupa receitas e despesas pelas categorias. Serviços entram como receita operacional e repasses como custos diretos quando não há categoria explícita.",
  auditoria: "A Auditoria mostra a linha do tempo de criações, alterações, exclusões, baixas e outras ações, com filtros por usuário, data, módulo e ação.",
  usuarios: "Em Usuários é possível criar acessos da mesma conta. Nesta versão todos têm acesso completo; cada usuário só edita ou desativa o próprio cadastro.",
  configuracoes: "Configurações reúne dados da empresa e preferências como moeda, locale, timezone, formato de data e prazo de vencimento dos serviços.",
  busca: "A busca do cabeçalho abre a Busca global e procura por serviços, oficinas, técnicos, veículos, financeiro e auditoria dentro da conta atual.",
};

function confirmationSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OPENROUTER_API_KEY;
  if (!secret) throw new RobertoError("Servidor sem segredo para confirmar operações.", 500, "MISSING_SECRET");
  return secret;
}

function signConfirmation(context, toolName, args) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    exp: Date.now() + 10 * 60 * 1000,
    contaId: context.usuario.conta_id,
    usuarioId: context.usuario.id,
    toolName,
    args,
  }));
  const key = createHash("sha256").update(confirmationSecret()).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

function readConfirmation(tokenValue, context) {
  const [version, ivValue, encryptedValue, tagValue] = String(tokenValue || "").split(".");
  if (version !== "v1" || !ivValue || !encryptedValue || !tagValue) {
    throw new RobertoError("Confirmação inválida ou incompleta.", 400, "INVALID_CONFIRMATION");
  }
  let parsed;
  try {
    const key = createHash("sha256").update(confirmationSecret()).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]);
    parsed = JSON.parse(decrypted.toString("utf8"));
  } catch {
    throw new RobertoError("A confirmação não é válida ou foi alterada.", 400, "INVALID_CONFIRMATION");
  }
  if (parsed.exp < Date.now()) throw new RobertoError("A confirmação expirou. Peça ao Roberto para preparar novamente.", 400, "EXPIRED_CONFIRMATION");
  if (parsed.contaId !== context.usuario.conta_id || parsed.usuarioId !== context.usuario.id) {
    throw new RobertoError("A confirmação pertence a outro usuário ou conta.", 403, "CONFIRMATION_SCOPE");
  }
  return parsed;
}

function confirmation(context, toolName, args, preview) {
  return {
    ok: true,
    requires_confirmation: true,
    message: "A operação foi validada e aguarda confirmação explícita do usuário.",
    confirmation: {
      ...preview,
      token: signConfirmation(context, toolName, args),
    },
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function mergedValue(args, before, key, fallback = null) {
  return hasOwn(args, key) ? args[key] : before?.[key] ?? fallback;
}

function cleanDigits(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function validateEmail(value, label = "e-mail") {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new RobertoError(`Informe um ${label} válido.`);
  }
}

async function officePlan(args, context) {
  if (!["criar", "editar"].includes(args.operacao)) {
    throw new RobertoError("Operação de oficina inválida.");
  }
  let before = null;
  if (args.operacao === "editar") {
    if (!args.id) throw new RobertoError("Informe qual oficina deve ser editada.");
    const result = await context.db
      .from("oficinas")
      .select("id,nome,responsavel,email,telefone,documento,pec,codice_destinatario,endereco,cidade,estado_regiao,cep,pais,observacoes,ativo")
      .eq("conta_id", context.usuario.conta_id)
      .eq("id", args.id)
      .maybeSingle();
    throwIfDb(result.error);
    before = result.data;
    if (!before) throw new RobertoError("Oficina não encontrada nesta conta.", 404);
  }

  const nome = String(mergedValue(args, before, "nome", "") || "").trim();
  if (!nome) return { missing: ["nome"] };
  const email = cleanText(mergedValue(args, before, "email"))?.toLowerCase() || null;
  const pec = cleanText(mergedValue(args, before, "pec"))?.toLowerCase() || null;
  validateEmail(email);
  validateEmail(pec, "endereço PEC");
  const destinationCode = cleanText(mergedValue(args, before, "codice_destinatario"))?.toUpperCase() || null;
  if (destinationCode && destinationCode.length > 7) {
    throw new RobertoError("O Codice Destinatario possui até 7 caracteres.");
  }

  return {
    before,
    payload: {
      nome,
      responsavel: cleanText(mergedValue(args, before, "responsavel")),
      email,
      telefone: cleanDigits(mergedValue(args, before, "telefone")),
      documento: cleanText(mergedValue(args, before, "documento"))?.toUpperCase() || null,
      pec,
      codice_destinatario: destinationCode,
      endereco: cleanText(mergedValue(args, before, "endereco")),
      cidade: cleanText(mergedValue(args, before, "cidade")),
      estado_regiao: cleanText(mergedValue(args, before, "estado_regiao")),
      cep: cleanDigits(mergedValue(args, before, "cep")),
      pais: cleanText(mergedValue(args, before, "pais", "Italia")),
      observacoes: cleanText(mergedValue(args, before, "observacoes")),
      ativo: Boolean(mergedValue(args, before, "ativo", true)),
      updated_by: context.usuario.id,
      updated_at: new Date().toISOString(),
    },
  };
}

async function prepareOffice(args, context) {
  const plan = await officePlan(args, context);
  if (plan.missing) return { ok: false, missing_fields: plan.missing, message: "Faltam dados obrigatórios para a oficina." };
  return confirmation(context, "preparar_oficina", args, {
    kind: "oficina",
    title: args.operacao === "editar" ? "Editar oficina" : "Nova oficina",
    description: "Revise os dados antes de salvar.",
    fields: [
      { label: "Nome", value: plan.payload.nome },
      { label: "Responsável", value: plan.payload.responsavel },
      { label: "Telefone", value: plan.payload.telefone },
      { label: "Cidade", value: plan.payload.cidade },
      { label: "País", value: plan.payload.pais },
      { label: "Status", value: plan.payload.ativo ? "Ativa" : "Inativa" },
    ].filter((field) => field.value),
  });
}

async function commitOffice(args, context) {
  const plan = await officePlan(args, context);
  if (plan.missing) throw new RobertoError("O nome da oficina continua obrigatório.");
  let result;
  if (args.operacao === "editar") {
    result = await context.db.from("oficinas").update(plan.payload).eq("conta_id", context.usuario.conta_id).eq("id", args.id).select("id,nome,responsavel,email,telefone,endereco,cidade,pais,ativo,updated_at").single();
  } else {
    result = await context.db.from("oficinas").insert({ ...plan.payload, conta_id: context.usuario.conta_id, created_by: context.usuario.id }).select("id,nome,responsavel,email,telefone,endereco,cidade,pais,ativo,created_at").single();
  }
  throwIfDb(result.error);
  await logRobertoAudit(context, {
    entidade: "oficinas",
    acao: args.operacao === "editar" ? "atualizar" : "criar",
    registroId: result.data.id,
    descricao: `Oficina ${result.data.nome} ${args.operacao === "editar" ? "atualizada" : "criada"}.`,
    before: plan.before,
    after: result.data,
  });
  return { ok: true, message: `Oficina ${result.data.nome} ${args.operacao === "editar" ? "atualizada" : "cadastrada"} com sucesso.`, oficina: result.data };
}

function alphaNumeric(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || null;
}

async function technicianPlan(args, context) {
  if (!["criar", "editar"].includes(args.operacao)) {
    throw new RobertoError("Operação de técnico inválida.");
  }
  let before = null;
  if (args.operacao === "editar") {
    if (!args.id) throw new RobertoError("Informe qual técnico deve ser editado.");
    const result = await context.db.from("tecnicos").select("*").eq("conta_id", context.usuario.conta_id).eq("id", args.id).maybeSingle();
    throwIfDb(result.error);
    before = result.data;
    if (!before) throw new RobertoError("Técnico não encontrado nesta conta.", 404);
  }
  const nome = String(mergedValue(args, before, "nome", "") || "").trim();
  if (!nome) return { missing: ["nome"] };
  const email = cleanText(mergedValue(args, before, "email"))?.toLowerCase() || null;
  validateEmail(email);
  const paymentType = cleanText(mergedValue(args, before, "pagamento_tipo"));
  const missing = [];
  if (paymentType === "pix" && !cleanText(mergedValue(args, before, "chave_pix"))) missing.push("chave_pix");
  if (paymentType === "conta_br") {
    if (!cleanText(mergedValue(args, before, "banco_nome"))) missing.push("banco_nome");
    if (!cleanText(mergedValue(args, before, "agencia"))) missing.push("agencia");
    if (!cleanText(mergedValue(args, before, "conta_bancaria"))) missing.push("conta_bancaria");
  }
  const iban = paymentType === "iban" ? alphaNumeric(mergedValue(args, before, "iban")) : null;
  if (paymentType === "iban" && (!iban || iban.length < 15 || iban.length > 34)) missing.push("iban válido (15 a 34 caracteres)");
  if (missing.length) return { missing };

  return {
    before,
    payload: {
      nome,
      email,
      nacionalidade: cleanText(mergedValue(args, before, "nacionalidade")),
      telefone_pais: cleanText(mergedValue(args, before, "telefone_pais", "IT")),
      telefone: cleanDigits(mergedValue(args, before, "telefone")),
      documento_pais: cleanText(mergedValue(args, before, "documento_pais", "BR")),
      documento: alphaNumeric(mergedValue(args, before, "documento")),
      pagamento_tipo: paymentType,
      banco_pais: paymentType ? cleanText(mergedValue(args, before, "banco_pais", "IT")) : null,
      titular_pagamento: paymentType ? cleanText(mergedValue(args, before, "titular_pagamento")) : null,
      chave_pix: paymentType === "pix" ? cleanText(mergedValue(args, before, "chave_pix")) : null,
      banco_nome: ["conta_br", "iban"].includes(paymentType) ? cleanText(mergedValue(args, before, "banco_nome")) : null,
      agencia: paymentType === "conta_br" ? cleanText(mergedValue(args, before, "agencia")) : null,
      conta_bancaria: paymentType === "conta_br" ? cleanText(mergedValue(args, before, "conta_bancaria")) : null,
      iban,
      bic_swift: paymentType === "iban" ? alphaNumeric(mergedValue(args, before, "bic_swift")) : null,
      dados_pagamento: paymentType ? cleanText(mergedValue(args, before, "dados_pagamento")) : null,
      observacoes: cleanText(mergedValue(args, before, "observacoes")),
      ativo: Boolean(mergedValue(args, before, "ativo", true)),
      updated_by: context.usuario.id,
      updated_at: new Date().toISOString(),
    },
  };
}

async function prepareTechnician(args, context) {
  const plan = await technicianPlan(args, context);
  if (plan.missing) return { ok: false, missing_fields: plan.missing, message: "Faltam dados obrigatórios para o técnico." };
  return confirmation(context, "preparar_tecnico", args, {
    kind: "tecnico",
    title: args.operacao === "editar" ? "Editar técnico" : "Novo técnico",
    description: "Revise os dados antes de salvar.",
    fields: [
      { label: "Nome", value: plan.payload.nome },
      { label: "Telefone", value: plan.payload.telefone },
      { label: "E-mail", value: plan.payload.email },
      { label: "Pagamento", value: plan.payload.pagamento_tipo || "Não informado" },
      { label: "Status", value: plan.payload.ativo ? "Ativo" : "Inativo" },
    ].filter((field) => field.value),
  });
}

async function commitTechnician(args, context) {
  const plan = await technicianPlan(args, context);
  if (plan.missing) throw new RobertoError(`Ainda faltam: ${plan.missing.join(", ")}.`);
  let result;
  if (args.operacao === "editar") {
    result = await context.db.from("tecnicos").update(plan.payload).eq("conta_id", context.usuario.conta_id).eq("id", args.id).select("id,nome,email,telefone,pagamento_tipo,ativo,updated_at").single();
  } else {
    result = await context.db.from("tecnicos").insert({ ...plan.payload, conta_id: context.usuario.conta_id, created_by: context.usuario.id }).select("id,nome,email,telefone,pagamento_tipo,ativo,created_at").single();
  }
  throwIfDb(result.error);
  await logRobertoAudit(context, {
    entidade: "tecnicos",
    acao: args.operacao === "editar" ? "atualizar" : "criar",
    registroId: result.data.id,
    descricao: `Técnico ${result.data.nome} ${args.operacao === "editar" ? "atualizado" : "criado"}.`,
    before: plan.before,
    after: result.data,
  });
  return { ok: true, message: `Técnico ${result.data.nome} ${args.operacao === "editar" ? "atualizado" : "cadastrado"} com sucesso.`, tecnico: result.data };
}

async function vehiclePlan(args, context, { reuseExisting = false } = {}) {
  if (!["criar", "editar"].includes(args.operacao)) {
    throw new RobertoError("Operação de veículo inválida.");
  }
  let before = null;
  if (args.operacao === "editar") {
    if (!args.id) throw new RobertoError("Informe qual veículo deve ser editado.");
    const result = await context.db.from("veiculos").select("id,placa,marca,modelo,ano,cor,chassi,observacoes").eq("conta_id", context.usuario.conta_id).eq("id", args.id).maybeSingle();
    throwIfDb(result.error);
    before = result.data;
    if (!before) throw new RobertoError("Veículo não encontrado nesta conta.", 404);
  }
  const plate = normalizePlate(mergedValue(args, before, "placa", ""));
  if (!plate) return { missing: ["placa"] };
  const yearRaw = mergedValue(args, before, "ano");
  const year = yearRaw ? Number(yearRaw) : null;
  if (year && (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1)) {
    throw new RobertoError("Informe um ano de veículo válido.");
  }
  let duplicateQuery = context.db.from("veiculos").select("id,placa,marca,modelo,ano,cor,chassi,observacoes").eq("conta_id", context.usuario.conta_id).eq("placa", plate);
  if (before?.id) duplicateQuery = duplicateQuery.neq("id", before.id);
  const duplicate = await duplicateQuery.maybeSingle();
  throwIfDb(duplicate.error);
  if (duplicate.data && reuseExisting) return { before, existing: duplicate.data };
  if (duplicate.data) throw new RobertoError(`A placa ${plate} já pertence a outro veículo desta conta.`);
  return {
    before,
    payload: {
      placa: plate,
      marca: cleanText(mergedValue(args, before, "marca")),
      modelo: cleanText(mergedValue(args, before, "modelo")),
      ano: year,
      cor: cleanText(mergedValue(args, before, "cor")),
      chassi: cleanText(mergedValue(args, before, "chassi")),
      observacoes: cleanText(mergedValue(args, before, "observacoes")),
      updated_by: context.usuario.id,
      updated_at: new Date().toISOString(),
    },
  };
}

async function prepareVehicle(args, context) {
  const plan = await vehiclePlan(args, context);
  if (plan.missing) return { ok: false, missing_fields: plan.missing, message: "A placa é obrigatória." };
  return confirmation(context, "preparar_veiculo", args, {
    kind: "veiculo",
    title: args.operacao === "editar" ? "Editar veículo" : "Novo veículo",
    description: "Revise os dados antes de salvar.",
    fields: [
      { label: "Placa", value: plan.payload.placa },
      { label: "Veículo", value: [plan.payload.marca, plan.payload.modelo].filter(Boolean).join(" ") },
      { label: "Ano", value: plan.payload.ano },
      { label: "Cor", value: plan.payload.cor },
    ].filter((field) => field.value),
  });
}

async function commitVehicle(args, context) {
  const plan = await vehiclePlan(args, context);
  if (plan.missing) throw new RobertoError("A placa continua obrigatória.");
  let result;
  if (args.operacao === "editar") {
    result = await context.db.from("veiculos").update(plan.payload).eq("conta_id", context.usuario.conta_id).eq("id", args.id).select("id,placa,marca,modelo,ano,cor,chassi,observacoes,updated_at").single();
  } else {
    result = await context.db.from("veiculos").insert({ ...plan.payload, conta_id: context.usuario.conta_id, created_by: context.usuario.id }).select("id,placa,marca,modelo,ano,cor,chassi,observacoes,created_at").single();
  }
  throwIfDb(result.error);
  await logRobertoAudit(context, {
    entidade: "veiculos",
    acao: args.operacao === "editar" ? "atualizar" : "criar",
    registroId: result.data.id,
    descricao: `Veículo ${result.data.placa} ${args.operacao === "editar" ? "atualizado" : "criado"}.`,
    before: plan.before,
    after: result.data,
  });
  return { ok: true, message: `Veículo ${result.data.placa} ${args.operacao === "editar" ? "atualizado" : "cadastrado"} com sucesso.`, veiculo: result.data };
}

async function getServiceSnapshot(id, context) {
  const { data, error } = await context.db
    .from("servicos")
    .select("id,conta_id,oficina_id,veiculo_id,data_servico,valor,moeda,status,descricao,observacoes,created_by,updated_by,created_at,updated_at,oficina:oficinas(id,nome,ativo),veiculo:veiculos(id,placa,marca,modelo,ano,cor),servicos_tecnicos(id,conta_id,servico_id,tecnico_id,percentual,valor_repasse,moeda,created_by,created_at,tecnico:tecnicos(id,nome,ativo)),movimentacoes_financeiras(id,conta_id,categoria_id,servico_id,tecnico_id,oficina_id,tipo,origem,descricao,valor,moeda,status,data_competencia,data_vencimento,data_pagamento,forma_pagamento,observacoes,created_by,updated_by,created_at,updated_at)")
    .eq("conta_id", context.usuario.conta_id)
    .eq("id", id)
    .maybeSingle();
  throwIfDb(error);
  return data;
}

function automaticMovements(service) {
  return (service?.movimentacoes_financeiras || []).filter((item) => AUTO_ORIGINS.includes(item.origem));
}

async function servicePlan(args, context) {
  if (!["criar", "editar", "alterar_status"].includes(args.operacao)) {
    throw new RobertoError("Operação de serviço inválida.");
  }
  let before = null;
  if (args.operacao !== "criar") {
    if (!args.id) throw new RobertoError("Informe qual serviço deve ser alterado.");
    before = await getServiceSnapshot(args.id, context);
    if (!before) throw new RobertoError("Serviço não encontrado nesta conta.", 404);
  }

  const hasSettled = automaticMovements(before).some((item) => isSettledStatus(item.status));
  if (args.operacao === "alterar_status") {
    if (!args.status) return { missing: ["status"] };
    if (args.status === "cancelado" && hasSettled) {
      throw new RobertoError("Este serviço possui recebimento ou repasse liquidado e não pode ser cancelado.");
    }
  }

  if (args.operacao === "editar" && hasSettled) {
    const lockedFields = ["oficina_id", "veiculo_id", "veiculo", "data_servico", "valor", "tecnicos"];
    if (lockedFields.some((key) => hasOwn(args, key))) {
      throw new RobertoError("O serviço possui financeiro liquidado. Só é permitido alterar status não cancelado, descrição e observações.");
    }
  }

  const technicians = hasOwn(args, "tecnicos")
    ? args.tecnicos || []
    : (before?.servicos_tecnicos || []).map((link) => ({
        tecnico_id: link.tecnico_id,
        percentual: safeNumber(link.percentual),
      }));
  if (args.operacao !== "criar" && hasOwn(args, "veiculo")) {
    throw new RobertoError("O cadastro automático de veículo só está disponível ao criar um serviço.");
  }

  const requestedVehicleId = mergedValue(args, before, "veiculo_id");
  const inlineVehiclePlate = args.operacao === "criar" ? normalizePlate(args.veiculo?.placa) : null;
  const draft = {
    oficinaId: mergedValue(args, before, "oficina_id"),
    veiculoId: requestedVehicleId || inlineVehiclePlate,
    dataServico: mergedValue(args, before, "data_servico"),
    valor: mergedValue(args, before, "valor"),
    status:
      args.operacao === "alterar_status"
        ? args.status
        : mergedValue(args, before, "status", "agendado"),
    tecnicos: technicians,
  };
  const errors = validateServiceDraft(draft);
  if (errors.length) return { missing: errors.map((error) => error.field), validation_errors: errors };

  const [officeResult, techniciansResult] = await Promise.all([
    context.db.from("oficinas").select("id,nome,ativo").eq("conta_id", context.usuario.conta_id).eq("id", draft.oficinaId).maybeSingle(),
    context.db.from("tecnicos").select("id,nome,ativo").eq("conta_id", context.usuario.conta_id).in("id", technicians.map((item) => item.tecnico_id)),
  ]);
  throwIfDb(officeResult.error);
  throwIfDb(techniciansResult.error);
  if (!officeResult.data) throw new RobertoError("A oficina selecionada não pertence a esta conta.");
  if (!officeResult.data.ativo && officeResult.data.id !== before?.oficina_id) {
    throw new RobertoError("A oficina selecionada não está ativa.");
  }
  let vehicle;
  let newVehiclePayload = null;
  if (requestedVehicleId) {
    const vehicleResult = await context.db
      .from("veiculos")
      .select("id,placa,marca,modelo,ano,cor,chassi,observacoes")
      .eq("conta_id", context.usuario.conta_id)
      .eq("id", requestedVehicleId)
      .maybeSingle();
    throwIfDb(vehicleResult.error);
    if (!vehicleResult.data) throw new RobertoError("O veículo selecionado não pertence a esta conta.");
    vehicle = vehicleResult.data;
  } else {
    const inlinePlan = await vehiclePlan({ operacao: "criar", ...(args.veiculo || {}) }, context, { reuseExisting: true });
    if (inlinePlan.missing) {
      return {
        missing: ["veiculo.placa"],
        validation_errors: [{ field: "veiculo.placa", message: "Informe a placa do veículo." }],
      };
    }
    vehicle = inlinePlan.existing || { id: null, ...inlinePlan.payload };
    newVehiclePayload = inlinePlan.existing ? null : inlinePlan.payload;
  }
  if ((techniciansResult.data || []).length !== new Set(technicians.map((item) => item.tecnico_id)).size) {
    throw new RobertoError("Um ou mais técnicos não pertencem a esta conta.");
  }
  const inactive = (techniciansResult.data || []).find((item) => !item.ativo && !(before?.servicos_tecnicos || []).some((link) => link.tecnico_id === item.id));
  if (inactive) throw new RobertoError(`O técnico ${inactive.nome} não está ativo.`);

  return {
    before,
    hasSettled,
    office: officeResult.data,
    vehicle,
    newVehiclePayload,
    technicians: techniciansResult.data || [],
    technicianDrafts: technicians,
    payload: {
      oficina_id: draft.oficinaId,
      veiculo_id: vehicle.id,
      data_servico: draft.dataServico,
      valor: roundMoney(draft.valor),
      moeda: context.configuracao.moeda || "EUR",
      status: draft.status,
      descricao: cleanText(mergedValue(args, before, "descricao")),
      observacoes: cleanText(mergedValue(args, before, "observacoes")),
      updated_by: context.usuario.id,
      updated_at: new Date().toISOString(),
    },
  };
}

async function prepareService(args, context) {
  const plan = await servicePlan(args, context);
  if (plan.missing) {
    return {
      ok: false,
      missing_fields: plan.missing,
      validation_errors: plan.validation_errors,
      message: "Faltam dados obrigatórios ou válidos para preparar o serviço.",
    };
  }
  const statusChange = args.operacao === "alterar_status";
  const repasses = plan.technicianDrafts.map((item) => {
    const technician = plan.technicians.find((row) => row.id === item.tecnico_id);
    return `${technician?.nome || "Técnico"}: ${item.percentual}% (${context.configuracao.moeda} ${roundMoney((plan.payload.valor * item.percentual) / 100).toFixed(2)})`;
  });
  return confirmation(context, "preparar_servico", args, {
    kind: "servico",
    title: statusChange ? "Alterar status do serviço" : args.operacao === "editar" ? "Editar serviço" : "Novo serviço",
    description: plan.payload.status === "cancelado" ? "O cancelamento removerá os lançamentos automáticos pendentes." : plan.newVehiclePayload ? "O veículo será cadastrado junto com o serviço. O recebível e os repasses serão gerados como pendentes." : "O recebível da oficina e os repasses serão sincronizados como pendentes.",
    danger: plan.payload.status === "cancelado",
    fields: [
      { label: "Oficina", value: plan.office.nome },
      { label: "Veículo", value: [plan.vehicle.marca, plan.vehicle.modelo, plan.vehicle.placa].filter(Boolean).join(" · ") },
      ...(plan.newVehiclePayload ? [{ label: "Cadastro", value: "Veículo novo incluído nesta confirmação" }] : []),
      { label: "Data", value: plan.payload.data_servico },
      { label: "Valor", value: `${context.configuracao.moeda} ${plan.payload.valor.toFixed(2)}` },
      { label: "Status", value: plan.payload.status },
      { label: "Técnicos", value: repasses.join("; ") },
    ],
  });
}

async function rebuildServiceFinancials(plan, serviceId, context) {
  const technicianRows = buildServiceTechnicianRows({
    serviceId,
    contaId: context.usuario.conta_id,
    usuarioId: context.usuario.id,
    serviceValue: plan.payload.valor,
    technicians: plan.technicianDrafts,
    currency: context.configuracao.moeda || "EUR",
  });
  const deleteResult = await context.db
    .from("movimentacoes_financeiras")
    .delete()
    .eq("conta_id", context.usuario.conta_id)
    .eq("servico_id", serviceId)
    .in("origem", AUTO_ORIGINS);
  throwIfDb(deleteResult.error);
  const rows = buildServiceFinancialRows({
    serviceId,
    serviceDate: plan.payload.data_servico,
    serviceValue: plan.payload.valor,
    officeId: plan.payload.oficina_id,
    vehicle: plan.vehicle,
    technicianRows,
    techniciansById: Object.fromEntries(plan.technicians.map((item) => [item.id, item])),
    status: plan.payload.status,
    contaId: context.usuario.conta_id,
    usuarioId: context.usuario.id,
    dueDays: context.configuracao.dias_vencimento_servico || 0,
    existingMovements: automaticMovements(plan.before),
    currency: context.configuracao.moeda || "EUR",
  });
  if (rows.length) {
    const result = await context.db.from("movimentacoes_financeiras").insert(rows);
    throwIfDb(result.error);
  }
  return technicianRows;
}

async function restoreServiceSnapshot(snapshot, context) {
  if (!snapshot?.id) return;
  try {
    await context.db
      .from("servicos")
      .update({
        oficina_id: snapshot.oficina_id,
        veiculo_id: snapshot.veiculo_id,
        data_servico: snapshot.data_servico,
        valor: snapshot.valor,
        moeda: snapshot.moeda || "EUR",
        status: snapshot.status,
        descricao: snapshot.descricao,
        observacoes: snapshot.observacoes,
        updated_by: snapshot.updated_by,
        updated_at: snapshot.updated_at,
      })
      .eq("conta_id", context.usuario.conta_id)
      .eq("id", snapshot.id);
    await context.db.from("servicos_tecnicos").delete().eq("conta_id", context.usuario.conta_id).eq("servico_id", snapshot.id);
    const links = (snapshot.servicos_tecnicos || []).map(({ tecnico: _technician, ...link }) => link);
    if (links.length) await context.db.from("servicos_tecnicos").insert(links);
    await context.db.from("movimentacoes_financeiras").delete().eq("conta_id", context.usuario.conta_id).eq("servico_id", snapshot.id).in("origem", AUTO_ORIGINS);
    const movements = automaticMovements(snapshot).map((item) => stripUndefined(item));
    if (movements.length) await context.db.from("movimentacoes_financeiras").insert(movements);
  } catch (error) {
    console.error("Roberto: falha no rollback do serviço", error);
  }
}

async function commitService(args, context) {
  const plan = await servicePlan(args, context);
  if (plan.missing) throw new RobertoError(`Ainda há campos inválidos: ${plan.missing.join(", ")}.`);
  let serviceId = plan.before?.id || null;
  let created = false;
  let createdVehicle = null;
  try {
    if (args.operacao === "criar" && plan.newVehiclePayload) {
      const vehicleResult = await context.db
        .from("veiculos")
        .insert({
          ...plan.newVehiclePayload,
          conta_id: context.usuario.conta_id,
          created_by: context.usuario.id,
        })
        .select("id,placa,marca,modelo,ano,cor,chassi,observacoes,created_at")
        .single();
      throwIfDb(vehicleResult.error);
      createdVehicle = vehicleResult.data;
      plan.vehicle = vehicleResult.data;
      plan.payload.veiculo_id = vehicleResult.data.id;
    }

    if (args.operacao === "alterar_status" && plan.hasSettled) {
      const result = await context.db
        .from("servicos")
        .update({ status: plan.payload.status, updated_by: context.usuario.id, updated_at: new Date().toISOString() })
        .eq("conta_id", context.usuario.conta_id)
        .eq("id", serviceId)
        .select("id,status,updated_at")
        .single();
      throwIfDb(result.error);
    } else if (args.operacao === "editar" && plan.hasSettled) {
      const result = await context.db
        .from("servicos")
        .update({
          status: plan.payload.status,
          descricao: plan.payload.descricao,
          observacoes: plan.payload.observacoes,
          updated_by: context.usuario.id,
          updated_at: new Date().toISOString(),
        })
        .eq("conta_id", context.usuario.conta_id)
        .eq("id", serviceId);
      throwIfDb(result.error);
    } else {
      if (args.operacao === "criar") {
        const result = await context.db
          .from("servicos")
          .insert({ ...plan.payload, conta_id: context.usuario.conta_id, created_by: context.usuario.id })
          .select("id")
          .single();
        throwIfDb(result.error);
        serviceId = result.data.id;
        created = true;
      } else {
        const result = await context.db.from("servicos").update(plan.payload).eq("conta_id", context.usuario.conta_id).eq("id", serviceId);
        throwIfDb(result.error);
        await context.db.from("servicos_tecnicos").delete().eq("conta_id", context.usuario.conta_id).eq("servico_id", serviceId).then(({ error }) => throwIfDb(error));
      }

      const technicianRows = buildServiceTechnicianRows({
        serviceId,
        contaId: context.usuario.conta_id,
        usuarioId: context.usuario.id,
        serviceValue: plan.payload.valor,
        technicians: plan.technicianDrafts,
        currency: context.configuracao.moeda || "EUR",
      });
      const linkResult = await context.db.from("servicos_tecnicos").insert(technicianRows);
      throwIfDb(linkResult.error);
      await rebuildServiceFinancials(plan, serviceId, context);
    }

    const after = {
      id: serviceId,
      ...plan.payload,
      tecnicos: plan.technicianDrafts,
    };
    if (createdVehicle) {
      await logRobertoAudit(context, {
        entidade: "veiculos",
        acao: "criar",
        registroId: createdVehicle.id,
        descricao: `Veículo ${createdVehicle.placa} criado automaticamente com o serviço.`,
        after: createdVehicle,
      });
    }
    await logRobertoAudit(context, {
      entidade: "servicos",
      acao: args.operacao === "criar" ? "criar" : args.operacao === "alterar_status" ? "alterar_status" : "atualizar",
      registroId: serviceId,
      descricao: args.operacao === "criar" ? `Serviço ${plan.vehicle.placa} criado com financeiro pendente.` : args.operacao === "alterar_status" ? `Status do serviço ${plan.vehicle.placa} alterado para ${plan.payload.status}.` : `Serviço ${plan.vehicle.placa} atualizado.`,
      before: plan.before,
      after,
    });
    return {
      ok: true,
      message:
        plan.payload.status === "cancelado"
          ? "Serviço cancelado; os lançamentos automáticos pendentes foram removidos."
          : args.operacao === "criar"
            ? createdVehicle
              ? `Veículo ${createdVehicle.placa} e serviço cadastrados com sucesso. O recebível da oficina e os repasses dos técnicos foram gerados como pendentes.`
              : "Serviço cadastrado com sucesso. O recebível da oficina e os repasses dos técnicos foram gerados como pendentes."
            : "Serviço atualizado com sucesso e financeiro sincronizado conforme as regras atuais.",
      servico: after,
      veiculo_criado: createdVehicle,
    };
  } catch (error) {
    if (created && serviceId) {
      await context.db.from("servicos").delete().eq("conta_id", context.usuario.conta_id).eq("id", serviceId);
    } else if (plan.before) {
      await restoreServiceSnapshot(plan.before, context);
    }
    if (createdVehicle?.id) {
      await context.db.from("veiculos").delete().eq("conta_id", context.usuario.conta_id).eq("id", createdVehicle.id);
    }
    throw error;
  }
}

async function financialPlan(args, context) {
  if (!["liquidar", "reabrir"].includes(args.operacao)) {
    throw new RobertoError("Operação financeira inválida.");
  }
  const { data, error } = await context.db
    .from("movimentacoes_financeiras")
    .select("id,tipo,origem,descricao,valor,moeda,status,data_competencia,data_vencimento,data_pagamento,forma_pagamento,observacoes,oficina:oficinas(nome),tecnico:tecnicos(nome)")
    .eq("conta_id", context.usuario.conta_id)
    .eq("id", args.id)
    .maybeSingle();
  throwIfDb(error);
  if (!data) throw new RobertoError("Lançamento financeiro não encontrado nesta conta.", 404);
  if (args.operacao === "liquidar" && isSettledStatus(data.status)) throw new RobertoError("Este lançamento já está liquidado.");
  if (args.operacao === "reabrir" && !isSettledStatus(data.status)) throw new RobertoError("Este lançamento já está pendente.");
  return {
    before: data,
    payload:
      args.operacao === "liquidar"
        ? {
            status: "pago",
            data_pagamento: args.data_pagamento || todayISO(context.configuracao.timezone),
            forma_pagamento: cleanText(args.forma_pagamento),
            observacoes: cleanText(args.observacoes) ?? data.observacoes,
            updated_by: context.usuario.id,
            updated_at: new Date().toISOString(),
          }
        : {
            status: "pendente",
            data_pagamento: null,
            forma_pagamento: null,
            updated_by: context.usuario.id,
            updated_at: new Date().toISOString(),
          },
  };
}

async function prepareFinancial(args, context) {
  const plan = await financialPlan(args, context);
  return confirmation(context, "preparar_financeiro", args, {
    kind: "financeiro",
    title: args.operacao === "liquidar" ? (plan.before.tipo === "receita" ? "Confirmar recebimento" : "Confirmar pagamento") : "Reabrir lançamento",
    description: args.operacao === "liquidar" ? "Esta ação altera o status financeiro para pago." : "O lançamento voltará ao status pendente.",
    danger: args.operacao === "reabrir",
    fields: [
      { label: "Descrição", value: plan.before.descricao },
      { label: "Valor", value: `${context.configuracao.moeda} ${safeNumber(plan.before.valor).toFixed(2)}` },
      { label: "Data", value: plan.payload.data_pagamento },
      { label: "Forma", value: plan.payload.forma_pagamento },
    ].filter((field) => field.value),
  });
}

async function commitFinancial(args, context) {
  const plan = await financialPlan(args, context);
  const { data, error } = await context.db
    .from("movimentacoes_financeiras")
    .update(plan.payload)
    .eq("conta_id", context.usuario.conta_id)
    .eq("id", args.id)
    .select("id,tipo,descricao,valor,moeda,status,data_pagamento,forma_pagamento,updated_at")
    .single();
  throwIfDb(error);
  const action = args.operacao === "liquidar" ? (plan.before.tipo === "receita" ? "receber" : "pagar") : "reabrir";
  await logRobertoAudit(context, {
    entidade: "movimentacoes_financeiras",
    acao: action,
    registroId: data.id,
    descricao: `${plan.before.tipo === "receita" ? "Receita" : "Despesa"} ${args.operacao === "liquidar" ? "liquidada" : "reaberta"}: ${data.descricao}.`,
    before: plan.before,
    after: data,
  });
  return { ok: true, message: args.operacao === "liquidar" ? `${plan.before.tipo === "receita" ? "Recebimento" : "Pagamento"} registrado com sucesso.` : "Lançamento reaberto e marcado como pendente.", movimentacao: data };
}

const PREPARE_HANDLERS = {
  preparar_oficina: prepareOffice,
  preparar_tecnico: prepareTechnician,
  preparar_veiculo: prepareVehicle,
  preparar_servico: prepareService,
  preparar_financeiro: prepareFinancial,
};

const COMMIT_HANDLERS = {
  preparar_oficina: commitOffice,
  preparar_tecnico: commitTechnician,
  preparar_veiculo: commitVehicle,
  preparar_servico: commitService,
  preparar_financeiro: commitFinancial,
};

export async function executeRobertoTool(name, args, context) {
  const safeArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const readers = {
    buscar_oficinas: searchOffices,
    buscar_tecnicos: searchTechnicians,
    buscar_veiculos: searchVehicles,
    buscar_servicos: searchServices,
    consultar_financeiro: queryFinancial,
    consultar_dre: queryDre,
    consultar_auditoria: queryAudit,
    consultar_usuarios: queryUsers,
    consultar_configuracoes: async () => ({
      ok: true,
      conta: { id: context.conta.id, nome: context.conta.nome, nome_fantasia: context.conta.nome_fantasia },
      configuracao: context.configuracao,
    }),
    ajuda_plataforma: async (input) => ({ ok: true, assunto: input.assunto, orientacao: HELP[input.assunto] }),
  };
  if (readers[name]) return readers[name](safeArgs, context);
  if (PREPARE_HANDLERS[name]) return PREPARE_HANDLERS[name](safeArgs, context);
  throw new RobertoError(`Ferramenta não permitida: ${name}.`, 400, "UNKNOWN_TOOL");
}

export async function executeRobertoConfirmation(token, context) {
  const parsed = readConfirmation(token, context);
  const handler = COMMIT_HANDLERS[parsed.toolName];
  if (!handler) throw new RobertoError("A operação confirmada não é permitida.", 400, "UNKNOWN_CONFIRMATION");
  return handler(parsed.args, context);
}
