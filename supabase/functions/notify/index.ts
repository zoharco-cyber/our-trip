// התראות על אירועים: אתגר שבוצע, הוצאה חדשה, חלום שהוגשם, עדכון "אנחנו בסדר".
// נקראת מטריגר במסד הנתונים. לא שולחת למי שעשתה את הפעולה.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Person = { id: string; display_name: string; is_traveler: boolean };
type Msg = { title: string; body: string; url: string; to: (u: Person) => boolean };

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const { table, record: r } = await req.json();
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: people } = await db.from('profiles').select('id, display_name, is_traveler');
  const name = (id: string) => (people || []).find((p: Person) => p.id === id)?.display_name.split(' ')[0] || 'מישהי';

  let msg: Msg | null = null;
  if (table === 'challenge_done') {
    const { data: c } = await db.from('challenges').select('title, points').eq('id', r.challenge_id).maybeSingle();
    if (c) msg = { title: '🕵️ אתגר הושלם', body: `${name(r.user_id)} השלימה: ${c.title}! +${c.points}`, url: '#/challenges', to: (u) => u.id !== r.user_id };
  } else if (table === 'expenses') {
    const actor = r.created_by || r.paid_by;
    const among: string[] = r.split_among || [];
    const share = among.length ? Number(r.amount_usd) / among.length : 0;
    msg = {
      title: '💸 הוצאה חדשה',
      body: `${name(r.paid_by)} שילמה: ${r.description} · $${Number(r.amount_usd).toFixed(2)} (החלק שלך $${share.toFixed(2)})`,
      url: '#/money',
      to: (u) => u.id !== actor && among.includes(u.id),
    };
  } else if (table === 'wishes') {
    msg = { title: '🌟 חלום הוגשם!', body: r.text, url: '#/wishes', to: (u) => u.is_traveler && u.id !== r.created_by };
  } else if (table === 'status_updates') {
    msg = { title: `💖 עדכון מ${name(r.created_by)}`, body: r.place ? `${r.message} · ${r.place}` : r.message, url: '', to: (u) => u.id !== r.created_by };
  }
  if (!msg) return Response.json({ sent: 0 });

  const ids = (people || []).filter(msg.to).map((p: Person) => p.id);
  if (!ids.length) return Response.json({ sent: 0 });
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', ids);
  webpush.setVapidDetails('mailto:trip@our-trip.app', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  let sent = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: table }), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
    }
  }
  return Response.json({ sent });
});
