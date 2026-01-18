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
import { isToday, isTomorrow, parseISO } from "date-fns";
import { calculateLoanDisplayStatus, formatCurrency, LoanDisplayStatus, Installment } from "@/lib/loanUtils";

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

interface LoanWithDisplayStatus extends Loan {
  displayStatus: LoanDisplayStatus;
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
  };
}

type FilterType = "today" | "tomorrow";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<LoanWithDisplayStatus[]>([]);
  const [upcomingInstallments, setUpcomingInstallments] = useState<InstallmentWithLoan[]>([]);
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

      // Fetch all installments for these loans
      const loanIds = (loansData || []).map(l => l.id);
      const { data: allInstallments, error: allInstError } = await supabase
        .from("installments")
        .select("*")
        .in("loan_id", loanIds);

      if (allInstError) throw allInstError;

      // Calculate display status for each loan
      const loansWithStatus: LoanWithDisplayStatus[] = (loansData || []).map(loan => {
        const loanInstallments = (allInstallments || []).filter(i => i.loan_id === loan.id);
        const displayStatus = calculateLoanDisplayStatus(
          loan.status,
          loanInstallments,
          loan.amount_returned,
          loan.amount_to_return
        );
        return { ...loan, displayStatus };
      });

      setLoans(loansWithStatus);

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

  // Calculate overdue loans based on displayStatus
  const overdueLoans = loans.filter(loan => loan.displayStatus === "overdue");
  const overdueTotal = overdueLoans.reduce((sum, loan) =>
    sum + (loan.amount_to_return - loan.amount_returned), 0
  );

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

  // Filter installments
  const filteredInstallments = upcomingInstallments.filter(inst => {
    const dueDate = parseISO(inst.due_date);
    if (filter === "today") return isToday(dueDate);
    if (filter === "tomorrow") return isTomorrow(dueDate);
    return false;
  });

  return (
    <AppLayout>
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
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
              title="Ganancia Esperada"
              value={formatCurrency(totalProfit)}
              subtitle="Intereses devengados"
              icon={TrendingUp}
              variant="success"
              delay={0.3}
            />
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="space-y-3 sm:space-y-4">

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("today")}
              className={`chip-button text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 ${filter === "today" ? "active" : ""}`}
            >
              Hoy
            </button>
            <button
              onClick={() => setFilter("tomorrow")}
              className={`chip-button text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 ${filter === "tomorrow" ? "active" : ""}`}
            >
              Mañana
            </button>
          </div>

          {/* Installments List */}
          <div className="space-y-2 sm:space-y-3">
            {loading ? (
              <div className="fintech-card p-6 sm:p-8 text-center">
                <div className="animate-pulse text-muted-foreground text-sm sm:text-base">Cargando...</div>
              </div>
            ) : filteredInstallments.length === 0 ? (
              <div className="fintech-card p-6 sm:p-8 text-center">
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm sm:text-base">
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
                  className="fintech-card p-3 sm:p-4 cursor-pointer hover:bg-card/80 active:scale-[0.98] transition-all"
                  onClick={() => navigate(`/loan/${inst.loan_id}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">{inst.loan?.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Cuota pendiente: {formatCurrency(inst.amount - inst.amount_paid)}
                      </p>
                    </div>
                    <StatusBadge
                      variant={inst.status === "partial" ? "warning" : "default"}
                      dot
                      className="flex-shrink-0 text-[10px] sm:text-xs"
                    >
                      {inst.status === "partial" ? "Parcial" : "Pendiente"}
                    </StatusBadge>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Overdue Loans based on displayStatus */}
        {(() => {
          const overdueOrPartialLoans = loans.filter(loan => 
            loan.displayStatus === "overdue" || loan.displayStatus === "partial"
          );
          
          return overdueOrPartialLoans.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-red-400">Préstamos Vencidos</h2>
              <div className="space-y-2 sm:space-y-3">
                {overdueOrPartialLoans.map((loan, index) => (
                  <LoanCard
                    key={loan.id}
                    id={loan.id}
                    name={loan.name}
                    concept={loan.concept}
                    amountLent={loan.amount_lent}
                    amountToReturn={loan.amount_to_return}
                    amountReturned={loan.amount_returned}
                    status={loan.displayStatus}
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
    </AppLayout>
  );
}
