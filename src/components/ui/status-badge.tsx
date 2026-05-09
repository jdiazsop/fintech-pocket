import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight transition-colors",
  {
    variants: {
      variant: {
        success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
        warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/15",
        danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15",
        default: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/15",
        muted: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const StatusBadge = ({
  children,
  variant,
  className,
  dot = false,
}: StatusBadgeProps) => {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)}>
      {dot && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          variant === "success" && "bg-emerald-500",
          variant === "warning" && "bg-amber-500",
          variant === "danger" && "bg-red-500",
          variant === "default" && "bg-blue-500",
          variant === "muted" && "bg-slate-400",
        )} />
      )}
      {children}
    </span>
  );
};
