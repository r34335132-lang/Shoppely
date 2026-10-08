import { useQuery } from '@tanstack/react-query';
import {
  fetchBanners, fetchCategories, fetchMyOrders, fetchOrderByToken, fetchProduct, fetchProducts, fetchReviews,
  fetchSettings, type ProductFilters,
} from '@/lib/api';
import { demoSettings } from '@/lib/demo-data';
import type { OrderSummary } from '@/lib/types';
import { useAuth } from '@/providers/auth';

export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: fetchSettings, staleTime: 5 * 60_000, placeholderData: demoSettings });

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 5 * 60_000 });

export const useProducts = (filters: ProductFilters = {}) =>
  useQuery({ queryKey: ['products', filters], queryFn: () => fetchProducts(filters) });

export const useProduct = (slug: string) =>
  useQuery({ queryKey: ['product', slug], queryFn: () => fetchProduct(slug), enabled: !!slug });

export const useBanners = () =>
  useQuery({ queryKey: ['banners'], queryFn: fetchBanners, staleTime: 5 * 60_000 });

export const useReviews = (productId: string | null, limit?: number) =>
  useQuery({ queryKey: ['reviews', productId, limit], queryFn: () => fetchReviews(productId, limit) });

/** `fast`: al volver de Mercado Pago el webhook tarda unos segundos en marcar el pago. */
export const useOrderByToken = (token: string, fast = false) =>
  useQuery({ queryKey: ['order', token], queryFn: () => fetchOrderByToken(token), enabled: !!token, refetchInterval: fast ? 4_000 : 15_000 });

export const useMyOrders = (userId: string | null | undefined) =>
  useQuery({ queryKey: ['my-orders', userId], queryFn: () => fetchMyOrders(userId!), enabled: !!userId, refetchInterval: 60_000 });

/** Pedidos en línea que la clienta todavía tiene que pagar (el efectivo se paga al entregar, no se recuerda). */
export const awaitingPayment = (o: Pick<OrderSummary, 'status' | 'payment_status' | 'payment_method'>) =>
  o.status !== 'cancelled'
  && (o.payment_status === 'pending' || o.payment_status === 'failed')
  && (o.payment_method === 'mercadopago' || o.payment_method === 'transfer');

export function usePendingPayments() {
  const { profile } = useAuth();
  const { data = [] } = useMyOrders(profile?.id);
  return data.filter(awaitingPayment);
}
