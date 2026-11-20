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

const QUESTIONS: string[] = ["מה הדבר הכי מוזר שאכלת היום?", "מה הצחיק אותך הכי הרבה היום?", "אם היום היה שיר, איזה שיר הוא היה?", "מה היית מספרת לעצמך של לפני שבוע?", "מי האדם הכי מעניין שפגשת היום?", "מה הריח שתזכרי מהיום?", "תני ציון ליום מ-1 עד 10 ותסבירי במשפט", "מה היה הרגע הכי מפחיד היום?", "מה למדת היום על עצמך?", "על מה את הכי מתגעגעת מהבית כרגע?", "מה המילה בספרדית שלמדת היום?", "איזה רגע היית רוצה לצלם ולא צילמת?", "מה הדבר הכי יפה שראית היום?", "מה היית משנה בהיום אם היית יכולה?", "מי מהבנות הצחיקה אותך היום ובמה?", "מה התוכנית שלך למחר בשלוש מילים?", "מה הדבר הכי זול ששווה הכי הרבה שקנית?", "איזה טעם יישאר לך מהיום?", "מה הייתה הנסיעה הכי משעממת או הכי יפה היום?", "אם היית נשארת כאן עוד שבוע, מה היית עושה?", "מה הדבר שהכי הפתיע אותך במדינה הזו?", "איזו מחמאה קיבלת או נתת היום?", "מה המקום הכי טוב שישנת בו עד עכשיו?", "מה היית ממליצה לחברה שמגיעה לכאן?", "מה גרם לך להרגיש בבית היום?", "איזה חיה ראית היום?", "מה הדבר הכי ספונטני שעשית היום?", "מה את מצפה לו הכי הרבה בהמשך הטיול?", "מה הכותרת של היום הזה בעיתון?", "איזה רגע היום היית רוצה לחיות שוב?", "מה הדבר הראשון שעשית כשהתעוררת היום?", "איזה רגע היום הרגיש כמו סרט?", "מה הדבר הכי טעים ששתית היום?", "מה עלה לך יותר ממה שציפית?", "מה היה זול להפתיע?", "איזו מילה מקומית תיקחי איתך הביתה?", "מה הייתה הטעות הכי מצחיקה שלך היום?", "מי עזר לכן היום ואיך?", "מה הנוף שהיית שמה כרקע לטלפון?", "איזה ריח הזכיר לך את הבית?", "אם היית צריכה לתת להיום שם, מה הוא היה?", "מה גרם לך לצחוק עד דמעות?", "על מה התווכחתן היום, ומי צדקה?", "מה הדבר הכי אמיץ שעשית היום?", "מה היית רוצה לספר להורים מהיום?", "איזה מאכל מקומי היית מביאה לישראל?", "מה ראית היום שלא ראית אף פעם?", "איזה צבע מתאר את היום?", "מה היה הרגע הכי שקט היום?", "מה הדבר שהכי חסר לך בתיק?", "מה הכי הפתיע אותך באנשים כאן?", "איזה הרגל חדש פיתחת בטיול?", "מה היה הרגע שבו הרגשת הכי רחוק מהבית?", "מה הדבר הכי מוזר שראית ברחוב היום?", "מה היית עושה אם היה לך עוד 100 דולר היום?", "מה הצליל שהכי נשאר לך מהיום?", "איזו מחשבה לא עזבה אותך היום?", "מה למדת מאחת הבנות היום?", "מה היה האוכל הכי פחות טעים היום? 😅", "איזה מקום היום היית חוזרת אליו בעוד 10 שנים?", "מה הייתה ההחלטה הכי טובה של היום?", "מה הייתה ההחלטה הכי גרועה של היום? 🙈", "מה הדבר הכי חמוד שראית היום?", "באיזה רגע היום היית רוצה לעצור את הזמן?", "מה החלום הכי מטורף שחלמת בטיול?", "מה היית אומרת לעצמך ביום הראשון של הטיול?", "מה היה הרגע הכי מתוק בין הבנות היום?", "איזה אתגר של זוהר הכי מתחשק לך לעשות מחר?", "מה הדבר הכי ישראלי שעשית היום?", "באיזה רגע היום הרגשת הכי חופשייה?", "מה הדבר שהכי קשה לך בטיול עד עכשיו?", "מה הדבר שהכי קל לך בטיול?", "איזה סיפור תספרי עוד שנים מהיום הזה?", "מה למדת על התרבות המקומית היום?", "מה הדבר הכי טוב שקנית בטיול עד עכשיו?", "אם היית יכולה להזמין מישהו להצטרף מחר, מי זה היה?", "מה הפרט הקטן מהיום שאף אחד לא שם לב אליו?", "מה היה מזג האוויר הרגשי שלך היום?", "איזה שיר היה מתאים לרגע הכי טוב של היום?", "מה עשית היום בפעם הראשונה בחיים?", "מה הדבר הכי מצחיק שמישהו אמר היום?", "מה הייתה הנסיעה הכי יפה עד עכשיו?", "מה הפחד שהתגברת עליו בטיול?", "איזה מקום מפתיע את לא מפסיקה לחשוב עליו?", "מה הדבר שהכי שמח אותך היום בלי סיבה?", "מה ההבדל בינך של היום לבינך של לפני הטיול?", "מה היה הרגע הכי אדרנלין עד עכשיו?", "מה המקום הכי יפה שישנת בו?", "מה היית מוותרת עליו בשביל עוד שבוע בטיול?", "מה הדבר שהכי מצחיק אותך במדינה הזו?", "איזו שאלה היית רוצה לשאול מקומי ועוד לא שאלת?", "מה המחמאה הכי טובה שהיית נותנת לעצמך היום?", "מה הדבר שאת הכי גאה בו בטיול עד עכשיו?", "מה תרצי לזכור מהיום עוד שנה?", "מה הזיכרון הכי טוב שלך עד עכשיו מהטיול?", "איזה רגע היום היה שווה את כל הנסיעה?", "מה הייתה הארוחה הכי טובה בטיול עד עכשיו?", "על מה את מודה היום?", "מה הדבר הבא ברשימת החלומות שלך?", "במשפט אחד: למה הטיול הזה מיוחד?"];
function questionFor(day: string) {
  const n = Math.floor(new Date(day + 'T12:00:00Z').getTime() / 864e5);
  return QUESTIONS[((n % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length];
}
const QUESTION_HOUR = 18;  // שאלת היום נשלחת ב-18:00 לפי השעון המקומי

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
    // שאלת היום: פעם ביום ב-18:00, רק אם עוד לא ענתה (התשובה לא חובה)
    if (!test && hour === QUESTION_HOUR && s.question_sent !== date && !(start && date < start)) {
      const { count: answered } = await db.from('daily_answers').select('id', { count: 'exact', head: true }).eq('created_by', s.user_id).eq('day', date);
      if (!answered) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: '❓ שאלת היום', body: questionFor(date) + ' (לא חובה לענות 😉)', url: '#/journal', tag: 'question' }), { TTL: 60 * 60 * 4 });
          await db.from('push_subscriptions').update({ question_sent: date }).eq('id', s.id);
          sent++;
        } catch { /* ננסה מחר */ }
      }
    }
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
