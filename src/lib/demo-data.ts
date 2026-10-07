import type { Banner, Category, Product, Review, StoreSettings, Variant } from './types';

export const demoSettings: StoreSettings = {
  store_name: 'Shoppely',
  tagline: 'Online Store',
  whatsapp: '+17738497180',
  instagram_url: 'https://www.instagram.com/shoppelystore',
  facebook_url: 'https://www.facebook.com/share/1DnMNY9R5p/',
  contact_email: null,
  address: null,
  default_currency: 'MXN',
  exchange_rate: 18.5,
  shipping_fee_mxn: 150,
  free_shipping_min_mxn: 1500,
  cash_enabled: true,
  transfer_enabled: true,
  mercadopago_enabled: true,
  bank_name: 'Banco de ejemplo',
  bank_account_holder: 'Shoppely Store',
  bank_clabe: '000000000000000000',
  bank_account_number: null,
  transfer_instructions: 'Envía tu comprobante por WhatsApp con tu número de pedido.',
  mp_fee_online_enabled: true,
  mp_fee_online_percent: 3.49,
  mp_fee_online_fixed_mxn: 4,
  mp_fee_pos_enabled: true,
  mp_fee_pos_percent: 3.5,
  mp_fee_pos_fixed_mxn: 0,
  mp_fee_iva: 16,
};

export const demoCategories: Category[] = [
  { id: 'cat-ropa', name: 'Ropa', slug: 'ropa', description: 'Prendas para todos los días y ocasiones especiales', image_url: '/images/editorial-look.jpg', sort_order: 1, active: true },
  { id: 'cat-maquillaje', name: 'Maquillaje', slug: 'maquillaje', description: 'Color, brillo y acabados que duran', image_url: '/images/rose-lipstick.jpg', sort_order: 2, active: true },
  { id: 'cat-skincare', name: 'Skincare', slug: 'skincare', description: 'Rituales para una piel luminosa', image_url: '/images/vitamin-serum.jpg', sort_order: 3, active: true },
  { id: 'cat-accesorios', name: 'Accesorios', slug: 'accesorios', description: 'Bolsas y detalles que completan el look', image_url: '/images/mini-bag.jpg', sort_order: 4, active: true },
];

type VariantSeed = [name: string, size: string | null, color: string | null, hex: string | null, sku: string, barcode: string, stock: number];

function variants(productId: string, seeds: VariantSeed[]): Variant[] {
  return seeds.map(([name, size, color, color_hex, sku, barcode, stock], i) => ({
    id: `${productId}-v${i + 1}`,
    product_id: productId,
    name, size, color, color_hex, sku, barcode, stock,
    low_stock_threshold: 3,
    price_mxn: null,
    price_usd: null,
    sort_order: i + 1,
    active: true,
  }));
}

const cat = (slug: string) => {
  const c = demoCategories.find((x) => x.slug === slug)!;
  return { id: c.id, ref: { name: c.name, slug: c.slug } };
};

function product(p: Omit<Product, 'category_id' | 'category' | 'active' | 'created_at' | 'tags' | 'compare_at_usd'> & { cat: string; tags?: string[]; compare_at_usd?: number | null }): Product {
  const c = cat(p.cat);
  return {
    ...p,
    tags: p.tags ?? [],
    compare_at_usd: p.compare_at_usd ?? null,
    category_id: c.id,
    category: c.ref,
    active: true,
    created_at: '2026-10-01T00:00:00Z',
  };
}

export const demoProducts: Product[] = [
  product({
    id: 'p-vestido', name: 'Vestido Carmín', slug: 'vestido-carmin', cat: 'ropa', brand: 'Shoppely',
    description: 'Vestido largo de gasa con escote en V y caída fluida. Perfecto para eventos y noches especiales.',
    price_mxn: 1490, price_usd: 79, compare_at_mxn: 1790, images: ['/images/editorial-look.jpg'],
    featured: true, is_new: true, rating_avg: 4.9, rating_count: 18,
    variants: variants('p-vestido', [
      ['CH', 'CH', 'Carmín', '#9b1b1f', 'VC-CH', '7501000000011', 4],
      ['M', 'M', 'Carmín', '#9b1b1f', 'VC-M', '7501000000012', 6],
      ['G', 'G', 'Carmín', '#9b1b1f', 'VC-G', '7501000000013', 3],
    ]),
  }),
  product({
    id: 'p-blusa', name: 'Blusa Marfil', slug: 'blusa-marfil', cat: 'ropa', brand: 'Shoppely',
    description: 'Blusa de lino suave con volumen relajado y acabado precioso.',
    price_mxn: 890, price_usd: 48, compare_at_mxn: null, images: ['/images/ivory-blouse.jpg', '/images/shoppely-campaign.jpg'],
    featured: true, is_new: false, rating_avg: 4.7, rating_count: 12,
    variants: variants('p-blusa', [
      ['CH', 'CH', 'Marfil', '#f3ead8', 'BM-CH', '7501000000021', 5],
      ['M', 'M', 'Marfil', '#f3ead8', 'BM-M', '7501000000022', 8],
      ['G', 'G', 'Marfil', '#f3ead8', 'BM-G', '7501000000023', 2],
    ]),
  }),
  product({
    id: 'p-labial', name: 'Labial Rosa Nube', slug: 'labial-rosa-nube', cat: 'maquillaje', brand: 'Mora Studio',
    description: 'Color cremoso, cómodo y de larga duración para llevar todos los días.',
    price_mxn: 329, price_usd: 18, compare_at_mxn: 379, images: ['/images/rose-lipstick.jpg'],
    featured: true, is_new: true, rating_avg: 4.8, rating_count: 34,
    variants: variants('p-labial', [
      ['Rosa', null, 'Rosa', '#e58fa6', 'LR-ROS', '7501000000031', 15],
      ['Durazno', null, 'Durazno', '#f2a07b', 'LR-DUR', '7501000000032', 10],
      ['Cereza', null, 'Cereza', '#a3122c', 'LR-CER', '7501000000033', 7],
    ]),
  }),
  product({
    id: 'p-rubor', name: 'Rubor en Crema Peach', slug: 'rubor-crema-peach', cat: 'maquillaje', brand: 'Mora Studio',
    description: 'Rubor cremoso que se funde con la piel para un rubor natural y jugoso.',
    price_mxn: 289, price_usd: 16, compare_at_mxn: null, images: ['/images/cream-blush.jpg'],
    featured: false, is_new: true, rating_avg: 4.6, rating_count: 9,
    variants: variants('p-rubor', [['Única', null, null, null, 'RC-PEACH', '7501000000041', 12]]),
  }),
  product({
    id: 'p-serum', name: 'Sérum Vitamina C', slug: 'serum-vitamina-c', cat: 'skincare', brand: 'Casa Botánica',
    description: 'Sérum ligero que ilumina y unifica el tono. Ideal para la rutina de mañana.',
    price_mxn: 489, price_usd: 26, compare_at_mxn: null, images: ['/images/vitamin-serum.jpg'],
    featured: true, is_new: false, rating_avg: 4.8, rating_count: 41,
    variants: variants('p-serum', [['30 ml', null, null, null, 'SV-30', '7501000000051', 20]]),
  }),
  product({
    id: 'p-kit', name: 'Kit Glow Diario', slug: 'kit-glow-diario', cat: 'skincare', brand: 'Shoppely',
    description: 'Labial, crema hidratante y accesorios dorados en un set listo para regalar.',
    price_mxn: 990, price_usd: 54, compare_at_mxn: 1150, images: ['/images/product-stilllife.jpg'],
    featured: true, is_new: false, rating_avg: 5, rating_count: 7,
    variants: variants('p-kit', [['Única', null, null, null, 'KG-01', '7501000000061', 6]]),
  }),
  product({
    id: 'p-bolsa', name: 'Bolsa Mini Amalia', slug: 'bolsa-mini-amalia', cat: 'accesorios', brand: 'Lola',
    description: 'Una silueta alegre hecha para acompañarte a todas partes.',
    price_mxn: 1190, price_usd: 64, compare_at_mxn: null, images: ['/images/mini-bag.jpg', '/images/editorial-hero.jpg'],
    featured: true, is_new: false, rating_avg: 4.9, rating_count: 16,
    variants: variants('p-bolsa', [
      ['Rosa', null, 'Rosa', '#e88aa5', 'BA-ROS', '7501000000071', 4],
      ['Marfil', null, 'Marfil', '#efe6d6', 'BA-MAR', '7501000000072', 3],
    ]),
  }),
];

export const demoBanners: Banner[] = [
  { id: 'b-hero', placement: 'hero', eyebrow: 'Nueva temporada', title: 'Tu estilo, tu brillo', subtitle: 'Ropa, maquillaje y accesorios elegidos con amor para ti.', image_url: '/images/editorial-hero.jpg', cta_label: 'Comprar ahora', cta_link: '/tienda', theme: 'light', sort_order: 0 },
  { id: 'b-1', placement: 'story', eyebrow: 'Colección noche', title: 'Vestidos que se mueven contigo', subtitle: 'Telas fluidas y colores intensos para tus momentos especiales.', image_url: '/images/editorial-look.jpg', cta_label: 'Ver ropa', cta_link: '/tienda?categoria=ropa', theme: 'dark', sort_order: 1 },
  { id: 'b-2', placement: 'story', eyebrow: 'Beauty edit', title: 'Color que enamora', subtitle: 'Labiales cremosos, rubores jugosos y skincare que ilumina.', image_url: '/images/product-stilllife.jpg', cta_label: 'Ver maquillaje', cta_link: '/tienda?categoria=maquillaje', theme: 'pink', sort_order: 2 },
  { id: 'b-3', placement: 'story', eyebrow: 'Básicos con alma', title: 'Lino, luz y suavidad', subtitle: 'Prendas ligeras para todos los días.', image_url: '/images/ivory-blouse.jpg', cta_label: 'Ver blusas', cta_link: '/tienda?categoria=ropa', theme: 'light', sort_order: 3 },
];

export const demoReviews: Review[] = [
  { id: 'r1', product_id: null, user_id: 'u1', author_name: 'Mariana G.', rating: 5, title: 'Me encantó', body: 'Todo llegó súper bien empacado y la calidad es increíble. Ya hice mi segundo pedido.', images: [], verified_purchase: true, admin_reply: null, created_at: '2026-09-20T00:00:00Z' },
  { id: 'r2', product_id: null, user_id: 'u2', author_name: 'Daniela R.', rating: 5, title: 'Atención 10/10', body: 'Me ayudaron por WhatsApp a elegir mi talla, súper amables.', images: [], verified_purchase: true, admin_reply: null, created_at: '2026-09-12T00:00:00Z' },
  { id: 'r3', product_id: 'p-labial', user_id: 'u3', author_name: 'Sofía L.', rating: 5, title: 'El tono perfecto', body: 'El labial Rosa Nube dura todo el día y no reseca.', images: [], verified_purchase: true, admin_reply: null, created_at: '2026-09-05T00:00:00Z' },
  { id: 'r4', product_id: null, user_id: 'u4', author_name: 'Valeria M.', rating: 4, title: 'Bonitas prendas', body: 'La blusa marfil es preciosa, la tela es muy fresca.', images: [], verified_purchase: false, admin_reply: null, created_at: '2026-08-28T00:00:00Z' },
  { id: 'r5', product_id: 'p-serum', user_id: 'u5', author_name: 'Paola C.', rating: 5, title: 'Piel luminosa', body: 'En dos semanas noté mi piel más uniforme. Lo amo.', images: [], verified_purchase: true, admin_reply: null, created_at: '2026-08-15T00:00:00Z' },
];
