import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, Loader2, ShieldCheck, HandCoins, ShoppingCart, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface LoanSummary {
  id: string;
  name: string;
  concept: string | null;
  amount_lent: number;
  amount_to_return: number;
  start_date: string;
  payment_type: string;
  frequency: string | null;
  confirmation_status: string;
  num_installments: number;
  confirmation_sent_at: string | null;
  confirmation_responded_at: string | null;
  operation_type?: string | null;
  expired?: boolean;
}

interface InstallmentRow {
  number: number;
  due_date: string;
  amount: number;
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 }).format(n);

const parseLocal = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export default function ConfirmAgreement() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [loan, setLoan] = useState<LoanSummary | null>(null);
  const [schedule, setSchedule] = useState<InstallmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchLoan = async () => {
    if (!token) return;
    setLoading(true);
    const [{ data, error }, { data: instData }] = await Promise.all([
      supabase.rpc("get_loan_by_token", { _token: token }),
      supabase.rpc("get_installments_by_token", { _token: token }),
    ]);
    if (error || !data || data.length === 0) {
      setError("No encontramos esta operación. El enlace puede haber expirado.");
    } else if ((data[0] as any).expired) {
      setError("Este enlace ha expirado. Solicita un nuevo enlace al remitente.");
    } else {
      setLoan(data[0] as LoanSummary);
      setSchedule((instData as InstallmentRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLoan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const respond = async (status: "confirmed" | "rejected") => {
    if (!token) return;
    setActing(true);
    const { error } = await supabase.rpc("respond_loan_confirmation", { _token: token, _status: status });
    setActing(false);
    if (!error) await fetchLoan();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <p className="text-center text-muted-foreground">{error}</p>
      </div>
    );
  }

  const isSale = ((loan as any).operation_type ?? (Number(loan.amount_lent) === Number(loan.amount_to_return) ? "sale" : "loan")) === "sale";
  const startDate = format(parseLocal(loan.start_date), "dd 'de' MMMM, yyyy", { locale: es });
  const installmentAmount = schedule[0]?.amount ?? 0;
  const lastDue = schedule.length > 0 ? schedule[schedule.length - 1].due_date : null;

  const alreadyAnswered = loan.confirmation_status === "confirmed" || loan.confirmation_status === "rejected";
  const isConfirmed = loan.confirmation_status === "confirmed";
  const isRejected = loan.confirmation_status === "rejected";
  const respondedAt = loan.confirmation_responded_at
    ? format(new Date(loan.confirmation_responded_at), "dd MMM yyyy, HH:mm", { locale: es })
    : null;

  return (
    <div className="min-h-screen bg-background px-4 py-8 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-5"
      >
        <div className="flex items-center gap-2 justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Acuerdo de operación</h1>
        </div>

        <div className="fintech-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            {isSale ? <ShoppingCart className="w-5 h-5 text-primary" /> : <HandCoins className="w-5 h-5 text-primary" />}
            <span className="font-semibold">{isSale ? "Venta al crédito" : "Préstamo"}</span>
          </div>

          <div className="space-y-2 text-sm">
            <Row k="Cliente" v={loan.name} />
            {loan.concept && <Row k="Concepto" v={loan.concept} />}
            <Row k="Monto total" v={formatPEN(Number(loan.amount_to_return))} strong />
            <Row
              k="Modalidad"
              v={loan.payment_type === "installments" ? `${loan.num_installments} cuota${loan.num_installments === 1 ? "" : "s"} de ${formatPEN(installmentAmount)}` : "Pago único"}
            />
            <Row k="Inicio" v={startDate} />
            {lastDue && <Row k="Vencimiento final" v={format(parseLocal(lastDue), "dd 'de' MMMM, yyyy", { locale: es })} />}
          </div>
        </div>

        {/* Cronograma */}
        {schedule.length > 0 && loan.payment_type === "installments" && (
          <div className="fintech-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Cronograma de pagos</h2>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {schedule.map((inst) => (
                <div key={inst.number} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                  <div>
                    <p className="font-medium">Cuota {inst.number}</p>
                    <p className="text-muted-foreground">{format(parseLocal(inst.due_date.split("T")[0]), "dd MMM yyyy", { locale: es })}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatPEN(Number(inst.amount))}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Condiciones principales */}
        <div className="fintech-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Condiciones principales</h2>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Al aceptar, dejas constancia digital de que conoces y estás de acuerdo con los términos de esta operación.</li>
            <li>Tu respuesta queda registrada con fecha y hora como evidencia para ambas partes.</li>
            <li>Si rechazas, el acuerdo no tendrá efecto y el otro participante será notificado.</li>
            <li>Esta confirmación no reemplaza ningún acuerdo legal adicional que las partes decidan firmar.</li>
          </ul>
        </div>

        {alreadyAnswered ? (
          <div
            className={`fintech-card p-4 text-center text-sm space-y-1 ${
              isConfirmed ? "text-emerald-400" : "text-red-400"
            }`}
          >
            <p className="font-semibold">
              {isConfirmed ? "✓ Aceptaste este acuerdo" : "✕ Rechazaste este acuerdo"}
            </p>
            {respondedAt && (
              <p className="text-[11px] text-muted-foreground">Registrado el {respondedAt}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 sticky bottom-3">
            <Button
              onClick={() => respond("confirmed")}
              disabled={acting}
              className="w-full bg-emerald-500 hover:bg-emerald-500/90 h-12 text-base"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-5 h-5 mr-2" /> Acepto el acuerdo</>}
            </Button>
            <Button
              onClick={() => respond("rejected")}
              disabled={acting}
              variant="outline"
              className="w-full h-11"
            >
              <X className="w-4 h-4 mr-2" /> Rechazar
            </Button>
            <p className="text-[11px] text-center text-muted-foreground pt-1">
              Tu respuesta quedará registrada con fecha y hora.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className={`text-right ${strong ? "font-semibold text-base" : ""}`}>{v}</span>
    </div>
  );
}
