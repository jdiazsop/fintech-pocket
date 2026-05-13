import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede superar 72 caracteres")
  .refine((v) => /[A-Za-z]/.test(v), "Debe incluir al menos una letra")
  .refine((v) => /\d/.test(v), "Debe incluir al menos un número")
  .refine((v) => !/^\s|\s$/.test(v), "No debe tener espacios al inicio o al final");

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase auth-helpers automatically parses the recovery hash and sets a session.
    // Listen for PASSWORD_RECOVERY or use the existing session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(!!session);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasRecoverySession(!!session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const r = passwordSchema.safeParse(password);
    if (!r.success) {
      setError(r.error.errors[0].message);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (upErr) {
      toast({
        title: "No se pudo actualizar",
        description:
          upErr.message.includes("session") || upErr.message.includes("expired")
            ? "El enlace de recuperación expiró. Solicita uno nuevo."
            : "Inténtalo nuevamente en unos segundos.",
        variant: "destructive",
      });
      return;
    }
    setDone(true);
    // Sign out so user logs in fresh with the new password
    await supabase.auth.signOut();
    setTimeout(() => navigate("/auth", { replace: true }), 1800);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-4">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
            Restablecer contraseña
          </h1>
        </div>

        <div className="fintech-card p-6">
          {done ? (
            <div className="text-center py-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold mb-1">Contraseña actualizada</h2>
              <p className="text-sm text-muted-foreground">
                Te llevamos al inicio de sesión…
              </p>
            </div>
          ) : !hasRecoverySession ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                El enlace de recuperación no es válido o ya expiró.
              </p>
              <Button onClick={() => navigate("/auth")} className="w-full">
                Volver al inicio de sesión
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pass">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="new-pass"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    className={`pl-10 pr-10 bg-muted/50 border-border ${
                      error ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres, con al menos una letra y un número.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-pass">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-pass"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-10 bg-muted/50 border-border"
                    required
                  />
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar nueva contraseña"}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
