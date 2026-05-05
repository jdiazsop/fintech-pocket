import { format } from "date-fns";
import { es } from "date-fns/locale";

interface BuildArgs {
  name: string;
  operationType: "loan" | "sale";
  amount: number;
  numInstallments: number;
  installmentAmount: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
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
  const lines: string[] = [];
  lines.push(`Hola ${a.name.split(" ")[0] || ""}, te comparto el resumen de nuestra operación:`);
  lines.push("");
  lines.push(`*Tipo:* ${tipo}`);
  lines.push(`*Monto total:* ${formatPEN(a.amount)}`);
  if (a.paymentType === "installments") {
    lines.push(`*Cuotas:* ${a.numInstallments} de ${formatPEN(a.installmentAmount)}`);
  } else {
    lines.push(`*Pago único:* ${formatPEN(a.amount)}`);
  }
  lines.push(`*Inicio:* ${format(parseLocal(a.startDate), "dd 'de' MMMM, yyyy", { locale: es })}`);
  lines.push(`*Vencimiento final:* ${format(parseLocal(a.endDate), "dd 'de' MMMM, yyyy", { locale: es })}`);
  lines.push("");
  lines.push(`Por favor confirma o rechaza el acuerdo aquí:`);
  lines.push(a.confirmUrl);
  lines.push("");
  lines.push(`Gracias 🙌`);
  return lines.join("\n");
}

export function buildWhatsAppUrl(phoneCountryCode: string, phoneNumber: string, message: string): string {
  const digits = `${phoneCountryCode}${phoneNumber}`.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
