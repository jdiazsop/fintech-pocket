import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Users, Plus, MessageCircle, Phone, ChevronRight, AlertTriangle, Clock, CheckCircle2, MailQuestion, Wallet, ShoppingBag } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getTodayInLima } from "@/lib/loanUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { differenceInCalendarDays, parseISO } from "date-fns";

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

interface ClientRow {
  id: string;
  first_name: string;
  last_name: string | null;
  dni: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
}

type ClientStatus = "overdue" | "upcoming" | "pending_confirm" | "on_time" | "no_ops";

interface ClientCard {
  key: string;
  displayName: string;
  phone: string;
  loans: Loan[];
  totalPending: number;
  overdueInstallments: number;
  nextDueDate: string | null;
  daysToNext: number | null;
  pendingConfirm: boolean;
  status: ClientStatus;
}

type FilterKey = "all" | "overdue" | "upcoming" | "pending_confirm" | "highest";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "overdue", label: "Con atraso" },
  { key: "upcoming", label: "Próximos vencimientos" },
  { key: "pending_confirm", label: "Pend. de confirmación" },
  { key: "highest", label: "Mayor deuda" },
];

export default function Portfolio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [contacts, setContacts] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: loansData }, { data: clientsData }] = await Promise.all([
        supabase.from("loans").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("id, first_name, last_name, dni, phone_country_code, phone_number").order("created_at", { ascending: false }),
      ]);
      setLoans((loansData as Loan[]) || []);
      setContacts((clientsData as ClientRow[]) || []);

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

  const clients = useMemo<ClientCard[]>(() => {
    const today = getTodayInLima();
    const map = new Map<string, ClientCard>();

    loans.forEach((l) => {
      const key = (l.dni || l.phone_number || l.name || "").trim().toLowerCase() || l.id;
      const pending = Number(l.amount_to_return) - Number(l.amount_returned);
      const cc = (l.phone_country_code || "").replace(/\D/g, "");
      const pn = (l.phone_number || "").replace(/\D/g, "");
      const fullPhone = cc && pn ? `${cc}${pn}` : "";

      const existing = map.get(key);
      if (existing) {
        existing.loans.push(l);
        existing.totalPending += pending;
        if (!existing.phone && fullPhone) existing.phone = fullPhone;
      } else {
        map.set(key, {
          key,
          displayName: l.name,
          phone: fullPhone,
          loans: [l],
          totalPending: pending,
          overdueInstallments: 0,
          nextDueDate: null,
          daysToNext: null,
          pendingConfirm: false,
          status: "on_time",
        });
      }
    });

    // Aggregate installments per client
    map.forEach((client) => {
      const loanIds = new Set(client.loans.map((l) => l.id));
      const clientInsts = installments.filter((i) => loanIds.has(i.loan_id));
      let nextDate: string | null = null;
      let overdue = 0;
      clientInsts.forEach((i) => {
        const isPaid = Number(i.amount_paid) >= Number(i.amount);
        if (isPaid) return;
        const d = i.due_date.split("T")[0];
        if (d < today) overdue++;
        if (!nextDate || d < nextDate) nextDate = d;
      });
      client.overdueInstallments = overdue;
      client.nextDueDate = nextDate;
      client.daysToNext = nextDate ? differenceInCalendarDays(parseISO(nextDate), parseISO(today)) : null;

      client.pendingConfirm = client.loans.some(
        (l) => l.confirmation_status && !["confirmed", "rejected", "not_sent"].includes(l.confirmation_status),
      );

      const allPaid = client.totalPending <= 0;
      if (allPaid) client.status = "on_time";
      else if (overdue > 0) client.status = "overdue";
      else if (client.daysToNext !== null && client.daysToNext <= 7) client.status = "upcoming";
      else if (client.pendingConfirm) client.status = "pending_confirm";
      else client.status = "on_time";
    });

    let arr = Array.from(map.values());

    // Filter by search
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter((c) => c.displayName.toLowerCase().includes(q));

    // Filter by chip
    if (filter === "overdue") arr = arr.filter((c) => c.overdueInstallments > 0);
    else if (filter === "upcoming") arr = arr.filter((c) => c.status === "upcoming");
    else if (filter === "pending_confirm") arr = arr.filter((c) => c.pendingConfirm);

    // Sort
    if (filter === "highest") {
      arr.sort((a, b) => b.totalPending - a.totalPending);
    } else {
      arr.sort((a, b) => {
        const rank = (s: ClientStatus) =>
          s === "overdue" ? 0 : s === "upcoming" ? 1 : s === "pending_confirm" ? 2 : 3;
        const r = rank(a.status) - rank(b.status);
        if (r !== 0) return r;
        return b.totalPending - a.totalPending;
      });
    }

    return arr;
  }, [loans, installments, search, filter]);

  const summary = useMemo(() => {
    const total = clients.reduce((s, c) => s + c.totalPending, 0);
    const overdueClients = clients.filter((c) => c.overdueInstallments > 0).length;
    return { total, overdueClients, count: clients.length };
  }, [clients]);

  const handleWhatsApp = (c: ClientCard) => {
    const phone = c.phone || (window.prompt(`Ingresa el WhatsApp de ${c.displayName} (con código de país):`) || "").replace(/\D/g, "");
    if (!phone) return;
    const message = c.overdueInstallments > 0
      ? `Hola ${c.displayName}, te recordamos que tienes ${c.overdueInstallments} cuota(s) vencida(s) por ${formatCurrency(c.totalPending)}. ¿Podrías regularizar el pago? Gracias.`
      : `Hola ${c.displayName}, te recordamos tu próximo pago por ${formatCurrency(c.totalPending)}. Gracias.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleCall = (c: ClientCard) => {
    if (!c.phone) return;
    window.location.href = `tel:+${c.phone}`;
  };

  const openClient = (c: ClientCard) => {
    if (c.loans.length === 1) {
      navigate(`/loan/${c.loans[0].id}`);
    } else {
      navigate(`/client/${encodeURIComponent(c.key)}`);
    }
  };

  const statusVisual = (s: ClientStatus) => {
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

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Clientes</h1>
              <p className="text-sm text-muted-foreground">
                {summary.count} cliente{summary.count === 1 ? "" : "s"} · {formatCurrency(summary.total)} pendiente
              </p>
            </div>
          </div>
          <Button onClick={() => navigate("/new-client")} size="icon" className="rounded-xl bg-primary hover:bg-primary/90" aria-label="Crear nuevo cliente">
            <Plus className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
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
          ) : clients.length === 0 ? (
            <div className="fintech-card p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">
                {search || filter !== "all" ? "No se encontraron clientes" : "Sin clientes"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || filter !== "all" ? "Intenta con otros filtros" : "Registra tu primera operación"}
              </p>
              {!search && filter === "all" && (
                <Button onClick={() => navigate("/new-loan")} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva operación
                </Button>
              )}
            </div>
          ) : (
            clients.map((c, idx) => {
              const sv = statusVisual(c.status);
              const StatusIcon = sv.icon;
              return (
                <motion.article
                  key={c.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  className="fintech-card p-4"
                >
                  <button
                    onClick={() => openClient(c)}
                    className="w-full text-left active:scale-[0.99] transition-transform"
                    aria-label={`Ver ${c.displayName}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{c.displayName}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sv.bg} ${sv.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {sv.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            {c.loans.length === 1 && c.loans[0].amount_lent !== c.loans[0].amount_to_return ? (
                              <Wallet className="w-3 h-3" />
                            ) : (
                              <ShoppingBag className="w-3 h-3" />
                            )}
                            {c.loans.length} operación{c.loans.length === 1 ? "" : "es"}
                          </span>
                          {c.overdueInstallments > 0 && (
                            <span className="text-red-400">· {c.overdueInstallments} cuota{c.overdueInstallments === 1 ? "" : "s"} vencida{c.overdueInstallments === 1 ? "" : "s"}</span>
                          )}
                          {c.overdueInstallments === 0 && c.daysToNext !== null && c.totalPending > 0 && (
                            <span>
                              · {c.daysToNext === 0 ? "Vence hoy" : c.daysToNext > 0 ? `Vence en ${c.daysToNext}d` : "Vencido"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <p className="text-base font-bold text-primary tabular-nums">{formatCurrency(c.totalPending)}</p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
                      </div>
                    </div>
                  </button>

                  <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-1"} gap-2 mt-3`}>
                    {isMobile && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCall(c); }}
                        disabled={!c.phone}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg border border-border bg-card hover:bg-accent/30 active:scale-[0.98] transition-all text-sm font-medium disabled:opacity-40"
                      >
                        <Phone className="w-4 h-4" />
                        Llamar
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleWhatsApp(c); }}
                      className="flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.98] transition-all text-sm font-medium text-emerald-400"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </button>
                  </div>
                </motion.article>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
