-- =====================================================================
-- Los pedidos en línea requieren cuenta: así cada pedido queda en el
-- perfil de la clienta (create_order guarda customer_id = auth.uid()).
-- Las ventas del POS no cambian.
-- =====================================================================

create or replace function public.require_customer_session()
returns trigger language plpgsql as $$
begin
  if new.channel = 'online' and auth.uid() is null then
    raise exception 'Inicia sesión para comprar' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists orders_require_session on public.orders;
create trigger orders_require_session
  before insert on public.orders
  for each row execute function public.require_customer_session();
