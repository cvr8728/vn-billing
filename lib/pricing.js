// Single source of truth. Catalog is generated from the main site's config (lib/catalog.json). Server recomputes every total.
const CAT = require('./catalog.json');
const CFG = {
  cpu: { min: 1, max: 16, step: 1, price: 2.5 }, ram: { min: 1, max: 64, step: 1, price: 1.5 }, disk: { min: 20, max: 1000, step: 20, price: 0.05 }, ips: { min: 1, max: 8, step: 1, price: 2 },
  ddos: [{ id: 'basic', name: 'Basic L3/4', price: 0 }, { id: 'advanced', name: 'Advanced L7', price: 4 }, { id: 'premium', name: 'Premium Always-On', price: 10 }],
  panel: [{ id: 'none', name: 'VoidNodes Panel (free)', price: 0 }, { id: 'convoy', name: 'ConvoyPanel', price: 5 }],
  bw: { base: 500, max: 10000, step: 100, per100: 1, tiers: [[5000, 0.15], [2500, 0.1], [1000, 0.05], [0, 0]] },
};
const clamp = (v, r) => Math.min(r.max, Math.max(r.min, Math.round(+v / r.step) * r.step || r.min));
const r2 = (n) => Math.round(n * 100) / 100;
function quote(i = {}) {
  if (i.k === 'custom') {
    const s = i.spec || {}, cpu = clamp(s.cpu, CFG.cpu), ram = clamp(s.ram, CFG.ram), disk = clamp(s.disk, CFG.disk), ips = clamp(s.ips, CFG.ips), bw = clamp(s.bw, { min: CFG.bw.base, max: CFG.bw.max, step: CFG.bw.step });
    const dd = CFG.ddos.find((d) => d.id === s.ddos) || CFG.ddos[0], pn = CFG.panel.find((p) => p.id === s.panel) || CFG.panel[0];
    const lines = [{ label: `${cpu} vCPU`, amount: cpu * CFG.cpu.price }, { label: `${ram} GB RAM`, amount: ram * CFG.ram.price }, { label: `${disk} GB NVMe`, amount: disk * CFG.disk.price }];
    if (ips > 1) lines.push({ label: `${ips - 1} extra IPv4`, amount: (ips - 1) * CFG.ips.price });
    lines.push({ label: `DDoS: ${dd.name}`, amount: dd.price }); if (pn.price) lines.push({ label: pn.name, amount: pn.price });
    const extra = ((bw - CFG.bw.base) / 100) * CFG.bw.per100, pct = CFG.bw.tiers.find(([t]) => bw > t)[1];
    if (extra) lines.push({ label: `${bw} GB bandwidth (+${bw - CFG.bw.base})`, amount: extra });
    const sub = lines.reduce((t, l) => t + l.amount, 0), disc = r2(extra * pct);
    return { name: 'Custom VPS', lines: lines.map((l) => ({ ...l, amount: r2(l.amount) })), discountPct: pct, discount: disc, total: r2(sub - disc), spec: { cpu, ram, disk, ips, ddos: dd.id, panel: pn.id, bw } };
  }
  const p = CAT.plans.find((x) => x.id === i.id); if (!p) return { error: 'Unknown plan' };
  return { name: p.name, lines: [{ label: p.name, amount: p.price }], discount: 0, total: p.price };
}
function cartTotal(items) { let t = 0; for (const it of items || []) { const q = quote(it); if (q.error) return { error: q.error }; t += q.total * Math.min(10, Math.max(1, +it.qty || 1)); } return { total: r2(t) }; }
module.exports = { CFG, CAT, quote, cartTotal };
