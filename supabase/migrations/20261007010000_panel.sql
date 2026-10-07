-- =====================================================================
-- Shoppely · Fase 2: panel, POS, inventario y caja
-- =====================================================================

create index if not exists orders_cashier_idx on public.orders (cashier_id, created_at desc);
create index if not exists orders_session_idx on public.orders (cash_session_id);
create index if not exists cash_sessions_open_idx on public.cash_sessions (opened_by) where status = 'open';

-- Un usuario solo puede tener una caja abierta a la vez.
create unique index if not exists cash_sessions_one_open on public.cash_sessions (opened_by) where status = 'open';

-- ---------------------------------------------------------------------
-- Guardar producto + variantes + costo en una sola transacción.
-- El stock de variantes existentes NO se toca aquí (se ajusta desde
-- Inventario para que quede registrado); solo las nuevas traen stock inicial.
-- ---------------------------------------------------------------------
create or replace function public.save_product(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_variant jsonb;
  v_vid uuid;
  v_keep uuid[] := '{}';
  v_slug text;
begin
  if not public.can_manage_catalog() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if nullif(trim(p ->> 'name'), '') is null then
    raise exception 'El nombre es obligatorio';
  end if;
  if jsonb_array_length(coalesce(p -> 'variants', '[]'::jsonb)) = 0 then
    raise exception 'Agrega al menos una variante';
  end if;

  v_slug := coalesce(nullif(trim(p ->> 'slug'), ''), lower(regexp_replace(trim(p ->> 'name'), '[^a-zA-Z0-9]+', '-', 'g')));
  v_slug := trim(both '-' from v_slug);

  if v_id is null then
    insert into public.products (
      name, slug, description, category_id, brand, price_mxn, price_usd, compare_at_mxn, compare_at_usd,
      images, tags, featured, is_new, active, created_by
    ) values (
      trim(p ->> 'name'),
      v_slug,
      nullif(trim(p ->> 'description'), ''),
      nullif(p ->> 'category_id', '')::uuid,
      nullif(trim(p ->> 'brand'), ''),
      coalesce((p ->> 'price_mxn')::numeric, 0),
      nullif(p ->> 'price_usd', '')::numeric,
      nullif(p ->> 'compare_at_mxn', '')::numeric,
      nullif(p ->> 'compare_at_usd', '')::numeric,
      coalesce(array(select jsonb_array_elements_text(p -> 'images')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
      coalesce((p ->> 'featured')::boolean, false),
      coalesce((p ->> 'is_new')::boolean, false),
      coalesce((p ->> 'active')::boolean, true),
      auth.uid()
    ) returning id into v_id;
  else
    update public.products set
      name = trim(p ->> 'name'),
      slug = v_slug,
      description = nullif(trim(p ->> 'description'), ''),
      category_id = nullif(p ->> 'category_id', '')::uuid,
      brand = nullif(trim(p ->> 'brand'), ''),
      price_mxn = coalesce((p ->> 'price_mxn')::numeric, 0),
      price_usd = nullif(p ->> 'price_usd', '')::numeric,
      compare_at_mxn = nullif(p ->> 'compare_at_mxn', '')::numeric,
      compare_at_usd = nullif(p ->> 'compare_at_usd', '')::numeric,
      images = coalesce(array(select jsonb_array_elements_text(p -> 'images')), '{}'),
      tags = coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
      featured = coalesce((p ->> 'featured')::boolean, false),
      is_new = coalesce((p ->> 'is_new')::boolean, false),
      active = coalesce((p ->> 'active')::boolean, true)
    where id = v_id;
    if not found then raise exception 'Producto no encontrado'; end if;
  end if;

  for v_variant in select * from jsonb_array_elements(p -> 'variants') loop
    v_vid := nullif(v_variant ->> 'id', '')::uuid;
    if v_vid is not null and exists (select 1 from public.product_variants where id = v_vid and product_id = v_id) then
      update public.product_variants set
        name = coalesce(nullif(trim(v_variant ->> 'name'), ''), 'Única'),
        size = nullif(trim(v_variant ->> 'size'), ''),
        color = nullif(trim(v_variant ->> 'color'), ''),
        color_hex = nullif(trim(v_variant ->> 'color_hex'), ''),
        sku = nullif(trim(v_variant ->> 'sku'), ''),
        barcode = nullif(trim(v_variant ->> 'barcode'), ''),
        low_stock_threshold = coalesce((v_variant ->> 'low_stock_threshold')::int, 3),
        price_mxn = nullif(v_variant ->> 'price_mxn', '')::numeric,
        price_usd = nullif(v_variant ->> 'price_usd', '')::numeric,
        sort_order = coalesce((v_variant ->> 'sort_order')::int, 0),
        active = coalesce((v_variant ->> 'active')::boolean, true)
      where id = v_vid;
    else
      insert into public.product_variants (
        product_id, name, size, color, color_hex, sku, barcode, stock, low_stock_threshold, price_mxn, price_usd, sort_order, active
      ) values (
        v_id,
        coalesce(nullif(trim(v_variant ->> 'name'), ''), 'Única'),
        nullif(trim(v_variant ->> 'size'), ''),
        nullif(trim(v_variant ->> 'color'), ''),
        nullif(trim(v_variant ->> 'color_hex'), ''),
        nullif(trim(v_variant ->> 'sku'), ''),
        nullif(trim(v_variant ->> 'barcode'), ''),
        greatest(coalesce((v_variant ->> 'stock')::int, 0), 0),
        coalesce((v_variant ->> 'low_stock_threshold')::int, 3),
        nullif(v_variant ->> 'price_mxn', '')::numeric,
        nullif(v_variant ->> 'price_usd', '')::numeric,
        coalesce((v_variant ->> 'sort_order')::int, 0),
        coalesce((v_variant ->> 'active')::boolean, true)
      ) returning id into v_vid;
    end if;
    v_keep := v_keep || v_vid;
  end loop;

  -- Variantes quitadas: se borran si nunca se vendieron; si tienen ventas se ocultan.
  update public.product_variants set active = false
  where product_id = v_id and not (id = any (v_keep))
    and exists (select 1 from public.order_items i where i.variant_id = product_variants.id);
  delete from public.product_variants
  where product_id = v_id and not (id = any (v_keep));

  if public.is_admin() and p ? 'cost_mxn' then
    insert into public.product_costs (product_id, cost_mxn, supplier)
    values (v_id, greatest(coalesce(nullif(p ->> 'cost_mxn', '')::numeric, 0), 0), nullif(trim(p ->> 'supplier'), ''))
    on conflict (product_id) do update set cost_mxn = excluded.cost_mxn, supplier = excluded.supplier;
  end if;

  return v_id;
exception
  when unique_violation then
    if sqlerrm like '%slug%' then raise exception 'Ya existe un producto con esa URL (slug)'; end if;
    if sqlerrm like '%sku%' then raise exception 'Ese SKU ya está en uso por otro producto'; end if;
    if sqlerrm like '%barcode%' then raise exception 'Ese código de barras ya está en uso'; end if;
    raise;
end $$;

-- Una variante vendida se conserva (oculta) para no perder su historial de inventario.
create or replace function public.protect_sold_variants()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.order_items i where i.variant_id = old.id) then
    return null;
  end if;
  return old;
end $$;

drop trigger if exists product_variants_protect_sold on public.product_variants;
create trigger product_variants_protect_sold before delete on public.product_variants
  for each row execute function public.protect_sold_variants();

-- Un producto con ventas no se borra: se archiva (active = false).
create or replace function public.protect_sold_products()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.order_items i where i.product_id = old.id) then
    raise exception 'Este producto ya tiene ventas; archívalo en lugar de borrarlo';
  end if;
  return old;
end $$;

drop trigger if exists products_protect_sold on public.products;
create trigger products_protect_sold before delete on public.products
  for each row execute function public.protect_sold_products();

-- ---------------------------------------------------------------------
-- Estadísticas por rol
--  · admin: toda la tienda + costos, ganancia y margen (puede filtrar por cajero)
--  · seller: solo sus ventas del POS, sin costos
-- ---------------------------------------------------------------------
drop function if exists public.dashboard_stats(timestamptz, timestamptz);

create or replace function public.dashboard_stats(p_from timestamptz, p_to timestamptz, p_cashier uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tz text;
  v_result jsonb;
  v_cost numeric;
  v_net numeric;
  v_cashier uuid := p_cashier;
begin
  if public.is_admin() then
    null;
  elsif public.has_role(array['seller']::public.app_role[]) then
    v_cashier := auth.uid();
  else
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select timezone into v_tz from public.store_settings where id = 1;

  create temporary table if not exists _stats_orders on commit drop as
    select * from public.orders where false;
  truncate _stats_orders;
  insert into _stats_orders
    select * from public.orders
    where created_at >= p_from and created_at < p_to
      and status <> 'cancelled' and payment_status = 'paid'
      and (v_cashier is null or cashier_id = v_cashier);

  select jsonb_build_object(
    'revenue_mxn', coalesce(sum(total_mxn), 0),
    'orders', count(*),
    'avg_ticket_mxn', coalesce(round(avg(total_mxn), 2), 0),
    'online_mxn', coalesce(sum(total_mxn) filter (where channel = 'online'), 0),
    'pos_mxn', coalesce(sum(total_mxn) filter (where channel = 'pos'), 0)
  ) into v_result from _stats_orders;

  v_result := v_result || jsonb_build_object(
    'items_sold', (select coalesce(sum(i.quantity), 0) from public.order_items i join _stats_orders o on o.id = i.order_id),
    'by_day', coalesce((
      select jsonb_agg(d order by d ->> 'day') from (
        select jsonb_build_object(
          'day', to_char(date_trunc('day', created_at at time zone v_tz), 'YYYY-MM-DD'),
          'revenue_mxn', sum(total_mxn),
          'orders', count(*)
        ) d
        from _stats_orders group by date_trunc('day', created_at at time zone v_tz)
      ) s), '[]'::jsonb),
    'by_hour', coalesce((
      select jsonb_object_agg(h, amount) from (
        select extract(hour from created_at at time zone v_tz)::int h, round(sum(total_mxn), 2) amount
        from _stats_orders group by 1
      ) x), '{}'::jsonb),
    'by_method', coalesce((
      -- El efectivo se registra como lo entregado por la clienta; el cambio se descuenta aquí.
      select jsonb_object_agg(method, amount) from (
        select method, round(sum(amount), 2) amount from (
          select pay.method, case when pay.currency = 'MXN' then pay.amount else pay.amount * o.exchange_rate end amount
          from public.order_payments pay join _stats_orders o on o.id = pay.order_id
          union all
          select 'cash'::public.payment_method, -(case when o.currency = 'MXN' then o.change_given else o.change_given * o.exchange_rate end)
          from _stats_orders o where coalesce(o.change_given, 0) > 0
        ) x group by method
      ) m), '{}'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select i.product_id, i.product_name, max(i.image_url) image_url, sum(i.quantity) quantity,
               round(sum(i.line_total * case when o.currency = 'MXN' then 1 else o.exchange_rate end), 2) revenue_mxn
        from public.order_items i join _stats_orders o on o.id = i.order_id
        group by i.product_id, i.product_name
        order by sum(i.quantity) desc limit 6
      ) t), '[]'::jsonb),
    'pending_orders', (select count(*) from public.orders where channel = 'online' and status in ('pending', 'confirmed', 'preparing')),
    'unpaid_orders', (select count(*) from public.orders where channel = 'online' and status <> 'cancelled' and payment_status = 'pending'),
    'low_stock', (select count(*) from public.product_variants where active and stock <= low_stock_threshold)
  );

  if public.is_admin() then
    select coalesce(sum(i.quantity * c.unit_cost_mxn), 0) into v_cost
    from public.order_items i
    join _stats_orders o on o.id = i.order_id
    left join public.order_item_costs c on c.order_item_id = i.id;

    select coalesce(sum((total - shipping) * case when currency = 'MXN' then 1 else exchange_rate end), 0)
    into v_net from _stats_orders;

    v_result := v_result || jsonb_build_object(
      'cost_mxn', round(v_cost, 2),
      'net_sales_mxn', round(v_net, 2),
      'profit_mxn', round(v_net - v_cost, 2),
      'margin', case when v_net > 0 then round((v_net - v_cost) / v_net * 100, 1) else 0 end,
      'inventory_cost_mxn', (
        select coalesce(round(sum(v.stock * coalesce(c.cost_mxn, 0)), 2), 0)
        from public.product_variants v left join public.product_costs c on c.product_id = v.product_id
        where v.active
      ),
      'inventory_retail_mxn', (
        select coalesce(round(sum(v.stock * coalesce(v.price_mxn, p.price_mxn)), 2), 0)
        from public.product_variants v join public.products p on p.id = v.product_id
        where v.active
      )
    );
  end if;

  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- Corte X: resumen de la caja abierta (sin cerrarla)
-- ---------------------------------------------------------------------
create or replace function public.cash_session_summary(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_session public.cash_sessions%rowtype;
  v_cash_mxn numeric;
  v_cash_usd numeric;
  v_change_mxn numeric;
  v_change_usd numeric;
  v_in_mxn numeric;
  v_in_usd numeric;
  v_out_mxn numeric;
  v_out_usd numeric;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_session from public.cash_sessions where id = p_session_id;
  if not found then raise exception 'Caja no encontrada'; end if;

  select
    coalesce(sum(pay.amount) filter (where pay.method = 'cash' and pay.currency = 'MXN'), 0),
    coalesce(sum(pay.amount) filter (where pay.method = 'cash' and pay.currency = 'USD'), 0)
  into v_cash_mxn, v_cash_usd
  from public.order_payments pay join public.orders o on o.id = pay.order_id
  where o.cash_session_id = p_session_id and o.status <> 'cancelled';

  select
    coalesce(sum(change_given) filter (where currency = 'MXN'), 0),
    coalesce(sum(change_given) filter (where currency = 'USD'), 0)
  into v_change_mxn, v_change_usd
  from public.orders where cash_session_id = p_session_id and status <> 'cancelled';

  select
    coalesce(sum(amount) filter (where kind = 'in' and currency = 'MXN'), 0),
    coalesce(sum(amount) filter (where kind = 'in' and currency = 'USD'), 0),
    coalesce(sum(amount) filter (where kind = 'out' and currency = 'MXN'), 0),
    coalesce(sum(amount) filter (where kind = 'out' and currency = 'USD'), 0)
  into v_in_mxn, v_in_usd, v_out_mxn, v_out_usd
  from public.cash_movements where session_id = p_session_id;

  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'sales', (select count(*) from public.orders where cash_session_id = p_session_id and status <> 'cancelled'),
    'cancelled', (select count(*) from public.orders where cash_session_id = p_session_id and status = 'cancelled'),
    'total_mxn', (select coalesce(sum(total_mxn), 0) from public.orders where cash_session_id = p_session_id and status <> 'cancelled'),
    'by_method', coalesce((
      select jsonb_object_agg(method, amount) from (
        select method, round(sum(amount), 2) amount from (
          select pay.method, case when pay.currency = 'MXN' then pay.amount else pay.amount * o.exchange_rate end amount
          from public.order_payments pay join public.orders o on o.id = pay.order_id
          where o.cash_session_id = p_session_id and o.status <> 'cancelled'
          union all
          select 'cash'::public.payment_method, -(case when o.currency = 'MXN' then o.change_given else o.change_given * o.exchange_rate end)
          from public.orders o
          where o.cash_session_id = p_session_id and o.status <> 'cancelled' and coalesce(o.change_given, 0) > 0
        ) x group by method
      ) m), '{}'::jsonb),
    'cash_in_mxn', v_in_mxn,
    'cash_out_mxn', v_out_mxn,
    'cash_in_usd', v_in_usd,
    'cash_out_usd', v_out_usd,
    'expected_mxn', v_session.opening_mxn + v_cash_mxn - v_change_mxn + v_in_mxn - v_out_mxn,
    'expected_usd', v_session.opening_usd + v_cash_usd - v_change_usd + v_in_usd - v_out_usd
  );
end $$;