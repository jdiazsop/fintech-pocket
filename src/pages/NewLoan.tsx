import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, User, FileText, Calendar, Calculator, Check, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addWeeks, format } from "date-fns";
import { es } from "date-fns/locale";

type PaymentType = "single" | "installments";
type Frequency = "daily" | "weekly" | "biweekly";

interface LoanFormData {
  name: string;
  concept: string;
  startDate: string;
  amountLent: string;
  amountToReturn: string;
  paymentType: PaymentType;
  frequency: Frequency;
  daysOrInstallments: number;
}

const SINGLE_PAYMENT_OPTIONS = [7, 15, 30, 45, 60];
const WEEKLY_OPTIONS = [2, 3, 4, 6, 8, 10, 12];
const BIWEEKLY_OPTIONS = [2, 3, 4, 6];

const formatCurrency = (value: string) => {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(num);
};

export default function NewLoan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [formData, setFormData] = useState<LoanFormData>({
    name: "",
    concept: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    amountLent: "",
    amountToReturn: "",
    paymentType: "single",
    frequency: "weekly",
    daysOrInstallments: 30,
  });

  const updateForm = (field: keyof LoanFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Ingresa el nombre del deudor", variant: "destructive" });
      return false;
    }
    const startDate = new Date(formData.startDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (startDate > today) {
      toast({ title: "Error", description: "La fecha no puede ser futura", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const lent = parseFloat(formData.amountLent);
    const toReturn = parseFloat(formData.amountToReturn);
    
    if (isNaN(lent) || lent <= 0) {
      toast({ title: "Error", description: "Ingresa un monto válido a prestar", variant: "destructive" });
      return false;
    }
    if (isNaN(toReturn) || toReturn <= 0) {
      toast({ title: "Error", description: "Ingresa un monto válido a devolver", variant: "destructive" });
      return false;
    }
    if (toReturn < lent) {
      toast({ title: "Error", description: "El monto a devolver debe ser mayor o igual al prestado", variant: "destructive" });
      return false;
    }
    if (formData.daysOrInstallments <= 0) {
      toast({ title: "Error", description: "Selecciona un plazo válido", variant: "destructive" });
      return false;
    }
    return true;
  };

  const generateInstallments = () => {
    const startDate = new Date(formData.startDate);
    const installments = [];
    const totalAmount = parseFloat(formData.amountToReturn);

    if (formData.paymentType === "single") {
      const dueDate = addDays(startDate, formData.daysOrInstallments);
      installments.push({
        number: 1,
        due_date: format(dueDate, "yyyy-MM-dd"),
        amount: totalAmount,
      });
    } else {
      const numInstallments = formData.daysOrInstallments;
      const installmentAmount = Math.round((totalAmount / numInstallments) * 100) / 100;
      let remainingAmount = totalAmount;

      for (let i = 1; i <= numInstallments; i++) {
        let dueDate: Date;
        
        if (formData.frequency === "daily") {
          dueDate = addDays(startDate, i);
        } else if (formData.frequency === "weekly") {
          dueDate = addWeeks(startDate, i);
        } else {
          dueDate = addDays(startDate, i * 15);
        }

        const amount = i === numInstallments 
          ? remainingAmount 
          : installmentAmount;
        
        remainingAmount -= amount;

        installments.push({
          number: i,
          due_date: format(dueDate, "yyyy-MM-dd"),
          amount: Math.round(amount * 100) / 100,
        });
      }
    }

    return installments;
  };

  const handleSubmit = async () => {
    if (!validateStep2() || !user) return;

    setLoading(true);

    try {
      // Create loan
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          concept: formData.concept.trim() || null,
          amount_lent: parseFloat(formData.amountLent),
          amount_to_return: parseFloat(formData.amountToReturn),
          start_date: formData.startDate,
          payment_type: formData.paymentType,
          frequency: formData.paymentType === "installments" ? formData.frequency : null,
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // Generate and insert installments
      const installments = generateInstallments().map(inst => ({
        ...inst,
        loan_id: loan.id,
      }));

      const { error: installmentsError } = await supabase
        .from("installments")
        .insert(installments);

      if (installmentsError) throw installmentsError;

      toast({
        title: "¡Préstamo registrado!",
        description: `Préstamo a ${formData.name} creado exitosamente`,
      });

      navigate("/portfolio");
    } catch (error) {
      console.error("Error creating loan:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el préstamo. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPaymentSummary = () => {
    const installments = generateInstallments();
    if (installments.length === 0) return null;

    const lastInstallment = installments[installments.length - 1];
    const endDate = new Date(lastInstallment.due_date);

    return {
      numInstallments: installments.length,
      endDate: format(endDate, "dd 'de' MMMM, yyyy", { locale: es }),
      installmentAmount: formatCurrency(String(installments[0].amount)),
    };
  };

  const summary = step === 2 && formData.daysOrInstallments > 0 ? getPaymentSummary() : null;

  return (
    <AppLayout>
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => step === 1 ? navigate(-1) : setStep(1)}
            className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Nuevo Préstamo</h1>
            <p className="text-sm text-muted-foreground">Paso {step} de 2</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Step 1: Basic Info */}
              <div className="fintech-card p-5 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-semibold">Datos del Préstamo</h2>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Deudor *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Juan Pérez"
                    value={formData.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="concept" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Concepto (Opcional)
                  </Label>
                  <Input
                    id="concept"
                    placeholder="Ej: Mercadería, Dinero, etc."
                    value={formData.concept}
                    onChange={(e) => updateForm("concept", e.target.value)}
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Fecha de Inicio
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    max={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => updateForm("startDate", e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
              </div>

              <Button
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Step 2: Calculator */}
              <div className="fintech-card p-5 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-semibold">Calculadora</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amountLent">Monto Prestado *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                      <Input
                        id="amountLent"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.amountLent}
                        onChange={(e) => updateForm("amountLent", e.target.value)}
                        className="bg-muted/50 pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amountToReturn">Monto a Devolver *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                      <Input
                        id="amountToReturn"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.amountToReturn}
                        onChange={(e) => updateForm("amountToReturn", e.target.value)}
                        className="bg-muted/50 pl-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Type Toggle */}
                <div className="space-y-3">
                  <Label>Tipo de Pago</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        updateForm("paymentType", "single");
                        updateForm("daysOrInstallments", 30);
                        setShowCustomInput(false);
                      }}
                      className={`chip-button ${formData.paymentType === "single" ? "active" : ""}`}
                    >
                      Pago Único
                    </button>
                    <button
                      onClick={() => {
                        updateForm("paymentType", "installments");
                        updateForm("daysOrInstallments", 4);
                        setShowCustomInput(false);
                      }}
                      className={`chip-button ${formData.paymentType === "installments" ? "active" : ""}`}
                    >
                      En Cuotas
                    </button>
                  </div>
                </div>

                {/* Single Payment Options */}
                {formData.paymentType === "single" && (
                  <div className="space-y-3">
                    <Label>Plazo (días)</Label>
                    <div className="flex flex-wrap gap-2">
                      {SINGLE_PAYMENT_OPTIONS.map((days) => (
                        <button
                          key={days}
                          onClick={() => {
                            updateForm("daysOrInstallments", days);
                            setShowCustomInput(false);
                          }}
                          className={`chip-button ${
                            !showCustomInput && formData.daysOrInstallments === days ? "active" : ""
                          }`}
                        >
                          {days}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowCustomInput(true)}
                        className={`chip-button ${showCustomInput ? "active" : ""}`}
                      >
                        Otro
                      </button>
                    </div>
                    {showCustomInput && (
                      <Input
                        type="number"
                        min="1"
                        placeholder="Días"
                        value={formData.daysOrInstallments}
                        onChange={(e) => updateForm("daysOrInstallments", parseInt(e.target.value) || 0)}
                        className="bg-muted/50 w-24"
                      />
                    )}
                  </div>
                )}

                {/* Installments Options */}
                {formData.paymentType === "installments" && (
                  <>
                    <div className="space-y-3">
                      <Label>Frecuencia</Label>
                      <div className="flex gap-2">
                        {(["daily", "weekly", "biweekly"] as Frequency[]).map((freq) => (
                          <button
                            key={freq}
                            onClick={() => {
                              updateForm("frequency", freq);
                              updateForm("daysOrInstallments", freq === "daily" ? 10 : 4);
                              setShowCustomInput(false);
                            }}
                            className={`chip-button flex-1 ${formData.frequency === freq ? "active" : ""}`}
                          >
                            {freq === "daily" && "Diario"}
                            {freq === "weekly" && "Semanal"}
                            {freq === "biweekly" && "Quincenal"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Número de Cuotas</Label>
                      {formData.frequency === "daily" ? (
                        <Input
                          type="number"
                          min="1"
                          placeholder="Cuotas"
                          value={formData.daysOrInstallments}
                          onChange={(e) => updateForm("daysOrInstallments", parseInt(e.target.value) || 0)}
                          className="bg-muted/50 w-full"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(formData.frequency === "weekly" ? WEEKLY_OPTIONS : BIWEEKLY_OPTIONS).map((num) => (
                            <button
                              key={num}
                              onClick={() => {
                                updateForm("daysOrInstallments", num);
                                setShowCustomInput(false);
                              }}
                              className={`chip-button ${
                                !showCustomInput && formData.daysOrInstallments === num ? "active" : ""
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                          <button
                            onClick={() => setShowCustomInput(true)}
                            className={`chip-button ${showCustomInput ? "active" : ""}`}
                          >
                            Otro
                          </button>
                        </div>
                      )}
                      {showCustomInput && formData.frequency !== "daily" && (
                        <Input
                          type="number"
                          min="1"
                          placeholder="Cuotas"
                          value={formData.daysOrInstallments}
                          onChange={(e) => updateForm("daysOrInstallments", parseInt(e.target.value) || 0)}
                          className="bg-muted/50 w-24"
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Summary */}
              {summary && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fintech-card p-4 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30"
                >
                  <h3 className="font-semibold mb-3">Resumen</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cuotas:</span>
                      <span className="font-medium">{summary.numInstallments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto por cuota:</span>
                      <span className="font-medium">{summary.installmentAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha final:</span>
                      <span className="font-medium">{summary.endDate}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Ganancia:</span>
                      <span className="font-semibold text-emerald-400">
                        {formatCurrency(String(parseFloat(formData.amountToReturn) - parseFloat(formData.amountLent)))}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Registrar Préstamo
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
