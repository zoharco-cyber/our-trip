import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { VAPID_PUBLIC_KEY } from '../config';

const toKey = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

type State = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

/** הפעלה וכיבוי של התזכורת היומית ליומן */
export default function Reminder() {
  const { me } = useAuth();
  const [state, setState] = useState<State>('loading');
  const [hour, setHour] = useState(21);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'); return;
      }
      if (Notification.permission === 'denied') { setState('denied'); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const { data } = await supabase.from('push_subscriptions').select('hour').eq('endpoint', sub.endpoint).maybeSingle();
          if (data) { setHour(data.hour); setState('on'); return; }
        }
      } catch { /* ignore */ }
      setState('off');
    })();
  }, []);

  async function enable() {
    if (!me) return;
    setBusy(true); setErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); setBusy(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) });
      const j = sub.toJSON() as any;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';
      const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, tz, hour, user_id: me.id }, { onConflict: 'endpoint' });
      if (error) throw error;
      await reg.showNotification('ההתראות הופעלו 💖', { body: me.is_traveler ? `תזכורת ליומן כל ערב ב-${hour}:00, ועדכונים מהבנות.` : 'תקבל הודעה כשהבנות שולחות עדכון.', dir: 'rtl', lang: 'he', tag: 'journal' });
      setState('on');
    } catch {
      setErr('לא הצלחתי להפעיל. בדקי חיבור לאינטרנט ונסי שוב.');
    }
    setBusy(false);
  }
  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    } catch { /* ignore */ }
    setState('off'); setBusy(false);
  }
  async function changeHour(h: number) {
    setHour(h);
    if (state !== 'on') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await supabase.from('push_subscriptions').update({ hour: h, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }).eq('endpoint', sub.endpoint);
  }

  if (state === 'loading' || !me) return null;
  const traveler = me.is_traveler;
  return (
    <section className={'card reminder' + (state === 'on' ? ' on' : '')}>
      <div className="row-between">
        <b>🔔 התראות</b>
        {state === 'on' && <span className="pill on-pill">פעילה</span>}
      </div>
      {state === 'ios-install' && <p className="small">באייפון, התראות עובדות רק כשהאתר מותקן: בספארי לוחצים על כפתור השיתוף ⬆️, בוחרים "הוספה למסך הבית", ופותחים את האתר מהאייקון. ואז חוזרים לכאן.</p>}
      {state === 'unsupported' && <p className="small muted">הדפדפן הזה לא תומך בהתראות. נסי מכרום, או מהאייקון במסך הבית.</p>}
      {state === 'denied' && <p className="small muted">ההתראות חסומות לאתר הזה. אפשר לאפשר אותן בהגדרות הטלפון, תחת ההגדרות של האתר או הדפדפן.</p>}
      {(state === 'off' || state === 'on') && (
        <>
          <p className="small">{traveler ? 'תזכורת ליומן, ועדכונים כשמישהי משלימה אתגר, מוסיפה הוצאה עלייך, מגשימה חלום או שולחת עדכון הביתה.' : 'עדכונים כשהבנות שולחות "עדכון לבית", משלימות אתגר או מגשימות חלום.'}</p>
          {traveler && <div className="row gap wrap small">
            <span>תזכורת ליומן כל ערב בשעה</span>
            <select id="rem-hour" value={hour} onChange={(e) => changeHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
            <span className="muted">(רק אם עוד לא כתבת)</span>
          </div>}
          {state === 'off'
            ? <button className="btn btn-primary" disabled={busy} onClick={enable}>{busy ? 'מפעילה…' : 'הפעלת התראות'}</button>
            : <button className="btn btn-small" disabled={busy} onClick={disable}>כיבוי</button>}
        </>
      )}
      {err && <p className="error">{err}</p>}
    </section>
  );
}
