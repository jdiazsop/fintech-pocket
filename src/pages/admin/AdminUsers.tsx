import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/loanUtils";
import { DataTable } from "./components/DataTable";

export default function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (supabase.rpc as any)("admin_list_users").then(({ data, error }: any) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">{rows.length} usuarios registrados</p>
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        rowKey={(r) => r.user_id}
        onRowClick={(r) => navigate(`/admin/users/${r.user_id}`)}
        searchPlaceholder="Buscar por email..."
        columns={[
          { key: "email", header: "Email" },
          { key: "role", header: "Rol", render: (r) => (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${r.role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{r.role}</span>
          ) },
          { key: "accepted_terms", header: "Términos", render: (r) => r.accepted_terms ? "Sí" : "No" },
          { key: "clients_count", header: "Clientes" },
          { key: "loans_count", header: "Operaciones" },
          { key: "total_lent", header: "Total prestado", render: (r) => formatCurrency(Number(r.total_lent)) },
          { key: "total_pending", header: "Pendiente", render: (r) => formatCurrency(Number(r.total_pending)) },
          { key: "created_at", header: "Registrado", render: (r) => format(new Date(r.created_at), "dd/MM/yy HH:mm") },
        ]}
      />
    </div>
  );
}
