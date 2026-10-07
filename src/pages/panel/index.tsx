import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, ChevronRight, LogOut, Menu, Search, ShieldAlert, Sparkles, Store, X } from 'lucide-react';
import { useAuth, roleLabel } from '@/providers/auth';
import { useBadges } from '@/hooks/admin-queries';
import { isDemo, supabase } from '@/lib/supabase';
import { beep } from '@/lib/sound';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BagMark, Logo, Sparkle } from '@/components/brand/logo';
import { Avatar, ConfirmProvider, Empty } from '@/components/panel/kit';
import { canSee, navItems, sectionLabel, type NavItem } from './nav';
import { CommandPalette } from './command-palette';

const Dashboard = lazy(() => import('./dashboard'));
const OrdersPage = lazy(() => import('./orders'));
const ProductsPage = lazy(() => import('./products'));
const InventoryPage = lazy(() => import('./inventory'));
const CashPage = lazy(() => import('./cash'));
const StorefrontPage = lazy(() => import('./storefront'));
const ReviewsPage = lazy(() => import('./reviews'));
const CouponsPage = lazy(() => import('./coupons'));
const TeamPage = lazy(() => import('./team'));
const SettingsPage = lazy(() => import('./settings'));

function Gate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) {
    return <Empty icon={ShieldAlert} title="Sin acceso" text="Tu rol no tiene permiso para ver esta sección. Pide a un administrador que lo cambie." />;
  }
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="grid h-[60vh] place-items-center">
      <BagMark className="h-12 w-12 animate-bounce" />
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role, signOut } = useAuth();
  const [location] = useLocation();
  const { data: badges } = useBadges();
  const visible = navItems.filter((i) => canSee(i, role));
  const sections = (['menu', 'store', 'general'] as const).filter((s) => visible.some((i) => i.section === s));

  const isActive = (item: NavItem) => (item.href === '/' ? location === '/' : location.startsWith(item.href));
  const badgeFor = (item: NavItem) => (item.badge === 'orders' ? badges?.openOrders : item.badge === 'stock' ? badges?.lowStock : 0) ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-6 pt-1">
        <Link href="~/" onClick={onNavigate}><Logo compact /></Link>
        <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Panel</span>
      </div>

      <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto">
        {sections.map((section) => (
          <div key={section}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/35">{sectionLabel[section]}</p>
            <ul className="space-y-1">
              {visible.filter((i) => i.section === section).map((item) => {
                const active = isActive(item);
                const count = badgeFor(item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'relative flex h-11 items-center gap-3 rounded-2xl px-3 text-[14px] font-semibold transition-colors',
                        active ? 'text-ink' : 'text-ink/55 hover:bg-white/60 hover:text-ink',
                      )}
                    >
                      {active && (
                        <motion.span layoutId="nav-active" className="absolute inset-0 rounded-2xl bg-white shadow-[0_6px_18px_-10px_rgba(20,16,20,0.35)]" transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blush-600" />
                        </motion.span>
                      )}
                      <item.icon className={cn('relative h-[18px] w-[18px]', active && 'text-blush-700')} />
                      <span className="relative flex-1">{item.label}</span>
                      {count > 0 && (
                        <motion.span
                          key={count}
                          initial={{ scale: 0.4 }}
                          animate={{ scale: 1 }}
                          className={cn('relative rounded-full px-2 py-0.5 text-[10px] font-bold', item.badge === 'stock' ? 'bg-amber-100 text-amber-800' : 'bg-blush-600 text-white')}
                        >
                          {count}
                        </motion.span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div>
          <ul className="space-y-1">
            <li>
              <Link href="~/" onClick={onNavigate} className="flex h-11 items-center gap-3 rounded-2xl px-3 text-[14px] font-semibold text-ink/55 hover:bg-white/60 hover:text-ink">
                <Store className="h-[18px] w-[18px]" /> Ver tienda
              </Link>
            </li>
            <li>
              <button type="button" onClick={() => void signOut()} className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-[14px] font-semibold text-ink/55 hover:bg-white/60 hover:text-ink">
                <LogOut className="h-[18px] w-[18px]" /> Salir
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <PromoCard role={role} onNavigate={onNavigate} />
    </div>
  );
}

function PromoCard({ role, onNavigate }: { role: Role | null; onNavigate?: () => void }) {
  const pos = role === 'admin' || role === 'seller';
  return (
    <div className="relative mt-4 overflow-hidden rounded-[24px] bg-[radial-gradient(120%_120%_at_0%_0%,#8a4a58_0%,#3d2229_55%,#22161a_100%)] p-4 text-white">
      <Sparkle className="absolute right-4 top-4 h-4 w-4 animate-twinkle" />
      <Sparkle className="absolute bottom-14 right-10 h-2.5 w-2.5 animate-twinkle [animation-delay:600ms]" />
      <motion.div
        className="pointer-events-none absolute -bottom-10 -right-8 h-32 w-32 rounded-full bg-blush-500/40 blur-2xl"
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><Sparkles className="h-4 w-4" /></span>
      <p className="mt-3 text-[15px] font-bold leading-tight">{pos ? 'Cobra en segundos' : 'Escanea y ajusta'}</p>
      <p className="mt-1 text-xs text-white/65">{pos ? 'Punto de venta táctil, listo para iPad y lector de códigos.' : 'Usa la cámara o el lector para contar tu inventario.'}</p>
      <Link
        href={pos ? '/pos' : '/inventario?scan=1'}
        onClick={onNavigate}
        className="mt-3 flex h-10 items-center justify-center gap-1 rounded-full bg-blush-400 text-sm font-bold text-ink transition hover:bg-blush-300"
      >
        {pos ? 'Abrir POS' : 'Escanear'} <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { profile, role } = useAuth();
  const { data: badges } = useBadges();
  const pending = (role === 'admin' || role === 'seller' ? badges?.openOrders : badges?.lowStock) ?? 0;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPad|iPhone/.test(navigator.platform);

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button type="button" onClick={onMenu} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-ink/5 lg:hidden" aria-label="Abrir menú">
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onSearch}
        className="flex h-11 flex-1 items-center gap-3 rounded-full bg-white px-4 text-left text-sm text-ink/40 ring-1 ring-ink/5 transition hover:ring-ink/15 sm:max-w-md"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate">Buscar páginas, productos o pedidos…</span>
        <kbd className="hidden rounded-lg bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink/50 sm:block">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        {isDemo && <span className="hidden rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-800 md:block">Modo demo</span>}
        <Link
          href={role === 'admin' || role === 'seller' ? '/pedidos' : '/inventario'}
          className="relative grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-ink/5 transition hover:ring-ink/15"
          aria-label="Pendientes"
        >
          <Bell className="h-[18px] w-[18px]" />
          {pending > 0 && (
            <span className="absolute right-2.5 top-2.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blush-500 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blush-600 ring-2 ring-white" />
            </span>
          )}
        </Link>
        <div className="flex items-center gap-3 rounded-full bg-white py-1 pl-1 pr-1 ring-1 ring-ink/5 sm:pr-4">
          <Avatar name={profile?.full_name} />
          <div className="hidden leading-tight sm:block">
            <p className="max-w-[160px] truncate text-sm font-bold">{profile?.full_name}</p>
            <p className="text-[11px] text-ink/50">{role && roleLabel[role]}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

/** Avisos en tiempo real de pedidos nuevos (solo con Supabase). */
function useOrderAlerts(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || !supabase) return;
    const client = supabase;
    const channel = client
      .channel('panel-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const order = payload.new as { folio: number; channel: string; customer_name: string | null };
        if (order.channel === 'online') {
          toast.success(`Nuevo pedido #${order.folio}`, { description: order.customer_name ?? undefined });
          beep('alert');
        }
        void qc.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        void qc.invalidateQueries({ queryKey: ['admin'] });
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [enabled, qc]);
}

export default function PanelLayout() {
  const { role } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  useOrderAlerts(role === 'admin' || role === 'seller');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setMenuOpen(false);
  }, [location]);

  return (
    <ConfirmProvider>
      <div className="relative h-dvh overflow-hidden bg-[#22161a] lg:p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_0%_0%,#6b3b47_0%,transparent_60%),radial-gradient(700px_500px_at_100%_100%,#5d4a7a_0%,transparent_55%)] opacity-90" />
        <div className="relative mx-auto flex h-full max-w-[1720px] overflow-hidden bg-[#f7f2ee] lg:rounded-[30px] lg:shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]">
          <aside className="hidden w-[264px] shrink-0 border-r border-ink/[0.05] bg-[#f1e9e3] p-4 lg:block">
            <SidebarContent />
          </aside>

          <AnimatePresence>
            {menuOpen && (
              <div className="fixed inset-0 z-[70] lg:hidden">
                <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
                <motion.aside
                  className="absolute inset-y-0 left-0 w-[290px] bg-[#f1e9e3] p-4 shadow-2xl"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                >
                  <button type="button" onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white" aria-label="Cerrar menú">
                    <X className="h-4 w-4" />
                  </button>
                  <SidebarContent onNavigate={() => setMenuOpen(false)} />
                </motion.aside>
              </div>
            )}
          </AnimatePresence>

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onMenu={() => setMenuOpen(true)} onSearch={() => setPaletteOpen(true)} />
            <main ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-12 pt-2 sm:px-6 lg:px-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={location}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Suspense fallback={<PageFallback />}>
                    <Switch location={location}>
                      <Route path="/"><Dashboard /></Route>
                      <Route path="/pedidos"><Gate roles={['admin', 'seller']}><OrdersPage /></Gate></Route>
                      <Route path="/productos"><Gate roles={['admin', 'inventory']}><ProductsPage /></Gate></Route>
                      <Route path="/inventario"><Gate roles={['admin', 'inventory']}><InventoryPage /></Gate></Route>
                      <Route path="/caja"><Gate roles={['admin', 'seller']}><CashPage /></Gate></Route>
                      <Route path="/portada"><Gate roles={['admin']}><StorefrontPage /></Gate></Route>
                      <Route path="/resenas"><Gate roles={['admin']}><ReviewsPage /></Gate></Route>
                      <Route path="/cupones"><Gate roles={['admin']}><CouponsPage /></Gate></Route>
                      <Route path="/equipo"><Gate roles={['admin']}><TeamPage /></Gate></Route>
                      <Route path="/ajustes"><Gate roles={['admin']}><SettingsPage /></Gate></Route>
                      <Route><Empty icon={Search} title="Página no encontrada" text="Revisa el menú de la izquierda." /></Route>
                    </Switch>
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </ConfirmProvider>
  );
}
