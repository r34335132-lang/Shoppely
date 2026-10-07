-- =====================================================================
-- Comisión de Mercado Pago a cargo de la clienta
--
-- La tienda recibe el precio completo: al pagar con Mercado Pago se suma
-- la comisión al total, de modo que después de que Mercado Pago descuente
-- su tarifa (porcentaje + fijo + IVA) queda exactamente lo vendido.
--   bruto = (neto + fijo·(1+IVA)) / (1 − %·(1+IVA))
-- Las métricas del panel (ventas, ganancia, corte) excluyen la comisión.
-- =====================================================================

alter table public.store_settings
  add column if not exists mp_fee_online_enabled boolean not null default true,
  add column if not exists mp_fee_online_percent numeric(6, 3) not null default 3.49 check (mp_fee_online_percent >= 0 and mp_fee_online_percent < 50),
  add column if not exists mp_fee_online_fixed_mxn numeric(10, 2) not null default 4 check (mp_fee_online_fixed_mxn >= 0),
  add column if not exists mp_fee_pos_enabled boolean not null default true,
  add column if not exists mp_fee_pos_percent numeric(6, 3) not null default 3.5 check (mp_fee_pos_percent >= 0 and mp_fee_pos_percent < 50),
  add column if not exists mp_fee_pos_fixed_mxn numeric(10, 2) not null default 0 check (mp_fee_pos_fixed_mxn >= 0),
  add column if not exists mp_fee_iva numeric(5, 2) not null default 16 check (mp_fee_iva >= 0 and mp_fee_iva < 100);

-- Comisión cobrada a la clienta, en la moneda del pedido (ya incluida en total).
alter table public.orders
  add column if not exists payment_fee numeric(12, 2) not null default 0 check (payment_fee >= 0);

-- Monto a cobrar para que, tras la comisión, queden p_net limpios.
create or replace function public.mp_gross(p_net numeric, p_pct numeric, p_fixed numeric, p_iva numeric)
returns numeric language sql immutable as $$
  select case when p_net <= 0 then p_net else
    ceil(round((p_net + p_fixed * (1 + p_iva / 100)) / (1 - p_pct / 100 * (1 + p_iva / 100)) * 100, 4)) / 100
  end
$$;

-- Comisión que Mercado Pago descuenta de un cobro de p_gross.
create or replace function public.mp_fee_of(p_gross numeric, p_pct numeric, p_fixed numeric, p_iva numeric)
returns numeric language sql immutable as $$
  select case when p_gross <= 0 then 0 else round((p_gross * p_pct / 100 + p_fixed) * (1 + p_iva / 100), 2) end
$$;

-- ---------------------------------------------------------------------
-- create_order: igual que antes, más la comisión de Mercado Pago.
--  · Tienda en línea: si paga con Mercado Pago, total = neto + comisión.
--  · POS: cada pago con terminal se registra por lo que se cobró en la
--    terminal (bruto); la comisión de ese cobro se suma al total.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_channel public.order_channel := coalesce((p ->> 'channel')::public.order_channel, 'online');
  v_currency public.currency_code := coalesce((p ->> 'currency')::public.currency_code, 'MXN');
  v_method public.payment_method := coalesce((p ->> 'payment_method')::public.payment_method, 'cash');
  v_delivery text;
  v_settings public.store_settings%rowtype;
  v_rate numeric;
  v_order_id uuid;
  v_item jsonb;
  v_pay jsonb;
  v_qty int;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_coupon public.coupons%rowtype;
  v_unit numeric;
  v_cost numeric;
  v_item_id uuid;
  v_subtotal numeric := 0;
  v_subtotal_mxn numeric;
  v_discount numeric := 0;
  v_shipping numeric := 0;
  v_base numeric;
  v_fee numeric := 0;
  v_total numeric;
  v_paid numeric := 0;
  v_received numeric;
  v_pay_method public.payment_method;
  v_pay_currency public.currency_code;
  v_pay_amount numeric;
  v_pay_fee numeric;
  v_fixed numeric;
  v_result public.orders%rowtype;
begin
  if v_channel = 'pos' and not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'El carrito está vacío';
  end if;

  select * into v_settings from public.store_settings where id = 1;
  v_rate := v_settings.exchange_rate;
  v_delivery := coalesce(p ->> 'delivery_method', case when v_channel = 'pos' then 'pickup' else 'shipping' end);

  if v_channel = 'online' then
    if nullif(trim(p ->> 'customer_name'), '') is null or nullif(trim(p ->> 'customer_phone'), '') is null then
      raise exception 'Nombre y teléfono son obligatorios';
    end if;
    if v_method = 'mixed'
      or (v_method = 'cash' and not v_settings.cash_enabled)
      or (v_method = 'transfer' and not v_settings.transfer_enabled)
      or (v_method = 'mercadopago' and not v_settings.mercadopago_enabled) then
      raise exception 'Método de pago no disponible';
    end if;
  end if;

  insert into public.orders (
    channel, status, customer_id, customer_name, customer_email, customer_phone,
    delivery_method, shipping_address, currency, exchange_rate, payment_method,
    payment_status, notes, cashier_id, cash_session_id
  ) values (
    v_channel,
    case when v_channel = 'pos' then 'completed'::public.order_status else 'pending'::public.order_status end,
    case when v_channel = 'pos' then nullif(p ->> 'customer_id', '')::uuid else auth.uid() end,
    nullif(trim(p ->> 'customer_name'), ''),
    nullif(trim(p ->> 'customer_email'), ''),
    nullif(trim(p ->> 'customer_phone'), ''),
    v_delivery,
    p -> 'shipping_address',
    v_currency,
    v_rate,
    v_method,
    case when v_channel = 'pos' then 'paid'::public.payment_status else 'pending'::public.payment_status end,
    nullif(trim(p ->> 'notes'), ''),
    case when v_channel = 'pos' then auth.uid() end,
    case when v_channel = 'pos' then nullif(p ->> 'cash_session_id', '')::uuid end
  ) returning id into v_order_id;

  perform set_config('shoppely.reason', 'sale', true);
  perform set_config('shoppely.order_id', v_order_id::text, true);
  perform set_config('shoppely.note', '', true);

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid for update;
    if not found or not v_variant.active then
      raise exception 'Un producto del carrito ya no está disponible';
    end if;
    select * into v_product from public.products where id = v_variant.product_id;
    if v_channel = 'online' and not v_product.active then
      raise exception '% ya no está disponible', v_product.name;
    end if;
    if v_variant.stock < v_qty then
      raise exception 'Stock insuficiente de % (%): quedan %', v_product.name, v_variant.name, v_variant.stock;
    end if;

    if v_currency = 'MXN' then
      v_unit := coalesce(v_variant.price_mxn, v_product.price_mxn);
    else
      v_unit := coalesce(v_variant.price_usd, v_product.price_usd,
                         round(coalesce(v_variant.price_mxn, v_product.price_mxn) / v_rate, 2));
    end if;

    update public.product_variants set stock = stock - v_qty where id = v_variant.id;

    insert into public.order_items (order_id, product_id, variant_id, product_name, variant_name, sku, image_url, quantity, unit_price, line_total)
    values (v_order_id, v_product.id, v_variant.id, v_product.name, v_variant.name, v_variant.sku, v_product.images[1], v_qty, v_unit, v_unit * v_qty)
    returning id into v_item_id;

    select cost_mxn into v_cost from public.product_costs where product_id = v_product.id;
    insert into public.order_item_costs (order_item_id, unit_cost_mxn) values (v_item_id, coalesce(v_cost, 0));

    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  v_subtotal_mxn := case when v_currency = 'MXN' then v_subtotal else v_subtotal * v_rate end;

  if nullif(trim(p ->> 'coupon_code'), '') is not null then
    select * into v_coupon from public.coupons
    where upper(code) = upper(trim(p ->> 'coupon_code'))
      and active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
      and (max_uses is null or used_count < max_uses)
    for update;
    if not found then
      raise exception 'Cupón inválido o vencido';
    end if;
    if v_subtotal_mxn < coalesce(v_coupon.min_subtotal_mxn, 0) then
      raise exception 'El cupón requiere una compra mínima de $% MXN', v_coupon.min_subtotal_mxn;
    end if;
    if v_coupon.kind = 'percent' then
      v_discount := round(v_subtotal * least(v_coupon.value, 100) / 100, 2);
    else
      v_discount := case when v_currency = 'MXN' then v_coupon.value else round(v_coupon.value / v_rate, 2) end;
    end if;
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  if v_channel = 'pos' then
    v_discount := v_discount + greatest(coalesce((p ->> 'discount_amount')::numeric, 0), 0);
  end if;
  v_discount := least(v_discount, v_subtotal);

  if v_channel = 'online' and v_delivery = 'shipping'
     and (v_settings.free_shipping_min_mxn is null or v_subtotal_mxn < v_settings.free_shipping_min_mxn) then
    v_shipping := case when v_currency = 'MXN' then v_settings.shipping_fee_mxn
                       else round(v_settings.shipping_fee_mxn / v_rate, 2) end;
  end if;

  v_base := v_subtotal - v_discount + v_shipping;

  if v_channel = 'online' and v_method = 'mercadopago' and v_settings.mp_fee_online_enabled then
    v_fixed := case when v_currency = 'MXN' then v_settings.mp_fee_online_fixed_mxn else v_settings.mp_fee_online_fixed_mxn / v_rate end;
    v_fee := public.mp_gross(v_base, v_settings.mp_fee_online_percent, v_fixed, v_settings.mp_fee_iva) - v_base;
  end if;

  if v_channel = 'pos' then
    if jsonb_array_length(coalesce(p -> 'payments', '[]'::jsonb)) = 0 then
      p := jsonb_set(p, '{payments}', jsonb_build_array(jsonb_build_object(
        'method', v_method,
        'amount', case when v_method = 'mercadopago' and v_settings.mp_fee_pos_enabled
                       then public.mp_gross(v_base, v_settings.mp_fee_pos_percent,
                              case when v_currency = 'MXN' then v_settings.mp_fee_pos_fixed_mxn else v_settings.mp_fee_pos_fixed_mxn / v_rate end,
                              v_settings.mp_fee_iva)
                       else v_base end,
        'currency', v_currency,
        'reference', p ->> 'payment_reference')));
    end if;
    for v_pay in select * from jsonb_array_elements(p -> 'payments') loop
      v_pay_method := (v_pay ->> 'method')::public.payment_method;
      v_pay_currency := coalesce((v_pay ->> 'currency')::public.currency_code, v_currency);
      v_pay_amount := (v_pay ->> 'amount')::numeric;
      if v_pay_amount is null or v_pay_amount <= 0 then
        raise exception 'Monto de pago inválido';
      end if;

      insert into public.order_payments (order_id, method, amount, currency, reference, received_by)
      values (v_order_id, v_pay_method, v_pay_amount, v_pay_currency, nullif(v_pay ->> 'reference', ''), auth.uid());

      v_pay_fee := 0;
      if v_pay_method = 'mercadopago' and v_settings.mp_fee_pos_enabled then
        v_fixed := case when v_pay_currency = 'MXN' then v_settings.mp_fee_pos_fixed_mxn else v_settings.mp_fee_pos_fixed_mxn / v_rate end;
        v_pay_fee := public.mp_fee_of(v_pay_amount, v_settings.mp_fee_pos_percent, v_fixed, v_settings.mp_fee_iva);
      end if;

      v_paid := v_paid + case
        when v_pay_currency = v_currency then v_pay_amount
        when v_currency = 'MXN' then v_pay_amount * v_rate
        else v_pay_amount / v_rate
      end;
      v_fee := v_fee + case
        when v_pay_currency = v_currency then v_pay_fee
        when v_currency = 'MXN' then v_pay_fee * v_rate
        else v_pay_fee / v_rate
      end;
    end loop;
    v_fee := round(v_fee, 2);
    if v_paid + 0.01 < v_base + v_fee then
      raise exception 'El pago está incompleto: faltan %', round(v_base + v_fee - v_paid, 2);
    end if;
    v_received := nullif(p ->> 'amount_received', '')::numeric;
  end if;

  v_total := v_base + v_fee;

  update public.orders set
    subtotal = v_subtotal,
    discount = v_discount,
    shipping = v_shipping,
    payment_fee = v_fee,
    total = v_total,
    total_mxn = case when v_currency = 'MXN' then v_total else round(v_total * v_rate, 2) end,
    coupon_code = case when v_coupon.id is not null then v_coupon.code end,
    amount_received = v_received,
    change_given = case when v_received is not null then greatest(v_received - v_total, 0) end,
    paid_at = case when v_channel = 'pos' then now() end
  where id = v_order_id
  returning * into v_result;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (v_order_id, v_result.status, case when v_channel = 'pos' then 'Venta en tienda' else 'Pedido recibido' end, auth.uid());

  perform set_config('shoppely.reason', '', true);
  perform set_config('shoppely.order_id', '', true);

  return jsonb_build_object(
    'id', v_result.id,
    'folio', v_result.folio,
    'public_token', v_result.public_token,
    'total', v_result.total,
    'payment_fee', v_result.payment_fee,
    'currency', v_result.currency,
    'change_given', v_result.change_given
  );
end $$;

-- Si un pedido en línea elegido con Mercado Pago se termina cobrando por
-- otro medio (efectivo, transferencia), la comisión ya no aplica.
create or replace function public.mark_order_paid(p_order_id uuid, p_method public.payment_method default null, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_method public.payment_method;
  v_fee numeric;
  v_total numeric;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_order.payment_status = 'paid' then return; end if;

  v_method := coalesce(p_method, v_order.payment_method);
  v_fee := case when v_method = 'mercadopago' then v_order.payment_fee else 0 end;
  v_total := v_order.total - v_order.payment_fee + v_fee;

  update public.orders set
    payment_status = 'paid',
    payment_method = v_method,
    payment_fee = v_fee,
    total = v_total,
    total_mxn = case when currency = 'MXN' then v_total else round(v_total * exchange_rate, 2) end,
    transfer_reference = coalesce(p_reference, transfer_reference),
    paid_at = now(),
    status = case when status = 'pending' then 'confirmed'::public.order_status else status end
  where id = p_order_id;

  insert into public.order_payments (order_id, method, amount, currency, reference, received_by)
  values (p_order_id, v_method, v_total, v_order.currency, p_reference, auth.uid());

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (p_order_id, case when v_order.status = 'pending' then 'confirmed'::public.order_status else v_order.status end, 'Pago confirmado', auth.uid());
end $$;

create or replace function public.get_order_by_token(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'folio', o.folio, 'status', o.status, 'payment_status', o.payment_status,
    'payment_method', o.payment_method, 'currency', o.currency, 'subtotal', o.subtotal,
    'discount', o.discount, 'shipping', o.shipping, 'payment_fee', o.payment_fee,
    'total', o.total, 'total_mxn', o.total_mxn,
    'delivery_method', o.delivery_method, 'customer_name', o.customer_name, 'created_at', o.created_at,
    'public_token', o.public_token,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name, 'variant_name', i.variant_name, 'quantity', i.quantity,
        'unit_price', i.unit_price, 'line_total', i.line_total, 'image_url', i.image_url))
      from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o where o.public_token = p_token
$$;

-- ---------------------------------------------------------------------
-- Estadísticas: lo que se vende es lo que queda para la tienda, así que
-- la comisión (que se va a Mercado Pago) no cuenta como venta.
-- ---------------------------------------------------------------------
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
    select o.*, 0::numeric as fee_mxn, 0::numeric as sales_mxn from public.orders o where false;
  truncate _stats_orders;
  insert into _stats_orders
    select o.*, f.fee_mxn, o.total_mxn - f.fee_mxn
    from public.orders o
    cross join lateral (select round(o.payment_fee * case when o.currency = 'MXN' then 1 else o.exchange_rate end, 2) fee_mxn) f
    where o.created_at >= p_from and o.created_at < p_to
      and o.status <> 'cancelled' and o.payment_status = 'paid'
      and (v_cashier is null or o.cashier_id = v_cashier);

  select jsonb_build_object(
    'revenue_mxn', coalesce(sum(sales_mxn), 0),
    'orders', count(*),
    'avg_ticket_mxn', coalesce(round(avg(sales_mxn), 2), 0),
    'online_mxn', coalesce(sum(sales_mxn) filter (where channel = 'online'), 0),
    'pos_mxn', coalesce(sum(sales_mxn) filter (where channel = 'pos'), 0)
  ) into v_result from _stats_orders;

  v_result := v_result || jsonb_build_object(
    'items_sold', (select coalesce(sum(i.quantity), 0) from public.order_items i join _stats_orders o on o.id = i.order_id),
    'by_day', coalesce((
      select jsonb_agg(d order by d ->> 'day') from (
        select jsonb_build_object(
          'day', to_char(date_trunc('day', created_at at time zone v_tz), 'YYYY-MM-DD'),
          'revenue_mxn', sum(sales_mxn),
          'orders', count(*)
        ) d
        from _stats_orders group by date_trunc('day', created_at at time zone v_tz)
      ) s), '[]'::jsonb),
    'by_hour', coalesce((
      select jsonb_object_agg(h, amount) from (
        select extract(hour from created_at at time zone v_tz)::int h, round(sum(sales_mxn), 2) amount
        from _stats_orders group by 1
      ) x), '{}'::jsonb),
    'by_method', coalesce((
      -- El efectivo se registra como lo entregado (se descuenta el cambio) y
      -- Mercado Pago como lo cobrado en terminal (se descuenta la comisión).
      select jsonb_object_agg(method, amount) from (
        select method, round(sum(amount), 2) amount from (
          select pay.method, case when pay.currency = 'MXN' then pay.amount else pay.amount * o.exchange_rate end amount
          from public.order_payments pay join _stats_orders o on o.id = pay.order_id
          union all
          select 'cash'::public.payment_method, -(case when o.currency = 'MXN' then o.change_given else o.change_given * o.exchange_rate end)
          from _stats_orders o where coalesce(o.change_given, 0) > 0
          union all
          select 'mercadopago'::public.payment_method, -o.fee_mxn
          from _stats_orders o where o.fee_mxn > 0
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

    select coalesce(sum((total - shipping - payment_fee) * case when currency = 'MXN' then 1 else exchange_rate end), 0)
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
    'total_mxn', (
      select coalesce(sum(total_mxn - round(payment_fee * case when currency = 'MXN' then 1 else exchange_rate end, 2)), 0)
      from public.orders where cash_session_id = p_session_id and status <> 'cancelled'
    ),
    'fees_mxn', (
      select coalesce(sum(round(payment_fee * case when currency = 'MXN' then 1 else exchange_rate end, 2)), 0)
      from public.orders where cash_session_id = p_session_id and status <> 'cancelled'
    ),
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
          union all
          select 'mercadopago'::public.payment_method, -round(o.payment_fee * case when o.currency = 'MXN' then 1 else o.exchange_rate end, 2)
          from public.orders o
          where o.cash_session_id = p_session_id and o.status <> 'cancelled' and o.payment_fee > 0
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
