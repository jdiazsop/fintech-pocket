export interface CountryCode {
  code: string; // dial code with +
  iso: string;  // ISO 3166-1 alpha-2
  name: string;
  flag: string;
}

// Curated list, Peru first as default for LATAM-focused app
export const COUNTRY_CODES: CountryCode[] = [
  { code: "+51", iso: "PE", name: "Perú", flag: "🇵🇪" },
  { code: "+54", iso: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "+591", iso: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "+55", iso: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "+56", iso: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "+57", iso: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "+506", iso: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "+593", iso: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "+503", iso: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "+34", iso: "ES", name: "España", flag: "🇪🇸" },
  { code: "+1", iso: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "+502", iso: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "+504", iso: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "+52", iso: "MX", name: "México", flag: "🇲🇽" },
  { code: "+505", iso: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "+507", iso: "PA", name: "Panamá", flag: "🇵🇦" },
  { code: "+595", iso: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "+1787", iso: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { code: "+1809", iso: "DO", name: "República Dominicana", flag: "🇩🇴" },
  { code: "+598", iso: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "+58", iso: "VE", name: "Venezuela", flag: "🇻🇪" },
];

export const DEFAULT_COUNTRY_CODE = "+51";
