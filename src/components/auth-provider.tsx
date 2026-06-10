"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export type UserTier = "free" | "pro" | "elite";

export interface UserProfile {
  id: string;
  email: string | null;  // NULL for anonymous Supabase users (mig 232)
  display_name: string | null;
  tier: UserTier;
  is_superadmin: boolean;
  preferred_leagues: string[];
  timezone: string;
  stripe_customer_id: string | null;
  telegram_chat_id: number | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  // True when the current session is a Supabase anonymous user (no email,
  // no identity providers linked yet). Use this to gate features that
  // require a real identity (Stripe checkout, email digest opt-in,
  // telegram link) and to drive the upgrade-CTA banner.
  isAnonymous: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAnonymous: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  loginModalOpen: false,
  openLoginModal: () => {},
  closeLoginModal: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const supabase = createSupabaseBrowser();

  const openLoginModal = useCallback(() => setLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setLoginModalOpen(false), []);

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Failed to fetch profile:", error.message);
        setProfile(null);
      } else {
        setProfile(data as UserProfile);
      }
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (userId) {
      await fetchProfile(userId);
    }
  }, [session?.user?.id, fetchProfile]);

  useEffect(() => {
    // Get the initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  // ANON-AUTH (mig 232): two truth sources, prefer the Supabase
  // is_anonymous flag from auth.users (set the moment signInAnonymously
  // is called). Fall back to email-null check from our profiles row
  // for resilience if the user object is stale.
  const user = session?.user ?? null;
  const isAnonymous =
    Boolean(user?.is_anonymous) ||
    (Boolean(user) && profile != null && profile.email == null);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAnonymous,
        signOut,
        refreshProfile,
        loginModalOpen,
        openLoginModal,
        closeLoginModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
