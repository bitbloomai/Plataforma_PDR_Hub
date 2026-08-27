import { todayISO } from "@/lib/dates";

export function csvEscape(value) {
  const text = String(value ?? "");
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
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
