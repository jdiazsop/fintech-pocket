// Canonical public URL for the production app.
// All shareable links (WhatsApp, agreement confirmations, invitations) MUST
// be built against this domain so they keep working regardless of where the
// user opens the app from (preview, custom domain, etc.).
export const PUBLIC_APP_URL = "https://app.credify.pe";

export function buildPublicUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_APP_URL}${clean}`;
}
