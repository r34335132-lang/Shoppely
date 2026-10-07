import { db, isDemo } from './supabase';
import {
  demoCancelOrder, demoCashSummary, demoCreateOrder, demoDb, demoStats, demoUser, findVariant, persist, recordMovement,
  snapshot, uid, type DemoDb,
} from './demo-db';
import type {
  AdminBanner, AdminOrder, AdminProduct, AdminReview, CashMovement, CashSession, CashSummary, Category, Coupon,
  Currency, DashboardStats, InventoryMovement, MovementReason, OrderChannel, OrderStatus, PaymentMethod, PaymentStatus,
  PosSalePayload, Product, ProductInput, Role, StoreSettings, TeamMember, Variant,
} from './types';

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

function mutate<T>(fn: (d: DemoDb) => T): T {
  const result = fn(demoDb());
  persist();
  return result === undefined ? result : structuredClone(result);
}

const me = () => demoUser();

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------
export async function fetchStats(from: Date, to: Date, cashierId: string | null = null): Promise<DashboardStats> {
  if (isDemo) {
    const user = me();
    const cashier = user?.role === 'seller' ? user.id : cashierId;
    return demoStats(snapshot(), from, to, cashier, user?.role === 'admin');
  }
  const { data, error } = await db().rpc('dashboard_stats', { p_from: from.toISOString(), p_to: to.toISOString(), p_cashier: cashierId });
  fail(error);
  return data as DashboardStats;
}

export interface PanelBadges {
  openOrders: number;
  unpaidOrders: number;
  lowStock: number;
}

const OPEN_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipped'];

export async function fetchBadges(): Promise<PanelBadges> {
  if (isDemo) {
    const d = snapshot();
    const online = d.orders.filter((o) => o.channel === 'online' && o.status !== 'cancelled');
    return {
      openOrders: online.filter((o) => OPEN_STATUSES.includes(o.status)).length,
      unpaidOrders: online.filter((o) => o.payment_status === 'pending').length,
      lowStock: d.products.filter((p) => p.active).flatMap((p) => p.variants).filter((v) => v.active && v.stock <= v.low_stock_threshold).length,
    };
  }
  const [open, unpaid, variants] = await Promise.all([
    db().from('orders').select('id', { count: 'exact', head: true }).eq('channel', 'online').in('status', OPEN_STATUSES),
    db().from('orders').select('id', { count: 'exact', head: true }).eq('channel', 'online').neq('status', 'cancelled').eq('payment_status', 'pending'),
    db().from('product_variants').select('stock, low_stock_threshold').eq('active', true),
  ]);
  fail(open.error ?? unpaid.error ?? variants.error);
  return {
    openOrders: open.count ?? 0,
    unpaidOrders: unpaid.count ?? 0,
    lowStock: (variants.data ?? []).filter((v) => v.stock <= v.low_stock_threshold).length,
  };
}

// ---------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------
export interface OrderFilters {
  status?: OrderStatus | 'all' | 'open';
  channel?: OrderChannel | 'all';
  payment?: PaymentStatus | 'all';
  search?: string;
  from?: Date;
  to?: Date;
  cashSessionId?: string;
  limit?: number;
}

const ORDER_SELECT = '*, cashier:profiles!orders_cashier_id_fkey(full_name), items:order_items(*, cost:order_item_costs(unit_cost_mxn))';
const ORDER_DETAIL_SELECT = `${ORDER_SELECT}, payments:order_payments(*), history:order_status_history(*, by:profiles(full_name))`;

type OrderRow = Omit<AdminOrder, 'items' | 'history'> & {
  cashier?: { full_name: string | null } | null;
  items: (AdminOrder['items'][number] & { cost?: { unit_cost_mxn: number } | null })[];
  history?: (NonNullable<AdminOrder['history']>[number] & { by?: { full_name: string | null } | null })[];
};

function mapOrder(row: OrderRow): AdminOrder {
  const { cashier, ...rest } = row;
  return {
    ...rest,
    cashier_name: cashier?.full_name ?? null,
    items: row.items.map(({ cost, ...i }) => ({ ...i, unit_cost_mxn: cost?.unit_cost_mxn ?? null })),
    history: row.history
      ?.map(({ by, ...h }) => ({ ...h, by_name: by?.full_name ?? null }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

export async function fetchOrders(f: OrderFilters = {}): Promise<AdminOrder[]> {
  const search = f.search?.trim().replace(/[,()%#]/g, ' ').trim();
  if (isDemo) {
    const user = me();
    let list = snapshot().orders;
    if (f.status === 'open') list = list.filter((o) => OPEN_STATUSES.includes(o.status) && o.channel === 'online');
    else if (f.status && f.status !== 'all') list = list.filter((o) => o.status === f.status);
    if (f.channel && f.channel !== 'all') list = list.filter((o) => o.channel === f.channel);
    if (f.payment && f.payment !== 'all') list = list.filter((o) => o.payment_status === f.payment);
    if (f.from) list = list.filter((o) => Date.parse(o.created_at) >= f.from!.getTime());
    if (f.to) list = list.filter((o) => Date.parse(o.created_at) < f.to!.getTime());
    if (f.cashSessionId) list = list.filter((o) => o.cash_session_id === f.cashSessionId);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((o) => String(o.folio).includes(s) || [o.customer_name, o.customer_phone, o.customer_email].join(' ').toLowerCase().includes(s));
    }
    if (user?.role !== 'admin') list = list.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i, unit_cost_mxn: null })) }));
    return list.slice(0, f.limit ?? 200);
  }

  let query = db().from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(f.limit ?? 200);
  if (f.status === 'open') query = query.in('status', OPEN_STATUSES).eq('channel', 'online');
  else if (f.status && f.status !== 'all') query = query.eq('status', f.status);
  if (f.channel && f.channel !== 'all') query = query.eq('channel', f.channel);
  if (f.payment && f.payment !== 'all') query = query.eq('payment_status', f.payment);
  if (f.from) query = query.gte('created_at', f.from.toISOString());
  if (f.to) query = query.lt('created_at', f.to.toISOString());
  if (f.cashSessionId) query = query.eq('cash_session_id', f.cashSessionId);
  if (search) {
    query = /^\d+$/.test(search)
      ? query.or(`folio.eq.${search},customer_phone.ilike.%${search}%`)
      : query.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
  }
  const { data, error } = await query;
  fail(error);
  return (data as unknown as OrderRow[]).map(mapOrder);
}

export async function fetchOrder(id: string): Promise<AdminOrder | null> {
  if (isDemo) {
    const order = snapshot().orders.find((o) => o.id === id) ?? null;
    if (order && me()?.role !== 'admin') order.items = order.items.map((i) => ({ ...i, unit_cost_mxn: null }));
    return order;
  }
  const { data, error } = await db().from('orders').select(ORDER_DETAIL_SELECT).eq('id', id).maybeSingle();
  fail(error);
  return data ? mapOrder(data as unknown as OrderRow) : null;
}

export async function setOrderStatus(id: string, status: OrderStatus, note?: string) {
  if (isDemo) {
    return mutate((d) => {
      if (status === 'cancelled') return demoCancelOrder(d, id, note ?? null, me());
      const order = d.orders.find((o) => o.id === id);
      if (!order || order.status === 'cancelled') throw new Error('Pedido no encontrado o cancelado');
      order.status = status;
      order.history = [{ id: uid(), status, note: note ?? null, by_name: me()?.full_name ?? null, created_at: new Date().toISOString() }, ...(order.history ?? [])];
    });
  }
  const { error } = await db().rpc('update_order_status', { p_order_id: id, p_status: status, p_note: note ?? null });
  fail(error);
}

export async function confirmPayment(id: string, method?: PaymentMethod, reference?: string) {
  if (isDemo) {
    return mutate((d) => {
      const order = d.orders.find((o) => o.id === id);
      if (!order) throw new Error('Pedido no encontrado');
      if (order.payment_status === 'paid') return;
      const now = new Date().toISOString();
      order.payment_status = 'paid';
      order.payment_method = method ?? order.payment_method;
      if (order.payment_method !== 'mercadopago' && order.payment_fee) {
        order.total = Math.round((order.total - order.payment_fee) * 100) / 100;
        order.total_mxn = order.currency === 'MXN' ? order.total : Math.round(order.total * order.exchange_rate * 100) / 100;
        order.payment_fee = 0;
      }
      order.transfer_reference = reference ?? order.transfer_reference;
      order.paid_at = now;
      order.payments = [...(order.payments ?? []), { id: uid(), method: order.payment_method, amount: order.total, currency: order.currency, reference: reference ?? null, created_at: now }];
      if (order.status === 'pending') order.status = 'confirmed';
      order.history = [{ id: uid(), status: order.status, note: 'Pago confirmado', by_name: me()?.full_name ?? null, created_at: now }, ...(order.history ?? [])];
    });
  }
  const { error } = await db().rpc('mark_order_paid', { p_order_id: id, p_method: method ?? null, p_reference: reference ?? null });
  fail(error);
}

export async function cancelOrder(id: string, reason?: string) {
  if (isDemo) {
    if (me()?.role !== 'admin') throw new Error('Solo un administrador puede cancelar pedidos');
    return mutate((d) => demoCancelOrder(d, id, reason ?? null, me()));
  }
  const { error } = await db().rpc('cancel_order', { p_order_id: id, p_reason: reason ?? null });
  fail(error);
}

export async function saveOrderNotes(id: string, internal_notes: string) {
  if (isDemo) {
    return mutate((d) => {
      const order = d.orders.find((o) => o.id === id);
      if (order) order.internal_notes = internal_notes || null;
    });
  }
  const { error } = await db().from('orders').update({ internal_notes: internal_notes || null }).eq('id', id);
  fail(error);
}

// ---------------------------------------------------------------------
// Productos y categorías
// ---------------------------------------------------------------------
const ADMIN_PRODUCT_SELECT = '*, category:categories(name, slug), variants:product_variants(*), cost:product_costs(cost_mxn, supplier)';

export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  if (isDemo) {
    const d = snapshot();
    const admin = me()?.role === 'admin';
    return d.products.map((p) => ({
      ...p,
      variants: [...p.variants].sort((a, b) => a.sort_order - b.sort_order),
      cost_mxn: admin ? d.costs[p.id]?.cost_mxn ?? null : null,
      supplier: admin ? d.costs[p.id]?.supplier ?? null : null,
    }));
  }
  const { data, error } = await db().from('products').select(ADMIN_PRODUCT_SELECT).order('created_at', { ascending: false });
  fail(error);
  return (data as unknown as (Product & { cost: { cost_mxn: number; supplier: string | null } | null })[]).map(({ cost, ...p }) => ({
    ...p,
    images: p.images ?? [],
    variants: [...(p.variants ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    cost_mxn: cost?.cost_mxn ?? null,
    supplier: cost?.supplier ?? null,
  }));
}

export async function saveProduct(input: ProductInput): Promise<string> {
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
  if (!input.name.trim()) throw new Error('El nombre es obligatorio');
  if (!slug) throw new Error('Escribe un nombre válido');
  if (input.variants.length === 0) throw new Error('Agrega al menos una variante');
  const codes = input.variants.flatMap((v) => [v.sku, v.barcode]).filter(Boolean);
  if (new Set(codes).size !== codes.length) throw new Error('Hay SKU o códigos de barras repetidos entre las variantes');

  if (!isDemo) {
    const payload: Record<string, unknown> = { ...input, slug, variants: input.variants.map((v, i) => ({ ...v, sort_order: i + 1 })) };
    if (input.cost_mxn === undefined) delete payload.cost_mxn;
    const { data, error } = await db().rpc('save_product', { p: payload });
    fail(error);
    return data as string;
  }

  return mutate((d) => {
    const actor = me();
    if (d.products.some((p) => p.slug === slug && p.id !== input.id)) throw new Error('Ya existe un producto con esa URL (slug)');
    const otherVariants = d.products.flatMap((p) => p.variants).filter((v) => !input.variants.some((iv) => iv.id === v.id));
    for (const v of input.variants) {
      if (v.sku && otherVariants.some((o) => o.sku === v.sku)) throw new Error(`El SKU ${v.sku} ya está en uso por otro producto`);
      if (v.barcode && otherVariants.some((o) => o.barcode === v.barcode)) throw new Error(`El código ${v.barcode} ya está en uso`);
    }

    const category = d.categories.find((c) => c.id === input.category_id) ?? null;
    const fields = {
      name: input.name.trim(),
      slug,
      description: input.description.trim() || null,
      category_id: category?.id ?? null,
      category: category ? { name: category.name, slug: category.slug } : null,
      brand: input.brand.trim() || null,
      price_mxn: input.price_mxn,
      price_usd: input.price_usd,
      compare_at_mxn: input.compare_at_mxn,
      compare_at_usd: input.compare_at_usd,
      images: input.images,
      tags: input.tags,
      featured: input.featured,
      is_new: input.is_new,
      active: input.active,
    };

    let product = input.id ? d.products.find((p) => p.id === input.id) : undefined;
    if (input.id && !product) throw new Error('Producto no encontrado');
    if (!product) {
      product = { id: uid(), ...fields, rating_avg: 0, rating_count: 0, created_at: new Date().toISOString(), variants: [] };
      d.products.unshift(product);
    } else {
      Object.assign(product, fields);
    }

    const target = product;
    const initialStock: [string, number][] = [];
    const kept: Variant[] = input.variants.map((v, i) => {
      const values = {
        name: v.name.trim() || 'Única',
        size: v.size?.trim() || null,
        color: v.color?.trim() || null,
        color_hex: v.color_hex || null,
        sku: v.sku?.trim() || null,
        barcode: v.barcode?.trim() || null,
        low_stock_threshold: v.low_stock_threshold,
        price_mxn: v.price_mxn,
        price_usd: v.price_usd,
        sort_order: i + 1,
        active: v.active,
      };
      const existing = v.id ? target.variants.find((x) => x.id === v.id) : undefined;
      if (existing) return Object.assign(existing, values);
      const created: Variant = { id: uid(), product_id: target.id, stock: 0, ...values };
      if (v.stock > 0) initialStock.push([created.id, v.stock]);
      return created;
    });
    const soldIds = new Set(d.orders.flatMap((o) => o.items.map((i) => i.variant_id)));
    const removedSold = target.variants.filter((v) => !kept.includes(v) && soldIds.has(v.id)).map((v) => ({ ...v, active: false }));
    target.variants = [...kept, ...removedSold];
    for (const [id, qty] of initialStock) recordMovement(d, id, qty, 'restock', { note: 'Inventario inicial', actor });

    if (actor?.role === 'admin' && input.cost_mxn !== undefined) {
      d.costs[target.id] = { cost_mxn: Math.max(input.cost_mxn ?? 0, 0), supplier: input.supplier?.trim() || null };
    }
    return target.id;
  });
}

export async function setProductFlags(id: string, patch: Partial<Pick<Product, 'active' | 'featured' | 'is_new'>>) {
  if (isDemo) {
    return mutate((d) => {
      const product = d.products.find((p) => p.id === id);
      if (product) Object.assign(product, patch);
    });
  }
  const { error } = await db().from('products').update(patch).eq('id', id);
  fail(error);
}

export async function deleteProduct(id: string) {
  if (isDemo) {
    return mutate((d) => {
      if (d.orders.some((o) => o.items.some((i) => i.product_id === id))) {
        throw new Error('Este producto ya tiene ventas; archívalo en lugar de borrarlo');
      }
      const product = d.products.find((p) => p.id === id);
      const variantIds = new Set(product?.variants.map((v) => v.id));
      d.products = d.products.filter((p) => p.id !== id);
      d.movements = d.movements.filter((m) => !variantIds.has(m.variant_id));
      delete d.costs[id];
    });
  }
  const { error } = await db().from('products').delete().eq('id', id);
  fail(error);
}

async function compressImage(file: File, max: number, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', quality));
}

export async function uploadImage(file: File, folder = 'products'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen');
  if (isDemo) {
    const blob = await compressImage(file, 900, 0.78);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(blob);
    });
  }
  const blob = await compressImage(file, 1600);
  const path = `${folder}/${uid()}.jpg`;
  const storage = db().storage.from('media');
  const { error } = await storage.upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  fail(error);
  return storage.getPublicUrl(path).data.publicUrl;
}

export async function fetchAdminCategories(): Promise<Category[]> {
  if (isDemo) return snapshot().categories.sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await db().from('categories').select('*').order('sort_order');
  fail(error);
  return data as Category[];
}

export async function saveCategory(input: Partial<Category> & { name: string }) {
  const values = {
    name: input.name.trim(),
    slug: slugify(input.slug || input.name),
    description: input.description?.trim() || null,
    image_url: input.image_url || null,
    sort_order: input.sort_order ?? 0,
    active: input.active ?? true,
  };
  if (!values.name) throw new Error('El nombre es obligatorio');
  if (isDemo) {
    return mutate((d) => {
      if (d.categories.some((c) => c.slug === values.slug && c.id !== input.id)) throw new Error('Ya existe una categoría con ese nombre');
      const existing = input.id ? d.categories.find((c) => c.id === input.id) : undefined;
      if (existing) Object.assign(existing, values);
      else d.categories.push({ id: uid(), ...values, sort_order: values.sort_order || d.categories.length + 1 });
      for (const p of d.products) {
        const c = d.categories.find((x) => x.id === p.category_id);
        p.category = c ? { name: c.name, slug: c.slug } : null;
      }
    });
  }
  const { error } = input.id
    ? await db().from('categories').update(values).eq('id', input.id)
    : await db().from('categories').insert(values);
  fail(error);
}

export async function deleteCategory(id: string) {
  if (isDemo) {
    return mutate((d) => {
      d.categories = d.categories.filter((c) => c.id !== id);
      for (const p of d.products) if (p.category_id === id) Object.assign(p, { category_id: null, category: null });
    });
  }
  const { error } = await db().from('categories').delete().eq('id', id);
  fail(error);
}

// ---------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------
type MovementRow = InventoryMovement & {
  variant?: { name: string; product: { name: string } | null } | null;
  user?: { full_name: string | null } | null;
};

export async function fetchMovements(opts: { variantId?: string; limit?: number } = {}): Promise<InventoryMovement[]> {
  if (isDemo) {
    let list = snapshot().movements;
    if (opts.variantId) list = list.filter((m) => m.variant_id === opts.variantId);
    return list.slice(0, opts.limit ?? 100);
  }
  let query = db()
    .from('inventory_movements')
    .select('*, variant:product_variants(name, product:products(name)), user:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.variantId) query = query.eq('variant_id', opts.variantId);
  const { data, error } = await query;
  fail(error);
  return (data as unknown as MovementRow[]).map(({ variant, user, ...m }) => ({
    ...m,
    product_name: variant?.product?.name ?? null,
    variant_name: variant?.name ?? null,
    user_name: user?.full_name ?? null,
  }));
}

export async function adjustStock(variantId: string, change: number, reason: MovementReason, note?: string): Promise<number> {
  if (!Number.isInteger(change) || change === 0) throw new Error('Indica una cantidad distinta de cero');
  if (isDemo) return mutate((d) => recordMovement(d, variantId, change, reason, { note: note || null, actor: me() }));
  const { data, error } = await db().rpc('adjust_stock', { p_variant_id: variantId, p_change: change, p_reason: reason, p_note: note || null });
  fail(error);
  return data as number;
}

export async function setStock(variantId: string, stock: number, note = 'Conteo físico'): Promise<number> {
  if (!Number.isInteger(stock) || stock < 0) throw new Error('El stock debe ser un número entero positivo');
  if (isDemo) {
    return mutate((d) => {
      const found = findVariant(d, variantId);
      if (!found) throw new Error('Variante no encontrada');
      const change = stock - found.variant.stock;
      return change === 0 ? stock : recordMovement(d, variantId, change, 'adjustment', { note, actor: me() });
    });
  }
  const { data, error } = await db().rpc('set_stock', { p_variant_id: variantId, p_stock: stock, p_note: note });
  fail(error);
  return data as number;
}

// ---------------------------------------------------------------------
// Caja
// ---------------------------------------------------------------------
type SessionRow = CashSession & { opener?: { full_name: string | null } | null };
const SESSION_SELECT = '*, opener:profiles!cash_sessions_opened_by_fkey(full_name)';
const mapSession = ({ opener, ...s }: SessionRow): CashSession => ({ ...s, opened_by_name: opener?.full_name ?? null });

export async function fetchOpenSession(userId: string): Promise<CashSession | null> {
  if (isDemo) return snapshot().cashSessions.find((s) => s.opened_by === userId && s.status === 'open') ?? null;
  const { data, error } = await db().from('cash_sessions').select(SESSION_SELECT).eq('opened_by', userId).eq('status', 'open').maybeSingle();
  fail(error);
  return data ? mapSession(data as SessionRow) : null;
}

export async function openCashSession(userId: string, opening_mxn: number, opening_usd: number): Promise<CashSession> {
  if (opening_mxn < 0 || opening_usd < 0) throw new Error('El fondo no puede ser negativo');
  if (isDemo) {
    return mutate((d) => {
      if (d.cashSessions.some((s) => s.opened_by === userId && s.status === 'open')) throw new Error('Ya tienes una caja abierta');
      const session: CashSession = {
        id: uid(), opened_by: userId, opened_by_name: me()?.full_name ?? null, opened_at: new Date().toISOString(),
        opening_mxn, opening_usd, closed_at: null, expected_mxn: null, expected_usd: null, counted_mxn: null,
        counted_usd: null, notes: null, status: 'open',
      };
      d.cashSessions.unshift(session);
      return session;
    });
  }
  const { data, error } = await db().from('cash_sessions').insert({ opened_by: userId, opening_mxn, opening_usd }).select(SESSION_SELECT).single();
  if (error?.code === '23505') throw new Error('Ya tienes una caja abierta');
  fail(error);
  return mapSession(data as SessionRow);
}

export async function fetchCashSessions(limit = 40): Promise<CashSession[]> {
  if (isDemo) return snapshot().cashSessions.slice(0, limit);
  const { data, error } = await db().from('cash_sessions').select(SESSION_SELECT).order('opened_at', { ascending: false }).limit(limit);
  fail(error);
  return (data as SessionRow[]).map(mapSession);
}

export async function fetchCashMovements(sessionId: string): Promise<CashMovement[]> {
  if (isDemo) return snapshot().cashMovements.filter((m) => m.session_id === sessionId);
  const { data, error } = await db().from('cash_movements').select('*').eq('session_id', sessionId).order('created_at', { ascending: false });
  fail(error);
  return data as CashMovement[];
}

export async function addCashMovement(sessionId: string, userId: string, kind: 'in' | 'out', amount: number, currency: Currency, reason: string) {
  if (!(amount > 0)) throw new Error('Indica un monto mayor a cero');
  if (isDemo) {
    return mutate((d) => {
      d.cashMovements.unshift({ id: uid(), session_id: sessionId, kind, amount, currency, reason: reason || null, created_at: new Date().toISOString() });
    });
  }
  const { error } = await db().from('cash_movements').insert({ session_id: sessionId, user_id: userId, kind, amount, currency, reason: reason || null });
  fail(error);
}

export async function fetchCashSummary(sessionId: string): Promise<CashSummary> {
  if (isDemo) return demoCashSummary(snapshot(), sessionId);
  const { data, error } = await db().rpc('cash_session_summary', { p_session_id: sessionId });
  fail(error);
  const summary = data as CashSummary;
  return { ...summary, session: { ...summary.session, opened_by_name: null } };
}

export async function closeCashSession(sessionId: string, counted_mxn: number, counted_usd: number, notes: string): Promise<CashSession> {
  if (isDemo) {
    return mutate((d) => {
      const session = d.cashSessions.find((s) => s.id === sessionId && s.status === 'open');
      if (!session) throw new Error('Caja no encontrada o ya cerrada');
      const summary = demoCashSummary(d, sessionId);
      Object.assign(session, {
        status: 'closed', closed_at: new Date().toISOString(), counted_mxn, counted_usd, notes: notes || null,
        expected_mxn: summary.expected_mxn, expected_usd: summary.expected_usd,
      });
      return session;
    });
  }
  const { data, error } = await db().rpc('close_cash_session', { p_session_id: sessionId, p_counted_mxn: counted_mxn, p_counted_usd: counted_usd, p_notes: notes || null });
  fail(error);
  return data as CashSession;
}

// ---------------------------------------------------------------------
// Punto de venta
// ---------------------------------------------------------------------
export async function createPosSale(payload: PosSalePayload): Promise<AdminOrder> {
  if (isDemo) return mutate((d) => demoCreateOrder(d, payload, { actor: me() }));
  const { data, error } = await db().rpc('create_order', { p: payload });
  fail(error);
  const order = await fetchOrder((data as { id: string }).id);
  if (!order) throw new Error('La venta se registró pero no se pudo cargar el ticket');
  return order;
}

// ---------------------------------------------------------------------
// Reseñas
// ---------------------------------------------------------------------
export async function fetchAdminReviews(): Promise<AdminReview[]> {
  if (isDemo) return snapshot().reviews;
  const { data, error } = await db().from('reviews').select('*, product:products(name)').order('created_at', { ascending: false }).limit(300);
  fail(error);
  return (data as (AdminReview & { product: { name: string } | null })[]).map(({ product, ...r }) => ({ ...r, product_name: product?.name ?? null }));
}

export async function updateReview(id: string, patch: Partial<Pick<AdminReview, 'status' | 'admin_reply'>>) {
  if (isDemo) {
    return mutate((d) => {
      const review = d.reviews.find((r) => r.id === id);
      if (review) Object.assign(review, patch);
    });
  }
  const { error } = await db().from('reviews').update(patch).eq('id', id);
  fail(error);
}

export async function deleteReview(id: string) {
  if (isDemo) return mutate((d) => { d.reviews = d.reviews.filter((r) => r.id !== id); });
  const { error } = await db().from('reviews').delete().eq('id', id);
  fail(error);
}

// ---------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------
export async function fetchAdminBanners(): Promise<AdminBanner[]> {
  if (isDemo) return snapshot().banners.sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await db().from('banners').select('*').order('sort_order');
  fail(error);
  return data as AdminBanner[];
}

export async function saveBanner(input: Partial<AdminBanner> & { title: string; image_url: string }) {
  const values = {
    placement: input.placement ?? 'story',
    eyebrow: input.eyebrow?.trim() || null,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    image_url: input.image_url,
    cta_label: input.cta_label?.trim() || null,
    cta_link: input.cta_link?.trim() || null,
    theme: input.theme ?? 'light',
    sort_order: input.sort_order ?? 99,
    active: input.active ?? true,
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
  };
  if (!values.title) throw new Error('El título es obligatorio');
  if (!values.image_url) throw new Error('Sube una imagen');
  if (isDemo) {
    return mutate((d) => {
      const existing = input.id ? d.banners.find((b) => b.id === input.id) : undefined;
      if (existing) Object.assign(existing, values);
      else d.banners.push({ id: uid(), ...values });
    });
  }
  const { error } = input.id ? await db().from('banners').update(values).eq('id', input.id) : await db().from('banners').insert(values);
  fail(error);
}

export async function deleteBanner(id: string) {
  if (isDemo) return mutate((d) => { d.banners = d.banners.filter((b) => b.id !== id); });
  const { error } = await db().from('banners').delete().eq('id', id);
  fail(error);
}

export async function reorderBanners(ids: string[]) {
  if (isDemo) {
    return mutate((d) => {
      ids.forEach((id, i) => {
        const b = d.banners.find((x) => x.id === id);
        if (b) b.sort_order = i + 1;
      });
    });
  }
  const results = await Promise.all(ids.map((id, i) => db().from('banners').update({ sort_order: i + 1 }).eq('id', id)));
  fail(results.find((r) => r.error)?.error ?? null);
}

// ---------------------------------------------------------------------
// Cupones
// ---------------------------------------------------------------------
export async function fetchCoupons(): Promise<Coupon[]> {
  if (isDemo) return snapshot().coupons;
  const { data, error } = await db().from('coupons').select('*').order('created_at', { ascending: false });
  fail(error);
  return data as Coupon[];
}

export async function saveCoupon(input: Partial<Coupon> & { code: string; kind: Coupon['kind']; value: number }) {
  const values = {
    code: input.code.trim().toUpperCase().replace(/\s+/g, ''),
    kind: input.kind,
    value: input.value,
    min_subtotal_mxn: input.min_subtotal_mxn ?? 0,
    max_uses: input.max_uses ?? null,
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    active: input.active ?? true,
  };
  if (!values.code) throw new Error('Escribe el código');
  if (!(values.value > 0)) throw new Error('El valor debe ser mayor a cero');
  if (values.kind === 'percent' && values.value > 100) throw new Error('El porcentaje no puede ser mayor a 100');
  if (isDemo) {
    return mutate((d) => {
      if (d.coupons.some((c) => c.code === values.code && c.id !== input.id)) throw new Error('Ese código ya existe');
      const existing = input.id ? d.coupons.find((c) => c.id === input.id) : undefined;
      if (existing) Object.assign(existing, values);
      else d.coupons.unshift({ id: uid(), used_count: 0, ...values });
    });
  }
  const { error } = input.id ? await db().from('coupons').update(values).eq('id', input.id) : await db().from('coupons').insert(values);
  if (error?.code === '23505') throw new Error('Ese código ya existe');
  fail(error);
}

export async function deleteCoupon(id: string) {
  if (isDemo) return mutate((d) => { d.coupons = d.coupons.filter((c) => c.id !== id); });
  const { error } = await db().from('coupons').delete().eq('id', id);
  fail(error);
}

// ---------------------------------------------------------------------
// Equipo
// ---------------------------------------------------------------------
export async function fetchTeam(): Promise<TeamMember[]> {
  if (isDemo) return snapshot().team;
  const { data, error } = await db().from('profiles').select('*').order('created_at', { ascending: true });
  fail(error);
  return data as TeamMember[];
}

export async function updateMember(id: string, patch: { role?: Role; active?: boolean }) {
  if (isDemo) {
    return mutate((d) => {
      const m = d.team.find((x) => x.id === id);
      if (m) Object.assign(m, patch);
    });
  }
  const { error } = await db().from('profiles').update(patch).eq('id', id);
  fail(error);
}

// ---------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------
export async function saveSettings(patch: Partial<StoreSettings>) {
  if (patch.exchange_rate !== undefined && !(patch.exchange_rate > 0)) throw new Error('El tipo de cambio debe ser mayor a cero');
  if (isDemo) return mutate((d) => { Object.assign(d.settings, patch); });
  const { error } = await db().from('store_settings').update(patch).eq('id', 1);
  fail(error);
}
