import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Wallet, CircleDollarSign, Sparkles, Calendar, PlusCircle, BadgeDollarSign, Phone, MessageCircle, ChevronDown, Flame, UserCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { parseISO, differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/loanUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickPaymentSheet } from "@/components/payments/QuickPaymentSheet";
import { NewOperationSheet } from "@/components/operations/NewOperationSheet";

interface Loan {
  id: string;
  name: string;
  concept: string | null;
  amount_lent: number;
  amount_to_return: number;
  amount_returned: number;
  status: string;
  start_date: string;
}

interface InstallmentWithLoan {
  id: string;
  loan_id: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
  loan: {
    name: string;
    phone_country_code?: string | null;
    phone_number?: string | null;
  };
}

type PrioritySort = "most_overdue" | "least_overdue" | "highest_amount";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [upcomingInstallments, setUpcomingInstallments] = useState<InstallmentWithLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [prioritySort, setPrioritySort] = useState<PrioritySort>("most_overdue");
  const [showAllPriority, setShowAllPriority] = useState(false);
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [newOpOpen, setNewOpOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });

      if (loansError) throw loansError;
      setLoans(loansData || []);

      const { data: installmentsData, error: installmentsError } = await supabase
        .from("installments")
        .select(`
          *,
          loan:loans(name, phone_country_code, phone_number)
        `)
        .in("status", ["pending", "partial"])
        .order("due_date", { ascending: true });

      if (installmentsError) throw installmentsError;
      setUpcomingInstallments((installmentsData as InstallmentWithLoan[]) || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPending = loans.reduce((sum, loan) =>
    sum + (loan.amount_to_return - loan.amount_returned), 0
  );

  const todayStr = useMemo(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date()),
    []
  );

  // Group installments by loan for "Cobranzas prioritarias"
  const priorityGroups = useMemo(() => {
    const relevant = upcomingInstallments.filter(i => {
      const d = i.due_date.split("T")[0];
      const diff = differenceInCalendarDays(parseISO(d), parseISO(todayStr));
      return (diff < 0 || (diff >= 0 && diff <= 7)) && Number(i.amount_paid) < Number(i.amount);
    });

    const map = new Map<string, {
      loanId: string;
      name: string;
      phone: string;
      overdueInstallments: InstallmentWithLoan[];
      upcomingInstallments: InstallmentWithLoan[];
      totalDue: number;
      maxDaysOverdue: number;
    }>();

    relevant.forEach(inst => {
      const d = inst.due_date.split("T")[0];
      const diff = differenceInCalendarDays(parseISO(d), parseISO(todayStr));
      const pending = Number(inst.amount) - Number(inst.amount_paid);

      const cc = (inst.loan?.phone_country_code || "").replace(/\D/g, "");
      const pn = (inst.loan?.phone_number || "").replace(/\D/g, "");
      const fullPhone = cc && pn ? `${cc}${pn}` : "";

      const existing = map.get(inst.loan_id) || {
        loanId: inst.loan_id,
        name: inst.loan?.name || "Sin nombre",
        phone: fullPhone,
        overdueInstallments: [],
        upcomingInstallments: [],
        totalDue: 0,
        maxDaysOverdue: -Infinity,
      };

      if (diff < 0) existing.overdueInstallments.push(inst);
      else existing.upcomingInstallments.push(inst);

      existing.totalDue += pending;
      existing.maxDaysOverdue = Math.max(existing.maxDaysOverdue, -diff);
      map.set(inst.loan_id, existing);
    });

    const groups = Array.from(map.values());

    groups.sort((a, b) => {
      const aOver = a.overdueInstallments.length > 0;
      const bOver = b.overdueInstallments.length > 0;
      if (aOver !== bOver) return aOver ? -1 : 1;
      if (prioritySort === "most_overdue") return b.maxDaysOverdue - a.maxDaysOverdue;
      if (prioritySort === "least_overdue") return a.maxDaysOverdue - b.maxDaysOverdue;
      if (prioritySort === "highest_amount") return b.totalDue - a.totalDue;
      return 0;
    });

    return groups;
  }, [upcomingInstallments, todayStr, prioritySort]);

  const visibleGroups = showAllPriority ? priorityGroups : priorityGroups.slice(0, 5);

  const formatDueDates = (insts: InstallmentWithLoan[]) => {
    return insts
      .slice()
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 3)
      .map(i => {
        const [y, m, d] = i.due_date.split("T")[0].split("-").map(Number);
        return format(new Date(y, m - 1, d), "dd MMM", { locale: es });
      })
      .join(", ");
  };

  const handleCall = (group: { name: string; phone: string }) => {
    const phone = group.phone || (window.prompt(`Ingresa el número de teléfono de ${group.name}:`) || "").replace(/\D/g, "");
    if (phone) {
      window.location.href = `tel:+${phone}`;
    }
  };

  const handleWhatsApp = (group: { name: string; phone: string; totalDue: number; overdueInstallments: InstallmentWithLoan[] }) => {
    const phone = group.phone || (window.prompt(`Ingresa el número de WhatsApp de ${group.name} (con código de país, ej: 51999999999):`) || "").replace(/\D/g, "");
    if (phone) {
      const overdueCount = group.overdueInstallments.length;
      const message = overdueCount > 0
        ? `Hola ${group.name}, te recordamos que tienes ${overdueCount} cuota(s) vencida(s) por un total de ${formatCurrency(group.totalDue)}. ¿Podrías regularizar el pago? Gracias.`
        : `Hola ${group.name}, te recordamos que tienes una cuota próxima a vencer por ${formatCurrency(group.totalDue)}. Gracias.`;
      openWhatsApp(phone, message);
    }
  };

  return (
    <AppLayout>
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        {/* Top header with profile access */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-wide">Credify</span>
          </div>
          <button
            onClick={() => navigate("/profile")}
            aria-label="Ir a mi perfil"
            className="w-10 h-10 rounded-full bg-card border border-border/60 hover:border-primary/40 hover:bg-primary/10 active:scale-95 transition-all flex items-center justify-center"
          >
            <UserCircle2 className="w-5 h-5 text-foreground/80" />
          </button>
        </header>

        {/* Quick Actions CTA */}
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          aria-label="Acciones rápidas"
          className="fintech-card p-3 sm:p-4 bg-gradient-to-br from-card to-card/60 border border-border/60"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm sm:text-base font-semibold">¿Qué quieres hacer?</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={() => setNewOpOpen(true)}
              aria-label="Crear nueva operación"
              className="group flex flex-col items-start gap-2 p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/15 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <PlusCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-semibold leading-tight">Nueva operación</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Préstamo o venta</p>
              </div>
            </button>

            <button
              onClick={() => setQuickPayOpen(true)}
              aria-label="Registrar un pago rápidamente"
              className="group flex flex-col items-start gap-2 p-3 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                <BadgeDollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-semibold leading-tight">Registrar pago</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Cobro rápido</p>
              </div>
            </button>
          </div>
        </motion.section>

        {/* KPI Cards */}
        {(() => {
          const todayStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Lima",
            year: "numeric", month: "2-digit", day: "2-digit",
          }).format(new Date());
          const overdueItems = upcomingInstallments.filter(i => i.due_date.split("T")[0] < todayStr && i.amount_paid < i.amount);
          const dueTodayItems = upcomingInstallments.filter(i => i.due_date.split("T")[0] === todayStr && i.amount_paid < i.amount);
          const next7Items = upcomingInstallments.filter(i => {
            const d = i.due_date.split("T")[0];
            const diff = differenceInCalendarDays(parseISO(d), parseISO(todayStr));
            return diff >= 1 && diff <= 7 && i.amount_paid < i.amount;
          });
          const sumPending = (arr: InstallmentWithLoan[]) => arr.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0);
          const overdueCount = overdueItems.length;
          const dueTodayCount = dueTodayItems.length;
          const next7Count = next7Items.length;
          const overdueAmount = sumPending(overdueItems);
          const dueTodayAmount = sumPending(dueTodayItems);
          const next7Amount = sumPending(next7Items);

          return (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
              <div className="fintech-card p-3 sm:p-4 bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground font-medium mb-1">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <span>Por cobrar</span>
                </div>
                <p className="text-lg sm:text-2xl font-bold tabular-nums text-primary">{formatCurrency(totalPending)}</p>
              </div>

              <div className="fintech-card p-3 sm:p-4 bg-gradient-to-br from-red-500/15 to-red-500/5 border border-red-500/30">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground font-medium mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>Cuotas vencidas</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg sm:text-2xl font-bold tabular-nums text-red-400 leading-none">{overdueCount}</p>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">cuota{overdueCount === 1 ? "" : "s"}</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold tabular-nums text-red-400/90 mt-1">{formatCurrency(overdueAmount)}</p>
              </div>

              <div className="fintech-card p-3 sm:p-4 bg-gradient-to-br from-orange-500/15 to-orange-500/5 border border-orange-500/30">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground font-medium mb-1">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  <span>Vencen hoy</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg sm:text-2xl font-bold tabular-nums text-orange-400 leading-none">{dueTodayCount}</p>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">cuota{dueTodayCount === 1 ? "" : "s"}</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold tabular-nums text-orange-400/90 mt-1">{formatCurrency(dueTodayAmount)}</p>
              </div>

              <div className="fintech-card p-3 sm:p-4 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground font-medium mb-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Próximos 7 días</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg sm:text-2xl font-bold tabular-nums text-emerald-400 leading-none">{next7Count}</p>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">cuota{next7Count === 1 ? "" : "s"}</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold tabular-nums text-emerald-400/90 mt-1">{formatCurrency(next7Amount)}</p>
              </div>
            </div>
          );
        })()}

        {/* Cobranzas Prioritarias */}
        <section className="space-y-3 sm:space-y-4" aria-label="Cobranzas prioritarias">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
              <h2 className="text-sm sm:text-base font-semibold text-foreground/90 truncate">
                Cobranzas prioritarias
              </h2>
            </div>
            <Select value={prioritySort} onValueChange={(v) => setPrioritySort(v as PrioritySort)}>
              <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs bg-card border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="most_overdue">Más recientes</SelectItem>
                <SelectItem value="least_overdue">Menos recientes</SelectItem>
                <SelectItem value="highest_amount">Mayor monto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {loading ? (
              <div className="fintech-card p-6 sm:p-8 text-center">
                <div className="animate-pulse text-muted-foreground text-sm">Cargando...</div>
              </div>
            ) : priorityGroups.length === 0 ? (
              <div className="fintech-card p-6 sm:p-8 text-center">
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  No hay cuotas vencidas ni próximas a vencer
                </p>
              </div>
            ) : (
              <>
                {visibleGroups.map((group, index) => {
                  const isOverdue = group.overdueInstallments.length > 0;
                  const totalCuotas = group.overdueInstallments.length + group.upcomingInstallments.length;
                  const dates = isOverdue
                    ? formatDueDates(group.overdueInstallments)
                    : formatDueDates(group.upcomingInstallments);

                  return (
                    <motion.article
                      key={group.loanId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.3) }}
                      className={`fintech-card p-3 sm:p-4 border ${
                        isOverdue ? "border-red-500/30" : "border-orange-500/30"
                      }`}
                    >
                      <button
                        onClick={() => navigate(`/loan/${group.loanId}`)}
                        className="w-full text-left active:scale-[0.99] transition-transform"
                        aria-label={`Ver detalle de ${group.name}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm sm:text-base truncate">{group.name}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                              {totalCuotas} cuota{totalCuotas === 1 ? "" : "s"}{" "}
                              {isOverdue ? "vencida" : "próxima"}{totalCuotas === 1 ? "" : "s"} · {formatCurrency(group.totalDue)}
                            </p>
                            {dates && (
                              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                                {isOverdue ? "Venció" : "Vence"}: {dates}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className={`text-base sm:text-lg font-bold tabular-nums ${
                              isOverdue ? "text-red-400" : "text-orange-400"
                            }`}>
                              {formatCurrency(group.totalDue)}
                            </p>
                            <StatusBadge
                              variant={isOverdue ? "danger" : "warning"}
                              dot
                              className="text-[10px]"
                            >
                              {isOverdue
                                ? `Vencido${group.maxDaysOverdue > 0 ? ` ${group.maxDaysOverdue}d` : ""}`
                                : "Próximo"}
                            </StatusBadge>
                          </div>
                        </div>
                      </button>

                      <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-1"} gap-2 mt-3`}>
                        {isMobile && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCall(group); }}
                            className="flex items-center justify-center gap-2 py-2 rounded-lg border border-border bg-card hover:bg-accent/30 active:scale-[0.98] transition-all text-sm font-medium"
                            aria-label={`Llamar a ${group.name}`}
                          >
                            <Phone className="w-4 h-4" />
                            Llamar
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleWhatsApp(group); }}
                          className="flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.98] transition-all text-sm font-medium text-emerald-400"
                          aria-label={`Enviar WhatsApp a ${group.name}`}
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </button>
                      </div>
                    </motion.article>
                  );
                })}

                {priorityGroups.length > 5 && (
                  <button
                    onClick={() => setShowAllPriority(v => !v)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border/60 bg-card/40 hover:bg-card/70 active:scale-[0.99] transition-all text-sm font-medium text-muted-foreground"
                  >
                    {showAllPriority
                      ? "Ver menos"
                      : `Ver más (${priorityGroups.length - 5})`}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAllPriority ? "rotate-180" : ""}`} />
                  </button>
                )}
              </>
            )}
          </div>
        </section>


        {/* Empty State */}
        {!loading && loans.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fintech-card p-6 sm:p-8 text-center"
          >
            <CircleDollarSign className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-2 sm:mb-3" />
            <h3 className="font-semibold mb-1 text-sm sm:text-base">Sin préstamos aún</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              Comienza a registrar tus préstamos para ver tu dashboard
            </p>
            <button
              onClick={() => navigate("/new-loan")}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Registrar Préstamo
            </button>
          </motion.div>
        )}
      </div>
      <QuickPaymentSheet
        open={quickPayOpen}
        onOpenChange={setQuickPayOpen}
        onPaymentRegistered={fetchDashboardData}
      />
      <NewOperationSheet open={newOpOpen} onOpenChange={setNewOpOpen} />
    </AppLayout>
  );
}
