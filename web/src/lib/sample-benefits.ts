// Beneficios de EJEMPLO (los del diseno) para la pagina /sistema y los tests. No son datos reales.
// Como en las fuentes reales (Santander, Copec Pay, Banco de Chile), el valor va en la bajada.
import type { Benefit } from './api/types';

const base = {
  commerceName: null,
  category: null,
  validFrom: null,
  validUntil: '2026-12-31',
  url: 'https://example.com/beneficio',
  logo: null,
} satisfies Partial<Benefit>;

const sample = (bankKey: string, bank: string, title: string, subtitle: string, description: string, extra: Partial<Benefit> = {}): Benefit => ({
  ...base,
  id: `ejemplo-${bankKey}`,
  bankKey,
  bank,
  title,
  subtitle,
  description,
  ...extra,
});

export const SAMPLE_BENEFITS: Benefit[] = [
  sample('copec', 'Copec Pay', 'Rappi', '20% dcto en tus pedidos', 'Obtén descuento en tus pedidos pagando con tu tarjeta. Aplica desde el monto mínimo indicado en las condiciones.'),
  sample('tapp', 'Tapp', 'Rappi Regiones', '15% dcto fuera de la RM', 'Beneficio disponible en regiones seleccionadas. Revisa las tiendas y el tope de descuento antes de pagar.'),
  sample('bci', 'BCI', 'Rappi Prime gratis', 'Envío gratis con tu tarjeta', 'Disfruta de envíos sin costo en tus pedidos durante el período de la promoción.'),
  sample('santander', 'Santander', 'Burger King', '2x1 en combos y ofertas', 'Descuento en locales seleccionados pagando con tu tarjeta. Revisa los días y condiciones.'),
  sample('tenpo', 'Tenpo', 'Rappi Antojos', 'Tiendas seleccionadas', 'Sin vigencia ni valor de descuento: la tarjeta oculta la píldora y la pastilla de vigencia.', {
    validUntil: null,
  }),
  sample('bancochile', 'Banco de Chile', 'Rappi Turbo', '15% dcto en entrega rápida', 'Pide en Rappi Turbo y obtén descuento con tu tarjeta. Aplica lunes a domingo.'),
];
