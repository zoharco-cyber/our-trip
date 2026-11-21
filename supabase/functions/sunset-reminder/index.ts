// "עוד שעה מתחילה שקיעה": רצה כל רבע שעה, לפי המיקום האחרון ב"אנחנו כאן".
// שולחת פעם ביום, רק מתחילת הטיול, ורק למי שלא כיבתה את התזכורת.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: loc } = await db.from('location_updates').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!loc) return Response.json({ skip: 'no location' });

  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&daily=sunset&timezone=auto&forecast_days=1`);
  const w = await r.json();
  const localSunset: string | undefined = w?.daily?.sunset?.[0];         // למשל 2026-12-27T18:42 (שעון מקומי)
  const offset: number = w?.utc_offset_seconds ?? 0;
  if (!localSunset) return Response.json({ skip: 'no sunset' });
  const sunsetUtc = new Date(localSunset + ':00Z').getTime() - offset * 1000;
  const localDate = localSunset.slice(0, 10);

  const { data: start } = await db.rpc('trip_start');
  if (start && localDate < start) return Response.json({ skip: 'trip not started' });

  const minutesTo = (sunsetUtc - Date.now()) / 60000;
  if (minutesTo > 62 || minutesTo < 40) return Response.json({ skip: 'not now', minutesTo: Math.round(minutesTo) });

  const { data: sent } = await db.from('settings').select('value').eq('key', 'sunset_sent').maybeSingle();
  if (sent?.value === localDate) return Response.json({ skip: 'already sent' });
  await db.from('settings').upsert({ key: 'sunset_sent', value: localDate });

  const hhmm = localSunset.slice(11, 16);
  const where = loc.name ? ` ב${loc.name.split(',')[0]}` : '';
  const { data: people } = await db.from('profiles').select('id').eq('is_traveler', true);
  const ids = (people || []).map((p) => p.id);
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('sunset', true).in('user_id', ids);
  webpush.setVapidDetails('mailto:trip@our-trip.app', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  let count = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: '🌅 עוד שעה שקיעה', body: `השקיעה${where} ב-${hhmm}. זמן לתפוס מקום טוב ולהוציא את המצלמה 📸`, url: '', tag: 'sunset' }),
        { TTL: 60 * 45 });
      count++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
    }
  }
  return Response.json({ sent: count, sunset: hhmm });
});
