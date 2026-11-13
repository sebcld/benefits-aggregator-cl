// Inicio. Movil: hero + "Destacados de hoy", como en el diseno.
// Escritorio: hero + "Destacados de hoy" (grilla de 3) + "Cómo funciona" (Bento) + "Fuentes que consultamos".
import { Featured } from '@/components/home/Featured';
import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Sources } from '@/components/home/Sources';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1440px]">
      <Hero />
      <Featured />
      <HowItWorks className="hidden lg:block" />
      <Sources className="hidden lg:block" />
    </div>
  );
}
