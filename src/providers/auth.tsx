import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isDemo, supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/lib/types';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; fullName: string; phone?: string; redirectPath?: string }) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  signInDemo: (role: Role) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_USER_KEY = 'shoppely-demo-user';

const demoNames: Record<Role, string> = {
  admin: 'Admin Shoppely',
  inventory: 'Encargada de inventario',
  seller: 'Vendedora',
  customer: 'Clienta demo',
};

function readDemoProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => (isDemo ? readDemoProfile() : null));
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    // No llamar a Supabase dentro de este callback: puede bloquear el cliente.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const loadProfile = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      void loadProfile();
    }
  }, [userId, loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const role = profile?.active ? profile.role : null;
    return {
      loading,
      session,
      profile,
      role,
      isStaff: role === 'admin' || role === 'inventory' || role === 'seller',
      async signIn(email, password) {
        if (!supabase) throw new Error('En modo demo usa los accesos rápidos de abajo.');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
      },
      async signUp({ email, password, fullName, phone, redirectPath }) {
        if (!supabase) throw new Error('El registro se activa al conectar Supabase.');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, phone }, emailRedirectTo: window.location.origin + (redirectPath ?? '') },
        });
        if (error) throw new Error(error.message);
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        if (isDemo) {
          localStorage.removeItem(DEMO_USER_KEY);
          setProfile(null);
          return;
        }
        await supabase!.auth.signOut();
      },
      signInDemo(demoRole) {
        const demo: Profile = {
          id: `demo-${demoRole}`,
          full_name: demoNames[demoRole],
          email: `${demoRole}@shoppely.demo`,
          phone: null,
          avatar_url: null,
          role: demoRole,
          active: true,
        };
        localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demo));
        setProfile(demo);
      },
      refreshProfile: loadProfile,
    };
  }, [loading, session, profile, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  inventory: 'Inventario',
  seller: 'Ventas',
  customer: 'Cliente',
};
