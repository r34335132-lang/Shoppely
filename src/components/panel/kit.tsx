import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ComponentType, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowUpRight, Delete, ImageIcon, Search, TrendingDown, TrendingUp, X } from 'lucide-react';
import { money, orderStatusLabel, paymentStatusLabel } from '@/lib/format';
import type { OrderStatus, PaymentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const spring = { type: 'spring', stiffness: 320, damping: 30 } as const;

// ---------------------------------------------------------------------
// Encabezados y tarjetas
// ---------------------------------------------------------------------
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        {eyebrow && <p className="eyebrow mb-1.5 text-blush-700">{eyebrow}</p>}
        <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/55">{subtitle}</p>}
      </motion.div>
      {actions && (
        <motion.div className="flex flex-wrap items-center gap-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }}>
          {actions}
        </motion.div>
      )}
    </div>
  );
}

export function Card({ className, children, delay = 0 }: { className?: string; children: ReactNode; delay?: number }) {
  return (
    <motion.section
      className={cn('pcard', className)}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.section>
  );
}

export function CardTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type NumberFormat = 'money' | 'number' | 'percent' | 'decimal';

function formatNumber(value: number, format: NumberFormat) {
  if (format === 'money') return money(Math.round(value));
  if (format === 'percent') return `${value.toFixed(1)}%`;
  if (format === 'decimal') return value.toFixed(1);
  return Math.round(value).toLocaleString('es-MX');
}

export function CountUp({ value, format = 'number', className }: { value: number; format?: NumberFormat; className?: string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => formatNumber(v, format));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className={cn('tabular', className)}>{text}</motion.span>;
}

export function Delta({ value, light }: { value: number | null | undefined; light?: boolean }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
      light ? 'bg-white/20 text-white' : up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
    )}>
      <Icon className="h-3 w-3" /> {up ? '+' : ''}{value.toFixed(0)}%
    </span>
  );
}

export function StatCard({
  label, value, format = 'number', icon: Icon, highlight, hint, delta, delay = 0, onClick,
}: {
  label: string;
  value: number;
  format?: NumberFormat;
  icon?: ComponentType<{ className?: string }>;
  highlight?: boolean;
  hint?: ReactNode;
  delta?: number | null;
  delay?: number;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-[26px] p-5 text-left disabled:cursor-default',
        highlight
          ? 'bg-[linear-gradient(140deg,var(--color-blush-400)_0%,var(--color-blush-600)_45%,#4e2531_100%)] text-white shadow-[0_18px_40px_-18px_rgba(135,68,82,0.8)]'
          : 'pcard',
      )}
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay }}
      whileHover={onClick ? { y: -4 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {highlight && (
        <>
          <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-sm" />
          <span className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-lilac-300/30 blur-2xl" />
        </>
      )}
      <div className="relative flex items-start justify-between gap-3">
        <p className={cn('text-sm font-semibold', highlight ? 'text-white/90' : 'text-ink/70')}>{label}</p>
        <span className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full border transition duration-300 group-hover:rotate-45',
          highlight ? 'border-white/40 bg-white text-blush-700' : 'border-ink/10 bg-white text-ink',
        )}>
          {Icon ? <Icon className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
      </div>
      <div className="relative">
        <CountUp value={value} format={format} className="block text-[30px] font-bold leading-none tracking-tight sm:text-[34px]" />
        <div className={cn('mt-2.5 flex flex-wrap items-center gap-2 text-xs', highlight ? 'text-white/80' : 'text-ink/50')}>
          <Delta value={delta} light={highlight} />
          {hint}
        </div>
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------
// Etiquetas de estado
// ---------------------------------------------------------------------
export type Tone = 'neutral' | 'pink' | 'green' | 'amber' | 'red' | 'blue' | 'ink' | 'violet';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-ink/[0.05] text-ink/70',
  pink: 'bg-blush-100 text-blush-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-sky-50 text-sky-700',
  ink: 'bg-ink text-white',
  violet: 'bg-lilac-100 text-lilac-700',
};

const dotClass: Record<Tone, string> = {
  neutral: 'bg-ink/40', pink: 'bg-blush-500', green: 'bg-emerald-500', amber: 'bg-amber-500',
  red: 'bg-red-500', blue: 'bg-sky-500', ink: 'bg-white', violet: 'bg-lilac-500',
};

export function Pill({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold', toneClass[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotClass[tone])} />}
      {children}
    </span>
  );
}

export const orderStatusTone: Record<OrderStatus, Tone> = {
  pending: 'amber', confirmed: 'blue', preparing: 'violet', shipped: 'pink', delivered: 'green', completed: 'green', cancelled: 'red',
};

export const paymentStatusTone: Record<PaymentStatus, Tone> = {
  pending: 'amber', paid: 'green', refunded: 'neutral', failed: 'red',
};

export const StatusPill = ({ status }: { status: OrderStatus }) => <Pill tone={orderStatusTone[status]} dot>{orderStatusLabel[status]}</Pill>;
export const PaymentPill = ({ status }: { status: PaymentStatus }) => <Pill tone={paymentStatusTone[status]}>{paymentStatusLabel[status]}</Pill>;

// ---------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------
export function Segmented<T extends string>({
  value, onChange, options, className, size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  size?: 'md' | 'lg';
}) {
  const id = useId();
  return (
    <div className={cn('no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-ink/[0.05] p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition-colors',
              size === 'lg' ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-[13px]',
              active ? 'text-white' : 'text-ink/60 hover:text-ink',
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-ink" transition={spring} />}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && o.count > 0 && (
              <span className={cn('relative rounded-full px-1.5 text-[10px] font-bold', active ? 'bg-blush-400 text-ink' : 'bg-ink/10')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value, onChange, placeholder = 'Buscar…', className, autoFocus, onKeyDown, inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className={cn('relative flex items-center', className)}>
      <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-ink/40" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pfield rounded-full pl-10 pr-9"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 grid h-7 w-7 place-items-center rounded-full hover:bg-ink/5" aria-label="Limpiar">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean; size?: 'sm' | 'md' }) {
  const small = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 text-left disabled:opacity-50"
    >
      <span className={cn('relative shrink-0 rounded-full p-0.5 transition-colors duration-300', small ? 'h-6 w-10' : 'h-7 w-12', checked ? 'bg-blush-600' : 'bg-ink/15')}>
        <motion.span
          className={cn('block rounded-full bg-white shadow', small ? 'h-5 w-5' : 'h-6 w-6')}
          animate={{ x: checked ? (small ? 16 : 20) : 0 }}
          transition={spring}
        />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="plabel">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/45">{hint}</span>}
    </label>
  );
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const initials = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const hue = [...(name ?? '')].reduce((h, c) => h + c.charCodeAt(0), 0) % 4;
  const bg = ['from-blush-300 to-blush-500', 'from-amber-200 to-blush-400', 'from-violet-200 to-blush-400', 'from-blush-200 to-rose-400'][hue];
  return (
    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-ink', bg, className)}>
      {initials}
    </span>
  );
}

export function Thumb({ src, className, iconClassName, draggable }: { src: string | null | undefined; className?: string; iconClassName?: string; draggable?: boolean }) {
  if (src) return <img src={src} alt="" className={cn('shrink-0 object-cover', className)} draggable={draggable} />;
  return (
    <span className={cn('grid shrink-0 place-items-center bg-gradient-to-br from-blush-50 to-blush-100 text-blush-400', className)}>
      <ImageIcon className={cn('h-4 w-4', iconClassName)} />
    </span>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: ComponentType<{ className?: string }>; title: string; text?: string; action?: ReactNode }) {
  return (
    <motion.div className="flex flex-col items-center justify-center px-6 py-14 text-center" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
      <motion.span
        className="grid h-16 w-16 place-items-center rounded-3xl bg-blush-100 text-blush-700"
        animate={{ y: [0, -6, 0], rotate: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon className="h-7 w-7" />
      </motion.span>
      <p className="mt-4 text-base font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink/55">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-ink/[0.04]" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Capas: panel lateral, modal y confirmación
// ---------------------------------------------------------------------
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export function Sheet({
  open, onClose, title, subtitle, children, footer, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className={cn(
              'absolute inset-y-0 right-0 flex w-full flex-col bg-[#fcf9f6] shadow-2xl sm:inset-y-2 sm:right-2 sm:rounded-[28px]',
              wide ? 'sm:max-w-3xl' : 'sm:max-w-xl',
            )}
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink/5 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold tracking-tight">{title}</h2>
                {subtitle && <div className="mt-0.5 text-sm text-ink/55">{subtitle}</div>}
              </div>
              <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white ring-1 ring-ink/10 transition hover:rotate-90" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
            {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/5 bg-white/70 px-5 py-4 sm:rounded-b-[28px] sm:px-6">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Modal({
  open, onClose, title, children, footer, size = 'md', dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  dismissable?: boolean;
}) {
  useEscape(open && dismissable, onClose);
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-end p-0 sm:place-items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={dismissable ? onClose : undefined} />
          <motion.div
            className={cn('relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-[#fcf9f6] shadow-2xl sm:rounded-[30px]', width)}
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          >
            {title && (
              <header className="flex items-center justify-between gap-4 px-6 pb-2 pt-5">
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                {dismissable && (
                  <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-ink/10 transition hover:rotate-90" aria-label="Cerrar">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </header>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">{children}</div>
            {footer && <footer className="flex flex-wrap items-center justify-end gap-2 px-6 pb-6 pt-2">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ConfirmOptions {
  title: string;
  text?: string;
  confirmLabel?: string;
  danger?: boolean;
  input?: { label: string; placeholder?: string; required?: boolean };
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<string | false>;
const ConfirmContext = createContext<ConfirmFn>(async () => false);

/** `await confirm({...})` devuelve false si se cancela, o el texto capturado (o '') si se acepta. */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: string | false) => void }) | null>(null);
  const [text, setText] = useState('');
  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => {
    setText('');
    setState({ ...opts, resolve });
  }), []);
  const close = (value: string | false) => {
    state?.resolve(value);
    setState(null);
  };
  const blocked = !!state?.input?.required && !text.trim();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        size="sm"
        footer={
          <>
            <button type="button" className="pbtn-ghost" onClick={() => close(false)}>Cancelar</button>
            <button type="button" disabled={blocked} className={state?.danger ? 'pbtn bg-red-600 text-white hover:bg-red-700' : 'pbtn-primary'} onClick={() => close(text.trim())}>
              {state?.confirmLabel ?? 'Confirmar'}
            </button>
          </>
        }
      >
        {state && (
          <div className="pt-3">
            <p className="text-lg font-bold">{state.title}</p>
            {state.text && <p className="mt-1.5 text-sm text-ink/60">{state.text}</p>}
            {state.input && (
              <Field label={state.input.label} className="mt-4">
                <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={state.input.placeholder} className="pfield" />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

// ---------------------------------------------------------------------
// Teclado numérico táctil (POS y caja)
// ---------------------------------------------------------------------
export function NumberPad({
  value, onChange, decimals = true, className,
}: {
  value: string;
  onChange: (v: string) => void;
  decimals?: boolean;
  className?: string;
}) {
  const press = (key: string) => {
    if (key === 'del') return onChange(value.slice(0, -1));
    if (key === 'clear') return onChange('');
    if (key === '.') {
      if (!decimals || value.includes('.')) return;
      return onChange(value ? `${value}.` : '0.');
    }
    const [, dec] = value.split('.');
    if (dec !== undefined && dec.length >= 2) return;
    if (value === '0') return onChange(key);
    if (value.replace('.', '').length >= 9) return;
    onChange(value + key);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals ? '.' : 'clear', '0', 'del'];
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {keys.map((k) => (
        <motion.button
          key={k}
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => press(k)}
          className={cn(
            'grid h-14 place-items-center rounded-2xl text-xl font-semibold transition-colors select-none',
            k === 'del' || k === 'clear' ? 'bg-ink/[0.06] text-ink/70 hover:bg-ink/10' : 'bg-white ring-1 ring-ink/[0.07] hover:bg-blush-50',
          )}
          aria-label={k === 'del' ? 'Borrar' : k === 'clear' ? 'Limpiar' : k}
        >
          {k === 'del' ? <Delete className="h-5 w-5" /> : k === 'clear' ? <span className="text-sm">C</span> : k}
        </motion.button>
      ))}
    </div>
  );
}

/** Mantiene el valor anterior mientras llegan datos nuevos (evita parpadeos). */
export function useStable<T>(value: T | undefined) {
  const ref = useRef(value);
  if (value !== undefined) ref.current = value;
  return ref.current;
}
