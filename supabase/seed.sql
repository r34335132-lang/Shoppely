-- Datos de ejemplo para arrancar. Se pueden editar o borrar desde el dashboard.

insert into public.categories (name, slug, description, image_url, sort_order) values
  ('Ropa', 'ropa', 'Prendas para todos los días y ocasiones especiales', '/images/editorial-look.jpg', 1),
  ('Maquillaje', 'maquillaje', 'Color, brillo y acabados que duran', '/images/rose-lipstick.jpg', 2),
  ('Skincare', 'skincare', 'Rituales para una piel luminosa', '/images/vitamin-serum.jpg', 3),
  ('Accesorios', 'accesorios', 'Bolsas y detalles que completan el look', '/images/mini-bag.jpg', 4)
on conflict (slug) do nothing;

with p as (
  insert into public.products (name, slug, description, category_id, brand, price_mxn, price_usd, compare_at_mxn, images, tags, featured, is_new)
  values
    ('Vestido Carmín', 'vestido-carmin', 'Vestido largo de gasa con escote en V y caída fluida. Perfecto para eventos y noches especiales.',
      (select id from public.categories where slug = 'ropa'), 'Shoppely', 1490, 79, 1790, array['/images/editorial-look.jpg'], array['vestido', 'fiesta'], true, true),
    ('Blusa Marfil', 'blusa-marfil', 'Blusa de lino suave con volumen relajado y acabado precioso.',
      (select id from public.categories where slug = 'ropa'), 'Shoppely', 890, 48, null, array['/images/ivory-blouse.jpg', '/images/shoppely-campaign.jpg'], array['blusa', 'lino'], true, false),
    ('Labial Rosa Nube', 'labial-rosa-nube', 'Color cremoso, cómodo y de larga duración para llevar todos los días.',
      (select id from public.categories where slug = 'maquillaje'), 'Mora Studio', 329, 18, 379, array['/images/rose-lipstick.jpg'], array['labial'], true, true),
    ('Rubor en Crema Peach', 'rubor-crema-peach', 'Rubor cremoso que se funde con la piel para un rubor natural y jugoso.',
      (select id from public.categories where slug = 'maquillaje'), 'Mora Studio', 289, 16, null, array['/images/cream-blush.jpg'], array['rubor'], false, true),
    ('Sérum Vitamina C', 'serum-vitamina-c', 'Sérum ligero que ilumina y unifica el tono. Ideal para la rutina de mañana.',
      (select id from public.categories where slug = 'skincare'), 'Casa Botánica', 489, 26, null, array['/images/vitamin-serum.jpg'], array['serum', 'vitamina c'], true, false),
    ('Kit Glow Diario', 'kit-glow-diario', 'Labial, crema hidratante y accesorios dorados en un set listo para regalar.',
      (select id from public.categories where slug = 'skincare'), 'Shoppely', 990, 54, 1150, array['/images/product-stilllife.jpg'], array['kit', 'regalo'], true, false),
    ('Bolsa Mini Amalia', 'bolsa-mini-amalia', 'Una silueta alegre hecha para acompañarte a todas partes.',
      (select id from public.categories where slug = 'accesorios'), 'Lola', 1190, 64, null, array['/images/mini-bag.jpg', '/images/editorial-hero.jpg'], array['bolsa'], true, false)
  on conflict (slug) do nothing
  returning id, slug
)
insert into public.product_variants (product_id, name, size, color, color_hex, sku, barcode, stock, sort_order)
select p.id, v.name, v.size, v.color, v.color_hex, v.sku, v.barcode, v.stock, v.sort_order
from p
join (values
  ('vestido-carmin', 'CH', 'CH', 'Carmín', '#9b1b1f', 'VC-CH', '7501000000011', 4, 1),
  ('vestido-carmin', 'M', 'M', 'Carmín', '#9b1b1f', 'VC-M', '7501000000012', 6, 2),
  ('vestido-carmin', 'G', 'G', 'Carmín', '#9b1b1f', 'VC-G', '7501000000013', 3, 3),
  ('blusa-marfil', 'CH', 'CH', 'Marfil', '#f3ead8', 'BM-CH', '7501000000021', 5, 1),
  ('blusa-marfil', 'M', 'M', 'Marfil', '#f3ead8', 'BM-M', '7501000000022', 8, 2),
  ('blusa-marfil', 'G', 'G', 'Marfil', '#f3ead8', 'BM-G', '7501000000023', 2, 3),
  ('labial-rosa-nube', 'Rosa', null, 'Rosa', '#e58fa6', 'LR-ROS', '7501000000031', 15, 1),
  ('labial-rosa-nube', 'Durazno', null, 'Durazno', '#f2a07b', 'LR-DUR', '7501000000032', 10, 2),
  ('labial-rosa-nube', 'Cereza', null, 'Cereza', '#a3122c', 'LR-CER', '7501000000033', 7, 3),
  ('rubor-crema-peach', 'Única', null, null, null, 'RC-PEACH', '7501000000041', 12, 1),
  ('serum-vitamina-c', '30 ml', null, null, null, 'SV-30', '7501000000051', 20, 1),
  ('kit-glow-diario', 'Única', null, null, null, 'KG-01', '7501000000061', 6, 1),
  ('bolsa-mini-amalia', 'Rosa', null, 'Rosa', '#e88aa5', 'BA-ROS', '7501000000071', 4, 1),
  ('bolsa-mini-amalia', 'Marfil', null, 'Marfil', '#efe6d6', 'BA-MAR', '7501000000072', 3, 2)
) as v(slug, name, size, color, color_hex, sku, barcode, stock, sort_order) on v.slug = p.slug;

insert into public.product_costs (product_id, cost_mxn)
select id, round(price_mxn * 0.45, 2) from public.products
on conflict (product_id) do nothing;

insert into public.banners (placement, eyebrow, title, subtitle, image_url, cta_label, cta_link, theme, sort_order) values
  ('hero', 'Nueva temporada', 'Tu estilo, tu brillo', 'Ropa, maquillaje y accesorios elegidos con amor para ti.', '/images/editorial-hero.jpg', 'Comprar ahora', '/tienda', 'light', 0),
  ('story', 'Colección noche', 'Vestidos que se mueven contigo', 'Telas fluidas y colores intensos para tus momentos especiales.', '/images/editorial-look.jpg', 'Ver ropa', '/tienda?categoria=ropa', 'dark', 1),
  ('story', 'Beauty edit', 'Color que enamora', 'Labiales cremosos, rubores jugosos y skincare que ilumina.', '/images/product-stilllife.jpg', 'Ver maquillaje', '/tienda?categoria=maquillaje', 'pink', 2),
  ('story', 'Básicos con alma', 'Lino, luz y suavidad', 'Prendas ligeras para todos los días.', '/images/ivory-blouse.jpg', 'Ver blusas', '/tienda?categoria=ropa', 'light', 3);

insert into public.coupons (code, kind, value, min_subtotal_mxn) values
  ('BIENVENIDA10', 'percent', 10, 500)
on conflict (code) do nothing;
