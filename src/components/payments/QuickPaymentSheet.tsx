import { useEffect, useMemo, useState } from "react";
import { Search, ArrowLeft, Loader2, CheckCircle2, Wallet, ShoppingBag, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/loanUtils";

interface LoanRow {
  id: string;
  name: string;
  concept: string | null;
  amount_lent: number;
  amount_to_return: number;
  amount_returned: number;
  payment_type: string;
  dni: string | null;
  phone_number: string | null;
}

interface InstallmentRow {
  id: string;
  loan_id: string;
  number: number;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
}

interface ClientGroup {
  key: string;
  displayName: string;
  loans: LoanRow[];
  totalPending: number;
}

interface QuickPaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRegistered?: () => void;
}

type Step = "search" | "operation" | "amount" | "success";

export const QuickPaymentSheet = ({ open, onOpenChange, onPaymentRegistered }: QuickPaymentSheetProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("search");
  const [loading, setLoading] = useState(false);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [installmentsByLoan, setInstallmentsByLoan] = useState<Record<string, InstallmentRow[]>>({});
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientGroup | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanRow | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      reset();
      fetchPending();
    }
  }, [open]);

  const reset = () => {
    setStep("search");
    setSearch("");
    setSelectedClient(null);
    setSelectedLoan(null);
    setAmount("");
  };

  const fetchPending = async () => {
    setLoading(true);
    try {
      const { data: loansData } = await supabase
        .from("loans")
        .select("id,name,concept,amount_lent,amount_to_return,amount_returned,payment_type,dni,phone_number")
        .neq("status", "paid")
        .order("created_at", { ascending: false });

      const pending = (loansData || []).filter(
        (l) => Number(l.amount_to_return) - Number(l.amount_returned) > 0,
      );
      setLoans(pending);

      const ids = pending.map((l) => l.id);
      if (ids.length) {
        const { data: instData } = await supabase
          .from("installments")
          .select("id,loan_id,number,due_date,amount,amount_paid,status")
          .in("loan_id", ids);
        const grouped: Record<string, InstallmentRow[]> = {};
        (instData || []).forEach((i) => {
          (grouped[i.loan_id] ||= []).push(i as InstallmentRow);
        });
        Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.number - b.number));
        setInstallmentsByLoan(grouped);
      } else {
        setInstallmentsByLoan({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const clientGroups = useMemo<ClientGroup[]>(() => {
    const map = new Map<string, ClientGroup>();
    loans.forEach((l) => {
      const key = (l.dni || l.phone_number || l.name || "").trim().toLowerCase() || l.id;
      const pending = Number(l.amount_to_return) - Number(l.amount_returned);
      const existing = map.get(key);
      if (existing) {
        existing.loans.push(l);
        existing.totalPending += pending;
      } else {
        map.set(key, { key, displayName: l.name, loans: [l], totalPending: pending });
      }
    });
    const arr = Array.from(map.values());
    const q = search.trim().toLowerCase();
    return q ? arr.filter((c) => c.displayName.toLowerCase().includes(q)) : arr;
  }, [loans, search]);

  const handleSelectClient = (c: ClientGroup) => {
    setSelectedClient(c);
    if (c.loans.length === 1) {
      setSelectedLoan(c.loans[0]);
      setStep("amount");
    } else {
      setStep("operation");
    }
  };

  const nextInstallmentInfo = (loanId: string) => {
    const list = installmentsByLoan[loanId] || [];
    const next = list.find((i) => Number(i.amount_paid) < Number(i.amount));
    if (!next) return null;
    const total = list.length;
    return { number: next.number, total };
  };

  const handleSubmit = async () => {
    if (!selectedLoan) return;
    const amt = parseFloat(amount);
    const pending = Number(selectedLoan.amount_to_return) - Number(selectedLoan.amount_returned);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0", variant: "destructive" });
      return;
    }
    if (amt > pending) {
      toast({ title: "Monto excede lo pendiente", description: `Máximo: ${formatCurrency(pending)}`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("payments_history")
        .insert({ loan_id: selectedLoan.id, amount_paid: amt, notes: null });
      if (pErr) throw pErr;

      const newReturned = Number(selectedLoan.amount_returned) + amt;
      const newStatus = newReturned >= Number(selectedLoan.amount_to_return) ? "paid" : "partial";
      await supabase
        .from("loans")
        .update({ amount_returned: newReturned, status: newStatus })
        .eq("id", selectedLoan.id);

      // Apply to installments in order
      let remaining = amt;
      const list = (installmentsByLoan[selectedLoan.id] || []).filter((i) => i.status !== "paid");
      for (const inst of list) {
        if (remaining <= 0) break;
        const instPending = Number(inst.amount) - Number(inst.amount_paid);
        const pay = Math.min(remaining, instPending);
        const newPaid = Number(inst.amount_paid) + pay;
        const newInstStatus = newPaid >= Number(inst.amount) ? "paid" : "partial";
        await supabase
          .from("installments")
          .update({ amount_paid: newPaid, status: newInstStatus })
          .eq("id", inst.id);
        remaining -= pay;
      }

      setStep("success");
      onPaymentRegistered?.();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo registrar el pago", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (step === "amount") {
      if (selectedClient && selectedClient.loans.length > 1) setStep("operation");
      else setStep("search");
      setSelectedLoan(null);
    } else if (step === "operation") {
      setStep("search");
      setSelectedClient(null);
    }
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
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-3xl max-w-lg mx-auto flex flex-col max-h-[85dvh] h-[85dvh]"
            role="dialog"
            aria-label="Registrar pago"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-border/60 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {step !== "search" && step !== "success" && (
                  <button
                    onClick={goBack}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                    aria-label="Volver"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-tight truncate">
                    {step === "search" && "Registrar pago"}
                    {step === "operation" && selectedClient?.displayName}
                    {step === "amount" && "Monto a registrar"}
                    {step === "success" && "Pago registrado"}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {step === "search" && "Selecciona el cliente"}
                    {step === "operation" && "Elige la operación"}
                    {step === "amount" && selectedLoan?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="px-4 pt-4 pb-6 overflow-y-auto overscroll-contain flex-1 min-h-0">
              <AnimatePresence mode="wait">
                {step === "search" && (
                  <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-muted/50"
                      />
                    </div>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : clientGroups.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        {search ? "Sin coincidencias" : "No hay clientes con deudas pendientes"}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {clientGroups.map((c) => (
                          <button
                            key={c.key}
                            onClick={() => handleSelectClient(c)}
                            className="w-full text-left p-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99] transition-all"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{c.displayName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {c.loans.length} operación{c.loans.length === 1 ? "" : "es"}
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-primary tabular-nums whitespace-nowrap">
                                {formatCurrency(c.totalPending)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {step === "operation" && selectedClient && (
                  <motion.div key="op" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    {selectedClient.loans.map((l) => {
                      const pending = Number(l.amount_to_return) - Number(l.amount_returned);
                      const isLoan = l.amount_to_return !== l.amount_lent;
                      const next = nextInstallmentInfo(l.id);
                      const Icon = isLoan ? Wallet : ShoppingBag;
                      const label = isLoan ? "Préstamo" : "Venta al crédito";
                      return (
                        <button
                          key={l.id}
                          onClick={() => { setSelectedLoan(l); setStep("amount"); }}
                          className="w-full text-left p-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99] transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className="font-medium text-sm truncate">{l.concept || l.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatCurrency(pending)} pendiente
                                {next ? ` · Cuota ${next.number}/${next.total}` : ""}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}

                {step === "amount" && selectedLoan && (
                  <motion.div key="amt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                      <p className="text-xs text-muted-foreground">Pendiente</p>
                      <p className="text-xl font-bold text-primary tabular-nums">
                        {formatCurrency(Number(selectedLoan.amount_to_return) - Number(selectedLoan.amount_returned))}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qpay-amount">Monto pagado</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                        <Input
                          id="qpay-amount"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          autoFocus
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="pl-9 bg-muted/50 text-lg h-12"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleSubmit}
                      disabled={saving || !amount}
                      className="w-full h-11 bg-primary hover:bg-primary/90"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar pago"}
                    </Button>
                  </motion.div>
                )}

                {step === "success" && (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-6 text-center space-y-3"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-semibold">Pago registrado correctamente</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Saldos y cuotas actualizados.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" className="flex-1" onClick={() => { reset(); fetchPending(); }}>
                        Otro pago
                      </Button>
                      <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => onOpenChange(false)}>
                        Cerrar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
