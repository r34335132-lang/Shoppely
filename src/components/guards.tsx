import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/providers/auth';
import type { Role } from '@/lib/types';
import { BagMark } from '@/components/brand/logo';

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream">
      <BagMark className="h-16 w-16 animate-bounce" />
    </div>
  );
}

/** Redirige a /login si no hay sesión; si el rol no tiene acceso, el personal vuelve al panel y las clientas al inicio. */
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { loading, profile, role } = useAuth();
  const [location, navigate] = useLocation();
  const allowed = !!profile && (!roles || (role !== null && roles.includes(role)));
  const fallback = role && role !== 'customer' && location !== '/panel' ? '~/panel' : '~/';

  useEffect(() => {
    if (loading) return;
    if (!profile) navigate('~/login', { replace: true });
    else if (!allowed) navigate(fallback, { replace: true });
  }, [loading, profile, allowed, fallback, navigate]);

  if (loading || !allowed) return <FullScreenLoader />;
  return <>{children}</>;
}
