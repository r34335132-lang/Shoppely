import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { unitPrice } from '@/lib/format';
import type { Product, Variant } from '@/lib/types';
import { useCurrency } from './currency';

export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  image: string | null;
  priceMxn: number;
  priceUsd: number | null;
  stock: number;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  bump: number;
  open: () => void;
  close: () => void;
  add: (product: Product, variant: Variant, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  linePrice: (line: CartLine) => number;
}

const CartContext = createContext<CartContextValue | null>(null);
const KEY = 'shoppely-cart';

function readCart(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { currency, rate } = useCurrency();
  const [lines, setLines] = useState<CartLine[]>(readCart);
  const [isOpen, setOpen] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<CartContextValue>(() => {
    const linePrice = (line: CartLine) =>
      unitPrice({ price_mxn: line.priceMxn, price_usd: line.priceUsd }, null, currency, rate);
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + linePrice(l) * l.qty, 0),
      isOpen,
      bump,
      open: () => setOpen(true),
      close: () => setOpen(false),
      add(product, variant, qty = 1) {
        setLines((prev) => {
          const existing = prev.find((l) => l.variantId === variant.id);
          if (existing) {
            return prev.map((l) => (l === existing ? { ...l, qty: Math.min(l.qty + qty, variant.stock), stock: variant.stock } : l));
          }
          return [...prev, {
            variantId: variant.id,
            productId: product.id,
            slug: product.slug,
            name: product.name,
            variantName: variant.name,
            image: product.images[0] ?? null,
            priceMxn: variant.price_mxn ?? product.price_mxn,
            priceUsd: variant.price_usd ?? product.price_usd,
            stock: variant.stock,
            qty: Math.min(qty, variant.stock),
          }];
        });
        setBump((b) => b + 1);
      },
      setQty: (variantId, qty) =>
        setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(1, Math.min(qty, l.stock)) } : l))),
      remove: (variantId) => setLines((prev) => prev.filter((l) => l.variantId !== variantId)),
      clear: () => setLines([]),
      linePrice,
    };
  }, [lines, isOpen, bump, currency, rate]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}
