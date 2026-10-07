import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, PauseCircle, Printer, Trash2 } from 'lucide-react';
import { useSettings } from '@/hooks/queries';
import { useOrders } from '@/hooks/admin-queries';
import { money, paymentMethodLabel, unitPrice } from '@/lib/format';
import { printReceipt } from '@/lib/receipt';
import type { AdminProduct, Currency, Variant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Empty, Field, Modal, NumberPad, Segmented, Sheet, StatusPill, Thumb } from '@/components/panel/kit';
import type { Customer, Discount, ParkedSale } from './state';

export function VariantPicker({ product, currency, rate, inCart, onPick, onClose }: {
  product: AdminProduct | null;
  currency: Currency;
  rate: number;
  inCart: (variantId: string) => number;
  onPick: (v: Variant) => void;
  onClose: () => void;
}) {
  const variants = product?.variants.filter((v) => v.active) ?? [];
  return (
    <Modal open={!!product} onClose={onClose} title={product?.name} size="lg">
      {product && (
        <div className="grid gap-5 pb-2 sm:grid-cols-[200px_1fr]">
          <Thumb src={product.images[0]} className="aspect-[4/5] w-full rounded-3xl" iconClassName="h-10 w-10" />
          <div className="grid content-start gap-2.5 sm:grid-cols-2">
            {variants.map((v, i) => {
              const left = v.stock - inCart(v.id);
              return (
                <motion.button
                  key={v.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={left <= 0}
                  onClick={() => onPick(v)}
                  className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-ink/10 transition hover:ring-blush-400 disabled:opacity-40"
                >
                  {v.color_hex && <span className="h-8 w-8 shrink-0 rounded-full ring-2 ring-white shadow" style={{ background: v.color_hex }} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{v.name}</span>
                    <span className="text-xs text-ink/50">{money(unitPrice(product, v, currency, rate), currency)}</span>
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', left <= 0 ? 'bg-red-50 text-red-600' : left <= v.low_stock_threshold ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                    {left <= 0 ? 'Agotado' : `${left}`}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function DiscountModal({ open, current, subtotal, currency, onApply, onClose }: {
  open: boolean;
  current: Discount | null;
  subtotal: number;
  currency: Currency;
  onApply: (d: Discount | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Descuento" size="md">
      {open && <DiscountForm current={current} subtotal={subtotal} currency={currency} onApply={(d) => { onApply(d); onClose(); }} />}
    </Modal>
  );
}

function DiscountForm({ current, subtotal, currency, onApply }: { current: Discount | null; subtotal: number; currency: Currency; onApply: (d: Discount | null) => void }) {
  const [kind, setKind] = useState<Discount['kind']>(current?.kind ?? 'percent');
  const [value, setValue] = useState(current ? String(current.value) : '');
  const n = Number(value) || 0;
  const amount = kind === 'percent' ? (subtotal * Math.min(n, 100)) / 100 : Math.min(n, subtotal);
  return (
    <div className="space-y-4 pb-2">
      <Segmented size="lg" className="w-full [&>button]:flex-1 [&>button]:justify-center" value={kind} onChange={(k) => { setKind(k); setValue(''); }} options={[{ value: 'percent', label: 'Porcentaje %' }, { value: 'amount', label: `Monto ${currency}` }]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl bg-ink p-4 text-white">
            <p className="text-xs text-white/60">Descuento</p>
            <p className="text-3xl font-bold tabular">{kind === 'percent' ? `${value || 0}%` : money(n, currency)}</p>
            <p className="mt-1 text-sm text-blush-300">-{money(amount, currency)} · queda en {money(subtotal - amount, currency)}</p>
          </div>
          {kind === 'percent' && (
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((p) => (
                <button key={p} type="button" onClick={() => setValue(String(p))} className={cn('h-12 rounded-2xl font-bold transition', value === String(p) ? 'bg-blush-600 text-white' : 'bg-white ring-1 ring-ink/10')}>{p}%</button>
              ))}
            </div>
          )}
        </div>
        <NumberPad value={value} onChange={(v) => setValue(kind === 'percent' && Number(v) > 100 ? '100' : v)} />
      </div>
      <div className="flex gap-2">
        {current && <button type="button" className="pbtn-danger h-14!" onClick={() => onApply(null)}><Trash2 className="h-4 w-4" /> Quitar</button>}
        <button type="button" className="pbtn-pink h-14! flex-1 text-base" disabled={!(n > 0)} onClick={() => onApply({ kind, value: n })}>Aplicar descuento</button>
      </div>
    </div>
  );
}

export function CustomerModal({ open, current, onSave, onClose }: { open: boolean; current: Customer; onSave: (c: Customer) => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Cliente (opcional)" size="sm">
      {open && <CustomerForm current={current} onSave={(c) => { onSave(c); onClose(); }} />}
    </Modal>
  );
}

function CustomerForm({ current, onSave }: { current: Customer; onSave: (c: Customer) => void }) {
  const [c, setC] = useState(current);
  return (
    <div className="space-y-4 pb-2">
      <Field label="Nombre"><input autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className="pfield h-12!" placeholder="Para el ticket" /></Field>
      <Field label="WhatsApp" hint="Para enviarle su ticket"><input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} className="pfield h-12!" inputMode="tel" placeholder="+52 …" /></Field>
      <div className="flex gap-2">
        <button type="button" className="pbtn-ghost h-12!" onClick={() => onSave({ name: '', phone: '' })}>Sin cliente</button>
        <button type="button" className="pbtn-primary h-12! flex-1" onClick={() => onSave({ name: c.name.trim(), phone: c.phone.trim() })}>Guardar</button>
      </div>
    </div>
  );
}

export function ParkedModal({ open, parked, onRestore, onDrop, onClose }: {
  open: boolean;
  parked: ParkedSale[];
  onRestore: (id: string) => void;
  onDrop: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Ventas en espera" size="md">
      {parked.length === 0 ? <Empty icon={PauseCircle} title="Nada en espera" text="Usa «Apartar» para guardar una venta y atender a otra clienta." /> : (
        <ul className="space-y-2 pb-2">
          {parked.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock className="h-5 w-5" /></span>
              <button type="button" onClick={() => onRestore(p.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold">{p.customer.name || 'Sin nombre'}</p>
                <p className="text-xs text-ink/50">{new Date(p.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {p.cart.reduce((s, l) => s + l.qty, 0)} artículos</p>
              </button>
              <button type="button" onClick={() => onRestore(p.id)} className="pbtn-primary h-10!">Retomar</button>
              <button type="button" onClick={() => onDrop(p.id)} className="grid h-10 w-10 place-items-center rounded-full text-red-600 hover:bg-red-50" aria-label="Descartar"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function RecentSheet({ open, sessionId, onClose }: { open: boolean; sessionId: string | undefined; onClose: () => void }) {
  const { data: orders = [] } = useOrders({ cashSessionId: sessionId, limit: 50 }, open && !!sessionId);
  const { data: settings } = useSettings();
  return (
    <Sheet open={open} onClose={onClose} title="Ventas de este turno" subtitle={`${orders.filter((o) => o.status !== 'cancelled').length} ventas`}>
      {orders.length === 0 ? <Empty icon={Clock} title="Aún no hay ventas" /> : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">#{o.folio} <span className="font-normal text-ink/50">· {new Date(o.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span></p>
                <p className="truncate text-xs text-ink/50">{o.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}</p>
                <p className="text-xs text-ink/50">{paymentMethodLabel[o.payment_method]}{o.customer_name ? ` · ${o.customer_name}` : ''}</p>
              </div>
              {o.status === 'cancelled' && <StatusPill status={o.status} />}
              <b className="tabular">{money(o.total, o.currency)}</b>
              <button type="button" onClick={() => printReceipt(o, settings)} className="grid h-10 w-10 place-items-center rounded-full bg-ink/[0.05] hover:bg-ink/10" aria-label="Reimprimir"><Printer className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
