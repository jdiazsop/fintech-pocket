import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/loanUtils";
import { DataTable } from "./components/DataTable";

export default function AdminPayments() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (supabase.rpc as any)("admin_list_payments").then(({ data, error }: any) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (type !== "all" && r.operation_type !== type) return false;
    const d = (r.payment_date || r.created_at)?.split("T")[0];
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }), [rows, type, from, to]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pagos</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} de {rows.length} pagos</p>
      </div>
      <DataTable
        rows={filtered}
        loading={loading}
        rowKey={(r) => r.id}
        searchPlaceholder="Buscar por usuario, cliente u operación..."
        filters={
          <div className="flex flex-wrap gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="bg-card border border-border rounded-md px-3 py-2 text-sm">
              <option value="all">Todos los tipos</option>
              <option value="loan">Préstamo</option>
              <option value="sale">Venta</option>
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-card border border-border rounded-md px-3 py-2 text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-card border border-border rounded-md px-3 py-2 text-sm" />
          </div>
        }
        columns={[
          { key: "owner_email", header: "Usuario" },
          { key: "client_name", header: "Cliente / Op." },
          { key: "operation_type", header: "Tipo", render: (r) => r.operation_type === "sale" ? "Venta" : "Préstamo" },
          { key: "amount_paid", header: "Monto pagado", render: (r) => formatCurrency(Number(r.amount_paid)) },
          { key: "balance_after", header: "Saldo después", render: (r) => formatCurrency(Number(r.balance_after)) },
          { key: "payment_date", header: "Fecha pago", render: (r) => format(new Date(r.payment_date), "dd/MM/yy HH:mm") },
          { key: "notes", header: "Notas", render: (r) => <span className="max-w-[200px] inline-block truncate align-bottom">{r.notes || "—"}</span> },
        ]}
      />
    </div>
  );
}
