import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Filter, SortDesc, Wallet, Plus } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoanCard } from "@/components/loans/LoanCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoanDisplayStatus, LoanDisplayStatus, Installment } from "@/lib/loanUtils";

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
}

interface LoanWithInstallments extends Loan {
  installments: Installment[];
  displayStatus: LoanDisplayStatus;
}

type StatusFilter = "all" | "on_time" | "overdue" | "paid";
type SortOption = "recent" | "amount";

export default function Portfolio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<LoanWithInstallments[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  const fetchLoans = async () => {
    try {
      // Fetch loans with their installments
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });

      if (loansError) throw loansError;

      // Fetch all installments for these loans
      const loanIds = (loansData || []).map(l => l.id);
      const { data: installmentsData, error: installmentsError } = await supabase
        .from("installments")
        .select("*")
        .in("loan_id", loanIds);

      if (installmentsError) throw installmentsError;

      // Map loans with their installments and calculate display status
      const loansWithStatus: LoanWithInstallments[] = (loansData || []).map(loan => {
        const loanInstallments = (installmentsData || []).filter(i => i.loan_id === loan.id);
        const displayStatus = calculateLoanDisplayStatus(
          loan.status,
          loanInstallments,
          loan.amount_returned,
          loan.amount_to_return
        );
        return {
          ...loan,
          installments: loanInstallments,
          displayStatus
        };
      });

      setLoans(loansWithStatus);
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort loans
  const filteredLoans = loans
    .filter((loan) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!loan.name.toLowerCase().includes(query) &&
            !loan.concept?.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Status filter - now based on displayStatus
      if (statusFilter !== "all" && loan.displayStatus !== statusFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOption === "recent") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        const pendingA = a.amount_to_return - a.amount_returned;
        const pendingB = b.amount_to_return - b.amount_returned;
        return pendingB - pendingA;
      }
    });

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "on_time", label: "Al día" },
    { value: "overdue", label: "Vencidos" },
    { value: "paid", label: "Pagados" },
  ];

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Cartera</h1>
              <p className="text-sm text-muted-foreground">
                {loans.length} préstamo{loans.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/new-loan")}
            size="icon"
            className="rounded-xl bg-primary hover:bg-primary/90"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          <button
            onClick={() => setSortOption(sortOption === "recent" ? "amount" : "recent")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <SortDesc className="w-4 h-4" />
            {sortOption === "recent" ? "Más recientes" : "Mayor deuda"}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2"
          >
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`chip-button ${statusFilter === option.value ? "active" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Loans List */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="fintech-card p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2 mb-3" />
                <div className="h-2 bg-muted rounded w-full" />
              </div>
            ))
          ) : filteredLoans.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fintech-card p-8 text-center"
            >
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">
                {searchQuery || statusFilter !== "all"
                  ? "No se encontraron préstamos"
                  : "Sin préstamos"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Intenta con otros filtros"
                  : "Comienza registrando tu primer préstamo"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button
                  onClick={() => navigate("/new-loan")}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Préstamo
                </Button>
              )}
            </motion.div>
          ) : (
            filteredLoans.map((loan, index) => (
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
                delay={index * 0.05}
              />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
