import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { UserProfile, OddsFormat } from "@/components/auth-provider";
import type { Match, MatchDetail, ValueBet, HistoricalBet, TrackRecordStats } from "@/lib/types";

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
    display_name: string;
    preferred_leagues: string[];
    preferred_markets: string[];
    default_stake: number;
    bankroll: number;
    odds_format: OddsFormat;
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

// ---------------------------------------------------------------------------
// Match queries (STUBS — will return real data once Python backend populates DB)
// ---------------------------------------------------------------------------

export async function getTodayMatches(): Promise<Match[]> {
  // TODO: Query `matches` table filtered by today's date
  // SELECT * FROM matches WHERE date = CURRENT_DATE ORDER BY kickoff ASC
  return [];
}

export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  // TODO: Join matches, odds_snapshots, odds_movements, injuries, lineups,
  // weather, referees, and predictions tables for the given matchId
  console.log("getMatchDetail stub called for:", matchId);
  return null;
}

export async function getValueBets(): Promise<ValueBet[]> {
  // TODO: Query `value_bets` view/table for active value bets
  // SELECT * FROM value_bets WHERE kickoff > NOW() ORDER BY edge_percent DESC
  return [];
}

export interface TrackRecordFilters {
  startDate?: string;
  endDate?: string;
  league?: string;
  market?: string;
  strategy?: string;
}

export async function getTrackRecord(
  filters?: TrackRecordFilters
): Promise<{ bets: HistoricalBet[]; stats: TrackRecordStats | null }> {
  // TODO: Query `historical_bets` table with optional filters
  // Also compute aggregate stats (hit rate, ROI, CLV, etc.)
  console.log("getTrackRecord stub called with filters:", filters);
  return { bets: [], stats: null };
}
