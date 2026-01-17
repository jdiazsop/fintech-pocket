import { parseISO, startOfDay } from "date-fns";

export interface Installment {
  id: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
}

export type LoanDisplayStatus = "paid" | "overdue" | "partial" | "on_time";

/**
 * Calcula el estado real de un préstamo basándose en las cuotas
 * - "paid": Préstamo completamente pagado
 * - "overdue": Tiene cuotas vencidas (fecha de pago < hoy)
 * - "partial": Tiene pagos parciales
 * - "on_time": Está al día con los pagos
 */
export function calculateLoanDisplayStatus(
  loanStatus: string,
  installments: Installment[] = [],
  amountReturned: number = 0,
  amountToReturn: number = 0
): LoanDisplayStatus {
  // Si el préstamo está completamente pagado
  if (loanStatus === "paid" || amountReturned >= amountToReturn) {
    return "paid";
  }

  const today = startOfDay(new Date());

  // Verificar cuotas vencidas (fecha < hoy y no completamente pagadas)
  const hasOverdueInstallments = installments.some(installment => {
    const dueDate = startOfDay(parseISO(installment.due_date));
    const isPaid = installment.amount_paid >= installment.amount;
    return dueDate < today && !isPaid;
  });

  if (hasOverdueInstallments) {
    return "overdue";
  }

  // Si tiene pagos parciales (algún pago > 0 pero < monto total)
  const hasPartialPayments = installments.some(installment => {
    return installment.amount_paid > 0 && installment.amount_paid < installment.amount;
  });

  if (hasPartialPayments || loanStatus === "partial") {
    return "partial";
  }

  // Si no hay cuotas vencidas y no hay pagos parciales, está al día
  return "on_time";
}

export const getStatusVariant = (status: LoanDisplayStatus | string) => {
  switch (status) {
    case "paid":
      return "success";
    case "overdue":
      return "danger";
    case "partial":
      return "warning";
    case "on_time":
      return "default";
    default:
      return "default";
  }
};

export const getStatusLabel = (status: LoanDisplayStatus | string) => {
  switch (status) {
    case "paid":
      return "Pagado";
    case "overdue":
      return "Vencido";
    case "partial":
      return "Parcial";
    case "on_time":
      return "Al día";
    default:
      return "Al día";
  }
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(amount);
};
