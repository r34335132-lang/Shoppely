import { Link } from 'wouter';
import { motion, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { usePanel } from '@/components/motion/scroll-stack';
import { SplitReveal } from '@/components/motion/reveal';
import type { Banner } from '@/lib/types';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

export function StoryPanel({ banner, index, total }: { banner: Banner; index: number; total: number }) {
  const { enter, exit } = usePanel();
  const imageScale = useTransform(enter, [0, 1], [1.35, 1]);
  const imageY = useTransform(exit, [0, 1], ['0%', '12%']);
  const counter = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  if (banner.theme === 'dark') {
    return (
      <section className="relative h-full w-full overflow-hidden bg-ink text-white">
        <motion.img src={banner.image_url} alt="" style={{ scale: imageScale, y: imageY }} className="absolute inset-x-0 -top-[15%] h-[115%] w-full object-cover object-[50%_12%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/10" />
        <div className="page-wrap relative flex h-full flex-col justify-end pb-16 sm:pb-20">
          <StoryText banner={banner} counter={counter} light />
        </div>
      </section>
    );
  }

  const reversed = index % 2 === 1;
  const pink = banner.theme === 'pink';

  return (
    <section className={cn('grain relative grid h-full w-full grid-rows-[1.1fr_1fr] overflow-hidden md:grid-cols-2 md:grid-rows-1', pink ? 'bg-blush-300' : 'bg-cream')}>
      <div className={cn('relative overflow-hidden', reversed && 'md:order-2')}>
        <motion.img src={banner.image_url} alt="" style={{ scale: imageScale, y: imageY }} className="absolute inset-x-0 -top-[15%] h-[115%] w-full object-cover object-[50%_30%]" />
      </div>
      <div className="relative flex flex-col justify-center px-6 py-8 sm:px-12 lg:px-20">
        <StoryText banner={banner} counter={counter} />
        <motion.span
          className="display pointer-events-none absolute -bottom-6 right-4 select-none text-[28vw] leading-none text-white/40 md:text-[16vw]"
          initial={{ opacity: 0, x: 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          {String(index + 1).padStart(2, '0')}
        </motion.span>
      </div>
    </section>
  );
}

function StoryText({ banner, counter, light = false }: { banner: Banner; counter: string; light?: boolean }) {
  return (
    <div className="relative z-10 max-w-2xl">
      <motion.div
        className={cn('flex items-center gap-4', light ? 'text-blush-200' : 'text-blush-700')}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <span className="eyebrow">{banner.eyebrow}</span>
        <span className={cn('h-px w-12', light ? 'bg-blush-200' : 'bg-blush-700')} />
        <span className="text-xs font-semibold tabular-nums">{counter}</span>
      </motion.div>
      <SplitReveal text={banner.title} once={false} className={cn('display mt-4 text-[clamp(2.8rem,7vw,6.5rem)]', light ? 'text-white' : 'text-ink')} />
      {banner.subtitle && (
        <motion.p
          className={cn('mt-4 max-w-md text-base sm:text-lg', light ? 'text-white/75' : 'text-ink/70')}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.5 }}
          transition={{ delay: 0.3, duration: 0.8, ease: EASE }}
        >
          {banner.subtitle}
        </motion.p>
      )}
      {banner.cta_link && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ amount: 0.5 }} transition={{ delay: 0.45, type: 'spring' }}>
          <Link href={banner.cta_link} className={cn('group mt-8 inline-flex items-center gap-3 text-base font-semibold', light ? 'text-white' : 'text-ink')}>
            <span className={cn('grid h-14 w-14 place-items-center rounded-full transition duration-500 group-hover:rotate-45', light ? 'bg-white text-ink' : 'bg-ink text-white')}>
              <ArrowUpRight className="h-5 w-5" />
            </span>
            <span className="relative">
              {banner.cta_label ?? 'Ver más'}
              <span className={cn('absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100', light ? 'bg-white' : 'bg-ink')} />
            </span>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
