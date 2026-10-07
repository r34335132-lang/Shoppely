import type { Currency, StoreSettings } from './types';

/** Tarifa de Mercado Pago: porcentaje y fijo (en la moneda del cobro) más IVA sobre ambos. */
export interface MpRate {
  percent: number;
  fixed: number;
  iva: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Mismo cálculo que public.mp_gross: lo que hay que cobrar para que queden `net` limpios. */
export function mpGross(net: number, rate: MpRate) {
  if (net <= 0) return net;
  const k = 1 + rate.iva / 100;
  const raw = (net + rate.fixed * k) / (1 - (rate.percent / 100) * k);
  return Math.ceil(Number((raw * 100).toFixed(4))) / 100;
}

/** Mismo cálculo que public.mp_fee_of: lo que Mercado Pago descuenta de un cobro. */
export function mpFeeOf(gross: number, rate: MpRate) {
  if (gross <= 0) return 0;
  return r2(((gross * rate.percent) / 100 + rate.fixed) * (1 + rate.iva / 100));
}

/** Comisión que se le suma a la clienta para cobrar `net` limpios. */
export const mpSurcharge = (net: number, rate: MpRate) => r2(mpGross(net, rate) - net);

type FeeSettings = Pick<StoreSettings,
  'exchange_rate' | 'mp_fee_iva'
  | 'mp_fee_online_enabled' | 'mp_fee_online_percent' | 'mp_fee_online_fixed_mxn'
  | 'mp_fee_pos_enabled' | 'mp_fee_pos_percent' | 'mp_fee_pos_fixed_mxn'>;

/** Tarifa vigente para la tienda en línea o la terminal del POS; null si no se cobra comisión. */
export function mpRate(settings: Partial<FeeSettings> | undefined, channel: 'online' | 'pos', currency: Currency): MpRate | null {
  if (!settings) return null;
  const enabled = channel === 'online' ? settings.mp_fee_online_enabled : settings.mp_fee_pos_enabled;
  if (!enabled) return null;
  const percent = Number(channel === 'online' ? settings.mp_fee_online_percent : settings.mp_fee_pos_percent) || 0;
  const fixedMxn = Number(channel === 'online' ? settings.mp_fee_online_fixed_mxn : settings.mp_fee_pos_fixed_mxn) || 0;
  const rate = Number(settings.exchange_rate) || 1;
  return {
    percent,
    fixed: currency === 'MXN' ? fixedMxn : fixedMxn / rate,
    iva: Number(settings.mp_fee_iva ?? 16),
  };
}
