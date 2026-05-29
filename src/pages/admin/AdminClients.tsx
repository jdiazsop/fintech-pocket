import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/loanUtils";
import { DataTable } from "./components/DataTable";

export default function AdminClients() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (supabase.rpc as any)("admin_list_clients").then(({ data, error }: any) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">{rows.length} clientes registrados</p>
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/admin/clients/${r.id}`)}
        searchPlaceholder="Buscar nombre, DNI, celular o email..."
        columns={[
          { key: "name", header: "Nombre", render: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "—" },
          { key: "dni", header: "DNI" },
          { key: "phone", header: "Celular" },
          { key: "email", header: "Email" },
          { key: "owner_email", header: "Registrado por" },
          { key: "operations_count", header: "Operaciones" },
          { key: "total_pending", header: "Pendiente", render: (r) => formatCurrency(Number(r.total_pending)) },
          { key: "created_at", header: "Creado", render: (r) => format(new Date(r.created_at), "dd/MM/yy") },
        ]}
      />
    </div>
  );
}
