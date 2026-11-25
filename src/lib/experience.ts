import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { VAPID_PUBLIC_KEY } from '../config';

/** "התדריך": חוויית הפתיחה. המסך הגדול (מנהל) מוביל, הטלפונים עוקבים דרך ערוץ Realtime. */
export const SLUG = { ella: 't1', lihi: 't2', lior: 't3' } as const;

export type SceneKind = 'lobby' | 'recruit' | 'finger' | 'hotline' | 'flight' | 'dest' | 'vault' | 'likely' | 'spot' | 'waiting' | 'forget' | 'takeoff' | 'done';
export type Scene = { kind: SceneKind; title: string; q?: string; who?: string; about?: string };

export const LIKELY = ['מי הכי סביר שתאבד את הדרכון?', 'מי תתאהב במקומי?', 'מי תבכה ראשונה מהגעגועים?'];
export const SCENES: Scene[] = [
  { kind: 'lobby', title: 'הלובי' },
  { kind: 'recruit', title: 'הגיוס' },
  { kind: 'finger', title: 'טביעת אצבע' },
  { kind: 'hotline', title: 'קו חם' },
  { kind: 'flight', title: 'מועד ההמראה', who: SLUG.ella },
  { kind: 'dest', title: 'היעד הראשון', who: SLUG.lihi },
  { kind: 'vault', title: 'הכספת', who: SLUG.lior },
  ...LIKELY.map((q) => ({ kind: 'likely' as const, title: 'מי הכי סביר', q })),
  { kind: 'spot', title: 'זרקור', who: SLUG.lior, about: SLUG.lihi, q: 'מה ליהי הכי תתגעגע אליו מהבית?' },
  { kind: 'spot', title: 'זרקור', who: SLUG.ella, about: SLUG.lior, q: 'איזה שיר ליאור תשיר בצעקות באוטובוס?' },
  { kind: 'spot', title: 'זרקור', who: SLUG.lihi, about: SLUG.ella, q: 'מה אלה תקנה בשוק הראשון?' },
  { kind: 'waiting', title: 'למה אני הכי מחכה', q: 'למה את הכי מחכה בטיול?' },
  { kind: 'forget', title: 'החפץ', q: 'מה החפץ שאסור לך לשכוח?' },
  { kind: 'takeoff', title: 'המראה' },
  { kind: 'done', title: 'סוף' },
];

/** מה שהמסך הגדול משדר לכולם */
export type StageState = {
  epoch: number; scene: number;
  joined: string[];                       // מזהי משתמשות שבפנים
  answered: string[];                     // מי ענתה בסצנה הנוכחית
  shared?: Record<string, unknown>;       // מידע שהטלפונים צריכים (תשובת זרקור, נעילות כספת, כשל המראה)
};
export type Answer = { uid: string; scene: number; key?: string; v: any; sim?: boolean };

export const COUNTRIES = [
  { n: 'פרו', c: 'Peru', lat: -12.05, lng: -77.04, city: 'לימה' },
  { n: 'קולומביה', c: 'Colombia', lat: 4.71, lng: -74.07, city: 'בוגוטה' },
  { n: 'ברזיל', c: 'Brazil', lat: -22.9, lng: -43.2, city: 'ריו דה ז׳נרו' },
  { n: 'ארגנטינה', c: 'Argentina', lat: -34.6, lng: -58.38, city: 'בואנוס איירס' },
  { n: 'צ׳ילה', c: 'Chile', lat: -33.45, lng: -70.66, city: 'סנטיאגו' },
  { n: 'בוליביה', c: 'Bolivia', lat: -16.5, lng: -68.15, city: 'לה פאס' },
  { n: 'אקוודור', c: 'Ecuador', lat: -0.18, lng: -78.47, city: 'קיטו' },
  { n: 'מקסיקו', c: 'Mexico', lat: 19.43, lng: -99.13, city: 'מקסיקו סיטי' },
  { n: 'קוסטה ריקה', c: 'Costa Rica', lat: 9.93, lng: -84.08, city: 'סן חוסה' },
];

export type ExpSetting = { active: boolean; epoch: number } | null;
export function useExpSetting() {
  const [s, setS] = useState<ExpSetting | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = () => supabase.from('settings').select('value').eq('key', 'experience').maybeSingle().then(({ data }) => { if (alive) setS((data?.value as ExpSetting) || null); });
    load();
    const v = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', v);
    const t = setInterval(load, 20_000);
    return () => { alive = false; document.removeEventListener('visibilitychange', v); clearInterval(t); };
  }, []);
  return s;
}
export const doneKey = (epoch: number) => `trip:exp:${epoch}`;

/** ערוץ משותף. self:false — לא מקבלים את מה ששלחנו */
export function expChannel(onState: ((s: StageState) => void) | null, onAnswer: ((a: Answer) => void) | null, onJoin: ((uid: string) => void) | null) {
  const ch = supabase.channel('exp-briefing', { config: { broadcast: { self: false } } });
  if (onState) ch.on('broadcast', { event: 'state' }, (m) => onState(m.payload as StageState));
  if (onAnswer) ch.on('broadcast', { event: 'ans' }, (m) => onAnswer(m.payload as Answer));
  if (onJoin) ch.on('broadcast', { event: 'join' }, (m) => onJoin((m.payload as { uid: string }).uid));
  ch.subscribe();
  return ch;
}

const toKey = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

/** הפעלת התראות (כמו בעמוד הבית) + התראת "הקו פעיל" */
export async function enablePush(userId: string): Promise<'on' | 'denied' | 'install' | 'unsupported' | 'error'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS() && !isStandalone() ? 'install' : 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'error';
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) });
    const j = sub.toJSON() as any;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';
    const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, tz, hour: 21, sunset: true, user_id: userId }, { onConflict: 'endpoint' });
    if (error) return 'error';
    await reg.showNotification('🕵️ הסוכנות מאשרת: הקו פעיל', { body: 'מעכשיו נוכל להשיג אותך בכל מקום ביבשת.', dir: 'rtl', lang: 'he', tag: 'hotline' });
    return 'on';
  } catch { return 'error'; }
}
