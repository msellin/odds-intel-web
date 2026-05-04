# OddsIntel UI Redesign - Product Requirements Document

## Product Overview
OddsIntel is a football match intelligence platform for serious bettors. It features fixtures with odds comparison, interest indicators, and AI analysis.

## Visual Identity (Design Tokens)
- **Background:** #0a0a14 (Very dark blue-black)
- **Card/Surface:** #14141f
- **Border:** rgba(255,255,255,0.06)
- **Primary Accent:** #22c55e (Green-500) - CTAs, best odds, active states.
- **Text Primary:** #f0f0f5
- **Text Muted:** #6b7280
- **Typography:** 
  - Body: Inter
  - Data/Numbers: JetBrains Mono
- **Border Radius:** 8px (Cards), 6px (Buttons), 4px (Badges)

## Page 1: Landing Page (Public/Marketing)
### Structure:
- **Nav:** Logo (green accent), Matches, Log In, [Get Started] CTA.
- **Hero:** "All your pre-match intelligence. One screen." Primary CTA: [Browse Today's Matches], Secondary: [Sign Up Free].
- **Problem Section:** "Stop opening 8 tabs" - compact layout.
- **Features:** 400+ fixtures/day, 2-3 bookmaker odds, interest indicators, detail pages.
- **Pricing (3 Tiers):**
  - **Free (€0):** Basic odds, interest indicators.
  - **Pro (€19/mo):** Full comparison, H2H stats, AI injury alerts, odds movement.
  - **Elite (€49/mo):** Model probabilities, value bet picks, CLV tracking, tips.
- **Trust:** Responsible gambling note.
- **Footer:** Logo, copyright, legal links.

## Page 2: Matches Page (Core Product)
### Core Patterns:
- **League Accordions:** Collapsible. Expanded for leagues with data, collapsed for others. Header includes country flag, name (uppercase), match count, and "🔥" indicator.
- **Dense Match Rows:** ~40px height. Format: [🔥] [Time] [Teams] [Odds] [→].
- **Typography:** JetBrains Mono for times and odds. Green highlight for best odds.
- **League Filter:** Compact search input (e.g., type "eng").
- **View Toggle:** [All matches] vs [With odds only].
- **Header:** "Today's Matches", date, match count, "X with odds" badge.
- **Banners:** Subtle sign-up banner for logged-out users.

## Mobile Specifics:
- Single column, full-width rows.
- Sticky header for date/filter.
- 48px tap targets for headers.
- Fixed widths for odds columns to maintain alignment.
