import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useCategories, useProducts } from '@/hooks/queries';
import { ProductCard } from '@/components/store/product-card';
import { SplitReveal } from '@/components/motion/reveal';
import type { ProductSort } from '@/lib/api';
import { cn } from '@/lib/utils';

const sorts: { value: ProductSort; label: string }[] = [
  { value: 'featured', label: 'Destacados' },
  { value: 'new', label: 'Lo nuevo' },
  { value: 'price-asc', label: 'Menor precio' },
  { value: 'price-desc', label: 'Mayor precio' },
  { value: 'rating', label: 'Mejor calificados' },
];

export default function CatalogPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const category = params.get('categoria') ?? '';
  const sort = (params.get('orden') as ProductSort | null) ?? 'featured';
  const [term, setTerm] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data: categories = [] } = useCategories();
  const { data: products = [], isLoading } = useProducts({ category: category || undefined, sort, search: debounced || undefined });
  const current = categories.find((c) => c.slug === category);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    navigate(`/tienda${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="min-h-screen bg-cream pb-24 pt-28">
      <div className="page-wrap">
        <motion.p key={`eyebrow-${category}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="eyebrow text-blush-700">
          {current ? 'Categoría' : 'Tienda'}
        </motion.p>
        <SplitReveal key={category} as="h1" text={current?.name ?? 'Toda la tienda'} className="display mt-2 text-[clamp(3rem,9vw,8rem)]" />
        {current?.description && <p className="mt-2 max-w-lg text-ink/60">{current.description}</p>}

        <div className="sticky top-20 z-30 -mx-2 mt-8 flex flex-col gap-3 rounded-[28px] bg-cream/85 p-2 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {[{ slug: '', name: 'Todo' }, ...categories].map((c) => (
              <button
                key={c.slug || 'all'}
                type="button"
                onClick={() => setParam('categoria', c.slug)}
                className={cn('relative shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', category === c.slug ? 'text-white' : 'bg-white text-ink/70 hover:text-ink')}
              >
                {category === c.slug && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1 md:w-64">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar" className="w-full rounded-full bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blush-300" />
            </label>
            <label className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <select value={sort} onChange={(e) => setParam('orden', e.target.value === 'featured' ? '' : e.target.value)} className="appearance-none rounded-full bg-white py-2.5 pl-10 pr-6 text-sm font-semibold outline-none">
                {sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        <p className="mt-6 text-sm text-ink/50">{isLoading ? 'Cargando…' : `${products.length} productos`}</p>

        <motion.div layout className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={`s-${i}`} className="aspect-[3/4] animate-pulse rounded-[28px] bg-blush-100" />
                ))
              : products.map((product, i) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ProductCard product={product} priority={i < 4} />
                  </motion.div>
                ))}
          </AnimatePresence>
        </motion.div>

        {!isLoading && products.length === 0 && (
          <div className="py-24 text-center">
            <p className="display text-4xl">Nada por aquí… todavía</p>
            <p className="mt-2 text-ink/60">Prueba con otra búsqueda o categoría.</p>
          </div>
        )}
      </div>
    </div>
  );
}
