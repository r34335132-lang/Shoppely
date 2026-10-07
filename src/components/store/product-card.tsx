import { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Heart, Plus, Star } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Product } from '@/lib/types';
import { compareAtPrice, totalStock, unitPrice } from '@/lib/format';
import { fetchFavorites, toggleFavorite } from '@/lib/api';
import { useCurrency } from '@/providers/currency';
import { useCart } from '@/providers/cart';
import { useAuth } from '@/providers/auth';
import { cn } from '@/lib/utils';

export function useFavorites() {
  const { profile } = useAuth();
  const userId = profile && !profile.id.startsWith('demo-') ? profile.id : null;
  const qc = useQueryClient();
  const { data: ids = [] } = useQuery({ queryKey: ['favorites', userId], queryFn: () => fetchFavorites(userId) });
  const toggle = async (productId: string) => {
    const isFav = ids.includes(productId);
    qc.setQueryData(['favorites', userId], isFav ? ids.filter((id) => id !== productId) : [...ids, productId]);
    try {
      await toggleFavorite(userId, productId, isFav);
    } catch (e) {
      toast.error((e as Error).message);
      qc.invalidateQueries({ queryKey: ['favorites', userId] });
    }
  };
  return { ids, toggle };
}

export function ProductCard({ product, className, priority = false }: { product: Product; className?: string; priority?: boolean }) {
  const { currency, rate, format } = useCurrency();
  const { add, open } = useCart();
  const { ids, toggle } = useFavorites();
  const [hover, setHover] = useState(false);
  const price = unitPrice(product, null, currency, rate);
  const compare = compareAtPrice(product, currency, rate);
  const stock = totalStock(product);
  const discount = compare && compare > price ? Math.round((1 - price / compare) * 100) : 0;
  const isFav = ids.includes(product.id);
  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!singleVariant) return;
    add(product, singleVariant);
    toast.success(`${product.name} agregado`, { action: { label: 'Ver carrito', onClick: open } });
  };

  return (
    <motion.article
      className={cn('group relative', className)}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileTap={{ scale: 0.985 }}
    >
      <Link href={`/producto/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[28px] bg-blush-100">
          <motion.img
            src={product.images[0] ?? '/images/product-stilllife.jpg'}
            alt={product.name}
            loading={priority ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full object-cover"
            animate={{ scale: hover ? 1.08 : 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
          {product.images[1] && (
            <motion.img
              src={product.images[1]}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              initial={false}
              animate={{ opacity: hover ? 1 : 0, scale: hover ? 1 : 1.08 }}
              transition={{ duration: 0.7 }}
            />
          )}

          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {product.is_new && <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider">Nuevo</span>}
            {discount > 0 && <span className="rounded-full bg-blush-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">-{discount}%</span>}
            {stock === 0 && <span className="rounded-full bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Agotado</span>}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.8 }}
            onClick={(e) => { e.preventDefault(); void toggle(product.id); }}
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 backdrop-blur"
            aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <motion.span key={String(isFav)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
              <Heart className={cn('h-[18px] w-[18px]', isFav ? 'fill-blush-500 text-blush-500' : 'text-ink')} />
            </motion.span>
          </motion.button>

          {stock > 0 && (
            <div className="absolute inset-x-3 bottom-3 translate-y-0 transition-transform duration-500 lg:translate-y-[130%] lg:group-hover:translate-y-0">
              {singleVariant ? (
                <button type="button" onClick={quickAdd} className="flex w-full items-center justify-center gap-2 rounded-full bg-white/95 py-3 text-xs font-bold uppercase tracking-wider backdrop-blur transition hover:bg-ink hover:text-white">
                  <Plus className="h-4 w-4" /> Agregar
                </button>
              ) : (
                <span className="flex w-full items-center justify-center gap-2 rounded-full bg-white/95 py-3 text-xs font-bold uppercase tracking-wider backdrop-blur">
                  Elegir {product.variants[0]?.size ? 'talla' : 'tono'}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">{product.category?.name ?? product.brand}</p>
            <h3 className="mt-0.5 truncate text-[15px] font-semibold">{product.name}</h3>
            {product.rating_count > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-ink/55">
                <Star className="h-3 w-3 fill-blush-500 text-blush-500" /> {product.rating_avg.toFixed(1)} ({product.rating_count})
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-bold">{format(price)}</p>
            {discount > 0 && <p className="text-xs text-ink/40 line-through">{format(compare)}</p>}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
