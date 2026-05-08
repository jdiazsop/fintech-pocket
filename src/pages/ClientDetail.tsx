import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  ChevronRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MailQuestion,
  Wallet,
  ShoppingBag,
  Plus,
  Calendar,
  User as UserIcon,
  Pencil,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { EditClientDialog } from "@/components/clients/EditClientDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCurrency,
  getTodayInLima,
  calculateLoanDisplayStatus,
  getStatusLabel,
  getStatusVariant,
} from "@/lib/loanUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { StatusBadge } from "@/components/ui/status-badge";

interface Loan {
  id: string;
  name: string;
  concept: string | null;
  amount_lent: number;
  amount_to_return: number;
  amount_returned: number;
  status: string;
  start_date: string;
  created_at: string;
  confirmation_status: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  dni: string | null;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  reference: string | null;
}

interface Installment {
  id: string;
  loan_id: string;
  number: number;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
}

const clientKey = (l: { dni: string | null; phone_number: string | null; name: string; id: string }) =>
  (l.dni || l.phone_number || l.name || "").trim().toLowerCase() || l.id;

export default function ClientDetail() {
  const { key: routeKey } = useParams<{ key: string }>();
  const decodedKey = decodeURIComponent(routeKey || "");
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user, decodedKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: loansData } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
      const all = (loansData as Loan[]) || [];
      const filtered = all.filter((l) => clientKey(l) === decodedKey);
      setLoans(filtered);

      const ids = filtered.map((l) => l.id);
      if (ids.length) {
        const { data: instData } = await supabase.from("installments").select("*").in("loan_id", ids);
        setInstallments((instData as Installment[]) || []);
      } else {
        setInstallments([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const enriched = useMemo(() => {
    const today = getTodayInLima();
    return loans.map((l) => {
      const inst = installments.filter((i) => i.loan_id === l.id);
      const pendingAmount = Number(l.amount_to_return) - Number(l.amount_returned);
      const pendingInst = inst.filter((i) => Number(i.amount_paid) < Number(i.amount));
      const overdueInst = pendingInst.filter((i) => i.due_date.split("T")[0] < today);
      const nextInst = pendingInst
        .slice()
        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
      const displayStatus = calculateLoanDisplayStatus(
        l.status,
        inst.map((i) => ({ id: i.id, due_date: i.due_date, amount: Number(i.amount), amount_paid: Number(i.amount_paid), status: i.status })),
        Number(l.amount_returned),
        Number(l.amount_to_return),
      );
      const isSale = Number(l.amount_lent) === Number(l.amount_to_return);
      const progress = Number(l.amount_to_return) > 0
        ? (Number(l.amount_returned) / Number(l.amount_to_return)) * 100
        : 0;
      return {
        loan: l,
        pendingAmount,
        pendingCount: pendingInst.length,
        overdueCount: overdueInst.length,
        nextInst,
        displayStatus,
        isSale,
        progress,
      };
    });
  }, [loans, installments]);

  const summary = useMemo(() => {
    const totalPending = enriched.reduce((s, e) => s + e.pendingAmount, 0);
    const totalOverdue = enriched.reduce((s, e) => s + e.overdueCount, 0);
    const active = enriched.filter((e) => e.pendingAmount > 0).length;
    const paid = enriched.filter((e) => e.pendingAmount <= 0).length;
    let status: "overdue" | "upcoming" | "pending_confirm" | "on_time" = "on_time";
    const today = getTodayInLima();
    const nextDates = enriched
      .filter((e) => e.pendingAmount > 0 && e.nextInst)
      .map((e) => e.nextInst!.due_date.split("T")[0]);
    const minDate = nextDates.sort()[0];
    const daysToNext = minDate ? differenceInCalendarDays(parseISO(minDate), parseISO(today)) : null;
    if (totalPending <= 0) status = "on_time";
    else if (totalOverdue > 0) status = "overdue";
    else if (daysToNext !== null && daysToNext <= 7) status = "upcoming";
    else if (loans.some((l) => l.confirmation_status && !["confirmed", "rejected", "not_sent"].includes(l.confirmation_status)))
      status = "pending_confirm";
    return { totalPending, totalOverdue, active, paid, status, daysToNext };
  }, [enriched, loans]);

  const client = loans[0];
  const phoneCC = (client?.phone_country_code || "").replace(/\D/g, "");
  const phonePN = (client?.phone_number || "").replace(/\D/g, "");
  const fullPhone = phoneCC && phonePN ? `${phoneCC}${phonePN}` : "";

  const statusVisual = (s: typeof summary.status) => {
    switch (s) {
      case "overdue":
        return { color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", icon: AlertTriangle, label: "Atrasado" };
      case "upcoming":
        return { color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/30", icon: Clock, label: "Próximo" };
      case "pending_confirm":
        return { color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", icon: MailQuestion, label: "Pend. confirmación" };
      default:
        return { color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: CheckCircle2, label: "Al día" };
    }
  };

  const handleWhatsApp = () => {
    if (!fullPhone) return;
    const msg = summary.totalOverdue > 0
      ? `Hola ${client.name}, te recordamos que tienes ${summary.totalOverdue} cuota(s) vencida(s) por ${formatCurrency(summary.totalPending)}. ¿Podrías regularizar el pago? Gracias.`
      : `Hola ${client.name}, te recordamos tu próximo pago por ${formatCurrency(summary.totalPending)}. Gracias.`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleCall = () => {
    if (!fullPhone) return;
    window.location.href = `tel:+${fullPhone}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="px-4 py-6 space-y-3 max-w-4xl mx-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="fintech-card p-4 animate-pulse h-24" />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="px-4 py-10 text-center max-w-md mx-auto">
          <UserIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-2">Cliente no encontrado</h2>
          <Button onClick={() => navigate("/portfolio")} variant="outline">
            Volver a Clientes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const sv = statusVisual(summary.status);
  const StatusIcon = sv.icon;

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={() => navigate("/portfolio")}
            className="p-2 -ml-2 rounded-lg hover:bg-accent/40 transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold truncate">{client.name}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {client.dni ? `DNI ${client.dni}` : fullPhone ? `+${fullPhone}` : "Sin contacto"}
            </p>
          </div>
        </motion.div>

        {/* Resumen general */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fintech-card p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Deuda total pendiente</p>
              <p className="text-2xl font-bold text-primary tabular-nums">
                {formatCurrency(summary.totalPending)}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${sv.bg} ${sv.color}`}>
              <StatusIcon className="w-3 h-3" />
              {sv.label}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Operaciones</p>
              <p className="font-semibold tabular-nums">{loans.length}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Activas</p>
              <p className="font-semibold tabular-nums">{summary.active}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vencidas</p>
              <p className={`font-semibold tabular-nums ${summary.totalOverdue > 0 ? "text-red-400" : ""}`}>
                {summary.totalOverdue}
              </p>
            </div>
          </div>

          <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-1"} gap-2 pt-1`}>
            {isMobile && (
              <button
                onClick={handleCall}
                disabled={!fullPhone}
                className="flex items-center justify-center gap-2 py-2 rounded-lg border border-border bg-card hover:bg-accent/30 active:scale-[0.98] transition-all text-sm font-medium disabled:opacity-40"
              >
                <Phone className="w-4 h-4" />
                Llamar
              </button>
            )}
            <button
              onClick={handleWhatsApp}
              disabled={!fullPhone}
              className="flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.98] transition-all text-sm font-medium text-emerald-400 disabled:opacity-40"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
        </motion.section>

        {/* Operaciones */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Operaciones registradas
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/new-loan")}
              className="text-primary hover:text-primary"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva
            </Button>
          </div>

          {enriched.map((e, idx) => {
            const TypeIcon = e.isSale ? ShoppingBag : Wallet;
            return (
              <motion.button
                key={e.loan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                onClick={() => navigate(`/loan/${e.loan.id}`)}
                className="fintech-card p-4 w-full text-left active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                        <TypeIcon className="w-3 h-3" />
                        {e.isSale ? "Venta al crédito" : "Préstamo"}
                      </span>
                      <StatusBadge variant={getStatusVariant(e.displayStatus)} dot>
                        {getStatusLabel(e.displayStatus)}
                      </StatusBadge>
                    </div>
                    <h3 className="font-semibold mt-1.5 truncate">
                      {e.loan.concept || (e.isSale ? "Venta al crédito" : "Préstamo")}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {(() => {
                        const [y, m, d] = e.loan.start_date.split("-").map(Number);
                        return format(new Date(y, m - 1, d), "dd MMM yyyy", { locale: es });
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <p className="text-[10px] text-muted-foreground">Pendiente</p>
                    <p className="text-base font-bold text-primary tabular-nums">
                      {formatCurrency(e.pendingAmount)}
                    </p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span>
                      {e.pendingCount > 0
                        ? `${e.pendingCount} cuota${e.pendingCount === 1 ? "" : "s"} pendiente${e.pendingCount === 1 ? "" : "s"}`
                        : "Sin cuotas pendientes"}
                      {e.overdueCount > 0 && (
                        <span className="text-red-400"> · {e.overdueCount} vencida{e.overdueCount === 1 ? "" : "s"}</span>
                      )}
                    </span>
                    <span className="tabular-nums">{e.progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        e.displayStatus === "paid"
                          ? "bg-emerald-500"
                          : e.displayStatus === "overdue"
                          ? "bg-red-500"
                          : e.displayStatus === "partial"
                          ? "bg-orange-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(e.progress, 100)}%` }}
                    />
                  </div>
                </div>

                {e.nextInst && e.pendingAmount > 0 && (
                  <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Próxima cuota:{" "}
                    <span className="font-medium text-foreground">
                      {(() => {
                        const [y, m, d] = e.nextInst.due_date.split("T")[0].split("-").map(Number);
                        return format(new Date(y, m - 1, d), "dd MMM", { locale: es });
                      })()}
                    </span>
                    <span>· {formatCurrency(Number(e.nextInst.amount) - Number(e.nextInst.amount_paid))}</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </section>
      </div>
    </AppLayout>
  );
}
