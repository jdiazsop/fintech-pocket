import { ReactNode, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  empty?: string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  initialPageSize?: number;
}

export function DataTable<T>({
  rows, columns, loading, empty = "Sin registros",
  searchPlaceholder = "Filtrar...",
  filters, onRowClick, rowKey, initialPageSize = 25,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder={searchPlaceholder}
            className="pl-10 bg-card border-border"
          />
        </div>
        {filters}
      </div>

      <div className="fintech-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : pageRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{empty}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`text-left font-medium px-3 py-2 whitespace-nowrap ${c.className ?? ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-border/50 ${onRowClick ? "cursor-pointer hover:bg-muted/30" : ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.className ?? ""}`}>
                      {c.render ? c.render(row) : (row as any)[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} de {rows.length} registros</span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2 py-1 rounded border border-border disabled:opacity-30"
            >Anterior</button>
            <span>Pág. {safePage + 1} / {pageCount}</span>
            <button
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="px-2 py-1 rounded border border-border disabled:opacity-30"
            >Siguiente</button>
          </div>
        )}
      </div>
    </div>
  );
}
