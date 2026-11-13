// Emisores conocidos por el diseno: cada uno tiene su token de color (issuer/<key>).
// La lista de emisores disponibles viene de GET /v1/banks; esta tabla solo aporta el color y un
// orden de respaldo. Un emisor nuevo sin token usa el color secundario hasta que el diseno lo defina.

export interface IssuerInfo {
  key: string;
  name: string;
  /** Valor CSS del color del emisor, siempre a traves de un token (nunca un hex). */
  color: string;
}

const KNOWN: Record<string, { name: string; token: string }> = {
  santander: { name: 'Santander', token: '--issuer-santander' },
  bci: { name: 'BCI', token: '--issuer-bci' },
  tenpo: { name: 'Tenpo', token: '--issuer-tenpo' },
  tapp: { name: 'Tapp', token: '--issuer-tapp' },
  copec: { name: 'Copec Pay', token: '--issuer-copec' },
  bancochile: { name: 'Banco de Chile', token: '--issuer-bancochile' },
  mercadopago: { name: 'Mercado Pago', token: '--issuer-mercadopago' },
};

const FALLBACK_TOKEN = '--text-secondary';

export function issuerColor(key: string): string {
  return `var(${KNOWN[key]?.token ?? FALLBACK_TOKEN})`;
}

export function issuerInfo(key: string, name?: string): IssuerInfo {
  return { key, name: name ?? KNOWN[key]?.name ?? key, color: issuerColor(key) };
}

/** Emisores que muestra la fila "Fuentes que consultamos" del inicio (los del diseno). */
export const FEATURED_SOURCES: IssuerInfo[] = Object.keys(KNOWN).map((key) => issuerInfo(key));

/** Variable CSS para pasar el color del emisor a un componente (`bg-issuer`, `issuer-tint`). */
export function issuerStyle(key: string): React.CSSProperties {
  return { ['--issuer' as string]: issuerColor(key) };
}
