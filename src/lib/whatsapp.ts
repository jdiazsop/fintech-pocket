import { toast } from "sonner";

// Helper to open WhatsApp consistently across mobile and desktop.
// Always uses the standard external WhatsApp endpoint to avoid iframe/preview blocking issues.

export function buildWhatsAppLink(phoneDigits: string, message: string): string {
  const phone = (phoneDigits || "").replace(/\D/g, "");
  const text = encodeURIComponent(message || "");
  return `https://api.whatsapp.com/send/?phone=${phone}&text=${text}&type=phone_number&app_absent=0`;
}

const isDesktopViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

const copyToClipboard = async (value: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("No se pudo copiar automáticamente");
  }
};

const showDesktopFallback = (phone: string, message: string) => {
  toast("¿WhatsApp no abrió?", {
    description: "Usa estas opciones si el navegador bloqueó la pestaña externa.",
    duration: 12000,
    action: {
      label: "Copiar mensaje",
      onClick: () => copyToClipboard(message || "", "Mensaje copiado"),
    },
    cancel: phone
      ? {
          label: "Copiar número",
          onClick: () => copyToClipboard(phone, "Número copiado"),
        }
      : undefined,
  });
}

export function openWhatsApp(phoneDigits: string, message: string): void {
  const phone = (phoneDigits || "").replace(/\D/g, "");
  const url = buildWhatsAppLink(phoneDigits, message);
  // Always open as an external tab. Never fallback to window.location,
  // because that can navigate the Lovable Preview/app iframe and trigger blocking errors.
  const opened = window.open(url, "_blank", "noopener,noreferrer");

  if (!opened || isDesktopViewport()) {
    showDesktopFallback(phone, message);
  }
}
