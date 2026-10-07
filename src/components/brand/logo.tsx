import { motion, type SVGMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

const INK = '#141014';

export function BagMark({ className, animate = false }: { className?: string; animate?: boolean }) {
  const draw: SVGMotionProps<SVGPathElement> = animate
    ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.9, delay: 0.35, ease: 'easeInOut' } }
    : {};
  const pop = animate
    ? { initial: { scale: 0 }, animate: { scale: [0, 1.25, 1] }, transition: { duration: 0.6, delay: 0.9 } }
    : {};

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M45 23 L54 27.5 L56 56 L47.5 59 Z" fill="#f48fb4" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M9.5 23 H45 L47.5 59 H7 Z" fill="#f9b4cc" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <motion.path
        d="M19 27 V18 C19 10.5 23.5 6 28 6 C32.5 6 37 10.5 37 18 V27"
        fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" {...draw}
      />
      <circle cx="19" cy="27.5" r="1.9" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <circle cx="37" cy="27.5" r="1.9" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <motion.path
        style={{ transformOrigin: '28px 40px' }}
        d="M28 50 C20 44 16.5 40.2 16.5 36 C16.5 32.8 19 30.6 22 30.6 C24.5 30.6 26.4 32 28 34.2 C29.6 32 31.5 30.6 34 30.6 C37 30.6 39.5 32.8 39.5 36 C39.5 40.2 36 44 28 50 Z"
        fill="#ec6b9a" stroke={INK} strokeWidth="2.3" strokeLinejoin="round" {...pop}
      />
      <path d="M21 35 C21.5 33.6 22.6 33 23.8 33" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

export function Sparkle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="-8 -8 16 16" className={className} style={style} aria-hidden="true">
      <path d="M0 -7 C0.9 -1.5 1.5 -0.9 7 0 C1.5 0.9 0.9 1.5 0 7 C-0.9 1.5 -1.5 0.9 -7 0 C-1.5 -0.9 -0.9 -1.5 0 -7 Z" fill="#ec6b9a" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, light = false, compact = false }: { className?: string; light?: boolean; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BagMark className="h-9 w-9 shrink-0" />
      <span className="relative leading-none">
        <span className={cn('font-brand text-[26px] font-semibold tracking-tight', light ? 'text-white' : 'text-ink')}>Shoppely</span>
        {!compact && (
          <span className={cn('mt-0.5 block text-[8.5px] font-bold uppercase tracking-[0.42em]', light ? 'text-white/80' : 'text-ink/70')}>
            Online Store
          </span>
        )}
        <Sparkle className="absolute -right-3.5 -top-2 h-3 w-3 animate-twinkle" />
      </span>
    </span>
  );
}
