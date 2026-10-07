import type { MovementReason } from '@/lib/types';
import type { Tone } from '@/components/panel/kit';

export const movementLabel: Record<MovementReason, string> = {
  sale: 'Venta',
  return: 'Devolución',
  restock: 'Entrada',
  adjustment: 'Ajuste',
  damage: 'Merma',
  cancel: 'Cancelación',
};

export const movementTone: Record<MovementReason, Tone> = {
  sale: 'pink',
  return: 'blue',
  restock: 'green',
  adjustment: 'violet',
  damage: 'red',
  cancel: 'amber',
};
