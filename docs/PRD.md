# Pacific Golf — Product Requirements Document

**Version:** 1.0  
**Last Updated:** February 10, 2026  
**Status:** Draft — Awaiting Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Guiding Principles](#2-guiding-principles)
3. [Market Context](#3-market-context)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Feature Specifications](#5-feature-specifications)
6. [Data Model](#6-data-model)
7. [API Design](#7-api-design)
8. [Multi-Tenancy Architecture](#8-multi-tenancy-architecture)
9. [Real-Time Features](#9-real-time-features)
10. [PWA & Offline Support](#10-pwa--offline-support)
11. [Pricing & Billing](#11-pricing--billing)
12. [Technical Stack](#12-technical-stack)
13. [Security & Compliance](#13-security--compliance)
14. [Open Questions](#14-open-questions)
15. [Out of Scope (V1)](#15-out-of-scope-v1)

---

## 1. Executive Summary

### What We're Building

**Pacific Golf** is a multi-tenant SaaS platform for golf tournament management, built specifically for the Guam market with expansion potential across the Pacific region.

### The Problem

Golf tournaments in Guam currently rely on:
- Paper registration forms (manual data entry, error-prone)
- Google Forms (no payment integration, no golf-specific features)
- Email/phone registration (high admin burden)
- No live scoring (results posted after event)
- No real-time leaderboards (paper scorecards tallied manually)

Major competitors like Golf Genius ($1,300+/year) are overpriced for the local market, while free options like DoJiggy lack live scoring. BlueGolf has terrible mobile UX (2.8/5 rating).

### The Solution

A simple, affordable, mobile-first tournament platform that provides:
- Online registration with payment processing
- Team/foursome management
- Live mobile scoring (PWA — no app download)
- Real-time leaderboards
- Digital raffle system
- Sponsor management

### Target Customers

1. **Rotary Club of Guam** — Annual charity tournaments
2. **Guam Chamber of Commerce** — Corporate amateur tournament
3. **HANMI (Korean Association)** — Charity Classic
4. **GNGF** — Amateur championships and monthly events
5. **Individual golf courses** — Club championships

### Business Model

**$4 per registrant**, paid by the hosting organization, with a cap (TBD — likely $400-500).

Example: 120-player tournament = $480 revenue (or $400 if capped)

---

## 2. Guiding Principles

### 2.1 Simple by Default, Powerful When Needed

Most tournament organizers aren't golf pros or tech experts. The default experience should be "5-minute setup" simple, with advanced features available for those who need them.

### 2.2 Mobile-First, Desktop-Friendly

Golfers will score on phones in sunlight with one hand. Admins might use tablets or desktops. Design for mobile first, ensure desktop works well.

### 2.3 No App Download Required

App Store friction kills adoption. Use PWA (Progressive Web App) so golfers open a link and start scoring — no install needed.

### 2.4 Works Offline

Golf courses have spotty cell coverage. Scores must save locally and sync when connection returns.

### 2.5 Affordable for Local Market

Golf Genius at $1,300/year is absurd for a Rotary club running one tournament. Our pricing should make adoption a no-brainer.

### 2.6 Build Once, Build Right

Follow the Shimizu Technology starter-app patterns. Use proven architecture so we don't refactor later. Multi-tenancy from day one.

### 2.7 Delightful Scoring Experience

The mobile scoring UX is the product's soul. If scoring is frustrating, nothing else matters. Beat BlueGolf's terrible UX easily.

---

## 3. Market Context

### 3.1 Guam Golf Landscape

**7+ courses:** Leo Palace Resort, Finest Guam, Country Club of the Pacific, Windward Hills, GICC, Sono Felice Mangilao/Talofofo, Palm Tree (military)

**Tournament types:**
| Type | Format | Size | Entry Fee |
|------|--------|------|-----------|
| Charity (Rotary, HANMI) | Scramble | 80-144 players | $125-200 |
| Corporate (Chamber) | Select Shot/Best Ball | 60-120 players | $150-300 |
| Amateur Championship (GNGF) | Stroke Play | 50-100 players | $50-100 |
| Club Championship | Various | 30-60 players | $25-75 |

### 3.2 Competitor Analysis

| Competitor | Price | Strengths | Weaknesses |
|------------|-------|-----------|------------|
| **Golf Genius** | $1,300-3,900/yr | Full-featured, industry leader | Expensive, complex, "tiny fonts" |
| **BlueGolf** | Variable | Association partnerships | 2.8/5 rating, awful UX, outdated |
| **DoJiggy** | Free (4.9% fees) | Free tier, charity-focused | No live scoring |
| **Event Caddy** | $299-999 | Good mid-tier | "UX is so-so", extra fees |
| **PlayThru** | Unknown | Browser-based, no download | Basic features |

### 3.3 Our Position

> **"Golf Genius quality at DoJiggy prices with the best mobile scoring UX."**

**Key differentiators:**
1. Best mobile scoring experience (beat BlueGolf easily)
2. No app download (PWA/browser-based)
3. Affordable per-registrant pricing
4. Local support (Guam time zone)
5. Digital raffle system (Chamber's killer feature)
6. Scramble-optimized (charity event focus)

---

## 4. User Roles & Permissions

### 4.1 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     Super Admin (Us)                        │
│  - Create/manage organizations                              │
│  - View all data across platform                            │
│  - Manage billing and subscriptions                         │
│  - System configuration                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    Organization Admin                        │
│  - Manage their organization settings                        │
│  - Create/manage tournaments                                 │
│  - Invite other admins                                       │
│  - View billing for their org                                │
│  - Access all tournaments in their org                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    Tournament Admin                          │
│  - Manage assigned tournament(s) only                        │
│  - Registration management                                   │
│  - Check-in golfers                                          │
│  - Manage groups/pairings                                    │
│  - View scores and leaderboard                               │
│  - Cannot create new tournaments                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                         Golfer                               │
│  - Register for tournaments                                  │
│  - Pay entry fees                                            │
│  - View their registration                                   │
│  - Enter scores (during tournament)                          │
│  - View leaderboard                                          │
│  - Purchase raffle tickets                                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Permission Matrix

| Action | Super Admin | Org Admin | Tournament Admin | Golfer |
|--------|-------------|-----------|------------------|--------|
| Create organization | ✅ | ❌ | ❌ | ❌ |
| Edit organization | ✅ | ✅ (own) | ❌ | ❌ |
| Create tournament | ✅ | ✅ (own org) | ❌ | ❌ |
| Edit tournament | ✅ | ✅ (own org) | ✅ (assigned) | ❌ |
| View registrations | ✅ | ✅ (own org) | ✅ (assigned) | ❌ |
| Check-in golfers | ✅ | ✅ | ✅ | ❌ |
| Manage groups | ✅ | ✅ | ✅ | ❌ |
| Enter scores | ✅ | ✅ | ✅ | ✅ (own group) |
| View leaderboard | ✅ | ✅ | ✅ | ✅ |
| Manage raffle | ✅ | ✅ | ✅ | ❌ |
| Buy raffle tickets | ❌ | ❌ | ❌ | ✅ |
| Process refunds | ✅ | ✅ | ❌ | ❌ |

---

## 5. Feature Specifications

### 5.1 Organization Management

**Purpose:** Allow organizations (Rotary, Chamber, etc.) to have their own branded space within Pacific Golf.

**Features:**
- Organization profile (name, logo, description)
- Custom branding (primary color, banner image)
- Contact information
- Billing settings
- Admin user management
- Tournament history

**URL Structure:**
- Path-based (MVP): `pacificgolf.com/rotary-guam`
- Subdomain (future): `rotary.pacificgolf.com`

---

### 5.2 Tournament Setup

**Purpose:** Allow org admins to create and configure tournaments.

**Tournament Creation Wizard:**

**Step 1: Basic Info**
- Tournament name
- Edition (e.g., "22nd Annual")
- Event date
- Registration open/close dates
- Location/venue (dropdown of Guam courses + custom)

**Step 2: Format & Rules**
- Format selection:
  - [ ] Scramble (4-person team, best shot)
  - [ ] Best Ball (individual scores, best used)
  - [ ] Stroke Play (individual, total strokes)
  - [ ] Stableford (points-based)
  - [ ] Match Play (hole-by-hole)
  - [ ] Modified/Custom
- Scoring system:
  - Gross only
  - Net (handicap-adjusted)
  - Gross + Net
- Handicap handling:
  - Manual entry by golfer
  - Manual entry by admin
  - None (scratch)
- Tie-breaker rules (configurable)

**Step 3: Capacity & Fees**
- Maximum capacity (e.g., 144 players)
- Reserved slots (for sponsors, VIPs)
- Entry fee amount
- Early bird pricing (optional)
- Team vs. individual registration
- Waitlist enabled (yes/no)

**Step 4: Schedule**
- Registration time (e.g., 11:00 AM)
- Shotgun start time (e.g., 12:30 PM)
- Estimated end time
- Awards ceremony time

**Step 5: Additional Options**
- Enable live scoring (yes/no)
- Enable raffle (yes/no)
- Enable sponsors display (yes/no)
- Closest to pin holes (select holes)
- Longest drive hole (select hole)
- Contact info for questions

---

### 5.3 Registration & Payments

**Purpose:** Allow golfers to register and pay online.

**Registration Flow (Individual):**

1. **Select Tournament** — Landing page shows open tournaments
2. **Registration Type** — Individual or join/create team
3. **Golfer Information:**
   - Full name (required)
   - Email (required)
   - Phone (required)
   - Company/organization (optional)
   - Handicap (if applicable)
   - Shirt size (if swag included)
   - Dietary restrictions (if food included)
4. **Add-Ons:**
   - Raffle tickets ($5 each, quantity selector)
   - Mulligan pack ($10)
   - Sponsor a hole ($100)
5. **Waiver/Liability** — Must accept to continue
6. **Payment:**
   - Credit card via Stripe
   - "Pay at Registration" option (if enabled)
7. **Confirmation:**
   - Success page with details
   - Email confirmation sent
   - Calendar invite option

**Registration Flow (Team/Foursome):**

1. **Create Team** — Team captain enters team name
2. **Add Members:**
   - Captain fills own info
   - Option A: Enter other members' info directly
   - Option B: Invite via email (members complete own registration)
3. **Partial Team Option** — Allow 2-3 person teams, system fills
4. **Team Payment:**
   - Captain pays for all
   - Split payment (each member pays own)

**Admin Registration:**
- Add golfers manually (for phone/email registrations)
- Mark as "Pay at Registration" or "Paid (Cash/Check)"
- Import from CSV (bulk upload)

**Waitlist:**
- When capacity reached, new registrations go to waitlist
- Auto-promote when spot opens (optional)
- Notify waitlisted golfers

**Refunds:**
- Full refund (before cutoff date)
- Partial refund (admin discretion)
- Stripe handles actual refund
- Email notification to golfer

---

### 5.4 Group/Foursome Management

**Purpose:** Organize golfers into groups and assign starting holes.

**Features:**

**Auto-Generate Groups:**
- System creates foursomes from registrations
- Option: Keep registered teams together
- Option: Randomize individuals

**Manual Group Management:**
- Drag-and-drop golfers between groups
- Create new groups
- Split/merge groups
- Move individual golfers

**Hole Assignments:**
- Shotgun start: Assign each group to a starting hole
- Tee time start: Assign sequential tee times
- Visual grid showing hole assignments
- Drag-and-drop hole assignment

**Position Labels:**
- Format: `7A`, `7B` (Hole 7, Group A/B)
- Clear for players and volunteers

**Printouts:**
- Pairing sheet (all groups)
- Cart signs (individual cards)
- Hole assignment sheet (for volunteers)

---

### 5.5 Check-In System

**Purpose:** Track golfer arrival on tournament day.

**Features:**

**Check-In Dashboard:**
- List of all golfers with check-in status
- Search by name
- Quick check-in toggle
- Show payment status (paid vs. unpaid)
- Collect payment on check-in (for "pay at registration")

**QR Code Check-In:**
- Golfer receives QR code in confirmation email
- Scan to check in instantly
- Works offline (syncs when connected)

**Stats Display:**
- Total registered: 120
- Checked in: 85 (71%)
- Remaining: 35
- Not checked in list

**Alerts:**
- Flag golfers who haven't paid
- Flag incomplete teams

---

### 5.6 Live Scoring (Mobile PWA)

**Purpose:** Allow golfers to enter scores in real-time from the course.

**Scorer Access:**
- Open link on phone (no download)
- Find name or enter PIN
- See assigned group and starting hole

**Scoring Interface:**

```
┌─────────────────────────────────┐
│  Hole 7 • Par 4 • 385 yds      │
├─────────────────────────────────┤
│                                 │
│     ┌─────────────────────┐     │
│     │                     │     │
│     │         4           │     │
│     │                     │     │
│     └─────────────────────┘     │
│                                 │
│      [ - ]           [ + ]      │
│                                 │
├─────────────────────────────────┤
│  Team Score: 4                  │
│  Thru 6 holes: -2              │
├─────────────────────────────────┤
│  ◀ Hole 6      Hole 8 ▶        │
└─────────────────────────────────┘
```

**Key UX Requirements:**
- Large tap targets (thumb-friendly)
- High contrast (readable in sunlight)
- Minimal taps to enter score
- Visual feedback on tap (haptic if supported)
- Swipe between holes
- Auto-save (no submit button)

**Scramble Scoring:**
- One person per group enters team score
- All members see the score
- Only team score matters

**Individual Scoring:**
- Each golfer enters own score
- Or designated scorer enters for group

**Offline Support (Phase 2):**
- Scores saved locally
- "Offline" indicator shown
- Auto-sync when back online
- No data loss

**Score Validation:**
- Flag unlikely scores (e.g., 1 on par 5)
- Allow override with confirmation
- Track edited scores

---

### 5.7 Real-Time Leaderboard

**Purpose:** Display live standings as scores come in.

**Public Leaderboard:**
- Accessible via URL (no login required)
- Auto-refreshes via WebSocket
- Shows position, team/player name, score, thru holes

**Display Modes:**

**Standard View:**
```
┌─────────────────────────────────────────────────┐
│  ROTARY CHARITY CLASSIC 2026                    │
│  Live Leaderboard                               │
├─────┬────────────────────┬───────┬──────────────┤
│ Pos │ Team               │ Score │ Thru         │
├─────┼────────────────────┼───────┼──────────────┤
│  1  │ Ambros Aces        │  -8   │ 14           │
│  2  │ Bank of Guam       │  -6   │ 13           │
│  3  │ IT&E Swingers      │  -5   │ 14           │
│  4  │ Matson Mashers     │  -4   │ 12           │
│  5  │ Triple J Eagles    │  -4   │ 11           │
└─────┴────────────────────┴───────┴──────────────┘
```

**TV Display Mode:**
- Full-screen, large fonts
- Auto-scroll through standings
- Sponsor logos rotate in corner
- Tournament branding prominent
- Designed for clubhouse TV

**Filters:**
- By flight (A/B/C)
- By division (Men/Women/Senior)
- Gross vs. Net scores
- Search for specific team/player

**Features:**
- Position movement indicators (↑↓)
- Highlight recent score updates
- "Last updated" timestamp
- Leader alert when lead changes

---

### 5.8 Digital Raffle System

**Purpose:** Run raffles throughout tournament with automatic winner notification.

**Raffle Setup (Admin):**
- Create raffle for tournament
- Add prizes (name, description, image, sponsor)
- Set prize tiers (Grand Prize, 2nd, 3rd, etc.)
- Configure drawing time (manual or scheduled)
- Set ticket price (e.g., $5 each)

**Ticket Purchase:**
- During registration (add-on)
- At check-in (admin sells)
- During tournament (mobile purchase)
- Confirm purchase via email

**Live Raffle Board:**
- Displays on clubhouse TV
- Shows prizes with images
- "Drawing at 5:00 PM" countdown
- Sponsor logos

**Drawing:**
- Manual draw (admin triggers)
- Scheduled auto-draw
- Animation on screen
- Winner name displayed

**Winner Notification:**
- Instant SMS to winner
- Email confirmation
- "Please claim at registration tent"

**Admin Controls:**
- View all ticket purchases
- Manual winner selection (if needed)
- Re-draw if winner not present
- Mark prize claimed

---

### 5.9 Sponsor Management

**Purpose:** Display sponsor logos and recognition throughout the platform.

**Sponsor Tiers:**
- Title Sponsor (biggest logo, top placement)
- Platinum
- Gold
- Silver
- Bronze
- Hole Sponsors (assigned to specific holes)

**Sponsor Profile:**
- Company name
- Logo (upload)
- Website URL
- Tier/level
- Sponsorship amount (optional, internal)

**Display Locations:**
- Tournament landing page
- Leaderboard ticker
- TV display rotation
- Email confirmations
- Raffle prize attribution
- Hole assignment sheets

---

### 5.10 Special Competitions

**Purpose:** Track closest-to-pin, longest drive, and other side competitions.

**Closest to Pin:**
- Select which par 3s to track
- Volunteer enters leader + distance
- Display on leaderboard
- Announce winner

**Longest Drive:**
- Select hole (usually par 5)
- Volunteer marks and measures
- Track current leader
- Final winner announced

**Hole-in-One:**
- Alert system when entered
- Verification required
- Prize notification (if applicable)

---

### 5.11 Results & Reporting

**Purpose:** Generate final results and reports after tournament.

**Final Leaderboard:**
- Lock scores after tournament
- Apply tie-breakers
- Generate final standings

**Reports:**
- Final results (PDF)
- Registration summary
- Payment report
- Check-in report
- Score cards (individual)
- Raffle winner list

**Export:**
- CSV export (all data)
- PDF certificates (winners)
- Email results to all participants

**Year-Over-Year:**
- Compare to previous tournaments
- Track returning players
- Revenue comparison

---

### 5.12 Communications

**Purpose:** Send emails and notifications to participants.

**Automated Emails:**
- Registration confirmation
- Payment receipt
- Reminder (1 week before, 1 day before)
- Day-of instructions (tee time, location)
- Results summary (post-event)

**Admin Emails:**
- Broadcast to all registrants
- Custom message
- Track open rates

**SMS Notifications (Phase 2):**
- Raffle winner alerts
- Tee time reminders
- Weather delays
- Results announcement

---

### 5.13 Landing Page / Marketing Site

**Purpose:** Explain Pacific Golf and convert visitors to customers.

**Pages:**
- **Home** — Hero, features overview, testimonials
- **Features** — Detailed feature breakdown
- **Pricing** — Simple pricing explanation
- **About** — Built in Guam, for Guam
- **Contact** — Get in touch form
- **Login** — For existing customers

**SEO:**
- Target: "golf tournament software guam"
- Target: "golf registration guam"
- Local business schema

---

## 6. Data Model

### 6.1 Core Models

```ruby
# Organization (Tenant)
Organization
  - id: uuid
  - name: string
  - slug: string (unique, URL-safe)
  - logo_url: string
  - primary_color: string (#hex)
  - banner_url: string
  - description: text
  - contact_email: string
  - contact_phone: string
  - website_url: string
  - stripe_customer_id: string
  - subscription_status: enum (active, past_due, canceled)
  - features: jsonb (enabled features)
  - created_at, updated_at
  - has_many :tournaments
  - has_many :users, through: :organization_memberships

# Tournament
Tournament
  - id: uuid
  - organization_id: uuid (foreign key)
  - name: string
  - slug: string (unique within org)
  - edition: string (e.g., "22nd Annual")
  - event_date: date
  - registration_opens_at: datetime
  - registration_closes_at: datetime
  - registration_time: string (display)
  - start_time: string (display)
  - end_time: string (display)
  - venue_name: string
  - venue_address: string
  - format: enum (scramble, best_ball, stroke, stableford, match, custom)
  - scoring_type: enum (gross, net, both)
  - max_capacity: integer
  - reserved_slots: integer
  - entry_fee_cents: integer
  - early_bird_fee_cents: integer
  - early_bird_deadline: datetime
  - team_size: integer (default 4)
  - allow_partial_teams: boolean
  - waitlist_enabled: boolean
  - scoring_enabled: boolean
  - raffle_enabled: boolean
  - status: enum (draft, open, closed, completed, archived)
  - settings: jsonb (additional config)
  - created_at, updated_at
  - has_many :golfers
  - has_many :groups
  - has_many :scores
  - has_many :raffle_prizes
  - has_many :sponsors

# Golfer
Golfer
  - id: uuid
  - tournament_id: uuid
  - group_id: uuid (nullable)
  - user_id: uuid (nullable, if registered user)
  - name: string
  - email: string
  - phone: string
  - company: string
  - handicap: decimal
  - shirt_size: string
  - dietary_restrictions: text
  - registration_type: enum (individual, team_captain, team_member)
  - registration_status: enum (confirmed, waitlist, cancelled)
  - payment_status: enum (unpaid, paid, refunded)
  - payment_type: enum (stripe, cash, check, complimentary)
  - payment_amount_cents: integer
  - stripe_payment_intent_id: string
  - checked_in_at: datetime
  - waiver_accepted_at: datetime
  - position: integer (within group)
  - notes: text
  - created_at, updated_at

# Group (Foursome)
Group
  - id: uuid
  - tournament_id: uuid
  - group_number: integer
  - team_name: string
  - starting_hole: integer
  - tee_time: time
  - created_at, updated_at
  - has_many :golfers
  - has_many :scores

# Score
Score
  - id: uuid
  - tournament_id: uuid
  - group_id: uuid
  - golfer_id: uuid (nullable for scramble)
  - hole_number: integer (1-18)
  - strokes: integer
  - putts: integer (optional)
  - fairway_hit: boolean (optional)
  - entered_by_id: uuid (user who entered)
  - entered_at: datetime
  - edited_at: datetime
  - created_at, updated_at

# RafflePrize
RafflePrize
  - id: uuid
  - tournament_id: uuid
  - sponsor_id: uuid (nullable)
  - name: string
  - description: text
  - image_url: string
  - tier: integer (1 = grand prize)
  - value_cents: integer
  - winner_golfer_id: uuid (nullable)
  - drawn_at: datetime
  - claimed_at: datetime
  - created_at, updated_at

# RaffleTicket
RaffleTicket
  - id: uuid
  - tournament_id: uuid
  - golfer_id: uuid
  - quantity: integer
  - price_cents: integer
  - payment_status: enum
  - stripe_payment_intent_id: string
  - purchased_at: datetime
  - created_at, updated_at

# Sponsor
Sponsor
  - id: uuid
  - tournament_id: uuid
  - name: string
  - logo_url: string
  - website_url: string
  - tier: enum (title, platinum, gold, silver, bronze, hole)
  - hole_number: integer (if hole sponsor)
  - amount_cents: integer (internal)
  - display_order: integer
  - created_at, updated_at

# User (Admin)
User
  - id: uuid
  - clerk_id: string
  - email: string
  - name: string
  - role: enum (super_admin, org_admin, tournament_admin)
  - created_at, updated_at
  - has_many :organization_memberships

# OrganizationMembership
OrganizationMembership
  - id: uuid
  - user_id: uuid
  - organization_id: uuid
  - role: enum (admin, member)
  - created_at, updated_at

# TournamentAssignment (for tournament admins)
TournamentAssignment
  - id: uuid
  - user_id: uuid
  - tournament_id: uuid
  - created_at, updated_at

# Course (Reference data)
Course
  - id: uuid
  - name: string
  - address: string
  - city: string
  - holes: integer (9, 18, 27, 36)
  - par: integer
  - slope_rating: decimal
  - course_rating: decimal
  - hole_data: jsonb (par, yardage per hole)
  - created_at, updated_at

# ActivityLog
ActivityLog
  - id: uuid
  - organization_id: uuid
  - tournament_id: uuid (nullable)
  - user_id: uuid (nullable)
  - action: string
  - target_type: string
  - target_id: uuid
  - details: text
  - metadata: jsonb
  - created_at
```

### 6.2 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Organization │───────│  Tournament  │───────│    Golfer    │
└──────────────┘  1:N  └──────────────┘  1:N  └──────────────┘
       │                      │                      │
       │                      │                      │
       │                ┌─────┴─────┐                │
       │                │           │                │
       │          ┌─────┴───┐ ┌─────┴────┐     ┌─────┴─────┐
       │          │  Group  │ │ Sponsor  │     │   Score   │
       │          └─────────┘ └──────────┘     └───────────┘
       │                │
       │                │
       │          ┌─────┴────────┐
       │          │              │
       │    ┌─────┴────┐  ┌──────┴──────┐
       │    │RafflePrize│  │RaffleTicket │
       │    └──────────┘  └─────────────┘
       │
 ┌─────┴─────┐
 │   User    │
 └───────────┘
```

---

## 7. API Design

### 7.1 API Structure

**Base URL:** `api.pacificgolf.com/v1` (or `pacificgolf.com/api/v1`)

**Authentication:**
- Public endpoints: No auth (registration, leaderboard)
- Admin endpoints: Clerk JWT required
- Scorer endpoints: Token-based (PIN or link token)

### 7.2 Key Endpoints

**Organizations**
```
GET    /organizations/:slug              # Public org profile
POST   /organizations                    # Create org (super admin)
PATCH  /organizations/:id                # Update org (org admin)
```

**Tournaments**
```
GET    /organizations/:slug/tournaments           # List tournaments
GET    /organizations/:slug/tournaments/:slug     # Tournament details
POST   /organizations/:org_id/tournaments         # Create tournament
PATCH  /tournaments/:id                           # Update tournament
DELETE /tournaments/:id                           # Archive tournament
```

**Registration**
```
POST   /tournaments/:id/register                  # Register for tournament
GET    /tournaments/:id/registrations             # List registrations (admin)
PATCH  /registrations/:id                         # Update registration
DELETE /registrations/:id                         # Cancel registration
POST   /registrations/:id/check-in               # Check in golfer
```

**Groups**
```
GET    /tournaments/:id/groups                    # List groups
POST   /tournaments/:id/groups                    # Create group
PATCH  /groups/:id                                # Update group
POST   /tournaments/:id/groups/auto-generate      # Auto-create groups
POST   /groups/:id/assign-hole                    # Assign starting hole
```

**Scoring**
```
GET    /tournaments/:id/scores                    # All scores
POST   /scores                                    # Submit score
PATCH  /scores/:id                                # Update score
GET    /tournaments/:id/leaderboard               # Calculated leaderboard
WS     /cable (ScoresChannel)                     # Real-time score updates
```

**Raffle**
```
GET    /tournaments/:id/raffle                    # Raffle info + prizes
POST   /tournaments/:id/raffle/tickets            # Purchase tickets
POST   /tournaments/:id/raffle/draw               # Draw winner (admin)
PATCH  /raffle-prizes/:id/claim                   # Mark claimed
```

**Payments**
```
POST   /checkout/create-intent                    # Create Stripe PaymentIntent
POST   /webhooks/stripe                           # Stripe webhook handler
POST   /registrations/:id/refund                  # Process refund
```

---

## 8. Multi-Tenancy Architecture

### 8.1 Approach: Shared Database, Tenant ID

All tenant data lives in the same database with `organization_id` foreign keys. This is simpler than separate databases and scales fine for our market size.

### 8.2 Data Isolation

```ruby
# All models belong to an organization (directly or through tournament)
class Tournament < ApplicationRecord
  belongs_to :organization
  
  # Default scope ensures tenant isolation
  default_scope { where(organization: Current.organization) if Current.organization }
end

# Controller sets current organization
class ApplicationController < ActionController::API
  before_action :set_current_organization
  
  private
  
  def set_current_organization
    if params[:organization_slug]
      Current.organization = Organization.find_by!(slug: params[:organization_slug])
    end
  end
end
```

### 8.3 URL Structure

**MVP (Path-based):**
```
pacificgolf.com/rotary-guam/tournaments/charity-classic-2026
pacificgolf.com/chamber/tournaments/annual-amateur-2026
```

**Future (Subdomain):**
```
rotary.pacificgolf.com/tournaments/charity-classic-2026
chamber.pacificgolf.com/tournaments/annual-amateur-2026
```

### 8.4 Branding Per Organization

Each org can customize:
- Logo (header, emails)
- Primary color (buttons, links)
- Banner image (tournament pages)

Stored in `organizations` table, applied via CSS custom properties:

```css
:root {
  --org-primary: var(--org-primary-color, #2563eb);
  --org-logo: var(--org-logo-url);
}
```

---

## 9. Real-Time Features

### 9.1 WebSocket Channels (ActionCable)

**ScoresChannel:**
- Broadcast when any score is submitted
- Subscribers: Leaderboard viewers, TV displays
- Payload: `{ tournament_id, group_id, hole, score, leaderboard_position }`

**TournamentChannel:**
- General tournament updates
- Registration count changes
- Check-in updates
- Raffle draws

### 9.2 Implementation

```ruby
# app/channels/scores_channel.rb
class ScoresChannel < ApplicationCable::Channel
  def subscribed
    tournament = Tournament.find(params[:tournament_id])
    stream_for tournament
  end
end

# Broadcasting when score saved
class Score < ApplicationRecord
  after_commit :broadcast_update, on: [:create, :update]
  
  private
  
  def broadcast_update
    ScoresChannel.broadcast_to(
      tournament,
      {
        type: 'score_update',
        group_id: group_id,
        hole: hole_number,
        score: strokes,
        leaderboard: tournament.calculate_leaderboard
      }
    )
  end
end
```

### 9.3 Frontend Subscription

```typescript
// React hook for real-time leaderboard
function useLeaderboard(tournamentId: string) {
  const [leaderboard, setLeaderboard] = useState([]);
  
  useEffect(() => {
    const subscription = cable.subscriptions.create(
      { channel: 'ScoresChannel', tournament_id: tournamentId },
      {
        received(data) {
          if (data.type === 'score_update') {
            setLeaderboard(data.leaderboard);
          }
        }
      }
    );
    
    return () => subscription.unsubscribe();
  }, [tournamentId]);
  
  return leaderboard;
}
```

---

## 10. PWA & Offline Support

### 10.1 PWA Configuration

Following the PWA_SETUP_GUIDE:

```json
// public/manifest.json
{
  "name": "Pacific Golf Scorer",
  "short_name": "PG Scorer",
  "description": "Live golf tournament scoring",
  "start_url": "/score",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#16a34a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 10.2 Offline Scoring (Phase 2)

**Service Worker Strategy:**
1. Cache app shell (HTML, CSS, JS)
2. Cache tournament data on first load
3. Store scores in IndexedDB when offline
4. Sync to server when back online

**User Experience:**
- Clear "Offline" indicator
- Scores save locally instantly
- "Syncing..." indicator when reconnected
- Conflict resolution (server wins, alert user)

### 10.3 Offline Data Storage

```typescript
// IndexedDB schema
const db = {
  pendingScores: [
    {
      id: 'local-uuid',
      tournamentId: 'uuid',
      groupId: 'uuid',
      hole: 7,
      strokes: 4,
      timestamp: '2026-03-15T14:30:00Z',
      synced: false
    }
  ]
};
```

---

## 11. Pricing & Billing

### 11.1 Pricing Model

**Per-Registrant Fee:** $4 per golfer, paid by organization

**Cap:** TBD (likely $400-500 per tournament)

**Examples:**
| Tournament Size | Fee | With $500 Cap |
|-----------------|-----|---------------|
| 40 players | $160 | $160 |
| 80 players | $320 | $320 |
| 120 players | $480 | $480 |
| 144 players | $576 | $500 |

### 11.2 Billing Flow

1. Org creates tournament
2. Golfers register and pay entry fee (goes to org's Stripe)
3. At tournament close, we calculate platform fee
4. Invoice org for platform fee (or auto-charge saved card)

### 11.3 Future: Stripe Connect

When we add Stripe Connect:
- Platform fee automatically deducted from each payment
- Simpler for orgs (no separate invoice)
- Golfer pays $154 → Org gets $150, we get $4

---

## 12. Technical Stack

### 12.1 Backend

| Component | Choice | Reason |
|-----------|--------|--------|
| Framework | Rails 8.1 | Familiar, fast development, ActionCable built-in |
| Database | PostgreSQL | Robust, JSON support, full-text search |
| Auth | Clerk | Already using, multi-tenant ready |
| Payments | Stripe | Best international support, familiar |
| Email | Resend | Simple, great deliverability |
| SMS | Twilio | Industry standard (Phase 2) |
| Background Jobs | Solid Queue | Rails 8 default, simple |
| WebSockets | ActionCable | Built into Rails, works well |
| Caching | Redis | ActionCable adapter, caching |

### 12.2 Frontend

| Component | Choice | Reason |
|-----------|--------|--------|
| Framework | React 18 + TypeScript | Familiar, great ecosystem |
| Build Tool | Vite | Fast, modern |
| Styling | Tailwind CSS | Rapid development, consistent |
| State | Zustand | Simple, lightweight |
| Forms | React Hook Form | Performant, easy validation |
| HTTP | Axios | Familiar, interceptors |
| WebSocket | @rails/actioncable | Official Rails client |
| Icons | Lucide React | Clean, consistent |

### 12.3 Infrastructure

| Component | Choice | Reason |
|-----------|--------|--------|
| Hosting | Render | Simple, auto-deploy, WebSocket support |
| CDN | Cloudflare | Fast, free tier |
| File Storage | AWS S3 + Imgix | Logos, images |
| Monitoring | Sentry | Error tracking |
| Analytics | Plausible | Privacy-friendly |

### 12.4 Monorepo Structure

```
pacific-golf/
├── api/                      # Rails API
│   ├── app/
│   │   ├── channels/         # ActionCable channels
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── services/
│   │   └── views/            # Email templates
│   ├── config/
│   ├── db/
│   └── spec/
├── web/                      # Main React app (admin + public)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── admin/        # Admin dashboard
│   │   │   ├── public/       # Public pages
│   │   │   └── scorer/       # Mobile scoring PWA
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── utils/
│   └── public/
├── marketing/                # Landing page (optional, could be in web/)
├── packages/
│   └── shared/               # Shared types, utilities
├── docs/
│   ├── starter-app/          # Copied from brain-dump
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── BUILD_PLAN.md
├── package.json              # Monorepo root
├── pnpm-workspace.yaml
└── README.md
```

---

## 13. Security & Compliance

### 13.1 Data Protection

- All data encrypted at rest (PostgreSQL)
- HTTPS everywhere
- Stripe handles all payment card data (PCI compliant)
- Personal data (email, phone) only used for tournament communication

### 13.2 Authentication

- Clerk handles all auth
- JWT tokens for API access
- Role-based access control (RBAC)
- Session timeout for admin panels

### 13.3 Multi-Tenant Security

- Tenant isolation at query level
- No cross-tenant data access
- Audit logs for sensitive actions

---

## 14. Open Questions

### Must Resolve Before Building

1. **Domain:** pacificgolf.com? pacificgolf.io? Check availability
2. **Free Tier:** Offer one? What limits? (e.g., 1 tournament, 40 players)
3. **Cap Amount:** $400 or $500 per tournament?
4. **First Pilot:** Rotary? Which event specifically?

### Can Decide Later

5. **Subdomain vs. Path:** Start with path, add subdomain if requested
6. **Native App:** PWA first, native only if strong demand
7. **Stripe Connect Timeline:** When to migrate from direct?
8. **Internationalization:** Japanese? Korean? When?

---

## 15. Out of Scope (V1)

Explicitly NOT building in V1:

- [ ] Native iOS/Android apps
- [ ] USGA GHIN handicap integration
- [ ] Full white-label (custom domains per org)
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations
- [ ] League management (recurring events)
- [ ] Golf GPS/course mapping
- [ ] Betting/skins game money handling
- [ ] Video highlights
- [ ] Social features (comments, likes)

These can be added in V2+ based on customer demand.

---

## Appendix A: User Flows

### A.1 Golfer Registration Flow

```
[Tournament Page]
        │
        ▼
[Select: Individual or Team]
        │
   ┌────┴────┐
   │         │
   ▼         ▼
[Individual] [Team]
   │         │
   ▼         ├─[Create Team]──▶[Invite Members]
[Enter Info] │                        │
   │         └─[Join Existing]───────┘
   ▼                │
[Add-ons]◀──────────┘
(raffle, mulligans)
   │
   ▼
[Accept Waiver]
   │
   ▼
[Payment]
   │
   ▼
[Confirmation Page]
   │
   ▼
[Email Sent]
```

### A.2 Tournament Day Flow (Admin)

```
[Open Dashboard]
        │
        ▼
[Check-In Mode]
   │
   ├──[Scan QR]──▶[Golfer Checked In]
   │
   └──[Search Name]──▶[Manual Check-In]
        │
        ▼
[All Checked In?]
        │
   ┌────┴────┐
   │         │
   No       Yes
   │         │
   ▼         ▼
[Wait]   [Start Tournament]
             │
             ▼
        [Monitor Scores]
             │
             ▼
        [Run Raffle]
             │
             ▼
        [Announce Winners]
             │
             ▼
        [Close Tournament]
```

### A.3 Mobile Scoring Flow (Golfer)

```
[Open Scoring Link]
        │
        ▼
[Find Your Name]
        │
        ▼
[See Your Group + Starting Hole]
        │
        ▼
[Current Hole Display]
        │
   ┌────┴────┐
   │         │
   ▼         ▼
[Enter Score] [View Leaderboard]
   │
   ▼
[Swipe to Next Hole]
   │
   ▼
[Repeat for 18 holes]
   │
   ▼
[Round Complete!]
```

---

## Appendix B: Competitor Feature Comparison

| Feature | Pacific Golf | Golf Genius | BlueGolf | DoJiggy | Event Caddy |
|---------|--------------|-------------|----------|---------|-------------|
| Online Registration | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payment Processing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mobile Scoring | ✅ PWA | ✅ App | ✅ App (poor) | ❌ | ✅ App |
| No Download Needed | ✅ | ❌ | ❌ | ✅ | ❌ |
| Live Leaderboard | ✅ | ✅ | ✅ | ❌ | ✅ |
| TV Display Mode | ✅ | ✅ | ✅ | ❌ | ❌ |
| Digital Raffle | ✅ | ❌ | ❌ | ✅ | ✅ |
| Offline Scoring | ✅ (Phase 2) | ✅ | ? | N/A | ? |
| Scramble Format | ✅ | ✅ | ✅ | Limited | ✅ |
| Sponsor Display | ✅ | ✅ | ✅ | ✅ | ✅ |
| Free Tier | TBD | ❌ | ❌ | ✅ | ✅ |
| Local Support | ✅ Guam | ❌ | ❌ | ❌ | ❌ |
| Price | $4/player | $1,300+/yr | Variable | Free/4.9% | $299-999 |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Jerry | Initial draft |

---

*End of PRD*
