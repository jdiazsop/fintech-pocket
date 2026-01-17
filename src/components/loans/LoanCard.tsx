import { motion } from "framer-motion";
import { ChevronRight, Calendar } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface LoanCardProps {
  id: string;
  name: string;
  concept?: string | null;
  amountLent: number;
  amountToReturn: number;
  amountReturned: number;
  status: string;
  startDate: string;
  onClick?: () => void;
  delay?: number;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "overdue":
      return "danger";
    case "partial":
      return "warning";
    default:
      return "default";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "paid":
      return "Pagado";
    case "overdue":
      return "Vencido";
    case "partial":
      return "Parcial";
    default:
      return "Activo";
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(amount);
};

export const LoanCard = ({
  name,
  concept,
  amountLent,
  amountToReturn,
  amountReturned,
  status,
  startDate,
  onClick,
  delay = 0,
}: LoanCardProps) => {
  const pendingAmount = amountToReturn - amountReturned;
  const progress = amountToReturn > 0 ? (amountReturned / amountToReturn) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="fintech-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
            <StatusBadge variant={getStatusVariant(status)} dot>
              {getStatusLabel(status)}
            </StatusBadge>
          </div>
          
          {concept && (
            <p className="text-sm text-muted-foreground truncate mb-2">{concept}</p>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Prestado: </span>
              <span className="font-medium tabular-nums">{formatCurrency(amountLent)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pendiente: </span>
              <span className="font-semibold text-primary tabular-nums">
                {formatCurrency(pendingAmount)}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(startDate), "dd MMM yyyy", { locale: es })}</span>
              </div>
              <span className="tabular-nums">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, delay: delay + 0.2 }}
                className={`h-full rounded-full ${
                  status === "paid" ? "bg-emerald-500" :
                  status === "overdue" ? "bg-red-500" :
                  status === "partial" ? "bg-orange-500" :
                  "bg-primary"
                }`}
              />
            </div>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </motion.div>
  );
};
