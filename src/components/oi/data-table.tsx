"use client";

// DataTable (#139 admin visual direction §7) — the ONE table for every admin list, on
// @tanstack/react-table (headless) with our markup. Toolbar: search, facet filter chips, column
// visibility, CSV export. Sticky header, sortable columns, hairline rows (no zebra), right-aligned
// numbers (set meta.align = "right"), optional row click, paging with a rows-per-page choice.
//
// Usage:
//   const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Bot" }, …];
//   <DataTable data={rows} columns={columns} searchPlaceholder="Search bots…"
//              facets={[{ column: "family", label: "Family" }]} onRowClick={(r) => open(r)} />

import { useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
  type Row,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, PlusCircle, Search, X } from "lucide-react";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: "left" | "right" | "center";
    /** Plain-text label for the column menu / CSV header when `header` is not a string. */
    label?: string;
    /** Value used for CSV export (defaults to the cell's raw value). */
    csv?: (row: TData) => string | number | null | undefined;
    className?: string;
  }
}

export interface Facet {
  column: string;
  label: string;
  /** Display text per raw value (defaults to the value). */
  format?: (v: string) => string;
}

function toCsv<T>(rows: Row<T>[], cols: ColumnDef<T>[]): string {
  const visible = cols.filter((c) => c.id !== "_actions");
  const head = visible.map((c) => c.meta?.label ?? (typeof c.header === "string" ? c.header : (c.id ?? "")));
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    visible
      .map((c) => {
        if (c.meta?.csv) return esc(c.meta.csv(r.original));
        const id = c.id ?? ("accessorKey" in c ? String(c.accessorKey) : "");
        return esc(r.getValue(id));
      })
      .join(","),
  );
  return [head.map(esc).join(","), ...lines].join("\n");
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = "Search…",
  facets = [],
  initialSort = [],
  pageSize = 25,
  onRowClick,
  rowClassName,
  emptyText = "Nothing to show.",
  toolbar,
  exportName,
  exportLabel = "Export CSV",
  maxHeight = "70dvh",
  dense = false,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string | null;
  facets?: Facet[];
  initialSort?: SortingState;
  /** 0 = show all rows (no paging). */
  pageSize?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  emptyText?: ReactNode;
  toolbar?: ReactNode;
  /** Filename (no extension) — shows an "Export CSV" button. */
  exportName?: string;
  /** Button text (default "Export CSV") — say what it exports when a page has several tables. */
  exportLabel?: string;
  maxHeight?: string;
  dense?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [openFacet, setOpenFacet] = useState<string | null>(null);
  const [colsOpen, setColsOpen] = useState(false);
  const [size, setSize] = useState(pageSize);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    ...(size > 0 ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: { pagination: { pageSize: size > 0 ? size : 1_000_000 } },
    globalFilterFn: "includesString",
    // column filters are only ever set by the facet chips: "row value is one of the chosen values"
    defaultColumn: { filterFn: facetFilter as FilterFn<T> },
  });

  const rows = size > 0 ? table.getRowModel().rows : table.getSortedRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const anyFilter = !!globalFilter || columnFilters.length > 0;

  const facetState = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of columnFilters) m.set(f.id, (f.value as string[]) ?? []);
    return m;
  }, [columnFilters]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchPlaceholder != null && (
          <label className="relative">
            <span className="sr-only">{searchPlaceholder}</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-56 rounded-lg border border-border bg-muted/30 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        )}
        {facets.map((f) => {
          const col = table.getColumn(f.column);
          if (!col) return null;
          const selected = facetState.get(f.column) ?? [];
          const values = [...col.getFacetedUniqueValues().keys()].filter((v) => v != null && v !== "").map(String).sort();
          return (
            <div key={f.column} className="relative">
              <button
                type="button"
                onClick={() => setOpenFacet((o) => (o === f.column ? null : f.column))}
                aria-expanded={openFacet === f.column}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <PlusCircle size={13} aria-hidden="true" />
                {f.label}
                {selected.length > 0 && (
                  <span className="rounded bg-accent px-1.5 text-foreground">{selected.length === 1 ? (f.format ?? String)(selected[0]) : `${selected.length} selected`}</span>
                )}
              </button>
              {openFacet === f.column && (
                <div className="absolute left-0 top-9 z-30 w-56 rounded-lg border border-border bg-popover p-1 shadow-xl" role="listbox" aria-label={f.label}>
                  {values.map((v) => {
                    const on = selected.includes(v);
                    const n = col.getFacetedUniqueValues().get(v) ?? 0;
                    return (
                      <button
                        key={v}
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => {
                          const next = on ? selected.filter((x) => x !== v) : [...selected, v];
                          col.setFilterValue(next.length ? next : undefined);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span className={`flex size-3.5 items-center justify-center rounded-sm border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} aria-hidden="true">
                          {on ? "✓" : ""}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{(f.format ?? String)(v)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{n}</span>
                      </button>
                    );
                  })}
                  {selected.length > 0 && (
                    <button type="button" onClick={() => col.setFilterValue(undefined)} className="mt-1 w-full rounded-md border-t border-border px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-accent">
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setGlobalFilter("");
              setColumnFilters([]);
            }}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Reset <X size={12} aria-hidden="true" />
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          {exportName && (
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([toCsv(table.getSortedRowModel().rows.filter((r) => table.getFilteredRowModel().rowsById[r.id]), columns)], { type: "text/csv" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${exportName}.csv`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Download size={13} aria-hidden="true" /> {exportLabel}
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setColsOpen((o) => !o)}
              aria-expanded={colsOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Columns3 size={13} aria-hidden="true" /> Columns
            </button>
            {colsOpen && (
              <div className="absolute right-0 top-9 z-30 w-52 rounded-lg border border-border bg-popover p-1 shadow-xl">
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                      <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} className="accent-[var(--primary)]" />
                      {c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-border bg-card" style={{ maxHeight }}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/40">
                {hg.headers.map((h) => {
                  const align = h.column.columnDef.meta?.align ?? "left";
                  const sort = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
                      className={`h-9 whitespace-nowrap px-3 text-xs font-medium text-muted-foreground ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${h.column.columnDef.meta?.className ?? ""}`}
                    >
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={`inline-flex items-center gap-1 hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""}`}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sort === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : sort === "desc" ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUpDown size={12} className="opacity-40" aria-hidden="true" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {anyFilter ? "No rows match these filters." : emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={onRowClick ? () => onRowClick(r.original) : undefined}
                  onKeyDown={onRowClick ? (e) => (e.key === "Enter" ? onRowClick(r.original) : undefined) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={`border-b border-border/60 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none" : ""} ${rowClassName?.(r.original) ?? ""}`}
                >
                  {r.getVisibleCells().map((c) => {
                    const align = c.column.columnDef.meta?.align ?? "left";
                    return (
                      <td
                        key={c.id}
                        className={`px-3 ${dense ? "py-1.5" : "py-2"} align-middle ${align === "right" ? "text-right font-mono tabular-nums" : align === "center" ? "text-center" : ""} ${c.column.columnDef.meta?.className ?? ""}`}
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span>
          {filteredCount === data.length ? `${data.length} row${data.length === 1 ? "" : "s"}` : `${filteredCount} of ${data.length} rows`}
        </span>
        {size > 0 && data.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              Rows per page
              <select
                value={size}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSize(n);
                  table.setPageSize(n > 0 ? n : 1_000_000);
                }}
                className="h-7 rounded-md border border-border bg-card px-1 text-foreground"
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value={-1}>All</option>
              </select>
            </label>
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border enabled:hover:bg-accent disabled:opacity-40">
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border enabled:hover:bg-accent disabled:opacity-40">
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Column filter for facet columns (value is a string[] of allowed raw values). */
function facetFilter<T>(row: Row<T>, id: string, value: string[]): boolean {
  return !value?.length || value.includes(String(row.getValue(id)));
}
