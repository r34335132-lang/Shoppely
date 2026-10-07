import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, ChevronLeft, Heart, Minus, Plus, ShieldCheck, Truck } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import { useProduct, useProducts, useReviews, useSettings } from '@/hooks/queries';
import { useCurrency } from '@/providers/currency';
import { useCart } from '@/providers/cart';
import { useFavorites, ProductCard } from '@/components/store/product-card';
import { ReviewForm, Stars } from '@/components/store/review-form';
import { compareAtPrice, formatDate, unitPrice, whatsappLink } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ProductPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug);
  const { data: settings } = useSettings();
  const { data: reviews = [] } = useReviews(product?.id ?? null, 30);
  const { data: related = [] } = useProducts({ category: product?.category?.slug, limit: 5 });
  const { currency, rate, format } = useCurrency();
  const { add, open } = useCart();
  const { ids, toggle } = useFavorites();
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product) return;
    setImageIndex(0);
    setQty(1);
    setVariantId(product.variants.find((v) => v.stock > 0)?.id ?? product.variants[0]?.id ?? null);
  }, [product]);

  const variant = useMemo(() => product?.variants.find((v) => v.id === variantId) ?? null, [product, variantId]);

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-cream"><div className="h-12 w-12 animate-spin rounded-full border-4 border-blush-200 border-t-blush-500" /></div>;
  }
  if (!product) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream text-center">
        <div>
          <p className="display text-5xl">Producto no encontrado</p>
          <Link href="/tienda" className="btn-dark mt-6">Volver a la tienda</Link>
        </div>
      </div>
    );
  }

  const price = unitPrice(product, variant, currency, rate);
  const compare = compareAtPrice(product, currency, rate);
  const isFav = ids.includes(product.id);
  const optionLabel = product.variants.some((v) => v.size) ? 'Talla' : 'Opción';
  const images = product.images.length ? product.images : ['/images/product-stilllife.jpg'];
  const lowStock = variant && variant.stock > 0 && variant.stock <= variant.low_stock_threshold;

  const addToCart = () => {
    if (!variant) return;
    add(product, variant, qty);
    toast.success(`${product.name} agregado a tu bolsa`, { action: { label: 'Ver bolsa', onClick: open } });
  };

  return (
    <div className="bg-cream pb-24 pt-24">
      <div className="page-wrap">
        <Link href="/tienda" className="inline-flex items-center gap-1 text-sm font-semibold text-ink/60 hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Tienda
        </Link>

        <div className="mt-4 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[36px] bg-blush-100">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.img
                  key={images[imageIndex]}
                  src={images[imageIndex]}
                  alt={product.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ opacity: 0, scale: 1.15, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  drag={images.length > 1 ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) setImageIndex((i) => (i + 1) % images.length);
                    if (info.offset.x > 60) setImageIndex((i) => (i - 1 + images.length) % images.length);
                  }}
                />
              </AnimatePresence>
              {product.is_new && <span className="absolute left-5 top-5 rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider">Nuevo</span>}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-3">
                {images.map((src, i) => (
                  <button key={src} type="button" onClick={() => setImageIndex(i)} className={cn('relative h-20 w-16 overflow-hidden rounded-2xl transition', i === imageIndex ? 'ring-2 ring-ink ring-offset-2 ring-offset-cream' : 'opacity-60 hover:opacity-100')}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <p className="eyebrow text-blush-700">{product.category?.name} {product.brand && `· ${product.brand}`}</p>
            <h1 className="display mt-3 text-[clamp(2.6rem,5vw,4.5rem)]">{product.name}</h1>
            {product.rating_count > 0 && (
              <a href="#opiniones" className="mt-3 flex items-center gap-2 text-sm text-ink/60">
                <Stars value={product.rating_avg} /> {product.rating_avg.toFixed(1)} · {product.rating_count} opiniones
              </a>
            )}

            <div className="mt-6 flex items-baseline gap-3">
              <motion.p key={`${price}-${currency}`} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl font-bold">
                {format(price)}
              </motion.p>
              {compare && compare > price && <p className="text-lg text-ink/40 line-through">{format(compare)}</p>}
            </div>

            {product.description && <p className="mt-6 max-w-lg leading-relaxed text-ink/70">{product.description}</p>}

            {product.variants.length > 1 && (
              <div className="mt-8">
                <p className="label">{optionLabel}: <span className="text-ink">{variant?.name}</span></p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <motion.button
                      key={v.id}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      disabled={v.stock === 0}
                      onClick={() => { setVariantId(v.id); setQty(1); }}
                      className={cn(
                        'relative flex min-w-14 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through',
                        v.id === variantId ? 'border-ink bg-ink text-white' : 'border-ink/15 bg-white hover:border-ink',
                      )}
                    >
                      {v.color_hex && !v.size && <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: v.color_hex }} />}
                      {v.name}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {lowStock && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 text-sm font-semibold text-blush-700">
                  ¡Solo quedan {variant!.stock}! 🔥
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-8 flex gap-3">
              <div className="flex items-center rounded-full bg-white">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-14 w-12 place-items-center" aria-label="Menos"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center font-bold">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(variant?.stock ?? 1, q + 1))} className="grid h-14 w-12 place-items-center" aria-label="Más"><Plus className="h-4 w-4" /></button>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                disabled={!variant || variant.stock === 0}
                onClick={addToCart}
                className="btn-dark flex-1 py-4 text-base"
              >
                {variant && variant.stock > 0 ? 'Agregar a mi bolsa' : 'Agotado'}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => void toggle(product.id)}
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white"
                aria-label="Favorito"
              >
                <Heart className={cn('h-5 w-5', isFav && 'fill-blush-500 text-blush-500')} />
              </motion.button>
            </div>

            {settings?.whatsapp && (
              <a
                href={whatsappLink(settings.whatsapp, `¡Hola! Me interesa ${product.name}${variant ? ` (${variant.name})` : ''} 💕`)}
                target="_blank"
                rel="noreferrer"
                className="btn-outline mt-3 w-full py-4"
              >
                <FaWhatsapp className="h-5 w-5 text-[#25D366]" /> Preguntar por WhatsApp
              </a>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-3xl bg-white p-4 text-sm">
                <Truck className="h-5 w-5 shrink-0 text-blush-600" />
                <span>Envío gratis desde {format(currency === 'MXN' ? settings?.free_shipping_min_mxn : (settings?.free_shipping_min_mxn ?? 0) / rate)}</span>
              </div>
              <div className="flex gap-3 rounded-3xl bg-white p-4 text-sm">
                <ShieldCheck className="h-5 w-5 shrink-0 text-blush-600" />
                <span>Paga con transferencia, Mercado Pago o efectivo</span>
              </div>
            </div>
          </motion.div>
        </div>

        <section id="opiniones" className="mt-24 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow text-blush-700">Opiniones</p>
            <h2 className="display mt-2 text-5xl">Lo que opinan</h2>
            <div className="mt-6 lg:sticky lg:top-28">
              <ReviewForm productId={product.id} />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {reviews.length === 0 && <p className="rounded-3xl bg-white p-8 text-center text-ink/60">Sé la primera en opinar sobre este producto ✨</p>}
            {reviews.map((r, i) => (
              <motion.article
                key={r.id}
                className="rounded-3xl bg-white p-6"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
              >
                <div className="flex items-center justify-between gap-4">
                  <Stars value={r.rating} />
                  <span className="text-xs text-ink/40">{formatDate(r.created_at)}</span>
                </div>
                {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                {r.body && <p className="mt-1 text-ink/70">{r.body}</p>}
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold">
                  {r.author_name}
                  {r.verified_purchase && <span className="flex items-center gap-1 text-xs font-medium text-blush-700"><BadgeCheck className="h-4 w-4" /> Compra verificada</span>}
                </p>
                {r.admin_reply && (
                  <div className="mt-4 rounded-2xl bg-blush-50 p-4 text-sm">
                    <p className="font-semibold">Respuesta de Shoppely</p>
                    <p className="mt-1 text-ink/70">{r.admin_reply}</p>
                  </div>
                )}
              </motion.article>
            ))}
          </div>
        </section>

        {related.filter((p) => p.id !== product.id).length > 0 && (
          <section className="mt-24">
            <h2 className="display text-5xl">También te va a encantar</h2>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {related.filter((p) => p.id !== product.id).slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
