import { Link } from 'wouter';
import { Logo } from '@/components/brand/logo';
import { SocialLinks } from './social';
import { useCategories, useSettings } from '@/hooks/queries';

export function Footer() {
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  return (
    <footer className="relative z-30 overflow-hidden rounded-t-[40px] bg-blush-100 pt-16">
      <div className="page-wrap grid gap-12 pb-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-ink/60">
            Ropa, maquillaje y accesorios elegidos con amor. Te atendemos por WhatsApp e Instagram.
          </p>
          <SocialLinks className="mt-6" />
        </div>
        <div>
          <p className="eyebrow text-ink/50">Tienda</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/tienda" className="hover:text-blush-600">Todo</Link></li>
            {categories.map((c) => (
              <li key={c.id}><Link href={`/tienda?categoria=${c.slug}`} className="hover:text-blush-600">{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow text-ink/50">Ayuda</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/cuenta" className="hover:text-blush-600">Mis pedidos</Link></li>
            <li><a href={settings?.instagram_url ?? '#'} target="_blank" rel="noreferrer" className="hover:text-blush-600">@shoppelystore</a></li>
            <li>{settings?.whatsapp}</li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-ink/50">Pagos</p>
          <ul className="mt-4 space-y-2 text-sm">
            {settings?.transfer_enabled && <li>Transferencia</li>}
            {settings?.mercadopago_enabled && <li>Mercado Pago</li>}
            {settings?.cash_enabled && <li>Efectivo</li>}
          </ul>
        </div>
      </div>
      <p className="font-brand pointer-events-none select-none text-center text-[22vw] font-semibold leading-[0.75] tracking-tighter text-white">
        Shoppely
      </p>
      <div className="page-wrap flex flex-col justify-between gap-2 border-t border-ink/10 py-5 text-xs text-ink/50 sm:flex-row">
        <span>© {new Date().getFullYear()} Shoppely Online Store</span>
        <span>Hecho con ♥</span>
      </div>
    </footer>
  );
}
