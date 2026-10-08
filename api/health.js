// Open /billing/api/health to see which settings are missing (shows true/false only, never values).
const A = require('../lib/auth');
module.exports = async (req, res) => {
  const env = Object.fromEntries(['SITE_URL', 'SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_ANON_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN', 'OXAPAY_MERCHANT_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_SECRET', 'PROXMOX_URL', 'PROXMOX_TOKEN'].map((k) => [k, !!process.env[k]]));
  let db = 'not configured';
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) { try { await A.db('users?select=id&limit=1'); db = 'ok'; } catch (e) { db = /relation|schema cache|does not exist/i.test(e.message) ? 'tables missing - run schema.sql' : 'cannot connect - check SUPABASE_URL / key'; } }
  res.json({ env, db });
};
