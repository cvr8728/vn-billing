const { CFG, CAT, quote } = require('../lib/pricing');
module.exports = (req, res) => {
  if (req.method === 'GET') return res.json({ catalog: CAT, custom: CFG });
  const q = quote(req.body || {}); res.status(q.error ? 400 : 200).json(q);
};
