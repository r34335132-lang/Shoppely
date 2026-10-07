import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Título que aparece palabra por palabra desde una máscara. */
export function SplitReveal({ text, className, delay = 0, as = 'h2', once = true }: {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  once?: boolean;
}) {
  const Tag = motion[as];
  const words = text.split(' ');
  return (
    <Tag
      className={cn('flex flex-wrap', className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.4 }}
      transition={{ staggerChildren: 0.07, delayChildren: delay }}
      aria-label={text}
    >
      {words.map((word, i) => (
        <span key={i} className="mr-[0.25em] inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden="true">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: '110%', rotate: 6 },
              show: { y: '0%', rotate: 0, transition: { duration: 0.9, ease: EASE } },
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

export function FadeUp({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className, gap = 0.08 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      transition={{ staggerChildren: gap }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={fadeUp}>{children}</motion.div>;
}

export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={cn('flex overflow-hidden whitespace-nowrap', className)}>
      <div className="flex shrink-0 animate-marquee items-center gap-10 pr-10">
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-10">
            {item}
            <span aria-hidden="true">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
