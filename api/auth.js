const crypto = require('crypto'), A = require('../lib/auth');
const site = (req) => process.env.SITE_URL || `https://${req.headers.host}`;
const base = (req) => { try { return new URL(site(req)).pathname.replace(/\/$/, ''); } catch { return ''; } };
const jget = async (u, t) => (await fetch(u, { headers: { Authorization: 'Bearer ' + t } })).json();
const P = {
  discord: { field: 'discord_id', auth: 'https://discord.com/oauth2/authorize', token: 'https://discord.com/api/oauth2/token', scope: 'identify email guilds.join', id: 'DISCORD_CLIENT_ID', sec: 'DISCORD_CLIENT_SECRET',
    me: async (t) => { const u = await jget('https://discord.com/api/users/@me', t); return { id: u.id, email: u.verified ? u.email : null, name: u.global_name || u.username }; } },
  google: { field: 'google_id' }, // Google sign-in runs through Supabase Auth (see 'supabase' below)
};
const joinGuild = (uid, token) => fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID || '1554190482588831824'}/members/${uid}`, { method: 'PUT', headers: { Authorization: 'Bot ' + process.env.DISCORD_BOT_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: token }) }).catch(() => {});
const session = (res, u) => { A.setCookie(res, 'vn_session', A.sign({ uid: u.id }, 7 * 864e5), 604800); };
const byEmail = async (e) => (await A.db('users?email=eq.' + encodeURIComponent(e) + '&select=*'))[0];
// Shared by Discord and Google: link to the logged-in user, log in, or create a new account.
async function resolve(st, name, me, req) {
  const pr = P[name], owner = (await A.db(`users?${pr.field}=eq.${encodeURIComponent(me.id)}&select=*`))[0];
  if (st.m === 'link') {
    const cur = await A.getUser(req); if (!cur || cur.id !== st.u) return { error: 'Please log in again' };
    if (owner && owner.id !== cur.id) return { error: `That ${name} account is linked to another user` };
    return { user: (await A.db('users?id=eq.' + cur.id, { method: 'PATCH', body: { [pr.field]: me.id } }))[0] };
  }
  if (owner) return { user: owner };
  if (!me.email) return { error: `Your ${name} account has no verified email` };
  if (await byEmail(me.email.toLowerCase())) return { error: `An account with this email exists. Log in with your password, then link ${name} from Account.` };
  return { user: (await A.db('users', { method: 'POST', body: { email: me.email.toLowerCase(), name: me.name || 'User', [pr.field]: me.id } }))[0] };
}
module.exports = async (req, res) => {
  const a = req.query.a, b = req.body || {}, go = (l) => { res.writeHead(302, { Location: l }); res.end(); };
  try {
    if (a === 'logout') { A.setCookie(res, 'vn_session', '', 0); return res.json({ ok: true }); }
    const miss = ['SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'].filter((k) => !process.env[k]);
    if (miss.length) return res.status(500).json({ error: 'Server not configured: set ' + miss.join(', ') + ' in Vercel' });
    if (a === 'me') return res.json({ user: A.pub(await A.getUser(req)) });
    if (a === 'register' || a === 'login') {
      const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || ''), name = String(b.name || '').trim().slice(0, 40);
      let u = await byEmail(email);
      if (a === 'register') {
        if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 8 || !name) return res.status(400).json({ error: 'Username, valid email and 8+ character password required' });
        if (u) return res.status(409).json({ error: 'Email already registered' });
        [u] = await A.db('users', { method: 'POST', body: { email, name, password_hash: A.hash(pw) } });
      } else if (process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase() && process.env.ADMIN_PASSWORD && A.safeEq(pw, process.env.ADMIN_PASSWORD)) {
        if (!u) [u] = await A.db('users', { method: 'POST', body: { email, name: 'Admin', role: 'admin', password_hash: A.hash(pw) } });
        else if (u.role !== 'admin') [u] = await A.db('users?id=eq.' + u.id, { method: 'PATCH', body: { role: 'admin' } });
      } else if (!u || !A.check(pw, u.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
      session(res, u); return res.json({ user: A.pub(u) });
    }
    if (a === 'oauth') {
      const pr = P[req.query.p]; if (!pr) return res.status(400).json({ error: 'Bad provider' });
      const cur = await A.getUser(req), state = crypto.randomBytes(16).toString('hex');
      A.setCookie(res, 'vn_oauth', A.sign({ s: state, m: req.query.mode === 'link' && cur ? 'link' : 'login', u: cur?.id }, 6e5), 600);
      if (req.query.p === 'google') return go(`${process.env.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(site(req) + '/')}`);
      return go(pr.auth + '?' + new URLSearchParams({ client_id: process.env[pr.id], redirect_uri: `${site(req)}/api/auth/cb-discord`, response_type: 'code', scope: pr.scope, state }));
    }
    if (a === 'supabase') { // the browser posts the access token Supabase put in the URL after Google sign-in
      const st = A.verify(A.cookies(req).vn_oauth); if (!st) return res.status(400).json({ error: 'Login expired, please try again' });
      if (!process.env.SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Server not configured: set SUPABASE_ANON_KEY in Vercel' });
      const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + String(b.access_token || '') } });
      const j = await r.json().catch(() => ({})), idn = (j.identities || []).find((i) => i.provider === 'google');
      if (!r.ok || !idn) return res.status(401).json({ error: 'Google sign-in failed' });
      const d = idn.identity_data || {};
      const out = await resolve(st, 'google', { id: String(d.sub || idn.id), email: d.email_verified === false ? null : (d.email || j.email), name: d.full_name || d.name }, req);
      if (out.error) return res.status(400).json(out);
      session(res, out.user); A.setCookie(res, 'vn_oauth', '', 0); return res.json({ user: A.pub(out.user) });
    }
    if (a === 'cb-discord') {
      const pr = P.discord, st = A.verify(A.cookies(req).vn_oauth), fail = (m) => go(base(req) + '/?auth_error=' + encodeURIComponent(m));
      if (!st || st.s !== req.query.state || !req.query.code) return fail('Login expired, please try again');
      const tr = await (await fetch(pr.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env[pr.id], client_secret: process.env[pr.sec], grant_type: 'authorization_code', code: req.query.code, redirect_uri: `${site(req)}/api/auth/cb-discord` }) })).json();
      if (!tr.access_token) return fail('Provider rejected the login');
      const me = await pr.me(tr.access_token); if (!me.id) return fail('Could not read your profile');
      await joinGuild(me.id, tr.access_token);
      const out = await resolve(st, 'discord', me, req); if (out.error) return fail(out.error);
      session(res, out.user); A.setCookie(res, 'vn_oauth', '', 0); return go(base(req) + '/#/account');
    }
    if (a === 'unlink') {
      const u = await A.getUser(req); if (!u) return res.status(401).json({ error: 'Login required' });
      const pr = P[b.p]; if (!pr) return res.status(400).json({ error: 'Bad provider' });
      const other = Object.values(P).filter((x) => x !== pr && u[x.field]).length;
      if (!u.password_hash && !other) return res.status(400).json({ error: 'Keep at least one way to log in' });
      await A.db('users?id=eq.' + u.id, { method: 'PATCH', body: { [pr.field]: null } }); return res.json({ ok: true });
    }
    res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
