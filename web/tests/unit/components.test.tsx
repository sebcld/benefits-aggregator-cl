import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BenefitCard } from '@/components/ui/BenefitCard';
import { ChipButton } from '@/components/ui/Chip';
import { IssuerCheckbox } from '@/components/ui/IssuerCheckbox';
import { LoadingCard } from '@/components/ui/LoadingCard';
import { Notice, NoticeAction } from '@/components/ui/Notice';
import { SearchBox } from '@/components/ui/SearchBox';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { Benefit } from '@/lib/api/types';

vi.mock('next/form', () => ({
  default: ({ action, children, ...rest }: { action: string; children: React.ReactNode }) => (
    <form action={action} {...rest}>
      {children}
    </form>
  ),
}));

const BENEFIT: Benefit = {
  id: 'santander-abc',
  bank: 'Santander',
  bankKey: 'santander',
  title: 'Burger King',
  subtitle: '40% dcto. todos los jueves.',
  description: 'Descuento en locales seleccionados.',
  commerceName: null,
  category: null,
  validFrom: null,
  validUntil: '2026-12-31',
  url: 'https://banco.santander.cl/beneficios/burger-king',
  logo: null,
};

describe('BenefitCard', () => {
  it('mapea los campos del beneficio', () => {
    render(<BenefitCard benefit={BENEFIT} />);
    expect(screen.getByRole('heading', { name: 'Burger King' })).toBeInTheDocument();
    expect(screen.getByText('40% dcto. todos los jueves.')).toBeInTheDocument();
    expect(screen.getByText('Descuento en locales seleccionados.')).toBeInTheDocument();
    expect(screen.getByText('Santander')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-hero')).toHaveTextContent('40% DCTO');
    expect(screen.getByText('Vigente hasta 31 dic 2026').closest('time')).toHaveAttribute('dateTime', '2026-12-31');
  });

  it('usa el color del emisor via token (nunca un hex)', () => {
    render(<BenefitCard benefit={BENEFIT} />);
    expect(screen.getByTestId('benefit-card').style.getPropertyValue('--issuer')).toBe('var(--issuer-santander)');
  });

  it('"Ver beneficio" abre la fuente en una pestana nueva y tiene un nombre accesible completo', () => {
    render(<BenefitCard benefit={BENEFIT} />);
    const link = screen.getByRole('link', { name: /Ver beneficio: Burger King con Santander/ });
    expect(link).toHaveAttribute('href', BENEFIT.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('sin logo muestra iniciales; con logo, la imagen', () => {
    const { rerender, container } = render(<BenefitCard benefit={BENEFIT} />);
    expect(screen.getByText('BK')).toBeInTheDocument();
    rerender(<BenefitCard benefit={{ ...BENEFIT, logo: 'https://example.com/logo.png' }} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('si la imagen falla, vuelve a las iniciales', () => {
    const { container } = render(<BenefitCard benefit={{ ...BENEFIT, logo: 'https://example.com/roto.png' }} />);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByText('BK')).toBeInTheDocument();
  });

  it('oculta la vigencia, la pildora y el boton cuando no hay datos', () => {
    render(<BenefitCard benefit={{ ...BENEFIT, subtitle: null, validUntil: null, url: null }} />);
    expect(screen.queryByText(/Vigente hasta/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('benefit-hero')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('muestra la pastilla de tarjeta solo si la API trae cardType', () => {
    const { rerender } = render(<BenefitCard benefit={BENEFIT} />);
    expect(screen.queryByTestId('benefit-card-type')).not.toBeInTheDocument();
    rerender(<BenefitCard benefit={{ ...BENEFIT, cardType: 'Tarjeta prepago física' }} />);
    expect(screen.getByTestId('benefit-card-type')).toHaveTextContent('Tarjeta prepago física');
  });

  it('un emisor sin token de color usa el secundario', () => {
    render(<BenefitCard benefit={{ ...BENEFIT, bankKey: 'mercadopago', bank: 'Mercado Pago' }} />);
    expect(screen.getByTestId('benefit-card').style.getPropertyValue('--issuer')).toBe('var(--text-secondary)');
  });
});

describe('SearchBox', () => {
  it('es un formulario GET a /buscar con label, q y limite de 100 caracteres', () => {
    render(<SearchBox defaultValue="rappi" />);
    const input = screen.getByLabelText('Busca un comercio o marca');
    expect(input).toHaveAttribute('name', 'q');
    expect(input).toHaveAttribute('maxLength', '100');
    expect(input).toHaveValue('rappi');
    expect(screen.getByRole('search')).toHaveAttribute('action', '/buscar');
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('type', 'submit');
  });
});

describe('Chip', () => {
  it('expone el estado con aria-pressed', () => {
    render(
      <>
        <ChipButton>Normal</ChipButton>
        <ChipButton active>Activo</ChipButton>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Activo' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Notice', () => {
  it('parcial es status; error es alert y admite accion', () => {
    const onRetry = vi.fn();
    render(
      <>
        <Notice type="partial">Parcial</Notice>
        <Notice type="error" action={<NoticeAction onClick={onRetry}>Reintentar</NoticeAction>}>
          Error
        </Notice>
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Parcial');
    expect(screen.getByRole('alert')).toHaveTextContent('Error');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('IssuerCheckbox', () => {
  it('es un checkbox con nombre y conteo accesibles', () => {
    const onChange = vi.fn();
    render(<IssuerCheckbox issuerKey="copec" name="Copec Pay" count={2} checked onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Copec Pay, 2 beneficios' });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('con 0 coincidencias queda deshabilitado y sin marcar', () => {
    render(<IssuerCheckbox issuerKey="tapp" name="Tapp" count={0} checked onChange={() => {}} />);
    const box = screen.getByRole('checkbox', { name: 'Tapp, 0 beneficios' });
    expect(box).toBeDisabled();
    expect(box).not.toBeChecked();
  });
});

describe('LoadingCard', () => {
  it('es decorativa (el estado de carga se anuncia en el contenedor)', () => {
    render(<LoadingCard />);
    expect(screen.getByTestId('loading-card')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ThemeToggle', () => {
  it('alterna data-theme y guarda la preferencia', async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Activar tema oscuro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    // La etiqueta se actualiza cuando el MutationObserver avisa del cambio de atributo.
    fireEvent.click(await screen.findByRole('button', { name: 'Activar tema claro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('funciona aunque localStorage falle (modo privado)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Activar tema oscuro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
