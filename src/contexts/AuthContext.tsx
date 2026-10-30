import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  role: 'admin' | 'superviseur' | 'agent';
  name: string;
  initials: string;
  color: string;
  photo_url: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_INIT_TIMEOUT_MS = 5000;
const PROFILE_FETCH_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

async function fetchAppUser(supabaseUser: SupabaseUser): Promise<AppUser | null> {
  const [profileRes, roleRes] = await withTimeout(
    Promise.all([
      supabase
        .from('profiles')
        .select('name, initials, color, photo_url')
        .eq('id', supabaseUser.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .maybeSingle(),
    ]),
    PROFILE_FETCH_TIMEOUT_MS,
    'Profile/role fetch timeout',
  );

  if (profileRes.error || roleRes.error || !profileRes.data || !roleRes.data) return null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    role: roleRes.data.role as AppUser['role'],
    name: profileRes.data.name,
    initials: profileRes.data.initials,
    color: profileRes.data.color,
    photo_url: profileRes.data.photo_url ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const safeSetUser = (nextUser: AppUser | null) => {
      if (isMounted) setUser(nextUser);
    };

    const safeStopLoading = () => {
      if (isMounted) setLoading(false);
    };

    const handleSession = async (session: Session | null, source: string) => {
      try {
        if (session?.user) {
          const appUser = await fetchAppUser(session.user);
          safeSetUser(appUser);
        } else {
          safeSetUser(null);
        }
      } catch (err) {
        console.error(`Auth handling error (${source}):`, err);
        safeSetUser(null);
      } finally {
        safeStopLoading();
      }
    };

    const forceStopTimeout = window.setTimeout(() => {
      console.warn('Auth init timeout reached; forcing loading state to false.');
      safeStopLoading();
    }, AUTH_INIT_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleSession(session, 'onAuthStateChange');
    });

    void (async () => {
      try {
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS - 500,
          'getSession timeout',
        );

        if (error) throw error;
        await handleSession(session, 'getSession');
      } catch (err) {
        console.error('Get session error:', err);
        safeSetUser(null);
        safeStopLoading();
      }
    })();

    return () => {
      isMounted = false;
      window.clearTimeout(forceStopTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
