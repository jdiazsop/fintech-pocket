import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido").max(255, "Email muy largo");
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(72, "Máximo 72 caracteres");

type AuthMode = "login" | "register" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateForm = () => {
    try {
      emailSchema.parse(email);
      if (mode !== "forgot") {
        passwordSchema.parse(password);
      }
      if (mode === "register" && !acceptedTerms) {
        toast({
          title: "Error",
          description: "Debes aceptar los términos y condiciones",
          variant: "destructive",
        });
        return false;
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Error de validación",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          let message = "Error al iniciar sesión";
          if (error.message.includes("Invalid login credentials")) {
            message = "Credenciales inválidas";
          } else if (error.message.includes("Email not confirmed")) {
            message = "Email no confirmado. Revisa tu bandeja de entrada.";
          }
          toast({ title: "Error", description: message, variant: "destructive" });
        } else {
          navigate("/dashboard");
        }
      } else if (mode === "register") {
        const { error } = await signUp(email, password);
        if (error) {
          let message = "Error al crear cuenta";
          if (error.message.includes("already registered")) {
            message = "Este email ya está registrado";
          }
          toast({ title: "Error", description: message, variant: "destructive" });
        } else {
          toast({
            title: "¡Cuenta creada!",
            description: "Bienvenido a Credify",
          });
          navigate("/dashboard");
        }
      } else if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) {
          toast({
            title: "Error",
            description: "No se pudo enviar el email de recuperación",
            variant: "destructive",
          });
        } else {
          setResetSent(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-4"
          >
            <span className="text-3xl font-bold text-primary">C</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">Credify</h1>
          <p className="text-muted-foreground mt-1">Tu cuaderno digital de préstamos</p>
        </div>

        {/* Form Card */}
        <div className="fintech-card p-6">
          <AnimatePresence mode="wait">
            {resetSent ? (
              <motion.div
                key="reset-sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-4"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Email enviado</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Revisa tu bandeja de entrada para restablecer tu contraseña.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResetSent(false);
                    setMode("login");
                  }}
                  className="w-full"
                >
                  Volver al inicio de sesión
                </Button>
              </motion.div>
            ) : (
              <motion.form
                key={mode}
                initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">
                    {mode === "login" && "Iniciar Sesión"}
                    {mode === "register" && "Crear Cuenta"}
                    {mode === "forgot" && "Recuperar Contraseña"}
                  </h2>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-muted/50 border-border"
                      required
                    />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 bg-muted/50 border-border"
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
                  </div>
                )}

                {mode === "register" && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                      Acepto los{" "}
                      <span className="text-primary hover:underline">Términos y Condiciones</span> y la{" "}
                      <span className="text-primary hover:underline">Política de Privacidad</span>
                    </Label>
                  </div>
                )}

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-sm text-primary hover:underline w-full text-right"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "login" && "Iniciar Sesión"}
                      {mode === "register" && "Crear Cuenta"}
                      {mode === "forgot" && "Enviar Email"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {!resetSent && (
            <div className="mt-6 pt-4 border-t border-border text-center">
              {mode === "login" ? (
                <p className="text-sm text-muted-foreground">
                  ¿No tienes cuenta?{" "}
                  <button
                    onClick={() => setMode("register")}
                    className="text-primary font-medium hover:underline"
                  >
                    Regístrate
                  </button>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ¿Ya tienes cuenta?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="text-primary font-medium hover:underline"
                  >
                    Inicia Sesión
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
