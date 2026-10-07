import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useProducts } from '@/hooks/queries';
import { useCurrency } from '@/providers/currency';
import { unitPrice } from '@/lib/format';
import { lockScroll } from '@/lib/smooth-scroll';

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { currency, rate, format } = useCurrency();
  const { data: results = [], isFetching } = useProducts({ search: debounced, limit: 8 });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 200);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      lockScroll(false);
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] overflow-y-auto bg-cream/95 backdrop-blur-xl"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          data-lenis-prevent
        >
          <div className="page-wrap py-8">
            <div className="flex items-center gap-4 border-b-2 border-ink pb-4">
              <Search className="h-7 w-7 shrink-0" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="¿Qué se te antoja hoy?"
                className="display w-full bg-transparent text-4xl outline-none placeholder:text-ink/25 sm:text-6xl"
              />
              <button type="button" onClick={onClose} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white" aria-label="Cerrar búsqueda">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-ink/50">{isFetching ? 'Buscando…' : debounced ? `${results.length} resultados` : 'Productos destacados'}</p>
            <motion.div
              className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4"
              initial="hidden"
              animate="show"
              key={debounced}
              transition={{ staggerChildren: 0.04 }}
            >
              {results.map((p) => (
                <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                  <Link href={`/producto/${p.slug}`} onClick={onClose} className="group block">
                    <div className="aspect-square overflow-hidden rounded-3xl bg-blush-100">
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                    </div>
                    <p className="mt-2 text-sm font-semibold">{p.name}</p>
                    <p className="text-sm text-ink/60">{format(unitPrice(p, null, currency, rate))}</p>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
