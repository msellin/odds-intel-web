# Match Detail Page — Next Steps Plan

## Status: Phase 1-2 complete, Phase 3 partial. Data gaps discovered.

---

## NEXT SESSION — Top Priority Items

### 1. Event Timeline needs event type icons
Currently our MatchEventTimeline just shows dots. Flashscore shows:
- Goal: ball icon + scorer + "(assist)" + running score "0-1"
- Yellow card: yellow rectangle + player + reason "(Unsportsmanlike conduct)"
- Substitution: swap arrows (↔) + player in/out names
- Half-time separator: "1ST HALF 0-1" / "2ND HALF 1-0"
We have all this data in `match_events` (eventType, playerName, assistName, detail). Need to render proper icons and context text.

### 2. Stats bars need more stats (Flashscore level)
Flashscore Stats tab shows (in order): xG, Possession, Total shots, Shots on target, Big chances, Corner kicks, Passes (with accuracy count e.g. "496/570"), Yellow cards.
Then a "SHOTS" subsection: xG, xG on target (xGOT), Total shots, SOT, Shots off target, Blocked shots.
We currently show: Possession, xG, Total shots, SOT, Corners.
**Missing from our display**: passes, pass accuracy, yellow/red cards, blocked shots, shots off target, xGOT.
**Missing from our DB**: xGOT, big chances, shots off target (can derive: total - SOT - blocked).
**Now stored but not displayed**: fouls, offsides, saves, blocked shots, pass accuracy (migration 056).

### 3. Fix signal generation pipeline
Root cause found: `batch_write_morning_signals` only runs for matches with odds in `odds_snapshots`. Grade D matches (AF-only predictions) get zero signals. Fix: decouple signal generation from the betting pipeline so ALL matches get signals.

### 4. Push engine changes
Migration 056 + live tracker stats storage changes need to be pushed to main so they deploy via Railway for tomorrow's games.

---

## Priority 1: Fix Data Pipeline (Engine-side)

### Problem: Intel tab is empty for live CL match
The `match_signals` table has no rows for Bayern vs PSG. This means:
- The betting pipeline (`run_betting.py`) hasn't generated signals for this match, OR
- Signals were generated but not for this specific match ID (possible ID mismatch between fixtures)

**Investigation steps:**
1. Check `match_signals` table for this match ID in Supabase
2. Check `predictions` table — we know Grade D exists so AF predictions ran
3. Check if `run_betting.py` ran today and which matches it processed
4. Check if the match ID in `matches` matches what `match_signals` references
5. Verify `getMatchSignals()` query is correct

### Problem: No live odds showing
`live_match_snapshots` might have data but `getLiveMatchOdds()` might be querying the wrong table or format. Need to verify.

---

## Priority 2: Store More Data from API-Football

### Currently fetched but DISCARDED:
| Stat | Source | Action |
|------|--------|--------|
| Fouls (home/away) | `/fixtures/statistics` | Add to `match_stats` + `live_match_snapshots` |
| Offsides (home/away) | `/fixtures/statistics` | Add to `match_stats` + `live_match_snapshots` |
| Pass accuracy % | `/fixtures/statistics` | Add to `match_stats` |
| Goalkeeper saves | `/fixtures/statistics` | Add to `match_stats` |
| Blocked shots | `/fixtures/statistics` | Add to `match_stats` |

**Action:** Update `parse_fixture_stats()` in live_tracker to save these. Add columns to `match_stats` table via migration.

### Not fetched yet but available from API-Football:
| Data | Endpoint | Value |
|------|----------|-------|
| Live match commentary/text | `/fixtures?id=X` (events detail) | Could power a live commentary feed |
| Player photos | `/players?id=X` or `/players/squads?team=X` | Visual lineup enhancement |
| Team form (last 5) on detail | Already in `matches` table | Not surfaced on detail page |
| Venue photo | `/venues?id=X` | Nice-to-have header visual |
| League logo | Part of fixture response | Already partially stored |

---

## Priority 3: Enrich Each Tab Content

### Intel Tab — Must Feel Like "Intelligence Dashboard"
Currently empty when no signals. Should show more even without signals:

| Content | Tier | Source | Status |
|---------|------|--------|--------|
| AI Predicted Score | Free | `af_prediction` on match | ✅ In header |
| Model probability (H/D/A %) | Free | `predictions` table | ❌ Not displayed |
| Signal summary (top 3-5) | Free (teaser) / Pro (full) | `match_signals` | ❌ No data for this match |
| Market implied probability | Free | Calculated from odds | ❌ Not displayed |
| Signal divergence alerts | Pro | Derived from signals | ❌ No data |
| Bot consensus | Pro | `simulated_bets` | ❌ Empty |
| Signal timeline (hourly) | Pro | `match_signals` history | ❌ No data |
| "Why This Pick" reasoning | Elite | Derived from signals | ❌ No data |
| CLV tracker | Elite | `simulated_bets` settled | Shows placeholder ✅ |

**New content to add (doesn't need signals):**
1. **Market Implied Probabilities** — calculate from odds: `1/odds / sum(1/odds)`. Show as horizontal bars. Always available if odds exist. FREE tier.
2. **Value indicator** — compare model probability vs market implied. If model says 58% and market says 54%, show "+4% edge". FREE teaser, PRO full breakdown.
3. **Pre-match summary sentence** — auto-generate from H2H + standings + form. E.g. "Bayern are #2 in CL group (7W 0D 1L), PSG are #11 (4W 2D 2L). Bayern have won 7 of 10 head-to-head meetings." Always available.

### Match Tab — Needs Live Stats
Currently shows events + injuries + lineups. Missing:

| Content | Tier | Status |
|---------|------|--------|
| Visual event timeline | Free | ✅ Done |
| Match stats bars (possession, shots, xG) | Free (basic) / Pro (full) | ❌ Not shown separately |
| Live score + minute | Free | ✅ In header |
| Lineups (formation view) | Pro | ✅ Done |
| Injury report | Pro | ✅ Done |
| Player stats table | Pro | ✅ Available |
| Substitutions in timeline | Pro | ✅ In timeline |

**To add:**
1. **Live match stats card** — pull from `live_match_snapshots`: possession %, shots, SOT, corners, xG. Show as visual bars like Flashscore. FREE for basic (possession + shots), PRO for full.
2. **Half-time score** — if available in events, show "HT: 0-1" in the timeline.

### Odds Tab — Needs Movement Charts
Currently just shows 3 static numbers. Missing:

| Content | Tier | Status |
|---------|------|--------|
| Best available odds (1X2) | Free | ✅ Done |
| Odds movement chart (1X2) | Pro | ❌ Was in old layout, not wired to new tab |
| Odds movement chart (O/U) | Pro | ❌ Same |
| Live in-play odds chart | Pro | ❌ Empty (no data?) |
| Market implied probabilities | Free | ❌ Not calculated |
| Bookmaker comparison table | Pro | ❌ Not built |

**To add:**
1. **Wire odds movement charts** — extract from `MatchDetailLive` into standalone components and render in Odds tab
2. **Market implied probabilities** — horizontal bars showing % from odds
3. **Over/Under odds display** — we track O/U odds in live snapshots, should display them

### Context Tab — Solid, Minor Additions
Currently good: H2H, League Table, Season Stats, Community Vote, Notes.

**To add:**
1. **Venue + referee info** — moved from old header, add as small info row
2. **Recent form strips** — show last 5 results for each team with results

---

## Priority 4: Visual Polish

### Header
- [ ] "Paris Saint Ger..." truncates — allow wrapping or use abbreviation
- [ ] Score should be larger on mobile
- [ ] Add venue/time as subtle line under date

### Tabs
- [ ] Sticky tab bar should have subtle background blur
- [ ] Active tab indicator could be bolder
- [ ] Consider badge counts on tabs (e.g., "Match 4" for 4 events)

### Cards
- [ ] Consistent card padding and spacing across all tabs
- [ ] Injury report is very vertical — compact into a table or two-column layout on mobile
- [ ] Event timeline needs color-coded event icons (currently just dots)

### Premium Signal Presentation (Phase 3 Task #15)
- [ ] Signal severity colors by group (market=blue, form=green, injuries=red)
- [ ] Timestamps on signals ("detected 3h ago")
- [ ] Signal strength lean bar (← Away · Neutral · Home →)
- [ ] "Why this match?" auto-generated hook at top of Intel
- [ ] Bot consensus as visual icons not text

---

## Priority 5: New Features (Future)

- **Bookmaker comparison table** — show all bookmakers with their odds, color-code best
- **Odds alerts** — "notify me when odds hit X"
- **Live commentary feed** — minute-by-minute text updates
- **Player photos in lineups** — fetch from API-Football `/players/squads`
- **Share/export match card** — social media optimized image
- **Match notifications** — push when match status changes

---

## Immediate Next Session Checklist

1. ☐ Investigate why `match_signals` is empty for CL match (engine pipeline)
2. ☐ Add market implied probabilities to Intel tab (calculated from odds, no pipeline needed)
3. ☐ Wire odds movement charts into Odds tab (extract from MatchDetailLive)
4. ☐ Add live match stats card (possession, shots, xG from live_match_snapshots)
5. ☐ Fix "Paris Saint Ger..." truncation
6. ☐ Hide CLV Tracker placeholder when pre-settlement
7. ☐ Store fouls/offsides/saves in live_tracker (engine migration)
