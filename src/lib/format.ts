import type { Currency, OrderStatus, PaymentMethod, PaymentStatus, Product, Variant } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

const formatters: Record<Currency, Intl.NumberFormat> = {
  MXN: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};
const wholeMxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export function money(amount: number | null | undefined, currency: Currency = 'MXN') {
  const n = round2(amount ?? 0);
  const value = currency === 'MXN' && Number.isInteger(n) ? wholeMxn.format(n) : formatters[currency].format(n);
  return currency === 'MXN' ? `${value} MXN` : `US${value}`;
}

/** Misma regla que create_order en la base de datos. */
export function unitPrice(
  base: { price_mxn: number; price_usd: number | null },
  variant: Pick<Variant, 'price_mxn' | 'price_usd'> | null | undefined,
  currency: Currency,
  rate: number,
) {
  const mxn = variant?.price_mxn ?? base.price_mxn;
  if (currency === 'MXN') return mxn;
  return variant?.price_usd ?? base.price_usd ?? round2(mxn / rate);
}

export function compareAtPrice(product: Product, currency: Currency, rate: number) {
  if (currency === 'MXN') return product.compare_at_mxn;
  if (product.compare_at_usd) return product.compare_at_usd;
  return product.compare_at_mxn ? round2(product.compare_at_mxn / rate) : null;
}

export function toMxn(amount: number, currency: Currency, rate: number) {
  return currency === 'MXN' ? amount : round2(amount * rate);
}

export function fromMxn(amountMxn: number, currency: Currency, rate: number) {
  return currency === 'MXN' ? amountMxn : round2(amountMxn / rate);
}

export const totalStock = (product: Product) =>
  product.variants.filter((v) => v.active).reduce((sum, v) => sum + v.stock, 0);

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  mercadopago: 'Mercado Pago',
  mixed: 'Mixto',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: 'Pago pendiente',
  paid: 'Pagado',
  refunded: 'Reembolsado',
  failed: 'Pago rechazado',
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  pending: 'Recibido',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export function whatsappLink(phone: string | null | undefined, message?: string) {
  const digits = (phone ?? '').replace(/\D/g, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}
