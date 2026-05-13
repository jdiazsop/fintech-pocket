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
import { lovable } from "@/integrations/lovable";
import { LegalDialog } from "@/components/legal/LegalDialog";
import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Ingresa tu correo electrónico")
  .email("Correo inválido. Debe incluir “@” y un dominio válido")
  .max(255, "El correo es demasiado largo");

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede superar 72 caracteres")
  .refine((v) => /[A-Za-z]/.test(v), "Debe incluir al menos una letra")
  .refine((v) => /\d/.test(v), "Debe incluir al menos un número")
  .refine((v) => !/^\s|\s$/.test(v), "No debe tener espacios al inicio o al final");

const validateField = (schema: z.ZodTypeAny, value: string): string | null => {
  const r = schema.safeParse(value);
  return r.success ? null : r.error.errors[0].message;
};

type AuthMode = "login" | "register" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateForm = () => {
    const eErr = validateField(emailSchema, email);
    setEmailError(eErr);
    let pErr: string | null = null;
    if (mode === "register") {
      pErr = validateField(passwordSchema, password);
      setPasswordError(pErr);
    } else if (mode === "login") {
      if (!password) pErr = "Ingresa tu contraseña";
      setPasswordError(pErr);
    } else {
      setPasswordError(null);
    }
    let tErr: string | null = null;
    if (mode === "register" && !acceptedTerms) {
      tErr = "Debes aceptar los Términos y Condiciones y la Política de Privacidad";
      setTermsError(tErr);
    } else {
      setTermsError(null);
    }
    return !eErr && !pErr && !tErr;
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
        const { error } = await signUp(email, password, acceptedTerms);
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

  const handleGoogle = async () => {
    if (mode === "register" && !acceptedTerms) {
      setTermsError("Debes aceptar los Términos y Condiciones y la Política de Privacidad");
      return;
    }
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) {
        toast({
          title: "Error",
          description: "No se pudo iniciar sesión con Google",
          variant: "destructive",
        });
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight font-display">Credify</h1>
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
                  <Label htmlFor="email">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      onBlur={() => setEmailError(validateField(emailSchema, email))}
                      aria-invalid={!!emailError}
                      className={`pl-10 bg-muted/50 border-border ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      required
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-destructive mt-1">{emailError}</p>
                  )}
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "register" ? "new-password" : "current-password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) setPasswordError(null);
                        }}
                        onBlur={() => mode === "register" && setPasswordError(validateField(passwordSchema, password))}
                        aria-invalid={!!passwordError}
                        className={`pl-10 pr-10 bg-muted/50 border-border ${passwordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
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
                    {passwordError ? (
                      <p className="text-xs text-destructive mt-1">{passwordError}</p>
                    ) : mode === "register" ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Mínimo 8 caracteres, con al menos una letra y un número.
                      </p>
                    ) : null}
                  </div>
                )}

                {mode === "register" && (
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => {
                          const v = checked === true;
                          setAcceptedTerms(v);
                          if (v) setTermsError(null);
                        }}
                        className="mt-0.5"
                        aria-invalid={!!termsError}
                      />
                      <Label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                        Acepto los{" "}
                        <LegalDialog
                          type="terms"
                          trigger={
                            <button type="button" className="text-primary hover:underline font-medium">
                              Términos y Condiciones
                            </button>
                          }
                        />{" "}
                        y la{" "}
                        <LegalDialog
                          type="privacy"
                          trigger={
                            <button type="button" className="text-primary hover:underline font-medium">
                              Política de Privacidad
                            </button>
                          }
                        />
                      </Label>
                    </div>
                    {termsError && (
                      <p className="text-xs text-destructive ml-6">{termsError}</p>
                    )}
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

                {mode !== "forgot" && (
                  <>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-3 text-muted-foreground">o</span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogle}
                      disabled={loading}
                      className="w-full bg-white hover:bg-muted/50 border-border font-medium"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continuar con Google
                    </Button>
                  </>
                )}
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
