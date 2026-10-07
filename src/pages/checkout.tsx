import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Check, Landmark, Loader2, Store, Tag, Truck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '@/providers/cart';
import { useCurrency } from '@/providers/currency';
import { useAuth } from '@/providers/auth';
import { useSettings } from '@/hooks/queries';
import { createOrder, startMercadoPago, validateCoupon } from '@/lib/api';
import { mpRate, mpSurcharge } from '@/lib/fees';
import { fromMxn, money, toMxn } from '@/lib/format';
import type { DeliveryMethod, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';

type Method = Exclude<PaymentMethod, 'mixed'>;

export default function CheckoutPage() {
  const { lines, subtotal, linePrice, clear } = useCart();
  const { currency, rate, format } = useCurrency();
  const { profile } = useAuth();
  const { data: settings } = useSettings();
  const [, navigate] = useLocation();

  const [form, setForm] = useState({ name: '', phone: '', email: '', street: '', colony: '', city: '', state: '', zip: '', references: '', notes: '' });
  const [delivery, setDelivery] = useState<DeliveryMethod>('shipping');
  const [method, setMethod] = useState<Method>('transfer');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; kind: 'percent' | 'fixed'; value: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, name: f.name || profile.full_name || '', email: f.email || profile.email || '', phone: f.phone || profile.phone || '' }));
  }, [profile]);

  useEffect(() => {
    if (!settings) return;
    const enabled: Method[] = [];
    if (settings.transfer_enabled) enabled.push('transfer');
    if (settings.mercadopago_enabled) enabled.push('mercadopago');
    if (settings.cash_enabled) enabled.push('cash');
    if (!enabled.includes(method) && enabled[0]) setMethod(enabled[0]);
  }, [settings, method]);

  const subtotalMxn = toMxn(subtotal, currency, rate);
  const discount = coupon
    ? Math.min(coupon.kind === 'percent' ? Math.round(subtotal * coupon.value) / 100 : fromMxn(coupon.value, currency, rate), subtotal)
    : 0;
  const freeShipping = settings?.free_shipping_min_mxn != null && subtotalMxn >= settings.free_shipping_min_mxn;
  const shipping = delivery === 'shipping' && !freeShipping ? fromMxn(settings?.shipping_fee_mxn ?? 0, currency, rate) : 0;
  const base = Math.round((subtotal - discount + shipping) * 100) / 100;
  const mpOnlineRate = mpRate(settings, 'online', currency);
  const mpFee = mpOnlineRate ? mpSurcharge(base, mpOnlineRate) : 0;
  const fee = method === 'mercadopago' ? mpFee : 0;
  const total = base + fee;
  const feeFreeMethods = [settings?.transfer_enabled && 'transferencia', settings?.cash_enabled && 'efectivo'].filter(Boolean).join(' o ');

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const result = await validateCoupon(couponInput, subtotalMxn);
      if (!result.valid) {
        toast.error(result.message);
        return;
      }
      setCoupon(result);
      toast.success('¡Cupón aplicado! 🎉');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const order = await createOrder({
        channel: 'online',
        currency,
        items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.qty })),
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        customer_email: form.email.trim() || undefined,
        delivery_method: delivery,
        shipping_address: delivery === 'shipping'
          ? { street: form.street, colony: form.colony, city: form.city, state: form.state, zip: form.zip, references: form.references }
          : undefined,
        payment_method: method,
        coupon_code: coupon?.code,
        notes: form.notes.trim() || undefined,
      });
      clear();
      if (method === 'mercadopago') {
        try {
          window.location.href = await startMercadoPago(order.public_token);
          return;
        } catch (err) {
          toast.error((err as Error).message);
        }
      }
      navigate(`/pedido/${order.public_token}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream px-6 text-center">
        <div>
          <p className="display text-5xl">Tu bolsa está vacía</p>
          <Link href="/tienda" className="btn-dark mt-6">Ir a la tienda</Link>
        </div>
      </div>
    );
  }

  const methods: { value: Method; icon: typeof Landmark; title: string; text: string; enabled: boolean }[] = [
    { value: 'transfer', icon: Landmark, title: 'Transferencia', text: 'Te mostramos los datos al confirmar', enabled: !!settings?.transfer_enabled },
    { value: 'mercadopago', icon: Wallet, title: 'Mercado Pago', text: mpFee > 0 ? `Tarjeta o saldo · +${format(mpFee)} de comisión` : 'Tarjeta o saldo, cobro en MXN', enabled: !!settings?.mercadopago_enabled },
    { value: 'cash', icon: Banknote, title: 'Efectivo', text: delivery === 'pickup' ? 'Pagas al recoger' : 'Pagas al recibir', enabled: !!settings?.cash_enabled },
  ];

  return (
    <div className="min-h-screen bg-cream pb-24 pt-28">
      <form onSubmit={submit} className="page-wrap grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-8">
          <h1 className="display text-[clamp(3rem,7vw,5.5rem)]">Finalizar compra</h1>

          <Step n={1} title="Tus datos">
            <div className="grid gap-3 sm:grid-cols-2">
              <input required className="field sm:col-span-2" placeholder="Nombre completo" value={form.name} onChange={update('name')} autoComplete="name" />
              <input required className="field" placeholder="WhatsApp / teléfono" value={form.phone} onChange={update('phone')} type="tel" autoComplete="tel" />
              <input className="field" placeholder="Correo (opcional)" value={form.email} onChange={update('email')} type="email" autoComplete="email" />
            </div>
          </Step>

          <Step n={2} title="Entrega">
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard active={delivery === 'shipping'} onClick={() => setDelivery('shipping')} icon={Truck} title="Envío a domicilio" text={freeShipping ? '¡Gratis!' : format(fromMxn(settings?.shipping_fee_mxn ?? 0, currency, rate))} />
              <OptionCard active={delivery === 'pickup'} onClick={() => setDelivery('pickup')} icon={Store} title="Recoger" text="Sin costo" />
            </div>
            <AnimatePresence initial={false}>
              {delivery === 'shipping' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid gap-3 pt-3 sm:grid-cols-2">
                    <input required className="field sm:col-span-2" placeholder="Calle y número" value={form.street} onChange={update('street')} autoComplete="street-address" />
                    <input required className="field" placeholder="Colonia" value={form.colony} onChange={update('colony')} />
                    <input required className="field" placeholder="Código postal" value={form.zip} onChange={update('zip')} autoComplete="postal-code" />
                    <input required className="field" placeholder="Ciudad" value={form.city} onChange={update('city')} autoComplete="address-level2" />
                    <input required className="field" placeholder="Estado" value={form.state} onChange={update('state')} autoComplete="address-level1" />
                    <input className="field sm:col-span-2" placeholder="Referencias (opcional)" value={form.references} onChange={update('references')} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Step>

          <Step n={3} title="Pago">
            <div className="grid gap-3 sm:grid-cols-3">
              {methods.filter((m) => m.enabled).map((m) => (
                <OptionCard key={m.value} active={method === m.value} onClick={() => setMethod(m.value)} icon={m.icon} title={m.title} text={m.text} />
              ))}
            </div>
            <textarea className="field mt-3 min-h-20 resize-none" placeholder="Notas para tu pedido (opcional)" value={form.notes} onChange={update('notes')} />
          </Step>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[32px] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(20,16,20,0.3)]">
            <h2 className="text-lg font-semibold">Resumen</h2>
            <ul className="mt-4 flex max-h-72 flex-col gap-3 overflow-y-auto" data-lenis-prevent>
              {lines.map((l) => (
                <li key={l.variantId} className="flex items-center gap-3">
                  <div className="relative">
                    <img src={l.image ?? ''} alt="" className="h-16 w-14 rounded-xl object-cover" />
                    <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{l.qty}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.name}</p>
                    <p className="text-xs text-ink/50">{l.variantName}</p>
                  </div>
                  <p className="text-sm font-semibold">{format(linePrice(l) * l.qty)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex gap-2">
              <label className="relative flex-1">
                <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} disabled={!!coupon} placeholder="Cupón" className="field py-3 pl-10" />
              </label>
              {coupon ? (
                <button type="button" onClick={() => { setCoupon(null); setCouponInput(''); }} className="btn-outline py-3">Quitar</button>
              ) : (
                <button type="button" onClick={applyCoupon} className="btn-outline py-3">Aplicar</button>
              )}
            </div>

            <dl className="mt-5 space-y-2 border-t border-ink/5 pt-4 text-sm">
              <Row label="Subtotal" value={format(subtotal)} />
              {discount > 0 && <Row label={`Descuento (${coupon?.code})`} value={`-${format(discount)}`} accent />}
              <Row label="Envío" value={delivery === 'pickup' ? 'Recoger' : shipping === 0 ? 'Gratis' : format(shipping)} />
              <AnimatePresence initial={false}>
                {fee > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <Row label="Comisión Mercado Pago" value={format(fee)} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-baseline justify-between border-t border-ink/5 pt-3">
                <dt className="font-semibold">Total</dt>
                <motion.dd key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="text-2xl font-bold">{format(total)}</motion.dd>
              </div>
            </dl>
            {fee > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-ink/50">
                La comisión es lo que cobra Mercado Pago por procesar tu pago.
                {feeFreeMethods && ` Si pagas con ${feeFreeMethods} no se cobra.`}
              </p>
            )}
            {currency === 'USD' && method === 'mercadopago' && (
              <p className="mt-2 text-xs text-ink/50">Mercado Pago cobra en pesos: aprox. {money(toMxn(total, 'USD', rate), 'MXN')}</p>
            )}

            <motion.button type="submit" whileTap={{ scale: 0.97 }} disabled={submitting} className="btn-dark mt-6 w-full py-4 text-base">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : method === 'mercadopago' ? 'Pagar con Mercado Pago' : 'Confirmar pedido'}
            </motion.button>
            <p className="mt-3 text-center text-xs text-ink/45">Te confirmamos tu pedido por WhatsApp.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: n * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[32px] bg-white/60 p-5 sm:p-7"
    >
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-blush-300 text-sm">{n}</span>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function OptionCard({ active, onClick, icon: Icon, title, text }: { active: boolean; onClick: () => void; icon: typeof Truck; title: string; text: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={cn('relative flex items-start gap-3 rounded-3xl border-2 bg-white p-4 text-left transition-colors', active ? 'border-ink' : 'border-transparent hover:border-ink/15')}
    >
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition-colors', active ? 'bg-ink text-white' : 'bg-blush-100')}>
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-ink/55">{text}</span>
      </span>
      <AnimatePresence>
        {active && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-blush-500 text-white">
            <Check className="h-3 w-3" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink/60">{label}</dt>
      <dd className={cn('font-semibold', accent && 'text-blush-600')}>{value}</dd>
    </div>
  );
}
