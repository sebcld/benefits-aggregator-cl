// "Cómo funciona" como Bento grid (01 / 02 / 03 en marca de agua). La primera celda es mas ancha
// (504 / 384 / 384 en el diseno).
import { Icon, type IconName } from '@/components/ui/Icon';

const STEPS: Array<{ n: string; icon: IconName; title: string; text: string }> = [
  { n: '01', icon: 'search', title: 'Escribe el comercio', text: 'Una marca, una tienda o un tipo de panorama: Burger King, Rappi, cine.' },
  { n: '02', icon: 'refresh', title: 'Consultamos en vivo', text: 'Revisamos los beneficios publicados por cada banco, tarjeta y billetera.' },
  { n: '03', icon: 'check-circle', title: 'Elige y activa', text: 'Ves el emisor, la vigencia y el enlace directo al beneficio.' },
];

export function HowItWorks({ className }: { className?: string }) {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className={className}>
      <div className="flex flex-col gap-5 px-4 pt-6 pb-10 lg:px-16">
        <h2 id="como-funciona-titulo" className="font-display text-24 font-semibold tracking-display text-fg">
          Cómo funciona
        </h2>
        <ol className="grid grid-cols-1 gap-5 md:grid-cols-[1.3125fr_1fr_1fr]">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="relative flex min-h-[230px] flex-col justify-end gap-3 overflow-hidden rounded-lg border border-line bg-surface p-6"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-2 right-6 font-display text-120 leading-none font-bold tracking-watermark text-subtle select-none"
              >
                {step.n}
              </span>
              <span className="relative grid size-11 place-items-center rounded-[12px] bg-brand-soft text-brand-soft-fg">
                <Icon name={step.icon} />
              </span>
              <h3 className="relative font-display text-22 font-semibold tracking-display text-fg">
                <span className="sr-only">Paso {Number(step.n)}: </span>
                {step.title}
              </h3>
              <p className="relative text-14 leading-[21px] text-fg-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
