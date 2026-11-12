// Hero del inicio: titular, bajada, buscador y chips de sugerencia.
// Escritorio: centrado, titular 56px. Movil: alineado a la izquierda, titular 34px.
import { ChipLink } from '@/components/ui/Chip';
import { SearchBox } from '@/components/ui/SearchBox';
import { cn } from '@/lib/cn';

export const SUGGESTIONS = ['Rappi', 'Burger King', 'Temu', 'Pedidos Ya', 'Cine', 'Copec'];
/** En movil el diseno muestra solo las primeras cuatro. */
const MOBILE_SUGGESTIONS = 4;

export function Hero() {
  return (
    <section
      aria-labelledby="hero-titulo"
      className="flex flex-col gap-4 px-4 pt-9 pb-6 lg:items-center lg:gap-5 lg:px-16 lg:pt-[88px] lg:pb-12 lg:text-center"
    >
      <h1 id="hero-titulo" className="font-display text-34 font-bold tracking-display text-fg lg:text-56">
        ¿Dónde tienes descuento hoy?
      </h1>
      <p className="text-15 leading-[22px] text-fg-muted lg:max-w-[560px] lg:text-17 lg:leading-[26px]">
        Busca un comercio y te mostramos los beneficios de tus bancos, tarjetas y billeteras
        <span className="hidden lg:inline">, todo en un solo lugar</span>.
      </p>
      <SearchBox className="lg:max-w-[640px]" id="buscar-inicio" />
      <nav aria-label="Búsquedas sugeridas">
        <ul className="flex flex-wrap gap-2 lg:justify-center lg:gap-2.5">
          {SUGGESTIONS.map((term, i) => (
            <li key={term} className={cn(i >= MOBILE_SUGGESTIONS && 'hidden lg:block')}>
              <ChipLink href={{ pathname: '/buscar', query: { q: term } }}>{term}</ChipLink>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
