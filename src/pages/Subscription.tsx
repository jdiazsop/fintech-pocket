import { motion } from "framer-motion";
import { Crown, Check, Sparkles, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";

const FREE_FEATURES = [
  "Registro ilimitado de operaciones",
  "Cobranzas prioritarias",
  "Recordatorios por WhatsApp",
  "Reporte por correo electrónico",
];

const PRO_FEATURES = [
  "Todo lo del plan Gratuito",
  "Reportes avanzados y exportación",
  "Recordatorios automáticos programados",
  "Soporte prioritario",
];

export default function Subscription() {
  const { toast } = useToast();

  const handleUpgrade = () => {
    toast({
      title: "Muy pronto",
      description: "El plan Pro estará disponible próximamente.",
    });
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Suscripción</h1>
            <p className="text-sm text-muted-foreground">Gestiona tu plan en Credify</p>
          </div>
        </motion.header>

        {/* Current Plan */}
        <motion.section
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="fintech-card p-5 space-y-4"
          aria-label="Plan actual"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/20">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Plan actual</p>
                <p className="text-sm text-muted-foreground">Funciones esenciales</p>
              </div>
            </div>
            <StatusBadge variant="default">Gratuito</StatusBadge>
          </div>

          <ul className="space-y-2 pt-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-foreground/90">{f}</span>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Pro Plan */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="fintech-card p-5 space-y-4 bg-gradient-to-br from-primary/15 to-primary/5 border-primary/30"
          aria-label="Plan Pro"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/30">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Credify Pro</p>
                <p className="text-sm text-muted-foreground">Para operadores avanzados</p>
              </div>
            </div>
            <StatusBadge variant="warning">Próximamente</StatusBadge>
          </div>

          <ul className="space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground/90">{f}</span>
              </li>
            ))}
          </ul>

          <Button onClick={handleUpgrade} className="w-full bg-primary hover:bg-primary/90">
            <Crown className="w-4 h-4 mr-2" />
            Actualizar a Pro
          </Button>
        </motion.section>

        <p className="text-center text-xs text-muted-foreground pt-2">
          ¿Necesitas ayuda? Escríbenos desde tu perfil.
        </p>
      </div>
    </AppLayout>
  );
}
