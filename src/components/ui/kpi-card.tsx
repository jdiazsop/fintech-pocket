import { ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
  delay?: number;
}

const variantStyles = {
  default: "from-primary/20 to-primary/5 border-primary/30",
  success: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  warning: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
  danger: "from-red-500/20 to-red-500/5 border-red-500/30",
};

const iconStyles = {
  default: "text-primary bg-primary/20",
  success: "text-emerald-400 bg-emerald-500/20",
  warning: "text-orange-400 bg-orange-500/20",
  danger: "text-red-400 bg-red-500/20",
};

export const KPICard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  delay = 0,
}: KPICardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`fintech-card p-3 sm:p-4 bg-gradient-to-br ${variantStyles[variant]} h-full`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{title}</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums tracking-tight leading-tight">{value}</p>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <div className={`p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl flex-shrink-0 ${iconStyles[variant]}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </motion.div>
  );
};
