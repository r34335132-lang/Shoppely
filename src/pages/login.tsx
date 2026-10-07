import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, Crown, Loader2, ShoppingBag, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth';
import { isDemo } from '@/lib/supabase';
import { Logo, Sparkle } from '@/components/brand/logo';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const demoRoles: { role: Role; label: string; icon: typeof Crown }[] = [
  { role: 'admin', label: 'Admin', icon: Crown },
  { role: 'seller', label: 'Ventas / POS', icon: ShoppingBag },
  { role: 'inventory', label: 'Inventario', icon: Boxes },
  { role: 'customer', label: 'Cliente', icon: User },
];

export default function LoginPage({ mode: initialMode = 'in' }: { mode?: 'in' | 'up' }) {
  const { signIn, signUp, signInDemo, profile, isStaff } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });

  useEffect(() => {
    if (profile) navigate(isStaff ? '/panel' : '/cuenta');
  }, [profile, isStaff, navigate]);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'in') {
        await signIn(form.email, form.password);
      } else {
        const { needsConfirmation } = await signUp({ email: form.email, password: form.password, fullName: form.name, phone: form.phone });
        if (needsConfirmation) toast.success('Revisa tu correo para confirmar tu cuenta 💌');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-cream lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <motion.img
          src="/images/shoppely-campaign.jpg"
          alt=""
          className="absolute inset-0 h-full w-full scale-[1.35] object-cover"
          initial={{ scale: 1.6 }}
          animate={{ scale: 1.35 }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="display text-6xl">Hola, <em>bonita</em></p>
          <p className="mt-3 max-w-sm text-white/80">Guarda tus favoritos, sigue tus pedidos y deja tus opiniones.</p>
        </div>
        <Sparkle className="absolute right-16 top-20 h-12 w-12 animate-float" />
      </div>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-16">
        <Link href="/" className="mb-10 w-fit"><Logo /></Link>

        <div className="relative mb-8 flex w-fit rounded-full bg-white p-1">
          {(['in', 'up'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn('relative rounded-full px-6 py-2.5 text-sm font-semibold transition-colors', mode === m ? 'text-white' : 'text-ink/60')}>
              {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative">{m === 'in' ? 'Entrar' : 'Crear cuenta'}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            onSubmit={submit}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35 }}
            className="flex max-w-md flex-col gap-3"
          >
            <h1 className="display mb-2 text-5xl">{mode === 'in' ? 'Bienvenida de vuelta' : 'Únete a Shoppely'}</h1>
            {mode === 'up' && (
              <>
                <input required className="field" placeholder="Nombre completo" value={form.name} onChange={update('name')} autoComplete="name" />
                <input className="field" placeholder="WhatsApp (opcional)" value={form.phone} onChange={update('phone')} type="tel" autoComplete="tel" />
              </>
            )}
            <input required className="field" placeholder="Correo" type="email" value={form.email} onChange={update('email')} autoComplete="email" />
            <input required minLength={6} className="field" placeholder="Contraseña" type="password" value={form.password} onChange={update('password')} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
            <button type="submit" disabled={loading || isDemo} className="btn-dark mt-2 py-4 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'in' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </motion.form>
        </AnimatePresence>

        {isDemo && (
          <div className="mt-10 max-w-md rounded-3xl border border-dashed border-blush-400 bg-blush-50 p-5">
            <p className="text-sm font-semibold">Modo demo (Supabase sin conectar)</p>
            <p className="mt-1 text-xs text-ink/60">Entra con un rol para probar cada vista.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {demoRoles.map(({ role, label, icon: Icon }) => (
                <motion.button key={role} type="button" whileTap={{ scale: 0.95 }} onClick={() => signInDemo(role)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold hover:bg-ink hover:text-white">
                  <Icon className="h-4 w-4" /> {label}
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
