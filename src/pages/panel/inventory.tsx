import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Boxes, History, Minus, PackageCheck, Plus, ScanBarcode } from 'lucide-react';
import { useAction, useAdminCategories, useAdminProducts, useMovements } from '@/hooks/admin-queries';
import { adjustStock, setStock } from '@/lib/admin-api';
import { findByCode } from '@/lib/codes';
import { beep } from '@/lib/sound';
import type { AdminProduct, MovementReason, Variant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, Empty, Field, Modal, NumberPad, PageHeader, Pill, SearchInput, Segmented, SkeletonRows, Thumb } from '@/components/panel/kit';
import { CameraScanner, useBarcodeWedge } from '@/components/panel/scanner';
import { movementLabel, movementTone } from './inventory-shared';

type Tab = 'stock' | 'moves';
type StockFilter = 'all' | 'low' | 'out';
type Row = Variant & { product: AdminProduct };

export default function Inventory() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'movimientos' ? 'moves' : 'stock');
  const [scanOpen, setScanOpen] = useState(params.get('scan') === '1');
  const [adjusting, setAdjusting] = useState<Row | null>(null);
  const { data: products = [] } = useAdminProducts();

  useEffect(() => {
    if (params.has('scan') || params.has('tab')) {
      setParams((p) => { const n = new URLSearchParams(p); n.delete('scan'); n.delete('tab'); return n; }, { replace: true });
    }
    // Solo al entrar: los parámetros abren el escáner o la pestaña una vez.
  }, []);

  const openByCode = (code: string) => {
    const hit = findByCode(products, code);
    if (!hit) {
      beep('error');
      toast.error(`No hay ningún producto con el código ${code}`);
      return;
    }
    beep('scan');
    setTab('stock');
    setAdjusting({ ...hit.variant, product: hit.product });
  };

  useBarcodeWedge(openByCode, !adjusting && !scanOpen);

  return (
    <>
      <PageHeader
        eyebrow="Almacén"
        title="Inventario"
        subtitle="Escanea un código o búscalo para registrar entradas, mermas o conteos."
        actions={
          <>
            <Segmented value={tab} onChange={setTab} options={[{ value: 'stock', label: 'Existencias' }, { value: 'moves', label: 'Movimientos' }]} />
            <button type="button" className="pbtn-pink" onClick={() => setScanOpen(true)}><ScanBarcode className="h-4 w-4" /> Escanear</button>
          </>
        }
      />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {tab === 'stock'
            ? <StockList initialFilter={params.get('filtro') === 'low' ? 'low' : 'all'} onAdjust={setAdjusting} onCode={openByCode} />
            : <MovementsList />}
        </motion.div>
      </AnimatePresence>
      <CameraScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetect={openByCode} />
      <AdjustModal row={adjusting} onClose={() => setAdjusting(null)} />
    </>
  );
}

function StockList({ initialFilter, onAdjust, onCode }: { initialFilter: StockFilter; onAdjust: (r: Row) => void; onCode: (code: string) => void }) {
  const { data: products, isLoading } = useAdminProducts();
  const { data: categories = [] } = useAdminCategories();
  const [filter, setFilter] = useState<StockFilter>(initialFilter);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim().toLowerCase());
  const quick = useAction(({ id, change }: { id: string; change: number }) =>
    adjustStock(id, change, change > 0 ? 'restock' : 'adjustment', 'Ajuste rápido'));

  const rows = useMemo<Row[]>(() => (products ?? [])
    .flatMap((p) => p.variants.filter((v) => v.active).map((v) => ({ ...v, product: p })))
    .filter((r) => {
      if (category !== 'all' && r.product.category_id !== category) return false;
      if (filter === 'low' && !(r.stock > 0 && r.stock <= r.low_stock_threshold) && r.stock !== 0) return false;
      if (filter === 'out' && r.stock !== 0) return false;
      if (!q) return true;
      return [r.product.name, r.name, r.sku, r.barcode, r.product.brand].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => (filter === 'all' ? 0 : a.stock - b.stock)), [products, category, filter, q]);

  const all = (products ?? []).flatMap((p) => p.variants.filter((v) => v.active));
  const lowCount = all.filter((v) => v.stock <= v.low_stock_threshold).length;
  const outCount = all.filter((v) => v.stock === 0).length;
  const units = rows.reduce((s, r) => s + r.stock, 0);

  return (
    <>
      <Card className="p-3! sm:p-4!">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Producto, SKU o código (Enter para abrir)"
              className="min-w-[220px] flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  onCode(search.trim());
                  setSearch('');
                }
              }}
            />
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[{ value: 'all', label: 'Todo' }, { value: 'low', label: 'Por reabastecer', count: lowCount }, { value: 'out', label: 'Agotados', count: outCount }]}
            />
          </div>
          <Segmented value={category} onChange={setCategory} options={[{ value: 'all', label: 'Todas' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
      </Card>

      <div className="mt-4 flex items-center justify-between px-1 text-sm text-ink/55">
        <span>{rows.length} variantes</span>
        <span><b className="text-ink">{units.toLocaleString('es-MX')}</b> unidades</span>
      </div>

      <Card className="mt-2 p-2! sm:p-3!" delay={0.05}>
        {isLoading ? <SkeletonRows rows={8} /> : rows.length === 0 ? (
          <Empty icon={Boxes} title="Nada por aquí" text="No hay variantes con esos filtros." />
        ) : (
          <ul className="divide-y divide-ink/5">
            {rows.map((r, i) => {
              const tone = r.stock === 0 ? 'red' : r.stock <= r.low_stock_threshold ? 'amber' : 'green';
              return (
                <motion.li key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.25) }} className="flex items-center gap-3 px-2 py-2.5">
                  <button type="button" onClick={() => onAdjust(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Thumb src={r.product.images[0]} className="h-12 w-12 rounded-xl" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{r.product.name}</span>
                      <span className="flex items-center gap-1.5 truncate text-xs text-ink/50">
                        {r.color_hex && <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-ink/10" style={{ background: r.color_hex }} />}
                        {r.name}{r.sku && <span className="font-mono"> · {r.sku}</span>}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <motion.button whileTap={{ scale: 0.85 }} type="button" disabled={r.stock === 0 || quick.isPending} onClick={() => quick.mutate({ id: r.id, change: -1 })} className="grid h-11 w-11 place-items-center rounded-full bg-ink/[0.05] hover:bg-ink/10 disabled:opacity-30" aria-label="Restar uno"><Minus className="h-4 w-4" /></motion.button>
                    <motion.span key={r.stock} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="w-14 text-center">
                      <Pill tone={tone} className="px-3 text-sm">{r.stock}</Pill>
                    </motion.span>
                    <motion.button whileTap={{ scale: 0.85 }} type="button" disabled={quick.isPending} onClick={() => quick.mutate({ id: r.id, change: 1 })} className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white hover:bg-blush-700 disabled:opacity-30" aria-label="Sumar uno"><Plus className="h-4 w-4" /></motion.button>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------
// Ajuste con teclado numérico
// ---------------------------------------------------------------------
type Mode = 'in' | 'out' | 'count';

function AdjustModal({ row, onClose }: { row: Row | null; onClose: () => void }) {
  return (
    <Modal open={!!row} onClose={onClose} title="Ajustar existencias" size="md">
      {row && <AdjustForm key={row.id} row={row} onDone={onClose} />}
    </Modal>
  );
}

function AdjustForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const { data: products } = useAdminProducts();
  const live = products?.flatMap((p) => p.variants).find((v) => v.id === row.id)?.stock ?? row.stock;
  const { data: history = [] } = useMovements(row.id, 5);
  const [mode, setMode] = useState<Mode>('in');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<MovementReason>('damage');
  const [note, setNote] = useState('');
  const n = Number(qty) || 0;
  const after = mode === 'count' ? n : mode === 'in' ? live + n : live - n;
  const invalid = qty === '' || (mode !== 'count' && n === 0) || after < 0 || (mode === 'count' && n === live);

  const run = useAction(async () => {
    if (mode === 'count') return setStock(row.id, n, note || 'Conteo físico');
    return adjustStock(row.id, mode === 'in' ? n : -n, mode === 'in' ? 'restock' : reason, note);
  }, (stock) => `Listo: ahora hay ${stock} pzs`);

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/5">
        <Thumb src={row.product.images[0]} className="h-14 w-14 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{row.product.name}</p>
          <p className="truncate text-xs text-ink/50">{row.name}{row.barcode ? ` · ${row.barcode}` : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase text-ink/45">Actual</p>
          <p className="text-2xl font-bold tabular">{live}</p>
        </div>
      </div>

      <Segmented
        size="lg"
        value={mode}
        onChange={(m) => { setMode(m); setQty(''); }}
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
        options={[{ value: 'in', label: 'Entrada' }, { value: 'out', label: 'Salida' }, { value: 'count', label: 'Conteo' }]}
      />

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-3 rounded-2xl bg-ink p-4 text-white">
            <p className="text-xs text-white/60">{mode === 'count' ? 'Piezas contadas' : mode === 'in' ? 'Piezas que llegan' : 'Piezas que salen'}</p>
            <p className="text-4xl font-bold tabular">{qty || '0'}</p>
            <p className={cn('mt-1 text-sm', after < 0 ? 'text-red-300' : 'text-blush-300')}>
              Quedará en <b>{after}</b> {mode === 'count' && qty !== '' && <span className="text-white/60">({n - live >= 0 ? '+' : ''}{n - live})</span>}
            </p>
          </div>
          {mode === 'out' && (
            <Field label="Motivo" className="mb-3">
              <select value={reason} onChange={(e) => setReason(e.target.value as MovementReason)} className="pfield">
                <option value="damage">Merma / dañado</option>
                <option value="adjustment">Ajuste / extravío</option>
              </select>
            </Field>
          )}
          <Field label="Nota (opcional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} className="pfield" placeholder={mode === 'in' ? 'Ej. Pedido proveedor #120' : 'Ej. Muestra rota'} />
          </Field>
        </div>
        <NumberPad value={qty} onChange={setQty} decimals={false} />
      </div>

      <button type="button" className="pbtn-pink h-14! w-full text-base" disabled={invalid || run.isPending} onClick={() => run.mutate(undefined, { onSuccess: onDone })}>
        <PackageCheck className="h-5 w-5" /> Guardar movimiento
      </button>

      {history.length > 0 && (
        <div>
          <p className="plabel flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Últimos movimientos</p>
          <ul className="space-y-1.5">
            {history.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <Pill tone={movementTone[m.reason]}>{movementLabel[m.reason]}</Pill>
                <span className="min-w-0 flex-1 truncate text-ink/55">{m.note ?? ''}</span>
                <b className={m.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600'}>{m.quantity_change > 0 ? '+' : ''}{m.quantity_change}</b>
                <span className="w-10 text-right text-xs text-ink/40">→ {m.stock_after}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------
function MovementsList() {
  const { data: movements, isLoading } = useMovements(undefined, 400);
  const [reason, setReason] = useState<MovementReason | 'all'>('all');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim().toLowerCase());
  const list = (movements ?? []).filter((m) =>
    (reason === 'all' || m.reason === reason) && (!q || [m.product_name, m.variant_name, m.note, m.user_name].join(' ').toLowerCase().includes(q)));

  return (
    <>
      <Card className="p-3! sm:p-4!">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Producto, nota o persona" className="min-w-[200px] flex-1" />
          <Segmented
            value={reason}
            onChange={setReason}
            options={[{ value: 'all' as const, label: 'Todos' }, ...(Object.keys(movementLabel) as MovementReason[]).map((r) => ({ value: r, label: movementLabel[r] }))]}
          />
        </div>
      </Card>
      <Card className="mt-4 p-2! sm:p-3!" delay={0.05}>
        {isLoading ? <SkeletonRows rows={8} /> : list.length === 0 ? <Empty icon={History} title="Sin movimientos" /> : (
          <ul className="divide-y divide-ink/5">
            {list.map((m) => (
              <li key={m.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 px-2 py-3 sm:grid-cols-[110px_1fr_140px_70px_70px]">
                <span className="row-span-2 sm:row-span-1"><Pill tone={movementTone[m.reason]}>{movementLabel[m.reason]}</Pill></span>
                <span className="min-w-0 truncate text-sm"><b>{m.product_name}</b> · {m.variant_name}{m.note && <span className="text-ink/50"> — {m.note}</span>}</span>
                <span className={cn('text-right text-sm font-bold tabular sm:order-last', m.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600')}>{m.quantity_change > 0 ? '+' : ''}{m.quantity_change}</span>
                <span className="truncate text-xs text-ink/45 sm:text-right">{new Date(m.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{m.user_name ? ` · ${m.user_name}` : ''}</span>
                <span className="hidden text-right text-xs text-ink/45 sm:block">→ {m.stock_after}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
