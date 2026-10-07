import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BagMark, Sparkle } from './logo';
import { lockScroll } from '@/lib/smooth-scroll';

const KEY = 'shoppely-intro-seen';
const EASE = [0.76, 0, 0.24, 1] as const;

export function Intro({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const [skip] = useState(() => !!sessionStorage.getItem(KEY) || !!reduce);
  const [visible, setVisible] = useState(!skip);

  useEffect(() => {
    if (skip) {
      onDone();
      return;
    }
    lockScroll(true);
    const timer = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(timer);
    // Solo debe correr al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    sessionStorage.setItem(KEY, '1');
    lockScroll(false);
    onDone();
  };

  return (
    <AnimatePresence onExitComplete={finish}>
      {visible && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden bg-cream"
          onClick={() => setVisible(false)}
          exit={{ clipPath: 'inset(0 0 100% 0 round 0 0 50% 50%)' }}
          initial={{ clipPath: 'inset(0 0 0% 0 round 0 0 0% 0%)' }}
          transition={{ duration: 1, ease: EASE }}
        >
          <motion.div
            className="absolute h-[70vmax] w-[70vmax] rounded-full bg-blush-200/60 blur-3xl"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          />

          <div className="relative flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
            <motion.div
              initial={{ y: -260, rotate: -25, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 160, damping: 13, mass: 1.1 }}
            >
              <BagMark animate className="h-28 w-28 drop-shadow-[0_18px_30px_rgba(196,119,130,0.35)] sm:h-36 sm:w-36" />
            </motion.div>

            <div className="relative text-center sm:text-left">
              <div className="flex overflow-hidden font-brand text-6xl font-semibold tracking-tight text-ink sm:text-8xl">
                {'Shoppely'.split('').map((letter, i) => (
                  <motion.span
                    key={i}
                    className="inline-block"
                    initial={{ y: '110%' }}
                    animate={{ y: '0%' }}
                    transition={{ delay: 0.55 + i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </div>
              <motion.p
                className="mt-1 text-xs font-bold uppercase text-ink/70 sm:text-sm"
                initial={{ opacity: 0, letterSpacing: '0.1em' }}
                animate={{ opacity: 1, letterSpacing: '0.55em' }}
                transition={{ delay: 1.15, duration: 1 }}
              >
                Online Store
              </motion.p>

              {[
                { cls: '-right-6 -top-6 h-9 w-9', delay: 1.3 },
                { cls: 'right-6 -top-10 h-4 w-4', delay: 1.45 },
                { cls: '-right-10 top-4 h-5 w-5', delay: 1.6 },
              ].map((s, i) => (
                <motion.span
                  key={i}
                  className={`absolute ${s.cls}`}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: [0, 1.4, 1], rotate: 0 }}
                  transition={{ delay: s.delay, duration: 0.6 }}
                >
                  <Sparkle className="h-full w-full animate-twinkle" style={{ animationDelay: `${i * 0.3}s` }} />
                </motion.span>
              ))}
            </div>
          </div>

          <motion.div
            className="absolute bottom-10 h-[3px] w-40 overflow-hidden rounded-full bg-ink/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div
              className="h-full bg-blush-500"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.3, ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
