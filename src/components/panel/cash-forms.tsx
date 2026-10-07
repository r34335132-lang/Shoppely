import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Lock, Wallet } from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { useAction, useCashSummary } from '@/hooks/admin-queries';
import { addCashMovement, closeCashSession, openCashSession } from '@/lib/admin-api';
import { money, paymentMethodLabel } from '@/lib/format';
import type { CashSession, CashSummary, Currency, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Field, Modal, NumberPad, Segmented, SkeletonRows } from './kit';

function AmountDisplay({ label, value, currency, tone = 'ink' }: { label: string; value: string; currency: Currency; tone?: 'ink' | 'light' }) {
  return (
    <div className={cn('rounded-2xl p-4', tone === 'ink' ? 'bg-ink text-white' : 'bg-white ring-1 ring-ink/5')}>
      <p className={cn('text-xs', tone === 'ink' ? 'text-white/60' : 'text-ink/50')}>{label}</p>
      <p className="text-3xl font-bold tabular">{money(Number(value) || 0, currency)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Apertura
// ---------------------------------------------------------------------
export function OpenCashModal({ open, onClose, onOpened, dismissable = true }: { open: boolean; onClose: () => void; onOpened?: (s: CashSession) => void; dismissable?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Abrir caja" size="md" dismissable={dismissable}>
      {open && <OpenCashForm onOpened={(s) => { onOpened?.(s); onClose(); }} />}
    </Modal>
  );
}

function OpenCashForm({ onOpened }: { onOpened: (s: CashSession) => void }) {
  const { profile } = useAuth();
  const [currency, setCurrency] = useState<Currency>('MXN');
  const [mxn, setMxn] = useState('');
  const [usd, setUsd] = useState('');
  const run = useAction(() => openCashSession(profile!.id, Number(mxn) || 0, Number(usd) || 0), '¡Caja abierta! A vender 💕');
  const value = currency === 'MXN' ? mxn : usd;
  const setValue = currency === 'MXN' ? setMxn : setUsd;

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center gap-3 rounded-2xl bg-blush-50 p-4">
        <motion.span initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} className="grid h-12 w-12 place-items-center rounded-2xl bg-blush-600 text-white"><Wallet className="h-6 w-6" /></motion.span>
        <p className="text-sm text-ink/70">Cuenta el efectivo con el que inicias el turno (fondo para dar cambio). Si no tienes, déjalo en cero.</p>
      </div>
      <Segmented size="lg" className="w-full [&>button]:flex-1 [&>button]:justify-center" value={currency} onChange={setCurrency} options={[{ value: 'MXN', label: `Pesos · ${money(Number(mxn) || 0)}` }, { value: 'USD', label: `Dólares · ${money(Number(usd) || 0, 'USD')}` }]} />
      <AmountDisplay label={currency === 'MXN' ? 'Fondo en pesos' : 'Fondo en dólares'} value={value} currency={currency} />
      <NumberPad value={value} onChange={setValue} />
      <button type="button" className="pbtn-pink h-14! w-full text-base" disabled={run.isPending || !profile} onClick={() => run.mutate(undefined, { onSuccess: onOpened })}>
        Abrir caja
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Entradas y salidas
// ---------------------------------------------------------------------
export function CashMoveModal({ session, kind, onClose }: { session: CashSession | null | undefined; kind: 'in' | 'out' | null; onClose: () => void }) {
  return (
    <Modal open={!!kind && !!session} onClose={onClose} title={kind === 'in' ? 'Entrada de efectivo' : 'Salida de efectivo'} size="md">
      {kind && session && <CashMoveForm key={kind} session={session} kind={kind} onDone={onClose} />}
    </Modal>
  );
}

function CashMoveForm({ session, kind, onDone }: { session: CashSession; kind: 'in' | 'out'; onDone: () => void }) {
  const { profile } = useAuth();
  const [currency, setCurrency] = useState<Currency>('MXN');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const run = useAction(() => addCashMovement(session.id, profile!.id, kind, Number(amount), currency, reason), kind === 'in' ? 'Entrada registrada' : 'Salida registrada');
  const presets = kind === 'in' ? ['Cambio extra', 'Depósito del dueño'] : ['Pago a proveedor', 'Gastos de tienda', 'Retiro a caja fuerte'];

  return (
    <div className="space-y-4 pb-2">
      <Segmented size="lg" className="w-full [&>button]:flex-1 [&>button]:justify-center" value={currency} onChange={setCurrency} options={[{ value: 'MXN', label: 'Pesos' }, { value: 'USD', label: 'Dólares' }]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className={cn('rounded-2xl p-4 text-white', kind === 'in' ? 'bg-emerald-600' : 'bg-ink')}>
            <p className="flex items-center gap-1.5 text-xs text-white/70">{kind === 'in' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />} {kind === 'in' ? 'Entra a la caja' : 'Sale de la caja'}</p>
            <p className="text-3xl font-bold tabular">{money(Number(amount) || 0, currency)}</p>
          </div>
          <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} className="pfield" placeholder="¿Para qué?" /></Field>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => <button key={p} type="button" onClick={() => setReason(p)} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition', reason === p ? 'bg-ink text-white' : 'bg-ink/[0.05] hover:bg-ink/10')}>{p}</button>)}
          </div>
        </div>
        <NumberPad value={amount} onChange={setAmount} />
      </div>
      <button type="button" className="pbtn-primary h-14! w-full text-base" disabled={!(Number(amount) > 0) || !reason.trim() || run.isPending} onClick={() => run.mutate(undefined, { onSuccess: onDone })}>
        Registrar {kind === 'in' ? 'entrada' : 'salida'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Corte
// ---------------------------------------------------------------------
export function SummaryBreakdown({ summary }: { summary: CashSummary }) {
  const methods = Object.entries(summary.by_method).filter(([, v]) => (v ?? 0) > 0) as [PaymentMethod, number][];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-3.5 ring-1 ring-ink/5">
          <p className="text-xs text-ink/50">Ventas</p>
          <p className="text-xl font-bold">{summary.sales}</p>
          {summary.cancelled > 0 && <p className="text-[11px] text-red-600">{summary.cancelled} canceladas</p>}
        </div>
        <div className="rounded-2xl bg-white p-3.5 ring-1 ring-ink/5">
          <p className="text-xs text-ink/50">Total vendido</p>
          <p className="text-xl font-bold">{money(summary.total_mxn)}</p>
        </div>
      </div>
      <dl className="space-y-1.5 rounded-2xl bg-white p-4 text-sm ring-1 ring-ink/5">
        {methods.length === 0 && <p className="text-ink/50">Sin cobros todavía</p>}
        {methods.map(([m, v]) => (
          <div key={m} className="flex justify-between"><dt className="text-ink/60">{paymentMethodLabel[m]}</dt><dd className="font-semibold tabular">{money(v)}</dd></div>
        ))}
      </dl>
      <dl className="space-y-1.5 rounded-2xl bg-white p-4 text-sm ring-1 ring-ink/5">
        <div className="flex justify-between"><dt className="text-ink/60">Fondo inicial</dt><dd className="tabular">{money(summary.session.opening_mxn)}{summary.session.opening_usd > 0 && ` + ${money(summary.session.opening_usd, 'USD')}`}</dd></div>
        <div className="flex justify-between"><dt className="text-ink/60">Ventas en efectivo</dt><dd className="tabular">{money(summary.by_method.cash ?? 0)}</dd></div>
        {(summary.cash_in_mxn > 0 || summary.cash_in_usd > 0) && <div className="flex justify-between text-emerald-700"><dt>Entradas</dt><dd className="tabular">+{money(summary.cash_in_mxn)}{summary.cash_in_usd > 0 && ` · +${money(summary.cash_in_usd, 'USD')}`}</dd></div>}
        {(summary.cash_out_mxn > 0 || summary.cash_out_usd > 0) && <div className="flex justify-between text-red-600"><dt>Salidas</dt><dd className="tabular">-{money(summary.cash_out_mxn)}{summary.cash_out_usd > 0 && ` · -${money(summary.cash_out_usd, 'USD')}`}</dd></div>}
        <div className="flex justify-between border-t border-ink/5 pt-2 text-base font-bold"><dt>Efectivo esperado</dt><dd className="tabular">{money(summary.expected_mxn)}</dd></div>
        {summary.expected_usd > 0 && <div className="flex justify-between font-bold"><dt>Dólares esperados</dt><dd className="tabular">{money(summary.expected_usd, 'USD')}</dd></div>}
      </dl>
    </div>
  );
}

export function CloseCashModal({ session, open, onClose, onClosed }: { session: CashSession | null | undefined; open: boolean; onClose: () => void; onClosed?: (s: CashSession) => void }) {
  return (
    <Modal open={open && !!session} onClose={onClose} title="Corte de caja" size="lg">
      {open && session && <CloseCashForm session={session} onDone={(s) => { onClosed?.(s); onClose(); }} />}
    </Modal>
  );
}

function CloseCashForm({ session, onDone }: { session: CashSession; onDone: (s: CashSession) => void }) {
  const { data: summary } = useCashSummary(session.id);
  const [currency, setCurrency] = useState<Currency>('MXN');
  const [mxn, setMxn] = useState('');
  const [usd, setUsd] = useState('');
  const [notes, setNotes] = useState('');
  const run = useAction(() => closeCashSession(session.id, Number(mxn) || 0, Number(usd) || 0, notes), 'Caja cerrada. ¡Buen turno!');
  if (!summary) return <SkeletonRows rows={5} />;

  const diffMxn = (Number(mxn) || 0) - summary.expected_mxn;
  const diffUsd = (Number(usd) || 0) - summary.expected_usd;
  const value = currency === 'MXN' ? mxn : usd;
  const showUsd = summary.expected_usd > 0 || session.opening_usd > 0;

  return (
    <div className="grid gap-5 pb-2 md:grid-cols-2">
      <SummaryBreakdown summary={summary} />
      <div className="space-y-3">
        {showUsd && (
          <Segmented size="lg" className="w-full [&>button]:flex-1 [&>button]:justify-center" value={currency} onChange={setCurrency} options={[{ value: 'MXN', label: 'Pesos' }, { value: 'USD', label: 'Dólares' }]} />
        )}
        <div className="rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs text-white/60">Efectivo contado en {currency === 'MXN' ? 'pesos' : 'dólares'}</p>
          <p className="text-3xl font-bold tabular">{money(Number(value) || 0, currency)}</p>
          {value !== '' && (
            <p className={cn('mt-1 text-sm font-semibold', (currency === 'MXN' ? diffMxn : diffUsd) === 0 ? 'text-emerald-300' : (currency === 'MXN' ? diffMxn : diffUsd) > 0 ? 'text-sky-300' : 'text-red-300')}>
              {(currency === 'MXN' ? diffMxn : diffUsd) === 0 ? '¡Cuadra perfecto!' : `${(currency === 'MXN' ? diffMxn : diffUsd) > 0 ? 'Sobran' : 'Faltan'} ${money(Math.abs(currency === 'MXN' ? diffMxn : diffUsd), currency)}`}
            </p>
          )}
        </div>
        <NumberPad value={value} onChange={currency === 'MXN' ? setMxn : setUsd} />
        <Field label="Notas del corte"><input value={notes} onChange={(e) => setNotes(e.target.value)} className="pfield" placeholder="Opcional" /></Field>
        <button type="button" className="pbtn-primary h-14! w-full text-base" disabled={mxn === '' || run.isPending} onClick={() => run.mutate(undefined, { onSuccess: onDone })}>
          <Lock className="h-4 w-4" /> Cerrar caja
        </button>
      </div>
    </div>
  );
}
