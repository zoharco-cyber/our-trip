// שינוי סיסמה של מטיילת. רק משתמש שמסומן כמנהל יכול להפעיל.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply({ error: 'not_signed_in' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who.user) return reply({ error: 'not_signed_in' }, 401);
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', who.user.id).maybeSingle();
  if (!me?.is_admin) return reply({ error: 'not_admin' }, 403);

  let body: { userId?: string; password?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const pw = (body.password || '').trim();
  if (!body.userId || pw.length < 6) return reply({ error: 'bad_request' }, 400);
  const { data: target } = await admin.from('profiles').select('id').eq('id', body.userId).maybeSingle();
  if (!target) return reply({ error: 'no_such_user' }, 404);

  const { error } = await admin.auth.admin.updateUserById(body.userId, { password: pw });
  if (error) return reply({ error: 'failed' }, 500);
  return reply({ ok: true });
});
