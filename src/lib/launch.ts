import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** מועד ההשקה (המנהל קובע). null = אין השקה, האתר פתוח */
export function useLaunchAt() {
  const [at, setAt] = useState<number | null>(() => { try { const v = localStorage.getItem('trip:launch'); return v ? Number(v) : null; } catch { return null; } });
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'launch_at').maybeSingle().then(({ data }) => {
      const t = data?.value ? new Date(data.value).getTime() : null;
      setAt(t);
      try { if (t) localStorage.setItem('trip:launch', String(t)); else localStorage.removeItem('trip:launch'); } catch { /* ignore */ }
    });
  }, []);
  return at;
}

/** סאונד בלי קבצים: פעימת לב, בום, חותמת וניצוץ. צריך לחיצה אחת כדי שהדפדפן ירשה צליל. */
export function makeSound() {
  let ctx: AudioContext | null = null;
  const get = () => {
    if (!ctx) { const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  const thump = (c: AudioContext, t: number, f: number, vol: number, len = 0.22) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + len + 0.05);
  };
  const noise = (c: AudioContext, t: number, len: number, vol: number, hp = 800) => {
    const b = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.buffer = b;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  };
  return {
    unlock() { const c = get(); if (c) thump(c, c.currentTime, 40, 0.0002, 0.05); },
    /** "לאב-דאב" — מתחזק ככל שמתקרבים לאפס (0..1) */
    beat(strength = 0.5) {
      const c = get(); if (!c) return; const t = c.currentTime;
      thump(c, t, 62, 0.35 + strength * 0.55); thump(c, t + 0.16, 52, 0.22 + strength * 0.4);
    },
    boom() {
      const c = get(); if (!c) return; const t = c.currentTime;
      thump(c, t, 70, 1, 1.4); noise(c, t, 1.2, 0.35, 200);
      [880, 1175, 1568, 2093].forEach((f, i) => { // ניצוץ עולה
        const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + 0.25 + i * 0.09); g.gain.exponentialRampToValueAtTime(0.12, t + 0.27 + i * 0.09); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 + i * 0.09);
        o.connect(g).connect(c.destination); o.start(t + 0.25 + i * 0.09); o.stop(t + 1.4 + i * 0.09);
      });
    },
    stamp() { const c = get(); if (!c) return; const t = c.currentTime; thump(c, t, 120, 0.6, 0.12); noise(c, t, 0.08, 0.25, 1500); },
    chime() {
      const c = get(); if (!c) return; const t = c.currentTime;
      [1047, 1319, 1568].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.08); g.gain.exponentialRampToValueAtTime(0.2, t + i * 0.08 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.9);
        o.connect(g).connect(c.destination); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 1); });
    },
  };
}

export const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* ignore */ } };

/** אות למסך הבמה: "נכנסתי!" (Realtime broadcast, בלי מסד נתונים) */
const CH = 'launch-stage';
export async function announceArrival(p: { id: string; name: string; color: string }) {
  const ch = supabase.channel(CH, { config: { broadcast: { ack: true } } });
  await new Promise<void>((res) => {
    const t = setTimeout(res, 4000);
    ch.subscribe((s) => { if (s === 'SUBSCRIBED') { clearTimeout(t); res(); } });
  });
  try { await ch.send({ type: 'broadcast', event: 'arrived', payload: p }); } catch { /* ignore */ }
  setTimeout(() => supabase.removeChannel(ch), 1500);
}
export function onArrival(cb: (p: { id: string; name: string; color: string }) => void) {
  const ch = supabase.channel(CH).on('broadcast', { event: 'arrived' }, (m) => cb(m.payload as any)).subscribe();
  return () => { supabase.removeChannel(ch); };
}
