// OxaPay payment callback. Verify the HMAC header name/algorithm against OxaPay's current docs before going live.
const crypto = require('crypto'), A = require('../lib/auth');
module.exports = async (req, res) => {
  const raw = await new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });
  const sig = crypto.createHmac('sha512', process.env.OXAPAY_MERCHANT_KEY || '').update(raw).digest('hex');
  if (!A.safeEq(sig, String(req.headers.hmac || ''))) return res.status(401).end();
  const b = JSON.parse(raw || '{}');
  if (String(b.status).toLowerCase() === 'paid' && b.order_id) await A.db('orders?id=eq.' + encodeURIComponent(b.order_id), { method: 'PATCH', body: { status: 'paid' } });
  res.json({ ok: true });
};
module.exports.config = { api: { bodyParser: false } };
