import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DataTable } from "./components/DataTable";

const STATUSES = [
  { v: "all", l: "Todos" },
  { v: "not_sent", l: "No enviado" },
  { v: "pending", l: "Pendiente" },
  { v: "sent", l: "Enviado" },
  { v: "confirmed", l: "Aceptado" },
  { v: "rejected", l: "Rechazado" },
];

export default function AdminConsents() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    (supabase.rpc as any)("admin_list_consents").then(({ data, error }: any) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => rows.filter((r) => status === "all" || r.confirmation_status === status), [rows, status]);

  const fmt = (d: string | null) => d ? format(new Date(d), "dd/MM/yy HH:mm") : "—";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Consentimiento digital</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} de {rows.length} acuerdos</p>
      </div>
      <DataTable
        rows={filtered}
        loading={loading}
        rowKey={(r) => r.loan_id}
        onRowClick={(r) => navigate(`/admin/operations/${r.loan_id}`)}
        searchPlaceholder="Buscar..."
        filters={
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-card border border-border rounded-md px-3 py-2 text-sm">
            {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        }
        columns={[
          { key: "loan_name", header: "Operación" },
          { key: "operation_type", header: "Tipo", render: (r) => r.operation_type === "sale" ? "Venta" : "Préstamo" },
          { key: "owner_email", header: "Usuario" },
          { key: "email_used", header: "Correo validación" },
          { key: "confirmation_status", header: "Estado" },
          { key: "confirmation_sent_at", header: "Enviado", render: (r) => fmt(r.confirmation_sent_at) },
          { key: "confirmation_responded_at", header: "Respondido", render: (r) => fmt(r.confirmation_responded_at) },
          { key: "expires_at", header: "Expira", render: (r) => fmt(r.expires_at) },
        ]}
      />
    </div>
  );
}
