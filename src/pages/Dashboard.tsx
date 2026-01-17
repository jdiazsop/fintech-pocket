import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, Clock, Wallet, CircleDollarSign, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/ui/kpi-card";
import { LoanCard } from "@/components/loans/LoanCard";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { es } from "date-fns/locale";

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

interface Installment {
  id: string;
  loan_id: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
  loan: {
    name: string;
  };
}

type FilterType = "today" | "tomorrow";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [upcomingInstallments, setUpcomingInstallments] = useState<Installment[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<Loan[]>([]);
  const [filter, setFilter] = useState<FilterType>("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch loans
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });

      if (loansError) throw loansError;
      setLoans(loansData || []);

      // Find overdue loans
      const overdue = (loansData || []).filter(loan => loan.status === "overdue");
      setOverdueLoans(overdue);

      // Fetch upcoming installments
      const { data: installmentsData, error: installmentsError } = await supabase
        .from("installments")
        .select(`
          *,
          loan:loans(name)
        `)
        .in("status", ["pending", "partial"])
        .order("due_date", { ascending: true })
        .limit(20);

      if (installmentsError) throw installmentsError;
      setUpcomingInstallments(installmentsData || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate KPIs
  const totalPending = loans.reduce((sum, loan) => 
    sum + (loan.amount_to_return - loan.amount_returned), 0
  );
  // Capital Prestado = suma de (amount_lent - amount_returned) para préstamos activos
  // Refleja el capital real que aún está circulando
  const totalLent = loans.reduce((sum, loan) => 
    sum + Math.max(0, loan.amount_lent - loan.amount_returned), 0
  );
  const totalProfit = loans.reduce((sum, loan) => 
    sum + (loan.amount_to_return - loan.amount_lent), 0
  );
  const overdueTotal = overdueLoans.reduce((sum, loan) =>
    sum + (loan.amount_to_return - loan.amount_returned), 0
  );

  // Filter installments
  const filteredInstallments = upcomingInstallments.filter(inst => {
    const dueDate = parseISO(inst.due_date);
    if (filter === "today") return isToday(dueDate);
    if (filter === "tomorrow") return isTomorrow(dueDate);
    return false;
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <p className="text-muted-foreground">{greeting()}</p>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Dashboard
            <Sparkles className="w-5 h-5 text-primary" />
          </h1>
        </motion.div>

        {/* Overdue Alert */}
        {overdueLoans.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fintech-card p-4 bg-gradient-to-r from-red-500/20 to-red-500/5 border-red-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-400">
                  {overdueLoans.length} préstamo{overdueLoans.length > 1 ? "s" : ""} vencido{overdueLoans.length > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total pendiente: {formatCurrency(overdueTotal)}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            title="Por Cobrar"
            value={formatCurrency(totalPending)}
            icon={Wallet}
            variant="default"
            delay={0.1}
          />
          <KPICard
            title="Capital Prestado"
            value={formatCurrency(totalLent)}
            icon={CircleDollarSign}
            variant="default"
            delay={0.2}
          />
          <div className="col-span-2">
            <KPICard
              title="Ganancia Generada"
              value={formatCurrency(totalProfit)}
              subtitle="Intereses devengados"
              icon={TrendingUp}
              variant="success"
              delay={0.3}
            />
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Vencimientos Próximos
            </h2>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("today")}
              className={`chip-button ${filter === "today" ? "active" : ""}`}
            >
              Hoy
            </button>
            <button
              onClick={() => setFilter("tomorrow")}
              className={`chip-button ${filter === "tomorrow" ? "active" : ""}`}
            >
              Mañana
            </button>
          </div>

          {/* Installments List */}
          <div className="space-y-3">
            {loading ? (
              <div className="fintech-card p-8 text-center">
                <div className="animate-pulse text-muted-foreground">Cargando...</div>
              </div>
            ) : filteredInstallments.length === 0 ? (
              <div className="fintech-card p-8 text-center">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  No hay vencimientos para {filter === "today" ? "hoy" : "mañana"}
                </p>
              </div>
            ) : (
              filteredInstallments.map((inst, index) => (
                <motion.div
                  key={inst.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="fintech-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{inst.loan?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Cuota pendiente: {formatCurrency(inst.amount - inst.amount_paid)}
                      </p>
                    </div>
                    <StatusBadge
                      variant={inst.status === "partial" ? "warning" : "default"}
                      dot
                    >
                      {inst.status === "partial" ? "Parcial" : "Pendiente"}
                    </StatusBadge>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Overdue/Partial Loans */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const overdueOrPartialLoans = loans.filter(loan => {
            // Mostrar préstamos con status "partial"
            if (loan.status === "partial") return true;
            
            // O préstamos con fecha anterior a hoy que estén pendientes o activos
            const startDate = parseISO(loan.start_date);
            startDate.setHours(0, 0, 0, 0);
            const isBeforeToday = startDate < today;
            
            return isBeforeToday && (loan.status === "pending" || loan.status === "active" || loan.status === "overdue");
          });
          
          return overdueOrPartialLoans.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-red-400">Préstamos Vencidos</h2>
              <div className="space-y-3">
                {overdueOrPartialLoans.map((loan, index) => (
                  <LoanCard
                    key={loan.id}
                    id={loan.id}
                    name={loan.name}
                    concept={loan.concept}
                    amountLent={loan.amount_lent}
                    amountToReturn={loan.amount_to_return}
                    amountReturned={loan.amount_returned}
                    status={loan.status}
                    startDate={loan.start_date}
                    onClick={() => navigate(`/loan/${loan.id}`)}
                    delay={index * 0.1}
                  />
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Empty State */}
        {!loading && loans.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fintech-card p-8 text-center"
          >
            <CircleDollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Sin préstamos aún</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comienza a registrar tus préstamos para ver tu dashboard
            </p>
            <button
              onClick={() => navigate("/new-loan")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Registrar Préstamo
            </button>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
