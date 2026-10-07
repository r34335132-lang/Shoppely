import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Camera, ChevronUp, Clock, History, Lock, Minus, MoreHorizontal, PauseCircle, Percent, Plus,
  ScanBarcode, Search, ShoppingBag, Trash2, UserRound, Wallet, X,
} from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { useSettings } from '@/hooks/queries';
import { useAdminCategories, useAdminProducts, useOpenSession } from '@/hooks/admin-queries';
import { createPosSale } from '@/lib/admin-api';
import { findByCode } from '@/lib/codes';
import { money, unitPrice } from '@/lib/format';
import { palette } from '@/lib/palette';
import { beep } from '@/lib/sound';
import { isDemo } from '@/lib/supabase';
import type { AdminProduct, Currency, Variant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/brand/logo';
import { ConfirmProvider, Thumb, useConfirm } from '@/components/panel/kit';
import { CameraScanner, useBarcodeWedge } from '@/components/panel/scanner';
import { CashMoveModal, CloseCashModal, OpenCashModal } from '@/components/panel/cash-forms';
import { resolveCart, totals, useParked, type CartLine, type Customer, type Discount } from './state';
import { CustomerModal, DiscountModal, ParkedModal, RecentSheet, VariantPicker } from './dialogs';
import { PayModal, type DraftPayment } from './pay';

type Dialog = null | 'scan' | 'discount' | 'customer' | 'parked' | 'recent' | 'pay' | 'in' | 'out' | 'close' | 'menu';

export default function PosPage() {
  return (
    <ConfirmProvider>
      <Pos />
    </ConfirmProvider>
  );
}

function Pos() {
  const { profile } = useAuth();
  const { data: session, isLoading: sessionLoading } = useOpenSession(profile?.id);
  const { data: products = [] } = useAdminProducts();
  const { data: categories = [] } = useAdminCategories();
  const { data: settings } = useSettings();
  const rate = settings?.exchange_rate ?? 18;
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [, navigate] = useLocation();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [currency, setCurrency] = useState<Currency>('MXN');
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '' });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [picking, setPicking] = useState<AdminProduct | null>(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { parked, park, take, drop } = useParked();

  const lines = useMemo(() => resolveCart(cart, products, currency, rate), [cart, products, currency, rate]);
  const sum = totals(lines, discount);
  const qtyOf = (variantId: string) => cart.find((l) => l.variantId === variantId)?.qty ?? 0;

  const q = useDeferredValue(query.trim().toLowerCase());
  const grid = useMemo(() => products.filter((p) => {
    if (!p.variants.some((v) => v.active)) return false;
    if (category !== 'all' && p.category_id !== category) return false;
    if (!q) return true;
    return [p.name, p.brand, ...p.tags, ...p.variants.flatMap((v) => [v.sku, v.barcode, v.name])].join(' ').toLowerCase().includes(q);
  }), [products, category, q]);

  const addVariant = (product: AdminProduct, variant: Variant, qty = 1) => {
    const current = qtyOf(variant.id);
    if (current + qty > variant.stock) {
      beep('error');
      toast.error(variant.stock === 0 ? `${product.name} (${variant.name}) está agotado` : `Solo hay ${variant.stock} de ${product.name} (${variant.name})`);
      return;
    }
    beep('scan');
    setCart((c) => (current ? c.map((l) => (l.variantId === variant.id ? { ...l, qty: l.qty + qty } : l)) : [...c, { variantId: variant.id, qty }]));
    setLastAdded(variant.id);
  };

  const tapProduct = (p: AdminProduct) => {
    const active = p.variants.filter((v) => v.active);
    if (active.length === 1) addVariant(p, active[0]);
    else setPicking(p);
  };

  const addByCode = (code: string) => {
    const hit = findByCode(products, code);
    if (!hit) {
      beep('error');
      toast.error(`Código ${code} no encontrado`);
      return false;
    }
    addVariant(hit.product, hit.variant);
    return true;
  };

  useBarcodeWedge((code) => { addByCode(code); }, !!session && dialog === null && !picking);

  const setQty = (variantId: string, qty: number) => {
    const line = lines.find((l) => l.variantId === variantId);
    if (line && qty > line.variant.stock) {
      beep('error');
      toast.error(`Solo hay ${line.variant.stock} disponibles`);
      return;
    }
    setCart((c) => (qty <= 0 ? c.filter((l) => l.variantId !== variantId) : c.map((l) => (l.variantId === variantId ? { ...l, qty } : l))));
  };

  const reset = () => {
    setCart([]);
    setDiscount(null);
    setCustomer({ name: '', phone: '' });
    setTicketOpen(false);
  };

  const parkCurrent = () => {
    if (!cart.length) return;
    park({ cart, customer, discount, currency });
    reset();
    toast.success('Venta apartada. Retómala desde «En espera».');
  };

  const restore = (id: string) => {
    if (cart.length) park({ cart, customer, discount, currency });
    const sale = take(id);
    if (!sale) return;
    setCart(sale.cart);
    setCustomer(sale.customer);
    setDiscount(sale.discount);
    setCurrency(sale.currency);
    setDialog(null);
  };

  const clearCart = async () => {
    if (!cart.length) return;
    const ok = await confirm({ title: '¿Vaciar el ticket?', confirmLabel: 'Vaciar', danger: true });
    if (ok !== false) reset();
  };

  const pay = async (payments: DraftPayment[]) => {
    const methods = new Set(payments.map((p) => p.method));
    const paidInSale = payments.reduce((s, p) => s + (p.currency === currency ? p.amount : currency === 'MXN' ? p.amount * rate : p.amount / rate), 0);
    try {
      const order = await createPosSale({
        channel: 'pos',
        currency,
        items: cart.map((l) => ({ variant_id: l.variantId, quantity: l.qty })),
        customer_name: customer.name || undefined,
        customer_phone: customer.phone || undefined,
        payment_method: methods.size > 1 ? 'mixed' : payments[0].method,
        payments,
        discount_amount: sum.discount || undefined,
        amount_received: methods.has('cash') ? Math.round(paidInSale * 100) / 100 : undefined,
        cash_session_id: session!.id,
      });
      beep('success');
      void qc.invalidateQueries();
      return order;
    } catch (e) {
      beep('error');
      toast.error((e as Error).message);
      throw e;
    }
  };

  const changeCurrency = (c: Currency) => {
    if (discount?.kind === 'amount') setDiscount(null);
    setCurrency(c);
  };

  if (!profile) return null;

  if (!sessionLoading && !session) {
    return (
      <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#22161a] p-6 text-white">
        <div className="pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-blush-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-blush-400/20 blur-[120px]" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-md text-center">
          <motion.span initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }} className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-white text-ink"><Wallet className="h-9 w-9" /></motion.span>
          <h1 className="display mt-6 text-5xl">Abre tu caja</h1>
          <p className="mt-3 text-white/60">Hola {profile.full_name?.split(' ')[0]}. Registra el fondo inicial para empezar a cobrar.</p>
          <div className="mt-8 flex justify-center gap-2">
            <Link href="/panel" className="pbtn bg-white/10 text-white hover:bg-white/20"><ArrowLeft className="h-4 w-4" /> Panel</Link>
            <button type="button" className="pbtn-pink h-12! px-8!" onClick={() => setDialog('in')}>Abrir caja</button>
          </div>
        </motion.div>
        <OpenCashModal open={dialog === 'in'} onClose={() => setDialog(null)} />
      </div>
    );
  }

  const ticket = (
    <Ticket
      lines={lines}
      sum={sum}
      currency={currency}
      discount={discount}
      customer={customer}
      lastAdded={lastAdded}
      onQty={setQty}
      onDiscount={() => setDialog('discount')}
      onCustomer={() => setDialog('customer')}
      onPark={parkCurrent}
      onClear={clearCart}
      onPay={() => setDialog('pay')}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f7f2ee] text-ink select-none">
      {/* Barra superior */}
      <header className="flex h-[68px] shrink-0 items-center gap-2 border-b border-ink/5 bg-white/80 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <Link href="/panel" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink/[0.05] hover:bg-ink/10" aria-label="Volver al panel"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo compact className="hidden xl:inline-flex" />
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-4 h-4 w-4 text-ink/40" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                if (addByCode(query.trim())) setQuery('');
                else if (grid.length === 1) { tapProduct(grid[0]); setQuery(''); }
              }
            }}
            placeholder="Buscar o escribir código de barras / SKU…"
            className="h-12 w-full rounded-full border border-ink/10 bg-white pl-11 pr-10 text-[15px] outline-none transition select-text focus:border-blush-500 focus:ring-4 focus:ring-blush-100"
          />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2 grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5" aria-label="Limpiar"><X className="h-4 w-4" /></button>}
        </label>
        <button type="button" onClick={() => setDialog('scan')} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white hover:bg-blush-700" aria-label="Escanear con cámara"><Camera className="h-5 w-5" /></button>
        <div className="hidden shrink-0 rounded-full bg-ink/[0.05] p-1 sm:flex">
          {(['MXN', 'USD'] as Currency[]).map((c) => (
            <button key={c} type="button" onClick={() => changeCurrency(c)} className={cn('relative h-10 rounded-full px-3.5 text-sm font-bold', currency === c ? 'text-white' : 'text-ink/55')}>
              {currency === c && <motion.span layoutId="pos-cur" className="absolute inset-0 rounded-full bg-ink" />}
              <span className="relative">{c}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setDialog('parked')} className="relative hidden h-12 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/10 md:flex">
          <PauseCircle className="h-4 w-4" /> En espera
          {parked.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold">{parked.length}</span>}
        </button>
        <div className="relative shrink-0">
          <button type="button" onClick={() => setDialog(dialog === 'menu' ? null : 'menu')} className="grid h-12 w-12 place-items-center rounded-full bg-white ring-1 ring-ink/10" aria-label="Más opciones">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          <AnimatePresence>
            {dialog === 'menu' && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDialog(null)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute right-0 top-14 z-50 w-64 origin-top-right rounded-3xl bg-white p-2 shadow-2xl ring-1 ring-ink/5"
                >
                  <div className="px-3 pb-2 pt-1">
                    <p className="text-sm font-bold">{profile.full_name}</p>
                    <p className="text-xs text-ink/50">Caja abierta desde {session ? new Date(session.opened_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                  <MenuItem icon={History} label="Ventas del turno" onClick={() => setDialog('recent')} />
                  <MenuItem icon={PauseCircle} label={`En espera (${parked.length})`} onClick={() => setDialog('parked')} className="md:hidden" />
                  <MenuItem icon={ArrowDownLeft} label="Entrada de efectivo" onClick={() => setDialog('in')} />
                  <MenuItem icon={ArrowUpRight} label="Salida de efectivo" onClick={() => setDialog('out')} />
                  <div className="flex gap-1 px-2 py-1 sm:hidden">
                    {(['MXN', 'USD'] as Currency[]).map((c) => (
                      <button key={c} type="button" onClick={() => changeCurrency(c)} className={cn('h-10 flex-1 rounded-full text-sm font-bold', currency === c ? 'bg-ink text-white' : 'bg-ink/[0.05]')}>{c}</button>
                    ))}
                  </div>
                  <MenuItem icon={Lock} label="Corte de caja" onClick={() => setDialog('close')} danger />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Catálogo */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-3 py-3 sm:px-4">
            {[{ id: 'all', name: 'Todo' }, ...categories.filter((c) => c.active)].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn('relative h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition', category === c.id ? 'text-white' : 'bg-white text-ink/70 ring-1 ring-ink/[0.07]')}
              >
                {category === c.id && <motion.span layoutId="pos-cat" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28 sm:px-4 lg:pb-4">
            {grid.length === 0 ? (
              <div className="grid h-full place-items-center text-center text-ink/50">
                <div><ScanBarcode className="mx-auto h-10 w-10" /><p className="mt-2 font-semibold">Sin resultados</p><p className="text-sm">Escanea un código o busca por nombre</p></div>
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {grid.map((p) => {
                  const stock = p.variants.filter((v) => v.active).reduce((s, v) => s + v.stock, 0);
                  const inCart = p.variants.reduce((s, v) => s + qtyOf(v.id), 0);
                  const multi = p.variants.filter((v) => v.active).length > 1;
                  return (
                    <motion.button
                      key={p.id}
                      layout
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => tapProduct(p)}
                      className={cn('group relative overflow-hidden rounded-[22px] bg-white text-left ring-1 transition', inCart ? 'ring-2 ring-blush-500' : 'ring-ink/5', stock === 0 && 'opacity-50')}
                    >
                      <div className="relative aspect-square overflow-hidden bg-blush-50">
                        <Thumb src={p.images[0]} className="h-full w-full" iconClassName="h-8 w-8" draggable={false} />
                        <AnimatePresence>
                          {inCart > 0 && (
                            <motion.span key={inCart} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-2 top-2 grid h-8 min-w-8 place-items-center rounded-full bg-blush-600 px-2 text-sm font-bold text-white shadow-lg">{inCart}</motion.span>
                          )}
                        </AnimatePresence>
                        {multi && <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold">{p.variants.filter((v) => v.active).length} opciones</span>}
                        {!p.active && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">Oculto en tienda</span>}
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight">{p.name}</p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="font-bold">{money(unitPrice(p, null, currency, rate), currency)}</span>
                          <span className={cn('text-[11px] font-semibold', stock === 0 ? 'text-red-600' : stock <= 3 ? 'text-amber-600' : 'text-ink/40')}>{stock === 0 ? 'Agotado' : `${stock} pzs`}</span>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </div>
        </main>

        {/* Ticket (iPad horizontal y escritorio) */}
        <aside className="hidden w-[380px] shrink-0 border-l border-ink/5 bg-white lg:flex xl:w-[420px]">{ticket}</aside>
      </div>

      {/* Barra inferior + ticket deslizable (iPad vertical y teléfono) */}
      <div className="lg:hidden">
        <AnimatePresence>
          {ticketOpen && (
            <>
              <motion.div className="fixed inset-0 z-40 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTicketOpen(false)} />
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] overflow-hidden rounded-t-[32px] bg-white shadow-2xl"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => info.offset.y > 120 && setTicketOpen(false)}
              >
                <span className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-ink/15" />
                {ticket}
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-2 rounded-full bg-ink p-2 pl-3 text-white shadow-2xl">
          <button type="button" onClick={() => setTicketOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="relative grid h-11 w-11 place-items-center rounded-full bg-white/10">
              <ShoppingBag className="h-5 w-5" />
              {sum.items > 0 && <motion.span key={sum.items} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blush-400 px-1 text-[11px] font-bold text-ink">{sum.items}</motion.span>}
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-white/60">Ticket <ChevronUp className="inline h-3 w-3" /></span>
              <span className="block text-lg font-bold tabular">{money(sum.total, currency)}</span>
            </span>
          </button>
          <button type="button" disabled={!lines.length} onClick={() => setDialog('pay')} className="pbtn h-12! bg-blush-400 px-7! text-base text-ink hover:bg-blush-300">Cobrar</button>
        </motion.div>
      </div>

      <VariantPicker product={picking} currency={currency} rate={rate} inCart={qtyOf} onClose={() => setPicking(null)} onPick={(v) => { addVariant(picking!, v); setPicking(null); }} />
      <CameraScanner open={dialog === 'scan'} onClose={() => setDialog(null)} onDetect={(code) => { addByCode(code); }} continuous title="Escanear productos" />
      <DiscountModal open={dialog === 'discount'} current={discount} subtotal={sum.subtotal} currency={currency} onApply={setDiscount} onClose={() => setDialog(null)} />
      <CustomerModal open={dialog === 'customer'} current={customer} onSave={setCustomer} onClose={() => setDialog(null)} />
      <ParkedModal open={dialog === 'parked'} parked={parked} onRestore={restore} onDrop={drop} onClose={() => setDialog(null)} />
      <RecentSheet open={dialog === 'recent'} sessionId={session?.id} onClose={() => setDialog(null)} />
      <PayModal
        open={dialog === 'pay'}
        total={sum.total}
        currency={currency}
        rate={rate}
        customerPhone={customer.phone}
        onPay={pay}
        onClose={() => setDialog(null)}
        onNewSale={() => { reset(); setDialog(null); setTimeout(() => searchRef.current?.focus(), 300); }}
      />
      <CashMoveModal session={session} kind={dialog === 'in' ? 'in' : dialog === 'out' ? 'out' : null} onClose={() => setDialog(null)} />
      <CloseCashModal
        session={session}
        open={dialog === 'close'}
        onClose={() => setDialog(null)}
        onClosed={() => { reset(); navigate('/panel/caja'); }}
      />
      {isDemo && <span className="pointer-events-none fixed bottom-24 left-3 z-20 rounded-full bg-amber-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider lg:bottom-3">Demo</span>}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger, className }: { icon: typeof Clock; label: string; onClick: () => void; danger?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition', danger ? 'text-red-600 hover:bg-red-50' : 'hover:bg-ink/[0.04]', className)}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ---------------------------------------------------------------------
// Ticket
// ---------------------------------------------------------------------
function Ticket({ lines, sum, currency, discount, customer, lastAdded, onQty, onDiscount, onCustomer, onPark, onClear, onPay }: {
  lines: ReturnType<typeof resolveCart>;
  sum: ReturnType<typeof totals>;
  currency: Currency;
  discount: Discount | null;
  customer: Customer;
  lastAdded: string | null;
  onQty: (variantId: string, qty: number) => void;
  onDiscount: () => void;
  onCustomer: () => void;
  onPark: () => void;
  onClear: () => void;
  onPay: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-variant="${lastAdded}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [lastAdded, sum.items]);

  return (
    <div className="flex min-h-0 w-full flex-col pt-3 lg:pt-0">
      <div className="flex items-center gap-2 border-b border-ink/5 px-4 py-3">
        <button type="button" onClick={onCustomer} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl p-1.5 text-left transition hover:bg-ink/[0.03]">
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', customer.name ? 'bg-blush-100 text-blush-700' : 'bg-ink/[0.05] text-ink/50')}><UserRound className="h-4 w-4" /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{customer.name || 'Agregar cliente'}</span>
            <span className="block truncate text-xs text-ink/45">{customer.phone || 'Opcional'}</span>
          </span>
        </button>
        <button type="button" onClick={onClear} disabled={!lines.length} className="grid h-10 w-10 place-items-center rounded-full text-ink/45 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label="Vaciar ticket"><Trash2 className="h-4 w-4" /></button>
      </div>

      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        <AnimatePresence initial={false}>
          {lines.map((l) => (
            <motion.li
              key={l.variantId}
              data-variant={l.variantId}
              layout
              initial={{ opacity: 0, x: 40, backgroundColor: palette.blush100 }}
              animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(255,255,255,0)' }}
              exit={{ opacity: 0, x: -40, height: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30, backgroundColor: { duration: 1.2 } }}
              className="overflow-hidden rounded-2xl"
            >
              <div className="flex items-center gap-3 px-1.5 py-2.5">
                <Thumb src={l.product.images[0]} className="h-12 w-12 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.product.name}</p>
                  <p className="truncate text-xs text-ink/50">{l.variant.name} · {money(l.unit, currency)}</p>
                  <p className="text-sm font-bold tabular">{money(l.total, currency)}</p>
                </div>
                <div className="flex items-center rounded-full bg-ink/[0.04] p-1">
                  <motion.button whileTap={{ scale: 0.85 }} type="button" onClick={() => onQty(l.variantId, l.qty - 1)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm" aria-label="Menos">
                    {l.qty === 1 ? <Trash2 className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4" />}
                  </motion.button>
                  <motion.span key={l.qty} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="w-9 text-center font-bold tabular">{l.qty}</motion.span>
                  <motion.button whileTap={{ scale: 0.85 }} type="button" onClick={() => onQty(l.variantId, l.qty + 1)} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white" aria-label="Más"><Plus className="h-4 w-4" /></motion.button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {lines.length === 0 && (
          <li className="flex h-full flex-col items-center justify-center py-16 text-center text-ink/45">
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="grid h-16 w-16 place-items-center rounded-3xl bg-blush-50 text-blush-500"><ScanBarcode className="h-7 w-7" /></motion.span>
            <p className="mt-3 font-semibold text-ink/70">Ticket vacío</p>
            <p className="text-sm">Escanea o toca un producto</p>
          </li>
        )}
      </ul>

      <div className="border-t border-ink/5 bg-[#fcf9f6] px-4 pb-4 pt-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-ink/55">Subtotal · {sum.items} pzs</span><span className="tabular">{money(sum.subtotal, currency)}</span></div>
          <button type="button" onClick={onDiscount} disabled={!lines.length} className="flex w-full items-center justify-between rounded-xl py-1 text-left disabled:opacity-40">
            <span className="flex items-center gap-1.5 font-semibold text-blush-700"><Percent className="h-3.5 w-3.5" /> {discount ? `Descuento${discount.kind === 'percent' ? ` ${discount.value}%` : ''}` : 'Agregar descuento'}</span>
            {discount && <span className="text-blush-700 tabular">-{money(sum.discount, currency)}</span>}
          </button>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <span className="text-sm font-semibold">Total</span>
          <motion.span key={sum.total} initial={{ scale: 1.08, color: palette.blush600 }} animate={{ scale: 1, color: palette.ink }} className="text-[34px] font-bold leading-none tracking-tight tabular">{money(sum.total, currency)}</motion.span>
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={onPark} disabled={!lines.length} className="pbtn-ghost h-16! px-4!" title="Apartar venta"><PauseCircle className="h-5 w-5" /><span className="hidden xl:inline">Apartar</span></button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={!lines.length}
            onClick={onPay}
            className="pbtn h-16! bg-[linear-gradient(120deg,var(--color-blush-500),var(--color-blush-700))] text-lg text-white shadow-[0_16px_30px_-14px_rgba(135,68,82,0.9)]"
          >
            Cobrar {lines.length > 0 && money(sum.total, currency)}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
