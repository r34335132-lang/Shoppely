import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Menu, Search, ShoppingBag, User, X, LayoutDashboard } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { CurrencyToggle } from './currency-toggle';
import { useCart } from '@/providers/cart';
import { useAuth } from '@/providers/auth';
import { useCategories } from '@/hooks/queries';
import { lockScroll } from '@/lib/smooth-scroll';
import { cn } from '@/lib/utils';

export function Header({ onSearch }: { onSearch: () => void }) {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, open, bump } = useCart();
  const { profile, isStaff } = useAuth();
  const { data: categories = [] } = useCategories();
  const [location] = useLocation();
  const overHero = location === '/' && !solid;

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > prev && y > 160 && !menuOpen);
    setSolid(y > 30);
  });

  const toggleMenu = (next: boolean) => {
    setMenuOpen(next);
    lockScroll(next);
  };

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        animate={{ y: hidden ? '-150%' : '0%' }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={cn(
          'mx-auto mt-3 flex w-[min(1400px,calc(100%-24px))] items-center justify-between rounded-full px-3 py-2 transition-all duration-500 sm:px-5',
          overHero ? 'bg-white/40 backdrop-blur-md' : 'bg-white/80 shadow-[0_10px_40px_-20px_rgba(20,16,20,0.35)] backdrop-blur-xl',
        )}>
          <div className="flex flex-1 items-center gap-1">
            <button type="button" onClick={() => toggleMenu(true)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5 lg:hidden" aria-label="Abrir menú">
              <Menu className="h-5 w-5" />
            </button>
            <nav className="hidden items-center gap-1 lg:flex">
              <NavLink href="/tienda">Tienda</NavLink>
              {categories.slice(0, 4).map((c) => (
                <NavLink key={c.id} href={`/tienda?categoria=${c.slug}`}>{c.name}</NavLink>
              ))}
            </nav>
          </div>

          <Link href="/" className="shrink-0" aria-label="Inicio">
            <Logo compact className="scale-90 sm:scale-100" />
          </Link>

          <div className="flex flex-1 items-center justify-end gap-1">
            <CurrencyToggle className="mr-1 hidden sm:flex" />
            <IconButton label="Buscar" onClick={onSearch}><Search className="h-[18px] w-[18px]" /></IconButton>
            {isStaff && (
              <Link href="/panel" className="hidden h-10 w-10 place-items-center rounded-full hover:bg-ink/5 sm:grid" aria-label="Panel">
                <LayoutDashboard className="h-[18px] w-[18px]" />
              </Link>
            )}
            <Link href={profile ? '/cuenta' : '/login'} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Mi cuenta">
              <User className="h-[18px] w-[18px]" />
            </Link>
            <button type="button" onClick={open} className="relative grid h-10 w-10 place-items-center rounded-full bg-ink text-white transition hover:bg-blush-600" aria-label={`Carrito, ${count} productos`}>
              <motion.span key={bump} animate={bump ? { rotate: [0, -18, 14, -8, 0], scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.6 }}>
                <ShoppingBag className="h-[18px] w-[18px]" />
              </motion.span>
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blush-400 px-1 text-[10px] font-bold text-ink ring-2 ring-white"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-blush-100 px-6 pb-10 pt-6"
            initial={{ clipPath: 'circle(0% at 32px 32px)' }}
            animate={{ clipPath: 'circle(150% at 32px 32px)' }}
            exit={{ clipPath: 'circle(0% at 32px 32px)' }}
            transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => toggleMenu(false)} className="grid h-11 w-11 place-items-center rounded-full bg-white" aria-label="Cerrar menú">
                <X className="h-5 w-5" />
              </button>
            </div>
            <motion.nav
              className="mt-12 flex flex-col gap-2"
              initial="hidden"
              animate="show"
              transition={{ staggerChildren: 0.06, delayChildren: 0.25 }}
            >
              {[{ href: '/tienda', label: 'Toda la tienda' }, ...categories.map((c) => ({ href: `/tienda?categoria=${c.slug}`, label: c.name })), { href: profile ? '/cuenta' : '/login', label: profile ? 'Mi cuenta' : 'Entrar' }, ...(isStaff ? [{ href: '/panel', label: 'Panel' }] : [])].map((item) => (
                <motion.div key={item.href} variants={{ hidden: { opacity: 0, x: -40 }, show: { opacity: 1, x: 0 } }}>
                  <Link href={item.href} onClick={() => toggleMenu(false)} className="display block py-1 text-5xl text-ink">
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </motion.nav>
            <div className="mt-auto">
              <CurrencyToggle className="w-fit" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group relative rounded-full px-3 py-2 text-[13px] font-semibold text-ink/80 transition hover:text-ink">
      {children}
      <span className="absolute inset-x-3 bottom-1 h-[2px] origin-left scale-x-0 rounded-full bg-blush-500 transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5">
      {children}
    </button>
  );
}
