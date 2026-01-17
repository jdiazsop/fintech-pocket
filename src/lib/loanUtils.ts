export interface Installment {
  id: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
}

// Obtener fecha actual en zona horaria de Lima, Perú (UTC-5)
export const getTodayInLima = (): string => {
  const now = new Date();
  const limaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  return `${limaDate.getFullYear()}-${String(limaDate.getMonth() + 1).padStart(2, '0')}-${String(limaDate.getDate()).padStart(2, '0')}`;
};

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

  const todayStr = getTodayInLima();

  // Verificar cuotas vencidas (fecha ANTERIOR a hoy y no completamente pagadas)
  const hasOverdueInstallments = installments.some(installment => {
    const dueDateStr = installment.due_date.split('T')[0];
    const isPaid = installment.amount_paid >= installment.amount;
    return dueDateStr < todayStr && !isPaid;
  });

  if (hasOverdueInstallments) {
    return "overdue";
  }

  // Verificar pagos parciales solo en cuotas ya vencidas (fecha < hoy)
  const hasPartialPaymentsOnOverdue = installments.some(installment => {
    const dueDateStr = installment.due_date.split('T')[0];
    const isOverdue = dueDateStr < todayStr;
    return isOverdue && installment.amount_paid > 0 && installment.amount_paid < installment.amount;
  });

  if (hasPartialPaymentsOnOverdue) {
    return "partial";
  }

  // Si no hay cuotas vencidas sin pagar, está al día
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
