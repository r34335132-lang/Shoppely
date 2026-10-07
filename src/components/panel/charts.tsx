import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '@/lib/format';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

const compact = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

interface TrendPoint {
  label: string;
  value: number;
  orders?: number;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-2xl bg-ink px-3.5 py-2.5 text-white shadow-xl">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{p.label}</p>
      <p className="mt-0.5 text-base font-bold">{money(p.value)}</p>
      {p.orders !== undefined && <p className="text-xs text-blush-300">{p.orders} {p.orders === 1 ? 'venta' : 'ventas'}</p>}
    </div>
  );
}

export function RevenueArea({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="-mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.blush500} stopOpacity={0.4} />
              <stop offset="100%" stopColor={palette.blush500} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={palette.lilac500} />
              <stop offset="50%" stopColor={palette.blush500} />
              <stop offset="100%" stopColor={palette.blush700} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={palette.ink} strokeOpacity={0.06} strokeDasharray="4 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: `${palette.ink}80` }} minTickGap={18} />
          <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: `${palette.ink}80` }} tickFormatter={(v: number) => `$${compact.format(v)}`} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: palette.blush600, strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="url(#revStroke)"
            strokeWidth={3}
            fill="url(#revFill)"
            animationDuration={1200}
            activeDot={{ r: 6, fill: palette.blush600, stroke: '#fff', strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras por hora del día; la hora pico se resalta. */
export function HourBars({ byHour, from = 9, to = 21 }: { byHour: Record<string, number>; from?: number; to?: number }) {
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const values = hours.map((h) => byHour[String(h)] ?? 0);
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {hours.map((h, i) => (
        <div key={h} className="group flex flex-1 flex-col items-center gap-1.5">
          <div className="relative flex h-32 w-full items-end">
            <motion.div
              className={cn('w-full rounded-full', i === peak && values[i] > 0 ? 'bg-[linear-gradient(180deg,var(--color-blush-400),var(--color-blush-700))]' : 'bg-blush-100 group-hover:bg-blush-200')}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max((values[i] / max) * 100, values[i] > 0 ? 6 : 3)}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 18, delay: i * 0.035 }}
            />
            {values[i] > 0 && (
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] font-bold text-white group-hover:block">
                {money(values[i])}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold text-ink/40">{h}</span>
        </div>
      ))}
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({ segments, size = 168, thickness = 20, center }: { segments: DonutSegment[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${palette.ink}10`} strokeWidth={thickness} />
        {total > 0 && segments.map((s, i) => {
          const len = (s.value / total) * c;
          const gap = segments.filter((x) => x.value > 0).length > 1 ? 4 : 0;
          const el = (
            <motion.circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDashoffset={-offset}
              initial={{ strokeDasharray: `0 ${c}` }}
              animate={{ strokeDasharray: `${Math.max(len - gap, 0)} ${c}` }}
              transition={{ duration: 1, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

export function Sparkline({ values, className, color = palette.blush600 }: { values: number[]; className?: string; color?: string }) {
  const w = 120;
  const h = 36;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-9 w-28', className)} preserveAspectRatio="none">
      <motion.path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
    </svg>
  );
}
