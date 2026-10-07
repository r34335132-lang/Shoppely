import { Link } from 'wouter';
import { motion, useTransform } from 'framer-motion';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { usePanel } from '@/components/motion/scroll-stack';
import { Marquee } from '@/components/motion/reveal';
import { Sparkle } from '@/components/brand/logo';
import { useIntroDone } from '@/components/store/store-layout';
import type { Banner } from '@/lib/types';

const EASE = [0.16, 1, 0.3, 1] as const;

export function HeroPanel({ banner }: { banner: Banner }) {
  const ready = useIntroDone();
  const { exit } = usePanel();
  const imageY = useTransform(exit, [0, 1], ['0%', '18%']);
  const textY = useTransform(exit, [0, 1], [0, -160]);
  const textOpacity = useTransform(exit, [0, 0.7], [1, 0]);
  const words = banner.title.split(' ');

  return (
    <section className="relative h-full w-full overflow-hidden bg-blush-100">
      <motion.div style={{ y: imageY }} className="absolute inset-x-0 -top-[20%] h-[120%]">
        <motion.img
          src={banner.image_url}
          alt=""
          className="h-full w-full object-cover object-[62%_40%]"
          initial={{ scale: 1.3 }}
          animate={ready ? { scale: 1 } : undefined}
          transition={{ duration: 2.4, ease: EASE }}
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/30 to-transparent sm:bg-gradient-to-r sm:from-cream/95 sm:via-cream/40 sm:to-transparent" />

      <motion.div style={{ y: textY, opacity: textOpacity }} className="page-wrap relative z-10 flex h-full flex-col justify-end pb-28 sm:justify-center sm:pb-0">
        <motion.span
          className="eyebrow inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-ink backdrop-blur"
          initial={{ opacity: 0, y: 20 }}
          animate={ready ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 0.3, duration: 0.8, ease: EASE }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-blush-500" /> {banner.eyebrow}
        </motion.span>

        <motion.h1
          className="display mt-5 max-w-[11ch] text-[clamp(3.6rem,11vw,10rem)] text-ink"
          initial="hidden"
          animate={ready ? 'show' : 'hidden'}
          transition={{ staggerChildren: 0.09, delayChildren: 0.4 }}
          aria-label={banner.title}
        >
          {words.map((word, i) => (
            <span key={i} className="mr-[0.2em] inline-block overflow-hidden pb-[0.08em] align-bottom" aria-hidden="true">
              <motion.span
                className={i === words.length - 1 ? 'inline-block italic text-blush-600' : 'inline-block'}
                variants={{ hidden: { y: '115%', rotate: 8 }, show: { y: '0%', rotate: 0, transition: { duration: 1.1, ease: EASE } } }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={ready ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 0.9, duration: 0.9, ease: EASE }}
        >
          {banner.subtitle && <p className="mt-5 max-w-md text-base text-ink/70 sm:text-lg">{banner.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={banner.cta_link ?? '/tienda'} className="btn-dark group py-4 pl-7 pr-5 text-base">
              {banner.cta_label ?? 'Comprar ahora'}
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 transition group-hover:translate-x-1">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link href="/tienda?orden=new" className="btn-light py-4 text-base">Lo nuevo</Link>
          </div>
        </motion.div>
      </motion.div>

      <Sparkle className="absolute right-[12%] top-[18%] h-10 w-10 animate-float" />
      <Sparkle className="absolute right-[30%] top-[30%] hidden h-5 w-5 animate-twinkle sm:block" />
      <Sparkle className="absolute bottom-[30%] right-[8%] h-7 w-7 animate-twinkle" style={{ animationDelay: '0.8s' }} />

      <motion.div
        className="absolute bottom-20 right-24 hidden flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-ink/60 sm:flex"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : undefined}
        transition={{ delay: 1.6 }}
      >
        <span className="[writing-mode:vertical-rl]">Desliza</span>
        <motion.span animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
          <ArrowDown className="h-4 w-4" />
        </motion.span>
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 bg-ink py-3 text-sm font-semibold uppercase tracking-[0.25em] text-blush-300">
        <Marquee items={['Ropa', 'Maquillaje', 'Skincare', 'Accesorios', 'Envíos a todo el país', 'Paga como quieras']} />
      </div>
    </section>
  );
}
