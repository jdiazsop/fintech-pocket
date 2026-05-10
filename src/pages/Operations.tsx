import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Plus, Search, HandCoins, ShoppingCart, ChevronRight, AlertTriangle, Clock, CheckCircle2, MailQuestion } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getTodayInLima, calculateLoanDisplayStatus } from "@/lib/loanUtils";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
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
  created_at: string;
  confirmation_status: string | null;
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

type FilterKey = "all" | "loan" | "sale" | "active" | "overdue" | "pending_confirm";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "loan", label: "Préstamos" },
  { key: "sale", label: "Ventas" },
  { key: "active", label: "Activas" },
  { key: "overdue", label: "Vencidas" },
  { key: "pending_confirm", label: "Pend. confirmación" },
];

export default function Operations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // Refetch on focus / visibility change (volver desde otra vista)
  useEffect(() => {
    if (!user) return;
    const onFocus = () => fetchData();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  // Realtime: refresca cuando cambian préstamos o cuotas del usuario
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`operations-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loans", filter: `user_id=eq.${user.id}` },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installments" },
        () => fetchData(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: loansData } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });
      setLoans((loansData as Loan[]) || []);

      const ids = (loansData || []).map((l) => l.id);
      if (ids.length) {
        const { data: instData } = await supabase
          .from("installments")
          .select("*")
          .in("loan_id", ids);
        setInstallments((instData as Installment[]) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const operations = useMemo(() => {
    const today = getTodayInLima();
    const items = loans.map((l) => {
      const insts = installments.filter((i) => i.loan_id === l.id);
      const isSale = Number(l.amount_lent) === Number(l.amount_to_return);
      const status = calculateLoanDisplayStatus(l.status, insts as any, Number(l.amount_returned), Number(l.amount_to_return));
      const pending = Number(l.amount_to_return) - Number(l.amount_returned);
      const progress = Number(l.amount_to_return) > 0 ? Math.min(100, (Number(l.amount_returned) / Number(l.amount_to_return)) * 100) : 0;

      // Next pending installment
      const pendingInsts = insts
        .filter((i) => Number(i.amount_paid) < Number(i.amount))
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      const next = pendingInsts[0] || null;
      const nextDate = next ? next.due_date.split("T")[0] : null;
      const daysToNext = nextDate ? differenceInCalendarDays(parseISO(nextDate), parseISO(today)) : null;

      const pendingConfirm = !!l.confirmation_status && !["confirmed", "rejected", "not_sent"].includes(l.confirmation_status);

      return { loan: l, isSale, status, pending, progress, nextDate, daysToNext, pendingConfirm };
    });

    let arr = items;
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter((i) => i.loan.name.toLowerCase().includes(q) || (i.loan.concept || "").toLowerCase().includes(q));

    if (filter === "loan") arr = arr.filter((i) => !i.isSale);
    else if (filter === "sale") arr = arr.filter((i) => i.isSale);
    else if (filter === "active") arr = arr.filter((i) => i.status !== "paid");
    else if (filter === "overdue") arr = arr.filter((i) => i.status === "overdue");
    else if (filter === "pending_confirm") arr = arr.filter((i) => i.pendingConfirm);

    arr.sort((a, b) => {
      const rank = (s: string) => (s === "overdue" ? 0 : s === "partial" ? 1 : s === "on_time" ? 2 : 3);
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return b.pending - a.pending;
    });

    return arr;
  }, [loans, installments, search, filter]);

  const summary = useMemo(() => {
    const totalPending = operations.reduce((s, o) => s + o.pending, 0);
    return { count: operations.length, totalPending };
  }, [operations]);

  const statusVisual = (s: string) => {
    switch (s) {
      case "overdue":
        return { color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", icon: AlertTriangle, label: "Vencida" };
      case "partial":
        return { color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/30", icon: Clock, label: "Parcial" };
      case "paid":
        return { color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: CheckCircle2, label: "Pagada" };
      default:
        return { color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", icon: CheckCircle2, label: "Al día" };
    }
  };

  const formatNextDue = (date: string | null, days: number | null) => {
    if (!date || days === null) return null;
    const [y, m, d] = date.split("-").map(Number);
    const formatted = format(new Date(y, m - 1, d), "dd MMM", { locale: es });
    if (days < 0) return `Venció ${formatted}`;
    if (days === 0) return `Vence hoy (${formatted})`;
    if (days === 1) return `Vence mañana`;
    return `Vence ${formatted}`;
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/20">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold">Operaciones</h1>
              <p className="text-sm text-muted-foreground truncate">
                {summary.count} acuerdo{summary.count === 1 ? "" : "s"} · {formatCurrency(summary.totalPending)} pendiente
              </p>
            </div>
          </div>
          <Button
            onClick={() => setSheetOpen(true)}
            size="icon"
            className="rounded-xl bg-primary hover:bg-primary/90"
            aria-label="Nueva operación"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o concepto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="fintech-card p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))
          ) : operations.length === 0 ? (
            <div className="fintech-card p-8 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">
                {search || filter !== "all" ? "Sin resultados" : "Sin operaciones"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || filter !== "all" ? "Intenta con otros filtros" : "Registra tu primer acuerdo financiero"}
              </p>
              {!search && filter === "all" && (
                <Button onClick={() => setSheetOpen(true)} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva operación
                </Button>
              )}
            </div>
          ) : (
            operations.map((o, idx) => {
              const sv = statusVisual(o.status);
              const StatusIcon = sv.icon;
              const TypeIcon = o.isSale ? ShoppingCart : HandCoins;
              const nextLabel = formatNextDue(o.nextDate, o.daysToNext);

              return (
                <motion.article
                  key={o.loan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  className="fintech-card p-4"
                >
                  <button
                    onClick={() => navigate(`/loan/${o.loan.id}`)}
                    className="w-full text-left active:scale-[0.99] transition-transform"
                    aria-label={`Ver operación de ${o.loan.name}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <TypeIcon className="w-3 h-3" />
                            {o.isSale ? "Venta" : "Préstamo"}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sv.bg} ${sv.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {sv.label}
                          </span>
                          {o.pendingConfirm && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-blue-500/15 border-blue-500/30 text-blue-400">
                              <MailQuestion className="w-3 h-3" />
                              Pend. confirm.
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold truncate mt-1.5">{o.loan.name}</h3>
                        {o.loan.concept && (
                          <p className="text-xs text-muted-foreground truncate">{o.loan.concept}</p>
                        )}
                        {nextLabel && o.status !== "paid" && (
                          <p className={`text-[11px] mt-1 ${o.daysToNext !== null && o.daysToNext < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                            {nextLabel}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <p className="text-base font-bold text-primary tabular-nums">{formatCurrency(o.pending)}</p>
                        <p className="text-[10px] text-muted-foreground">pendiente</p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${o.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                        <span>{formatCurrency(Number(o.loan.amount_returned))} pagado</span>
                        <span>{Math.round(o.progress)}%</span>
                      </div>
                    </div>
                  </button>
                </motion.article>
              );
            })
          )}
        </div>
      </div>
      <NewOperationSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </AppLayout>
  );
}
