import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowRight, Boxes, ClipboardList, CreditCard, Package, PackageX, Plus, Receipt, ScanBarcode, ShoppingBag,
  Store, Wallet,
} from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { useAdminProducts, useMovements, useOpenSession, useOrders, useStats } from '@/hooks/admin-queries';
import { money, paymentMethodLabel } from '@/lib/format';
import { palette } from '@/lib/palette';
import type { DashboardStats, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardTitle, CountUp, Empty, PageHeader, Pill, Segmented, StatCard, StatusPill, Thumb } from '@/components/panel/kit';
import { Donut, HourBars, RevenueArea } from '@/components/panel/charts';
import { movementLabel, movementTone } from './inventory-shared';

type Range = 'today' | '7d' | '30d' | 'month';

const rangeOptions: { value: Range; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'month', label: 'Este mes' },
];

function rangeDates(range: Range) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const to = new Date(start.getTime() + 86_400_000);
  let from = start;
  if (range === '7d') from = new Date(start.getTime() - 6 * 86_400_000);
  if (range === '30d') from = new Date(start.getTime() - 29 * 86_400_000);
  if (range === 'month') from = new Date(start.getFullYear(), start.getMonth(), 1);
  const span = to.getTime() - from.getTime();
  return { from, to, prevFrom: new Date(from.getTime() - span), prevTo: from };
}

const dayLabel = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

function fillDays(stats: DashboardStats | undefined, from: Date, to: Date) {
  const map = new Map(stats?.by_day.map((d) => [d.day, d]));
  const points = [];
  for (let t = from.getTime(); t < to.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    points.push({ label: dayLabel.format(d), value: map.get(key)?.revenue_mxn ?? 0, orders: map.get(key)?.orders ?? 0 });
  }
  return points;
}

const pct = (now: number | undefined, prev: number | undefined) =>
  now === undefined || prev === undefined || prev === 0 ? null : ((now - prev) / prev) * 100;

const methodColors: Record<PaymentMethod, string> = {
  cash: palette.ink,
  transfer: palette.blush400,
  mercadopago: palette.lilac500,
  mixed: palette.sand300,
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Dashboard() {
  const { role } = useAuth();
  if (role === 'inventory') return <InventoryDashboard />;
  return <SalesDashboard admin={role === 'admin'} />;
}

// ---------------------------------------------------------------------
// Admin y ventas
// ---------------------------------------------------------------------
function SalesDashboard({ admin }: { admin: boolean }) {
  const { profile } = useAuth();
  const [range, setRange] = useState<Range>('7d');
  const dates = useMemo(() => rangeDates(range), [range]);
  const { data: stats } = useStats(dates.from, dates.to);
  const { data: prev } = useStats(dates.prevFrom, dates.prevTo);
  const { data: recent = [] } = useOrders(admin ? { limit: 6 } : { status: 'open', limit: 6 });
  const { data: session } = useOpenSession(admin ? undefined : profile?.id);

  const trend = range === 'today'
    ? Array.from({ length: 13 }, (_, i) => ({ label: `${9 + i}:00`, value: stats?.by_hour[String(9 + i)] ?? 0 }))
    : fillDays(stats, dates.from, dates.to);
  const methods = (Object.entries(stats?.by_method ?? {}) as [PaymentMethod, number][]).filter(([, v]) => v > 0);
  const methodTotal = methods.reduce((s, [, v]) => s + v, 0);
  const channelTotal = (stats?.online_mxn ?? 0) + (stats?.pos_mxn ?? 0);
  const onlineShare = channelTotal ? ((stats?.online_mxn ?? 0) / channelTotal) * 100 : 0;
  const topMax = Math.max(...(stats?.top_products.map((p) => p.quantity) ?? [1]), 1);

  return (
    <>
      <PageHeader
        eyebrow={admin ? 'Resumen del negocio' : 'Mi panel de ventas'}
        title={`${greeting()}, ${profile?.full_name?.split(' ')[0] ?? ''}`}
        subtitle={admin ? 'Así va Shoppely. Ventas, ganancias y lo que necesita tu atención.' : 'Tus ventas en tienda y los pedidos por atender.'}
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={rangeOptions} />
            <Link href="/pos" className="pbtn-primary"><ScanBarcode className="h-4 w-4" /> Nueva venta</Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard highlight label={admin ? 'Ventas totales' : 'Mis ventas'} value={stats?.revenue_mxn ?? 0} format="money" delta={pct(stats?.revenue_mxn, prev?.revenue_mxn)} hint="vs. periodo anterior" />
        {admin ? (
          <StatCard label="Ganancia" value={stats?.profit_mxn ?? 0} format="money" delay={0.05} delta={pct(stats?.profit_mxn, prev?.profit_mxn)} hint={<span>Margen <b className="text-ink">{(stats?.margin ?? 0).toFixed(1)}%</b></span>} />
        ) : (
          <StatCard label="Ventas realizadas" value={stats?.orders ?? 0} delay={0.05} delta={pct(stats?.orders, prev?.orders)} hint="tickets cobrados" />
        )}
        <StatCard label={admin ? 'Pedidos pagados' : 'Ticket promedio'} value={admin ? stats?.orders ?? 0 : stats?.avg_ticket_mxn ?? 0} format={admin ? 'number' : 'money'} delay={0.1} delta={admin ? pct(stats?.orders, prev?.orders) : pct(stats?.avg_ticket_mxn, prev?.avg_ticket_mxn)} hint={admin ? <span>Ticket prom. <b className="text-ink">{money(stats?.avg_ticket_mxn ?? 0)}</b></span> : 'por venta'} />
        <StatCard label="Artículos vendidos" value={stats?.items_sold ?? 0} delay={0.15} delta={pct(stats?.items_sold, prev?.items_sold)} hint="piezas" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" delay={0.1}>
          <CardTitle
            title={range === 'today' ? 'Ventas por hora' : 'Ventas por día'}
            subtitle={admin ? 'Tienda en línea + punto de venta, en MXN' : 'Tus ventas cobradas en el POS'}
            action={<Pill tone="pink">{money(stats?.revenue_mxn ?? 0)}</Pill>}
          />
          <RevenueArea data={trend} />
        </Card>

        <Card delay={0.15}>
          <CardTitle title="Formas de pago" subtitle="Cómo te pagan tus clientas" />
          {methods.length === 0 ? (
            <Empty icon={CreditCard} title="Sin cobros en este periodo" />
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
              <Donut
                segments={methods.map(([m, v]) => ({ label: paymentMethodLabel[m], value: v, color: methodColors[m] }))}
                center={<div><p className="text-[11px] font-semibold text-ink/50">Total</p><p className="text-lg font-bold">{money(Math.round(methodTotal))}</p></div>}
              />
              <ul className="w-full space-y-2.5">
                {methods.map(([m, v]) => (
                  <li key={m} className="flex items-center gap-3 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ background: methodColors[m] }} />
                    <span className="flex-1 font-medium">{paymentMethodLabel[m]}</span>
                    <span className="font-bold tabular">{Math.round((v / methodTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card delay={0.2}>
          <CardTitle title="Lo más vendido" subtitle={admin ? 'Top productos del periodo' : 'Lo que más vendiste'} />
          {stats?.top_products.length ? (
            <ul className="space-y-3">
              {stats.top_products.map((p, i) => (
                <motion.li key={p.product_id ?? p.product_name} className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.05 }}>
                  {p.image_url ? <img src={p.image_url} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-xl bg-blush-50"><Package className="h-4 w-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{p.product_name}</p>
                      <p className="shrink-0 text-xs font-bold">{p.quantity} pzs</p>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                      <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-blush-300),var(--color-blush-600))]" initial={{ width: 0 }} animate={{ width: `${(p.quantity / topMax) * 100}%` }} transition={{ duration: 0.9, delay: 0.3 + i * 0.05 }} />
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : (
            <Empty icon={ShoppingBag} title="Aún no hay ventas" />
          )}
        </Card>

        <Card delay={0.25}>
          <CardTitle title="Horas pico" subtitle="Cuándo se vende más" />
          <HourBars byHour={stats?.by_hour ?? {}} />
          {admin && (
            <div className="mt-5 rounded-2xl bg-ink/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> En línea {Math.round(onlineShare)}%</span>
                <span className="flex items-center gap-1.5">Tienda {Math.round(100 - onlineShare)}% <Store className="h-3.5 w-3.5" /></span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-ink">
                <motion.div className="h-full bg-blush-400" initial={{ width: 0 }} animate={{ width: `${onlineShare}%` }} transition={{ duration: 1, delay: 0.4 }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-ink/55">
                <span>{money(stats?.online_mxn ?? 0)}</span>
                <span>{money(stats?.pos_mxn ?? 0)}</span>
              </div>
            </div>
          )}
        </Card>

        <div className="grid gap-4 lg:col-span-2 xl:col-span-1">
          <AttentionCard stats={stats} admin={admin} />
          {admin ? (
            <Card delay={0.35} className="bg-ink! text-white ring-0!">
              <p className="text-sm font-semibold text-white/70">Valor del inventario</p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/50">A costo</p>
                  <CountUp value={stats?.inventory_cost_mxn ?? 0} format="money" className="text-xl font-bold" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/50">A precio de venta</p>
                  <CountUp value={stats?.inventory_retail_mxn ?? 0} format="money" className="text-xl font-bold text-blush-300" />
                </div>
              </div>
            </Card>
          ) : (
            <CashCard open={!!session} openedAt={session?.opened_at} />
          )}
        </div>
      </div>

      <Card className="mt-4" delay={0.3}>
        <CardTitle
          title={admin ? 'Últimos movimientos' : 'Pedidos en línea por atender'}
          subtitle={admin ? 'Ventas y pedidos más recientes' : 'Confirma pagos y prepara envíos'}
          action={<Link href="/pedidos" className="pbtn-soft h-9! px-4!">Ver todos <ArrowRight className="h-4 w-4" /></Link>}
        />
        {recent.length === 0 ? (
          <Empty icon={ClipboardList} title="Todo al día" text="No hay pedidos pendientes." />
        ) : (
          <ul className="divide-y divide-ink/5">
            {recent.map((o, i) => (
              <motion.li key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.04 }}>
                <Link href={`/pedidos?id=${o.id}`} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-blush-50/60">
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', o.channel === 'pos' ? 'bg-ink text-white' : 'bg-blush-100 text-blush-700')}>
                    {o.channel === 'pos' ? <Receipt className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">#{o.folio} · {o.customer_name ?? (o.channel === 'pos' ? 'Venta en tienda' : 'Cliente')}</p>
                    <p className="text-xs text-ink/50">{new Date(o.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {o.items.reduce((s, i) => s + i.quantity, 0)} pzs</p>
                  </div>
                  <div className="hidden sm:block"><StatusPill status={o.status} /></div>
                  <p className="w-28 text-right text-sm font-bold tabular">{money(o.total, o.currency)}</p>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function AttentionCard({ stats, admin }: { stats: DashboardStats | undefined; admin: boolean }) {
  const items = [
    { label: 'Pedidos por preparar', value: stats?.pending_orders ?? 0, href: '/pedidos?estado=open', icon: ClipboardList, tone: 'bg-blush-100 text-blush-700' },
    { label: 'Pagos por confirmar', value: stats?.unpaid_orders ?? 0, href: '/pedidos?pago=pending', icon: CreditCard, tone: 'bg-amber-100 text-amber-800' },
    ...(admin ? [{ label: 'Variantes con stock bajo', value: stats?.low_stock ?? 0, href: '/inventario?filtro=low', icon: AlertTriangle, tone: 'bg-red-50 text-red-600' }] : []),
  ];
  return (
    <Card delay={0.3}>
      <CardTitle title="Necesita tu atención" />
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label}>
            <Link href={it.href} className="group flex items-center gap-3 rounded-2xl p-2 transition hover:bg-ink/[0.03]">
              <span className={cn('grid h-10 w-10 place-items-center rounded-xl', it.tone)}><it.icon className="h-4 w-4" /></span>
              <span className="flex-1 text-sm font-medium">{it.label}</span>
              <CountUp value={it.value} className="text-lg font-bold" />
              <ArrowRight className="h-4 w-4 text-ink/30 transition group-hover:translate-x-1 group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CashCard({ open, openedAt }: { open: boolean; openedAt?: string }) {
  return (
    <Card delay={0.35} className={cn(open ? 'bg-emerald-600! text-white ring-0!' : '')}>
      <div className="flex items-start justify-between">
        <span className={cn('grid h-11 w-11 place-items-center rounded-2xl', open ? 'bg-white/15' : 'bg-ink text-white')}><Wallet className="h-5 w-5" /></span>
        <Pill tone={open ? 'ink' : 'amber'} dot>{open ? 'Caja abierta' : 'Caja cerrada'}</Pill>
      </div>
      <p className="mt-4 text-lg font-bold">{open ? 'Tu turno está activo' : 'Abre tu caja para empezar'}</p>
      <p className={cn('text-sm', open ? 'text-white/75' : 'text-ink/55')}>
        {open && openedAt ? `Desde las ${new Date(openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : 'Registra tu fondo inicial y comienza a cobrar.'}
      </p>
      <Link href={open ? '/caja' : '/pos'} className={cn('mt-4 w-full', open ? 'pbtn bg-white text-ink' : 'pbtn-primary')}>
        {open ? 'Ver corte de caja' : 'Abrir caja'} <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------
function InventoryDashboard() {
  const { profile } = useAuth();
  const { data: products = [] } = useAdminProducts();
  const { data: movements = [] } = useMovements(undefined, 8);
  const active = products.filter((p) => p.active);
  const variants = active.flatMap((p) => p.variants.filter((v) => v.active).map((v) => ({ ...v, product: p })));
  const units = variants.reduce((s, v) => s + v.stock, 0);
  const low = variants.filter((v) => v.stock > 0 && v.stock <= v.low_stock_threshold);
  const out = variants.filter((v) => v.stock === 0);
  const byCategory = Object.entries(
    variants.reduce<Record<string, number>>((acc, v) => {
      const key = v.product.category?.name ?? 'Sin categoría';
      acc[key] = (acc[key] ?? 0) + v.stock;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(...byCategory.map(([, n]) => n), 1);

  return (
    <>
      <PageHeader
        eyebrow="Inventario"
        title={`${greeting()}, ${profile?.full_name?.split(' ')[0] ?? ''}`}
        subtitle="Revisa existencias, recibe mercancía y corrige diferencias."
        actions={
          <>
            <Link href="/inventario?scan=1" className="pbtn-ghost"><ScanBarcode className="h-4 w-4" /> Escanear</Link>
            <Link href="/productos?nuevo=1" className="pbtn-primary"><Plus className="h-4 w-4" /> Nuevo producto</Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard highlight label="Unidades en stock" value={units} hint={`${variants.length} variantes activas`} icon={Boxes} />
        <StatCard label="Productos activos" value={active.length} delay={0.05} hint={`${products.length - active.length} archivados`} icon={Package} />
        <StatCard label="Stock bajo" value={low.length} delay={0.1} hint="por reabastecer" icon={AlertTriangle} />
        <StatCard label="Agotados" value={out.length} delay={0.15} hint="sin existencias" icon={PackageX} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" delay={0.1}>
          <CardTitle title="Por reabastecer" subtitle="Agotados y con stock bajo" action={<Link href="/inventario?filtro=low" className="pbtn-soft h-9! px-4!">Ir a inventario <ArrowRight className="h-4 w-4" /></Link>} />
          {[...out, ...low].length === 0 ? (
            <Empty icon={Boxes} title="Todo con buen stock" />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {[...out, ...low].slice(0, 10).map((v, i) => (
                <motion.li key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.03 }} className="flex items-center gap-3 rounded-2xl bg-ink/[0.025] p-2.5">
                  <Thumb src={v.product.images[0]} className="h-11 w-11 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{v.product.name}</p>
                    <p className="truncate text-xs text-ink/50">{v.name} · {v.sku ?? 'sin SKU'}</p>
                  </div>
                  <Pill tone={v.stock === 0 ? 'red' : 'amber'}>{v.stock === 0 ? 'Agotado' : `${v.stock} pzs`}</Pill>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
        <Card delay={0.15}>
          <CardTitle title="Unidades por categoría" />
          <ul className="space-y-3.5">
            {byCategory.map(([name, n], i) => (
              <li key={name}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{name}</span><b className="tabular">{n}</b></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink/[0.05]">
                  <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-sand-300),var(--color-blush-500))]" initial={{ width: 0 }} animate={{ width: `${(n / catMax) * 100}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.06 }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4" delay={0.2}>
        <CardTitle title="Movimientos recientes" subtitle="Ventas, entradas y ajustes" action={<Link href="/inventario?tab=movimientos" className="pbtn-soft h-9! px-4!">Historial <ArrowRight className="h-4 w-4" /></Link>} />
        <ul className="divide-y divide-ink/5">
          {movements.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Pill tone={movementTone[m.reason]}>{movementLabel[m.reason]}</Pill>
              <p className="min-w-0 flex-1 truncate text-sm"><b>{m.product_name}</b> · {m.variant_name}{m.note ? <span className="text-ink/50"> — {m.note}</span> : null}</p>
              <span className={cn('w-12 text-right text-sm font-bold tabular', m.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600')}>{m.quantity_change > 0 ? '+' : ''}{m.quantity_change}</span>
              <span className="hidden w-32 text-right text-xs text-ink/45 sm:block">{new Date(m.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
