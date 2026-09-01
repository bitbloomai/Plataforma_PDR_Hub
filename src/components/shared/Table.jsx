"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { Button } from "./Button";
import { cn } from "./utils";

function getByPath(object, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((current, key) => current?.[key], object);
}

function getColumnValue(column, row) {
  if (typeof column.accessor === "function") return column.accessor(row);
  if (column.accessor) return getByPath(row, column.accessor);
  return getByPath(row, column.key);
}

function normalizeSearchValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "object") return Object.values(value).join(" ");
  return String(value);
}

export function Table({
  data = [],
  columns = [],
  rowKey = "id",
  loading = false,
  loadingRows = 6,
  emptyMessage = "Nenhum registro encontrado.",
  searchable = false,
  searchPlaceholder = "Buscar...",
  searchKeys,
  searchValue,
  onSearchChange,
  manualFiltering = false,
  sortable = true,
  sort: controlledSort,
  onSortChange,
  manualSorting = false,
  initialSort,
  pagination = true,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
  page: controlledPage,
  onPageChange,
  totalRows,
  manualPagination = false,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  onRowClick,
  toolbar,
  stickyHeader = false,
  compact = false,
  className,
  tableClassName,
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const [internalSort, setInternalSort] = useState(initialSort || null);
  const [internalPage, setInternalPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  const currentSearch = searchValue !== undefined ? searchValue : internalSearch;
  const currentSort = controlledSort !== undefined ? controlledSort : internalSort;
  const currentPage = controlledPage !== undefined ? controlledPage : internalPage;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRowsPerPage(pageSize));
    return () => cancelAnimationFrame(frame);
  }, [pageSize]);

  const searchedData = useMemo(() => {
    if (manualFiltering || !searchable || !currentSearch.trim()) return data;

    const term = currentSearch.trim().toLocaleLowerCase();
    const keys = searchKeys?.length
      ? searchKeys
      : columns.filter((column) => column.searchable !== false).map((column) => column.accessor || column.key);

    return data.filter((row) =>
      keys.some((key) => {
        const value = typeof key === "function" ? key(row) : getByPath(row, key);
        return normalizeSearchValue(value).toLocaleLowerCase().includes(term);
      })
    );
  }, [columns, currentSearch, data, manualFiltering, searchKeys, searchable]);

  const sortedData = useMemo(() => {
    if (manualSorting || !currentSort?.key) return searchedData;

    const column = columns.find((item) => item.key === currentSort.key);
    if (!column) return searchedData;

    const multiplier = currentSort.direction === "desc" ? -1 : 1;

    return [...searchedData].sort((a, b) => {
      const aValue = column.sortValue ? column.sortValue(a) : getColumnValue(column, a);
      const bValue = column.sortValue ? column.sortValue(b) : getColumnValue(column, b);

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * multiplier;
      }

      return String(aValue).localeCompare(String(bValue), "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }) * multiplier;
    });
  }, [columns, currentSort, manualSorting, searchedData]);

  const effectiveTotalRows = manualPagination ? totalRows ?? data.length : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotalRows / rowsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      const frame = requestAnimationFrame(() => {
        if (controlledPage === undefined) setInternalPage(totalPages);
        onPageChange?.(totalPages);
      });
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [controlledPage, currentPage, onPageChange, totalPages]);

  const visibleRows = useMemo(() => {
    if (!pagination || manualPagination) return sortedData;
    const start = (safePage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [manualPagination, pagination, rowsPerPage, safePage, sortedData]);

  const visibleIds = visibleRows.map((row, index) =>
    typeof rowKey === "function" ? rowKey(row, index) : getByPath(row, rowKey)
  );
  const selectedSet = new Set(selectedRows.map(String));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(String(id)));
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(String(id)));

  function setSearch(next) {
    if (searchValue === undefined) setInternalSearch(next);
    onSearchChange?.(next);
    goToPage(1);
  }

  function setSort(next) {
    if (controlledSort === undefined) setInternalSort(next);
    onSortChange?.(next);
  }

  function toggleSort(column) {
    if (!sortable || column.sortable === false) return;

    if (currentSort?.key !== column.key) {
      setSort({ key: column.key, direction: "asc" });
    } else if (currentSort.direction === "asc") {
      setSort({ key: column.key, direction: "desc" });
    } else {
      setSort(null);
    }
  }

  function goToPage(next) {
    const page = Math.min(Math.max(1, next), totalPages);
    if (controlledPage === undefined) setInternalPage(page);
    onPageChange?.(page);
  }

  function toggleRow(id) {
    const key = String(id);
    const next = selectedSet.has(key)
      ? selectedRows.filter((item) => String(item) !== key)
      : [...selectedRows, id];
    onSelectionChange?.(next);
  }

  function toggleVisible() {
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds.map(String));
      onSelectionChange?.(selectedRows.filter((item) => !visibleSet.has(String(item))));
    } else {
      const merged = [...selectedRows];
      const existing = new Set(selectedRows.map(String));
      visibleIds.forEach((id) => {
        if (!existing.has(String(id))) merged.push(id);
      });
      onSelectionChange?.(merged);
    }
  }

  const fromRow = effectiveTotalRows ? (safePage - 1) * rowsPerPage + 1 : 0;
  const toRow = pagination
    ? Math.min(safePage * rowsPerPage, effectiveTotalRows)
    : effectiveTotalRows;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-surface", className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          {searchable ? (
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
              <input
                value={currentSearch}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={cn("w-full min-w-[760px] text-left text-sm", tableClassName)}>
          <thead
            className={cn(
              "bg-surface-2 text-xs text-muted-foreground",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr>
              {selectable ? (
                <th className={cn("w-12 px-4", compact ? "py-2.5" : "py-3")}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(node) => {
                      if (node) node.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={toggleVisible}
                    aria-label="Selecionar registros visíveis"
                    className="size-4 rounded border-border-strong accent-primary"
                  />
                </th>
              ) : null}

              {columns.map((column) => {
                const active = currentSort?.key === column.key;
                const canSort = sortable && column.sortable !== false;
                return (
                  <th
                    key={column.key}
                    className={cn(
                      "font-medium",
                      compact ? "px-3 py-2.5" : "px-5 py-3",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                      column.headerClassName
                    )}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          "inline-flex items-center gap-1.5 transition hover:text-foreground",
                          column.align === "right" && "ml-auto",
                          column.align === "center" && "mx-auto",
                          active && "text-foreground"
                        )}
                      >
                        {column.header}
                        {active ? (
                          currentSort.direction === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {loading
              ? Array.from({ length: loadingRows }).map((_, rowIndex) => (
                  <tr key={`loading-${rowIndex}`}>
                    {selectable ? (
                      <td className={cn("px-4", compact ? "py-2.5" : "py-3.5")}>
                        <div className="size-4 animate-pulse rounded bg-surface-3" />
                      </td>
                    ) : null}
                    {columns.map((column, columnIndex) => (
                      <td
                        key={`${column.key}-${rowIndex}`}
                        className={cn(compact ? "px-3 py-2.5" : "px-5 py-3.5")}
                      >
                        <div
                          className="h-4 animate-pulse rounded bg-surface-3"
                          style={{ width: `${55 + ((rowIndex + columnIndex) % 4) * 10}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : visibleRows.map((row, rowIndex) => {
                  const id = typeof rowKey === "function" ? rowKey(row, rowIndex) : getByPath(row, rowKey);
                  const selected = selectedSet.has(String(id));

                  return (
                    <tr
                      key={String(id ?? rowIndex)}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        "transition hover:bg-surface-2/60",
                        onRowClick && "cursor-pointer",
                        selected && "bg-primary/5"
                      )}
                    >
                      {selectable ? (
                        <td className={cn("px-4", compact ? "py-2.5" : "py-3.5")} onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleRow(id)}
                            aria-label={`Selecionar registro ${rowIndex + 1}`}
                            className="size-4 rounded border-border-strong accent-primary"
                          />
                        </td>
                      ) : null}

                      {columns.map((column) => {
                        const value = getColumnValue(column, row);
                        return (
                          <td
                            key={column.key}
                            className={cn(
                              compact ? "px-3 py-2.5" : "px-5 py-3.5",
                              column.align === "right" && "text-right",
                              column.align === "center" && "text-center",
                              column.className
                            )}
                          >
                            {column.render ? column.render(value, row, rowIndex) : value ?? "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {!loading && !visibleRows.length ? (
        <div className="border-t border-border p-5">
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-background/60 p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        </div>
      ) : null}

      {!loading && pagination && effectiveTotalRows > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {fromRow}–{toRow} de {effectiveTotalRows}
            </span>

            <label className="flex items-center gap-2">
              <span>Linhas</span>
              <select
                value={rowsPerPage}
                onChange={(event) => {
                  const nextSize = Number(event.target.value);
                  setRowsPerPage(nextSize);
                  onPageSizeChange?.(nextSize);
                  goToPage(1);
                }}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="mr-1 text-xs text-muted-foreground">
              Página {safePage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => goToPage(1)}
              disabled={safePage <= 1}
              aria-label="Primeira página"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => goToPage(totalPages)}
              disabled={safePage >= totalPages}
              aria-label="Última página"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
