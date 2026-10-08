import { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Clock, History, Lock, ScanBarcode, Wallet } from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { useCashMovements, useCashSessions, useCashSummary, useOpenSession, useOrders } from '@/hooks/admin-queries';
import { money, paymentMethodLabel } from '@/lib/format';
import type { CashSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardTitle, Empty, PageHeader, Pill, Sheet, SkeletonRows, StatusPill } from '@/components/panel/kit';
import { CashMoveModal, CloseCashModal, OpenCashModal, SummaryBreakdown } from '@/components/panel/cash-forms';

const time = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => {
  const text = new Date(iso).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function Cash() {
  const { profile, role } = useAuth();
  const { data: session, isLoading } = useOpenSession(profile?.id);
  const { data: sessions = [] } = useCashSessions();
  const [openModal, setOpenModal] = useState(false);
  const [moveKind, setMoveKind] = useState<'in' | 'out' | null>(null);
  const [closing, setClosing] = useState(false);
  const [viewing, setViewing] = useState<CashSession | null>(null);
  const history = sessions.filter((s) => s.status === 'closed' && (role === 'admin' || s.opened_by === profile?.id));
  const othersOpen = role === 'admin' ? sessions.filter((s) => s.status === 'open' && s.opened_by !== profile?.id) : [];

  return (
    <>
      <PageHeader
        eyebrow="Punto de venta"
        title="Caja"
        subtitle="Fondo inicial, entradas y salidas de efectivo y corte al final del turno."
        actions={<Link href="/pos" className="pbtn-primary"><ScanBarcode className="h-4 w-4" /> Ir al POS</Link>}
      />

      {isLoading ? <SkeletonRows rows={4} /> : session ? (
        <CurrentSession session={session} onMove={setMoveKind} onClose={() => setClosing(true)} />
      ) : (
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blush-200/50 blur-3xl" />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.span initial={{ scale: 0.6, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} className="grid h-16 w-16 place-items-center rounded-3xl bg-ink text-white"><Wallet className="h-7 w-7" /></motion.span>
            <div className="flex-1">
              <p className="text-xl font-bold">Tu caja está cerrada</p>
              <p className="text-sm text-ink/55">Ábrela con el fondo inicial para empezar a cobrar en el POS.</p>
            </div>
            <button type="button" className="pbtn-pink h-12! px-7!" onClick={() => setOpenModal(true)}>Abrir caja</button>
          </div>
        </Card>
      )}

      {othersOpen.length > 0 && (
        <Card className="mt-4" delay={0.1}>
          <CardTitle title="Otras cajas abiertas" subtitle="Turnos activos de tu equipo" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {othersOpen.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setViewing(s)} className="flex w-full items-center gap-3 rounded-2xl bg-emerald-50 p-3 text-left transition hover:bg-emerald-100">
                  <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white"><Wallet className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-emerald-400" /></span>
                  <span className="flex-1"><b className="block text-sm">{s.opened_by_name ?? 'Vendedora'}</b><span className="text-xs text-ink/55">Desde {time(s.opened_at)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4" delay={0.15}>
        <CardTitle title="Cortes anteriores" subtitle={role === 'admin' ? 'Todas las cajas' : 'Tus turnos'} />
        {history.length === 0 ? <Empty icon={History} title="Aún no hay cortes" /> : (
          <ul className="divide-y divide-ink/5">
            {history.map((s) => {
              const diff = (s.counted_mxn ?? 0) - (s.expected_mxn ?? 0);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => setViewing(s)} className="-mx-2 grid w-[calc(100%+1rem)] grid-cols-[1fr_auto] items-center gap-3 rounded-2xl px-2 py-3 text-left transition hover:bg-blush-50/60 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
                    <span>
                      <b className="block text-sm">{day(s.opened_at)}</b>
                      <span className="text-xs text-ink/50">{time(s.opened_at)} – {s.closed_at ? time(s.closed_at) : ''}{role === 'admin' && s.opened_by_name ? ` · ${s.opened_by_name}` : ''}</span>
                    </span>
                    <span className="hidden text-sm sm:block"><span className="block text-[11px] text-ink/45">Esperado</span>{money(s.expected_mxn)}</span>
                    <span className="hidden text-sm sm:block"><span className="block text-[11px] text-ink/45">Contado</span>{money(s.counted_mxn)}</span>
                    <span className="hidden sm:block" />
                    <Pill tone={Math.abs(diff) < 0.5 ? 'green' : diff > 0 ? 'blue' : 'red'}>{Math.abs(diff) < 0.5 ? 'Cuadró' : `${diff > 0 ? '+' : '-'}${money(Math.abs(diff))}`}</Pill>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <OpenCashModal open={openModal} onClose={() => setOpenModal(false)} />
      <CashMoveModal session={session} kind={moveKind} onClose={() => setMoveKind(null)} />
      <CloseCashModal session={session} open={closing} onClose={() => setClosing(false)} />
      <SessionSheet session={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function CurrentSession({ session, onMove, onClose }: { session: CashSession; onMove: (k: 'in' | 'out') => void; onClose: () => void }) {
  const { data: summary } = useCashSummary(session.id);
  const { data: moves = [] } = useCashMovements(session.id);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <Card className="bg-[linear-gradient(140deg,#22161a,#4a2c36)]! text-white ring-0!">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Pill tone="green" dot className="bg-emerald-400/15! text-emerald-300!">Caja abierta</Pill>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-white/60"><Clock className="h-3.5 w-3.5" /> Desde las {time(session.opened_at)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Efectivo que debe haber</p>
            <p className="text-3xl font-bold tabular">{money(summary?.expected_mxn ?? session.opening_mxn)}</p>
            {(summary?.expected_usd ?? 0) > 0 && <p className="text-sm text-blush-300">+ {money(summary!.expected_usd, 'USD')}</p>}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <Mini label="Ventas" value={String(summary?.sales ?? 0)} />
          <Mini label="Vendido" value={money(summary?.total_mxn ?? 0)} />
          <Mini label="Fondo" value={money(session.opening_mxn)} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onMove('in')} className="pbtn gap-1.5! bg-white/10 px-2! text-white hover:bg-white/20 sm:gap-2! sm:px-5!"><ArrowDownLeft className="h-4 w-4" /> Entrada</button>
          <button type="button" onClick={() => onMove('out')} className="pbtn gap-1.5! bg-white/10 px-2! text-white hover:bg-white/20 sm:gap-2! sm:px-5!"><ArrowUpRight className="h-4 w-4" /> Salida</button>
          <button type="button" onClick={onClose} className="pbtn gap-1.5! bg-blush-400 px-2! text-ink hover:bg-blush-300 sm:gap-2! sm:px-5!"><Lock className="h-4 w-4" /> Corte</button>
        </div>
      </Card>
      <Card delay={0.05}>
        <CardTitle title="Corte X (parcial)" subtitle="Cómo va tu turno ahora mismo" />
        {summary ? <SummaryBreakdown summary={summary} /> : <SkeletonRows rows={3} />}
        {moves.length > 0 && (
          <div className="mt-4">
            <p className="plabel">Entradas y salidas</p>
            <ul className="space-y-1.5">
              {moves.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <span className={cn('grid h-7 w-7 place-items-center rounded-full', m.kind === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                    {m.kind === 'in' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.reason ?? '—'}</span>
                  <span className="text-xs text-ink/45">{time(m.created_at)}</span>
                  <b className="w-24 text-right tabular">{m.kind === 'in' ? '+' : '-'}{money(m.amount, m.currency)}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

const Mini = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-2xl bg-white/[0.07] p-2.5 sm:p-3">
    <p className="text-[11px] text-white/50">{label}</p>
    <p className="text-sm font-bold leading-tight tabular [overflow-wrap:anywhere] sm:text-base">{value}</p>
  </div>
);

function SessionSheet({ session, onClose }: { session: CashSession | null; onClose: () => void }) {
  const { data: summary } = useCashSummary(session?.id);
  const { data: orders = [] } = useOrders({ cashSessionId: session?.id, limit: 300 }, !!session);
  const diff = session?.status === 'closed' ? (session.counted_mxn ?? 0) - (session.expected_mxn ?? 0) : null;
  return (
    <Sheet
      open={!!session}
      onClose={onClose}
      title={session ? `Caja del ${day(session.opened_at)}` : 'Caja'}
      subtitle={session ? `${session.opened_by_name ?? ''} · ${time(session.opened_at)}${session.closed_at ? ` – ${time(session.closed_at)}` : ' · abierta'}` : undefined}
    >
      {!summary ? <SkeletonRows rows={5} /> : (
        <div className="space-y-5">
          {diff !== null && (
            <div className={cn('rounded-2xl p-4', Math.abs(diff) < 0.5 ? 'bg-emerald-50 text-emerald-800' : diff > 0 ? 'bg-sky-50 text-sky-800' : 'bg-red-50 text-red-700')}>
              <p className="text-sm">Contado {money(session!.counted_mxn)} · Esperado {money(session!.expected_mxn)}</p>
              <p className="text-lg font-bold">{Math.abs(diff) < 0.5 ? 'La caja cuadró' : `${diff > 0 ? 'Sobraron' : 'Faltaron'} ${money(Math.abs(diff))}`}</p>
              {session!.notes && <p className="mt-1 text-sm">“{session!.notes}”</p>}
            </div>
          )}
          <SummaryBreakdown summary={summary} />
          <div>
            <p className="plabel">Ventas del turno</p>
            <ul className="divide-y divide-ink/5 rounded-2xl bg-white px-3 ring-1 ring-ink/5">
              {orders.length === 0 && <li className="py-4 text-sm text-ink/50">Sin ventas</li>}
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/pedidos?id=${o.id}`} onClick={onClose} className="flex items-center gap-2 py-2.5 text-sm sm:gap-3">
                    <b>#{o.folio}</b>
                    <span className="min-w-0 truncate text-ink/50">{time(o.created_at)} · {paymentMethodLabel[o.payment_method]}</span>
                    <span className="ml-auto shrink-0">{o.status === 'cancelled' && <StatusPill status={o.status} />}</span>
                    <b className="shrink-0 tabular">{money(o.total, o.currency)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Sheet>
  );
}
