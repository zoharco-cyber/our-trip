// בדיקה שבועית (יום ראשון בבוקר): שולחת למנהל "הכול תקין" או מה צריך לבדוק.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MB = 1024 * 1024;
const first = (n: string) => n.split(' ')[0];

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: h, error } = await db.rpc('health_report');
  const issues: string[] = [];
  if (error || !h) issues.push('לא הצלחתי להריץ את הבדיקה');
  else {
    if (h.no_push.length) issues.push(`🔕 בלי התראות: ${h.no_push.map(first).join(', ')}`);
    if (h.not_seen.length) issues.push(`😶 לא נכנסו 3 ימים: ${h.not_seen.map((x: { name: string }) => first(x.name)).join(', ')}`);
    const st = h.storage_bytes / (1024 * MB);
    if (st > 0.7) issues.push(`📸 האחסון ${Math.round(st * 100)}% מלא`);
    const dbp = h.db_bytes / (500 * MB);
    if (dbp > 0.7) issues.push(`🗄️ מסד הנתונים ${Math.round(dbp * 100)}% מלא`);
    if (h.cron_failed > 0) issues.push(`⏰ תזכורות שנכשלו השבוע: ${h.cron_failed} (${h.cron_failed_jobs.join(', ')})`);
    if (h.http_failed > 3) issues.push(`📡 ${h.http_failed} שליחות לשרת נכשלו השבוע`);
    if (h.errors_week > 0) issues.push(`🐞 ${h.errors_week} תקלות אוטומטיות השבוע`);
    if (h.reports_open > 0) issues.push(`📩 ${h.reports_open} דיווחים שמחכים לך`);
  }
  const ok = issues.length === 0;
  const result = { at: new Date().toISOString(), ok, issues, report: h || null };
  await db.from('settings').upsert({ key: 'weekly_check', value: result });

  const { data: admins } = await db.from('profiles').select('id').eq('is_admin', true);
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', (admins || []).map((a: { id: string }) => a.id));
  webpush.setVapidDetails('mailto:trip@our-trip.app', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const payload = JSON.stringify({
    title: ok ? '🩺 בדיקה שבועית: הכול תקין ✅' : `🩺 בדיקה שבועית: ${issues.length} ${issues.length === 1 ? 'דבר' : 'דברים'} לבדוק`,
    body: ok ? 'התראות, אחסון, תזכורות ותקלות. הכול עובד.' : issues.join(' · ').slice(0, 220),
    url: '#/admin', tag: 'weekly-check',
  });
  let sent = 0;
  for (const s of subs || []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 }); sent++; }
    catch (e) { const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) await db.from('push_subscriptions').delete().eq('id', s.id); }
  }
  return Response.json({ ok, issues, sent });
});
