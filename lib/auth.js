const crypto = require('crypto');
const b64 = (b) => Buffer.from(b).toString('base64url');
const mac = (b) => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(b).digest('base64url');
const sign = (p, ttl) => { const body = b64(JSON.stringify({ ...p, exp: Date.now() + ttl })); return body + '.' + mac(body); };
const verify = (t) => { try { const [b, s] = String(t).split('.'), e = mac(b); if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null; const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p : null; } catch { return null; } };
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i).trim(), c.slice(i + 1)]; }));
const setCookie = (res, n, v, age) => res.setHeader('Set-Cookie', [].concat(res.getHeader('Set-Cookie') || [], `${n}=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`));
const db = async (path, { method = 'GET', body } = {}) => {
  const k = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(process.env.SUPABASE_URL + '/rest/v1/' + path, { method, headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.message || 'Database error'); return j;
};
const hash = (pw) => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 64).toString('hex'); };
const check = (pw, h) => { if (!h) return false; const [s, k] = h.split(':'), d = crypto.scryptSync(pw, s, 64), kb = Buffer.from(k, 'hex'); return d.length === kb.length && crypto.timingSafeEqual(d, kb); };
const safeEq = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());
const pub = (u) => u && { id: u.id, email: u.email, name: u.name, role: u.role, discord: !!u.discord_id, google: !!u.google_id, hasPassword: !!u.password_hash };
async function getUser(req) { const p = verify(cookies(req).vn_session); if (!p) return null; return (await db('users?id=eq.' + p.uid + '&select=*'))[0] || null; }
module.exports = { sign, verify, cookies, setCookie, db, hash, check, safeEq, pub, getUser };
