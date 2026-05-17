import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check, X, Loader2, ShieldCheck, HandCoins, ShoppingCart, Calendar,
  FileText, Mail, KeyRound, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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
  phone_masked?: string | null;
  otp_verified?: boolean;
  otp_active?: boolean;
  email_masked?: string | null;
  dni_required?: boolean;
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

const FREQ_LABEL: Record<string, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
};

export default function ConfirmAgreement() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [loan, setLoan] = useState<LoanSummary | null>(null);
  const [schedule, setSchedule] = useState<InstallmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // OTP flow
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpEmailMasked, setOtpEmailMasked] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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
      const row = data[0] as LoanSummary;
      setLoan(row);
      setSchedule((instData as InstallmentRow[]) || []);
      if (row.email_masked) setOtpEmailMasked(row.email_masked);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLoan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const requestOtp = async () => {
    if (!token) return;
    setRequestingOtp(true);
    setVerifyError(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-confirmation-otp", {
        body: { token },
      });
      if (error) throw error;
      if ((data as any)?.email_masked) setOtpEmailMasked((data as any).email_masked);
      setOtpRequested(true);
      toast({
        title: "Código enviado",
        description: `Revisa tu correo ${(data as any)?.email_masked || ""}. Puede tardar unos segundos.`,
      });
    } catch (e: any) {
      const msg = e?.context?.error || e?.message || "No se pudo enviar el código";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setRequestingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!token) return;
    setVerifyError(null);
    const code = otpCode.replace(/\D/g, "");
    if (code.length !== 6) {
      setVerifyError("Ingresa el código de 6 dígitos.");
      return;
    }
    setVerifying(true);
    const { data, error } = await supabase.rpc("verify_confirmation_otp", { _token: token, _code: code });
    setVerifying(false);
    if (error || !data) {
      setVerifyError("Código inválido o vencido. Solicita uno nuevo si es necesario.");
      return;
    }
    setOtpCode("");
    toast({ title: "Identidad validada", description: "Ya puedes aceptar o rechazar el acuerdo." });
    await fetchLoan();
  };

  const respond = async (status: "confirmed" | "rejected") => {
    if (!token) return;
    setActing(true);
    const { error } = await supabase.rpc("respond_loan_confirmation", { _token: token, _status: status });
    setActing(false);
    if (error) {
      const msg = (error as any).message || "";
      if (msg.includes("OTP_NOT_VERIFIED")) {
        toast({ title: "Validación requerida", description: "Valida tu código antes de responder.", variant: "destructive" });
        await fetchLoan();
        return;
      }
      toast({ title: "Error", description: "No se pudo registrar tu respuesta.", variant: "destructive" });
      return;
    }
    toast({
      title: status === "confirmed" ? "Acuerdo validado" : "Acuerdo rechazado",
      description: status === "confirmed" ? "La operación quedó registrada como Validada." : "Tu rechazo fue registrado.",
    });
    await fetchLoan();
  };

  const isSale = useMemo(() => {
    if (!loan) return false;
    return ((loan as any).operation_type ?? (Number(loan.amount_lent) === Number(loan.amount_to_return) ? "sale" : "loan")) === "sale";
  }, [loan]);

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

  const startDate = format(parseLocal(loan.start_date), "dd 'de' MMMM, yyyy", { locale: es });
  const installmentAmount = schedule[0]?.amount ?? 0;
  const lastDue = schedule.length > 0 ? schedule[schedule.length - 1].due_date.split("T")[0] : null;

  const alreadyAnswered = loan.confirmation_status === "confirmed" || loan.confirmation_status === "rejected";
  const isConfirmed = loan.confirmation_status === "confirmed";
  const respondedAt = loan.confirmation_responded_at
    ? format(new Date(loan.confirmation_responded_at), "dd MMM yyyy, HH:mm", { locale: es })
    : null;

  const frequencyLabel = loan.frequency ? FREQ_LABEL[loan.frequency] || loan.frequency : null;

  return (
    <div className="min-h-screen bg-background px-4 py-8 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-5"
      >
        {/* Brand header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary">Credify · Acuerdo digital</span>
          </div>
          <h1 className="text-xl font-bold mt-2">Acuerdo de operación</h1>
          <p className="text-xs text-muted-foreground">
            Documento digital de constancia entre las partes
          </p>
        </div>

        {/* Operation summary */}
        <div className="fintech-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            {isSale ? <ShoppingCart className="w-5 h-5 text-primary" /> : <HandCoins className="w-5 h-5 text-primary" />}
            <span className="font-semibold">{isSale ? "Venta al crédito" : "Préstamo"}</span>
          </div>

          <div className="space-y-2 text-sm">
            <Row k="Cliente" v={loan.name} />
            {loan.concept && <Row k="Concepto" v={loan.concept} />}
            {!isSale && (
              <Row k="Monto prestado" v={formatPEN(Number(loan.amount_lent))} />
            )}
            <Row
              k={isSale ? "Monto total" : "Monto total a devolver"}
              v={formatPEN(Number(loan.amount_to_return))}
              strong
            />
            <Row
              k="Modalidad"
              v={
                loan.payment_type === "installments"
                  ? `${loan.num_installments} cuota${loan.num_installments === 1 ? "" : "s"} de ${formatPEN(installmentAmount)}`
                  : "Pago único"
              }
            />
            {frequencyLabel && loan.payment_type === "installments" && (
              <Row k="Frecuencia" v={frequencyLabel} />
            )}
            <Row k="Primer pago" v={startDate} />
            {lastDue && <Row k="Vencimiento final" v={format(parseLocal(lastDue), "dd 'de' MMMM, yyyy", { locale: es })} />}
          </div>
        </div>

        {/* Schedule */}
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
                    <p className="text-muted-foreground">
                      {format(parseLocal(inst.due_date.split("T")[0]), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatPEN(Number(inst.amount))}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main conditions */}
        <div className="fintech-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Condiciones del acuerdo</h2>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Al aceptar, dejas constancia digital de que conoces y estás de acuerdo con los términos descritos.</li>
            <li>El cronograma y los montos forman parte integrante de este acuerdo.</li>
            <li>Tu respuesta queda registrada con fecha, hora, dispositivo y validación de identidad.</li>
            <li>Si rechazas, el acuerdo no tendrá efecto y el otro participante será notificado.</li>
            <li>Esta confirmación no reemplaza ningún acuerdo legal adicional que las partes decidan firmar.</li>
          </ul>
        </div>

        {/* Result / Action area */}
        {alreadyAnswered ? (
          <div
            className={`fintech-card p-4 text-center text-sm space-y-1 ${
              isConfirmed ? "text-emerald-400" : "text-red-400"
            }`}
          >
            <p className="font-semibold">
              {isConfirmed ? "✓ Acuerdo validado y aceptado" : "✕ Acuerdo rechazado"}
            </p>
            {respondedAt && (
              <p className="text-[11px] text-muted-foreground">Registrado el {respondedAt}</p>
            )}
          </div>
        ) : !loan.otp_verified ? (
          <div className="fintech-card p-4 space-y-3 sticky bottom-3 border border-primary/30">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Validación de identidad</h2>
            </div>

            {!otpRequested && !loan.otp_active ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Para aceptar o rechazar este acuerdo enviaremos un <strong>código de 6 dígitos</strong> a tu correo{" "}
                  {otpEmailMasked ? <strong>{otpEmailMasked}</strong> : "registrado"}.
                </p>
                <Button
                  onClick={requestOtp}
                  disabled={requestingOtp || !otpEmailMasked}
                  className="w-full bg-primary hover:bg-primary/90 h-11"
                >
                  {requestingOtp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Enviar código a mi correo
                    </>
                  )}
                </Button>
                {!otpEmailMasked && (
                  <p className="text-[11px] text-red-400 text-center">
                    Esta operación no tiene correo registrado. Pide al remitente que lo agregue.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Ingresa el código de 6 dígitos que enviamos a{" "}
                  {otpEmailMasked ? <strong>{otpEmailMasked}</strong> : "tu correo"}. Vence en 15 minutos.
                </p>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setVerifyError(null);
                  }}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                  autoComplete="one-time-code"
                />
                {verifyError && <p className="text-xs text-red-400">{verifyError}</p>}
                <Button
                  onClick={verifyOtp}
                  disabled={verifying || otpCode.length !== 6}
                  className="w-full bg-primary hover:bg-primary/90 h-11"
                >
                  {verifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Validar código
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={requestOtp}
                  disabled={requestingOtp}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  {requestingOtp ? "Enviando…" : "Reenviar código"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2 sticky bottom-3">
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> Identidad validada por correo
            </div>
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
              Tu respuesta quedará registrada con fecha, hora y validación por correo.
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
