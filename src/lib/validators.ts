/**
 * Reusable input validators / sanitizers for contact and user data.
 * Pure helpers — no UI, no side effects. Safe to use in any component.
 */

/** Letters (incl. Spanish accents), spaces, apostrophes, hyphens, periods. */
const NAME_RE = /^[A-Za-zÀ-ÿÑñ' .\-]+$/;
/** Strip anything that's not a name-safe character. */
export const sanitizeName = (v: string) =>
  v.replace(/[^A-Za-zÀ-ÿÑñ' .\-]/g, "").replace(/\s{2,}/g, " ");

/** Digits only. Used for phone numbers. */
export const sanitizeDigits = (v: string) => v.replace(/\D/g, "");

/** DNI/CE: alphanumeric uppercase. DNI peruano = 8 dígitos; CE puede tener letras. */
export const sanitizeDni = (v: string) =>
  v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidName = (v: string) => v.trim().length >= 2 && NAME_RE.test(v.trim());
export const isValidPhone = (v: string) => /^\d{6,15}$/.test(v.trim());
export const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());
/** DNI peruano 8 dígitos | CE 9–12 alfanumérico. Acepta ambos. */
export const isValidDni = (v: string) => {
  const t = v.trim().toUpperCase();
  if (!t) return false;
  if (/^\d{8}$/.test(t)) return true; // DNI
  if (/^[A-Z0-9]{9,12}$/.test(t)) return true; // CE
  return false;
};

export const NAME_ERROR = "Solo letras y espacios";
export const PHONE_ERROR = "Solo dígitos (6 a 15)";
export const EMAIL_ERROR = "Correo inválido";
export const DNI_ERROR = "DNI: 8 dígitos · CE: 9–12 alfanuméricos";
