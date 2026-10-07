import type { Product, Variant } from './types';

const norm = (s: string | null | undefined) => (s ?? '').trim().toUpperCase();

/** Busca por código de barras o SKU (sin distinguir mayúsculas). Solo variantes activas. */
export function findByCode<P extends Product>(products: P[], code: string): { product: P; variant: Variant } | null {
  const c = norm(code);
  if (!c) return null;
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.active && (norm(variant.barcode) === c || norm(variant.sku) === c)) return { product, variant };
    }
  }
  return null;
}
