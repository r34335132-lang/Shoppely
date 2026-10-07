import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Eye, EyeOff, MessageSquareQuote, Reply, Star, Trash2 } from 'lucide-react';
import { useAction, useAdminReviews } from '@/hooks/admin-queries';
import { deleteReview, updateReview } from '@/lib/admin-api';
import type { AdminReview } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, Card, CountUp, Empty, PageHeader, Pill, SearchInput, Segmented, SkeletonRows, StatCard, useConfirm } from '@/components/panel/kit';

type Filter = 'all' | 'published' | 'hidden' | 'unanswered' | 'low';

export default function Reviews() {
  const { data: reviews, isLoading } = useAdminReviews();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const all = reviews ?? [];
  const published = all.filter((r) => r.status === 'published');
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;
  const q = search.trim().toLowerCase();
  const list = all.filter((r) => {
    if (filter === 'published' && r.status !== 'published') return false;
    if (filter === 'hidden' && r.status !== 'hidden') return false;
    if (filter === 'unanswered' && r.admin_reply) return false;
    if (filter === 'low' && r.rating > 3) return false;
    return !q || [r.author_name, r.title, r.body, r.product_name].join(' ').toLowerCase().includes(q);
  });
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: published.filter((r) => r.rating === n).length }));

  return (
    <>
      <PageHeader eyebrow="Tienda" title="Reseñas" subtitle="Lo que opinan tus clientas. Responde, oculta o elimina." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
        <StatCard highlight label="Calificación promedio" value={avg} format="decimal" icon={Star} hint={<span className="flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-3.5 w-3.5', i <= Math.round(avg) ? 'fill-white text-white' : 'text-white/40')} />)}</span>} />
        <StatCard label="Reseñas publicadas" value={published.length} delay={0.05} hint={`${all.length - published.length} ocultas · ${all.filter((r) => !r.admin_reply).length} sin respuesta`} />
        <Card delay={0.1}>
          <ul className="space-y-2">
            {dist.map(({ n, count }, i) => (
              <li key={n} className="flex items-center gap-3 text-sm">
                <span className="flex w-8 items-center gap-0.5 font-semibold">{n}<Star className="h-3 w-3 fill-blush-500 text-blush-500" /></span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.05]">
                  <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-blush-300),var(--color-blush-600))]" initial={{ width: 0 }} animate={{ width: `${published.length ? (count / published.length) * 100 : 0}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.06 }} />
                </div>
                <CountUp value={count} className="w-8 text-right text-ink/60" />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 p-3! sm:p-4!" delay={0.1}>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por clienta, producto o texto" className="min-w-[220px] flex-1" />
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'published', label: 'Publicadas' },
              { value: 'hidden', label: 'Ocultas' },
              { value: 'unanswered', label: 'Sin respuesta' },
              { value: 'low', label: '3★ o menos' },
            ]}
          />
        </div>
      </Card>

      {isLoading ? <SkeletonRows rows={4} className="mt-4" /> : list.length === 0 ? (
        <Card className="mt-4"><Empty icon={MessageSquareQuote} title="Sin reseñas" text="Cuando tus clientas opinen aparecerán aquí." /></Card>
      ) : (
        <div className="mt-4 columns-1 gap-4 lg:columns-2 2xl:columns-3">
          <AnimatePresence>
            {list.map((r, i) => <ReviewCard key={r.id} review={r} index={i} />)}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

function ReviewCard({ review: r, index }: { review: AdminReview; index: number }) {
  const confirm = useConfirm();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.admin_reply ?? '');
  const update = useAction(({ patch }: { patch: Parameters<typeof updateReview>[1]; msg: string }) => updateReview(r.id, patch), (_, a) => a.msg);
  const remove = useAction(() => deleteReview(r.id), 'Reseña eliminada');
  const hidden = r.status === 'hidden';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className={cn('pcard mb-4 break-inside-avoid', hidden && 'opacity-60')}
    >
      <div className="flex items-start gap-3">
        <Avatar name={r.author_name} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold">{r.author_name ?? 'Clienta'} {r.verified_purchase && <BadgeCheck className="h-4 w-4 text-blush-600" />}</p>
          <p className="truncate text-xs text-ink/50">{r.product_name ?? 'Tienda en general'} · {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        {hidden && <Pill tone="neutral">Oculta</Pill>}
      </div>
      <div className="mt-3 flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-4 w-4', i <= r.rating ? 'fill-blush-500 text-blush-500' : 'text-ink/15')} />)}</div>
      {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
      {r.body && <p className="mt-1 text-sm text-ink/70">{r.body}</p>}
      {r.images.length > 0 && (
        <div className="mt-3 flex gap-2">{r.images.map((src) => <img key={src} src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />)}</div>
      )}
      {r.admin_reply && !replying && (
        <div className="mt-3 rounded-2xl bg-blush-50 p-3 text-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blush-700">Respuesta de Shoppely</p>
          <p className="mt-0.5 text-ink/75">{r.admin_reply}</p>
        </div>
      )}
      <AnimatePresence>
        {replying && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <textarea autoFocus value={reply} onChange={(e) => setReply(e.target.value)} rows={3} className="pfield mt-3 h-auto! py-2.5" placeholder="¡Gracias por tu reseña! 💕" />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="pbtn-ghost h-9! px-4!" onClick={() => { setReplying(false); setReply(r.admin_reply ?? ''); }}>Cancelar</button>
              <button
                type="button"
                className="pbtn-primary h-9! px-4!"
                disabled={update.isPending}
                onClick={() => update.mutate({ patch: { admin_reply: reply.trim() || null }, msg: reply.trim() ? 'Respuesta publicada' : 'Respuesta eliminada' }, { onSuccess: () => setReplying(false) })}
              >
                Publicar respuesta
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink/5 pt-3">
        <button type="button" className="pbtn-soft h-9! px-3.5! text-xs" onClick={() => setReplying((v) => !v)}><Reply className="h-3.5 w-3.5" /> {r.admin_reply ? 'Editar respuesta' : 'Responder'}</button>
        <button
          type="button"
          className="pbtn-soft h-9! px-3.5! text-xs"
          onClick={() => update.mutate({ patch: { status: hidden ? 'published' : 'hidden' }, msg: hidden ? 'Reseña publicada' : 'Reseña oculta' })}
        >
          {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {hidden ? 'Publicar' : 'Ocultar'}
        </button>
        <button
          type="button"
          className="pbtn-danger ml-auto h-9! px-3.5! text-xs"
          onClick={async () => {
            const ok = await confirm({ title: '¿Eliminar esta reseña?', text: 'No se puede deshacer. Si solo quieres que no se vea, ocúltala.', confirmLabel: 'Eliminar', danger: true });
            if (ok !== false) remove.mutate(undefined);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.article>
  );
}
