// Iconos del diseno (trazos extraidos de design/beneficios_CL.figcraft, trazo 1.5, color heredado).
import type { SVGProps } from 'react';

const ICONS = {
  search: { box: 20, d: 'M9 16C12.87 16 16 12.87 16 9C16 5.13 12.87 2 9 2C5.13 2 2 5.13 2 9C2 12.87 5.13 16 9 16M14 14L18 18' },
  arrow: { box: 16, d: 'M2 8L14 8M9 3L14 8L9 13' },
  'arrow-sm': { box: 14, d: 'M2 7L12 7M8 3L12 7L8 11' },
  calendar: { box: 14, d: 'M2.5 3.5L11.5 3.5L11.5 11.5L2.5 11.5L2.5 3.5M2.5 6L11.5 6M5 2L5 4.5M9 2L9 4.5' },
  card: { box: 14, d: 'M1.5 3L12.5 3L12.5 11L1.5 11L1.5 3M1.5 6L12.5 6' },
  alert: { box: 20, d: 'M10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18M10 6L10 10.5M10 13.5L10 13.6' },
  moon: { box: 18, d: 'M15.5 11.2C13.04 11.93 10.38 11.25 8.56 9.44C6.75 7.62 6.07 4.96 6.8 2.5C3.59 3.45 1.5 6.55 1.82 9.88C2.14 13.22 4.78 15.86 8.12 16.18C11.45 16.5 14.55 14.41 15.5 11.2' },
  sun: {
    box: 18,
    d: 'M9 12.5C10.93 12.5 12.5 10.93 12.5 9C12.5 7.07 10.93 5.5 9 5.5C7.07 5.5 5.5 7.07 5.5 9C5.5 10.93 7.07 12.5 9 12.5M9 1L9 2.5M9 15.5L9 17M1 9L2.5 9M15.5 9L17 9M3.3 3.3L4.4 4.4M13.6 13.6L14.7 14.7M3.3 14.7L4.4 13.6M13.6 4.4L14.7 3.3',
  },
  refresh: { box: 20, d: 'M3 10C3.33 7.32 5.17 5.06 7.74 4.21C10.3 3.35 13.13 4.05 15 6M15 2L15 6L11 6M17 10C16.67 12.68 14.83 14.94 12.26 15.79C9.7 16.65 6.87 15.95 5 14M5 18L5 14L9 14' },
  'check-circle': { box: 20, d: 'M10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18M6.5 10L9 12.5L13.5 7.5' },
  tick: { box: 18, d: 'M5 9.2L7.6 11.8L13 6.2' },
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Tamano en px; por defecto, el del icono en el diseno. */
  size?: number;
}

export function Icon({ name, size, strokeWidth = 1.5, ...rest }: IconProps) {
  const icon = ICONS[name];
  const px = size ?? icon.box;
  return (
    <svg
      viewBox={`0 0 ${icon.box} ${icon.box}`}
      width={px}
      height={px}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={icon.d} />
    </svg>
  );
}
