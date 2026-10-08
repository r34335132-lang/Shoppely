import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Building2, CreditCard, DollarSign, Globe, Landmark, Percent, RotateCcw, Save, Share2, Smartphone, Store, Truck } from 'lucide-react';
import { useSettings } from '@/hooks/queries';
import { useAction } from '@/hooks/admin-queries';
import { saveSettings } from '@/lib/admin-api';
import { resetDemoDb } from '@/lib/demo-db';
import { isDemo } from '@/lib/supabase';
import { mpFeeOf, mpGross, type MpRate } from '@/lib/fees';
import { money } from '@/lib/format';
import type { StoreSettings } from '@/lib/types';
import { Card, Field, PageHeader, Segmented, SkeletonRows, Switch, useConfirm } from '@/components/panel/kit';

export default function Settings() {
  const { data: settings } = useSettings();
  if (!settings) return <SkeletonRows rows={6} />;
  return <SettingsForm initial={settings} />;
}

function SettingsForm({ initial }: { initial: StoreSettings }) {
  const [s, setS] = useState<StoreSettings>(initial);
  const confirm = useConfirm();
  const save = useAction(saveSettings, 'Ajustes guardados');
  useEffect(() => setS(initial), [initial]);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const text = (k: keyof StoreSettings) => ({
    value: (s[k] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as never),
  });
  type NumberKey = 'exchange_rate' | 'shipping_fee_mxn' | 'free_shipping_min_mxn' | 'mp_fee_online_percent' | 'mp_fee_online_fixed_mxn'
    | 'mp_fee_pos_percent' | 'mp_fee_pos_fixed_mxn' | 'mp_fee_iva';
  const number = (k: NumberKey) => ({
    value: s[k] ?? null,
    nullable: k === 'free_shipping_min_mxn',
    onChange: (v: number | null) => set(k, v as never),
  });

  const resetDemo = async () => {
    const ok = await confirm({ title: '¿Reiniciar los datos de demostración?', text: 'Se borran los productos, ventas y cambios hechos en este navegador y se vuelven a generar los de ejemplo.', confirmLabel: 'Reiniciar', danger: true });
    if (ok === false) return;
    resetDemoDb();
    window.location.reload();
  };

  return (
    <div className="pb-24">
      <PageHeader eyebrow="General" title="Ajustes" subtitle="Datos de la tienda, pagos, envíos y tipo de cambio." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Section icon={Store} title="Tienda" delay={0}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre"><input {...text('store_name')} className="pfield" /></Field>
            <Field label="Frase"><input {...text('tagline')} className="pfield" placeholder="Moda y belleza" /></Field>
            <Field label="Correo de contacto"><input {...text('contact_email')} type="email" className="pfield" /></Field>
            <Field label="Dirección"><input {...text('address')} className="pfield" placeholder="Para el ticket y recoger en tienda" /></Field>
          </div>
        </Section>

        <Section icon={Share2} title="Redes sociales" delay={0.05}>
          <div className="grid gap-4">
            <Field label="WhatsApp" hint="Con código de país, ej. +1 773 849 7180"><input {...text('whatsapp')} className="pfield" inputMode="tel" /></Field>
            <Field label="Instagram"><input {...text('instagram_url')} className="pfield" placeholder="https://instagram.com/…" /></Field>
            <Field label="Facebook"><input {...text('facebook_url')} className="pfield" placeholder="https://facebook.com/…" /></Field>
          </div>
        </Section>

        <Section icon={DollarSign} title="Moneda" delay={0.1}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Moneda por defecto">
              <Segmented className="w-full [&>button]:flex-1 [&>button]:justify-center" value={s.default_currency} onChange={(v) => set('default_currency', v)} options={[{ value: 'MXN', label: 'Pesos MXN' }, { value: 'USD', label: 'Dólares USD' }]} />
            </Field>
            <Field label="Tipo de cambio" hint={`1 USD = ${money(s.exchange_rate)} · se usa cuando un producto no tiene precio en dólares`}>
              <DecimalInput {...number('exchange_rate')} />
            </Field>
          </div>
        </Section>

        <Section icon={Truck} title="Envíos" delay={0.15}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Costo de envío (MXN)"><DecimalInput {...number('shipping_fee_mxn')} /></Field>
            <Field label="Envío gratis desde (MXN)" hint="Vacío = nunca gratis"><DecimalInput {...number('free_shipping_min_mxn')} placeholder="Sin envío gratis" /></Field>
          </div>
        </Section>

        <Section icon={CreditCard} title="Formas de pago en línea" delay={0.2}>
          <div className="grid gap-3 sm:grid-cols-3">
            <PayToggle icon={Banknote} label="Efectivo" text="Al recoger o contra entrega" checked={s.cash_enabled} onChange={(v) => set('cash_enabled', v)} />
            <PayToggle icon={Landmark} label="Transferencia" text="Con los datos bancarios" checked={s.transfer_enabled} onChange={(v) => set('transfer_enabled', v)} />
            <PayToggle icon={CreditCard} label="Mercado Pago" text="Tarjeta, OXXO y más" checked={s.mercadopago_enabled} onChange={(v) => set('mercadopago_enabled', v)} />
          </div>
          <p className="mt-3 text-xs text-ink/50">En el POS siempre están disponibles las tres formas de pago.</p>
        </Section>

        <Section icon={Percent} title="Comisión de Mercado Pago" delay={0.22}>
          <p className="-mt-1 mb-4 text-sm text-ink/60">
            Se le suma a la clienta lo que cobra Mercado Pago, para que a ti te quede el precio completo. Solo aplica al pagar con Mercado Pago.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <FeeCard
              icon={Globe}
              title="Tienda en línea"
              text="Checkout de Mercado Pago"
              enabled={s.mp_fee_online_enabled}
              onToggle={(v) => set('mp_fee_online_enabled', v)}
              percent={number('mp_fee_online_percent')}
              fixed={number('mp_fee_online_fixed_mxn')}
              rate={{ percent: s.mp_fee_online_percent, fixed: s.mp_fee_online_fixed_mxn, iva: s.mp_fee_iva }}
            />
            <FeeCard
              icon={Smartphone}
              title="Terminal en tienda (POS)"
              text="Mercado Pago Point"
              enabled={s.mp_fee_pos_enabled}
              onToggle={(v) => set('mp_fee_pos_enabled', v)}
              percent={number('mp_fee_pos_percent')}
              fixed={number('mp_fee_pos_fixed_mxn')}
              rate={{ percent: s.mp_fee_pos_percent, fixed: s.mp_fee_pos_fixed_mxn, iva: s.mp_fee_iva }}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="IVA sobre la comisión (%)" hint="Mercado Pago cobra IVA sobre su tarifa"><DecimalInput {...number('mp_fee_iva')} /></Field>
            <p className="self-end pb-1 text-xs leading-relaxed text-ink/50">
              Revisa tu tarifa en Mercado Pago → Tu negocio → Costos. Depende de cuándo quieres recibir el dinero (al instante, 14 o 30 días).
            </p>
          </div>
        </Section>

        <Section icon={Building2} title="Datos para transferencia" delay={0.25}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banco"><input {...text('bank_name')} className="pfield" /></Field>
            <Field label="Titular"><input {...text('bank_account_holder')} className="pfield" /></Field>
            <Field label="CLABE"><input {...text('bank_clabe')} className="pfield font-mono" inputMode="numeric" /></Field>
            <Field label="Número de cuenta / tarjeta"><input {...text('bank_account_number')} className="pfield font-mono" inputMode="numeric" /></Field>
            <Field label="Instrucciones" className="sm:col-span-2"><textarea {...text('transfer_instructions')} rows={2} className="pfield h-auto! py-2.5" placeholder="Envía tu comprobante por WhatsApp con tu número de pedido" /></Field>
          </div>
        </Section>

        {isDemo && (
          <Section icon={RotateCcw} title="Modo demostración" delay={0.3}>
            <p className="text-sm text-ink/60">Los datos se guardan solo en este navegador. Puedes reiniciarlos cuando quieras para volver a los de ejemplo.</p>
            <button type="button" className="pbtn-danger mt-4" onClick={resetDemo}><RotateCcw className="h-4 w-4" /> Reiniciar datos demo</button>
          </Section>
        )}
      </div>

      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-2 rounded-full bg-ink p-2 pl-4 text-white shadow-2xl sm:gap-3 sm:pl-5 lg:left-[290px]"
          >
            <span className="min-w-0 flex-1 text-[13px] leading-tight sm:text-sm">Tienes cambios sin guardar</span>
            <button type="button" className="pbtn h-10! px-3! text-white/70 hover:text-white sm:px-5!" onClick={() => setS(initial)}>Descartar</button>
            <button type="button" className="pbtn h-10! bg-blush-400 text-ink hover:bg-blush-300" disabled={save.isPending} onClick={() => save.mutate(s)}><Save className="h-4 w-4" /> Guardar</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ icon: Icon, title, children, delay }: { icon: typeof Store; title: string; children: ReactNode; delay: number }) {
  return (
    <Card delay={delay}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blush-50 text-blush-700"><Icon className="h-4 w-4" /></span>
        <h2 className="text-[17px] font-bold">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

/** Guarda el texto mientras se escribe para que "3." o "18.5" no se pierdan al convertir a número. */
function DecimalInput({ value, onChange, nullable = false, placeholder, suffix }: {
  value: number | null;
  onChange: (v: number | null) => void;
  nullable?: boolean;
  placeholder?: string;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => {
    const same = draft === '' ? value === null || (!nullable && value === 0) : Number(draft) === value;
    if (!same) setDraft(value === null ? '' : String(value));
  }, [value, draft, nullable]);
  return (
    <div className="relative">
      <input
        value={draft}
        inputMode="decimal"
        placeholder={placeholder}
        className={`pfield ${suffix ? 'pr-12' : ''}`}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
          setDraft(v);
          onChange(v === '' ? (nullable ? null : 0) : Number(v));
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink/40">{suffix}</span>}
    </div>
  );
}

function FeeCard({ icon: Icon, title, text, enabled, onToggle, percent, fixed, rate }: {
  icon: typeof Store;
  title: string;
  text: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  percent: { value: number | null; onChange: (v: number | null) => void };
  fixed: { value: number | null; onChange: (v: number | null) => void };
  rate: MpRate;
}) {
  const example = 1000;
  const gross = mpGross(example, rate);
  return (
    <div className={`rounded-2xl p-4 ring-1 transition ${enabled ? 'bg-blush-50 ring-blush-200' : 'bg-white ring-ink/[0.07]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${enabled ? 'bg-white text-blush-700' : 'bg-ink/[0.04] text-ink/40'}`}><Icon className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="text-xs text-ink/50">{text}</p>
          </div>
        </div>
        <Switch size="sm" checked={enabled} onChange={onToggle} />
      </div>
      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Porcentaje"><DecimalInput {...percent} suffix="%" /></Field>
              <Field label="Cargo fijo"><DecimalInput {...fixed} suffix="MXN" /></Field>
            </div>
            <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs leading-relaxed text-ink/70">
              Vendes <b className="text-ink">{money(example)}</b> → la clienta paga <b className="text-ink">{money(gross)}</b> → Mercado Pago se queda con {money(mpFeeOf(gross, rate))} y a ti te quedan <b className="text-emerald-700">{money(gross - mpFeeOf(gross, rate))}</b>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!enabled && <p className="mt-3 text-xs text-ink/50">La comisión la absorbe la tienda.</p>}
    </div>
  );
}

function PayToggle({ icon: Icon, label, text, checked, onChange }: { icon: typeof Store; label: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 transition ${checked ? 'bg-blush-50 ring-blush-200' : 'bg-white ring-ink/[0.07]'}`}>
      <div className="flex items-center justify-between">
        <Icon className={`h-5 w-5 ${checked ? 'text-blush-700' : 'text-ink/40'}`} />
        <Switch size="sm" checked={checked} onChange={onChange} />
      </div>
      <p className="mt-3 text-sm font-bold">{label}</p>
      <p className="text-xs text-ink/50">{text}</p>
    </div>
  );
}
