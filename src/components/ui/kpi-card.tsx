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
      className={`fintech-card p-4 bg-gradient-to-br ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${iconStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
};
