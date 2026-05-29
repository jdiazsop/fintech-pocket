import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  delay?: number;
}

export function MetricCard({ label, value, icon: Icon, hint, delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="fintech-card p-4"
    >
      <Icon className="w-4 h-4 text-primary mb-2" />
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </motion.div>
  );
}
