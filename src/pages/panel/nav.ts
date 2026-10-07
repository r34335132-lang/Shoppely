import {
  Boxes, ClipboardList, Image, LayoutDashboard, MessageSquareHeart, ScanBarcode, Settings, Tag, TicketPercent, Users, Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  section: 'menu' | 'store' | 'general';
  badge?: 'orders' | 'stock';
  keywords?: string;
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard, roles: ['admin', 'seller', 'inventory'], section: 'menu', keywords: 'dashboard resumen ventas ganancias' },
  { href: '/pos', label: 'Punto de venta', icon: ScanBarcode, roles: ['admin', 'seller'], section: 'menu', keywords: 'pos cobrar vender caja' },
  { href: '/pedidos', label: 'Pedidos', icon: ClipboardList, roles: ['admin', 'seller'], section: 'menu', badge: 'orders', keywords: 'ordenes envios' },
  { href: '/productos', label: 'Productos', icon: Tag, roles: ['admin', 'inventory'], section: 'menu', keywords: 'catalogo precios fotos categorias' },
  { href: '/inventario', label: 'Inventario', icon: Boxes, roles: ['admin', 'inventory'], section: 'menu', badge: 'stock', keywords: 'stock existencias conteo' },
  { href: '/caja', label: 'Caja', icon: Wallet, roles: ['admin', 'seller'], section: 'menu', keywords: 'corte efectivo turno' },
  { href: '/portada', label: 'Portada', icon: Image, roles: ['admin'], section: 'store', keywords: 'banners destacados inicio tienda' },
  { href: '/resenas', label: 'Reseñas', icon: MessageSquareHeart, roles: ['admin'], section: 'store', keywords: 'opiniones comentarios' },
  { href: '/cupones', label: 'Cupones', icon: TicketPercent, roles: ['admin'], section: 'store', keywords: 'descuentos promociones' },
  { href: '/equipo', label: 'Equipo', icon: Users, roles: ['admin'], section: 'general', keywords: 'usuarios roles permisos' },
  { href: '/ajustes', label: 'Ajustes', icon: Settings, roles: ['admin'], section: 'general', keywords: 'configuracion pagos envio tipo de cambio banco' },
];

export const sectionLabel: Record<NavItem['section'], string> = {
  menu: 'Menú',
  store: 'Tienda',
  general: 'General',
};

export const canSee = (item: NavItem, role: Role | null) => !!role && item.roles.includes(role);
