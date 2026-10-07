import { useCallback, useEffect, useState } from 'react';
import { unitPrice } from '@/lib/format';
import type { AdminProduct, Currency, Variant } from '@/lib/types';

export interface CartLine {
  variantId: string;
  qty: number;
}

export interface Discount {
  kind: 'amount' | 'percent';
  value: number;
}

export interface Customer {
  name: string;
  phone: string;
}

export interface ParkedSale {
  id: string;
  at: string;
  cart: CartLine[];
  customer: Customer;
  discount: Discount | null;
  currency: Currency;
}

export interface ResolvedLine extends CartLine {
  product: AdminProduct;
  variant: Variant;
  unit: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function resolveCart(cart: CartLine[], products: AdminProduct[], currency: Currency, rate: number): ResolvedLine[] {
  const index = new Map<string, { product: AdminProduct; variant: Variant }>();
  for (const product of products) for (const variant of product.variants) index.set(variant.id, { product, variant });
  return cart.flatMap((line) => {
    const hit = index.get(line.variantId);
    if (!hit) return [];
    const unit = unitPrice(hit.product, hit.variant, currency, rate);
    return [{ ...line, ...hit, unit, total: round2(unit * line.qty) }];
  });
}

export function totals(lines: ResolvedLine[], discount: Discount | null) {
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const raw = !discount ? 0 : discount.kind === 'percent' ? (subtotal * Math.min(discount.value, 100)) / 100 : discount.value;
  const discountAmount = round2(Math.min(Math.max(raw, 0), subtotal));
  return { subtotal, discount: discountAmount, total: round2(subtotal - discountAmount), items: lines.reduce((s, l) => s + l.qty, 0) };
}

const PARKED_KEY = 'shoppely-pos-parked';

function readParked(): ParkedSale[] {
  try {
    return JSON.parse(localStorage.getItem(PARKED_KEY) ?? '[]') as ParkedSale[];
  } catch {
    return [];
  }
}

/** Ventas en espera: se guardan en el dispositivo para retomarlas después. */
export function useParked() {
  const [parked, setParked] = useState<ParkedSale[]>(readParked);
  useEffect(() => localStorage.setItem(PARKED_KEY, JSON.stringify(parked)), [parked]);
  const park = useCallback((sale: Omit<ParkedSale, 'id' | 'at'>) =>
    setParked((list) => [{ ...sale, id: `${Date.now()}`, at: new Date().toISOString() }, ...list]), []);
  const take = useCallback((id: string) => {
    const sale = parked.find((p) => p.id === id) ?? null;
    setParked((list) => list.filter((p) => p.id !== id));
    return sale;
  }, [parked]);
  const drop = useCallback((id: string) => setParked((list) => list.filter((p) => p.id !== id)), []);
  return { parked, park, take, drop };
}
