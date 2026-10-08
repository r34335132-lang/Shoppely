import type { Product, Variant } from './types';

const norm = (s: string | null | undefined) => (s ?? '').trim().toUpperCase();

/** Busca por código de barras o SKU (sin distinguir mayúsculas). Por defecto solo variantes activas. */
export function findByCode<P extends Product>(products: P[], code: string, includeInactive = false): { product: P; variant: Variant } | null {
  const c = norm(code);
  if (!c) return null;
  for (const product of products) {
    for (const variant of product.variants) {
      if ((includeInactive || variant.active) && (norm(variant.barcode) === c || norm(variant.sku) === c)) return { product, variant };
    }
  }
  return null;
}

/** Texto que parece un código escaneado o tecleado (sin espacios, 4+ caracteres), no un nombre. */
export const looksLikeCode = (s: string) => /^[A-Za-z0-9._-]{4,}$/.test(s.trim());
