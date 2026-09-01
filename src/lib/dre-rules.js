const DRE_GROUPS = [
  { id: "receita_operacional", type: "receita" },
  { id: "outras_receitas", type: "receita" },
  { id: "custos_diretos", type: "despesa" },
  { id: "despesas_operacionais", type: "despesa" },
  { id: "outras_despesas", type: "despesa" },
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function isRevenue(row) {
  return String(row?.tipo || "").toLowerCase() === "receita";
}

function groupById(id) {
  return DRE_GROUPS.find((group) => group.id === id) || null;
}

function normalizeGroupId(value) {
  const normalized = normalizeText(value);
  if (["receita operacional", "receitas operacionais"].includes(normalized)) return "receita_operacional";
  if (["outras receitas", "outra receita"].includes(normalized)) return "outras_receitas";
  if (["custos diretos", "custo direto", "custos", "custo"].includes(normalized)) return "custos_diretos";
  if (["despesas operacionais", "despesa operacional"].includes(normalized)) return "despesas_operacionais";
  if (["outras despesas", "outra despesa"].includes(normalized)) return "outras_despesas";
  return null;
}

function resolveGroup(movement) {
  const categoryGroup = groupById(normalizeGroupId(movement?.categoria?.grupo_dre));
  if (categoryGroup && categoryGroup.type === movement?.tipo) return categoryGroup.id;
  if (movement?.origem === "servico" && isRevenue(movement)) return "receita_operacional";
  if (movement?.origem === "repasse_tecnico" && !isRevenue(movement)) return "custos_diretos";
  return null;
}

function categoryMeta(movement) {
  if (movement?.categoria) {
    return { key: movement.categoria.id, name: movement.categoria.nome || "Sem categoria" };
  }
  if (movement?.origem === "servico") return { key: "implicit-servicos", name: "Serviços" };
  if (movement?.origem === "repasse_tecnico") {
    return { key: "implicit-repasses", name: "Repasse de técnicos" };
  }
  return {
    key: isRevenue(movement) ? "uncategorized-revenue" : "uncategorized-expense",
    name: "Sem categoria",
  };
}

export function buildDreSnapshot(movements = []) {
  const groupTotals = Object.fromEntries(DRE_GROUPS.map((group) => [group.id, 0]));
  const categoryMap = new Map();
  let unclassifiedRevenue = 0;
  let unclassifiedExpense = 0;

  movements.forEach((movement) => {
    const amount = Math.abs(safeNumber(movement.valor));
    const groupId = resolveGroup(movement);
    const revenue = isRevenue(movement);
    const meta = categoryMeta(movement);

    if (groupId) groupTotals[groupId] += amount;
    else if (revenue) unclassifiedRevenue += amount;
    else unclassifiedExpense += amount;

    const key = `${groupId || (revenue ? "sem_classificacao_receita" : "sem_classificacao_despesa")}:${meta.key}`;
    const row = categoryMap.get(key) || {
      key,
      name: meta.name,
      type: revenue ? "receita" : "despesa",
      group: groupId || "sem_classificacao",
      amount: 0,
      count: 0,
    };
    row.amount += amount;
    row.count += 1;
    categoryMap.set(key, row);
  });

  const operatingRevenue = groupTotals.receita_operacional;
  const otherRevenue = groupTotals.outras_receitas;
  const directCosts = groupTotals.custos_diretos;
  const operatingExpenses = groupTotals.despesas_operacionais;
  const otherExpenses = groupTotals.outras_despesas;
  const totalRevenue = operatingRevenue + otherRevenue + unclassifiedRevenue;
  const totalExpenses = directCosts + operatingExpenses + otherExpenses + unclassifiedExpense;
  const grossResult = operatingRevenue - directCosts;
  const operatingResult = grossResult - operatingExpenses;
  const netResult =
    operatingResult + otherRevenue - otherExpenses + unclassifiedRevenue - unclassifiedExpense;

  return {
    groupTotals,
    categories: [...categoryMap.values()].sort((a, b) => b.amount - a.amount),
    operatingRevenue,
    otherRevenue,
    directCosts,
    operatingExpenses,
    otherExpenses,
    unclassifiedRevenue,
    unclassifiedExpense,
    totalRevenue,
    totalExpenses,
    grossResult,
    operatingResult,
    netResult,
    margin: totalRevenue > 0 ? (netResult / totalRevenue) * 100 : 0,
    totalMovements: movements.length,
  };
}
