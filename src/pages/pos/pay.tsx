import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Check, CreditCard, Landmark, Loader2, MessageCircle, Printer, Sparkles, X } from 'lucide-react';
import { useSettings } from '@/hooks/queries';
import { mpFeeOf, mpGross, mpRate } from '@/lib/fees';
import { money, paymentMethodLabel, whatsappLink } from '@/lib/format';
import { palette } from '@/lib/palette';
import { printReceipt, receiptText } from '@/lib/receipt';
import type { AdminOrder, Currency, PosPayment, SinglePaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Modal, NumberPad, Segmented } from '@/components/panel/kit';

export type DraftPayment = PosPayment & { currency: Currency };

const round2 = (n: number) => Math.round(n * 100) / 100;
const methodIcon = { cash: Banknote, transfer: Landmark, mercadopago: CreditCard } as const;

function quickBills(remaining: number, currency: Currency) {
  if (remaining <= 0) return [];
  const steps = currency === 'MXN' ? [10, 50, 100, 200, 500, 1000] : [5, 10, 20, 50, 100];
  const set = new Set<number>();
  for (const s of steps) {
    const v = Math.ceil(remaining / s) * s;
    if (v > remaining + 0.001) set.add(v);
  }
  return [...set].sort((a, b) => a - b).slice(0, 4);
}

export function PayModal({ open, total, currency, rate, customerPhone, onPay, onClose, onNewSale }: {
  open: boolean;
  total: number;
  currency: Currency;
  rate: number;
  customerPhone: string;
  onPay: (payments: DraftPayment[]) => Promise<AdminOrder>;
  onClose: () => void;
  onNewSale: () => void;
}) {
  const [done, setDone] = useState<AdminOrder | null>(null);
  return (
    <Modal
      open={open}
      onClose={done ? () => { setDone(null); onNewSale(); } : onClose}
      size="xl"
      dismissable={!done}
      title={done ? undefined : 'Cobrar'}
    >
      {open && (done
        ? <SuccessView order={done} phone={customerPhone} onNext={() => { setDone(null); onNewSale(); }} />
        : <PayForm total={total} currency={currency} rate={rate} onPay={onPay} onDone={setDone} />)}
    </Modal>
  );
}

function PayForm({ total, currency, rate, onPay, onDone }: {
  total: number;
  currency: Currency;
  rate: number;
  onPay: (payments: DraftPayment[]) => Promise<AdminOrder>;
  onDone: (o: AdminOrder) => void;
}) {
  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [method, setMethod] = useState<SinglePaymentMethod>('cash');
  const [cashCurrency, setCashCurrency] = useState<Currency>(currency);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: settings } = useSettings();

  const toSale = (n: number, from: Currency) => (from === currency ? n : currency === 'MXN' ? n * rate : n / rate);
  const fromSale = (n: number, to: Currency) => (to === currency ? n : to === 'MXN' ? n * rate : n / rate);
  // Con terminal la clienta paga la comisión: cada cobro abona a la venta lo que queda después de ella.
  const feeOf = (p: { method: SinglePaymentMethod; amount: number; currency: Currency }) => {
    const r = p.method === 'mercadopago' ? mpRate(settings, 'pos', p.currency) : null;
    return r ? mpFeeOf(p.amount, r) : 0;
  };

  const paid = round2(payments.reduce((s, p) => s + toSale(p.amount, p.currency), 0));
  const fees = round2(payments.reduce((s, p) => s + toSale(feeOf(p), p.currency), 0));
  const grandTotal = round2(total + fees);
  const remaining = round2(Math.max(grandTotal - paid, 0));
  const change = round2(Math.max(paid - grandTotal, 0));
  const complete = paid + 0.009 >= grandTotal;

  const payCurrency = method === 'cash' ? cashCurrency : currency;
  const remainingIn = round2(Math.ceil(fromSale(remaining, payCurrency) * 100) / 100);
  const mpPosRate = method === 'mercadopago' ? mpRate(settings, 'pos', payCurrency) : null;
  const maxIn = mpPosRate ? mpGross(remainingIn, mpPosRate) : remainingIn;
  const typed = Number(amount) || 0;
  const value = amount === '' ? maxIn : method === 'cash' ? typed : Math.min(typed, maxIn);
  const valueFee = mpPosRate ? mpFeeOf(value, mpPosRate) : 0;
  const bills = useMemo(() => quickBills(remainingIn, payCurrency), [remainingIn, payCurrency]);

  const add = (amt: number) => {
    if (!(amt > 0) || complete) return;
    setPayments((list) => [...list, { method, amount: round2(amt), currency: payCurrency, reference: reference.trim() || undefined }]);
    setAmount('');
    setReference('');
  };

  const finish = async () => {
    setBusy(true);
    try {
      onDone(await onPay(payments));
    } catch {
      // El error ya se muestra con toast desde quien cobra.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 pb-2 md:grid-cols-[1fr_1.15fr]">
      <div className="flex flex-col gap-3">
        <div className="rounded-3xl bg-[linear-gradient(140deg,var(--color-blush-400),var(--color-blush-600)_50%,#4e2531)] p-5 text-white">
          <p className="text-sm text-white/75">Total a cobrar</p>
          <p className="text-[44px] font-bold leading-none tracking-tight tabular">{money(grandTotal, currency)}</p>
          {fees > 0 && <p className="mt-2 text-xs text-white/80">Venta {money(total, currency)} + {money(fees, currency)} de comisión Mercado Pago</p>}
          {currency === 'MXN' && <p className="mt-1 text-xs text-white/70">≈ {money(grandTotal / rate, 'USD')} · TC {rate}</p>}
        </div>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {payments.map((p, i) => {
              const Icon = methodIcon[p.method];
              return (
                <motion.li key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blush-50 text-blush-700"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm">{paymentMethodLabel[p.method]}</b>
                    {feeOf(p) > 0 && <span className="block text-xs text-ink/50">Incluye {money(feeOf(p), p.currency)} de comisión</span>}
                    {p.reference && <span className="text-xs text-ink/50">Ref. {p.reference}</span>}
                  </span>
                  <b className="tabular">{money(p.amount, p.currency)}</b>
                  <button type="button" disabled={busy} onClick={() => setPayments((l) => l.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5" aria-label="Quitar pago"><X className="h-4 w-4" /></button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        <div className="mt-auto rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          <div className="flex justify-between text-sm"><span className="text-ink/55">Pagado</span><b className="tabular">{money(paid, currency)}</b></div>
          <AnimatePresence mode="wait">
            {complete ? (
              <motion.div key="change" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 flex items-end justify-between">
                <span className="font-semibold text-emerald-700">Cambio</span>
                <span className="text-4xl font-bold text-emerald-700 tabular">{money(change, currency)}</span>
              </motion.div>
            ) : (
              <motion.div key="left" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex items-end justify-between">
                <span className="font-semibold">Falta</span>
                <span className="text-4xl font-bold tabular">{money(remaining, currency)}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={!complete || busy}
          onClick={finish}
          className={cn('pbtn h-16! w-full text-lg', complete ? 'bg-emerald-600 text-white shadow-[0_14px_30px_-12px_rgba(5,150,105,0.8)] hover:bg-emerald-700' : 'bg-ink/10 text-ink/40')}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Finalizar venta
        </motion.button>
      </div>

      <div className={cn('space-y-3 transition', complete && 'pointer-events-none opacity-40')}>
        <div className="grid grid-cols-3 gap-2">
          {(['cash', 'transfer', 'mercadopago'] as SinglePaymentMethod[]).map((m) => {
            const Icon = methodIcon[m];
            return (
              <motion.button
                key={m}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => { setMethod(m); setAmount(''); setReference(''); }}
                className={cn('flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl text-sm font-semibold ring-1 transition', method === m ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10 hover:ring-ink/30')}
              >
                <Icon className="h-5 w-5" /> {paymentMethodLabel[m]}
              </motion.button>
            );
          })}
        </div>

        {method === 'cash' && (
          <Segmented
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
            value={cashCurrency}
            onChange={(c) => { setCashCurrency(c); setAmount(''); }}
            options={[{ value: 'MXN', label: 'Pesos' }, { value: 'USD', label: `Dólares (TC ${rate})` }]}
          />
        )}

        <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-ink/5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink/55">{method === 'cash' ? 'Recibido' : method === 'mercadopago' ? 'Cobrar en terminal' : 'Monto'}</span>
            <span className={cn('text-3xl font-bold tabular', amount === '' && 'text-ink/35')}>{money(value, payCurrency)}</span>
          </div>
          {valueFee > 0 && (
            <p className="mt-1 text-right text-xs text-ink/50">
              Incluye {money(valueFee, payCurrency)} de comisión · abona {money(round2(value - valueFee), payCurrency)} a la venta
            </p>
          )}
        </div>

        {method === 'cash' ? (
          <div className="grid grid-cols-5 gap-2">
            <button type="button" onClick={() => add(remainingIn)} className="col-span-1 h-14 rounded-2xl bg-blush-100 text-sm font-bold text-blush-800 transition hover:bg-blush-200">Exacto</button>
            {bills.map((b) => (
              <motion.button key={b} type="button" whileTap={{ scale: 0.92 }} onClick={() => add(b)} className="h-14 rounded-2xl bg-emerald-50 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100 transition hover:bg-emerald-100">
                {payCurrency === 'USD' ? `US$${b}` : `$${b}`}
              </motion.button>
            ))}
          </div>
        ) : (
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="pfield h-12!" placeholder={method === 'transfer' ? 'Referencia / últimos dígitos (opcional)' : 'Folio de operación (opcional)'} />
        )}

        <NumberPad value={amount} onChange={setAmount} />
        <button type="button" className="pbtn-primary h-14! w-full text-base" disabled={!(value > 0)} onClick={() => add(value)}>
          {method === 'cash' ? `Agregar ${money(value, payCurrency)} en efectivo` : `Registrar ${money(value, payCurrency)}`}
        </button>
      </div>
    </div>
  );
}

function SuccessView({ order, phone, onNext }: { order: AdminOrder; phone: string; onNext: () => void }) {
  const { data: settings } = useSettings();
  const [to, setTo] = useState(phone);
  const sparks = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="flex flex-col items-center px-2 pb-4 pt-6 text-center">
      <div className="relative">
        {sparks.map((i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full"
            style={{ background: i % 3 === 0 ? palette.blush400 : i % 3 === 1 ? palette.lilac500 : palette.sand300 }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ x: Math.cos((i / sparks.length) * Math.PI * 2) * 110, y: Math.sin((i / sparks.length) * Math.PI * 2) * 110, scale: [0, 1.4, 0], opacity: [1, 1, 0] }}
            transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          className="grid h-28 w-28 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_20px_50px_-15px_rgba(16,185,129,0.9)]"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        >
          <motion.svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25 }} />
          </motion.svg>
        </motion.div>
      </div>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-ink/55">
        <Sparkles className="h-4 w-4 text-blush-500" /> Venta #{order.folio} registrada
      </motion.p>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="text-3xl font-bold">{money(order.total, order.currency)}</motion.p>
      {!!order.change_given && order.change_given > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45, type: 'spring' }} className="mt-5 rounded-3xl bg-emerald-50 px-8 py-4 ring-1 ring-emerald-100">
          <p className="text-sm font-semibold text-emerald-700">Entrega de cambio</p>
          <p className="text-5xl font-bold text-emerald-700 tabular">{money(order.change_given, order.currency)}</p>
        </motion.div>
      )}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-7 w-full max-w-md space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="pbtn-ghost h-14!" onClick={() => printReceipt(order, settings)}><Printer className="h-4 w-4" /> Imprimir</button>
          <a
            className={cn('pbtn-ghost h-14!', !to.replace(/\D/g, '') && 'pointer-events-none opacity-45')}
            href={whatsappLink(to, receiptText(order, settings))}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
          </a>
        </div>
        <input value={to} onChange={(e) => setTo(e.target.value)} className="pfield h-12! text-center" placeholder="WhatsApp de la clienta para enviar el ticket" inputMode="tel" />
        <button type="button" autoFocus className="pbtn-pink h-16! w-full text-lg" onClick={onNext}>Nueva venta</button>
      </motion.div>
    </div>
  );
}
