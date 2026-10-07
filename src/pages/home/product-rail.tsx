import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/store/product-card';
import type { Product } from '@/lib/types';

/**
 * Sección fija donde el scroll vertical mueve los productos de lado.
 * Al final se encoge para que la siguiente sección la cubra, igual que los paneles.
 */
export function ProductRail({ products }: { products: Product[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [size, setSize] = useState({ distance: 0, vh: typeof window !== 'undefined' ? window.innerHeight : 800 });

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      setSize({ distance: Math.max(track.scrollWidth - window.innerWidth, 0), vh: window.innerHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (trackRef.current) observer.observe(trackRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [products.length]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });

  // useTransform conserva los rangos del primer render, así que leemos las medidas desde un ref.
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const slide = (p: number) => {
    const { distance, vh } = sizeRef.current;
    const split = distance / Math.max(distance + vh, 1);
    return split > 0 ? Math.min(p / split, 1) : 1;
  };
  const leave = (p: number) => {
    const { distance, vh } = sizeRef.current;
    const split = distance / Math.max(distance + vh, 1);
    return Math.max((p - split) / Math.max(1 - split, 0.0001), 0);
  };

  const x = useTransform(scrollYProgress, (p) => -sizeRef.current.distance * slide(p));
  const ghostX = useTransform(scrollYProgress, (p) => `${-30 * slide(p)}%`);
  const bar = useTransform(scrollYProgress, (p) => `${100 * slide(p)}%`);
  const scale = useTransform(scrollYProgress, (p) => (reduce ? 1 : 1 - 0.14 * leave(p)));
  const radius = useTransform(scrollYProgress, (p) => (reduce ? 0 : 44 * leave(p)));
  const shade = useTransform(scrollYProgress, (p) => 0.6 * leave(p));

  return (
    <section ref={sectionRef} className="relative z-10 -mt-[100svh]" style={{ height: size.vh * 2 + size.distance }}>
      <div className="sticky top-0 h-svh overflow-hidden bg-ink">
        <motion.div style={{ scale, borderRadius: radius }} className="relative flex h-full w-full origin-[50%_30%] flex-col justify-center overflow-hidden bg-blush-50">
          <motion.p
            style={{ x: ghostX }}
            className="display pointer-events-none absolute top-[8%] whitespace-nowrap text-[22vw] italic leading-none text-blush-200/70 select-none"
            aria-hidden="true"
          >
            Favoritas ✦ Favoritas ✦ Favoritas
          </motion.p>

          <motion.div ref={trackRef} style={{ x }} className="relative flex w-max items-center gap-5 pl-6 pr-6 pt-10 sm:gap-8 sm:pl-[6vw]">
            <div className="flex w-[78vw] shrink-0 flex-col justify-center sm:w-[30vw] lg:w-[26vw]">
              <p className="eyebrow text-blush-700">Lo más amado</p>
              <h2 className="display mt-3 text-[clamp(2.8rem,6vw,5.5rem)]">
                Las favoritas de <em className="text-blush-600">nuestras</em> clientas
              </h2>
              <p className="mt-4 max-w-sm text-ink/60">Desliza para descubrirlas. Se agotan rápido, ¡no te quedes sin la tuya!</p>
              <Link href="/tienda" className="btn-dark mt-8 w-fit">Ver toda la tienda <ArrowRight className="h-4 w-4" /></Link>
            </div>
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 3} className="w-[68vw] shrink-0 sm:w-[300px] lg:w-[340px]" />
            ))}
            <Link href="/tienda" className="group grid aspect-[3/4] w-[68vw] shrink-0 place-items-center rounded-[28px] bg-ink text-white sm:w-[300px] lg:w-[340px]">
              <span className="flex flex-col items-center gap-4">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-blush-400 text-ink transition duration-500 group-hover:scale-110 group-hover:rotate-[-45deg]">
                  <ArrowRight className="h-8 w-8" />
                </span>
                <span className="display text-4xl">Ver todo</span>
              </span>
            </Link>
          </motion.div>

          <div className="page-wrap absolute inset-x-0 bottom-8 h-[3px] overflow-hidden rounded-full bg-ink/10">
            <motion.div style={{ width: bar }} className="h-full rounded-full bg-blush-500" />
          </div>
          <motion.div style={{ opacity: shade }} className="pointer-events-none absolute inset-0 bg-ink" />
        </motion.div>
      </div>
    </section>
  );
}
