import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ban, Check, ClipboardList, CreditCard, MapPin, MessageCircle, Printer, Receipt, ShoppingBag, Store, Truck, User,
} from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { useSettings } from '@/hooks/queries';
import { useAction, useBadges, useOrder, useOrders } from '@/hooks/admin-queries';
import { cancelOrder, confirmPayment, saveOrderNotes, setOrderStatus, type OrderFilters } from '@/lib/admin-api';
import { money, orderStatusLabel, paymentMethodLabel, whatsappLink } from '@/lib/format';
import { printReceipt, receiptText } from '@/lib/receipt';
import type { AdminOrder, OrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Card, Empty, PageHeader, PaymentPill, Pill, SearchInput, Segmented, Sheet, SkeletonRows, StatusPill, Thumb, useConfirm,
} from '@/components/panel/kit';

type Period = 'all' | 'today' | '7d' | '30d';
type StatusFilter = NonNullable<OrderFilters['status']>;

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Por atender' },
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Recibidos' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'preparing', label: 'En preparación' },
  { value: 'shipped', label: 'Enviados' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
];

function periodRange(p: Period) {
  if (p === 'all') return {};
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = p === 'today' ? 0 : p === '7d' ? 6 : 29;
  return { from: new Date(start.getTime() - days * 86_400_000) };
}

const shortDate = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const { data: badges } = useBadges();
  const status = (params.get('estado') as StatusFilter | null) ?? 'all';
  const payment = (params.get('pago') as OrderFilters['payment'] | null) ?? 'all';
  const channel = (params.get('canal') as OrderFilters['channel'] | null) ?? 'all';
  const selected = params.get('id');
  const [period, setPeriod] = useState<Period>('30d');
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);

  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null || value === 'all') next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: key !== 'id' });

  const range = useMemo(() => periodRange(period), [period]);
  const { data: orders, isLoading } = useOrders({ status, payment, channel, search: deferred, ...range, limit: 200 });
  const total = (orders ?? []).filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total_mxn, 0);

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Pedidos"
        subtitle="Pedidos en línea y ventas del punto de venta en un solo lugar."
        actions={
          <Segmented
            value={channel}
            onChange={(v) => setParam('canal', v)}
            options={[{ value: 'all', label: 'Todos' }, { value: 'online', label: 'En línea' }, { value: 'pos', label: 'Tienda' }]}
          />
        }
      />

      <Card className="p-3! sm:p-4!">
        <div className="flex flex-col gap-3">
          <Segmented
            value={status}
            onChange={(v) => setParam('estado', v)}
            options={statusOptions.map((o) => (o.value === 'open' ? { ...o, count: badges?.openOrders } : o))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Folio, nombre, teléfono o correo" className="min-w-[220px] flex-1" />
            <Segmented
              value={payment ?? 'all'}
              onChange={(v) => setParam('pago', v)}
              options={[{ value: 'all', label: 'Cualquier pago' }, { value: 'pending', label: 'Por pagar', count: badges?.unpaidOrders }, { value: 'paid', label: 'Pagados' }]}
            />
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[{ value: 'today', label: 'Hoy' }, { value: '7d', label: '7 días' }, { value: '30d', label: '30 días' }, { value: 'all', label: 'Todo' }]}
            />
          </div>
        </div>
      </Card>

      <div className="mt-4 flex items-center justify-between px-1 text-sm text-ink/55">
        <span>{orders?.length ?? 0} pedidos</span>
        <span>Total <b className="text-ink">{money(total)}</b></span>
      </div>

      <Card className="mt-2 p-2! sm:p-3!" delay={0.05}>
        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : !orders?.length ? (
          <Empty icon={ClipboardList} title="No hay pedidos" text="Prueba con otros filtros o periodo." />
        ) : (
          <ul>
            <li className="hidden grid-cols-[88px_1.5fr_1fr_130px_130px_130px] gap-3 px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40 lg:grid">
              <span>Folio</span><span>Cliente</span><span>Artículos</span><span>Estado</span><span>Pago</span><span className="text-right">Total</span>
            </li>
            {orders.map((o, i) => (
              <motion.li key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}>
                <button
                  type="button"
                  onClick={() => setParam('id', o.id)}
                  className={cn(
                    'grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-2xl px-3 py-3 text-left transition hover:bg-blush-50/70 lg:grid-cols-[88px_1.5fr_1fr_130px_130px_130px]',
                    selected === o.id && 'bg-blush-50',
                  )}
                >
                  <span className="hidden lg:block">
                    <b className="block text-sm">#{o.folio}</b>
                    <span className="text-[11px] text-ink/45">{shortDate(o.created_at)}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', o.channel === 'pos' ? 'bg-ink text-white' : 'bg-blush-100 text-blush-700')}>
                      {o.channel === 'pos' ? <Store className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        <span className="lg:hidden">#{o.folio} · </span>{o.customer_name ?? (o.channel === 'pos' ? 'Venta en tienda' : 'Cliente')}
                      </span>
                      <span className="block truncate text-xs text-ink/50">
                        <span className="lg:hidden">{shortDate(o.created_at)} · </span>
                        {o.channel === 'pos' ? `POS · ${o.cashier_name ?? 'Caja'}` : o.delivery_method === 'pickup' ? 'Recoge en tienda' : 'Envío a domicilio'}
                      </span>
                    </span>
                  </span>
                  <span className="hidden items-center -space-x-2 lg:flex">
                    {o.items.slice(0, 3).map((it) => (
                      it.image_url
                        ? <img key={it.id} src={it.image_url} alt="" className="h-8 w-8 rounded-lg object-cover ring-2 ring-white" />
                        : <span key={it.id} className="h-8 w-8 rounded-lg bg-blush-100 ring-2 ring-white" />
                    ))}
                    <span className="pl-4 text-xs text-ink/50">{o.items.reduce((s, it) => s + it.quantity, 0)} pzs</span>
                  </span>
                  <span className="col-start-1 row-start-2 flex gap-1.5 lg:col-start-auto lg:row-start-auto lg:block"><StatusPill status={o.status} /><span className="lg:hidden"><PaymentPill status={o.payment_status} /></span></span>
                  <span className="hidden lg:block"><PaymentPill status={o.payment_status} /></span>
                  <span className="col-start-2 row-span-2 row-start-1 text-right lg:col-start-auto lg:row-span-1 lg:row-start-auto">
                    <b className="block text-sm tabular">{money(o.total, o.currency)}</b>
                    <span className="text-[11px] text-ink/45">{paymentMethodLabel[o.payment_method]}</span>
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>

      <OrderSheet id={selected} onClose={() => setParam('id', null)} />
    </>
  );
}

// ---------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------
function flowFor(order: AdminOrder): OrderStatus[] {
  if (order.channel === 'pos') return ['completed'];
  return order.delivery_method === 'pickup'
    ? ['pending', 'confirmed', 'preparing', 'delivered', 'completed']
    : ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed'];
}

function OrderSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: order, isLoading } = useOrder(id);
  return (
    <Sheet
      open={!!id}
      onClose={onClose}
      wide
      title={order ? `Pedido #${order.folio}` : 'Pedido'}
      subtitle={order ? `${shortDate(order.created_at)} · ${order.channel === 'pos' ? 'Punto de venta' : 'Tienda en línea'}` : undefined}
    >
      {isLoading || !order ? <SkeletonRows rows={6} /> : <OrderDetail key={order.id} order={order} />}
    </Sheet>
  );
}

function OrderDetail({ order }: { order: AdminOrder }) {
  const { role } = useAuth();
  const { data: settings } = useSettings();
  const confirm = useConfirm();
  const [notes, setNotes] = useState(order.internal_notes ?? '');
  const statusAction = useAction((a: { status: OrderStatus }) => setOrderStatus(order.id, a.status), (_, a) => `Pedido marcado como «${orderStatusLabel[a.status]}»`);
  const payAction = useAction((ref: string) => confirmPayment(order.id, undefined, ref || undefined), 'Pago confirmado');
  const cancelAction = useAction((reason: string) => cancelOrder(order.id, reason), 'Pedido cancelado y stock devuelto');
  const notesAction = useAction(() => saveOrderNotes(order.id, notes), 'Notas guardadas');

  const cancelled = order.status === 'cancelled';
  const flow = flowFor(order);
  const current = flow.indexOf(order.status);
  const m = (n: number) => money(n, order.currency);
  const cost = order.items.reduce((s, i) => s + (i.unit_cost_mxn ?? 0) * i.quantity, 0);
  const hasCost = role === 'admin' && order.items.some((i) => i.unit_cost_mxn != null);
  const address = order.shipping_address;

  const askPayment = async () => {
    const ref = await confirm({
      title: 'Confirmar pago',
      text: `Confirma que recibiste ${m(order.total)} por ${paymentMethodLabel[order.payment_method]}.`,
      confirmLabel: 'Sí, ya pagó',
      input: order.payment_method === 'cash' ? undefined : { label: 'Referencia o folio (opcional)', placeholder: 'Ej. 4821930' },
    });
    if (ref !== false) payAction.mutate(ref);
  };

  const askCancel = async () => {
    const reason = await confirm({
      title: `¿Cancelar el pedido #${order.folio}?`,
      text: 'El stock regresa al inventario y, si estaba pagado, quedará como reembolsado.',
      confirmLabel: 'Cancelar pedido',
      danger: true,
      input: { label: 'Motivo', placeholder: 'Ej. La clienta ya no lo quiere', required: true },
    });
    if (reason !== false) cancelAction.mutate(reason);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={order.status} />
        <PaymentPill status={order.payment_status} />
        <Pill tone={order.channel === 'pos' ? 'ink' : 'pink'}>{order.channel === 'pos' ? 'Punto de venta' : 'En línea'}</Pill>
        {order.currency === 'USD' && <Pill tone="blue">USD</Pill>}
      </div>

      {order.channel === 'online' && !cancelled && (
        <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          <p className="plabel">Avance del pedido</p>
          <div className="mt-2 flex items-start">
            {flow.map((s, i) => {
              const done = i <= current;
              return (
                <div key={s} className="flex flex-1 flex-col items-center gap-2 text-center">
                  <div className="flex w-full items-center">
                    <span className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : done ? 'bg-blush-600' : 'bg-ink/10')} />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      disabled={statusAction.isPending || i === current}
                      onClick={() => statusAction.mutate({ status: s })}
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold transition',
                        done ? 'bg-blush-600 text-white shadow-[0_6px_16px_-6px_rgba(169,92,106,0.8)]' : 'bg-ink/[0.06] text-ink/50 hover:bg-blush-100',
                      )}
                      aria-label={orderStatusLabel[s]}
                    >
                      {i < current ? <Check className="h-4 w-4" /> : i + 1}
                    </motion.button>
                    <span className={cn('h-0.5 flex-1', i === flow.length - 1 ? 'opacity-0' : i < current ? 'bg-blush-600' : 'bg-ink/10')} />
                  </div>
                  <span className={cn('text-[11px] font-semibold leading-tight', done ? 'text-ink' : 'text-ink/45')}>{orderStatusLabel[s]}</span>
                </div>
              );
            })}
          </div>
          {current < flow.length - 1 && (
            <button type="button" className="pbtn-pink mt-4 w-full" disabled={statusAction.isPending} onClick={() => statusAction.mutate({ status: flow[current + 1] })}>
              Marcar como «{orderStatusLabel[flow[current + 1]]}»
            </button>
          )}
        </section>
      )}

      {!cancelled && order.payment_status === 'pending' && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200/60">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-800"><CreditCard className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Pago pendiente · {paymentMethodLabel[order.payment_method]}</p>
            <p className="text-sm text-ink/60">Confírmalo cuando veas el dinero en la cuenta o en caja.</p>
          </div>
          <button type="button" className="pbtn-primary" onClick={askPayment} disabled={payAction.isPending}>Confirmar pago</button>
        </motion.section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          <p className="plabel flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Cliente</p>
          <p className="font-semibold">{order.customer_name ?? 'Sin nombre'}</p>
          {order.customer_phone && <p className="text-sm text-ink/60">{order.customer_phone}</p>}
          {order.customer_email && <p className="truncate text-sm text-ink/60">{order.customer_email}</p>}
          {order.customer_phone && (
            <a href={whatsappLink(order.customer_phone, `Hola ${order.customer_name ?? ''}, te escribimos de Shoppely sobre tu pedido #${order.folio}.`)} target="_blank" rel="noreferrer" className="pbtn-soft mt-3 h-9! px-4! text-emerald-700">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </section>
        <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          {order.channel === 'pos' ? (
            <>
              <p className="plabel flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Venta en tienda</p>
              <p className="font-semibold">Atendió: {order.cashier_name ?? '—'}</p>
              {order.amount_received != null && <p className="text-sm text-ink/60">Recibido {m(order.amount_received)} · Cambio {m(order.change_given ?? 0)}</p>}
            </>
          ) : (
            <>
              <p className="plabel flex items-center gap-1.5">{order.delivery_method === 'pickup' ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />} Entrega</p>
              <p className="font-semibold">{order.delivery_method === 'pickup' ? 'Recoge en tienda' : 'Envío a domicilio'}</p>
              {address && (
                <p className="mt-1 flex gap-1.5 text-sm text-ink/60">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {[address.street, address.colony, address.city, address.state, address.zip].filter(Boolean).join(', ')}
                  {address.references ? ` · ${address.references}` : ''}
                </p>
              )}
            </>
          )}
          {order.notes && <p className="mt-2 rounded-xl bg-blush-50 px-3 py-2 text-sm">“{order.notes}”</p>}
        </section>
      </div>

      <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
        <p className="plabel">Artículos</p>
        <ul className="divide-y divide-ink/5">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3">
              <Thumb src={it.image_url} className="h-12 w-12 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{it.product_name}</p>
                <p className="text-xs text-ink/50">{[it.variant_name, it.sku].filter(Boolean).join(' · ')}</p>
                {hasCost && it.unit_cost_mxn != null && <p className="text-[11px] text-ink/45">Costo {money(it.unit_cost_mxn)} c/u</p>}
              </div>
              <p className="text-sm text-ink/60">{it.quantity} × {m(it.unit_price)}</p>
              <p className="w-24 text-right text-sm font-bold tabular">{m(it.line_total)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1.5 border-t border-ink/5 pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd className="tabular">{m(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between text-blush-700"><dt>Descuento{order.coupon_code ? ` (${order.coupon_code})` : ''}</dt><dd className="tabular">-{m(order.discount)}</dd></div>}
          {order.shipping > 0 && <div className="flex justify-between"><dt className="text-ink/60">Envío</dt><dd className="tabular">{m(order.shipping)}</dd></div>}
          {order.payment_fee > 0 && <div className="flex justify-between"><dt className="text-ink/60">Comisión Mercado Pago</dt><dd className="tabular">{m(order.payment_fee)}</dd></div>}
          <div className="flex justify-between pt-1 text-lg font-bold"><dt>Total</dt><dd className="tabular">{m(order.total)}</dd></div>
          {order.payment_fee > 0 && (
            <div className="flex justify-between text-xs text-ink/50"><dt>Te queda después de la comisión</dt><dd className="tabular">{m(order.total - order.payment_fee)}</dd></div>
          )}
          {order.currency === 'USD' && <div className="flex justify-between text-xs text-ink/50"><dt>Equivale a</dt><dd>{money(order.total_mxn)} (TC {order.exchange_rate})</dd></div>}
          {hasCost && !cancelled && (
            <div className="mt-2 flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">
              <dt className="font-semibold">Ganancia estimada</dt>
              <dd className="font-bold tabular">{money(order.total_mxn - (order.shipping + order.payment_fee) * (order.currency === 'USD' ? order.exchange_rate : 1) - cost)}</dd>
            </div>
          )}
        </dl>
      </section>

      {!!order.payments?.length && (
        <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          <p className="plabel">Pagos recibidos</p>
          <ul className="space-y-2">
            {order.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span><b>{paymentMethodLabel[p.method]}</b>{p.reference && <span className="text-ink/50"> · Ref. {p.reference}</span>}</span>
                <span className="font-semibold tabular">{money(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!order.history?.length && (
        <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          <p className="plabel">Historial</p>
          <ol className="relative ml-2 space-y-4 border-l-2 border-blush-100 pl-5">
            {order.history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-blush-500 ring-4 ring-white" />
                <p className="text-sm font-semibold">{orderStatusLabel[h.status]}{h.note && <span className="font-normal text-ink/60"> — {h.note}</span>}</p>
                <p className="text-xs text-ink/45">{shortDate(h.created_at)}{h.by_name ? ` · ${h.by_name}` : ''}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
        <p className="plabel">Notas internas</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Solo las ve el equipo" className="pfield h-auto! py-2.5" />
        <AnimatePresence>
          {notes !== (order.internal_notes ?? '') && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <button type="button" className="pbtn-primary mt-2" onClick={() => notesAction.mutate(undefined)} disabled={notesAction.isPending}>Guardar notas</button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="flex flex-wrap gap-2 pb-2">
        <button type="button" className="pbtn-ghost" onClick={() => printReceipt(order, settings)}><Printer className="h-4 w-4" /> Imprimir ticket</button>
        {order.customer_phone && (
          <a className="pbtn-ghost" target="_blank" rel="noreferrer" href={whatsappLink(order.customer_phone, receiptText(order, settings))}>
            <MessageCircle className="h-4 w-4" /> Enviar ticket
          </a>
        )}
        {role === 'admin' && !cancelled && (
          <button type="button" className="pbtn-danger ml-auto" onClick={askCancel} disabled={cancelAction.isPending}><Ban className="h-4 w-4" /> Cancelar pedido</button>
        )}
      </div>
    </div>
  );
}
