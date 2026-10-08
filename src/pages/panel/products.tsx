import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'wouter';
import { AnimatePresence, Reorder, motion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, Barcode, Copy, Eye, EyeOff, FolderOpen, ImagePlus, Loader2, Pencil, Plus, Sparkles, Star, Tag, Trash2, X,
} from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { useSettings } from '@/hooks/queries';
import { useAction, useAdminCategories, useAdminProducts } from '@/hooks/admin-queries';
import { deleteCategory, deleteProduct, saveCategory, saveProduct, setProductFlags, uploadImage } from '@/lib/admin-api';
import { money, totalStock } from '@/lib/format';
import type { AdminProduct, Category, ProductInput } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Card, Empty, Field, Modal, PageHeader, Pill, SearchInput, Segmented, Sheet, SkeletonRows, Switch, useConfirm,
} from '@/components/panel/kit';
import { toast } from 'sonner';

type Tab = 'products' | 'categories';
type Visibility = 'all' | 'visible' | 'hidden' | 'featured' | 'low';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('products');
  const editing = params.get('editar');
  const creating = params.get('nuevo') === '1';

  const openEditor = (id: string | null) =>
    setParams(id ? { editar: id } : { nuevo: '1' });
  const closeEditor = () => setParams({}, { replace: true });

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Productos"
        subtitle="Lo que agregues o actives aquí aparece al instante en la tienda."
        actions={
          <>
            <Segmented value={tab} onChange={setTab} options={[{ value: 'products', label: 'Productos' }, { value: 'categories', label: 'Categorías' }]} />
            {tab === 'products' && (
              <button type="button" className="pbtn-pink" onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> Nuevo producto</button>
            )}
          </>
        }
      />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {tab === 'products' ? <ProductGrid onEdit={openEditor} /> : <Categories />}
        </motion.div>
      </AnimatePresence>
      <ProductEditor open={creating || !!editing} productId={editing} onClose={closeEditor} />
    </>
  );
}

// ---------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------
function ProductGrid({ onEdit }: { onEdit: (id: string) => void }) {
  const { data: products, isLoading } = useAdminProducts();
  const { data: categories = [] } = useAdminCategories();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [visibility, setVisibility] = useState<Visibility>('all');
  const q = useDeferredValue(search.trim().toLowerCase());
  const flags = useAction(({ id, patch }: { id: string; patch: Parameters<typeof setProductFlags>[1] }) => setProductFlags(id, patch));

  const list = useMemo(() => (products ?? []).filter((p) => {
    if (category !== 'all' && p.category_id !== category) return false;
    if (visibility === 'visible' && !p.active) return false;
    if (visibility === 'hidden' && p.active) return false;
    if (visibility === 'featured' && !p.featured) return false;
    if (visibility === 'low' && !p.variants.some((v) => v.active && v.stock <= v.low_stock_threshold)) return false;
    if (!q) return true;
    return [p.name, p.brand, ...p.tags, ...p.variants.flatMap((v) => [v.sku, v.barcode])].join(' ').toLowerCase().includes(q);
  }), [products, category, visibility, q]);

  return (
    <>
      <Card className="p-3! sm:p-4!">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Nombre, marca, SKU o código de barras" className="min-w-[220px] flex-1" />
            <Segmented
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'visible', label: 'Visibles' },
                { value: 'hidden', label: 'Ocultos' },
                { value: 'featured', label: 'Destacados' },
                { value: 'low', label: 'Stock bajo' },
              ]}
            />
          </div>
          <Segmented
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: 'Todas las categorías' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
      </Card>

      {isLoading ? (
        <SkeletonRows rows={6} className="mt-4" />
      ) : list.length === 0 ? (
        <Card className="mt-4"><Empty icon={Tag} title="Sin productos" text="Crea tu primer producto o cambia los filtros." /></Card>
      ) : (
        <motion.ul layout className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <AnimatePresence>
            {list.map((p, i) => {
              const stock = totalStock(p);
              const low = p.variants.some((v) => v.active && v.stock <= v.low_stock_threshold);
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.94, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28, delay: Math.min(i * 0.02, 0.3) }}
                  className={cn('group overflow-hidden rounded-[24px] bg-white ring-1 ring-ink/5 transition hover:shadow-[0_18px_40px_-20px_rgba(20,16,20,0.35)]', !p.active && 'opacity-70')}
                >
                  <button type="button" onClick={() => onEdit(p.id)} className="relative block aspect-[4/5] w-full overflow-hidden bg-blush-50 text-left">
                    {p.images[0] ? (
                      <img src={p.images[0]} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]" />
                    ) : (
                      <span className="grid h-full place-items-center text-blush-300"><ImagePlus className="h-10 w-10" /></span>
                    )}
                    <span className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
                      {!p.active && <Pill tone="ink">Oculto</Pill>}
                      {p.featured && <Pill tone="pink"><Star className="h-3 w-3" /> Destacado</Pill>}
                      {p.is_new && <Pill tone="violet">Nuevo</Pill>}
                    </span>
                    <span className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-white/90 opacity-0 shadow transition group-hover:opacity-100"><Pencil className="h-4 w-4" /></span>
                  </button>
                  <div className="p-3.5">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink/45">{p.category?.name ?? 'Sin categoría'}</p>
                    <p className="truncate font-semibold">{p.name}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{money(p.price_mxn)}</span>
                      <Pill tone={stock === 0 ? 'red' : low ? 'amber' : 'green'}>{stock} pzs</Pill>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-ink/5 pt-3">
                      <Switch size="sm" checked={p.active} onChange={(v) => flags.mutate({ id: p.id, patch: { active: v } })} label={<span className="text-xs">{p.active ? 'Visible' : 'Oculto'}</span>} />
                      <button
                        type="button"
                        onClick={() => flags.mutate({ id: p.id, patch: { featured: !p.featured } })}
                        className={cn('grid h-9 w-9 place-items-center rounded-full transition', p.featured ? 'bg-blush-100 text-blush-700' : 'text-ink/30 hover:bg-ink/5')}
                        aria-label="Destacar en portada"
                      >
                        <Star className={cn('h-4 w-4', p.featured && 'fill-current')} />
                      </button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------
interface VariantForm {
  key: string;
  id?: string;
  name: string;
  size: string;
  color: string;
  color_hex: string;
  sku: string;
  barcode: string;
  stock: string;
  currentStock: number;
  low_stock_threshold: string;
  price_mxn: string;
  active: boolean;
}

interface ProductForm {
  name: string;
  slug: string;
  description: string;
  category_id: string;
  brand: string;
  price_mxn: string;
  price_usd: string;
  compare_at_mxn: string;
  compare_at_usd: string;
  cost_mxn: string;
  supplier: string;
  images: string[];
  tags: string;
  featured: boolean;
  is_new: boolean;
  active: boolean;
  variants: VariantForm[];
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const num = (s: string) => (s.trim() === '' ? null : Number(s));
let keySeq = 0;
const newKey = () => `v${++keySeq}`;

function emptyVariant(partial: Partial<VariantForm> = {}): VariantForm {
  return {
    key: newKey(), name: '', size: '', color: '', color_hex: '', sku: '', barcode: '', stock: '0', currentStock: 0,
    low_stock_threshold: '3', price_mxn: '', active: true, ...partial,
  };
}

function toForm(p: AdminProduct | undefined): ProductForm {
  if (!p) {
    return {
      name: '', slug: '', description: '', category_id: '', brand: '', price_mxn: '', price_usd: '', compare_at_mxn: '',
      compare_at_usd: '', cost_mxn: '', supplier: '', images: [], tags: '', featured: false, is_new: true, active: true,
      variants: [emptyVariant({ name: 'Única' })],
    };
  }
  return {
    name: p.name, slug: p.slug, description: p.description ?? '', category_id: p.category_id ?? '', brand: p.brand ?? '',
    price_mxn: str(p.price_mxn), price_usd: str(p.price_usd), compare_at_mxn: str(p.compare_at_mxn), compare_at_usd: str(p.compare_at_usd),
    cost_mxn: str(p.cost_mxn), supplier: p.supplier ?? '', images: p.images, tags: p.tags.join(', '),
    featured: p.featured, is_new: p.is_new, active: p.active,
    variants: p.variants.map((v) => ({
      key: newKey(), id: v.id, name: v.name, size: v.size ?? '', color: v.color ?? '', color_hex: v.color_hex ?? '', sku: v.sku ?? '',
      barcode: v.barcode ?? '', stock: String(v.stock), currentStock: v.stock, low_stock_threshold: String(v.low_stock_threshold),
      price_mxn: str(v.price_mxn), active: v.active,
    })),
  };
}

/** EAN-13 con prefijo 750 (México) y dígito verificador. */
function generateEan13() {
  const body = `750${Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')}`;
  const sum = [...body].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

const variantLabel = (v: VariantForm) => v.name.trim() || [v.size.trim(), v.color.trim()].filter(Boolean).join(' / ') || 'Única';

function ProductEditor({ open, productId, onClose }: { open: boolean; productId: string | null; onClose: () => void }) {
  const { data: products } = useAdminProducts();
  const product = productId ? products?.find((p) => p.id === productId) : undefined;
  const loading = !!productId && !products;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={productId ? product?.name ?? 'Editar producto' : 'Nuevo producto'}
      subtitle={productId ? 'Cambia fotos, precios, variantes y visibilidad' : 'Llena los datos y guárdalo para publicarlo'}
    >
      {loading ? <SkeletonRows rows={6} /> : <EditorBody key={productId ?? 'new'} product={product} onDone={onClose} />}
    </Sheet>
  );
}

function EditorBody({ product, onDone }: { product: AdminProduct | undefined; onDone: () => void }) {
  const { role } = useAuth();
  const admin = role === 'admin';
  const { data: settings } = useSettings();
  const { data: categories = [] } = useAdminCategories();
  const confirm = useConfirm();
  const [form, setForm] = useState<ProductForm>(() => toForm(product));
  const [uploading, setUploading] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const rate = settings?.exchange_rate ?? 18;

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (key: string, patch: Partial<VariantForm>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));

  const save = useAction(saveProduct, product ? 'Producto actualizado' : 'Producto creado');
  const remove = useAction(deleteProduct, 'Producto eliminado');

  const price = Number(form.price_mxn) || 0;
  const cost = Number(form.cost_mxn) || 0;
  const margin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const url = await uploadImage(file);
        setForm((f) => ({ ...f, images: [...f.images, url] }));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const addSizes = (sizes: string[]) =>
    setForm((f) => {
      const base = f.variants.filter((v) => v.id || v.size || v.color || v.sku || v.barcode || Number(v.stock) > 0);
      const existing = new Set(base.map((v) => v.size.toUpperCase()));
      return { ...f, variants: [...base, ...sizes.filter((s) => !existing.has(s)).map((s) => emptyVariant({ size: s }))] };
    });

  const submit = () => {
    if (!form.name.trim()) return toast.error('Escribe el nombre del producto');
    if (!(price > 0)) return toast.error('El precio en MXN debe ser mayor a cero');
    const input: ProductInput = {
      id: product?.id,
      name: form.name,
      slug: form.slug,
      description: form.description,
      category_id: form.category_id || null,
      brand: form.brand,
      price_mxn: price,
      price_usd: num(form.price_usd),
      compare_at_mxn: num(form.compare_at_mxn),
      compare_at_usd: num(form.compare_at_usd),
      images: form.images,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      featured: form.featured,
      is_new: form.is_new,
      active: form.active,
      ...(admin ? { cost_mxn: num(form.cost_mxn), supplier: form.supplier || null } : {}),
      variants: form.variants.map((v, i) => ({
        id: v.id,
        name: variantLabel(v),
        size: v.size || null,
        color: v.color || null,
        color_hex: v.color_hex || null,
        sku: v.sku || null,
        barcode: v.barcode || null,
        stock: v.id ? v.currentStock : Math.max(0, Math.floor(Number(v.stock) || 0)),
        low_stock_threshold: Math.max(0, Math.floor(Number(v.low_stock_threshold) || 0)),
        price_mxn: num(v.price_mxn),
        price_usd: null,
        sort_order: i + 1,
        active: v.active,
      })),
    };
    save.mutate(input, { onSuccess: onDone });
  };

  const askDelete = async () => {
    if (!product) return;
    const ok = await confirm({ title: `¿Eliminar «${product.name}»?`, text: 'Si ya tiene ventas no se puede borrar; en ese caso ocúltalo.', confirmLabel: 'Eliminar', danger: true });
    if (ok !== false) remove.mutate(product.id, { onSuccess: onDone });
  };

  return (
    <div className="space-y-6 pb-24">
      <Section title="Fotos" hint="La primera es la portada. Arrastra para reordenar.">
        <Reorder.Group axis="x" values={form.images} onReorder={(imgs) => set('images', imgs)} className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
          {form.images.map((src, i) => (
            <Reorder.Item key={src} value={src} className="relative h-32 w-26 shrink-0 cursor-grab overflow-hidden rounded-2xl bg-blush-50 ring-1 ring-ink/5 active:cursor-grabbing" whileDrag={{ scale: 1.06, zIndex: 10 }}>
              <img src={src} alt="" className="pointer-events-none h-full w-full object-cover" />
              {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">Portada</span>}
              <button type="button" onClick={() => set('images', form.images.filter((x) => x !== src))} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 shadow" aria-label="Quitar foto">
                <X className="h-3.5 w-3.5" />
              </button>
            </Reorder.Item>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div key={`up${i}`} className="grid h-32 w-26 shrink-0 place-items-center rounded-2xl bg-blush-50"><Loader2 className="h-5 w-5 animate-spin text-blush-600" /></div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} className="grid h-32 w-26 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-blush-300 text-blush-700 transition hover:bg-blush-50">
            <span className="flex flex-col items-center gap-1 text-xs font-semibold"><ImagePlus className="h-6 w-6" /> Agregar</span>
          </button>
        </Reorder.Group>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <div className="mt-3 flex gap-2">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="…o pega la URL de una imagen" className="pfield" />
          <button
            type="button"
            className="pbtn-ghost"
            disabled={!/^(https?:\/\/|\/)/.test(imageUrl.trim())}
            onClick={() => { set('images', [...form.images, imageUrl.trim()]); setImageUrl(''); }}
          >
            Añadir
          </button>
        </div>
      </Section>

      <Section title="Información">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2"><input value={form.name} onChange={(e) => set('name', e.target.value)} className="pfield" placeholder="Ej. Blusa de lino marfil" /></Field>
          <Field label="Categoría">
            <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className="pfield">
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Marca"><input value={form.brand} onChange={(e) => set('brand', e.target.value)} className="pfield" placeholder="Opcional" /></Field>
          <Field label="Descripción" className="sm:col-span-2">
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} className="pfield h-auto! py-2.5" placeholder="Materiales, cuidados, cómo usarlo…" />
          </Field>
          <Field label="Etiquetas" hint="Separadas por coma. Ayudan en la búsqueda.">
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)} className="pfield" placeholder="verano, lino, básicos" />
          </Field>
          <Field label="URL (slug)" hint="Se genera del nombre si lo dejas vacío.">
            <input value={form.slug} onChange={(e) => set('slug', e.target.value)} className="pfield" placeholder="blusa-de-lino-marfil" />
          </Field>
        </div>
      </Section>

      <Section title="Precios">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Precio MXN"><MoneyInput value={form.price_mxn} onChange={(v) => set('price_mxn', v)} /></Field>
          <Field label="Precio USD" hint={price > 0 ? `Vacío = automático (${money(price / rate, 'USD')} a TC ${rate})` : 'Vacío = se calcula con el tipo de cambio'}>
            <MoneyInput value={form.price_usd} onChange={(v) => set('price_usd', v)} prefix="US$" />
          </Field>
          <Field label="Precio antes (MXN)" hint="Para mostrarlo tachado como oferta"><MoneyInput value={form.compare_at_mxn} onChange={(v) => set('compare_at_mxn', v)} /></Field>
          <Field label="Precio antes (USD)"><MoneyInput value={form.compare_at_usd} onChange={(v) => set('compare_at_usd', v)} prefix="US$" /></Field>
        </div>
        {admin && (
          <div className="mt-4 grid gap-4 rounded-2xl bg-emerald-50/70 p-4 ring-1 ring-emerald-100 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Costo (solo admin)"><MoneyInput value={form.cost_mxn} onChange={(v) => set('cost_mxn', v)} /></Field>
            <Field label="Proveedor"><input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} className="pfield" placeholder="Opcional" /></Field>
            <div className="flex flex-col justify-end">
              <span className="plabel">Margen</span>
              <span className={cn('flex h-11 items-center rounded-xl px-4 text-lg font-bold', margin === null ? 'text-ink/30' : margin >= 40 ? 'text-emerald-700' : margin >= 20 ? 'text-amber-700' : 'text-red-600')}>
                {margin === null ? '—' : `${margin.toFixed(0)}%`}
              </span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Visibilidad">
        <div className="grid gap-3 sm:grid-cols-3">
          <ToggleCard icon={form.active ? Eye : EyeOff} title="Visible en tienda" text="Si lo apagas, nadie lo ve" checked={form.active} onChange={(v) => set('active', v)} />
          <ToggleCard icon={Star} title="Destacado" text="Aparece en la portada" checked={form.featured} onChange={(v) => set('featured', v)} />
          <ToggleCard icon={Sparkles} title="Nuevo" text="Muestra la etiqueta Nuevo" checked={form.is_new} onChange={(v) => set('is_new', v)} />
        </div>
      </Section>

      <Section
        title="Variantes"
        hint="Tallas, tonos o colores. Cada una tiene su propio stock y código."
        action={
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="pbtn-soft h-9! px-3! text-xs" onClick={() => addSizes(['XS', 'S', 'M', 'L', 'XL'])}>Tallas XS–XL</button>
            <button type="button" className="pbtn-soft h-9! px-3! text-xs" onClick={() => addSizes(['CH', 'M', 'G'])}>CH · M · G</button>
          </div>
        }
      >
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {form.variants.map((v, i) => (
              <motion.div
                key={v.key}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className={cn('rounded-2xl bg-white p-4 ring-1 ring-ink/[0.07]', !v.active && 'opacity-60')}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{i + 1}</span>
                    <p className="flex-1 truncate font-semibold">{variantLabel(v)}</p>
                    <Switch size="sm" checked={v.active} onChange={(a) => setVariant(v.key, { active: a })} />
                    <button type="button" disabled={i === 0} onClick={() => setForm((f) => { const vs = [...f.variants]; [vs[i - 1], vs[i]] = [vs[i], vs[i - 1]]; return { ...f, variants: vs }; })} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" disabled={i === form.variants.length - 1} onClick={() => setForm((f) => { const vs = [...f.variants]; [vs[i + 1], vs[i]] = [vs[i], vs[i + 1]]; return { ...f, variants: vs }; })} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" disabled={form.variants.length === 1} onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((x) => x.key !== v.key) }))} className="grid h-8 w-8 place-items-center rounded-full text-red-600 hover:bg-red-50 disabled:opacity-30" aria-label="Quitar variante"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Field label="Talla / tamaño"><input value={v.size} onChange={(e) => setVariant(v.key, { size: e.target.value })} className="pfield" placeholder="M, 30 ml…" /></Field>
                    <Field label="SKU"><input value={v.sku} onChange={(e) => setVariant(v.key, { sku: e.target.value.toUpperCase() })} className="pfield font-mono" placeholder="BLU-LIN-M" /></Field>
                    <Field label="Color / tono" className="col-span-2 sm:col-span-1">
                      <div className="flex gap-2">
                        <input value={v.color} onChange={(e) => setVariant(v.key, { color: e.target.value })} className="pfield" placeholder="Rosa nude" />
                        <input type="color" value={v.color_hex || '#f4c2d4'} onChange={(e) => setVariant(v.key, { color_hex: e.target.value })} className="h-11 w-11 shrink-0 cursor-pointer rounded-xl border border-ink/10 bg-white p-1" aria-label="Color" />
                      </div>
                    </Field>
                    <Field label="Código de barras" className="col-span-2 sm:col-span-1">
                      <div className="flex gap-2">
                        <input value={v.barcode} onChange={(e) => setVariant(v.key, { barcode: e.target.value.replace(/\s/g, '') })} className="pfield font-mono" placeholder="Escanéalo aquí" inputMode="numeric" />
                        <button type="button" onClick={() => setVariant(v.key, { barcode: generateEan13() })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink/[0.05] hover:bg-ink/10" title="Generar código" aria-label="Generar código"><Barcode className="h-4 w-4" /></button>
                      </div>
                    </Field>
                    {v.id ? (
                      <div>
                        <span className="plabel">Stock</span>
                        <p className="flex h-11 items-center gap-2 rounded-xl bg-ink/[0.03] px-3.5 text-[15px] font-bold">{v.currentStock} <span className="truncate text-xs font-normal text-ink/45">· en Inventario</span></p>
                      </div>
                    ) : (
                      <Field label="Stock inicial"><input value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value.replace(/\D/g, '') })} className="pfield" inputMode="numeric" /></Field>
                    )}
                    <Field label="Avisar con"><input value={v.low_stock_threshold} onChange={(e) => setVariant(v.key, { low_stock_threshold: e.target.value.replace(/\D/g, '') })} className="pfield" inputMode="numeric" /></Field>
                    <Field label="Precio propio MXN" hint="Vacío = precio del producto" className="col-span-2"><MoneyInput value={v.price_mxn} onChange={(p) => setVariant(v.key, { price_mxn: p })} /></Field>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pbtn-ghost" onClick={() => set('variants', [...form.variants, emptyVariant()])}><Plus className="h-4 w-4" /> Agregar variante</button>
            {form.variants.length > 0 && (
              <button
                type="button"
                className="pbtn-ghost"
                onClick={() => {
                  const last = form.variants[form.variants.length - 1];
                  set('variants', [...form.variants, emptyVariant({ ...last, key: newKey(), id: undefined, sku: '', barcode: '', stock: '0', currentStock: 0 })]);
                }}
              >
                <Copy className="h-4 w-4" /> Duplicar última
              </button>
            )}
          </div>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-ink/5 bg-white/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:absolute sm:rounded-b-[28px] sm:px-6 sm:pb-4">
        {product && <button type="button" className="pbtn-danger" onClick={askDelete} disabled={remove.isPending}><Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Eliminar</span></button>}
        <button type="button" className="pbtn-ghost ml-auto" onClick={onDone}>Cancelar</button>
        <button type="button" className="pbtn-pink sm:min-w-[150px]" onClick={submit} disabled={save.isPending || uploading > 0}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {product ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          {hint && <p className="text-xs text-ink/50">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MoneyInput({ value, onChange, prefix = '$' }: { value: string; onChange: (v: string) => void; prefix?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink/45">{prefix}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
        inputMode="decimal"
        className={cn('pfield tabular', prefix.length > 1 ? 'pl-12!' : 'pl-7!')}
        placeholder="0"
      />
    </div>
  );
}

function ToggleCard({ icon: Icon, title, text, checked, onChange }: { icon: typeof Eye; title: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('flex items-start gap-3 rounded-2xl p-4 text-left ring-1 transition', checked ? 'bg-blush-50 ring-blush-300' : 'bg-white ring-ink/[0.07] hover:ring-ink/20')}
    >
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl transition', checked ? 'bg-blush-600 text-white' : 'bg-ink/[0.05] text-ink/50')}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-ink/50">{text}</span>
      </span>
      <span className={cn('mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition', checked ? 'border-blush-600 bg-blush-600 text-white' : 'border-ink/20')}>
        {checked && <svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M2.5 6.5l2.2 2.2L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------
function Categories() {
  const { data: categories, isLoading } = useAdminCategories();
  const { data: products = [] } = useAdminProducts();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const save = useAction(saveCategory, 'Categoría guardada');
  const remove = useAction(deleteCategory, 'Categoría eliminada');
  const move = useAction(async ({ a, b }: { a: Category; b: Category }) => {
    await saveCategory({ ...a, sort_order: b.sort_order });
    await saveCategory({ ...b, sort_order: a.sort_order });
  });

  const count = (id: string) => products.filter((p) => p.category_id === id).length;

  return (
    <Card className="p-3! sm:p-4!">
      <div className="mb-2 flex items-center justify-between gap-3 px-2 pt-1">
        <p className="text-sm text-ink/55">{categories?.length ?? 0} categorías<span className="hidden sm:inline"> · El orden es el de la tienda</span></p>
        <button type="button" className="pbtn-pink" onClick={() => setEditing({ name: '', active: true })}><Plus className="h-4 w-4" /> Nueva</button>
      </div>
      {isLoading ? <SkeletonRows /> : !categories?.length ? (
        <Empty icon={FolderOpen} title="Sin categorías" text="Crea categorías como Ropa, Maquillaje o Accesorios." />
      ) : (
        <ul className="divide-y divide-ink/5">
          {categories.map((c, i) => (
            <motion.li key={c.id} layout className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-3 sm:flex-nowrap">
              {c.image_url ? <img src={c.image_url} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover sm:h-14 sm:w-14" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blush-50 text-blush-400 sm:h-14 sm:w-14"><FolderOpen className="h-5 w-5" /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="truncate text-xs text-ink/50">{count(c.id)} productos · /{c.slug}</p>
              </div>
              <Switch size="sm" checked={c.active} onChange={(v) => save.mutate({ ...c, active: v })} label={<span className="text-xs">{c.active ? 'Visible' : 'Oculta'}</span>} />
              <div className="ml-auto flex w-full justify-end sm:ml-0 sm:w-auto">
                <button type="button" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ a: c, b: categories[i - 1] })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={i === categories.length - 1 || move.isPending} onClick={() => move.mutate({ a: c, b: categories[i + 1] })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setEditing(c)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({ title: `¿Eliminar «${c.name}»?`, text: `Sus ${count(c.id)} productos quedarán sin categoría.`, confirmLabel: 'Eliminar', danger: true });
                    if (ok !== false) remove.mutate(c.id);
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full text-red-600 hover:bg-red-50"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
      <CategoryModal value={editing} onClose={() => setEditing(null)} onSave={(c) => save.mutate(c, { onSuccess: () => setEditing(null) })} saving={save.isPending} />
    </Card>
  );
}

function CategoryModal({ value, onClose, onSave, saving }: { value: Partial<Category> | null; onClose: () => void; onSave: (c: Partial<Category> & { name: string }) => void; saving: boolean }) {
  return (
    <Modal open={!!value} onClose={onClose} title={value?.id ? 'Editar categoría' : 'Nueva categoría'}>
      {value && <CategoryForm key={value.id ?? 'new'} initial={value} onSave={onSave} onCancel={onClose} saving={saving} />}
    </Modal>
  );
}

function CategoryForm({ initial, onSave, onCancel, saving }: { initial: Partial<Category>; onSave: (c: Partial<Category> & { name: string }) => void; onCancel: () => void; saving: boolean }) {
  const [c, setC] = useState({ ...initial, name: initial.name ?? '', description: initial.description ?? '', image_url: initial.image_url ?? '' });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => fileRef.current?.click()} className="relative block aspect-[16/7] w-full overflow-hidden rounded-2xl border-2 border-dashed border-blush-200 bg-blush-50">
        {c.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" /> : (
          <span className="flex h-full flex-col items-center justify-center gap-1 text-sm font-semibold text-blush-700">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />} Imagen de la categoría
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          try {
            const url = await uploadImage(file, 'categories');
            setC((x) => ({ ...x, image_url: url }));
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setUploading(false);
          }
        }}
      />
      <Field label="Nombre"><input autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className="pfield" placeholder="Ej. Maquillaje" /></Field>
      <Field label="Descripción"><textarea value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} rows={2} className="pfield h-auto! py-2.5" /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="pbtn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="pbtn-primary" disabled={!c.name.trim() || saving || uploading} onClick={() => onSave(c)}>Guardar</button>
      </div>
    </div>
  );
}
