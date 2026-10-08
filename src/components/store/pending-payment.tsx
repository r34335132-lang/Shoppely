import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Clock, Landmark, Loader2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePendingPayments } from '@/hooks/queries';
import { startMercadoPago } from '@/lib/api';
import { money } from '@/lib/format';
import type { OrderSummary } from '@/lib/types';

const DISMISSED_KEY = 'shoppely-pay-reminder-dismissed';

function readDismissed(): string[] {
  try { return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]'); } catch { return []; }
}

/** Botón para pagar un pedido pendiente: Mercado Pago abre el cobro, transferencia lleva a los datos bancarios. */
export function PayNowButton({ order, className, onClick }: { order: Pick<OrderSummary, 'public_token' | 'payment_method'>; className?: string; onClick?: () => void }) {
  const [busy, setBusy] = useState(false);
  if (order.payment_method !== 'mercadopago') {
    return (
      <Link href={`/pedido/${order.public_token}`} onClick={onClick} className={className}>
        <Landmark className="h-4 w-4" /> Ver datos para pagar
      </Link>
    );
  }
  const pay = async () => {
    onClick?.();
    setBusy(true);
    try {
      window.location.href = await startMercadoPago(order.public_token);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={pay} disabled={busy} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Pagar ahora
    </button>
  );
}

export const pendingTitle = (o: Pick<OrderSummary, 'payment_status' | 'folio'>) =>
  o.payment_status === 'failed' ? `Tu pago del pedido #${o.folio} no se completó` : `Falta el pago de tu pedido #${o.folio}`;

/**
 * Recordatorio flotante en la tienda mientras la clienta tenga un pedido sin pagar.
 * Si lo cierra, vuelve a aparecer en su siguiente visita.
 */
export function PendingPaymentReminder({ ready }: { ready: boolean }) {
  const pending = usePendingPayments();
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);

  const hiddenHere = location === '/checkout' || location === '/cuenta';
  const visible = pending.filter((o) => !dismissed.includes(o.id) && location !== `/pedido/${o.public_token}`);
  const order = !hiddenHere && ready ? visible[0] : undefined;
  const others = pending.length - 1;

  const dismiss = () => {
    const next = [...dismissed, ...pending.map((o) => o.id)];
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    setDismissed(next);
  };

  return (
    <AnimatePresence>
      {order && (
        <motion.div
          key={order.id}
          role="status"
          className="fixed bottom-4 left-3 right-20 z-40 sm:left-5 sm:right-auto sm:w-[380px]"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.6 }}
        >
          <div className="relative rounded-[26px] bg-ink p-4 pr-11 text-white shadow-[0_24px_60px_-20px_rgba(31,21,25,0.7)]">
            <button type="button" onClick={dismiss} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cerrar recordatorio">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <motion.span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blush-400 text-ink"
                animate={{ rotate: [0, -10, 10, -6, 0] }}
                transition={{ duration: 0.8, delay: 1.2, repeat: Infinity, repeatDelay: 6 }}
              >
                {order.payment_status === 'failed' ? <AlertCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </motion.span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">{pendingTitle(order)}</p>
                <p className="mt-0.5 text-xs text-white/60">
                  {money(order.total, order.currency)} · lo confirmamos en cuanto recibamos tu pago
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PayNowButton order={order} className="btn-pink py-2.5!" />
              {others > 0 && (
                <Link href="/cuenta" className="px-2 text-xs font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline">
                  +{others} {others === 1 ? 'pedido' : 'pedidos'} más
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
