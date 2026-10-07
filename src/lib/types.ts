export type Role = 'admin' | 'inventory' | 'seller' | 'customer';
export type Currency = 'MXN' | 'USD';
export type PaymentMethod = 'cash' | 'transfer' | 'mercadopago' | 'mixed';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
export type DeliveryMethod = 'shipping' | 'pickup';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
}

export interface Variant {
  id: string;
  product_id: string;
  name: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  low_stock_threshold: number;
  price_mxn: number | null;
  price_usd: number | null;
  sort_order: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  brand: string | null;
  price_mxn: number;
  price_usd: number | null;
  compare_at_mxn: number | null;
  compare_at_usd: number | null;
  images: string[];
  tags: string[];
  featured: boolean;
  is_new: boolean;
  active: boolean;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  category: Pick<Category, 'name' | 'slug'> | null;
  variants: Variant[];
}

export interface Banner {
  id: string;
  placement: 'hero' | 'story' | 'promo';
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  image_url: string;
  cta_label: string | null;
  cta_link: string | null;
  theme: 'light' | 'dark' | 'pink';
  sort_order: number;
}

export interface StoreSettings {
  store_name: string;
  tagline: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  contact_email: string | null;
  address: string | null;
  default_currency: Currency;
  exchange_rate: number;
  shipping_fee_mxn: number;
  free_shipping_min_mxn: number | null;
  cash_enabled: boolean;
  transfer_enabled: boolean;
  mercadopago_enabled: boolean;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_clabe: string | null;
  bank_account_number: string | null;
  transfer_instructions: string | null;
  mp_fee_online_enabled: boolean;
  mp_fee_online_percent: number;
  mp_fee_online_fixed_mxn: number;
  mp_fee_pos_enabled: boolean;
  mp_fee_pos_percent: number;
  mp_fee_pos_fixed_mxn: number;
  mp_fee_iva: number;
}

export interface Review {
  id: string;
  product_id: string | null;
  user_id: string;
  author_name: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  verified_purchase: boolean;
  admin_reply: string | null;
  created_at: string;
}

export interface OrderItemSummary {
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  image_url: string | null;
}

export interface OrderSummary {
  id: string;
  folio: number;
  public_token: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  currency: Currency;
  subtotal: number;
  discount: number;
  shipping: number;
  payment_fee: number;
  total: number;
  total_mxn: number;
  delivery_method: DeliveryMethod;
  customer_name: string | null;
  created_at: string;
  items: OrderItemSummary[];
}

export interface CheckoutPayload {
  channel: 'online';
  currency: Currency;
  items: { variant_id: string; quantity: number }[];
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_method: DeliveryMethod;
  shipping_address?: Record<string, string>;
  payment_method: Exclude<PaymentMethod, 'mixed'>;
  coupon_code?: string;
  notes?: string;
}

export interface CreatedOrder {
  id: string;
  folio: number;
  public_token: string;
  total: number;
  payment_fee?: number;
  currency: Currency;
  change_given?: number | null;
}

// ---------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------
export type OrderChannel = 'online' | 'pos';
export type MovementReason = 'sale' | 'return' | 'restock' | 'adjustment' | 'damage' | 'cancel';
export type SinglePaymentMethod = Exclude<PaymentMethod, 'mixed'>;

export interface AdminProduct extends Product {
  cost_mxn: number | null;
  supplier: string | null;
}

export interface ProductInput {
  id?: string;
  name: string;
  slug?: string;
  description: string;
  category_id: string | null;
  brand: string;
  price_mxn: number;
  price_usd: number | null;
  compare_at_mxn: number | null;
  compare_at_usd: number | null;
  images: string[];
  tags: string[];
  featured: boolean;
  is_new: boolean;
  active: boolean;
  cost_mxn?: number | null;
  supplier?: string | null;
  variants: VariantInput[];
}

export interface VariantInput {
  id?: string;
  name: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  low_stock_threshold: number;
  price_mxn: number | null;
  price_usd: number | null;
  sort_order: number;
  active: boolean;
}

export interface OrderItem extends OrderItemSummary {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string | null;
  unit_cost_mxn?: number | null;
}

export interface OrderPayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  currency: Currency;
  reference: string | null;
  created_at: string;
}

export interface OrderHistoryEntry {
  id: string;
  status: OrderStatus;
  note: string | null;
  by_name: string | null;
  created_at: string;
}

export interface AdminOrder {
  id: string;
  folio: number;
  public_token: string;
  channel: OrderChannel;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  currency: Currency;
  exchange_rate: number;
  subtotal: number;
  discount: number;
  shipping: number;
  payment_fee: number;
  total: number;
  total_mxn: number;
  coupon_code: string | null;
  delivery_method: DeliveryMethod;
  shipping_address: Record<string, string> | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  internal_notes: string | null;
  transfer_reference: string | null;
  mp_payment_id: string | null;
  amount_received: number | null;
  change_given: number | null;
  cashier_id: string | null;
  cashier_name: string | null;
  cash_session_id: string | null;
  paid_at: string | null;
  created_at: string;
  items: OrderItem[];
  payments?: OrderPayment[];
  history?: OrderHistoryEntry[];
}

export interface InventoryMovement {
  id: string;
  variant_id: string;
  quantity_change: number;
  stock_after: number;
  reason: MovementReason;
  note: string | null;
  order_id: string | null;
  user_name: string | null;
  product_name: string | null;
  variant_name: string | null;
  created_at: string;
}

export interface CashSession {
  id: string;
  opened_by: string;
  opened_by_name: string | null;
  opened_at: string;
  opening_mxn: number;
  opening_usd: number;
  closed_at: string | null;
  expected_mxn: number | null;
  expected_usd: number | null;
  counted_mxn: number | null;
  counted_usd: number | null;
  notes: string | null;
  status: 'open' | 'closed';
}

export interface CashMovement {
  id: string;
  session_id: string;
  kind: 'in' | 'out';
  amount: number;
  currency: Currency;
  reason: string | null;
  created_at: string;
}

export interface CashSummary {
  session: CashSession;
  sales: number;
  cancelled: number;
  total_mxn: number;
  fees_mxn?: number;
  by_method: Partial<Record<PaymentMethod, number>>;
  cash_in_mxn: number;
  cash_out_mxn: number;
  cash_in_usd: number;
  cash_out_usd: number;
  expected_mxn: number;
  expected_usd: number;
}

export interface DashboardStats {
  revenue_mxn: number;
  orders: number;
  avg_ticket_mxn: number;
  online_mxn: number;
  pos_mxn: number;
  items_sold: number;
  by_day: { day: string; revenue_mxn: number; orders: number }[];
  by_hour: Record<string, number>;
  by_method: Partial<Record<PaymentMethod, number>>;
  top_products: { product_id: string | null; product_name: string; image_url: string | null; quantity: number; revenue_mxn: number }[];
  pending_orders: number;
  unpaid_orders: number;
  low_stock: number;
  cost_mxn?: number;
  net_sales_mxn?: number;
  profit_mxn?: number;
  margin?: number;
  inventory_cost_mxn?: number;
  inventory_retail_mxn?: number;
}

export interface AdminBanner extends Banner {
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface AdminReview extends Review {
  status: 'published' | 'hidden';
  product_name: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  min_subtotal_mxn: number | null;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

export interface TeamMember extends Profile {
  created_at: string;
}

export interface PosPayment {
  method: SinglePaymentMethod;
  amount: number;
  reference?: string;
}

export interface PosSalePayload {
  channel: 'pos';
  currency: Currency;
  items: { variant_id: string; quantity: number }[];
  customer_name?: string;
  customer_phone?: string;
  payment_method: PaymentMethod;
  payments: (PosPayment & { currency: Currency })[];
  discount_amount?: number;
  amount_received?: number;
  cash_session_id: string;
  notes?: string;
}
