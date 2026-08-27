"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleX,
  Search,
} from "lucide-react";
import { cn } from "./utils";

const controlBase =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

function normalizeOptions(options = []) {
  return options.map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : { ...option, label: option.label ?? String(option.value ?? "") }
  );
}

function useClickOutside(ref, callback) {
  useEffect(() => {
    function handler(event) {
      if (!ref.current || ref.current.contains(event.target)) return;
      callback?.();
    }

    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [callback, ref]);
}

export function Form({ className, children, ...props }) {
  return (
    <form className={cn("space-y-5", className)} {...props}>
      {children}
    </form>
  );
}

export function FormGrid({ className, columns = 2, children }) {
  const columnsClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 md:grid-cols-3"
        : columns === 4
          ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-2";

  return <div className={cn("grid gap-4", columnsClass, className)}>{children}</div>;
}

export function FormSection({ title, description, children, className }) {
  return (
    <section className={cn("space-y-4", className)}>
      {title || description ? (
        <div>
          {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className,
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}

      {children}

      {error ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, error, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(controlBase, error && "border-danger focus:border-danger focus:ring-danger/15", className)}
      aria-invalid={error ? true : undefined}
      {...props}
    />
  );
});

export const DateInput = forwardRef(function DateInput({ className, error, ...props }, ref) {
  return (
    <div className="relative min-w-0 max-w-full overflow-hidden">
      <CalendarDays
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.8}
      />
      <Input
        ref={ref}
        type="date"
        error={error}
        className={cn("min-w-0 max-w-full appearance-none pl-9 pr-2", className)}
        {...props}
      />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, error, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "min-h-24 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-danger focus:border-danger focus:ring-danger/15",
        className
      )}
      aria-invalid={error ? true : undefined}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { className, error, placeholder, options = [], children, ...props },
  ref
) {
  const normalized = normalizeOptions(options);

  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          controlBase,
          "appearance-none pr-9",
          error && "border-danger focus:border-danger focus:ring-danger/15",
          className
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {children ||
          normalized.map((option) => (
            <option key={String(option.value)} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.8}
      />
    </div>
  );
});

export function CurrencyInput({
  value,
  onValueChange,
  currency = "EUR",
  locale = "pt-BR",
  min,
  max,
  step = "0.01",
  className,
  error,
  ...props
}) {
  const symbol = useMemo(() => {
    try {
      return (
        new Intl.NumberFormat(locale, { style: "currency", currency })
          .formatToParts(0)
          .find((part) => part.type === "currency")?.value || currency
      );
    } catch {
      return currency;
    }
  }, [currency, locale]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {symbol}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        error={error}
        onChange={(event) => {
          const next = event.target.value;
          onValueChange?.(next === "" ? "" : Number(next));
        }}
        className={cn("pl-10", className)}
        {...props}
      />
    </div>
  );
}

export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhuma opção encontrada.",
  disabled = false,
  clearable = true,
  className,
  error,
  id,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const normalized = useMemo(() => normalizeOptions(options), [options]);

  const selected = normalized.find((option) => String(option.value) === String(value));
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return normalized;
    return normalized.filter((option) =>
      `${option.label} ${option.description || ""}`.toLocaleLowerCase().includes(term)
    );
  }, [normalized, query]);

  useClickOutside(rootRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  function choose(option) {
    if (!option || option.disabled) return;
    onChange?.(option.value, option);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event) {
    if (!open && ["Enter", " ", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setHighlighted(0);
      setOpen(true);
      return;
    }

    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, Math.max(0, filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(filtered[highlighted]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          controlBase,
          "flex items-center justify-between gap-2 pr-9 text-left",
          selected && clearable && !disabled && "pr-16",
          !selected && "text-muted-foreground",
          error && "border-danger focus:border-danger focus:ring-danger/15"
        )}
        onClick={() => {
          setHighlighted(0);
          setOpen((current) => !current);
        }}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label || placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      </button>

      {selected && clearable && !disabled ? (
        <button
          type="button"
          aria-label="Limpar seleção"
          className="absolute right-8 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onChange?.("", null);
            setQuery("");
            setOpen(false);
          }}
        >
          <CircleX className="size-3.5" strokeWidth={1.8} />
        </button>
      ) : null}

      {open ? (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length ? (
              filtered.map((option, index) => {
                const active = String(option.value) === String(value);
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => choose(option)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition",
                      highlighted === index ? "bg-surface-2" : "hover:bg-surface-2",
                      active ? "font-medium text-foreground" : "text-foreground",
                      option.disabled && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {active ? <Check className="mt-0.5 size-4 shrink-0 text-primary-active" strokeWidth={2} /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MultiSelect({
  value = [],
  onChange,
  options = [],
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhuma opção encontrada.",
  maxVisible = 2,
  disabled = false,
  className,
  error,
  id,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalized = useMemo(() => normalizeOptions(options), [options]);
  const selectedValues = Array.isArray(value) ? value : [];

  const selected = normalized.filter((option) =>
    selectedValues.some((item) => String(item) === String(option.value))
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return normalized;
    return normalized.filter((option) =>
      `${option.label} ${option.description || ""}`.toLocaleLowerCase().includes(term)
    );
  }, [normalized, query]);

  useClickOutside(rootRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  function toggle(option) {
    if (option.disabled) return;
    const exists = selectedValues.some((item) => String(item) === String(option.value));
    const next = exists
      ? selectedValues.filter((item) => String(item) !== String(option.value))
      : [...selectedValues, option.value];
    onChange?.(next, option);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          controlBase,
          "flex min-h-10 h-auto items-center justify-between gap-2 py-1.5 text-left",
          error && "border-danger focus:border-danger focus:ring-danger/15"
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selected.length ? (
            <>
              {selected.slice(0, maxVisible).map((option) => (
                <span
                  key={String(option.value)}
                  className="inline-flex max-w-44 items-center rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground"
                >
                  <span className="truncate">{option.label}</span>
                </span>
              ))}
              {selected.length > maxVisible ? (
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground">
                  +{selected.length - maxVisible}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length ? (
              filtered.map((option) => {
                const active = selectedValues.some((item) => String(item) === String(option.value));
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    onClick={() => toggle(option)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-surface-2",
                      option.disabled && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong bg-background"
                      )}
                    >
                      {active ? <Check className="size-3" strokeWidth={2.4} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </div>

          {selected.length ? (
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {selected.length} selecionado{selected.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                onClick={() => onChange?.([], null)}
              >
                Limpar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Switch({
  checked = false,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
  id,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        disabled && "opacity-50",
        className
      )}
    >
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label
              htmlFor={inputId}
              className="block cursor-pointer text-sm font-medium text-foreground"
            >
              {label}
            </label>
          )}

          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}

      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          "disabled:cursor-not-allowed",
          checked
            ? "border-primary bg-primary"
            : "border-border-strong bg-surface-3"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm",
            "transition-transform duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  className,
  disabled,
  id,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <label htmlFor={inputId} className={cn("flex items-start gap-2.5", disabled && "opacity-50", className)}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-primary focus:ring-primary/25"
        {...props}
      />
      <span className="min-w-0">
        {label ? <span className="block text-sm font-medium text-foreground">{label}</span> : null}
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

export function RadioGroup({ value, onChange, options = [], name, className, orientation = "vertical" }) {
  const generatedName = useId();
  const groupName = name || generatedName;
  const normalized = normalizeOptions(options);

  return (
    <div
      className={cn(
        orientation === "horizontal" ? "flex flex-wrap gap-4" : "space-y-2.5",
        className
      )}
    >
      {normalized.map((option) => (
        <label key={String(option.value)} className={cn("flex items-start gap-2.5", option.disabled && "opacity-50")}>
          <input
            type="radio"
            name={groupName}
            value={option.value}
            checked={String(value) === String(option.value)}
            disabled={option.disabled}
            onChange={() => onChange?.(option.value, option)}
            className="mt-0.5 size-4 shrink-0 border-border-strong accent-primary focus:ring-primary/25"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{option.label}</span>
            {option.description ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}
