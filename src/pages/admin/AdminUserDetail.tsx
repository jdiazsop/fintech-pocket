import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/loanUtils";

export default function AdminUserDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    (supabase.rpc as any)("admin_get_user_detail", { _user_id: id }).then(({ data, error }: any) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setData(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>;
  if (!data?.profile) return <div className="p-8 text-center text-muted-foreground text-sm">Usuario no encontrado</div>;

  const p = data.profile;
  const m = data.metrics;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Button>

      <div className="fintech-card p-5 space-y-2">
        <p className="text-xs text-muted-foreground">Usuario</p>
        <h1 className="text-xl font-bold">{p.email}</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {(data.roles || []).map((r: string) => (
            <span key={r} className="px-2 py-0.5 rounded-full bg-primary/15 text-primary">{r}</span>
          ))}
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Términos: {p.accepted_terms ? "Aceptados" : "No"}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Registrado: {format(new Date(p.created_at), "dd/MM/yy HH:mm")}
          </span>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground pt-2 break-all">{p.user_id}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Clientes" value={m.clients} />
        <Metric label="Operaciones" value={m.operations} />
        <Metric label="Pagos" value={m.payments} />
        <Metric label="Total prestado" value={formatCurrency(Number(m.total_lent))} />
        <Metric label="Total devuelto" value={formatCurrency(Number(m.total_returned))} />
        <Metric label="Pendiente" value={formatCurrency(Number(m.total_pending))} />
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2">Clientes ({data.clients?.length ?? 0})</h2>
        <div className="fintech-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr><th className="text-left px-3 py-2">Nombre</th><th className="text-left px-3 py-2">DNI</th><th className="text-left px-3 py-2">Celular</th></tr>
            </thead>
            <tbody>
              {(data.clients || []).map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/admin/clients/${c.id}`)}>
                  <td className="px-3 py-2">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-3 py-2">{c.dni || "—"}</td>
                  <td className="px-3 py-2">{(c.phone_country_code || "") + (c.phone_number || "") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Operaciones ({data.operations?.length ?? 0})</h2>
        <div className="fintech-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr><th className="text-left px-3 py-2">Cliente</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Monto</th><th className="text-left px-3 py-2">Devuelto</th><th className="text-left px-3 py-2">Estado</th></tr>
            </thead>
            <tbody>
              {(data.operations || []).map((o: any) => (
                <tr key={o.id} className="border-b border-border/50 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/admin/operations/${o.id}`)}>
                  <td className="px-3 py-2">{o.name}</td>
                  <td className="px-3 py-2">{o.operation_type === "sale" ? "Venta" : "Préstamo"}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(o.amount_to_return))}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(o.amount_returned))}</td>
                  <td className="px-3 py-2">{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="fintech-card p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
