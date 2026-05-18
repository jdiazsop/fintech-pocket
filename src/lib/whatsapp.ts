// Helper to open WhatsApp consistently across mobile and desktop.
// - Mobile: uses wa.me deep link (opens native app)
// - Desktop: uses web.whatsapp.com/send (opens WhatsApp Web in new tab)
// Avoids api.whatsapp.com which is blocked in some browsers/networks.

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function buildWhatsAppLink(phoneDigits: string, message: string): string {
  const phone = (phoneDigits || "").replace(/\D/g, "");
  const text = encodeURIComponent(message || "");
  if (isMobileDevice()) {
    return phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
  }
  return phone
    ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}`
    : `https://web.whatsapp.com/send?text=${text}`;
}

export function openWhatsApp(phoneDigits: string, message: string): void {
  const url = buildWhatsAppLink(phoneDigits, message);
  // Always open as external new tab — never inside iframe/modal.
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocked fallback: navigate top frame
    try {
      window.top!.location.href = url;
    } catch {
      window.location.href = url;
    }
  }
}
