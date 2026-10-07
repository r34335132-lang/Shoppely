import { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Heart, LayoutDashboard, LogOut, Package } from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { useMyOrders, useProducts } from '@/hooks/queries';
import { ProductCard, useFavorites } from '@/components/store/product-card';
import { formatDate, money, orderStatusLabel, paymentStatusLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function AccountPage() {
  const { profile, signOut, isStaff } = useAuth();
  const [tab, setTab] = useState<'orders' | 'favorites'>('orders');
  const { data: orders = [], isLoading } = useMyOrders(profile?.id);
  const { ids } = useFavorites();
  const { data: products = [] } = useProducts();
  const favorites = products.filter((p) => ids.includes(p.id));

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-cream pb-24 pt-28">
      <div className="page-wrap">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow text-blush-700">Mi cuenta</p>
            <h1 className="display mt-2 text-[clamp(3rem,8vw,6rem)]">Hola, {profile.full_name?.split(' ')[0] ?? 'bonita'}</h1>
            <p className="text-ink/60">{profile.email}</p>
          </div>
          <div className="flex gap-2">
            {isStaff && <Link href="/panel" className="btn-dark"><LayoutDashboard className="h-4 w-4" /> Panel</Link>}
            <button type="button" onClick={() => void signOut()} className="btn-outline"><LogOut className="h-4 w-4" /> Salir</button>
          </div>
        </div>

        <div className="mt-10 flex w-fit gap-1 rounded-full bg-white p-1">
          {([['orders', 'Pedidos', Package], ['favorites', 'Favoritos', Heart]] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={cn('relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold', tab === value ? 'text-white' : 'text-ink/60')}>
              {tab === value && <motion.span layoutId="account-tab" className="absolute inset-0 rounded-full bg-ink" />}
              <Icon className="relative h-4 w-4" /><span className="relative">{label}</span>
            </button>
          ))}
        </div>

        {tab === 'orders' ? (
          <div className="mt-8 flex flex-col gap-3">
            {isLoading && <div className="h-24 animate-pulse rounded-3xl bg-white" />}
            {!isLoading && orders.length === 0 && (
              <div className="rounded-3xl bg-white p-10 text-center">
                <p className="display text-3xl">Aún no tienes pedidos</p>
                <Link href="/tienda" className="btn-dark mt-5">Explorar la tienda</Link>
              </div>
            )}
            {orders.map((o, i) => (
              <motion.div key={o.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/pedido/${o.public_token}`} className="flex flex-wrap items-center gap-4 rounded-3xl bg-white p-5 transition hover:shadow-lg">
                  <div className="flex -space-x-3">
                    {o.items.slice(0, 3).map((it, j) => it.image_url && <img key={j} src={it.image_url} alt="" className="h-14 w-14 rounded-2xl object-cover ring-4 ring-white" />)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Pedido #{o.folio}</p>
                    <p className="text-sm text-ink/50">{formatDate(o.created_at)} · {o.items.reduce((n, it) => n + it.quantity, 0)} productos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{money(o.total, o.currency)}</p>
                    <p className="text-xs">
                      <span className="rounded-full bg-blush-100 px-2 py-0.5 font-semibold">{orderStatusLabel[o.status]}</span>{' '}
                      <span className="text-ink/50">{paymentStatusLabel[o.payment_status]}</span>
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {favorites.length === 0 && <p className="col-span-full rounded-3xl bg-white p-10 text-center text-ink/60">Toca el ♥ en los productos que te encanten.</p>}
            {favorites.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
