import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, MessageCircleHeart, X } from 'lucide-react';
import { useReviews } from '@/hooks/queries';
import { ReviewForm, Stars } from '@/components/store/review-form';
import { SplitReveal } from '@/components/motion/reveal';
import { lockScroll } from '@/lib/smooth-scroll';
import type { Review } from '@/lib/types';

function ReviewCard({ review }: { review: Review }) {
  return (
    <figure className="w-[300px] shrink-0 rounded-[28px] bg-white p-6 text-ink sm:w-[360px]">
      <Stars value={review.rating} />
      {review.title && <p className="mt-3 font-semibold">{review.title}</p>}
      <blockquote className="mt-2 line-clamp-4 text-sm text-ink/70">“{review.body}”</blockquote>
      <figcaption className="mt-4 flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-blush-200 text-xs">{(review.author_name ?? 'C').slice(0, 1)}</span>
        {review.author_name ?? 'Clienta'}
        {review.verified_purchase && <BadgeCheck className="h-4 w-4 text-blush-600" aria-label="Compra verificada" />}
      </figcaption>
    </figure>
  );
}

function ReviewRow({ reviews, reverse = false }: { reviews: Review[]; reverse?: boolean }) {
  const row = [...reviews, ...reviews, ...reviews];
  return (
    <div className="flex overflow-hidden">
      <motion.div
        className="flex shrink-0 gap-4 pr-4"
        animate={{ x: reverse ? ['-33.33%', '0%'] : ['0%', '-33.33%'] }}
        transition={{ duration: Math.max(reviews.length * 7, 25), ease: 'linear', repeat: Infinity }}
      >
        {row.map((r, i) => <ReviewCard key={`${r.id}-${i}`} review={r} />)}
      </motion.div>
    </div>
  );
}

export function ReviewsPanel() {
  const { data: reviews = [] } = useReviews(null, 20);
  const [open, setOpen] = useState(false);
  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 5;
  const half = Math.ceil(reviews.length / 2);

  const toggle = (next: boolean) => {
    setOpen(next);
    lockScroll(next);
  };

  return (
    <section className="flex h-full w-full flex-col justify-center gap-8 overflow-hidden bg-ink py-20 text-white">
      <div className="page-wrap flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="eyebrow text-blush-300">Opiniones</p>
          <SplitReveal text="Lo que dicen de nosotras" once={false} className="display mt-3 text-[clamp(2.6rem,6vw,5.5rem)]" />
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="display text-7xl text-blush-300">{average.toFixed(1)}</p>
            <Stars value={average} className="mt-1" />
          </div>
          <button type="button" onClick={() => toggle(true)} className="btn-pink">
            <MessageCircleHeart className="h-4 w-4" /> Dejar opinión
          </button>
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="flex flex-col gap-4">
          <ReviewRow reviews={reviews.slice(0, half)} />
          {reviews.length > 2 && <ReviewRow reviews={reviews.slice(half)} reverse />}
        </div>
      )}

      {createPortal(<AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => toggle(false)}
          >
            <motion.div
              className="relative w-full max-w-md text-ink"
              initial={{ y: 60, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 60, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => toggle(false)} className="absolute -top-14 right-0 grid h-11 w-11 place-items-center rounded-full bg-white" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
              <ReviewForm productId={null} onDone={() => toggle(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </section>
  );
}
