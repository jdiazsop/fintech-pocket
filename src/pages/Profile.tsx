import { motion } from "framer-motion";
import { User, Mail, LogOut, Shield, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
export default function Profile() {
  const {
    user,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión exitosamente"
    });
    navigate("/auth");
  };
  return <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/30">
            <User className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Mi Perfil</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </motion.div>

        {/* Plan Badge */}
        <motion.div initial={{
        opacity: 0,
        scale: 0.95
      }} animate={{
        opacity: 1,
        scale: 1
      }} transition={{
        delay: 0.1
      }} className="fintech-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Plan Actual</p>
              <p className="text-sm text-muted-foreground">Funciones básicas</p>
            </div>
          </div>
          <StatusBadge variant="default">Gratuito</StatusBadge>
        </motion.div>

        {/* Account Info */}
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.2
      }} className="fintech-card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Información de Cuenta
          </h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium truncate">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <User className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">ID de Usuario</p>
                <p className="font-mono text-xs truncate">{user?.id}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sign Out */}
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.3
      }}>
          <Button onClick={handleSignOut} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </motion.div>

        {/* Footer */}
        <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 0.4
      }} className="text-center text-sm text-muted-foreground pt-4">
          <p>CREDIFY v1.0</p>
          <p className="text-xs mt-1">Tu cuaderno digital de préstamos</p>
        </motion.div>
      </div>
    </AppLayout>;
}