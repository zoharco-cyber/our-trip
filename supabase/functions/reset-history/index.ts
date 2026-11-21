// איפוס היסטוריה: רק המנהל, ורק אחרי 2 תשובות נכונות מתוך מאגר השאלות.
// התשובות שמורות כ-hash. אחרי 3 טעויות בתוך 10 דקות, נעילה ל-10 דקות.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });

export const normalize = (s: string) => s.normalize('NFKC').toLowerCase()
  .replace(/[֑-ׇ]/g, '')            // ניקוד
  .replace(/["'`׳״.,!?\-_()]/g, '')
  .replace(/\s+/g, ' ').trim();
async function hash(s: string) {
  const data = new TextEncoder().encode((Deno.env.get('RESET_SALT') || '') + normalize(s));
  const d = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// כל מה שהבנות מוסיפות בעצמן
const WIPE = ['transfers', 'expenses', 'shopping_items', 'wishes', 'documents', 'capsule_entries', 'stories', 'photos', 'places',
  'destination_tips', 'gear_checks', 'location_updates', 'status_updates', 'journal_entries', 'daily_answers', 'bookings', 'contacts',
  'challenge_done', 'songs', 'meds', 'bag_items', 'wifi_passwords', 'quiz_results', 'medical_cards', 'pretrip_done'];

async function listAll(db: any, bucket: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  for (const f of data || []) {
    const path = prefix ? `${prefix}/${f.name}` : f.name;
    if (f.id) out.push(path); else out.push(...(await listAll(db, bucket, path)));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await db.auth.getUser(token);
  if (!who?.user) return reply({ error: 'not_signed_in' }, 401);
  const { data: me } = await db.from('profiles').select('is_admin').eq('id', who.user.id).maybeSingle();
  if (!me?.is_admin) return reply({ error: 'not_admin' }, 403);

  let body: { action?: string; answers?: { id: number; answer: string }[] } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  // נעילה אחרי 3 טעויות ב-10 דקות
  const { data: f } = await db.from('settings').select('value').eq('key', 'reset_fails').maybeSingle();
  const fails: number[] = (Array.isArray(f?.value) ? f!.value : []).filter((t: number) => Date.now() - t < 10 * 60e3);
  if (fails.length >= 3) return reply({ error: 'locked', minutes: Math.ceil((10 * 60e3 - (Date.now() - Math.min(...fails))) / 60e3) }, 429);

  if (body.action === 'start') {
    const { data: qs } = await db.from('reset_questions').select('id, question');
    if (!qs || qs.length < 2) return reply({ error: 'no_questions' }, 400);
    const pick = [...qs].sort(() => Math.random() - 0.5).slice(0, 2);
    return reply({ questions: pick });
  }

  if (body.action === 'reset') {
    const ans = body.answers || [];
    const ids = [...new Set(ans.map((a) => a.id))];
    if (ids.length !== 2) return reply({ error: 'bad_request' }, 400);
    const { data: qs } = await db.from('reset_questions').select('id, answer_hash').in('id', ids);
    let ok = (qs || []).length === 2;
    for (const a of ans) {
      const q = (qs || []).find((x) => x.id === a.id);
      if (!q || q.answer_hash !== (await hash(a.answer || ''))) ok = false;
    }
    if (!ok) {
      await db.from('settings').upsert({ key: 'reset_fails', value: [...fails, Date.now()] });
      return reply({ error: 'wrong', left: Math.max(0, 2 - fails.length) }, 403);
    }
    await db.from('settings').upsert({ key: 'reset_fails', value: [] });

    // 1. קבצים: מסמכים, ותמונות חוץ מתמונות דף הבית
    const docFiles = await listAll(db, 'documents');
    const photoFiles = (await listAll(db, 'photos')).filter((p) => !p.startsWith('home/'));
    for (let i = 0; i < docFiles.length; i += 100) await db.storage.from('documents').remove(docFiles.slice(i, i + 100));
    for (let i = 0; i < photoFiles.length; i += 100) await db.storage.from('photos').remove(photoFiles.slice(i, i + 100));

    // 2. כל מה שהבנות הוסיפו
    const counts: Record<string, number> = {};
    for (const t of WIPE) {
      const { count } = await db.from(t).delete({ count: 'exact' }).not(t === 'gear_checks' ? 'item_id' : t === 'challenge_done' ? 'challenge_id' : t === 'pretrip_done' ? 'task_id' : t === 'quiz_results' || t === 'medical_cards' ? 'user_id' : 'id', 'is', null);
      counts[t] = count || 0;
    }
    await db.from('events').delete().not('created_by', 'is', null);

    // 3. הרשימות חוזרות למצב ההתחלתי
    const { data: sc } = await db.from('seed_challenges').select('*');
    const { data: sg } = await db.from('seed_gear').select('*');
    const { data: sp } = await db.from('seed_pretrip').select('*');
    await db.from('challenges').delete().not('id', 'is', null);
    await db.from('gear_items').delete().not('id', 'is', null);
    await db.from('pretrip_tasks').delete().not('id', 'is', null);
    if (sc?.length) await db.from('challenges').insert(sc);
    if (sg?.length) await db.from('gear_items').insert(sg.map((g: any) => ({ ...g, created_by: null })));
    if (sp?.length) await db.from('pretrip_tasks').insert(sp.map((p: any) => ({ ...p, created_by: null })));

    // 4. הגדרות וסכומים
    await db.from('profiles').update({ initial_budget_usd: 0 }).not('id', 'is', null);
    await db.from('settings').upsert([{ key: 'capsule_open', value: false }, { key: 'sunset_sent', value: null }]);
    const { count: ev } = await db.from('events').select('id', { count: 'exact', head: true });
    if (!ev) await db.from('events').insert({ title: 'טיסה ראשונה', starts_at: '2026-12-22T00:00:00+02:00', created_by: null });

    return reply({ ok: true, files: docFiles.length + photoFiles.length, counts });
  }
  return reply({ error: 'bad_request' }, 400);
});
