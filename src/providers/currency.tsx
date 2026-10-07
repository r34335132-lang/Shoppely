import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSettings } from '@/hooks/queries';
import { money } from '@/lib/format';
import type { Currency } from '@/lib/types';

interface CurrencyContextValue {
  currency: Currency;
  rate: number;
  setCurrency: (c: Currency) => void;
  format: (amount: number | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const KEY = 'shoppely-currency';

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem(KEY) as Currency | null) ?? 'MXN');

  useEffect(() => {
    localStorage.setItem(KEY, currency);
  }, [currency]);

  const value = useMemo<CurrencyContextValue>(() => ({
    currency,
    rate: settings?.exchange_rate ?? 18.5,
    setCurrency,
    format: (amount) => money(amount, currency),
  }), [currency, settings?.exchange_rate]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency debe usarse dentro de CurrencyProvider');
  return ctx;
}
