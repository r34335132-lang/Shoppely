import Lenis from 'lenis';

let instance: Lenis | null = null;
let frame = 0;

export function startSmoothScroll() {
  if (instance || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  instance = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  const raf = (time: number) => {
    instance?.raf(time);
    frame = requestAnimationFrame(raf);
  };
  frame = requestAnimationFrame(raf);
}

export function stopSmoothScroll() {
  cancelAnimationFrame(frame);
  instance?.destroy();
  instance = null;
}

export function scrollToTop() {
  if (instance) instance.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

export function lockScroll(locked: boolean) {
  if (instance) {
    if (locked) instance.stop();
    else instance.start();
  }
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}
