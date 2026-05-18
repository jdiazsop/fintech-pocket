// Helper to open WhatsApp consistently across mobile and desktop.
// Always uses wa.me as an external link to avoid iframe/preview blocking issues.

export function buildWhatsAppLink(phoneDigits: string, message: string): string {
  const phone = (phoneDigits || "").replace(/\D/g, "");
  const text = encodeURIComponent(message || "");
  return phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

export function openWhatsApp(phoneDigits: string, message: string): void {
  const url = buildWhatsAppLink(phoneDigits, message);
  // Always open as an external tab. Never fallback to window.location,
  // because that can navigate the Lovable Preview/app iframe and trigger blocking errors.
  window.open(url, "_blank", "noopener,noreferrer");
}
