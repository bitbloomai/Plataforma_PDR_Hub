"use client";

import { countryMeta, initials } from "@/lib/technicians";

export function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-success/10 text-success"
          : "bg-surface-2 text-muted-foreground"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          active ? "bg-success" : "bg-muted-foreground"
        }`}
      />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export function CountryBadge({ code, emptyLabel = "Não informada" }) {
  if (!code) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {emptyLabel}
      </span>
    );
  }

  const meta = countryMeta(code);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
      <span aria-hidden="true">{meta.flag}</span>
      {meta.label}
    </span>
  );
}

export function MetricCard({ label, value, caption, icon: Icon, tone = "primary", emphasis = false }) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "danger"
          ? "bg-danger/10 text-danger"
          : "bg-primary/10 text-foreground";

  return (
    <section
      className={`rounded-xl border p-4 sm:p-5 ${
        emphasis ? "border-primary/60 bg-primary/10" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>

        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${toneClass}`}>
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
      </div>
    </section>
  );
}

export function Avatar({ technician, photoUrl, size = "md" }) {
  const sizeClass =
    size === "xl"
      ? "size-24 text-2xl"
      : size === "lg"
        ? "size-20 text-xl"
        : size === "sm"
          ? "size-9 text-[11px]"
          : "size-14 text-sm";

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 font-semibold text-foreground ${sizeClass}`}
      title={technician?.nome || "Técnico"}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={technician?.nome || "Técnico"}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(technician?.nome)
      )}
    </span>
  );
}

export function InfoItem({ icon: Icon, label, value, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-3.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="size-3.5" strokeWidth={1.8} /> : null}
        {label}
      </div>
      <div className="mt-1.5 break-words text-sm font-medium text-foreground">
        {children || value || "Não informado"}
      </div>
    </div>
  );
}
