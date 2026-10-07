import { db, isDemo } from './supabase';
import { demoCreateOrder, demoDb, demoUser, demoValidateCoupon, persist, snapshot, uid } from './demo-db';
import type {
  Banner, Category, CheckoutPayload, CreatedOrder, OrderSummary, Product, Review, StoreSettings,
} from './types';

const PRODUCT_SELECT = '*, category:categories(name, slug), variants:product_variants(*)';

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

function normalizeProduct(p: Product): Product {
  return {
    ...p,
    images: p.images ?? [],
    variants: [...(p.variants ?? [])].filter((v) => v.active).sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function fetchSettings(): Promise<StoreSettings> {
  if (isDemo) return snapshot().settings;
  const { data, error } = await db().from('store_settings').select('*').eq('id', 1).single();
  fail(error);
  return data as StoreSettings;
}

export async function fetchCategories(): Promise<Category[]> {
  if (isDemo) return snapshot().categories.filter((c) => c.active).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await db().from('categories').select('*').eq('active', true).order('sort_order');
  fail(error);
  return data as Category[];
}

export type ProductSort = 'featured' | 'new' | 'price-asc' | 'price-desc' | 'rating';

export interface ProductFilters {
  category?: string;
  search?: string;
  featured?: boolean;
  sort?: ProductSort;
  limit?: number;
}

function sortProducts(list: Product[], sort: ProductSort = 'featured') {
  const copy = [...list];
  switch (sort) {
    case 'new': return copy.sort((a, b) => Number(b.is_new) - Number(a.is_new) || b.created_at.localeCompare(a.created_at));
    case 'price-asc': return copy.sort((a, b) => a.price_mxn - b.price_mxn);
    case 'price-desc': return copy.sort((a, b) => b.price_mxn - a.price_mxn);
    case 'rating': return copy.sort((a, b) => b.rating_avg - a.rating_avg);
    default: return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const search = filters.search?.replace(/[,()%]/g, ' ').trim();

  if (isDemo) {
    let list = snapshot().products.filter((p) => p.active).map(normalizeProduct);
    if (filters.category) list = list.filter((p) => p.category?.slug === filters.category);
    if (filters.featured) list = list.filter((p) => p.featured);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) => [p.name, p.brand, p.description, ...p.tags].join(' ').toLowerCase().includes(s));
    }
    list = sortProducts(list, filters.sort);
    return filters.limit ? list.slice(0, filters.limit) : list;
  }

  const select = filters.category ? PRODUCT_SELECT.replace('categories(', 'categories!inner(') : PRODUCT_SELECT;
  let query = db().from('products').select(select).eq('active', true);
  if (filters.category) query = query.eq('category.slug', filters.category);
  if (filters.featured) query = query.eq('featured', true);
  if (search) query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,description.ilike.%${search}%`);

  switch (filters.sort) {
    case 'new': query = query.order('is_new', { ascending: false }).order('created_at', { ascending: false }); break;
    case 'price-asc': query = query.order('price_mxn', { ascending: true }); break;
    case 'price-desc': query = query.order('price_mxn', { ascending: false }); break;
    case 'rating': query = query.order('rating_avg', { ascending: false }); break;
    default: query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
  }
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  fail(error);
  return (data as unknown as Product[]).map(normalizeProduct);
}

export async function fetchProduct(slug: string): Promise<Product | null> {
  if (isDemo) {
    const found = snapshot().products.find((p) => p.slug === slug && p.active);
    return found ? normalizeProduct(found) : null;
  }
  const { data, error } = await db().from('products').select(PRODUCT_SELECT).eq('slug', slug).maybeSingle();
  fail(error);
  return data ? normalizeProduct(data as unknown as Product) : null;
}

export async function fetchBanners(): Promise<Banner[]> {
  if (isDemo) {
    const now = Date.now();
    return snapshot().banners
      .filter((b) => b.active && (!b.starts_at || Date.parse(b.starts_at) <= now) && (!b.ends_at || Date.parse(b.ends_at) >= now))
      .sort((a, b) => a.sort_order - b.sort_order);
  }
  const now = new Date().toISOString();
  const { data, error } = await db().from('banners').select('*').eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`).order('sort_order');
  fail(error);
  return data as Banner[];
}

export async function fetchReviews(productId: string | null, limit = 20): Promise<Review[]> {
  if (isDemo) {
    return snapshot().reviews
      .filter((r) => r.status === 'published' && (productId ? r.product_id === productId : true))
      .slice(0, limit);
  }
  let query = db().from('reviews').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(limit);
  if (productId) query = query.eq('product_id', productId);
  const { data, error } = await query;
  fail(error);
  return data as Review[];
}

export async function submitReview(input: { product_id: string | null; user_id: string; rating: number; title?: string; body?: string }) {
  if (isDemo) {
    const data = demoDb();
    const product = data.products.find((p) => p.id === input.product_id);
    data.reviews = data.reviews.filter((r) => !(r.product_id === input.product_id && r.user_id === input.user_id));
    data.reviews.unshift({
      id: uid(), author_name: demoUser()?.full_name ?? 'Cliente', images: [], verified_purchase: false, admin_reply: null,
      status: 'published', product_name: product?.name ?? null, created_at: new Date().toISOString(),
      ...input, title: input.title ?? null, body: input.body ?? null,
    });
    persist();
    return;
  }
  const { error } = await db().from('reviews').upsert(input, { onConflict: 'product_id,user_id' });
  fail(error);
}

export async function validateCoupon(code: string, subtotalMxn: number) {
  if (isDemo) return demoValidateCoupon(demoDb(), code, subtotalMxn);
  const { data, error } = await db().rpc('validate_coupon', { p_code: code, p_subtotal_mxn: subtotalMxn });
  fail(error);
  return data as { valid: true; code: string; kind: 'percent' | 'fixed'; value: number } | { valid: false; message: string };
}

const MY_ORDERS_KEY = 'shoppely-my-orders';

function readMyTokens(): string[] {
  try { return JSON.parse(localStorage.getItem(MY_ORDERS_KEY) ?? '[]'); } catch { return []; }
}

export async function createOrder(payload: CheckoutPayload): Promise<CreatedOrder> {
  if (!isDemo) {
    const { data, error } = await db().rpc('create_order', { p: payload });
    fail(error);
    return data as CreatedOrder;
  }
  const data = demoDb();
  const order = demoCreateOrder(data, payload, { actor: demoUser() });
  persist();
  localStorage.setItem(MY_ORDERS_KEY, JSON.stringify([order.public_token, ...readMyTokens()]));
  return { id: order.id, folio: order.folio, public_token: order.public_token, total: order.total, payment_fee: order.payment_fee, currency: order.currency };
}

export async function fetchOrderByToken(token: string): Promise<OrderSummary | null> {
  if (isDemo) return snapshot().orders.find((o) => o.public_token === token) ?? null;
  const { data, error } = await db().rpc('get_order_by_token', { p_token: token });
  fail(error);
  return (data as OrderSummary | null) ?? null;
}

export async function startMercadoPago(token: string): Promise<string> {
  if (isDemo) throw new Error('Mercado Pago se activa al conectar Supabase y tus credenciales de Mercado Pago.');
  const { data, error } = await db().functions.invoke('mp-create-preference', { body: { token } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.init_point as string;
}

export async function fetchMyOrders(userId: string): Promise<OrderSummary[]> {
  if (isDemo) {
    const tokens = readMyTokens();
    return snapshot().orders.filter((o) => o.customer_id === userId || tokens.includes(o.public_token));
  }
  const { data, error } = await db()
    .from('orders')
    .select('id, folio, public_token, status, payment_status, payment_method, currency, subtotal, discount, shipping, payment_fee, total, total_mxn, delivery_method, customer_name, created_at, items:order_items(product_name, variant_name, quantity, unit_price, line_total, image_url)')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  fail(error);
  return data as unknown as OrderSummary[];
}

const DEMO_FAVS_KEY = 'shoppely-favorites';

export async function fetchFavorites(userId: string | null): Promise<string[]> {
  if (isDemo || !userId) {
    try { return JSON.parse(localStorage.getItem(DEMO_FAVS_KEY) ?? '[]'); } catch { return []; }
  }
  const { data, error } = await db().from('favorites').select('product_id').eq('user_id', userId);
  fail(error);
  return (data ?? []).map((f: { product_id: string }) => f.product_id);
}

export async function toggleFavorite(userId: string | null, productId: string, isFavorite: boolean) {
  if (isDemo || !userId) {
    const current = await fetchFavorites(null);
    const next = isFavorite ? current.filter((id) => id !== productId) : [...current, productId];
    localStorage.setItem(DEMO_FAVS_KEY, JSON.stringify(next));
    return;
  }
  const query = isFavorite
    ? db().from('favorites').delete().eq('user_id', userId).eq('product_id', productId)
    : db().from('favorites').insert({ user_id: userId, product_id: productId });
  const { error } = await query;
  fail(error);
}
