const A = require('../lib/auth');
module.exports = async (req, res) => {
  const u = await A.getUser(req).catch(() => null); if (!u) return res.status(401).json({ error: 'Login required' });
  const a = req.query.a, b = req.body || {};
  try {
    if (a === 'orders') return res.json({ orders: await A.db('orders?user_id=eq.' + u.id + '&order=created_at.desc&select=*') });
    if (a === 'tickets') return res.json({ tickets: await A.db('tickets?user_id=eq.' + u.id + '&order=id.desc&select=*') });
    if (a === 'ticket') { const s = String(b.subject || '').slice(0, 120), m = String(b.message || '').slice(0, 4000); if (!s || !m) return res.status(400).json({ error: 'Subject and message required' }); await A.db('tickets', { method: 'POST', body: { user_id: u.id, subject: s, message: m } }); return res.json({ ok: true }); }
    res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
