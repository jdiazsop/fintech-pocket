export interface CountryCode {
  code: string; // dial code with +
  iso: string;  // ISO 3166-1 alpha-2
  name: string;
  flag: string;
}

// Curated list, Peru first as default for LATAM-focused app
export const COUNTRY_CODES: CountryCode[] = [
  { code: "+51", iso: "PE", name: "Perú", flag: "🇵🇪" },
  { code: "+56", iso: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "+57", iso: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "+58", iso: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "+54", iso: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "+593", iso: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "+591", iso: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "+55", iso: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "+52", iso: "MX", name: "México", flag: "🇲🇽" },
];

export const DEFAULT_COUNTRY_CODE = "+51";
