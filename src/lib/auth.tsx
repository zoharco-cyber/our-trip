import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from './supabase';
import type { Profile } from './types';
import { EMAIL_DOMAIN } from '../config';

type AuthState = {
  ready: boolean;
  session: Session | null;
  guest: boolean;
  me: Profile | null;
  profiles: Profile[];
  travelers: Profile[];
  isAdmin: boolean;
  nameOf: (id: string | null | undefined) => string;
  colorOf: (id: string | null | undefined) => string;
  signIn: (slug: string, password: string) => Promise<string | null>;
  enterAsGuest: () => void;
  signInGuest: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reloadProfiles: () => Promise<void>;
};

const Ctx = createContext<AuthState>(null as any);
export const useAuth = () => useContext(Ctx);

const GUEST_KEY = 'trip:guest';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(() => {
    try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; }
  });
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache:profiles') || '[]'); } catch { return []; }
  });

  const reloadProfiles = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase.from('profiles').select('*').order('slug');
    if (data) {
      setProfiles(data as Profile[]);
      try { localStorage.setItem('cache:profiles', JSON.stringify(data)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    reloadProfiles();
    return () => sub.subscription.unsubscribe();
  }, [reloadProfiles]);

  const me = profiles.find((p) => p.id === session?.user.id) || null;
  // אורח עם סיסמה (לפני ההשקה) מתחבר כמשתמש guest, ונחשב אורח לכל דבר
  const guestSession = session?.user.email === `guest@${EMAIL_DOMAIN}`;
  const travelers = profiles.filter((p) => p.is_traveler);

  const value: AuthState = {
    ready,
    session,
    guest: (guest && !session) || guestSession,
    me,
    profiles,
    travelers,
    isAdmin: Boolean(me?.is_admin),
    nameOf: (id) => profiles.find((p) => p.id === id)?.display_name.split(' ')[0] || 'מישהי',
    colorOf: (id) => profiles.find((p) => p.id === id)?.color || '#7a8580',
    async signIn(slug, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: `${slug}@${EMAIL_DOMAIN}`, password });
      if (error) return error.message.includes('Invalid') ? 'הסיסמה לא נכונה' : 'אין חיבור כרגע. נסי שוב בעוד רגע.';
      try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
      setGuest(false);
      reloadProfiles();
      return null;
    },
    async signInGuest(password) {
      const { error } = await supabase.auth.signInWithPassword({ email: `guest@${EMAIL_DOMAIN}`, password });
      if (error) return error.message.includes('Invalid') ? 'הסיסמה לא נכונה' : 'אין חיבור כרגע. נסו שוב בעוד רגע.';
      return null;
    },
    enterAsGuest() {
      try { localStorage.setItem(GUEST_KEY, '1'); } catch { /* ignore */ }
      setGuest(true);
    },
    async signOut() {
      try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
      setGuest(false);
      await supabase.auth.signOut();
    },
    reloadProfiles,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
