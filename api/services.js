const A = require('../lib/auth');
module.exports = async (req, res) => {
  const u = await A.getUser(req).catch(() => null); if (!u) return res.status(401).json({ error: 'Login required' });
  res.json({ services: await A.db('services?user_id=eq.' + u.id + '&order=id.desc&select=*') });
};
