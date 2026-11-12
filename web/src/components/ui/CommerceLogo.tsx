'use client';

// Contenedor de logo de 48px. Si la fuente no entrega imagen (Tenpo) o la imagen falla, muestra
// las iniciales del comercio.
import { useState } from 'react';
import { initials } from '@/lib/benefit-format';

export function CommerceLogo({ logo, name }: { logo: string | null | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logo) && !failed;
  return (
    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-subtle">
      {showImage ? (
        // Logos de dominios de cada emisor: <img> simple (next/image exigiria listar cada dominio).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo!}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true" className="text-14 font-bold text-fg-muted">
          {initials(name)}
        </span>
      )}
    </div>
  );
}
