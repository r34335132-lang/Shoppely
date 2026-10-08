import { createClient } from 'npm:@supabase/supabase-js@2';

// Sin imports locales: así el archivo también se puede pegar tal cual en el editor del dashboard de Supabase.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://shoppely.vercel.app').replace(/\/$/, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!MP_ACCESS_TOKEN) return json({ error: 'Mercado Pago no está configurado' }, 500);

  try {
    const { token } = await req.json();
    if (!token) return json({ error: 'Falta el pedido' }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, folio, public_token, status, payment_status, payment_method, currency, exchange_rate, payment_fee, total_mxn, customer_name, customer_email, order_items(product_name, variant_name, quantity)')
      .eq('public_token', token)
      .single();

    if (error || !order) return json({ error: 'Pedido no encontrado' }, 404);
    if (order.payment_method !== 'mercadopago') return json({ error: 'Este pedido no se paga con Mercado Pago' }, 400);
    if (order.payment_status === 'paid') return json({ error: 'Este pedido ya está pagado' }, 400);
    if (order.status === 'cancelled') return json({ error: 'Este pedido fue cancelado' }, 400);

    const description = (order.order_items ?? [])
      .map((i: { product_name: string; variant_name: string | null; quantity: number }) =>
        `${i.quantity}x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`)
      .join(', ')
      .slice(0, 250);

    const orderUrl = `${SITE_URL}/pedido/${order.public_token}`;

    // Mercado Pago México cobra en MXN; los pedidos en USD usan su equivalente guardado en total_mxn.
    const totalMxn = Number(order.total_mxn);
    const feeMxn = Math.min(
      Math.round(Number(order.payment_fee ?? 0) * (order.currency === 'MXN' ? 1 : Number(order.exchange_rate)) * 100) / 100,
      totalMxn,
    );
    const items = [{
      id: String(order.folio),
      title: `Pedido Shoppely #${order.folio}`,
      description,
      quantity: 1,
      unit_price: Math.round((totalMxn - feeMxn) * 100) / 100,
      currency_id: 'MXN',
    }];
    if (feeMxn > 0) {
      items.push({
        id: `${order.folio}-comision`,
        title: 'Comisión por pago con Mercado Pago',
        description: 'Cargo por procesar el pago con tarjeta o saldo de Mercado Pago',
        quantity: 1,
        unit_price: feeMxn,
        currency_id: 'MXN',
      });
    }

    const preference: Record<string, unknown> = {
      items,
      external_reference: order.id,
      payer: { name: order.customer_name ?? undefined, email: order.customer_email ?? undefined },
      back_urls: { success: orderUrl, pending: orderUrl, failure: orderUrl },
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      statement_descriptor: 'SHOPPELY',
    };
    // Mercado Pago rechaza auto_return con URLs que no son https (por ejemplo localhost).
    if (SITE_URL.startsWith('https://')) preference.auto_return = 'approved';

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference),
    });
    const pref = await res.json();
    if (!res.ok) {
      console.error('Mercado Pago error', pref);
      return json({ error: 'No se pudo crear el pago en Mercado Pago' }, 502);
    }

    await supabase.from('orders').update({ mp_preference_id: pref.id }).eq('id', order.id);

    return json({ id: pref.id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point });
  } catch (err) {
    console.error(err);
    return json({ error: 'Error inesperado' }, 500);
  }
});
