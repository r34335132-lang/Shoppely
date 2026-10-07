import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchAdminBanners, fetchAdminCategories, fetchAdminProducts, fetchAdminReviews, fetchCashMovements, fetchCashSessions,
  fetchBadges, fetchCashSummary, fetchCoupons, fetchMovements, fetchOpenSession, fetchOrder, fetchOrders, fetchStats, fetchTeam,
  type OrderFilters,
} from '@/lib/admin-api';

export const useStats = (from: Date, to: Date, cashierId: string | null = null, enabled = true) =>
  useQuery({
    queryKey: ['admin', 'stats', from.toISOString(), to.toISOString(), cashierId],
    queryFn: () => fetchStats(from, to, cashierId),
    enabled,
    placeholderData: (prev) => prev,
  });

export const useBadges = () =>
  useQuery({ queryKey: ['admin', 'badges'], queryFn: fetchBadges, refetchInterval: 60_000 });

export const useOrders = (filters: OrderFilters, enabled = true) =>
  useQuery({
    queryKey: ['admin', 'orders', { ...filters, from: filters.from?.toISOString(), to: filters.to?.toISOString() }],
    queryFn: () => fetchOrders(filters),
    enabled,
    placeholderData: (prev) => prev,
  });

export const useOrder = (id: string | null) =>
  useQuery({ queryKey: ['admin', 'order', id], queryFn: () => fetchOrder(id!), enabled: !!id });

export const useAdminProducts = () => useQuery({ queryKey: ['admin', 'products'], queryFn: fetchAdminProducts });
export const useAdminCategories = () => useQuery({ queryKey: ['admin', 'categories'], queryFn: fetchAdminCategories });

export const useMovements = (variantId?: string, limit = 100) =>
  useQuery({ queryKey: ['admin', 'movements', variantId ?? 'all', limit], queryFn: () => fetchMovements({ variantId, limit }) });

export const useOpenSession = (userId: string | undefined) =>
  useQuery({ queryKey: ['admin', 'cash', 'open', userId], queryFn: () => fetchOpenSession(userId!), enabled: !!userId });

export const useCashSessions = () => useQuery({ queryKey: ['admin', 'cash', 'sessions'], queryFn: () => fetchCashSessions() });

export const useCashMovements = (sessionId: string | undefined) =>
  useQuery({ queryKey: ['admin', 'cash', 'moves', sessionId], queryFn: () => fetchCashMovements(sessionId!), enabled: !!sessionId });

export const useCashSummary = (sessionId: string | undefined) =>
  useQuery({ queryKey: ['admin', 'cash', 'summary', sessionId], queryFn: () => fetchCashSummary(sessionId!), enabled: !!sessionId });

export const useAdminReviews = () => useQuery({ queryKey: ['admin', 'reviews'], queryFn: fetchAdminReviews });
export const useAdminBanners = () => useQuery({ queryKey: ['admin', 'banners'], queryFn: fetchAdminBanners });
export const useCoupons = () => useQuery({ queryKey: ['admin', 'coupons'], queryFn: fetchCoupons });
export const useTeam = () => useQuery({ queryKey: ['admin', 'team'], queryFn: fetchTeam });

/**
 * Mutación con toast de éxito/error. Al terminar invalida todo el caché:
 * un cambio en el panel (precio, stock, portada) también afecta a la tienda.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  success?: string | ((result: TResult, args: TArgs) => string | null),
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, args) => {
      const message = typeof success === 'function' ? success(result, args) : success;
      if (message) toast.success(message);
      void qc.invalidateQueries();
    },
    onError: (error) => toast.error((error as Error).message),
  });
}
