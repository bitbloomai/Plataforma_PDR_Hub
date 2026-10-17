import { todayISO } from "@/lib/dates";

export function csvEscape(value) {
  const text = String(value ?? "");
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/* =========================================================
   EXCEL (.xlsx) FORMATADO
   ========================================================= */

const XLSX_COLORS = {
  dark: "FF171715",
  yellow: "FFF2C21B",
  zebra: "FFF7F7F5",
  border: "FFE4E4DE",
  muted: "FF73736C",
  total: "FFFFF8D8",
  success: "FF116846",
  danger: "FFA63A3A",
  white: "FFFFFFFF",
};

const CURRENCY_SYMBOLS = {
  EUR: "€",
  BRL: "R$",
  USD: "US$",
  ARS: "AR$",
  CAD: "C$",
  MXN: "MX$",
  CHF: "CHF",
  GBP: "£",
  AUD: "A$",
  JPY: "¥",
  CLP: "CLP$",
};

const NUMERIC_TYPES = new Set(["money", "number", "integer", "percent", "date"]);

function excelMoneyFormat(currency) {
  const symbol = `"${CURRENCY_SYMBOLS[currency] || currency || "€"} "`;
  return `${symbol}#,##0.00;[Red]-${symbol}#,##0.00`;
}

function excelDateFormat(format) {
  if (format === "MM/DD/YYYY") return "mm/dd/yyyy";
  if (format === "YYYY-MM-DD") return "yyyy-mm-dd";
  return "dd/mm/yyyy";
}

function excelDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  // UTC evita que o fuso do navegador desloque o dia no Excel.
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

function sheetNameFrom(value, used) {
  const base = String(value || "Planilha").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Planilha";
  let name = base;
  for (let index = 2; used.has(name.toLowerCase()); index += 1) {
    name = `${base.slice(0, 28)} ${index}`;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Converte o valor bruto da célula conforme o tipo da coluna. */
function excelCellValue(raw, type) {
  const spec = raw && typeof raw === "object" && !(raw instanceof Date) && "value" in raw ? raw : null;
  const value = spec ? spec.value : raw;
  const cellType = spec?.type || type;

  if (value === null || value === undefined || value === "") return { value: null, type: cellType };
  if (cellType === "date") {
    const date = value instanceof Date ? value : excelDate(value);
    return date ? { value: date, type: "date" } : { value: String(value), type: "text" };
  }
  if (["money", "number", "integer", "percent"].includes(cellType)) {
    const number = typeof value === "number" ? value : Number.NaN;
    if (!Number.isFinite(number)) return { value: String(value), type: "text", align: "right" };
    return { value: cellType === "percent" ? number / 100 : number, type: cellType };
  }
  return { value: String(value), type: "text" };
}

function displayLength(value, type) {
  if (value === null || value === undefined) return 0;
  if (type === "date") return 11;
  if (type === "money") return Math.abs(Number(value) || 0).toFixed(2).length + 7;
  if (type === "percent") return 9;
  return Math.max(...String(value).split("\n").map((line) => line.length));
}

/**
 * Gera um .xlsx com visual da marca: faixa de título, cabeçalho destacado,
 * larguras automáticas, zebra, totais, cabeçalho congelado e filtro.
 *
 * sections[i] = {
 *   title, sheetName?, headers: string[],
 *   columns?: [{ type: "text"|"money"|"number"|"integer"|"percent"|"date", width? }],
 *   rows: Array<cell[] | { cells: cell[], tone?: "success"|"danger"|"result" }>,
 *   totals?: rows,   // exibidas após o filtro, em destaque
 * }
 * Uma célula pode ser um valor ou { value, type } para sobrescrever o tipo da coluna.
 * Valores "money" e "percent" (0–100) devem ser números.
 */
export async function downloadExcelReport({ filename, ...options }) {
  const buffer = await buildExcelReport(options);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `relatorio-${todayISO()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Monta o .xlsx e devolve o buffer (sem depender do DOM). */
export async function buildExcelReport({
  title,
  subtitle,
  metadata = [],
  sections = [],
  currency = "EUR",
  dateFormat = "DD/MM/YYYY",
}) {
  const { default: ExcelJS } = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PDR Hub";
  workbook.created = new Date();

  const usedNames = new Set();
  const moneyFormat = excelMoneyFormat(currency);
  const dateNumFormat = excelDateFormat(dateFormat);
  const metaLine = metadata
    .filter((item) => item?.[0])
    .map(([label, value]) => `${label}: ${value ?? ""}`)
    .join("    ·    ");
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const thinBorder = { style: "thin", color: { argb: XLSX_COLORS.border } };

  sections.forEach((section, sectionIndex) => {
    const headers = section.headers || [];
    const columnCount = Math.max(headers.length, 2);
    const columns = Array.from({ length: columnCount }, (_, index) => ({
      type: "text",
      ...(section.columns?.[index] || {}),
    }));

    const sheet = workbook.addWorksheet(
      sheetNameFrom(section.sheetName || section.title || `Planilha ${sectionIndex + 1}`, usedNames),
      {
        views: [{ showGridLines: false }],
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
      }
    );

    // Faixa de título
    sheet.mergeCells(1, 1, 1, columnCount);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = subtitle ? `${title}  —  ${subtitle}` : title;
    titleCell.font = { bold: true, size: 15, color: { argb: XLSX_COLORS.white } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.dark } };
    titleCell.alignment = { vertical: "middle", indent: 1 };
    sheet.getRow(1).height = 32;

    sheet.mergeCells(2, 1, 2, columnCount);
    sheet.getCell(2, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.yellow } };
    sheet.getRow(2).height = 5;

    sheet.mergeCells(3, 1, 3, columnCount);
    const sectionCell = sheet.getCell(3, 1);
    sectionCell.value = section.title || "";
    sectionCell.font = { bold: true, size: 12, color: { argb: XLSX_COLORS.dark } };
    sectionCell.alignment = { vertical: "middle" };
    sheet.getRow(3).height = 24;

    let rowIndex = 4;
    if (metaLine) {
      sheet.mergeCells(rowIndex, 1, rowIndex, columnCount);
      const metaCell = sheet.getCell(rowIndex, 1);
      metaCell.value = metaLine;
      metaCell.font = { size: 9, color: { argb: XLSX_COLORS.muted } };
      metaCell.alignment = { vertical: "middle", wrapText: true };
      sheet.getRow(rowIndex).height = metaLine.length > 140 ? 30 : 18;
      rowIndex += 1;
    }
    rowIndex += 1;

    // Cabeçalho
    const headerRowIndex = rowIndex;
    const headerRow = sheet.getRow(headerRowIndex);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 10, color: { argb: XLSX_COLORS.dark } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.yellow } };
      cell.alignment = {
        vertical: "middle",
        horizontal: NUMERIC_TYPES.has(columns[index].type) && columns[index].type !== "date" ? "right" : "left",
        wrapText: true,
      };
      cell.border = { bottom: { style: "medium", color: { argb: XLSX_COLORS.dark } } };
    });
    headerRow.height = 24;
    rowIndex += 1;

    const widths = headers.map((header) => String(header).length + 2);

    function writeRow(row, { zebra = false, emphasis = false } = {}) {
      const cells = Array.isArray(row) ? row : row?.cells || [];
      const tone = Array.isArray(row) ? null : row?.tone;
      const highlight = emphasis || tone === "result" || tone === "total";
      const excelRow = sheet.getRow(rowIndex);

      for (let index = 0; index < columnCount; index += 1) {
        const converted = excelCellValue(cells[index], columns[index].type);
        const cell = excelRow.getCell(index + 1);
        cell.value = converted.value;

        if (converted.type === "money") cell.numFmt = moneyFormat;
        else if (converted.type === "percent") cell.numFmt = "0.00%";
        else if (converted.type === "integer") cell.numFmt = "#,##0";
        else if (converted.type === "number") cell.numFmt = "#,##0.00";
        else if (converted.type === "date") cell.numFmt = dateNumFormat;

        const numeric = NUMERIC_TYPES.has(converted.type) && converted.type !== "date";
        cell.alignment = {
          vertical: "middle",
          horizontal: numeric || converted.align === "right" ? "right" : converted.type === "date" ? "center" : "left",
          wrapText: converted.type === "text" && String(converted.value || "").length > 60,
        };
        // O tom (verde/vermelho) destaca apenas os valores; textos ficam neutros.
        const toneColor =
          numeric && tone === "success" ? XLSX_COLORS.success : numeric && tone === "danger" ? XLSX_COLORS.danger : XLSX_COLORS.dark;
        cell.font = { size: 10, bold: highlight, color: { argb: toneColor } };
        if (highlight) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.total } };
          cell.border = { top: { style: "medium", color: { argb: XLSX_COLORS.dark } }, bottom: thinBorder };
        } else {
          if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.zebra } };
          cell.border = { bottom: thinBorder };
        }

        widths[index] = Math.max(widths[index] || 0, displayLength(converted.value, converted.type) + 2);
      }

      excelRow.height = highlight ? 22 : 19;
      rowIndex += 1;
    }

    const rows = section.rows || [];
    if (!rows.length) {
      sheet.mergeCells(rowIndex, 1, rowIndex, columnCount);
      const emptyCell = sheet.getCell(rowIndex, 1);
      emptyCell.value = "Sem dados para os filtros atuais.";
      emptyCell.font = { italic: true, size: 10, color: { argb: XLSX_COLORS.muted } };
      emptyCell.alignment = { horizontal: "center" };
      rowIndex += 1;
    }
    rows.forEach((row, index) => writeRow(row, { zebra: index % 2 === 1 }));
    const lastDataRow = rowIndex - 1;

    if (section.totals?.length) {
      rowIndex += 1; // separa os totais da área filtrável
      section.totals.forEach((row) => writeRow(row, { emphasis: true }));
    }

    rowIndex += 1;
    sheet.mergeCells(rowIndex, 1, rowIndex, columnCount);
    const footerCell = sheet.getCell(rowIndex, 1);
    footerCell.value = `Gerado pelo PDR Hub em ${generatedAt}.`;
    footerCell.font = { size: 8, italic: true, color: { argb: XLSX_COLORS.muted } };

    columns.forEach((column, index) => {
      sheet.getColumn(index + 1).width = column.width || Math.min(Math.max(widths[index] || 10, 10), 55);
    });

    sheet.views = [{ state: "frozen", ySplit: headerRowIndex, showGridLines: false }];
    if (headers.length && rows.length > 1) {
      sheet.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: lastDataRow, column: headers.length },
      };
    }
  });

  return workbook.xlsx.writeBuffer();
}

export function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function downloadCsvReport({ filename, title, metadata = [], sections = [] }) {
  const rows = [
    ["sep=;"],
    [title],
    ...metadata.filter(Boolean),
    [],
  ];

  sections.forEach((section, index) => {
    if (index > 0) rows.push([]);
    if (section.title) rows.push([section.title]);
    if (section.headers?.length) rows.push(section.headers);
    rows.push(...(section.rows || []));
  });

  const content = rows.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `relatorio-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildMetaGrid(metadata) {
  return metadata
    .filter((item) => item?.[0] || item?.[1])
    .map(
      ([label, value]) => `
        <div class="meta-item">
          <span>${htmlEscape(label)}</span>
          <strong>${htmlEscape(value)}</strong>
        </div>`
    )
    .join("");
}

function buildSummaryCards(cards) {
  return cards
    .filter(Boolean)
    .map(
      (card) => `
        <div class="summary-card ${card.tone || ""}">
          <span>${htmlEscape(card.label)}</span>
          <strong>${htmlEscape(card.value)}</strong>
          ${card.caption ? `<small>${htmlEscape(card.caption)}</small>` : ""}
        </div>`
    )
    .join("");
}

function buildTable(section) {
  const headers = section.headers || [];
  const rows = section.rows || [];

  return `
    <section class="report-section">
      ${section.title ? `<h2>${htmlEscape(section.title)}</h2>` : ""}
      ${section.description ? `<p class="section-description">${htmlEscape(section.description)}</p>` : ""}
      <table>
        <thead>
          <tr>
            ${headers
              .map(
                (header, index) =>
                  `<th class="${section.numericColumns?.includes(index) ? "number" : ""}">${htmlEscape(header)}</th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
                      <tr class="${row.tone || ""}">
                        ${(row.cells || row)
                          .map(
                            (cell, index) =>
                              `<td class="${section.numericColumns?.includes(index) ? "number" : ""}">${htmlEscape(cell)}</td>`
                          )
                          .join("")}
                      </tr>`
                  )
                  .join("")
              : `<tr><td colspan="${Math.max(headers.length, 1)}" class="empty">Sem dados para os filtros atuais.</td></tr>`
          }
        </tbody>
      </table>
    </section>`;
}

export function openPrintReport({
  title,
  subtitle,
  metadata = [],
  summaryCards = [],
  sections = [],
  footer,
  locale = "pt-BR",
}) {
  const popup = window.open("", "_blank", "width=1080,height=760");
  if (!popup) return false;

  const generatedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  popup.document.write(`
    <!doctype html>
    <html lang="${htmlEscape(locale)}">
      <head>
        <meta charset="utf-8" />
        <title>${htmlEscape(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f7f7f5;
            color: #171715;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
          }
          .page {
            max-width: 1120px;
            margin: 0 auto;
            padding: 28px;
          }
          .hero {
            border: 1px solid #dfdfd9;
            border-radius: 14px;
            background: #171715;
            color: #f7f7f5;
            overflow: hidden;
          }
          .hero-bar { height: 8px; background: #f2c21b; }
          .hero-content {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding: 22px 24px;
          }
          h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
          .subtitle { margin: 6px 0 0; color: #c9c9c1; font-size: 12px; }
          .brand {
            align-self: flex-start;
            border: 1px solid rgb(242 194 27 / 0.45);
            border-radius: 999px;
            padding: 7px 12px;
            color: #f2c21b;
            font-weight: 700;
            white-space: nowrap;
          }
          .meta {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 14px;
          }
          .meta-item, .summary-card {
            border: 1px solid #dfdfd9;
            border-radius: 10px;
            background: #ffffff;
            padding: 10px 12px;
          }
          .meta-item span, .summary-card span {
            display: block;
            color: #73736c;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .meta-item strong {
            display: block;
            margin-top: 3px;
            color: #171715;
            font-size: 12px;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 14px;
          }
          .summary-card strong {
            display: block;
            margin-top: 5px;
            color: #171715;
            font-size: 18px;
          }
          .summary-card small {
            display: block;
            margin-top: 4px;
            color: #73736c;
          }
          .summary-card.success { border-color: #16a269; }
          .summary-card.danger { border-color: #dc4c4c; }
          .summary-card.warning { border-color: #e7a61a; }
          .report-section {
            margin-top: 18px;
            border: 1px solid #dfdfd9;
            border-radius: 12px;
            background: #ffffff;
            overflow: hidden;
          }
          h2 {
            margin: 0;
            padding: 14px 16px 4px;
            font-size: 15px;
          }
          .section-description {
            margin: 0;
            padding: 0 16px 12px;
            color: #73736c;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            background: #f2c21b;
            color: #171715;
            padding: 10px 9px;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
          }
          td {
            border-top: 1px solid #e9e9e5;
            padding: 9px;
            vertical-align: top;
          }
          tbody tr:nth-child(even) td { background: #f7f7f5; }
          tr.result td {
            border-top: 2px solid #171715;
            background: #fff8d8 !important;
            font-weight: 800;
          }
          tr.success td { color: #116846; }
          tr.danger td { color: #a63a3a; }
          .number { text-align: right; white-space: nowrap; }
          .empty {
            padding: 22px;
            text-align: center;
            color: #73736c;
          }
          .footer {
            margin-top: 18px;
            color: #73736c;
            font-size: 10px;
            text-align: center;
          }
          @page { margin: 14mm; }
          @media print {
            body { background: #ffffff; }
            .page { max-width: none; padding: 0; }
            .report-section, .hero, .summary-card, .meta-item { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="hero">
            <div class="hero-bar"></div>
            <div class="hero-content">
              <div>
                <h1>${htmlEscape(title)}</h1>
                ${subtitle ? `<p class="subtitle">${htmlEscape(subtitle)}</p>` : ""}
              </div>
              <div class="brand">PDR Hub</div>
            </div>
          </header>
          ${metadata.length ? `<div class="meta">${buildMetaGrid(metadata)}</div>` : ""}
          ${summaryCards.length ? `<div class="summary">${buildSummaryCards(summaryCards)}</div>` : ""}
          ${sections.map(buildTable).join("")}
          <div class="footer">${htmlEscape(footer || `Gerado em ${generatedAt}.`)}</div>
        </main>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `);
  popup.document.close();
  return true;
}
