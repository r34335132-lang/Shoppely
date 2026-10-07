import { useQuery } from '@tanstack/react-query';
import {
  fetchBanners, fetchCategories, fetchMyOrders, fetchOrderByToken, fetchProduct, fetchProducts, fetchReviews,
  fetchSettings, type ProductFilters,
} from '@/lib/api';
import { demoSettings } from '@/lib/demo-data';

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

export const useOrderByToken = (token: string) =>
  useQuery({ queryKey: ['order', token], queryFn: () => fetchOrderByToken(token), enabled: !!token, refetchInterval: 15_000 });

export const useMyOrders = (userId: string | null | undefined) =>
  useQuery({ queryKey: ['my-orders', userId], queryFn: () => fetchMyOrders(userId!), enabled: !!userId });
