import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatCurrency, getTodayInLima } from "@/lib/loanUtils";
import { DataTable } from "./components/DataTable";

const TYPES = [
  { v: "all", l: "Todos los tipos" },
  { v: "loan", l: "Préstamos" },
  { v: "sale", l: "Ventas al crédito" },
];
const CONFIRMS = [
  { v: "all", l: "Toda confirmación" },
  { v: "not_sent", l: "No enviado" },
  { v: "pending", l: "Pendiente" },
  { v: "sent", l: "Enviado" },
  { v: "confirmed", l: "Aceptado" },
  { v: "rejected", l: "Rechazado" },
];
const STATUSES = [
  { v: "all", l: "Todo estado" },
  { v: "active", l: "Activo" },
  { v: "partial", l: "Parcial" },
  { v: "paid", l: "Pagado" },
];
const EXTRA = [
  { v: "all", l: "Todas" },
  { v: "overdue", l: "Vencidas" },
  { v: "pending", l: "Con pendiente" },
];

export default function AdminOperations() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [confirm, setConfirm] = useState("all");
  const [status, setStatus] = useState("all");
  const [extra, setExtra] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    (supabase.rpc as any)("admin_list_operations").then(({ data, error }: any) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  const today = getTodayInLima();
  const filtered = useMemo(() => rows.filter((r) => {
    if (type !== "all" && r.operation_type !== type) return false;
    if (confirm !== "all" && r.confirmation_status !== confirm) return false;
    if (status !== "all" && r.status !== status) return false;
    if (extra === "overdue") {
      if (!r.next_due_date || String(r.next_due_date).split("T")[0] >= today) return false;
    }
    if (extra === "pending") {
      if (Number(r.amount_pending) <= 0) return false;
    }
    return true;
  }), [rows, type, confirm, status, extra, today]);

  const Select = ({ value, onChange, options }: any) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="bg-card border border-border rounded-md px-3 py-2 text-sm">
      {options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Operaciones</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} de {rows.length} operaciones</p>
      </div>
      <DataTable
        rows={filtered}
        loading={loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/admin/operations/${r.id}`)}
        searchPlaceholder="Buscar por nombre, email u operación..."
        filters={
          <div className="flex flex-wrap gap-2">
            <Select value={type} onChange={setType} options={TYPES} />
            <Select value={confirm} onChange={setConfirm} options={CONFIRMS} />
            <Select value={status} onChange={setStatus} options={STATUSES} />
            <Select value={extra} onChange={setExtra} options={EXTRA} />
          </div>
        }
        columns={[
          { key: "name", header: "Cliente / Operación" },
          { key: "operation_type", header: "Tipo", render: (r) => r.operation_type === "sale" ? "Venta" : "Préstamo" },
          { key: "owner_email", header: "Usuario creador" },
          { key: "amount_to_return", header: "Monto", render: (r) => formatCurrency(Number(r.amount_to_return)) },
          { key: "installments_count", header: "Cuotas" },
          { key: "amount_pending", header: "Saldo", render: (r) => formatCurrency(Number(r.amount_pending)) },
          { key: "confirmation_status", header: "Aceptación" },
          { key: "status", header: "Pago" },
          { key: "next_due_date", header: "Próx. cuota", render: (r) => r.next_due_date ? format(new Date(r.next_due_date), "dd/MM/yy") : "—" },
          { key: "created_at", header: "Creada", render: (r) => format(new Date(r.created_at), "dd/MM/yy") },
        ]}
      />
    </div>
  );
}
