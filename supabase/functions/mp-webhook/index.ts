import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;
const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET');

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function isValidSignature(req: Request, dataId: string) {
  if (!MP_WEBHOOK_SECRET) return true;
  const header = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  return (await hmacSha256Hex(MP_WEBHOOK_SECRET, manifest)) === parts.v1;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await req.json();
  } catch {
    // Algunas notificaciones llegan solo con query params.
  }

  const type = body.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic');
  const paymentId = String(body.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '');
  if (type !== 'payment' || !paymentId) return new Response('ignored', { status: 200 });

  if (!(await isValidSignature(req, url.searchParams.get('data.id') ?? paymentId))) {
    return new Response('invalid signature', { status: 401 });
  }

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!res.ok) return new Response('payment lookup failed', { status: 502 });
  const payment = await res.json();

  const orderId = payment.external_reference as string | undefined;
  if (!orderId) return new Response('no reference', { status: 200 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: order } = await supabase.from('orders').select('id, status, payment_status, total_mxn').eq('id', orderId).single();
  if (!order) return new Response('order not found', { status: 200 });

  if (payment.status === 'approved') {
    if (Number(payment.transaction_amount) + 0.5 < Number(order.total_mxn)) {
      console.error('Monto pagado menor al total del pedido', { orderId, paid: payment.transaction_amount });
      return new Response('amount mismatch', { status: 200 });
    }

    const { data: updated } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        mp_payment_id: paymentId,
        status: order.status === 'pending' ? 'confirmed' : order.status,
      })
      .eq('id', orderId)
      .neq('payment_status', 'paid')
      .select('id, status');

    if (updated && updated.length > 0) {
      await supabase.from('order_payments').insert({
        order_id: orderId,
        method: 'mercadopago',
        amount: payment.transaction_amount,
        currency: 'MXN',
        reference: paymentId,
      });
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: updated[0].status,
        note: 'Pago aprobado en Mercado Pago',
      });
    }
  } else if (['rejected', 'cancelled'].includes(payment.status) && order.payment_status === 'pending') {
    await supabase.from('orders').update({ payment_status: 'failed', mp_payment_id: paymentId }).eq('id', orderId);
  }

  return new Response('ok', { status: 200 });
});
