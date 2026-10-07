import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Command } from 'cmdk';
import { ClipboardList, CornerDownLeft, Search, Tag } from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { useAdminProducts, useOrders } from '@/hooks/admin-queries';
import { money } from '@/lib/format';
import { canSee, navItems } from './nav';

const itemClass = 'flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm data-[selected=true]:bg-blush-50 data-[selected=true]:text-ink';

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role } = useAuth();
  const [, navigate] = useLocation();
  const catalog = role === 'admin' || role === 'inventory';
  const sales = role === 'admin' || role === 'seller';
  const { data: products = [] } = useAdminProducts();
  const { data: orders = [] } = useOrders({ limit: 80 }, open && sales);

  const go = (href: string) => {
    onClose();
    navigate(href);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center p-3 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="relative w-full max-w-xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <Command label="Buscar en el panel" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
              <div className="flex items-center gap-3 border-b border-ink/5 px-5">
                <Search className="h-4 w-4 text-ink/40" />
                <Command.Input autoFocus placeholder="Escribe una página, producto o #pedido…" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink/35" />
                <kbd className="rounded-lg bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink/50">Esc</kbd>
              </div>
              <Command.List className="max-h-[55vh] overflow-y-auto p-2">
                <Command.Empty className="px-4 py-10 text-center text-sm text-ink/50">Sin resultados</Command.Empty>

                <Command.Group heading="Páginas" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-ink/40">
                  {navItems.filter((i) => canSee(i, role)).map((item) => (
                    <Command.Item key={item.href} value={`${item.label} ${item.keywords ?? ''}`} onSelect={() => go(item.href)} className={itemClass}>
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink/[0.04]"><item.icon className="h-4 w-4" /></span>
                      <span className="flex-1 font-semibold">{item.label}</span>
                      <CornerDownLeft className="h-3.5 w-3.5 text-ink/30" />
                    </Command.Item>
                  ))}
                </Command.Group>

                {catalog && products.length > 0 && (
                  <Command.Group heading="Productos" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-ink/40">
                    {products.map((p) => (
                      <Command.Item
                        key={p.id}
                        value={`${p.name} ${p.brand ?? ''} ${p.variants.map((v) => `${v.sku ?? ''} ${v.barcode ?? ''}`).join(' ')}`}
                        onSelect={() => go(`/productos?editar=${p.id}`)}
                        className={itemClass}
                      >
                        {p.images[0] ? <img src={p.images[0]} alt="" className="h-9 w-9 rounded-xl object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink/[0.04]"><Tag className="h-4 w-4" /></span>}
                        <span className="flex-1 truncate font-semibold">{p.name}</span>
                        <span className="text-xs text-ink/50">{money(p.price_mxn)}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {sales && orders.length > 0 && (
                  <Command.Group heading="Pedidos recientes" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-ink/40">
                    {orders.map((o) => (
                      <Command.Item
                        key={o.id}
                        value={`#${o.folio} ${o.folio} ${o.customer_name ?? ''} ${o.customer_phone ?? ''}`}
                        onSelect={() => go(`/pedidos?id=${o.id}`)}
                        className={itemClass}
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink/[0.04]"><ClipboardList className="h-4 w-4" /></span>
                        <span className="flex-1 truncate"><b>#{o.folio}</b> · {o.customer_name ?? (o.channel === 'pos' ? 'Venta en tienda' : 'Cliente')}</span>
                        <span className="text-xs text-ink/50">{money(o.total, o.currency)}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
