const A = require('../lib/auth');
module.exports = async (req, res) => {
  const u = await A.getUser(req).catch(() => null); if (!u) return res.status(401).json({ error: 'Login required' });
  const { id, action } = req.body || {}, to = { start: 'running', stop: 'stopped', reboot: 'running' };
  if (action === 'reinstall') return res.status(501).json({ error: 'Reinstall is not wired yet (connect your Proxmox template-clone flow)' });
  if (!to[action]) return res.status(400).json({ error: 'Bad action' });
  const s = (await A.db('services?id=eq.' + +id + (u.role === 'admin' ? '' : '&user_id=eq.' + u.id) + '&select=*'))[0];
  if (!s || s.type !== 'vps') return res.status(404).json({ error: 'Service not found' });
  if (s.status === 'suspended') return res.status(403).json({ error: 'Service suspended - contact support' });
  if (s.panel === 'convoy') return res.status(400).json({ error: 'Manage this VPS in ConvoyPanel' });
  if (process.env.PROXMOX_URL) {
    const r = await fetch(`${process.env.PROXMOX_URL}/api2/json/nodes/${process.env.PROXMOX_NODE}/qemu/${+s.vmid}/status/${action}`, { method: 'POST', headers: { Authorization: 'PVEAPIToken=' + process.env.PROXMOX_TOKEN } });
    if (!r.ok) return res.status(502).json({ error: 'Proxmox rejected the request' });
  }
  await A.db('services?id=eq.' + s.id, { method: 'PATCH', body: { status: to[action] } }); res.json({ ok: true });
};
