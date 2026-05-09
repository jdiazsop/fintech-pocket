import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors",
  {
    variants: {
      variant: {
        success: "bg-emerald-500/10 text-emerald-300/90 border border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-300/90 border border-amber-500/20",
        danger: "bg-red-500/10 text-red-300/90 border border-red-500/20",
        default: "bg-primary/10 text-primary/90 border border-primary/20",
        muted: "bg-muted/60 text-muted-foreground border border-border/50",
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
          variant === "success" && "bg-emerald-400",
          variant === "warning" && "bg-orange-400",
          variant === "danger" && "bg-red-400",
          variant === "default" && "bg-primary",
          variant === "muted" && "bg-muted-foreground",
        )} />
      )}
      {children}
    </span>
  );
};
