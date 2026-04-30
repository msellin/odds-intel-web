import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { UserProfile } from "@/components/auth-provider";

// ---------------------------------------------------------------------------
// Supabase browser client (used by all queries below)
// ---------------------------------------------------------------------------
function getSupabase() {
  return createSupabaseBrowser();
}

// ---------------------------------------------------------------------------
// Profile queries (REAL — hit Supabase)
// ---------------------------------------------------------------------------

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("getUserProfile error:", error.message);
    return null;
  }
  return data as UserProfile;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<{
    preferred_leagues: string[];
    timezone: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Notification settings queries (REAL — hit Supabase)
// ---------------------------------------------------------------------------

export interface NotificationSettings {
  user_id: string;
  value_bet_alerts: boolean;
  lineup_alerts: boolean;
  injury_alerts: boolean;
  weekly_report: boolean;
  edge_threshold: number;
}

export async function getUserNotificationSettings(
  userId: string
): Promise<NotificationSettings | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("getUserNotificationSettings error:", error.message);
    return null;
  }
  return data as NotificationSettings;
}

export async function updateUserNotificationSettings(
  userId: string,
  updates: Partial<Omit<NotificationSettings, "user_id">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("user_notification_settings")
    .upsert({ user_id: userId, ...updates });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

