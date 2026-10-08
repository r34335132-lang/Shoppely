import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, Pencil, Plus, Shuffle, TicketPercent, Trash2 } from 'lucide-react';
import { useAction, useCoupons } from '@/hooks/admin-queries';
import { deleteCoupon, saveCoupon } from '@/lib/admin-api';
import { money } from '@/lib/format';
import type { Coupon } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, Empty, Field, Modal, PageHeader, Pill, Segmented, SkeletonRows, Switch, useConfirm } from '@/components/panel/kit';

type Draft = Partial<Coupon> & { code: string; kind: Coupon['kind']; value: number };

function couponState(c: Coupon) {
  const now = Date.now();
  if (!c.active) return { label: 'Apagado', tone: 'neutral' as const };
  if (c.max_uses !== null && c.used_count >= c.max_uses) return { label: 'Agotado', tone: 'amber' as const };
  if (c.ends_at && Date.parse(c.ends_at) < now) return { label: 'Vencido', tone: 'red' as const };
  if (c.starts_at && Date.parse(c.starts_at) > now) return { label: 'Programado', tone: 'blue' as const };
  return { label: 'Activo', tone: 'green' as const };
}

const dateOnly = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');

export default function Coupons() {
  const { data: coupons, isLoading } = useCoupons();
  const [editing, setEditing] = useState<Draft | null>(null);
  const confirm = useConfirm();
  const toggle = useAction((c: Coupon) => saveCoupon({ ...c, active: !c.active }));
  const remove = useAction(deleteCoupon, 'Cupón eliminado');

  return (
    <>
      <PageHeader
        eyebrow="Tienda"
        title="Cupones"
        subtitle="Códigos de descuento para la tienda en línea."
        actions={<button type="button" className="pbtn-pink" onClick={() => setEditing({ code: '', kind: 'percent', value: 10, active: true })}><Plus className="h-4 w-4" /> Nuevo cupón</button>}
      />
      {isLoading ? <SkeletonRows rows={3} /> : !coupons?.length ? (
        <Card><Empty icon={TicketPercent} title="Sin cupones" text="Crea un código como BIENVENIDA10 para tus clientas nuevas." /></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <AnimatePresence>
            {coupons.map((c, i) => {
              const state = couponState(c);
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 16, rotate: -1 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24, delay: i * 0.04 }}
                  className="relative flex overflow-hidden rounded-[26px] bg-white ring-1 ring-ink/5"
                >
                  <div className={cn('relative flex w-28 shrink-0 flex-col items-center justify-center p-3 text-center text-white sm:w-32 sm:p-4', c.active ? 'bg-[linear-gradient(150deg,var(--color-blush-400),var(--color-blush-700))]' : 'bg-ink/40')}>
                    <p className={cn('font-bold leading-none', c.kind === 'percent' ? 'text-3xl' : 'text-lg leading-tight sm:text-xl')}>{c.kind === 'percent' ? `${c.value}%` : money(c.value)}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/75">descuento</p>
                    <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f7f2ee]" />
                  </div>
                  <div className="min-w-0 flex-1 border-l-2 border-dashed border-ink/10 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => { void navigator.clipboard?.writeText(c.code); toast.success(`Código ${c.code} copiado`); }}
                        className="flex min-w-0 items-center gap-1.5 font-mono text-base font-bold tracking-wider hover:text-blush-700 sm:text-lg"
                      >
                        <span className="truncate">{c.code}</span> <Copy className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      </button>
                      <Pill tone={state.tone} dot>{state.label}</Pill>
                    </div>
                    <p className="mt-1 text-xs text-ink/55">
                      {c.min_subtotal_mxn ? `Compra mínima ${money(c.min_subtotal_mxn)}` : 'Sin compra mínima'}
                      {c.ends_at && ` · hasta ${new Date(c.ends_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
                    </p>
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-ink/50"><span>Usos</span><span>{c.used_count}{c.max_uses !== null ? ` / ${c.max_uses}` : ''}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.05]">
                        <motion.div className="h-full rounded-full bg-blush-500" initial={{ width: 0 }} animate={{ width: c.max_uses ? `${Math.min((c.used_count / c.max_uses) * 100, 100)}%` : c.used_count ? '100%' : '0%' }} transition={{ duration: 0.8 }} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      <Switch size="sm" checked={c.active} onChange={() => toggle.mutate(c)} />
                      <button type="button" onClick={() => setEditing(c)} className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirm({ title: `¿Eliminar ${c.code}?`, confirmLabel: 'Eliminar', danger: true });
                          if (ok !== false) remove.mutate(c.id);
                        }}
                        className="grid h-9 w-9 place-items-center rounded-full text-red-600 hover:bg-red-50"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar cupón' : 'Nuevo cupón'}>
        {editing && <CouponForm key={editing.id ?? 'new'} initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function CouponForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const [c, setC] = useState({
    ...initial,
    value: String(initial.value),
    min: initial.min_subtotal_mxn ? String(initial.min_subtotal_mxn) : '',
    max: initial.max_uses !== null && initial.max_uses !== undefined ? String(initial.max_uses) : '',
    starts: dateOnly(initial.starts_at ?? null),
    ends: dateOnly(initial.ends_at ?? null),
  });
  const save = useAction(saveCoupon, 'Cupón guardado');
  const random = () => setC({ ...c, code: `SHOP${Math.random().toString(36).slice(2, 7).toUpperCase()}` });

  return (
    <div className="space-y-4 pb-2">
      <Field label="Código">
        <div className="flex gap-2">
          <input autoFocus value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase().replace(/\s/g, '') })} className="pfield font-mono tracking-wider" placeholder="VERANO20" />
          <button type="button" onClick={random} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink/[0.05] hover:bg-ink/10" aria-label="Generar código"><Shuffle className="h-4 w-4" /></button>
        </div>
      </Field>
      <Segmented
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
        value={c.kind}
        onChange={(kind) => setC({ ...c, kind })}
        options={[{ value: 'percent', label: 'Porcentaje %' }, { value: 'fixed', label: 'Monto fijo $' }]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.kind === 'percent' ? 'Porcentaje' : 'Monto (MXN)'}><input value={c.value} onChange={(e) => setC({ ...c, value: e.target.value.replace(/[^\d.]/g, '') })} className="pfield" inputMode="decimal" /></Field>
        <Field label="Compra mínima (MXN)"><input value={c.min} onChange={(e) => setC({ ...c, min: e.target.value.replace(/[^\d.]/g, '') })} className="pfield" inputMode="decimal" placeholder="Sin mínimo" /></Field>
        <Field label="Usos máximos"><input value={c.max} onChange={(e) => setC({ ...c, max: e.target.value.replace(/\D/g, '') })} className="pfield" inputMode="numeric" placeholder="Ilimitado" /></Field>
        <div className="flex items-end pb-2"><Switch checked={c.active ?? true} onChange={(active) => setC({ ...c, active })} label="Activo" /></div>
        <Field label="Válido desde"><input type="date" value={c.starts} onChange={(e) => setC({ ...c, starts: e.target.value })} className="pfield" /></Field>
        <Field label="Válido hasta"><input type="date" value={c.ends} onChange={(e) => setC({ ...c, ends: e.target.value })} className="pfield" /></Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="pbtn-ghost" onClick={onDone}>Cancelar</button>
        <button
          type="button"
          className="pbtn-pink"
          disabled={save.isPending}
          onClick={() => save.mutate({
            id: c.id,
            code: c.code,
            kind: c.kind,
            value: Number(c.value),
            min_subtotal_mxn: c.min ? Number(c.min) : null,
            max_uses: c.max ? Number(c.max) : null,
            starts_at: c.starts ? new Date(`${c.starts}T00:00:00`).toISOString() : null,
            ends_at: c.ends ? new Date(`${c.ends}T23:59:59`).toISOString() : null,
            active: c.active,
          }, { onSuccess: onDone })}
        >
          Guardar cupón
        </button>
      </div>
    </div>
  );
}
