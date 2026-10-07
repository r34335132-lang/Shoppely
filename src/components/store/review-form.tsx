import { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submitReview } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { cn } from '@/lib/utils';

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('flex gap-0.5', className)} aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-4 w-4', n <= Math.round(value) ? 'fill-blush-500 text-blush-500' : 'text-ink/20')} />
      ))}
    </span>
  );
}

export function ReviewForm({ productId, onDone }: { productId: string | null; onDone?: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  if (!profile) {
    return (
      <div className="rounded-3xl bg-blush-50 p-6 text-center">
        <p className="font-semibold">¿Ya lo probaste?</p>
        <p className="mt-1 text-sm text-ink/60">Inicia sesión para dejar tu opinión.</p>
        <Link href="/login" className="btn-dark mt-4">Entrar</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await submitReview({ product_id: productId, user_id: profile.id, rating, title: title.trim() || undefined, body: body.trim() || undefined });
      toast.success('¡Gracias por tu opinión! 💕');
      setTitle('');
      setBody('');
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['product'] });
      onDone?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-[0_20px_60px_-30px_rgba(20,16,20,0.25)]">
      <p className="font-semibold">Tu calificación</p>
      <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            type="button"
            whileTap={{ scale: 0.7 }}
            whileHover={{ scale: 1.2, rotate: -10 }}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            aria-label={`${n} estrellas`}
            className="p-1"
          >
            <Star className={cn('h-8 w-8 transition-colors', n <= (hover || rating) ? 'fill-blush-500 text-blush-500' : 'text-ink/20')} />
          </motion.button>
        ))}
      </div>
      <input className="field mt-4" placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      <textarea className="field mt-3 min-h-28 resize-none" placeholder="Cuéntanos qué te pareció…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={800} />
      <button type="submit" disabled={saving} className="btn-dark mt-4 w-full">{saving ? 'Enviando…' : 'Publicar opinión'}</button>
    </form>
  );
}
