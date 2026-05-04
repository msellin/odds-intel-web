---
name: OddsIntel Design System
colors:
  surface: '#14141f'
  surface-dim: '#0e150e'
  surface-bright: '#333b33'
  surface-container-lowest: '#091009'
  surface-container-low: '#161d16'
  surface-container: '#1a221a'
  surface-container-high: '#242c24'
  surface-container-highest: '#2f372e'
  on-surface: '#dce5d9'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#dce5d9'
  inverse-on-surface: '#2a322a'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#c7c5d4'
  on-secondary: '#302f3b'
  secondary-container: '#464552'
  on-secondary-container: '#b6b3c3'
  tertiary: '#ffb5ab'
  on-tertiary: '#60130d'
  tertiary-container: '#ff8b7c'
  on-tertiary-container: '#76231b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#e3e0f1'
  secondary-fixed-dim: '#c7c5d4'
  on-secondary-fixed: '#1b1b26'
  on-secondary-fixed-variant: '#464552'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4a9'
  on-tertiary-fixed: '#410001'
  on-tertiary-fixed-variant: '#7f2a21'
  background: '#0a0a14'
  on-background: '#dce5d9'
  surface-variant: '#2f372e'
  border: rgba(255,255,255,0.06)
  text-primary: '#f0f0f5'
  text-muted: '#6b7280'
  accent-success: '#22c55e'
typography:
  h1:
    fontFamily: Inter
    fontSize: 2.5rem
    fontWeight: '700'
    lineHeight: '1.2'
  h2:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: '1.3'
  h3:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: '1.4'
  body-base:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.4'
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: '1'
  data-base:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: '1'
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  row-height: 40px
  touch-target: 48px
  gutter: 1rem
  margin-page: 1.5rem
  stack-xs: 0.25rem
  stack-sm: 0.5rem
  stack-md: 1rem
---

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
