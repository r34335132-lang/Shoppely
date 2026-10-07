import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sin credenciales la app corre en modo demo con datos locales. */
export const isDemo = !url || !anonKey;

export const supabase = isDemo
  ? null
  : createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });

export function db() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}
