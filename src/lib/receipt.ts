import { money, paymentMethodLabel } from './format';
import type { AdminOrder, StoreSettings } from './types';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Ticket de 80 mm. Se imprime desde un iframe oculto para no depender de ventanas emergentes. */
export function printReceipt(order: AdminOrder, settings: StoreSettings | undefined) {
  const m = (n: number) => money(n, order.currency);
  const rows = order.items
    .map((i) => `
      <tr><td colspan="2" class="name">${esc(i.product_name)}${i.variant_name ? ` · ${esc(i.variant_name)}` : ''}</td></tr>
      <tr><td class="muted">${i.quantity} × ${m(i.unit_price)}</td><td class="r">${m(i.line_total)}</td></tr>`)
    .join('');
  const payments = (order.payments?.length ? order.payments : [{ method: order.payment_method, amount: order.total, currency: order.currency, reference: order.transfer_reference }])
    .map((p) => `<tr><td>${paymentMethodLabel[p.method]}${p.reference ? ` <span class="muted">(${esc(p.reference)})</span>` : ''}</td><td class="r">${money(p.amount, p.currency)}</td></tr>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket #${order.folio}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; color: #000; margin: 0; width: 72mm; }
  h1 { font: 700 20px/1 Georgia, serif; letter-spacing: .04em; text-align: center; margin: 0 0 4px; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; } .muted { color: #555; }
  .name { padding-top: 4px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
  .total td { font-size: 15px; font-weight: 700; padding-top: 4px; }
</style></head><body>
  <h1>${esc(settings?.store_name ?? 'Shoppely')}</h1>
  ${settings?.tagline ? `<p class="c muted">${esc(settings.tagline)}</p>` : ''}
  ${settings?.address ? `<p class="c">${esc(settings.address)}</p>` : ''}
  ${settings?.whatsapp ? `<p class="c">WhatsApp ${esc(settings.whatsapp)}</p>` : ''}
  <hr>
  <table>
    <tr><td>Ticket</td><td class="r">#${order.folio}</td></tr>
    <tr><td>Fecha</td><td class="r">${when(order.created_at)}</td></tr>
    ${order.cashier_name ? `<tr><td>Atendió</td><td class="r">${esc(order.cashier_name)}</td></tr>` : ''}
    ${order.customer_name ? `<tr><td>Cliente</td><td class="r">${esc(order.customer_name)}</td></tr>` : ''}
  </table>
  <hr>
  <table>${rows}</table>
  <hr>
  <table>
    <tr><td>Subtotal</td><td class="r">${m(order.subtotal)}</td></tr>
    ${order.discount > 0 ? `<tr><td>Descuento${order.coupon_code ? ` (${esc(order.coupon_code)})` : ''}</td><td class="r">-${m(order.discount)}</td></tr>` : ''}
    ${order.shipping > 0 ? `<tr><td>Envío</td><td class="r">${m(order.shipping)}</td></tr>` : ''}
    ${order.payment_fee > 0 ? `<tr><td>Comisión Mercado Pago</td><td class="r">${m(order.payment_fee)}</td></tr>` : ''}
    <tr class="total"><td>TOTAL</td><td class="r">${m(order.total)}</td></tr>
  </table>
  <hr>
  <table>
    ${payments}
    ${order.amount_received ? `<tr><td>Recibido</td><td class="r">${m(order.amount_received)}</td></tr>` : ''}
    ${order.change_given ? `<tr><td><b>Cambio</b></td><td class="r"><b>${m(order.change_given)}</b></td></tr>` : ''}
  </table>
  <hr>
  <p class="c">¡Gracias por tu compra! 💕</p>
  ${settings?.instagram_url ? '<p class="c muted">Síguenos en Instagram @shoppelystore</p>' : ''}
  <p class="c muted">Conserva tu ticket para cambios.</p>
</body></html>`;

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

export function receiptText(order: AdminOrder, settings: StoreSettings | undefined) {
  const m = (n: number) => money(n, order.currency);
  const lines = [
    `*${settings?.store_name ?? 'Shoppely'}* · Ticket #${order.folio}`,
    when(order.created_at),
    '',
    ...order.items.map((i) => `• ${i.quantity}× ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} — ${m(i.line_total)}`),
    '',
    ...(order.discount > 0 ? [`Descuento: -${m(order.discount)}`] : []),
    ...(order.payment_fee > 0 ? [`Comisión Mercado Pago: ${m(order.payment_fee)}`] : []),
    `*Total: ${m(order.total)}*`,
    `Pago: ${paymentMethodLabel[order.payment_method]}`,
    ...(order.change_given ? [`Cambio: ${m(order.change_given)}`] : []),
    '',
    '¡Gracias por tu compra! 💕',
  ];
  return lines.join('\n');
}
