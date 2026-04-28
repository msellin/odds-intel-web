"use client";

import { useState, useEffect, useCallback } from "react";
import { StickyNote, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import Link from "next/link";

interface MatchNotesProps {
  matchId: string;
}

export function MatchNotes({ matchId }: MatchNotesProps) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const supabase = createSupabaseBrowser();
    supabase
      .from("match_notes")
      .select("note_text")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNote((data as { note_text: string }).note_text);
          setSavedNote((data as { note_text: string }).note_text);
          setExpanded(true);
        }
        setLoading(false);
      });
  }, [user, matchId]);

  const saveNote = useCallback(async () => {
    if (!user || note === savedNote) return;
    setSaving(true);
    const supabase = createSupabaseBrowser();
    await supabase.from("match_notes").upsert(
      {
        user_id: user.id,
        match_id: matchId,
        note_text: note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,match_id" }
    );
    setSavedNote(note);
    setSaving(false);
  }, [user, matchId, note, savedNote]);

  // Auto-save on blur
  const handleBlur = () => {
    saveNote();
  };

  if (!user) {
    return null;
  }

  if (loading) return null;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground w-full"
      >
        <StickyNote className="h-4 w-4" />
        Add notes for this match...
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-card/40 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <StickyNote className="h-3 w-3" />
          My Notes
        </p>
        {saving && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        )}
        {!saving && note !== savedNote && (
          <span className="text-[10px] text-amber-400">Unsaved</span>
        )}
        {!saving && note === savedNote && savedNote && (
          <span className="text-[10px] text-emerald-400">Saved</span>
        )}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={handleBlur}
        placeholder="Jot down your research, hunches, or pre-match notes..."
        className="w-full resize-none rounded-md border border-white/[0.06] bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/40 focus:outline-none focus:ring-0 min-h-[80px]"
        rows={3}
      />
    </div>
  );
}
