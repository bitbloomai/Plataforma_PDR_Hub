import { addDaysISO } from "@/lib/dates";

export const SERVICE_STATUSES = ["agendado", "em_andamento", "concluido", "cancelado"];

export function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function roundMoney(value) {
  return Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
}

export function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function normalizePlate(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

export function isSettledStatus(status) {
  return ["pago", "recebido", "paid"].includes(String(status || "").toLowerCase());
}

export function validateServiceDraft({
  oficinaId,
  veiculoId,
  dataServico,
  valor,
  status,
  tecnicos = [],
}) {
  const errors = [];

  if (!oficinaId) errors.push({ field: "oficina_id", message: "Informe a oficina." });
  if (!veiculoId) errors.push({ field: "veiculo_id", message: "Informe o veículo." });
  if (!dataServico) errors.push({ field: "data_servico", message: "Informe a data do serviço." });
  if (!SERVICE_STATUSES.includes(status)) {
    errors.push({ field: "status", message: "Informe um status válido." });
  }
  if (safeNumber(valor) <= 0) {
    errors.push({ field: "valor", message: "Informe um valor maior que zero." });
  }
  if (!tecnicos.length) {
    errors.push({ field: "tecnicos", message: "Informe pelo menos um técnico." });
  }

  const uniqueIds = new Set();
  let percentageTotal = 0;

  tecnicos.forEach((item, index) => {
    if (!item?.tecnico_id) {
      errors.push({ field: `tecnicos.${index}.tecnico_id`, message: "Informe o técnico." });
      return;
    }
    if (uniqueIds.has(item.tecnico_id)) {
      errors.push({ field: `tecnicos.${index}.tecnico_id`, message: "O técnico está duplicado." });
    }
    uniqueIds.add(item.tecnico_id);

    const percentage = safeNumber(item.percentual);
    percentageTotal += percentage;
    if (percentage <= 0 || percentage > 100) {
      errors.push({
        field: `tecnicos.${index}.percentual`,
        message: "Use um percentual entre 0 e 100.",
      });
    }
  });

  if (percentageTotal > 100) {
    errors.push({ field: "tecnicos", message: "A soma dos percentuais não pode ultrapassar 100%." });
  }

  return errors;
}

export function buildServiceTechnicianRows({
  serviceId,
  contaId,
  usuarioId,
  serviceValue,
  technicians,
}) {
  return technicians.map((item) => {
    const percentage = safeNumber(item.percentual);
    return {
      conta_id: contaId,
      servico_id: serviceId,
      tecnico_id: item.tecnico_id,
      percentual: percentage,
      valor_repasse: roundMoney((safeNumber(serviceValue) * percentage) / 100),
      created_by: usuarioId || null,
    };
  });
}

function vehicleName(vehicle) {
  return [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ") || "Veículo sem descrição";
}

export function buildServiceFinancialRows({
  serviceId,
  serviceDate,
  serviceValue,
  officeId,
  vehicle,
  technicianRows,
  techniciansById,
  status,
  contaId,
  usuarioId,
  dueDays = 0,
  existingMovements = [],
}) {
  if (status === "cancelado") return [];

  const dueDate = addDaysISO(serviceDate, dueDays);
  const oldRevenue = existingMovements.find(
    (movement) =>
      String(movement?.tipo || "").toLowerCase() === "receita" &&
      String(movement?.origem || "").toLowerCase() === "servico"
  );
  const vehicleText = [vehicleName(vehicle), vehicle?.placa].filter(Boolean).join(" · ");
  const technicianLookup =
    techniciansById instanceof Map
      ? (id) => techniciansById.get(id)
      : (id) => techniciansById?.[id];

  const rows = [
    {
      conta_id: contaId,
      categoria_id: oldRevenue?.categoria_id || null,
      servico_id: serviceId,
      tecnico_id: null,
      oficina_id: officeId,
      tipo: "receita",
      origem: "servico",
      descricao: `Serviço ${vehicleText}`,
      valor: roundMoney(serviceValue),
      status: "pendente",
      data_competencia: serviceDate,
      data_vencimento: dueDate,
      data_pagamento: null,
      forma_pagamento: null,
      observacoes: oldRevenue?.observacoes || null,
      created_by: oldRevenue?.created_by || usuarioId || null,
      updated_by: usuarioId || null,
      updated_at: new Date().toISOString(),
    },
  ];

  technicianRows.forEach((row) => {
    const technician = technicianLookup(row.tecnico_id);
    const old = existingMovements.find(
      (movement) =>
        String(movement?.tipo || "").toLowerCase() === "despesa" &&
        String(movement?.origem || "").toLowerCase() === "repasse_tecnico" &&
        movement.tecnico_id === row.tecnico_id
    );

    rows.push({
      conta_id: contaId,
      categoria_id: old?.categoria_id || null,
      servico_id: serviceId,
      tecnico_id: row.tecnico_id,
      oficina_id: officeId,
      tipo: "despesa",
      origem: "repasse_tecnico",
      descricao: `Repasse ${technician?.nome || "técnico"} · ${vehicle?.placa || vehicleName(vehicle)}`,
      valor: roundMoney(row.valor_repasse),
      status: "pendente",
      data_competencia: serviceDate,
      data_vencimento: old?.data_vencimento || null,
      data_pagamento: null,
      forma_pagamento: null,
      observacoes: old?.observacoes || null,
      created_by: old?.created_by || usuarioId || null,
      updated_by: usuarioId || null,
      updated_at: new Date().toISOString(),
    });
  });

  return rows;
}
