import { useState } from 'react';
import { Link, useParams, useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Clock, Copy, Loader2, Wallet } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import { awaitingPayment, useOrderByToken, useSettings } from '@/hooks/queries';
import { startMercadoPago } from '@/lib/api';
import { money, orderStatusLabel, paymentMethodLabel, paymentStatusLabel, whatsappLink } from '@/lib/format';
import { Sparkle } from '@/components/brand/logo';
import type { OrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const timeline: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];

export default function OrderPage() {
  const { token = '' } = useParams<{ token: string }>();
  // Mercado Pago regresa con ?collection_status=approved|in_process|pending|rejected
  const query = new URLSearchParams(useSearch());
  const mpReturn = query.get('collection_status') ?? query.get('status');
  const [checkingSince] = useState(() => Date.now());
  const slow = Date.now() - checkingSince > 120_000;
  const { data: order, isLoading } = useOrderByToken(token, mpReturn === 'approved' && !slow);
  const { data: settings } = useSettings();
  const [paying, setPaying] = useState(false);

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-cream"><Loader2 className="h-10 w-10 animate-spin text-blush-500" /></div>;
  }
  if (!order) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream text-center">
        <div>
          <p className="display text-5xl">Pedido no encontrado</p>
          <Link href="/" className="btn-dark mt-6">Ir al inicio</Link>
        </div>
      </div>
    );
  }

  const fmt = (n: number) => money(n, order.currency);
  const paid = order.payment_status === 'paid';
  const owes = awaitingPayment(order);
  const confirming = owes && order.payment_method === 'mercadopago' && order.payment_status === 'pending' && mpReturn === 'approved';
  const inProcess = owes && order.payment_method === 'mercadopago' && order.payment_status === 'pending' && (mpReturn === 'in_process' || mpReturn === 'pending');
  const failed = owes && (order.payment_status === 'failed' || (mpReturn === 'rejected' && order.payment_status === 'pending'));
  const currentStep = order.status === 'completed' ? timeline.length - 1 : timeline.indexOf(order.status);
  const steps = order.delivery_method === 'pickup' ? timeline.filter((s) => s !== 'shipped') : timeline;
  const whatsappMsg = `¡Hola Shoppely! Mi pedido es el #${order.folio} por ${fmt(order.total)}.${order.payment_method === 'transfer' && !paid ? ' Te envío mi comprobante de transferencia.' : ''}`;

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success('Copiado');
  };

  const payWithMp = async () => {
    setPaying(true);
    try {
      window.location.href = await startMercadoPago(order.public_token);
    } catch (e) {
      toast.error((e as Error).message);
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream pb-24 pt-28">
      <div className="page-wrap max-w-3xl">
        <div className="relative text-center">
          <motion.div
            className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-blush-400"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          >
            <motion.span initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
              <Check className="h-12 w-12 text-ink" strokeWidth={3} />
            </motion.span>
          </motion.div>
          {[...Array(6)].map((_, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-12"
              initial={{ x: 0, y: 0, scale: 0 }}
              animate={{ x: Math.cos((i / 6) * Math.PI * 2) * 110, y: Math.sin((i / 6) * Math.PI * 2) * 70, scale: [0, 1.2, 0.8], rotate: 180 }}
              transition={{ delay: 0.3, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Sparkle className="h-5 w-5" />
            </motion.span>
          ))}
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="display mt-6 text-[clamp(2.6rem,6vw,4.5rem)]">
            ¡Gracias, {order.customer_name?.split(' ')[0]}!
          </motion.h1>
          <p className="mt-2 text-ink/60">Pedido <strong className="text-ink">#{order.folio}</strong> · {paymentStatusLabel[order.payment_status]}</p>
        </div>

        {order.status !== 'cancelled' ? (
          <div className="mt-10 rounded-[32px] bg-white p-6">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => {
                const done = timeline.indexOf(s) <= currentStep;
                return (
                  <div key={s} className="flex flex-1 flex-col items-center gap-2 text-center">
                    <div className="relative flex w-full items-center">
                      {i > 0 && <div className={cn('h-1 flex-1 rounded-full', done ? 'bg-blush-500' : 'bg-ink/10')} />}
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.12 }}
                        className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold', done ? 'bg-blush-500 text-white' : 'bg-ink/10 text-ink/40')}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </motion.span>
                      {i < steps.length - 1 && <div className={cn('h-1 flex-1 rounded-full', timeline.indexOf(steps[i + 1]) <= currentStep ? 'bg-blush-500' : 'bg-ink/10')} />}
                    </div>
                    <span className="text-[11px] font-semibold text-ink/60">{orderStatusLabel[s]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-10 rounded-3xl bg-ink p-5 text-center font-semibold text-white">Este pedido fue cancelado</p>
        )}

        {owes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn('mt-6 flex items-start gap-4 rounded-[28px] p-5', failed ? 'bg-berry-500 text-white' : 'bg-ink text-white')}
          >
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', failed ? 'bg-white/20' : 'bg-blush-400 text-ink')}>
              {confirming && !slow ? <Loader2 className="h-5 w-5 animate-spin" /> : failed ? <AlertCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </span>
            <div>
              <p className="font-semibold">
                {confirming ? (slow ? 'Mercado Pago aún no nos confirma tu pago' : 'Estamos confirmando tu pago con Mercado Pago…')
                  : failed ? 'Tu pago no se completó'
                  : inProcess ? 'Tu pago está en proceso'
                  : 'Falta tu pago'}
              </p>
              <p className="mt-0.5 text-sm text-white/70">
                {confirming ? (slow
                  ? 'Si ya se hizo el cargo, no vuelvas a pagar: escríbenos por WhatsApp con tu número de pedido y lo revisamos.'
                  : 'Tarda unos segundos. Esta página se actualiza sola.')
                  : failed ? 'No se hizo ningún cargo. Puedes intentarlo otra vez, con otra tarjeta si lo prefieres.'
                  : inProcess ? 'Mercado Pago nos avisará en cuanto se acredite y lo verás aquí y en tu perfil.'
                  : order.payment_method === 'transfer'
                    ? `Apartamos tu pedido. Transfiere ${fmt(order.total)} y envíanos tu comprobante por WhatsApp para prepararlo.`
                    : `Apartamos tu pedido. Paga ${fmt(order.total)} con Mercado Pago para que lo preparemos.`}
              </p>
            </div>
          </motion.div>
        )}

        {!paid && order.status !== 'cancelled' && order.payment_method === 'transfer' && settings && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6 rounded-[32px] bg-blush-300 p-6">
            <p className="text-lg font-semibold">Datos para transferencia</p>
            <div className="mt-4 grid gap-2 text-sm">
              {settings.bank_name && <BankRow label="Banco" value={settings.bank_name} />}
              {settings.bank_account_holder && <BankRow label="Titular" value={settings.bank_account_holder} />}
              {settings.bank_clabe && <BankRow label="CLABE" value={settings.bank_clabe} onCopy={copy} />}
              {settings.bank_account_number && <BankRow label="Cuenta" value={settings.bank_account_number} onCopy={copy} />}
              <BankRow label="Monto" value={fmt(order.total)} />
              <BankRow label="Concepto" value={`Pedido ${order.folio}`} onCopy={copy} />
            </div>
            {settings.transfer_instructions && <p className="mt-4 text-sm text-ink/70">{settings.transfer_instructions}</p>}
          </motion.div>
        )}

        {!paid && !confirming && !inProcess && order.status !== 'cancelled' && order.payment_method === 'mercadopago' && (
          <button type="button" onClick={payWithMp} disabled={paying} className="btn-dark mt-4 w-full py-4 text-base">
            {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Wallet className="h-5 w-5" /> {failed ? 'Intentar pagar de nuevo' : 'Pagar con Mercado Pago'}</>}
          </button>
        )}

        {!paid && order.payment_method === 'cash' && order.status !== 'cancelled' && (
          <p className="mt-6 rounded-3xl bg-white p-5 text-sm text-ink/70">
            Pagarás {fmt(order.total)} en efectivo {order.delivery_method === 'pickup' ? 'al recoger tu pedido' : 'al recibirlo'}. Te contactaremos por WhatsApp para coordinar.
          </p>
        )}

        {settings?.whatsapp && (
          <a href={whatsappLink(settings.whatsapp, whatsappMsg)} target="_blank" rel="noreferrer" className="btn mt-4 w-full bg-[#25D366] py-4 text-base text-white hover:bg-[#1eb855]">
            <FaWhatsapp className="h-5 w-5" /> {order.payment_method === 'transfer' && !paid ? 'Enviar comprobante por WhatsApp' : 'Escribir por WhatsApp'}
          </a>
        )}

        <div className="mt-6 rounded-[32px] bg-white p-6">
          <ul className="flex flex-col gap-3">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                {item.image_url && <img src={item.image_url} alt="" className="h-16 w-14 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.product_name}</p>
                  <p className="text-xs text-ink/50">{item.variant_name} · x{item.quantity}</p>
                </div>
                <p className="font-semibold">{fmt(item.line_total)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-ink/5 pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd>{fmt(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between"><dt className="text-ink/60">Descuento</dt><dd className="text-blush-600">-{fmt(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink/60">Envío</dt><dd>{order.shipping ? fmt(order.shipping) : order.delivery_method === 'pickup' ? 'Recoger' : 'Gratis'}</dd></div>
            {order.payment_fee > 0 && <div className="flex justify-between"><dt className="text-ink/60">Comisión Mercado Pago</dt><dd>{fmt(order.payment_fee)}</dd></div>}
            <div className="flex justify-between pt-2 text-lg font-bold"><dt>Total</dt><dd>{fmt(order.total)}</dd></div>
            <div className="flex justify-between text-xs text-ink/50"><dt>Método de pago</dt><dd>{paymentMethodLabel[order.payment_method]}</dd></div>
          </dl>
        </div>

        <div className="mt-8 text-center">
          <Link href="/tienda" className="btn-outline">Seguir comprando</Link>
        </div>
      </div>
    </div>
  );
}

function BankRow({ label, value, onCopy }: { label: string; value: string; onCopy?: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3">
      <span className="text-ink/60">{label}</span>
      <span className="flex items-center gap-2 font-semibold">
        {value}
        {onCopy && (
          <button type="button" onClick={() => onCopy(value)} className="rounded-full p-1 hover:bg-blush-100" aria-label={`Copiar ${label}`}>
            <Copy className="h-4 w-4" />
          </button>
        )}
      </span>
    </div>
  );
}
