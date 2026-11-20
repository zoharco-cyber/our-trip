// תזכורת יומית ליומן המסע. רצה כל שעה (pg_cron), ושולחת התראה
// למי שהגיעה אצלה השעה שבחרה (לפי אזור הזמן שלה) ועוד לא כתבה היום.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MESSAGES = [
  'איך היה היום? משפט אחד ליומן ✨',
  'היומן מחכה לך 💖 מה היה הכי מצחיק היום?',
  'רגע לפני שנרדמות: מצב רוח ומשפט אחד ליומן 🌙',
  'עוד יום של הרפתקאות! לא לשכוח לכתוב ביומן 🦙',
];

function prevDay(date: string) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function localParts(tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const url = new URL(req.url);
  const test = url.searchParams.get('test') === '1';

  webpush.setVapidDetails('mailto:trip@our-trip.app', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: subs } = await db.from('push_subscriptions').select('*');
  const { data: start } = await db.rpc('trip_start');  // אין תזכורות לפני שהטיול התחיל
  let sent = 0, skipped = 0, removed = 0;
  const { data: people } = await db.from('profiles').select('id, display_name, is_traveler');
  const firstName = (id: string) => (people || []).find((p) => p.id === id)?.display_name.split(' ')[0] || '';
  const yesterdayCache = new Map<string, string>();
  async function yesterdayLine(date: string) {
    const y = prevDay(date);
    if (!yesterdayCache.has(y)) {
      const { data } = await db.from('journal_entries').select('created_by, mood').eq('day', y);
      const parts = (data || []).map((e) => `${firstName(e.created_by)} ${e.mood || '✍️'}`).filter((x) => x.trim());
      yesterdayCache.set(y, parts.length ? `אתמול: ${parts.join(', ')}. ומה היה היום? ✨` : '');
    }
    return yesterdayCache.get(y)!;
  }

  for (const s of subs || []) {
    if (!(people || []).find((p) => p.id === s.user_id)?.is_traveler) { skipped++; continue; }
    let tz = s.tz;
    try { localParts(tz); } catch { tz = 'America/Lima'; }
    const { date, hour } = localParts(tz);
    if (!test && (hour !== s.hour || s.last_sent === date || (start && date < start))) { skipped++; continue; }
    const { count } = await db.from('journal_entries').select('id', { count: 'exact', head: true }).eq('created_by', s.user_id).eq('day', date);
    if (!test && (count || 0) > 0) { skipped++; continue; }
    const line = await yesterdayLine(date);
    const body = JSON.stringify({
      title: 'יומן המסע 📔',
      body: line || MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
      url: '#/journal',
    });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 6 });
      await db.from('push_subscriptions').update({ last_sent: date }).eq('id', s.id);
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('id', s.id); removed++; }
    }
  }
  return Response.json({ sent, skipped, removed });
});
