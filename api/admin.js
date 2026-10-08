const A = require('../lib/auth');
module.exports = async (req, res) => {
  const u = await A.getUser(req).catch(() => null); if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  try {
    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.action === 'status') await A.db('services?id=eq.' + +b.id, { method: 'PATCH', body: { status: b.status === 'suspended' ? 'suspended' : 'stopped' } });
      else if (b.action === 'order') await A.db('orders?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', body: { status: b.status === 'paid' ? 'paid' : 'pending' } });
      else if (b.action === 'create') {
        const t = (await A.db('users?email=eq.' + encodeURIComponent(String(b.email).toLowerCase()) + '&select=id'))[0]; if (!t) return res.status(404).json({ error: 'No user with that email' });
        await A.db('services', { method: 'POST', body: { user_id: t.id, name: b.name, type: b.type, panel: b.panel || 'none', vmid: b.vmid || null, spec: b.spec || '', price: +b.price || 0, meta: b.meta || null } });
      } else return res.status(400).json({ error: 'Bad action' });
    }
    const [users, services, orders] = await Promise.all([A.db('users?select=id,email,name,role,discord_id,google_id,created_at&order=created_at.desc'), A.db('services?select=*&order=id.desc'), A.db('orders?select=*&order=created_at.desc&limit=100')]);
    res.json({ users, services, orders, mrr: services.filter((s) => s.status !== 'suspended').reduce((t, s) => t + +s.price, 0) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
