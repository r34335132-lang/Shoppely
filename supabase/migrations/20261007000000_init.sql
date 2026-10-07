-- =====================================================================
-- Shoppely: esquema inicial
-- Roles: admin (todo + ganancias), inventory (productos y stock),
--        seller (POS y pedidos, sin costos ni ganancias), customer
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'inventory', 'seller', 'customer');
create type public.order_channel as enum ('online', 'pos');
create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled');
create type public.payment_method as enum ('cash', 'transfer', 'mercadopago', 'mixed');
create type public.payment_status as enum ('pending', 'paid', 'refunded', 'failed');
create type public.currency_code as enum ('MXN', 'USD');
create type public.movement_reason as enum ('sale', 'return', 'restock', 'adjustment', 'damage', 'cancel');
create type public.review_status as enum ('published', 'hidden');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Perfiles y roles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role public.app_role not null default 'customer',
  active boolean not null default true,
  pos_pin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.has_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.role = any (roles) from public.profiles p where p.id = auth.uid() and p.active),
    false
  )
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['admin']::public.app_role[])
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['admin', 'inventory', 'seller']::public.app_role[])
$$;

create or replace function public.can_manage_catalog()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['admin', 'inventory']::public.app_role[])
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo un admin puede cambiar roles o desactivar cuentas.
-- Desde el SQL Editor (sin sesión) sí se permite, para crear el primer admin.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.active is distinct from old.active then
      raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- Configuración de la tienda (una sola fila)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'Shoppely',
  tagline text default 'Online Store',
  whatsapp text default '+17738497180',
  instagram_url text default 'https://www.instagram.com/shoppelystore',
  facebook_url text default 'https://www.facebook.com/share/1DnMNY9R5p/',
  contact_email text,
  address text,
  timezone text not null default 'America/Mexico_City',
  default_currency public.currency_code not null default 'MXN',
  exchange_rate numeric(10, 4) not null default 18.50 check (exchange_rate > 0),
  shipping_fee_mxn numeric(12, 2) not null default 150,
  free_shipping_min_mxn numeric(12, 2) default 1500,
  cash_enabled boolean not null default true,
  transfer_enabled boolean not null default true,
  mercadopago_enabled boolean not null default true,
  bank_name text,
  bank_account_holder text,
  bank_clabe text,
  bank_account_number text,
  transfer_instructions text default 'Envía tu comprobante por WhatsApp con tu número de pedido.',
  updated_at timestamptz not null default now()
);

create trigger store_settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  brand text,
  price_mxn numeric(12, 2) not null check (price_mxn >= 0),
  price_usd numeric(12, 2) check (price_usd >= 0),
  compare_at_mxn numeric(12, 2),
  compare_at_usd numeric(12, 2),
  images text[] not null default '{}',
  tags text[] not null default '{}',
  featured boolean not null default false,
  is_new boolean not null default false,
  active boolean not null default true,
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_active_idx on public.products (active, featured);

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Cada producto tiene al menos una variante; el stock y el código de barras viven aquí.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null default 'Única',
  size text,
  color text,
  color_hex text,
  sku text unique,
  barcode text unique,
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 3,
  price_mxn numeric(12, 2) check (price_mxn >= 0),
  price_usd numeric(12, 2) check (price_usd >= 0),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id);

create trigger product_variants_touch before update on public.product_variants
  for each row execute function public.touch_updated_at();

-- Costos separados para que vendedores nunca puedan leerlos.
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_mxn numeric(12, 2) not null default 0 check (cost_mxn >= 0),
  supplier text,
  updated_at timestamptz not null default now()
);

create trigger product_costs_touch before update on public.product_costs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Inventario: todo cambio de stock queda registrado automáticamente
-- ---------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity_change int not null,
  stock_after int not null,
  reason public.movement_reason not null,
  note text,
  order_id uuid,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

create or replace function public.log_stock_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.stock <> 0 then
      insert into public.inventory_movements (variant_id, quantity_change, stock_after, reason, note, user_id)
      values (new.id, new.stock, new.stock, 'restock', 'Inventario inicial', auth.uid());
    end if;
  elsif new.stock is distinct from old.stock then
    insert into public.inventory_movements (variant_id, quantity_change, stock_after, reason, note, order_id, user_id)
    values (
      new.id,
      new.stock - old.stock,
      new.stock,
      coalesce(nullif(current_setting('shoppely.reason', true), '')::public.movement_reason, 'adjustment'),
      nullif(current_setting('shoppely.note', true), ''),
      nullif(current_setting('shoppely.order_id', true), '')::uuid,
      auth.uid()
    );
  end if;
  return new;
end $$;

create trigger product_variants_stock_log after insert or update of stock on public.product_variants
  for each row execute function public.log_stock_change();

-- ---------------------------------------------------------------------
-- Contenido de la portada (secciones con scroll)
-- ---------------------------------------------------------------------
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null default 'story' check (placement in ('hero', 'story', 'promo')),
  eyebrow text,
  title text not null,
  subtitle text,
  image_url text not null,
  cta_label text,
  cta_link text,
  theme text not null default 'light' check (theme in ('light', 'dark', 'pink')),
  sort_order int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Cupones
-- ---------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent', 'fixed')),
  value numeric(12, 2) not null check (value > 0),
  min_subtotal_mxn numeric(12, 2) default 0,
  max_uses int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Caja (turnos del POS)
-- ---------------------------------------------------------------------
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references public.profiles (id),
  opened_at timestamptz not null default now(),
  opening_mxn numeric(12, 2) not null default 0,
  opening_usd numeric(12, 2) not null default 0,
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  expected_mxn numeric(12, 2),
  expected_usd numeric(12, 2),
  counted_mxn numeric(12, 2),
  counted_usd numeric(12, 2),
  notes text,
  status text not null default 'open' check (status in ('open', 'closed'))
);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions (id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency_code not null default 'MXN',
  reason text,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pedidos (tienda en línea y POS)
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  folio bigint generated always as identity (start with 1001) unique,
  public_token uuid not null default gen_random_uuid() unique,
  channel public.order_channel not null,
  status public.order_status not null default 'pending',
  customer_id uuid references public.profiles (id) on delete set null,
  customer_name text,
  customer_email text,
  customer_phone text,
  delivery_method text not null default 'shipping' check (delivery_method in ('shipping', 'pickup')),
  shipping_address jsonb,
  currency public.currency_code not null default 'MXN',
  exchange_rate numeric(10, 4) not null,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  total_mxn numeric(12, 2) not null default 0,
  coupon_code text,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  amount_received numeric(12, 2),
  change_given numeric(12, 2),
  mp_preference_id text,
  mp_payment_id text,
  transfer_reference text,
  notes text,
  internal_notes text,
  cashier_id uuid references public.profiles (id) on delete set null,
  cash_session_id uuid references public.cash_sessions (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_customer_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status, payment_status);

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_name text,
  sku text,
  image_url text,
  quantity int not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_item_costs (
  order_item_id uuid primary key references public.order_items (id) on delete cascade,
  unit_cost_mxn numeric(12, 2) not null default 0
);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method public.payment_method not null,
  amount numeric(12, 2) not null,
  currency public.currency_code not null,
  reference text,
  received_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_payments_order_idx on public.order_payments (order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Favoritos y reseñas
-- ---------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- product_id nulo = opinión general de la tienda
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_name text,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  images text[] not null default '{}',
  status public.review_status not null default 'published',
  verified_purchase boolean not null default false,
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (product_id, user_id)
);

create index reviews_product_idx on public.reviews (product_id, status);

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

create or replace function public.prepare_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.author_name is null then
      select coalesce(full_name, 'Cliente') into new.author_name from public.profiles where id = new.user_id;
    end if;
    new.verified_purchase := new.product_id is not null and exists (
      select 1 from public.orders o
      join public.order_items i on i.order_id = o.id
      where o.customer_id = new.user_id and i.product_id = new.product_id and o.payment_status = 'paid'
    );
    if not public.is_staff() then
      new.status := 'published';
      new.admin_reply := null;
    end if;
  elsif not public.is_staff() then
    new.status := old.status;
    new.admin_reply := old.admin_reply;
    new.verified_purchase := old.verified_purchase;
    new.user_id := old.user_id;
    new.product_id := old.product_id;
  end if;
  return new;
end $$;

create trigger reviews_prepare before insert or update on public.reviews
  for each row execute function public.prepare_review();

create or replace function public.refresh_product_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  if tg_op = 'DELETE' then pid := old.product_id; else pid := new.product_id; end if;
  if pid is not null then
    update public.products p set
      rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.product_id = pid and r.status = 'published'), 0),
      rating_count = (select count(*) from public.reviews r where r.product_id = pid and r.status = 'published')
    where p.id = pid;
  end if;
  return null;
end $$;

create trigger reviews_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- =====================================================================
-- Funciones de negocio
-- =====================================================================

-- Crea un pedido de la tienda o una venta del POS. Los precios se toman
-- siempre de la base de datos; el cliente solo manda variantes y cantidades.
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
  v_total numeric;
  v_paid numeric := 0;
  v_received numeric;
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

  v_total := v_subtotal - v_discount + v_shipping;

  if v_channel = 'pos' then
    if jsonb_array_length(coalesce(p -> 'payments', '[]'::jsonb)) = 0 then
      p := jsonb_set(p, '{payments}', jsonb_build_array(jsonb_build_object(
        'method', v_method, 'amount', v_total, 'currency', v_currency, 'reference', p ->> 'payment_reference')));
    end if;
    for v_pay in select * from jsonb_array_elements(p -> 'payments') loop
      insert into public.order_payments (order_id, method, amount, currency, reference, received_by)
      values (
        v_order_id,
        (v_pay ->> 'method')::public.payment_method,
        (v_pay ->> 'amount')::numeric,
        coalesce((v_pay ->> 'currency')::public.currency_code, v_currency),
        nullif(v_pay ->> 'reference', ''),
        auth.uid()
      );
      v_paid := v_paid + case
        when coalesce((v_pay ->> 'currency')::public.currency_code, v_currency) = v_currency then (v_pay ->> 'amount')::numeric
        when v_currency = 'MXN' then (v_pay ->> 'amount')::numeric * v_rate
        else (v_pay ->> 'amount')::numeric / v_rate
      end;
    end loop;
    if v_paid + 0.01 < v_total then
      raise exception 'El pago está incompleto: faltan %', round(v_total - v_paid, 2);
    end if;
    v_received := nullif(p ->> 'amount_received', '')::numeric;
  end if;

  update public.orders set
    subtotal = v_subtotal,
    discount = v_discount,
    shipping = v_shipping,
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
    'currency', v_result.currency,
    'change_given', v_result.change_given
  );
end $$;

-- Cancela un pedido y regresa el stock. Solo admin, para evitar
-- cancelaciones de ventas ya cobradas desde el POS.
create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_line record;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cancelar pedidos' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_order.status = 'cancelled' then return; end if;

  perform set_config('shoppely.reason', 'cancel', true);
  perform set_config('shoppely.order_id', p_order_id::text, true);
  perform set_config('shoppely.note', coalesce(p_reason, ''), true);

  for v_line in select variant_id, quantity from public.order_items where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock + v_line.quantity where id = v_line.variant_id;
  end loop;

  update public.orders set
    status = 'cancelled',
    payment_status = case when payment_status = 'paid' then 'refunded'::public.payment_status else payment_status end
  where id = p_order_id;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (p_order_id, 'cancelled', p_reason, auth.uid());

  perform set_config('shoppely.reason', '', true);
  perform set_config('shoppely.order_id', '', true);
  perform set_config('shoppely.note', '', true);
end $$;

create or replace function public.update_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_status = 'cancelled' then
    perform public.cancel_order(p_order_id, p_note);
    return;
  end if;
  update public.orders set status = p_status where id = p_order_id and status <> 'cancelled';
  if not found then raise exception 'Pedido no encontrado o cancelado'; end if;
  insert into public.order_status_history (order_id, status, note, changed_by)
  values (p_order_id, p_status, p_note, auth.uid());
end $$;

-- Confirmar pagos por transferencia o efectivo contra entrega.
create or replace function public.mark_order_paid(p_order_id uuid, p_method public.payment_method default null, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_order.payment_status = 'paid' then return; end if;

  update public.orders set
    payment_status = 'paid',
    payment_method = coalesce(p_method, payment_method),
    transfer_reference = coalesce(p_reference, transfer_reference),
    paid_at = now(),
    status = case when status = 'pending' then 'confirmed'::public.order_status else status end
  where id = p_order_id;

  insert into public.order_payments (order_id, method, amount, currency, reference, received_by)
  values (p_order_id, coalesce(p_method, v_order.payment_method), v_order.total, v_order.currency, p_reference, auth.uid());

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (p_order_id, case when v_order.status = 'pending' then 'confirmed'::public.order_status else v_order.status end, 'Pago confirmado', auth.uid());
end $$;

-- Entradas, mermas y ajustes de inventario.
create or replace function public.adjust_stock(p_variant_id uuid, p_change int, p_reason public.movement_reason default 'adjustment', p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_stock int;
begin
  if not public.can_manage_catalog() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform set_config('shoppely.reason', p_reason::text, true);
  perform set_config('shoppely.note', coalesce(p_note, ''), true);
  update public.product_variants set stock = stock + p_change where id = p_variant_id returning stock into v_stock;
  if not found then raise exception 'Variante no encontrada'; end if;
  perform set_config('shoppely.reason', '', true);
  perform set_config('shoppely.note', '', true);
  return v_stock;
exception when check_violation then
  raise exception 'El stock no puede quedar en negativo';
end $$;

-- Conteo físico: fija el stock exacto.
create or replace function public.set_stock(p_variant_id uuid, p_stock int, p_note text default 'Conteo físico')
returns int language plpgsql security definer set search_path = public as $$
declare
  v_current int;
begin
  select stock into v_current from public.product_variants where id = p_variant_id;
  if not found then raise exception 'Variante no encontrada'; end if;
  return public.adjust_stock(p_variant_id, p_stock - v_current, 'adjustment', p_note);
end $$;

create or replace function public.validate_coupon(p_code text, p_subtotal_mxn numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_coupon public.coupons%rowtype;
begin
  select * into v_coupon from public.coupons
  where upper(code) = upper(trim(p_code))
    and active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (max_uses is null or used_count < max_uses);
  if not found then
    return jsonb_build_object('valid', false, 'message', 'Cupón inválido o vencido');
  end if;
  if p_subtotal_mxn < coalesce(v_coupon.min_subtotal_mxn, 0) then
    return jsonb_build_object('valid', false, 'message', format('Compra mínima de $%s MXN', v_coupon.min_subtotal_mxn));
  end if;
  return jsonb_build_object('valid', true, 'code', v_coupon.code, 'kind', v_coupon.kind, 'value', v_coupon.value);
end $$;

-- Seguimiento del pedido sin necesidad de cuenta (link con token).
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'folio', o.folio, 'status', o.status, 'payment_status', o.payment_status,
    'payment_method', o.payment_method, 'currency', o.currency, 'subtotal', o.subtotal,
    'discount', o.discount, 'shipping', o.shipping, 'total', o.total, 'total_mxn', o.total_mxn,
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

-- Estadísticas del dashboard. Costos y ganancias solo se devuelven al admin.
create or replace function public.dashboard_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tz text;
  v_result jsonb;
  v_cost numeric;
  v_net numeric;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select timezone into v_tz from public.store_settings where id = 1;

  create temporary table if not exists _stats_orders on commit drop as
    select * from public.orders where false;
  truncate _stats_orders;
  insert into _stats_orders
    select * from public.orders
    where created_at >= p_from and created_at < p_to
      and status <> 'cancelled' and payment_status = 'paid';

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
    'by_method', coalesce((
      select jsonb_object_agg(method, amount) from (
        select pay.method, round(sum(case when pay.currency = 'MXN' then pay.amount else pay.amount * o.exchange_rate end), 2) amount
        from public.order_payments pay join _stats_orders o on o.id = pay.order_id
        group by pay.method
      ) m), '{}'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select i.product_id, i.product_name, sum(i.quantity) quantity,
               round(sum(i.line_total * case when o.currency = 'MXN' then 1 else o.exchange_rate end), 2) revenue_mxn
        from public.order_items i join _stats_orders o on o.id = i.order_id
        group by i.product_id, i.product_name
        order by sum(i.quantity) desc limit 8
      ) t), '[]'::jsonb),
    'pending_orders', (select count(*) from public.orders where status in ('pending', 'confirmed', 'preparing')),
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
      'margin', case when v_net > 0 then round((v_net - v_cost) / v_net * 100, 1) else 0 end
    );
  end if;

  return v_result;
end $$;

-- Cierre de caja: calcula el efectivo esperado del turno.
create or replace function public.close_cash_session(p_session_id uuid, p_counted_mxn numeric, p_counted_usd numeric default 0, p_notes text default null)
returns public.cash_sessions language plpgsql security definer set search_path = public as $$
declare
  v_session public.cash_sessions%rowtype;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_session from public.cash_sessions where id = p_session_id and status = 'open' for update;
  if not found then raise exception 'Caja no encontrada o ya cerrada'; end if;

  update public.cash_sessions s set
    closed_by = auth.uid(),
    closed_at = now(),
    counted_mxn = p_counted_mxn,
    counted_usd = coalesce(p_counted_usd, 0),
    notes = p_notes,
    status = 'closed',
    expected_mxn = s.opening_mxn
      + coalesce((select sum(pay.amount) from public.order_payments pay join public.orders o on o.id = pay.order_id
                  where o.cash_session_id = s.id and o.status <> 'cancelled' and pay.method = 'cash' and pay.currency = 'MXN'), 0)
      - coalesce((select sum(o.change_given) from public.orders o
                  where o.cash_session_id = s.id and o.status <> 'cancelled' and o.currency = 'MXN'), 0)
      + coalesce((select sum(case when kind = 'in' then amount else -amount end) from public.cash_movements
                  where session_id = s.id and currency = 'MXN'), 0),
    expected_usd = s.opening_usd
      + coalesce((select sum(pay.amount) from public.order_payments pay join public.orders o on o.id = pay.order_id
                  where o.cash_session_id = s.id and o.status <> 'cancelled' and pay.method = 'cash' and pay.currency = 'USD'), 0)
      - coalesce((select sum(o.change_given) from public.orders o
                  where o.cash_session_id = s.id and o.status <> 'cancelled' and o.currency = 'USD'), 0)
      + coalesce((select sum(case when kind = 'in' then amount else -amount end) from public.cash_movements
                  where session_id = s.id and currency = 'USD'), 0)
  where s.id = p_session_id
  returning * into v_session;

  return v_session;
end $$;

-- =====================================================================
-- Seguridad (RLS)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_costs enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.banners enable row level security;
alter table public.coupons enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_costs enable row level security;
alter table public.order_payments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;

-- Perfiles
create policy "profiles: ver el propio" on public.profiles for select using (id = auth.uid());
create policy "profiles: staff ve todos" on public.profiles for select using (public.is_staff());
create policy "profiles: editar el propio" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin edita" on public.profiles for update using (public.is_admin());

-- Configuración
create policy "settings: lectura pública" on public.store_settings for select using (true);
create policy "settings: admin edita" on public.store_settings for update using (public.is_admin());

-- Categorías
create policy "categories: lectura pública" on public.categories for select using (active or public.is_staff());
create policy "categories: catálogo gestiona" on public.categories for all using (public.can_manage_catalog()) with check (public.can_manage_catalog());

-- Productos y variantes
create policy "products: lectura pública" on public.products for select using (active or public.is_staff());
create policy "products: catálogo gestiona" on public.products for all using (public.can_manage_catalog()) with check (public.can_manage_catalog());

create policy "variants: lectura pública" on public.product_variants for select using (
  public.is_staff() or (active and exists (select 1 from public.products p where p.id = product_id and p.active))
);
create policy "variants: catálogo gestiona" on public.product_variants for all using (public.can_manage_catalog()) with check (public.can_manage_catalog());

create policy "costs: solo admin" on public.product_costs for all using (public.is_admin()) with check (public.is_admin());

create policy "movements: catálogo ve" on public.inventory_movements for select using (public.can_manage_catalog());

-- Portada
create policy "banners: lectura pública" on public.banners for select using (
  public.is_staff() or (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()))
);
create policy "banners: admin gestiona" on public.banners for all using (public.is_admin()) with check (public.is_admin());

-- Cupones
create policy "coupons: staff ve" on public.coupons for select using (public.is_staff());
create policy "coupons: admin gestiona" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- Caja
create policy "cash_sessions: staff ve" on public.cash_sessions for select using (public.is_staff());
create policy "cash_sessions: staff abre" on public.cash_sessions for insert with check (public.is_staff() and opened_by = auth.uid());
create policy "cash_movements: staff ve" on public.cash_movements for select using (public.is_staff());
create policy "cash_movements: staff registra" on public.cash_movements for insert with check (public.is_staff() and user_id = auth.uid());

-- Pedidos: se crean y modifican solo con las funciones de arriba
create policy "orders: cliente ve los suyos" on public.orders for select using (customer_id = auth.uid());
create policy "orders: staff ve todos" on public.orders for select using (public.is_staff());
create policy "orders: staff notas" on public.orders for update using (public.is_staff()) with check (public.is_staff());

create policy "order_items: lectura" on public.order_items for select using (
  public.is_staff() or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
create policy "order_item_costs: solo admin" on public.order_item_costs for select using (public.is_admin());
create policy "order_payments: lectura" on public.order_payments for select using (
  public.is_staff() or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
create policy "order_history: lectura" on public.order_status_history for select using (
  public.is_staff() or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);

-- Favoritos
create policy "favorites: propios" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reseñas
create policy "reviews: lectura pública" on public.reviews for select using (status = 'published' or user_id = auth.uid() or public.is_staff());
create policy "reviews: crear propia" on public.reviews for insert with check (user_id = auth.uid());
create policy "reviews: editar propia" on public.reviews for update using (user_id = auth.uid() or public.is_staff());
create policy "reviews: borrar" on public.reviews for delete using (user_id = auth.uid() or public.is_admin());

-- Los vendedores no deben poder tocar totales: limitamos columnas editables en pedidos.
revoke update on public.orders from authenticated;
grant update (internal_notes, notes, shipping_address, customer_name, customer_phone, customer_email) on public.orders to authenticated;

-- =====================================================================
-- Storage: imágenes de productos, banners y reseñas
-- =====================================================================
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media: lectura pública" on storage.objects for select using (bucket_id = 'media');
create policy "media: staff sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_staff());
create policy "media: staff actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_staff());
create policy "media: staff borra" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_staff());
create policy "media: fotos de reseñas" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'reviews'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- =====================================================================
-- Tiempo real: pedidos nuevos y stock en el dashboard / POS
-- =====================================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.product_variants;
