import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, Loader2, ShieldCheck, HandCoins, ShoppingCart } from "lucide-react";
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
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 }).format(n);

export default function ConfirmAgreement() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [loan, setLoan] = useState<LoanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLoan = async () => {
    if (!token) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_loan_by_token", { _token: token });
    if (error || !data || data.length === 0) {
      setError("No encontramos esta operación. El enlace puede haber expirado.");
    } else {
      setLoan(data[0] as LoanSummary);
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

  const isSale = loan.amount_lent === loan.amount_to_return;
  const startDate = (() => {
    const [y, m, d] = loan.start_date.split("-").map(Number);
    return format(new Date(y, m - 1, d), "dd 'de' MMMM, yyyy", { locale: es });
  })();

  const alreadyAnswered = loan.confirmation_status === "confirmed" || loan.confirmation_status === "rejected";

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
            <Row k="Monto total" v={formatPEN(loan.amount_to_return)} strong />
            <Row
              k="Modalidad"
              v={loan.payment_type === "installments" ? `${loan.num_installments} cuotas` : "Pago único"}
            />
            <Row k="Inicio" v={startDate} />
          </div>
        </div>

        {alreadyAnswered ? (
          <div
            className={`fintech-card p-4 text-center text-sm ${
              loan.confirmation_status === "confirmed" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {loan.confirmation_status === "confirmed"
              ? "✓ Ya confirmaste este acuerdo. ¡Gracias!"
              : "Has rechazado este acuerdo."}
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              onClick={() => respond("confirmed")}
              disabled={acting}
              className="w-full bg-emerald-500 hover:bg-emerald-500/90"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Acepto el acuerdo</>}
            </Button>
            <Button
              onClick={() => respond("rejected")}
              disabled={acting}
              variant="outline"
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" /> Rechazar
            </Button>
            <p className="text-[11px] text-center text-muted-foreground pt-1">
              Al aceptar dejas constancia de que conoces los términos de esta operación.
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
