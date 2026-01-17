import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Trash2, Edit2, Plus, History, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Loan {
  id: string;
  name: string;
  concept: string | null;
  amount_lent: number;
  amount_to_return: number;
  amount_returned: number;
  status: string;
  start_date: string;
  payment_type: string;
  frequency: string | null;
}

interface Installment {
  id: string;
  number: number;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
}

interface Payment {
  id: string;
  amount_paid: number;
  payment_date: string;
  notes: string | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(amount);
};

const getTodayInLima = (): string => {
  // Obtener fecha actual en zona horaria de Lima, Perú (UTC-5)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

const getInstallmentDisplayStatus = (installment: Installment): { status: string; variant: string; label: string } => {
  const todayStr = getTodayInLima();
  
  // due_date viene como "YYYY-MM-DD" desde la base de datos
  const dueDateStr = installment.due_date.split('T')[0];
  
  // 1. Si tiene pago completo → 'Pagado'
  if (installment.amount_paid >= installment.amount) {
    return { status: "paid", variant: "success", label: "Pagado" };
  }
  
  // 2. Si tiene pago parcial → 'Parcial'
  if (installment.amount_paid > 0) {
    return { status: "partial", variant: "warning", label: "Parcial" };
  }
  
  // 3. Si NO tiene pago y fecha < hoy → 'Vencido'
  if (dueDateStr < todayStr) {
    return { status: "overdue", variant: "danger", label: "Vencido" };
  }
  
  // 4. Si NO tiene pago y fecha >= hoy → 'Pendiente'
  return { status: "pending", variant: "default", label: "Pendiente" };
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid": return "success";
    case "overdue": return "danger";
    case "partial": return "warning";
    default: return "default";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "paid": return "Pagado";
    case "overdue": return "Vencido";
    case "partial": return "Parcial";
    case "pending": return "Pendiente";
    default: return "Activo";
  }
};

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (id) fetchLoanData();
  }, [id]);

  const fetchLoanData = async () => {
    try {
      // Fetch loan
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (loanError) throw loanError;
      if (!loanData) {
        navigate("/portfolio");
        return;
      }
      setLoan(loanData);

      // Fetch installments
      const { data: installmentsData, error: installmentsError } = await supabase
        .from("installments")
        .select("*")
        .eq("loan_id", id)
        .order("number", { ascending: true });

      if (installmentsError) throw installmentsError;
      setInstallments(installmentsData || []);

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments_history")
        .select("*")
        .eq("loan_id", id)
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);
    } catch (error) {
      console.error("Error fetching loan data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el préstamo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!loan) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from("loans")
        .delete()
        .eq("id", loan.id);

      if (error) throw error;

      toast({
        title: "Préstamo eliminado",
        description: "El préstamo ha sido eliminado exitosamente",
      });
      navigate("/portfolio");
    } catch (error) {
      console.error("Error deleting loan:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el préstamo",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePayment = async () => {
    if (!loan) return;
    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Ingresa un monto válido",
        variant: "destructive",
      });
      return;
    }

    const pendingAmount = loan.amount_to_return - loan.amount_returned;
    if (amount > pendingAmount) {
      toast({
        title: "Error",
        description: `El monto máximo es ${formatCurrency(pendingAmount)}`,
        variant: "destructive",
      });
      return;
    }

    setSavingPayment(true);

    try {
      // Register payment
      const { error: paymentError } = await supabase
        .from("payments_history")
        .insert({
          loan_id: loan.id,
          amount_paid: amount,
          notes: paymentNotes.trim() || null,
        });

      if (paymentError) throw paymentError;

      // Update loan
      const newAmountReturned = loan.amount_returned + amount;
      const newStatus = newAmountReturned >= loan.amount_to_return ? "paid" : "partial";

      const { error: loanError } = await supabase
        .from("loans")
        .update({
          amount_returned: newAmountReturned,
          status: newStatus,
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      // Update installments (simple approach: mark as paid in order)
      let remainingPayment = amount;
      for (const inst of installments.filter(i => i.status !== "paid")) {
        if (remainingPayment <= 0) break;

        const instPending = inst.amount - inst.amount_paid;
        const payForInst = Math.min(remainingPayment, instPending);

        const newInstPaid = inst.amount_paid + payForInst;
        const newInstStatus = newInstPaid >= inst.amount ? "paid" : "partial";

        await supabase
          .from("installments")
          .update({
            amount_paid: newInstPaid,
            status: newInstStatus,
          })
          .eq("id", inst.id);

        remainingPayment -= payForInst;
      }

      toast({
        title: "Pago registrado",
        description: `Se registró un pago de ${formatCurrency(amount)}`,
      });

      setShowPaymentDialog(false);
      setPaymentAmount("");
      setPaymentNotes("");
      fetchLoanData();
    } catch (error) {
      console.error("Error registering payment:", error);
      toast({
        title: "Error",
        description: "No se pudo registrar el pago",
        variant: "destructive",
      });
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!loan) return null;

  const pendingAmount = loan.amount_to_return - loan.amount_returned;
  const progress = (loan.amount_returned / loan.amount_to_return) * 100;

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/portfolio")}
              className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{loan.name}</h1>
              {loan.concept && (
                <p className="text-sm text-muted-foreground">{loan.concept}</p>
              )}
            </div>
          </div>
          <StatusBadge variant={getStatusVariant(loan.status)} dot className="hidden">
            {getStatusLabel(loan.status)}
          </StatusBadge>
        </div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fintech-card p-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Prestado</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(loan.amount_lent)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">A Devolver</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(loan.amount_to_return)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cobrado</p>
              <p className="text-lg font-semibold text-emerald-400 tabular-nums">{formatCurrency(loan.amount_returned)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendiente</p>
              <p className="text-lg font-semibold text-primary tabular-nums">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progreso</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Inicio: {format(new Date(loan.start_date), "dd 'de' MMMM, yyyy", { locale: es })}</span>
          </div>
        </motion.div>

        {/* Actions */}
        {loan.status !== "paid" && (
          <Button
            onClick={() => setShowPaymentDialog(true)}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Pago
          </Button>
        )}

        {/* Installments */}
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Cuotas ({installments.length})
          </h2>
          <div className="space-y-2">
            {installments.map((inst, index) => (
              <motion.div
                key={inst.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="fintech-card p-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">Cuota {inst.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("es-PE", {
                      timeZone: "America/Lima",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                      .format(new Date(`${inst.due_date.split("T")[0]}T12:00:00Z`))
                      .replace(/\./g, "")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">{formatCurrency(inst.amount)}</p>
                  {(() => {
                    const displayStatus = getInstallmentDisplayStatus(inst);
                    return (
                      <StatusBadge variant={displayStatus.variant as any} className="text-[10px] px-1.5 py-0.5">
                        {displayStatus.label}
                      </StatusBadge>
                    );
                  })()}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Payments History */}
        {payments.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Historial de Pagos
            </h2>
            <div className="space-y-2">
              {payments.map((payment, index) => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="fintech-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-emerald-400 tabular-nums">
                        +{formatCurrency(payment.amount_paid)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.payment_date), "dd MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                    {payment.notes && (
                      <p className="text-sm text-muted-foreground max-w-[50%] text-right truncate">
                        {payment.notes}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Préstamo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar préstamo?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminarán todas las cuotas y pagos asociados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-muted">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>
                Pendiente: {formatCurrency(pendingAmount)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={pendingAmount}
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-9 bg-muted/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Input
                  id="notes"
                  placeholder="Ej: Pago parcial"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPaymentDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handlePayment}
                disabled={savingPayment}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {savingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
