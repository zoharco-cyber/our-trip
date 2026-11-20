// תזכורת לתרופות: רצה כל רבע שעה, ושולחת התראה פרטית בשעות שכל אחת קבעה לעצמה.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

function localNow(tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails('mailto:trip@our-trip.app', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const { data: meds } = await db.from('meds').select('*').eq('active', true);
  let sent = 0;
  for (const m of meds || []) {
    let tz = m.tz; try { localNow(tz); } catch { tz = 'America/Lima'; }
    const { date, minutes } = localNow(tz);
    // השעה האחרונה שהגיעה ב-20 הדקות האחרונות
    const due = (m.times as string[]).filter((t) => {
      const [h, mi] = t.split(':').map(Number);
      const d = minutes - (h * 60 + mi);
      return d >= 0 && d < 20;
    });
    for (const t of due) {
      const slot = `${date} ${t}`;
      if (m.last_sent === slot) continue;
      const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', m.user_id);
      for (const s of subs || []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: '💊 תזכורת', body: `הגיע הזמן: ${m.name}`, url: '#/meds', tag: `med-${m.id}` }), { TTL: 60 * 60 * 2 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
      await db.from('meds').update({ last_sent: slot }).eq('id', m.id);
    }
  }
  return Response.json({ sent });
});
