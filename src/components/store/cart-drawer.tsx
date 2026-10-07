import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, ShoppingBag, Trash2, Truck, X } from 'lucide-react';
import { useCart } from '@/providers/cart';
import { useCurrency } from '@/providers/currency';
import { useSettings } from '@/hooks/queries';
import { toMxn } from '@/lib/format';
import { lockScroll } from '@/lib/smooth-scroll';

export function CartDrawer() {
  const { lines, isOpen, close, subtotal, setQty, remove, linePrice } = useCart();
  const { format, currency, rate } = useCurrency();
  const { data: settings } = useSettings();
  const [location] = useLocation();

  useEffect(() => {
    close();
  }, [location]);

  useEffect(() => {
    if (!isOpen) return;
    lockScroll(true);
    return () => lockScroll(false);
  }, [isOpen]);

  const freeMin = settings?.free_shipping_min_mxn ?? null;
  const subtotalMxn = toMxn(subtotal, currency, rate);
  const progress = freeMin ? Math.min(subtotalMxn / freeMin, 1) : 1;
  const missing = freeMin ? Math.max(freeMin - subtotalMxn, 0) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-md flex-col bg-cream sm:inset-y-3 sm:right-3 sm:rounded-[32px]"
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
            aria-label="Carrito"
          >
            <div className="flex items-center justify-between px-6 pb-4 pt-6">
              <h2 className="display text-3xl">Tu bolsa</h2>
              <button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-white" aria-label="Cerrar carrito">
                <X className="h-5 w-5" />
              </button>
            </div>

            {freeMin !== null && lines.length > 0 && (
              <div className="mx-6 mb-2 rounded-2xl bg-blush-100 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <Truck className="h-4 w-4" />
                  {missing > 0 ? `Te faltan ${format(currency === 'MXN' ? missing : missing / rate)} para envío gratis` : '¡Tienes envío gratis!'}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <motion.div className="h-full rounded-full bg-blush-500" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-2" data-lenis-prevent>
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <motion.div initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} className="grid h-24 w-24 place-items-center rounded-full bg-blush-100">
                    <ShoppingBag className="h-10 w-10 text-blush-600" />
                  </motion.div>
                  <p className="mt-5 text-lg font-semibold">Tu bolsa está vacía</p>
                  <p className="mt-1 text-sm text-ink/55">Descubre lo nuevo y llénala de cosas bonitas.</p>
                  <Link href="/tienda" onClick={close} className="btn-dark mt-6">Ir a la tienda</Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {lines.map((line) => (
                      <motion.li
                        key={line.variantId}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 80, height: 0, marginBottom: -12 }}
                        className="flex gap-4 rounded-3xl bg-white p-3"
                      >
                        <img src={line.image ?? '/images/product-stilllife.jpg'} alt="" className="h-24 w-20 rounded-2xl object-cover" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{line.name}</p>
                              <p className="text-xs text-ink/50">{line.variantName}</p>
                            </div>
                            <button type="button" onClick={() => remove(line.variantId)} className="p-1 text-ink/40 hover:text-blush-600" aria-label="Quitar">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center rounded-full bg-blush-50">
                              <button type="button" onClick={() => setQty(line.variantId, line.qty - 1)} className="grid h-9 w-9 place-items-center" aria-label="Menos"><Minus className="h-3.5 w-3.5" /></button>
                              <motion.span key={line.qty} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-6 text-center text-sm font-bold">{line.qty}</motion.span>
                              <button type="button" onClick={() => setQty(line.variantId, line.qty + 1)} disabled={line.qty >= line.stock} className="grid h-9 w-9 place-items-center disabled:opacity-30" aria-label="Más"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                            <p className="font-bold">{format(linePrice(line) * line.qty)}</p>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-ink/5 px-6 pb-6 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink/60">Subtotal</span>
                  <span className="text-xl font-bold">{format(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-ink/45">Envío y cupones se calculan al pagar.</p>
                <Link href="/checkout" onClick={close} className="btn-dark mt-4 w-full py-4 text-base">
                  Pagar ahora
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
