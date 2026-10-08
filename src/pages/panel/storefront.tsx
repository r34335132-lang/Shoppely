import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarClock, ExternalLink, GripVertical, ImagePlus, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useAction, useAdminBanners, useAdminCategories, useAdminProducts } from '@/hooks/admin-queries';
import { deleteBanner, reorderBanners, saveBanner, setProductFlags, uploadImage } from '@/lib/admin-api';
import { money } from '@/lib/format';
import type { AdminBanner } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardTitle, Empty, Field, PageHeader, Pill, SearchInput, Segmented, Sheet, Switch, Thumb, useConfirm } from '@/components/panel/kit';

type BannerDraft = Partial<AdminBanner> & { title: string; image_url: string };

const themeClass: Record<AdminBanner['theme'], string> = {
  light: 'from-white/0 via-white/10 to-white/85 text-ink',
  dark: 'from-black/0 via-black/20 to-black/80 text-white',
  pink: 'from-blush-200/0 via-blush-300/30 to-blush-400/90 text-ink',
};

function scheduleState(b: AdminBanner) {
  const now = Date.now();
  if (!b.active) return { label: 'Apagado', tone: 'neutral' as const };
  if (b.starts_at && Date.parse(b.starts_at) > now) return { label: `Desde ${new Date(b.starts_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`, tone: 'blue' as const };
  if (b.ends_at && Date.parse(b.ends_at) < now) return { label: 'Terminó', tone: 'amber' as const };
  return { label: 'En vivo', tone: 'green' as const };
}

export default function Storefront() {
  const { data: banners = [] } = useAdminBanners();
  const [editing, setEditing] = useState<BannerDraft | null>(null);
  const hero = banners.filter((b) => b.placement === 'hero');
  const [stories, setStories] = useState<AdminBanner[]>([]);
  const confirm = useConfirm();
  const save = useAction(saveBanner, 'Portada actualizada');
  const remove = useAction(deleteBanner, 'Banner eliminado');
  const reorder = useAction(reorderBanners, 'Orden guardado');

  useEffect(() => setStories(banners.filter((b) => b.placement === 'story')), [banners]);

  const askDelete = async (b: AdminBanner) => {
    const ok = await confirm({ title: `¿Eliminar «${b.title}»?`, confirmLabel: 'Eliminar', danger: true });
    if (ok !== false) remove.mutate(b.id);
  };

  return (
    <>
      <PageHeader
        eyebrow="Tienda"
        title="Portada"
        subtitle="Las pantallas que se ven al entrar y al hacer scroll, en el mismo orden que en la tienda."
        actions={
          <>
            <a href="/" target="_blank" rel="noreferrer" className="pbtn-ghost"><ExternalLink className="h-4 w-4" /> Ver tienda</a>
            <button type="button" className="pbtn-pink" onClick={() => setEditing({ title: '', image_url: '', placement: 'story', theme: 'dark', active: true })}><Plus className="h-4 w-4" /> Nueva pantalla</button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle title="Pantalla principal" subtitle="La imagen grande que ven al entrar" />
          {hero.length === 0 ? (
            <Empty icon={ImagePlus} title="Sin portada principal" text="Se muestra la imagen de ejemplo." action={<button type="button" className="pbtn-primary" onClick={() => setEditing({ title: '', image_url: '', placement: 'hero', theme: 'dark', active: true })}>Crear portada</button>} />
          ) : hero.map((b) => <BannerCard key={b.id} banner={b} big onEdit={() => setEditing(b)} onDelete={() => askDelete(b)} onToggle={(v) => save.mutate({ ...b, active: v })} />)}

          <div className="mb-3 mt-6 flex items-end justify-between">
            <div>
              <h3 className="text-base font-bold">Pantallas al hacer scroll</h3>
              <p className="text-xs text-ink/50">Arrastra para cambiar el orden</p>
            </div>
          </div>
          {stories.length === 0 ? (
            <p className="rounded-2xl bg-ink/[0.03] p-6 text-center text-sm text-ink/50">Aún no hay pantallas de historia.</p>
          ) : (
            <Reorder.Group axis="y" values={stories} onReorder={setStories} className="space-y-3">
              {stories.map((b) => (
                <StoryItem
                  key={b.id}
                  banner={b}
                  onDragEnd={() => reorder.mutate([...hero, ...stories].map((x) => x.id))}
                  onEdit={() => setEditing(b)}
                  onDelete={() => askDelete(b)}
                  onToggle={(v) => save.mutate({ ...b, active: v })}
                />
              ))}
            </Reorder.Group>
          )}
        </Card>
        <FeaturedProducts />
      </div>

      <BannerSheet draft={editing} onClose={() => setEditing(null)} />
    </>
  );
}

type BannerActions = { onEdit: () => void; onDelete: () => void; onToggle: (v: boolean) => void };

function StoryItem({ banner, onDragEnd, ...actions }: { banner: AdminBanner; onDragEnd: () => void } & BannerActions) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={banner}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 24px 50px -20px rgba(20,16,20,0.45)' }}
      className="rounded-3xl"
    >
      <BannerCard banner={banner} onGrab={(e) => controls.start(e)} {...actions} />
    </Reorder.Item>
  );
}

function BannerCard({ banner, big, onGrab, onEdit, onDelete, onToggle }: { banner: AdminBanner; big?: boolean; onGrab?: (e: React.PointerEvent) => void } & BannerActions) {
  const state = scheduleState(banner);
  return (
    <div className={cn('group relative overflow-hidden rounded-3xl bg-ink', big ? 'aspect-[16/9] sm:aspect-[16/8]' : 'aspect-[16/7] sm:aspect-[16/5]', !banner.active && 'opacity-60')}>
      <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" draggable={false} />
      <div className={cn('absolute inset-0 bg-gradient-to-r', themeClass[banner.theme])} />
      <div className="absolute inset-0 flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          {banner.eyebrow && <p className="eyebrow truncate opacity-80">{banner.eyebrow}</p>}
          <p className={cn('display truncate', big ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl')}>{banner.title}</p>
        </div>
      </div>
      <div className="absolute left-3 top-3 flex items-center gap-2">
        {onGrab && (
          <span onPointerDown={onGrab} className="grid h-9 w-9 cursor-grab touch-none place-items-center rounded-full bg-white/90 text-ink active:cursor-grabbing" aria-label="Arrastrar para ordenar">
            <GripVertical className="h-4 w-4" />
          </span>
        )}
        <Pill tone={state.tone} dot className="bg-white/90!">{state.label}</Pill>
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 p-1 pl-3 backdrop-blur">
        <Switch size="sm" checked={banner.active} onChange={onToggle} />
        <button type="button" onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5" aria-label="Editar"><Pencil className="h-4 w-4 text-ink" /></button>
        <button type="button" onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-full text-red-600 hover:bg-red-50" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function BannerSheet({ draft, onClose }: { draft: BannerDraft | null; onClose: () => void }) {
  return (
    <Sheet open={!!draft} onClose={onClose} title={draft?.id ? 'Editar pantalla' : 'Nueva pantalla'} subtitle="Así se verá en la tienda">
      {draft && <BannerForm key={draft.id ?? 'new'} initial={draft} onDone={onClose} />}
    </Sheet>
  );
}

function BannerForm({ initial, onDone }: { initial: BannerDraft; onDone: () => void }) {
  const [b, setB] = useState<BannerDraft>(initial);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: categories = [] } = useAdminCategories();
  const save = useAction(saveBanner, 'Pantalla guardada');
  const set = <K extends keyof BannerDraft>(k: K, v: BannerDraft[K]) => setB((x) => ({ ...x, [k]: v }));
  const theme = b.theme ?? 'dark';

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => fileRef.current?.click()} className="group relative block aspect-[16/10] w-full overflow-hidden rounded-3xl bg-ink text-left">
        {b.image_url ? <img src={b.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
          <span className="absolute inset-0 grid place-items-center text-white/70"><span className="flex flex-col items-center gap-2 text-sm font-semibold">{uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7" />} Sube una foto horizontal</span></span>
        )}
        <div className={cn('absolute inset-0 bg-gradient-to-r', themeClass[theme])} />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <AnimatePresence mode="popLayout">
            <motion.div key={`${b.title}${theme}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {b.eyebrow && <p className="eyebrow opacity-80">{b.eyebrow}</p>}
              <p className="display text-3xl">{b.title || 'Tu título aquí'}</p>
              {b.subtitle && <p className="mt-1 max-w-xs text-sm opacity-80">{b.subtitle}</p>}
              {b.cta_label && <span className={cn('mt-3 inline-block rounded-full px-4 py-2 text-xs font-semibold', theme === 'dark' ? 'bg-white text-ink' : 'bg-ink text-white')}>{b.cta_label}</span>}
            </motion.div>
          </AnimatePresence>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink opacity-0 transition group-hover:opacity-100">Cambiar foto</span>
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
            set('image_url', await uploadImage(file, 'banners'));
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setUploading(false);
          }
        }}
      />

      <Field label="Ubicación">
        <Segmented
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          value={b.placement ?? 'story'}
          onChange={(v) => set('placement', v)}
          options={[{ value: 'hero', label: 'Principal' }, { value: 'story', label: 'Al hacer scroll' }]}
        />
      </Field>
      <Field label="Estilo del texto">
        <Segmented
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          value={theme}
          onChange={(v) => set('theme', v)}
          options={[{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }, { value: 'pink', label: 'Rosa' }]}
        />
      </Field>
      <Field label="Texto pequeño superior"><input value={b.eyebrow ?? ''} onChange={(e) => set('eyebrow', e.target.value)} className="pfield" placeholder="Nueva colección" /></Field>
      <Field label="Título"><input value={b.title} onChange={(e) => set('title', e.target.value)} className="pfield" placeholder="Brilla a tu manera" /></Field>
      <Field label="Subtítulo"><textarea value={b.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} rows={2} className="pfield h-auto! py-2.5" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Texto del botón"><input value={b.cta_label ?? ''} onChange={(e) => set('cta_label', e.target.value)} className="pfield" placeholder="Comprar ahora" /></Field>
        <Field label="Enlace del botón">
          <input value={b.cta_link ?? ''} onChange={(e) => set('cta_link', e.target.value)} className="pfield" placeholder="/tienda" list="banner-links" />
          <datalist id="banner-links">
            <option value="/tienda">Toda la tienda</option>
            {categories.map((c) => <option key={c.id} value={`/tienda?categoria=${c.slug}`}>{c.name}</option>)}
          </datalist>
        </Field>
      </div>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <p className="plabel flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Programar (opcional)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Desde"><input type="datetime-local" value={toLocalInput(b.starts_at)} onChange={(e) => set('starts_at', e.target.value ? new Date(e.target.value).toISOString() : null)} className="pfield" /></Field>
          <Field label="Hasta"><input type="datetime-local" value={toLocalInput(b.ends_at)} onChange={(e) => set('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)} className="pfield" /></Field>
        </div>
      </div>
      <Switch checked={b.active ?? true} onChange={(v) => set('active', v)} label="Mostrar en la tienda" />
      <div className="flex justify-end gap-2 border-t border-ink/5 pt-4">
        <button type="button" className="pbtn-ghost" onClick={onDone}>Cancelar</button>
        <button type="button" className="pbtn-pink" disabled={save.isPending || uploading} onClick={() => save.mutate(b, { onSuccess: onDone })}>Guardar</button>
      </div>
    </div>
  );
}

function FeaturedProducts() {
  const { data: products = [] } = useAdminProducts();
  const [search, setSearch] = useState('');
  const flags = useAction(({ id, featured }: { id: string; featured: boolean }) => setProductFlags(id, { featured }));
  const featured = products.filter((p) => p.featured);
  const q = search.trim().toLowerCase();
  const candidates = q ? products.filter((p) => !p.featured && p.name.toLowerCase().includes(q)).slice(0, 6) : [];

  return (
    <Card delay={0.05}>
      <CardTitle title="Destacados" subtitle="Aparecen en el carrusel de la portada" action={<Pill tone="pink">{featured.length}</Pill>} />
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar producto para destacar" />
      <AnimatePresence>
        {candidates.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden rounded-2xl bg-blush-50/60">
            {candidates.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { flags.mutate({ id: p.id, featured: true }); setSearch(''); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-blush-100/60">
                  <Thumb src={p.images[0]} className="h-9 w-9 rounded-lg" />
                  <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                  <Plus className="h-4 w-4" />
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <ul className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {featured.map((p) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-ink/5">
              <Thumb src={p.images[0]} className="h-12 w-12 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-ink/50">{money(p.price_mxn)}{!p.active && ' · oculto'}</p>
              </div>
              <button type="button" onClick={() => flags.mutate({ id: p.id, featured: false })} className="grid h-9 w-9 place-items-center rounded-full bg-blush-100 text-blush-700 hover:bg-blush-200" aria-label="Quitar de destacados">
                <Star className="h-4 w-4 fill-current" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        {featured.length === 0 && <p className="py-6 text-center text-sm text-ink/50">Busca productos arriba para destacarlos.</p>}
      </ul>
    </Card>
  );
}
