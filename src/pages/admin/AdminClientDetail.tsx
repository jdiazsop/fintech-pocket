import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/loanUtils";

export default function AdminClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    (supabase.rpc as any)("admin_get_client_detail", { _client_id: id }).then(({ data, error }: any) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setData(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>;
  if (!data?.client) return <div className="p-8 text-center text-muted-foreground text-sm">Cliente no encontrado</div>;

  const c = data.client;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Button>

      <div className="fintech-card p-5 space-y-2">
        <p className="text-xs text-muted-foreground">Cliente</p>
        <h1 className="text-xl font-bold">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</h1>
        <div className="grid sm:grid-cols-2 gap-2 text-sm pt-2">
          <Info label="DNI" value={c.dni} />
          <Info label="Celular" value={(c.phone_country_code || "") + (c.phone_number || "")} />
          <Info label="Email" value={c.email} />
          <Info label="Dirección" value={c.address} />
          <Info label="Referencia" value={c.reference} />
          <Info label="Registrado por" value={data.owner_email} />
          <Info label="Creado" value={format(new Date(c.created_at), "dd/MM/yy HH:mm")} />
        </div>
        {c.notes && <div className="pt-2 text-sm text-muted-foreground">📝 {c.notes}</div>}
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2">Operaciones asociadas ({data.operations?.length ?? 0})</h2>
        <div className="fintech-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr><th className="text-left px-3 py-2">Operación</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Monto</th><th className="text-left px-3 py-2">Devuelto</th><th className="text-left px-3 py-2">Estado</th><th className="text-left px-3 py-2">Inicio</th></tr>
            </thead>
            <tbody>
              {(data.operations || []).map((o: any) => (
                <tr key={o.id} className="border-b border-border/50 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/admin/operations/${o.id}`)}>
                  <td className="px-3 py-2">{o.name}</td>
                  <td className="px-3 py-2">{o.operation_type === "sale" ? "Venta" : "Préstamo"}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(o.amount_to_return))}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(o.amount_returned))}</td>
                  <td className="px-3 py-2">{o.status}</td>
                  <td className="px-3 py-2">{o.start_date ? format(new Date(o.start_date), "dd/MM/yy") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}
