import { Children, createContext, useContext, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PanelProgress {
  /** 0 → 1 mientras el panel sube y entra a la pantalla. */
  enter: MotionValue<number>;
  /** 0 → 1 mientras el siguiente panel lo cubre. */
  exit: MotionValue<number>;
}

const PanelContext = createContext<PanelProgress | null>(null);

export function usePanel() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanel debe usarse dentro de ScrollStack');
  return ctx;
}

/**
 * Cada hijo ocupa toda la pantalla y se queda fijo; el siguiente sube encima
 * mientras el anterior se encoge y oscurece, dando la sensación de cambiar de página.
 * Con `overlapNext` el último panel también queda fijo para que la sección
 * siguiente (con margen -100svh) lo cubra.
 */
export function ScrollStack({ children, overlapNext = false, className }: { children: ReactNode; overlapNext?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const panels = Children.toArray(children);
  const steps = Math.max(overlapNext ? panels.length : panels.length - 1, 1);

  return (
    <div ref={ref} className={cn('relative', className)}>
      {panels.map((child, index) => (
        <StackPanel
          key={index}
          index={index}
          steps={steps}
          covered={overlapNext || index < panels.length - 1}
          progress={scrollYProgress}
        >
          {child}
        </StackPanel>
      ))}
      {overlapNext && <div className="h-svh" aria-hidden="true" />}
    </div>
  );
}

function StackPanel({ index, steps, covered, progress, children }: {
  index: number;
  steps: number;
  covered: boolean;
  progress: MotionValue<number>;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const start = index / steps;
  const end = (index + 1) / steps;
  const enter = useTransform(progress, [(index - 1) / steps, start], [0, 1]);
  const exit = useTransform(progress, [start, end], [0, covered ? 1 : 0]);
  const scale = useTransform(exit, [0, 1], [1, reduce ? 1 : 0.86]);
  const radius = useTransform(exit, [0, 1], [0, reduce ? 0 : 44]);
  const rotate = useTransform(exit, [0, 1], [0, reduce ? 0 : index % 2 ? 1.5 : -1.5]);
  const shade = useTransform(exit, [0, 1], [0, 0.6]);

  return (
    <div className="sticky top-0 h-svh overflow-hidden bg-ink">
      <motion.div
        style={{ scale, borderRadius: radius, rotate }}
        className="relative h-full w-full origin-[50%_30%] overflow-hidden will-change-transform"
      >
        <PanelContext.Provider value={{ enter, exit }}>{children}</PanelContext.Provider>
        <motion.div style={{ opacity: shade }} className="pointer-events-none absolute inset-0 bg-ink" />
      </motion.div>
    </div>
  );
}
