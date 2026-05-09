import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HandCoins, ShoppingCart, X, ArrowRight, Sparkles } from "lucide-react";

interface NewOperationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewOperationSheet = ({ open, onOpenChange }: NewOperationSheetProps) => {
  const navigate = useNavigate();

  const choose = (type: "loan" | "sale") => {
    onOpenChange(false);
    navigate(`/new-loan?type=${type}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-3xl p-5 pb-8 max-w-lg mx-auto"
            role="dialog"
            aria-label="Nueva operación"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold leading-tight">Nueva operación</h2>
                  <p className="text-[11px] text-muted-foreground leading-tight">¿Qué deseas registrar?</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Cerrar"
                className="p-2 rounded-lg hover:bg-muted/50 active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 mt-4">
              <button
                onClick={() => choose("loan")}
                className="p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99] transition-all flex items-center gap-4 text-left"
              >
                <div className="p-3 rounded-xl bg-primary/15">
                  <HandCoins className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-tight">Préstamo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Dinero prestado a devolver</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>

              <button
                onClick={() => choose("sale")}
                className="p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99] transition-all flex items-center gap-4 text-left"
              >
                <div className="p-3 rounded-xl bg-primary/15">
                  <ShoppingCart className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-tight">Venta al crédito</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Producto o servicio en cuotas</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
