import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        warning: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
        danger: "bg-red-500/20 text-red-400 border border-red-500/30",
        default: "bg-primary/20 text-primary border border-primary/30",
        muted: "bg-muted text-muted-foreground border border-border",
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
