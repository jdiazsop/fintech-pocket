import { format } from "date-fns";
import { es } from "date-fns/locale";

interface BuildArgs {
  name: string;
  operationType: "loan" | "sale";
  amount: number;            // monto total a devolver
  amountLent?: number;       // monto prestado (solo préstamos)
  numInstallments: number;
  installmentAmount: number;
  startDate: string;         // YYYY-MM-DD (primer pago / inicio)
  endDate: string;           // YYYY-MM-DD (vencimiento final)
  paymentType: "single" | "installments";
  confirmUrl: string;
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 }).format(n);

const parseLocal = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function buildAgreementMessage(a: BuildArgs): string {
  const tipo = a.operationType === "sale" ? "Venta al crédito" : "Préstamo";
  const isLoan = a.operationType === "loan";
  const lines: string[] = [];

  lines.push(`Hola ${a.name.split(" ")[0] || ""}, te comparto el resumen de nuestra operación en *Credify*:`);
  lines.push("");
  lines.push(`*Tipo de operación:* ${tipo}`);

  if (isLoan && typeof a.amountLent === "number" && a.amountLent > 0) {
    lines.push(`*Monto prestado:* ${formatPEN(a.amountLent)}`);
    lines.push(`*Monto total a devolver:* ${formatPEN(a.amount)}`);
  } else {
    lines.push(`*Monto total:* ${formatPEN(a.amount)}`);
  }

  if (a.paymentType === "installments") {
    lines.push(`*N° de cuotas:* ${a.numInstallments} de ${formatPEN(a.installmentAmount)}`);
  } else {
    lines.push(`*Modalidad:* Pago único`);
  }

  lines.push(`*Primer pago:* ${format(parseLocal(a.startDate), "dd 'de' MMMM, yyyy", { locale: es })}`);
  lines.push(`*Vencimiento final:* ${format(parseLocal(a.endDate), "dd 'de' MMMM, yyyy", { locale: es })}`);
  lines.push("");
  lines.push(`Revisa, acepta o rechaza el acuerdo aquí:`);
  lines.push(a.confirmUrl);
  lines.push("");
  lines.push(`🔒 Para aceptar o rechazar deberás validar tu identidad con un *código OTP* que te enviaremos a tu correo registrado.`);
  lines.push("");
  lines.push(`Gracias 🙌`);
  return lines.join("\n");
}

export function buildWhatsAppUrl(phoneCountryCode: string, phoneNumber: string, message: string): string {
  const digits = `${phoneCountryCode}${phoneNumber}`.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
