// Env: SITE_URL (e.g. https://voidnodes.xyz/billing), OXAPAY_MERCHANT_KEY, PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV
const { cartTotal } = require('../lib/pricing'), A = require('../lib/auth');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await A.getUser(req).catch(() => null); if (!user) return res.status(401).json({ error: 'Login required' });
  const { items, gateway } = req.body || {}, q = cartTotal(items);
  if (q.error || !(q.total > 0)) return res.status(400).json({ error: q.error || 'Cart is empty' });
  const id = 'VN-' + Date.now().toString(36).toUpperCase(), site = process.env.SITE_URL || `https://${req.headers.host}`;
  try {
    let url;
    if (gateway === 'oxapay') {
      const j = await (await fetch('https://api.oxapay.com/v1/payment/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json', merchant_api_key: process.env.OXAPAY_MERCHANT_KEY }, body: JSON.stringify({ amount: q.total, currency: 'USD', lifetime: 60, order_id: id, email: user.email, description: 'Void Nodes order ' + id, return_url: `${site}/#/orders`, callback_url: `${site}/api/webhook` }) })).json();
      url = j.data?.payment_url; if (!url) throw new Error(j.message || 'OxaPay error');
    } else if (gateway === 'paypal') {
      const base = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
      const t = await (await fetch(base + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' })).json();
      const o = await (await fetch(base + '/v2/checkout/orders', { method: 'POST', headers: { Authorization: 'Bearer ' + t.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: id, amount: { currency_code: 'USD', value: q.total.toFixed(2) } }], payment_source: { paypal: { experience_context: { return_url: `${site}/#/orders`, cancel_url: `${site}/#/cart` } } } }) })).json();
      url = (o.links || []).find((l) => ['payer-action', 'approve'].includes(l.rel))?.href; if (!url) throw new Error('PayPal error');
    } else return res.status(400).json({ error: 'Gateway not available yet (RazorPay coming soon)' });
    await A.db('orders', { method: 'POST', body: { id, user_id: user.id, items, total: q.total, gateway, status: 'pending' } });
    res.json({ id, url });
  } catch (e) { res.status(502).json({ error: e.message }); }
};
