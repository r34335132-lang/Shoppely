import { motion } from 'framer-motion';
import { useCurrency } from '@/providers/currency';
import type { Currency } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CurrencyToggle({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className={cn('relative flex rounded-full bg-ink/5 p-1 text-[11px] font-bold', className)} role="radiogroup" aria-label="Moneda">
      {(['MXN', 'USD'] as Currency[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={currency === c}
          onClick={() => setCurrency(c)}
          className={cn('relative rounded-full px-2.5 py-1 transition-colors', currency === c ? 'text-white' : 'text-ink/60 hover:text-ink')}
        >
          {currency === c && (
            <motion.span layoutId="currency-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
          )}
          <span className="relative">{c}</span>
        </button>
      ))}
    </div>
  );
}
