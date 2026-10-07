import { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { SplitReveal } from '@/components/motion/reveal';
import type { Category } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CategoriesPanel({ categories }: { categories: Category[] }) {
  const [active, setActive] = useState(0);

  return (
    <section className="flex h-full w-full flex-col bg-cream pb-6 pt-24 sm:pb-10 sm:pt-28">
      <div className="page-wrap flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-blush-700">Categorías</p>
          <SplitReveal text="Encuentra lo que te hace brillar" once={false} className="display mt-3 max-w-3xl text-[clamp(2.4rem,5.5vw,5rem)]" />
        </div>
        <Link href="/tienda" className="btn-outline hidden shrink-0 md:inline-flex">Ver todo</Link>
      </div>

      <div className="page-wrap mt-8 grid min-h-0 flex-1 grid-cols-2 gap-3 md:flex md:gap-4">
        {categories.map((category, i) => (
          <motion.div
            key={category.id}
            className={cn('relative min-h-0 overflow-hidden rounded-[28px] md:transition-[flex] md:duration-700 md:ease-[cubic-bezier(0.16,1,0.3,1)]', active === i ? 'md:flex-[2.4]' : 'md:flex-1')}
            onHoverStart={() => setActive(i)}
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.2 }}
            transition={{ delay: i * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link href={`/tienda?categoria=${category.slug}`} className="group block h-full">
              <img src={category.image_url ?? '/images/product-stilllife.jpg'} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white sm:p-6">
                <div>
                  <h3 className={cn('display text-3xl transition-all duration-500', active === i ? 'sm:text-5xl' : 'sm:text-5xl md:text-3xl')}>{category.name}</h3>
                  <p className={cn('mt-2 hidden max-w-xs text-sm text-white/80 transition-all duration-500 md:block', active === i ? 'opacity-100' : 'opacity-0')}>
                    {category.description}
                  </p>
                </div>
                <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink transition duration-500 group-hover:rotate-45 group-hover:bg-blush-400', active !== i && 'md:hidden')}>
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
