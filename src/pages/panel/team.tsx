import { useState } from 'react';
import { motion } from 'framer-motion';
import { Boxes, Crown, Info, ShoppingBag, Store, Users } from 'lucide-react';
import { roleLabel, useAuth } from '@/providers/auth';
import { useAction, useTeam } from '@/hooks/admin-queries';
import { updateMember } from '@/lib/admin-api';
import type { Role, TeamMember } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, Card, Empty, PageHeader, Pill, SearchInput, Segmented, SkeletonRows, Switch, useConfirm } from '@/components/panel/kit';

const roleInfo: Record<Role, { icon: typeof Crown; text: string; tone: 'ink' | 'pink' | 'violet' | 'neutral' }> = {
  admin: { icon: Crown, text: 'Todo el panel, ventas, ganancias y ajustes', tone: 'ink' },
  seller: { icon: Store, text: 'POS, caja y pedidos. No ve costos ni ganancias', tone: 'pink' },
  inventory: { icon: Boxes, text: 'Productos e inventario. No cobra ni ve ventas', tone: 'violet' },
  customer: { icon: ShoppingBag, text: 'Solo compra en la tienda', tone: 'neutral' },
};

const roles: Role[] = ['admin', 'seller', 'inventory', 'customer'];

export default function Team() {
  const { profile } = useAuth();
  const { data: team, isLoading } = useTeam();
  const [view, setView] = useState<'staff' | 'customers'>('staff');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const list = (team ?? []).filter((m) =>
    (view === 'staff' ? m.role !== 'customer' : m.role === 'customer') && (!q || [m.full_name, m.email, m.phone].join(' ').toLowerCase().includes(q)));
  const counts = roles.reduce<Record<Role, number>>((acc, r) => ({ ...acc, [r]: (team ?? []).filter((m) => m.role === r).length }), { admin: 0, seller: 0, inventory: 0, customer: 0 });

  return (
    <>
      <PageHeader eyebrow="General" title="Equipo" subtitle="Asigna quién puede vender, manejar inventario o administrar la tienda." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {roles.map((r, i) => {
          const info = roleInfo[r];
          return (
            <motion.div key={r} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn('rounded-[24px] p-4', r === 'admin' ? 'bg-ink text-white' : 'bg-white ring-1 ring-ink/5')}>
              <div className="flex items-center justify-between">
                <span className={cn('grid h-10 w-10 place-items-center rounded-xl', r === 'admin' ? 'bg-white/10' : 'bg-blush-50 text-blush-700')}><info.icon className="h-4 w-4" /></span>
                <span className="text-2xl font-bold">{counts[r]}</span>
              </div>
              <p className="mt-3 font-bold">{roleLabel[r]}</p>
              <p className={cn('text-xs', r === 'admin' ? 'text-white/60' : 'text-ink/50')}>{info.text}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blush-50 p-4 text-sm text-ink/70">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blush-700" />
        <p>Para agregar a alguien al equipo, pídele que cree su cuenta en <b>shoppely › Iniciar sesión › Crear cuenta</b>. Aparecerá en <b>Clientes</b> y desde ahí le cambias el rol.</p>
      </div>

      <Card className="mt-4 p-3! sm:p-4!">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={view} onChange={setView} options={[{ value: 'staff', label: 'Equipo', count: (team ?? []).length - counts.customer }, { value: 'customers', label: 'Clientes', count: counts.customer }]} />
          <SearchInput value={search} onChange={setSearch} placeholder="Nombre, correo o teléfono" className="min-w-[200px] flex-1" />
        </div>
        <div className="mt-3">
          {isLoading ? <SkeletonRows /> : list.length === 0 ? <Empty icon={Users} title="Nadie por aquí" /> : (
            <ul className="divide-y divide-ink/5">
              {list.map((m) => <MemberRow key={m.id} member={m} self={m.id === profile?.id} />)}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}

function MemberRow({ member: m, self }: { member: TeamMember; self: boolean }) {
  const confirm = useConfirm();
  const update = useAction((patch: { role?: Role; active?: boolean }) => updateMember(m.id, patch), (_, p) =>
    p.role ? `${m.full_name ?? 'Usuario'} ahora es ${roleLabel[p.role]}` : p.active ? 'Acceso activado' : 'Acceso desactivado');

  const changeRole = async (role: Role) => {
    if (role === m.role) return;
    if (role === 'admin') {
      const ok = await confirm({ title: `¿Hacer administrador a ${m.full_name ?? 'este usuario'}?`, text: 'Podrá ver ganancias, cambiar precios, cancelar ventas y modificar el equipo.', confirmLabel: 'Sí, hacer admin' });
      if (ok === false) return;
    }
    update.mutate({ role });
  };

  return (
    <li className={cn('flex flex-wrap items-center gap-3 px-1 py-3', !m.active && 'opacity-55')}>
      <Avatar name={m.full_name} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-semibold">{m.full_name ?? 'Sin nombre'} {self && <Pill tone="pink">Tú</Pill>}</p>
        <p className="truncate text-xs text-ink/50">{[m.email, m.phone].filter(Boolean).join(' · ')}</p>
      </div>
      <select
        value={m.role}
        disabled={self || update.isPending}
        onChange={(e) => changeRole(e.target.value as Role)}
        className="pfield h-10! w-auto! min-w-[150px] rounded-full! font-semibold"
        aria-label="Rol"
      >
        {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
      </select>
      <Switch size="sm" checked={m.active} disabled={self} onChange={(active) => update.mutate({ active })} label={<span className="hidden w-16 text-xs sm:inline">{m.active ? 'Activo' : 'Bloqueado'}</span>} />
    </li>
  );
}
