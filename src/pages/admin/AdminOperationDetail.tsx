import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/loanUtils";

export default function AdminOperationDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    (supabase.rpc as any)("admin_get_operation_detail", { _loan_id: id }).then(({ data, error }: any) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setData(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>;
  if (!data?.loan) return <div className="p-8 text-center text-muted-foreground text-sm">Operación no encontrada</div>;

  const l = data.loan;
  const fmt = (d: string | null) => d ? format(new Date(d), "dd/MM/yy HH:mm") : "—";
  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yy") : "—";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Button>

      <div className="fintech-card p-5 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{l.operation_type === "sale" ? "Venta al crédito" : "Préstamo"}</p>
            <h1 className="text-xl font-bold">{l.name}</h1>
            {l.concept && <p className="text-sm text-muted-foreground">{l.concept}</p>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-muted">Estado: {l.status}</span>
            <span className="px-2 py-0.5 rounded-full bg-muted">Aceptación: {l.confirmation_status}</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2 pt-2 text-sm">
          <Info label="Prestado" value={formatCurrency(Number(l.amount_lent))} />
          <Info label="A devolver" value={formatCurrency(Number(l.amount_to_return))} />
          <Info label="Devuelto" value={formatCurrency(Number(l.amount_returned))} />
          <Info label="Pendiente" value={formatCurrency(Number(l.amount_to_return) - Number(l.amount_returned))} />
          <Info label="Inicio" value={fmtDate(l.start_date)} />
          <Info label="Frecuencia" value={l.frequency || l.payment_type} />
          <Info label="Cliente DNI" value={l.dni} />
          <Info label="Celular" value={(l.phone_country_code || "") + (l.phone_number || "")} />
          <Info label="Email" value={l.email} />
          <Info label="Usuario" value={data.owner_email} />
          <Info label="Creada" value={fmt(l.created_at)} />
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2">Cuotas ({data.installments?.length ?? 0})</h2>
        <div className="fintech-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Vence</th><th className="text-left px-3 py-2">Monto</th><th className="text-left px-3 py-2">Pagado</th><th className="text-left px-3 py-2">Estado</th></tr>
            </thead>
            <tbody>
              {(data.installments || []).map((i: any) => (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{i.number}</td>
                  <td className="px-3 py-2">{fmtDate(i.due_date)}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(i.amount))}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(i.amount_paid))}</td>
                  <td className="px-3 py-2">{i.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Pagos ({data.payments?.length ?? 0})</h2>
        <div className="fintech-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr><th className="text-left px-3 py-2">Fecha</th><th className="text-left px-3 py-2">Monto</th><th className="text-left px-3 py-2">Notas</th></tr>
            </thead>
            <tbody>
              {(data.payments || []).map((p: any) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{fmt(p.payment_date)}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(p.amount_paid))}</td>
                  <td className="px-3 py-2">{p.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Consentimiento digital</h2>
        <div className="fintech-card p-4 grid sm:grid-cols-2 gap-2 text-sm">
          <Info label="Estado" value={l.confirmation_status} />
          <Info label="Enviado" value={fmt(l.confirmation_sent_at)} />
          <Info label="Respondido" value={fmt(l.confirmation_responded_at)} />
          <Info label="Token expira" value={fmt(l.confirmation_token_expires_at)} />
          <Info label="OTP verificado" value={fmt(l.otp_verified_at)} />
        </div>
      </section>

      {data.evidences?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Evidencias ({data.evidences.length})</h2>
          <div className="fintech-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr><th className="text-left px-3 py-2">Archivo</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Tamaño</th><th className="text-left px-3 py-2">Categoría</th><th className="text-left px-3 py-2">Subido</th></tr>
              </thead>
              <tbody>
                {data.evidences.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="px-3 py-2">{e.file_name}</td>
                    <td className="px-3 py-2">{e.mime_type}</td>
                    <td className="px-3 py-2">{Math.round(Number(e.size_bytes) / 1024)} KB</td>
                    <td className="px-3 py-2">{e.category || "—"}</td>
                    <td className="px-3 py-2">{fmt(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
