import { demoBanners, demoCategories, demoProducts, demoReviews, demoSettings } from './demo-data';
import { mpFeeOf, mpGross, mpRate, mpSurcharge } from './fees';
import { fromMxn, toMxn, unitPrice } from './format';
import type {
  AdminBanner, AdminOrder, AdminReview, CashMovement, CashSession, CashSummary, Category, CheckoutPayload, Coupon,
  Currency, DashboardStats, InventoryMovement, MovementReason, OrderItem, PaymentMethod, PosSalePayload, Product,
  Profile, StoreSettings, TeamMember,
} from './types';

/**
 * Base de datos del modo demo. Vive en localStorage para que todo lo que se haga
 * en el panel (productos, stock, ventas, caja) se refleje en la tienda sin Supabase.
 * Las reglas replican las funciones SQL (create_order, cancel_order, etc.).
 */
export interface DemoDb {
  version: number;
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  costs: Record<string, { cost_mxn: number; supplier: string | null }>;
  movements: InventoryMovement[];
  orders: AdminOrder[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
  reviews: AdminReview[];
  banners: AdminBanner[];
  coupons: Coupon[];
  team: TeamMember[];
  nextFolio: number;
}

const KEY = 'shoppely-demo-db';
const VERSION = 2;
let cache: DemoDb | null = null;

export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function demoDb(): DemoDb {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDb;
      if (parsed.version === VERSION) return (cache = parsed);
    }
  } catch {
    // datos corruptos: se regeneran
  }
  cache = seed();
  persist();
  return cache;
}

/** Copia para lecturas: React Query no detecta cambios si se devuelve el mismo objeto mutado. */
export const snapshot = (): DemoDb => structuredClone(demoDb());

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    throw new Error('El almacenamiento del modo demo está lleno. Usa fotos más ligeras o reinicia los datos demo en Ajustes.');
  }
}

export function resetDemoDb() {
  localStorage.removeItem(KEY);
  cache = null;
}

export function demoUser(): Profile | null {
  try {
    const raw = localStorage.getItem('shoppely-demo-user');
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------
// Motor de pedidos (igual que create_order en SQL)
// ---------------------------------------------------------------------
type EnginePayload = (CheckoutPayload | PosSalePayload) & {
  customer_email?: string;
  delivery_method?: 'shipping' | 'pickup';
  shipping_address?: Record<string, string>;
  coupon_code?: string;
};

interface EngineOptions {
  at?: Date;
  touchStock?: boolean;
  actor?: Profile | null;
}

export function findVariant(db: DemoDb, variantId: string) {
  for (const product of db.products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

export function recordMovement(
  db: DemoDb,
  variantId: string,
  change: number,
  reason: MovementReason,
  opts: { note?: string | null; orderId?: string | null; actor?: Profile | null; at?: Date } = {},
) {
  const found = findVariant(db, variantId);
  if (!found) throw new Error('Variante no encontrada');
  const next = found.variant.stock + change;
  if (next < 0) throw new Error('El stock no puede quedar en negativo');
  found.variant.stock = next;
  db.movements.unshift({
    id: uid(),
    variant_id: variantId,
    quantity_change: change,
    stock_after: next,
    reason,
    note: opts.note ?? null,
    order_id: opts.orderId ?? null,
    user_name: opts.actor?.full_name ?? null,
    product_name: found.product.name,
    variant_name: found.variant.name,
    created_at: (opts.at ?? new Date()).toISOString(),
  });
  return next;
}

export function demoValidateCoupon(db: DemoDb, code: string, subtotalMxn: number) {
  const now = Date.now();
  const coupon = db.coupons.find((c) =>
    c.code.toUpperCase() === code.trim().toUpperCase()
    && c.active
    && (!c.starts_at || Date.parse(c.starts_at) <= now)
    && (!c.ends_at || Date.parse(c.ends_at) >= now)
    && (c.max_uses === null || c.used_count < c.max_uses));
  if (!coupon) return { valid: false as const, message: 'Cupón inválido o vencido' };
  if (subtotalMxn < (coupon.min_subtotal_mxn ?? 0)) {
    return { valid: false as const, message: `Compra mínima de $${coupon.min_subtotal_mxn} MXN` };
  }
  return { valid: true as const, code: coupon.code, kind: coupon.kind, value: coupon.value };
}

export function demoCreateOrder(db: DemoDb, p: EnginePayload, opts: EngineOptions = {}): AdminOrder {
  const at = opts.at ?? new Date();
  const touchStock = opts.touchStock ?? true;
  const actor = opts.actor ?? null;
  const settings = db.settings;
  const rate = settings.exchange_rate;
  const isPos = p.channel === 'pos';

  if (p.items.length === 0) throw new Error('El carrito está vacío');
  if (!isPos) {
    if (!p.customer_name?.trim() || !p.customer_phone?.trim()) throw new Error('Nombre y teléfono son obligatorios');
    const m = p.payment_method;
    if ((m === 'cash' && !settings.cash_enabled) || (m === 'transfer' && !settings.transfer_enabled) || (m === 'mercadopago' && !settings.mercadopago_enabled)) {
      throw new Error('Método de pago no disponible');
    }
  }

  const orderId = uid();
  const items: OrderItem[] = [];
  let subtotal = 0;

  for (const line of p.items) {
    if (!line.quantity || line.quantity <= 0) throw new Error('Cantidad inválida');
    const found = findVariant(db, line.variant_id);
    if (!found || !found.variant.active) throw new Error('Un producto del carrito ya no está disponible');
    const { product, variant } = found;
    if (!isPos && !product.active) throw new Error(`${product.name} ya no está disponible`);
    if (touchStock && variant.stock < line.quantity) {
      throw new Error(`Stock insuficiente de ${product.name} (${variant.name}): quedan ${variant.stock}`);
    }
    const unit = unitPrice(product, variant, p.currency, rate);
    if (touchStock) recordMovement(db, variant.id, -line.quantity, 'sale', { orderId, actor, at });
    items.push({
      id: uid(),
      product_id: product.id,
      variant_id: variant.id,
      product_name: product.name,
      variant_name: variant.name,
      sku: variant.sku,
      image_url: product.images[0] ?? null,
      quantity: line.quantity,
      unit_price: unit,
      line_total: round2(unit * line.quantity),
      unit_cost_mxn: db.costs[product.id]?.cost_mxn ?? 0,
    });
    subtotal = round2(subtotal + unit * line.quantity);
  }

  const subtotalMxn = toMxn(subtotal, p.currency, rate);
  let discount = 0;
  let couponCode: string | null = null;
  if (p.coupon_code?.trim()) {
    const coupon = demoValidateCoupon(db, p.coupon_code, subtotalMxn);
    if (!coupon.valid) throw new Error(coupon.message);
    discount = coupon.kind === 'percent'
      ? round2((subtotal * Math.min(coupon.value, 100)) / 100)
      : fromMxn(coupon.value, p.currency, rate);
    couponCode = coupon.code;
    const stored = db.coupons.find((c) => c.code === coupon.code);
    if (stored) stored.used_count += 1;
  }
  if (isPos) discount += Math.max((p as PosSalePayload).discount_amount ?? 0, 0);
  discount = Math.min(round2(discount), subtotal);

  const delivery = p.delivery_method ?? (isPos ? 'pickup' : 'shipping');
  const freeShipping = settings.free_shipping_min_mxn !== null && subtotalMxn >= settings.free_shipping_min_mxn;
  const shipping = !isPos && delivery === 'shipping' && !freeShipping ? fromMxn(settings.shipping_fee_mxn, p.currency, rate) : 0;
  const base = round2(subtotal - discount + shipping);
  let fee = 0;
  const onlineRate = mpRate(settings, 'online', p.currency);
  if (!isPos && p.payment_method === 'mercadopago' && onlineRate) fee = mpSurcharge(base, onlineRate);

  const payments: AdminOrder['payments'] = [];
  let received: number | null = null;
  if (isPos) {
    const pos = p as PosSalePayload;
    const toOrder = (n: number, cur: Currency) => (cur === p.currency ? n : p.currency === 'MXN' ? n * rate : n / rate);
    const defaultRate = mpRate(settings, 'pos', pos.currency);
    const list = pos.payments.length ? pos.payments : [{
      method: pos.payment_method as Exclude<PaymentMethod, 'mixed'>,
      amount: pos.payment_method === 'mercadopago' && defaultRate ? mpGross(base, defaultRate) : base,
      currency: pos.currency,
    }];
    let paid = 0;
    for (const pay of list) {
      if (!(pay.amount > 0)) throw new Error('Monto de pago inválido');
      payments.push({ id: uid(), method: pay.method, amount: round2(pay.amount), currency: pay.currency, reference: pay.reference || null, created_at: at.toISOString() });
      paid += toOrder(pay.amount, pay.currency);
      const posRate = pay.method === 'mercadopago' ? mpRate(settings, 'pos', pay.currency) : null;
      if (posRate) fee += toOrder(mpFeeOf(pay.amount, posRate), pay.currency);
    }
    fee = round2(fee);
    if (paid + 0.01 < base + fee) throw new Error(`El pago está incompleto: faltan ${round2(base + fee - paid)}`);
    received = pos.amount_received ?? null;
  }
  const total = round2(base + fee);

  const order: AdminOrder = {
    id: orderId,
    folio: db.nextFolio++,
    public_token: uid(),
    channel: p.channel,
    status: isPos ? 'completed' : 'pending',
    payment_status: isPos ? 'paid' : 'pending',
    payment_method: p.payment_method,
    currency: p.currency,
    exchange_rate: rate,
    subtotal,
    discount,
    shipping,
    payment_fee: fee,
    total,
    total_mxn: toMxn(total, p.currency, rate),
    coupon_code: couponCode,
    delivery_method: delivery,
    shipping_address: p.shipping_address ?? null,
    customer_id: isPos ? null : actor?.id ?? null,
    customer_name: p.customer_name?.trim() || null,
    customer_phone: p.customer_phone?.trim() || null,
    customer_email: (p as { customer_email?: string }).customer_email?.trim() || null,
    notes: p.notes?.trim() || null,
    internal_notes: null,
    transfer_reference: null,
    mp_payment_id: null,
    amount_received: received,
    change_given: received !== null ? Math.max(round2(received - total), 0) : null,
    cashier_id: isPos ? actor?.id ?? null : null,
    cashier_name: isPos ? actor?.full_name ?? null : null,
    cash_session_id: isPos ? (p as PosSalePayload).cash_session_id : null,
    paid_at: isPos ? at.toISOString() : null,
    created_at: at.toISOString(),
    items,
    payments,
    history: [{ id: uid(), status: isPos ? 'completed' : 'pending', note: isPos ? 'Venta en tienda' : 'Pedido recibido', by_name: actor?.full_name ?? null, created_at: at.toISOString() }],
  };
  db.orders.unshift(order);
  return order;
}

export function demoCancelOrder(db: DemoDb, orderId: string, reason: string | null, actor: Profile | null) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw new Error('Pedido no encontrado');
  if (order.status === 'cancelled') return;
  for (const item of order.items) {
    if (item.variant_id && findVariant(db, item.variant_id)) {
      recordMovement(db, item.variant_id, item.quantity, 'cancel', { orderId, note: reason, actor });
    }
  }
  order.status = 'cancelled';
  if (order.payment_status === 'paid') order.payment_status = 'refunded';
  order.history = [{ id: uid(), status: 'cancelled', note: reason, by_name: actor?.full_name ?? null, created_at: new Date().toISOString() }, ...(order.history ?? [])];
}

// ---------------------------------------------------------------------
// Estadísticas y caja (igual que dashboard_stats / cash_session_summary)
// ---------------------------------------------------------------------
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toMxnAt = (amount: number, currency: Currency, rate: number) => (currency === 'MXN' ? amount : amount * rate);

/** Comisión de Mercado Pago en MXN: la paga la clienta pero se va a Mercado Pago, no es venta. */
const feeMxn = (o: AdminOrder) => round2(toMxnAt(o.payment_fee ?? 0, o.currency, o.exchange_rate));
const salesMxn = (o: AdminOrder) => round2(o.total_mxn - feeMxn(o));

/**
 * El efectivo se guarda como lo entregado por la clienta (se descuenta el cambio) y
 * Mercado Pago como lo cobrado en terminal (se descuenta la comisión).
 */
function addPayments(byMethod: Partial<Record<PaymentMethod, number>>, o: AdminOrder) {
  const pays = o.payments?.length ? o.payments : [{ method: o.payment_method, amount: o.total, currency: o.currency }];
  for (const pay of pays) byMethod[pay.method] = round2((byMethod[pay.method] ?? 0) + toMxnAt(pay.amount, pay.currency, o.exchange_rate));
  if (o.change_given) byMethod.cash = round2((byMethod.cash ?? 0) - toMxnAt(o.change_given, o.currency, o.exchange_rate));
  if (feeMxn(o) > 0) byMethod.mercadopago = round2((byMethod.mercadopago ?? 0) - feeMxn(o));
}

export function demoStats(db: DemoDb, from: Date, to: Date, cashierId: string | null, withProfit: boolean): DashboardStats {
  const orders = db.orders.filter((o) => {
    const t = Date.parse(o.created_at);
    return t >= from.getTime() && t < to.getTime() && o.status !== 'cancelled' && o.payment_status === 'paid'
      && (!cashierId || o.cashier_id === cashierId);
  });
  const sum = (list: AdminOrder[]) => round2(list.reduce((s, o) => s + salesMxn(o), 0));

  const byDay = new Map<string, { day: string; revenue_mxn: number; orders: number }>();
  const byHour: Record<string, number> = {};
  const byMethod: Partial<Record<PaymentMethod, number>> = {};
  const top = new Map<string, DashboardStats['top_products'][number]>();
  let items = 0;
  let cost = 0;
  let net = 0;

  for (const o of orders) {
    const key = dayKey(o.created_at);
    const day = byDay.get(key) ?? { day: key, revenue_mxn: 0, orders: 0 };
    day.revenue_mxn = round2(day.revenue_mxn + salesMxn(o));
    day.orders += 1;
    byDay.set(key, day);
    const hour = String(new Date(o.created_at).getHours());
    byHour[hour] = round2((byHour[hour] ?? 0) + salesMxn(o));
    addPayments(byMethod, o);
    for (const i of o.items) {
      items += i.quantity;
      cost += i.quantity * (i.unit_cost_mxn ?? 0);
      const k = i.product_id ?? i.product_name;
      const t = top.get(k) ?? { product_id: i.product_id, product_name: i.product_name, image_url: i.image_url, quantity: 0, revenue_mxn: 0 };
      t.quantity += i.quantity;
      t.revenue_mxn = round2(t.revenue_mxn + toMxnAt(i.line_total, o.currency, o.exchange_rate));
      top.set(k, t);
    }
    net += toMxnAt(o.total - o.shipping - (o.payment_fee ?? 0), o.currency, o.exchange_rate);
  }

  const revenue = sum(orders);
  const stats: DashboardStats = {
    revenue_mxn: revenue,
    orders: orders.length,
    avg_ticket_mxn: orders.length ? round2(revenue / orders.length) : 0,
    online_mxn: sum(orders.filter((o) => o.channel === 'online')),
    pos_mxn: sum(orders.filter((o) => o.channel === 'pos')),
    items_sold: items,
    by_day: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    by_hour: byHour,
    by_method: byMethod,
    top_products: [...top.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6),
    pending_orders: db.orders.filter((o) => o.channel === 'online' && ['pending', 'confirmed', 'preparing'].includes(o.status)).length,
    unpaid_orders: db.orders.filter((o) => o.channel === 'online' && o.status !== 'cancelled' && o.payment_status === 'pending').length,
    low_stock: db.products.flatMap((p) => p.variants).filter((v) => v.active && v.stock <= v.low_stock_threshold).length,
  };

  if (withProfit) {
    const variants = db.products.flatMap((p) => p.variants.filter((v) => v.active).map((v) => ({ p, v })));
    Object.assign(stats, {
      cost_mxn: round2(cost),
      net_sales_mxn: round2(net),
      profit_mxn: round2(net - cost),
      margin: net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : 0,
      inventory_cost_mxn: round2(variants.reduce((s, { p, v }) => s + v.stock * (db.costs[p.id]?.cost_mxn ?? 0), 0)),
      inventory_retail_mxn: round2(variants.reduce((s, { p, v }) => s + v.stock * (v.price_mxn ?? p.price_mxn), 0)),
    });
  }
  return stats;
}

export function demoCashSummary(db: DemoDb, sessionId: string): CashSummary {
  const session = db.cashSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('Caja no encontrada');
  const orders = db.orders.filter((o) => o.cash_session_id === sessionId);
  const live = orders.filter((o) => o.status !== 'cancelled');
  const moves = db.cashMovements.filter((m) => m.session_id === sessionId);
  const cash = (cur: Currency) => live.reduce((s, o) => s + (o.payments ?? []).filter((p) => p.method === 'cash' && p.currency === cur).reduce((a, p) => a + p.amount, 0), 0);
  const change = (cur: Currency) => live.filter((o) => o.currency === cur).reduce((s, o) => s + (o.change_given ?? 0), 0);
  const mv = (kind: 'in' | 'out', cur: Currency) => moves.filter((m) => m.kind === kind && m.currency === cur).reduce((s, m) => s + m.amount, 0);
  const byMethod: Partial<Record<PaymentMethod, number>> = {};
  for (const o of live) addPayments(byMethod, o);

  return {
    session,
    sales: live.length,
    cancelled: orders.length - live.length,
    total_mxn: round2(live.reduce((s, o) => s + salesMxn(o), 0)),
    fees_mxn: round2(live.reduce((s, o) => s + feeMxn(o), 0)),
    by_method: byMethod,
    cash_in_mxn: mv('in', 'MXN'),
    cash_out_mxn: mv('out', 'MXN'),
    cash_in_usd: mv('in', 'USD'),
    cash_out_usd: mv('out', 'USD'),
    expected_mxn: round2(session.opening_mxn + cash('MXN') - change('MXN') + mv('in', 'MXN') - mv('out', 'MXN')),
    expected_usd: round2(session.opening_usd + cash('USD') - change('USD') + mv('in', 'USD') - mv('out', 'USD')),
  };
}

// ---------------------------------------------------------------------
// Datos iniciales con un mes de ventas de ejemplo
// ---------------------------------------------------------------------
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const customers = [
  'Mariana González', 'Daniela Ruiz', 'Sofía López', 'Valeria Martínez', 'Paola Castro', 'Fernanda Ríos',
  'Andrea Morales', 'Camila Herrera', 'Regina Flores', 'Ximena Vargas', 'Lucía Medina', 'Renata Ortiz',
];

function member(id: string, full_name: string, role: TeamMember['role'], daysAgo: number): TeamMember {
  return {
    id, full_name, role, active: true, phone: null, avatar_url: null,
    email: `${full_name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@shoppely.demo`,
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  };
}

function seed(): DemoDb {
  const r = mulberry32(20261007);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const now = new Date();

  const team: TeamMember[] = [
    { ...member('demo-admin', 'Admin Shoppely', 'admin', 60), email: 'admin@shoppely.demo' },
    { ...member('demo-seller', 'Vendedora', 'seller', 50), email: 'seller@shoppely.demo' },
    { ...member('demo-inventory', 'Encargada de inventario', 'inventory', 45), email: 'inventory@shoppely.demo' },
    { ...member('demo-customer', 'Clienta demo', 'customer', 20), email: 'customer@shoppely.demo' },
    ...customers.slice(0, 6).map((name, i) => member(`cust-${i}`, name, 'customer', 40 - i * 5)),
  ];
  const admin = team[0];
  const seller = team[1];

  const db: DemoDb = {
    version: VERSION,
    settings: structuredClone(demoSettings),
    categories: structuredClone(demoCategories),
    products: structuredClone(demoProducts),
    costs: {},
    movements: [],
    orders: [],
    cashSessions: [],
    cashMovements: [],
    reviews: demoReviews.map((rv) => ({
      ...rv,
      status: 'published' as const,
      product_name: demoProducts.find((p) => p.id === rv.product_id)?.name ?? null,
    })),
    banners: demoBanners.map((b) => ({ ...b, active: true, starts_at: null, ends_at: null })),
    coupons: [{ id: uid(), code: 'BIENVENIDA10', kind: 'percent', value: 10, min_subtotal_mxn: 500, max_uses: null, used_count: 0, starts_at: null, ends_at: null, active: true }],
    team,
    nextFolio: 1001,
  };

  const start = new Date(now.getTime() - 35 * 86_400_000);
  for (const p of db.products) {
    db.costs[p.id] = { cost_mxn: Math.round(p.price_mxn * 0.45), supplier: null };
    for (const v of p.variants) {
      db.movements.push({
        id: uid(), variant_id: v.id, quantity_change: v.stock, stock_after: v.stock, reason: 'restock',
        note: 'Inventario inicial', order_id: null, user_name: admin.full_name, product_name: p.name, variant_name: v.name,
        created_at: start.toISOString(),
      });
    }
  }

  const yesterdaySession: CashSession = {
    id: uid(), opened_by: seller.id, opened_by_name: seller.full_name,
    opened_at: new Date(now.getTime() - 86_400_000 - 8 * 3_600_000).toISOString(),
    opening_mxn: 1000, opening_usd: 0, closed_at: new Date(now.getTime() - 86_400_000).toISOString(),
    expected_mxn: null, expected_usd: null, counted_mxn: null, counted_usd: null, notes: null, status: 'closed',
  };
  db.cashSessions.push(yesterdaySession);

  const allVariants = db.products.flatMap((p) => p.variants.map((v) => v.id));
  for (let d = 34; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    day.setHours(10, 0, 0, 0);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const count = 1 + Math.floor(r() * (weekend ? 7 : 5));
    const times = Array.from({ length: count }, () => day.getTime() + Math.floor(r() * 10 * 3_600_000)).sort();

    for (const t of times) {
      if (t > now.getTime()) continue;
      const at = new Date(t);
      const pos = r() < 0.55;
      const lines = 1 + (r() < 0.35 ? 1 : 0) + (r() < 0.1 ? 1 : 0);
      const items = [...new Set(Array.from({ length: lines }, () => pick(allVariants)))].map((variant_id) => ({ variant_id, quantity: r() < 0.8 ? 1 : 2 }));
      const currency: Currency = r() < 0.1 ? 'USD' : 'MXN';
      const name = pick(customers);

      if (pos) {
        const roll = r();
        const method = roll < 0.55 ? 'cash' : roll < 0.7 ? 'transfer' : 'mercadopago';
        const cashier = r() < 0.7 ? seller : admin;
        const order = demoCreateOrder(db, {
          channel: 'pos', currency, items, payment_method: method, payments: [],
          cash_session_id: d === 1 ? yesterdaySession.id : '', customer_name: r() < 0.3 ? name : undefined,
        }, { at, touchStock: false, actor: cashier });
        order.cash_session_id = d === 1 ? yesterdaySession.id : null;
        if (method === 'cash') {
          const received = Math.ceil(order.total / 100) * 100;
          order.amount_received = received;
          order.change_given = round2(received - order.total);
          order.payments = order.payments?.map((pay) => ({ ...pay, amount: received }));
        }
      } else {
        const roll = r();
        const method = roll < 0.45 ? 'transfer' : roll < 0.8 ? 'mercadopago' : 'cash';
        const delivery = r() < 0.7 ? 'shipping' : 'pickup';
        const order = demoCreateOrder(db, {
          channel: 'online', currency, items, payment_method: method, delivery_method: delivery,
          customer_name: name, customer_phone: `55${Math.floor(10_000_000 + r() * 89_999_999)}`,
          shipping_address: delivery === 'shipping' ? { street: 'Av. Reforma 123', colony: 'Juárez', city: 'Ciudad de México', state: 'CDMX', zip: '06600' } : undefined,
        }, { at, touchStock: false });
        const step = (status: AdminOrder['status'], note: string, hours: number) => {
          order.status = status;
          order.history = [{ id: uid(), status, note, by_name: seller.full_name, created_at: new Date(t + hours * 3_600_000).toISOString() }, ...(order.history ?? [])];
        };
        const paid = () => {
          order.payment_status = 'paid';
          order.paid_at = new Date(t + 3_600_000).toISOString();
          order.payments = [{ id: uid(), method: order.payment_method, amount: order.total, currency: order.currency, reference: null, created_at: order.paid_at }];
        };
        if (r() < 0.04) {
          order.status = 'cancelled';
        } else if (d > 3) {
          paid();
          step('confirmed', 'Pago confirmado', 1);
          step(delivery === 'shipping' ? 'delivered' : 'completed', delivery === 'shipping' ? 'Entregado' : 'Recogido en tienda', 48);
        } else if (d > 0) {
          paid();
          step('confirmed', 'Pago confirmado', 1);
          step(r() < 0.5 ? 'preparing' : delivery === 'shipping' ? 'shipped' : 'preparing', 'Actualizado', 6);
        } else if (method === 'mercadopago') {
          paid();
          step('confirmed', 'Pago confirmado', 0.2);
        }
      }
    }
  }

  db.orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const s = demoCashSummary(db, yesterdaySession.id);
  Object.assign(yesterdaySession, { expected_mxn: s.expected_mxn, expected_usd: s.expected_usd, counted_mxn: s.expected_mxn, counted_usd: s.expected_usd });
  return db;
}
