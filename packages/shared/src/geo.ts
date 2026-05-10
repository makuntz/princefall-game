/** Países com código ISO 3166-1 alpha-2 (foco Américas + Portugal + alguns extras). */
export const COUNTRY_OPTIONS: ReadonlyArray<{ code: string; namePt: string }> = [
  { code: 'BR', namePt: 'Brasil' },
  { code: 'AR', namePt: 'Argentina' },
  { code: 'BO', namePt: 'Bolívia' },
  { code: 'CL', namePt: 'Chile' },
  { code: 'CO', namePt: 'Colômbia' },
  { code: 'EC', namePt: 'Equador' },
  { code: 'GY', namePt: 'Guiana' },
  { code: 'PY', namePt: 'Paraguai' },
  { code: 'PE', namePt: 'Peru' },
  { code: 'SR', namePt: 'Suriname' },
  { code: 'UY', namePt: 'Uruguai' },
  { code: 'VE', namePt: 'Venezuela' },
  { code: 'US', namePt: 'Estados Unidos' },
  { code: 'CA', namePt: 'Canadá' },
  { code: 'MX', namePt: 'México' },
  { code: 'PT', namePt: 'Portugal' },
  { code: 'ES', namePt: 'Espanha' },
  { code: 'FR', namePt: 'França' },
  { code: 'DE', namePt: 'Alemanha' },
  { code: 'IT', namePt: 'Itália' },
  { code: 'GB', namePt: 'Reino Unido' },
  { code: 'JP', namePt: 'Japão' },
  { code: 'CN', namePt: 'China' },
  { code: 'AU', namePt: 'Austrália' },
  { code: 'NZ', namePt: 'Nova Zelândia' },
  { code: 'ZA', namePt: 'África do Sul' },
  { code: 'AO', namePt: 'Angola' },
  { code: 'MZ', namePt: 'Moçambique' },
  { code: 'CV', namePt: 'Cabo Verde' },
];

const countrySet = new Set(COUNTRY_OPTIONS.map((c) => c.code));

/** Estados brasileiros (UF). */
export const BR_STATE_OPTIONS: ReadonlyArray<{ code: string; namePt: string }> = [
  { code: 'AC', namePt: 'Acre' },
  { code: 'AL', namePt: 'Alagoas' },
  { code: 'AP', namePt: 'Amapá' },
  { code: 'AM', namePt: 'Amazonas' },
  { code: 'BA', namePt: 'Bahia' },
  { code: 'CE', namePt: 'Ceará' },
  { code: 'DF', namePt: 'Distrito Federal' },
  { code: 'ES', namePt: 'Espírito Santo' },
  { code: 'GO', namePt: 'Goiás' },
  { code: 'MA', namePt: 'Maranhão' },
  { code: 'MT', namePt: 'Mato Grosso' },
  { code: 'MS', namePt: 'Mato Grosso do Sul' },
  { code: 'MG', namePt: 'Minas Gerais' },
  { code: 'PA', namePt: 'Pará' },
  { code: 'PB', namePt: 'Paraíba' },
  { code: 'PR', namePt: 'Paraná' },
  { code: 'PE', namePt: 'Pernambuco' },
  { code: 'PI', namePt: 'Piauí' },
  { code: 'RJ', namePt: 'Rio de Janeiro' },
  { code: 'RN', namePt: 'Rio Grande do Norte' },
  { code: 'RS', namePt: 'Rio Grande do Sul' },
  { code: 'RO', namePt: 'Rondônia' },
  { code: 'RR', namePt: 'Roraima' },
  { code: 'SC', namePt: 'Santa Catarina' },
  { code: 'SP', namePt: 'São Paulo' },
  { code: 'SE', namePt: 'Sergipe' },
  { code: 'TO', namePt: 'Tocantins' },
];

const brStateSet = new Set(BR_STATE_OPTIONS.map((s) => s.code));

export function isKnownCountryCode(code: string): boolean {
  return countrySet.has(code.toUpperCase());
}

export function isBrStateCode(code: string): boolean {
  return brStateSet.has(code.toUpperCase());
}

/** Texto legado (ex.: "Brasil") ou já ISO2 → código ISO. */
export function normalizeLegacyCountry(raw: string | null | undefined): string {
  if (!raw) return '';
  const t = raw.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  const found = COUNTRY_OPTIONS.find((c) => c.namePt.toLowerCase() === t.toLowerCase());
  return found?.code ?? '';
}

/** UF ou nome do estado → código UF quando possível. */
export function normalizeLegacyBrState(raw: string | null | undefined): string {
  if (!raw) return '';
  const u = raw.trim().toUpperCase();
  if (u.length === 2 && brStateSet.has(u)) return u;
  const found = BR_STATE_OPTIONS.find((s) => s.namePt.toLowerCase() === raw.trim().toLowerCase());
  return found?.code ?? raw.trim();
}
