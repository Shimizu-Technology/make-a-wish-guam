# Pacific Golf — Architecture Document

**Version:** 1.0  
**Last Updated:** February 10, 2026  
**Status:** Approved

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Database Schema](#4-database-schema)
5. [Multi-Tenancy](#5-multi-tenancy)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [API Architecture](#7-api-architecture)
8. [Real-Time Architecture](#8-real-time-architecture)
9. [PWA & Offline](#9-pwa--offline)
10. [Payment Flow](#10-payment-flow)
11. [Email & Notifications](#11-email--notifications)
12. [Deployment](#12-deployment)
13. [Security](#13-security)

---

## 1. System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                      │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   Admin Panel   │  Public Pages   │      Mobile Scorer (PWA)        │
│   (React SPA)   │   (React SPA)   │         (React PWA)             │
└────────┬────────┴────────┬────────┴──────────────┬──────────────────┘
         │                 │                        │
         │    HTTPS/WSS   │                        │
         ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RAILS API SERVER                                │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   REST API      │   ActionCable   │      Webhooks                   │
│   /api/v1/*     │   /cable        │      /webhooks/*                │
└────────┬────────┴────────┬────────┴──────────────┬──────────────────┘
         │                 │                        │
         ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA & SERVICES                                 │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│  PostgreSQL  │    Redis     │    Stripe    │    Clerk    │ Resend  │
│  (Primary)   │  (Pub/Sub)   │  (Payments)  │   (Auth)    │ (Email) │
└──────────────┴──────────────┴──────────────┴─────────────┴─────────┘
```

### Request Flow

1. **Admin Panel:** React SPA → Clerk Auth → Rails API → PostgreSQL
2. **Public Registration:** React → Rails API → Stripe → PostgreSQL
3. **Live Scoring:** React PWA → ActionCable (WebSocket) → Rails → Broadcast
4. **Webhooks:** Stripe/Clerk → Rails Webhook Handler → Database Update

---

## 2. Technology Stack

### Backend (api/)

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | Ruby on Rails | 8.1 | API server |
| Ruby | Ruby | 3.3+ | Language |
| Database | PostgreSQL | 16+ | Primary data store |
| Cache/Pub-Sub | Redis | 7+ | ActionCable adapter, caching |
| Background Jobs | Solid Queue | (Rails default) | Async processing |
| WebSockets | ActionCable | (Rails built-in) | Real-time updates |
| Auth | Clerk | SDK | JWT verification |
| Payments | Stripe | API | Payment processing |
| Email | Resend | API | Transactional email |

### Frontend (web/)

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React | 18+ | UI library |
| Language | TypeScript | 5+ | Type safety |
| Build Tool | Vite | 5+ | Fast dev/build |
| Styling | Tailwind CSS | 3+ | Utility CSS |
| State | Zustand | 4+ | Global state |
| Forms | React Hook Form | 7+ | Form handling |
| HTTP Client | Axios | 1+ | API requests |
| WebSocket | @rails/actioncable | 7+ | Real-time |
| Icons | Lucide React | - | SVG icons |
| Router | React Router | 6+ | Navigation |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Hosting | Render | API + Web hosting |
| CDN | Cloudflare | Static assets, DDoS protection |
| File Storage | AWS S3 + Imgix | Logos, images |
| Monitoring | Sentry | Error tracking |
| Analytics | Plausible | Privacy-friendly analytics |
| CI/CD | GitHub Actions | Automated testing/deployment |

---

## 3. Monorepo Structure

```
pacific-golf/
├── api/                          # Rails API
│   ├── app/
│   │   ├── channels/             # ActionCable channels
│   │   │   ├── application_cable/
│   │   │   ├── scores_channel.rb
│   │   │   └── tournament_channel.rb
│   │   ├── controllers/
│   │   │   ├── api/v1/
│   │   │   │   ├── admin/        # Admin endpoints
│   │   │   │   ├── public/       # Public endpoints
│   │   │   │   └── scorer/       # Scorer endpoints
│   │   │   └── webhooks/
│   │   ├── models/
│   │   │   ├── organization.rb   # NEW: Multi-tenant
│   │   │   ├── tournament.rb
│   │   │   ├── golfer.rb
│   │   │   ├── group.rb
│   │   │   ├── score.rb          # NEW: Live scoring
│   │   │   ├── raffle_prize.rb   # NEW: Raffle
│   │   │   ├── raffle_ticket.rb  # NEW: Raffle
│   │   │   └── sponsor.rb        # NEW: Sponsors
│   │   ├── services/
│   │   │   ├── clerk_auth.rb
│   │   │   ├── leaderboard_calculator.rb  # NEW
│   │   │   └── raffle_drawer.rb           # NEW
│   │   └── views/                # Email templates
│   ├── config/
│   ├── db/
│   │   ├── migrate/
│   │   └── seeds.rb
│   └── spec/                     # Tests
│
├── web/                          # React Frontend
│   ├── public/
│   │   ├── manifest.json         # PWA manifest
│   │   └── sw.js                 # Service worker (Phase 2)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/               # Base components
│   │   │   ├── admin/            # Admin components
│   │   │   ├── public/           # Public components
│   │   │   └── scorer/           # Scorer components
│   │   ├── pages/
│   │   │   ├── admin/            # Admin pages
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Tournaments.tsx
│   │   │   │   ├── Registrations.tsx
│   │   │   │   ├── Groups.tsx
│   │   │   │   ├── CheckIn.tsx
│   │   │   │   ├── Leaderboard.tsx
│   │   │   │   ├── Raffle.tsx
│   │   │   │   └── Settings.tsx
│   │   │   ├── public/           # Public pages
│   │   │   │   ├── OrgLanding.tsx
│   │   │   │   ├── TournamentPage.tsx
│   │   │   │   ├── Register.tsx
│   │   │   │   └── Leaderboard.tsx
│   │   │   └── scorer/           # Mobile scorer
│   │   │       ├── ScorerEntry.tsx
│   │   │       ├── ScorerHome.tsx
│   │   │       └── HoleScorer.tsx
│   │   ├── hooks/
│   │   │   ├── useApi.ts
│   │   │   ├── useAuth.ts
│   │   │   ├── useScores.ts
│   │   │   └── useLeaderboard.ts
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   ├── tournamentStore.ts
│   │   │   └── scorerStore.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── cable.ts
│   │   └── types/
│   │       └── index.ts
│   └── vite.config.ts
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md           # This file
│   ├── BUILD_PLAN.md
│   └── starter-app/              # Development guides
│
├── package.json                  # Monorepo root
├── pnpm-workspace.yaml
├── AGENTS.md
└── README.md
```

---

## 4. Database Schema

### Entity Relationship Diagram

```
┌──────────────────┐
│   Organization   │
│──────────────────│
│ id (PK)          │
│ name             │
│ slug (unique)    │
│ logo_url         │
│ primary_color    │
│ settings (jsonb) │
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────┐       ┌──────────────────┐
│    Tournament    │       │       User       │
│──────────────────│       │──────────────────│
│ id (PK)          │       │ id (PK)          │
│ organization_id  │◀──────│ clerk_id         │
│ name             │       │ email            │
│ slug             │       │ role             │
│ event_date       │       └──────────────────┘
│ format           │              │
│ entry_fee_cents  │              │ N:M (org_memberships)
│ max_capacity     │              ▼
│ settings (jsonb) │       ┌──────────────────┐
└────────┬─────────┘       │ OrgMembership    │
         │                 └──────────────────┘
         │ 1:N
    ┌────┴────┬─────────────┬─────────────┐
    ▼         ▼             ▼             ▼
┌────────┐ ┌────────┐ ┌───────────┐ ┌──────────┐
│ Golfer │ │ Group  │ │  Sponsor  │ │RafflePrize│
└────┬───┘ └────┬───┘ └───────────┘ └──────────┘
     │          │                          │
     │    ┌─────┘                          │
     ▼    ▼                                ▼
  ┌────────────┐                    ┌──────────────┐
  │   Score    │                    │ RaffleTicket │
  └────────────┘                    └──────────────┘
```

### Core Tables

#### organizations
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  logo_url VARCHAR,
  primary_color VARCHAR DEFAULT '#2563eb',
  banner_url VARCHAR,
  description TEXT,
  contact_email VARCHAR,
  contact_phone VARCHAR,
  website_url VARCHAR,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_organizations_slug ON organizations(slug);
```

#### tournaments
```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL,
  edition VARCHAR,
  event_date DATE,
  registration_opens_at TIMESTAMP,
  registration_closes_at TIMESTAMP,
  venue_name VARCHAR,
  venue_address VARCHAR,
  format VARCHAR DEFAULT 'scramble',  -- scramble, stroke, stableford, match, best_ball
  scoring_type VARCHAR DEFAULT 'gross', -- gross, net, both
  max_capacity INTEGER,
  reserved_slots INTEGER DEFAULT 0,
  entry_fee_cents INTEGER DEFAULT 0,
  team_size INTEGER DEFAULT 4,
  allow_partial_teams BOOLEAN DEFAULT true,
  waitlist_enabled BOOLEAN DEFAULT true,
  scoring_enabled BOOLEAN DEFAULT false,
  raffle_enabled BOOLEAN DEFAULT false,
  status VARCHAR DEFAULT 'draft',  -- draft, open, closed, in_progress, completed, archived
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(organization_id, slug)
);
CREATE INDEX idx_tournaments_org ON tournaments(organization_id);
CREATE INDEX idx_tournaments_status ON tournaments(status);
```

#### golfers
```sql
CREATE TABLE golfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  group_id UUID REFERENCES groups(id),
  user_id UUID REFERENCES users(id),  -- nullable, links to registered user
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  phone VARCHAR NOT NULL,
  company VARCHAR,
  handicap DECIMAL(4,1),
  shirt_size VARCHAR,
  dietary_restrictions TEXT,
  registration_type VARCHAR DEFAULT 'individual', -- individual, team_captain, team_member
  registration_status VARCHAR DEFAULT 'confirmed', -- confirmed, waitlist, cancelled
  payment_status VARCHAR DEFAULT 'unpaid', -- unpaid, paid, refunded
  payment_type VARCHAR, -- stripe, cash, check, complimentary
  payment_amount_cents INTEGER,
  stripe_payment_intent_id VARCHAR,
  checked_in_at TIMESTAMP,
  waiver_accepted_at TIMESTAMP,
  position INTEGER,  -- position within group
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(tournament_id, email)
);
CREATE INDEX idx_golfers_tournament ON golfers(tournament_id);
CREATE INDEX idx_golfers_group ON golfers(group_id);
CREATE INDEX idx_golfers_status ON golfers(registration_status, payment_status);
```

#### groups
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  group_number INTEGER NOT NULL,
  team_name VARCHAR,
  starting_hole INTEGER,  -- 1-18 for shotgun
  tee_time TIME,          -- for tee time starts
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(tournament_id, group_number)
);
CREATE INDEX idx_groups_tournament ON groups(tournament_id);
```

#### scores
```sql
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  golfer_id UUID REFERENCES golfers(id),  -- null for scramble (team score)
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes INTEGER NOT NULL CHECK (strokes > 0),
  relative_to_par INTEGER,  -- calculated: strokes - par
  entered_by_user_id UUID REFERENCES users(id),
  entered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(group_id, golfer_id, hole_number)  -- one score per golfer per hole
);
CREATE INDEX idx_scores_tournament ON scores(tournament_id);
CREATE INDEX idx_scores_group ON scores(group_id);
```

#### raffle_prizes
```sql
CREATE TABLE raffle_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  sponsor_id UUID REFERENCES sponsors(id),
  name VARCHAR NOT NULL,
  description TEXT,
  image_url VARCHAR,
  tier INTEGER DEFAULT 1,  -- 1 = grand prize, 2 = second, etc.
  value_cents INTEGER,
  winner_golfer_id UUID REFERENCES golfers(id),
  drawn_at TIMESTAMP,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_raffle_prizes_tournament ON raffle_prizes(tournament_id);
```

#### raffle_tickets
```sql
CREATE TABLE raffle_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  golfer_id UUID NOT NULL REFERENCES golfers(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL,
  payment_status VARCHAR DEFAULT 'unpaid',
  stripe_payment_intent_id VARCHAR,
  purchased_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_raffle_tickets_tournament ON raffle_tickets(tournament_id);
CREATE INDEX idx_raffle_tickets_golfer ON raffle_tickets(golfer_id);
```

#### sponsors
```sql
CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  name VARCHAR NOT NULL,
  logo_url VARCHAR,
  website_url VARCHAR,
  tier VARCHAR DEFAULT 'bronze',  -- title, platinum, gold, silver, bronze, hole
  hole_number INTEGER,  -- if hole sponsor
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_sponsors_tournament ON sponsors(tournament_id);
```

#### users (admins)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id VARCHAR NOT NULL UNIQUE,
  email VARCHAR NOT NULL,
  name VARCHAR,
  role VARCHAR DEFAULT 'org_admin',  -- super_admin, org_admin, tournament_admin
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_users_clerk ON users(clerk_id);
```

#### organization_memberships
```sql
CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  role VARCHAR DEFAULT 'member',  -- admin, member
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(user_id, organization_id)
);
```

---

## 5. Multi-Tenancy

### Approach: Shared Database with Tenant Scoping

All organizations share the same database. Data isolation is enforced at the application layer using `organization_id` foreign keys.

### Implementation

#### Current Tenant Context
```ruby
# app/models/current.rb
class Current < ActiveSupport::CurrentAttributes
  attribute :organization
  attribute :user
end
```

#### Controller Setup
```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  before_action :set_current_organization

  private

  def set_current_organization
    if params[:organization_slug]
      Current.organization = Organization.find_by!(slug: params[:organization_slug])
    elsif current_user&.organizations&.one?
      Current.organization = current_user.organizations.first
    end
  end
end
```

#### Model Scoping
```ruby
# app/models/tournament.rb
class Tournament < ApplicationRecord
  belongs_to :organization

  # Automatic scoping to current organization
  default_scope -> { where(organization: Current.organization) if Current.organization }
end
```

### URL Structure

**Pattern:** `/:organization_slug/tournaments/:tournament_slug`

**Examples:**
- `pacificgolf.io/rotary-guam/tournaments/charity-classic-2026`
- `pacificgolf.io/chamber/tournaments/annual-amateur`

**API Routes:**
- `GET /api/v1/organizations/:slug` — Public org info
- `GET /api/v1/organizations/:slug/tournaments` — Public tournament list
- `GET /api/v1/admin/tournaments` — Admin's tournaments (scoped by membership)

---

## 6. Authentication & Authorization

### Auth Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│    Clerk    │────▶│  Rails API  │
│             │◀────│   (Auth)    │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  1. Login         │                   │
       │──────────────────▶│                   │
       │                   │                   │
       │  2. JWT Token     │                   │
       │◀──────────────────│                   │
       │                   │                   │
       │  3. API Request + JWT                 │
       │───────────────────────────────────────▶
       │                   │                   │
       │                   │  4. Verify JWT    │
       │                   │◀──────────────────│
       │                   │                   │
       │  5. Response      │                   │
       │◀──────────────────────────────────────│
```

### JWT Verification
```ruby
# app/services/clerk_auth.rb
class ClerkAuth
  def self.verify(token)
    # Decode and verify Clerk JWT
    decoded = JWT.decode(
      token,
      clerk_public_key,
      true,
      { algorithm: 'RS256' }
    )
    decoded.first
  rescue JWT::DecodeError
    nil
  end
end
```

### Role-Based Access
```ruby
# app/controllers/concerns/authorized.rb
module Authorized
  extend ActiveSupport::Concern

  def authorize_org_admin!
    unless current_user&.org_admin_for?(Current.organization)
      render json: { error: 'Forbidden' }, status: :forbidden
    end
  end

  def authorize_tournament_admin!(tournament)
    unless current_user&.can_manage?(tournament)
      render json: { error: 'Forbidden' }, status: :forbidden
    end
  end
end
```

### Public vs. Authenticated Endpoints

| Endpoint | Auth Required | Notes |
|----------|---------------|-------|
| `GET /organizations/:slug` | No | Public org profile |
| `GET /tournaments/:id` | No | Public tournament info |
| `POST /tournaments/:id/register` | No | Guest registration |
| `GET /tournaments/:id/leaderboard` | No | Public leaderboard |
| `GET /admin/tournaments` | Yes | Admin only |
| `POST /scores` | Token | Scorer token auth |

---

## 7. API Architecture

### RESTful Conventions

**Base URL:** `/api/v1`

**Response Format:**
```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```

**Error Format:**
```json
{
  "error": {
    "code": "validation_failed",
    "message": "Email has already been taken",
    "details": {
      "email": ["has already been taken"]
    }
  }
}
```

### Key Endpoints

#### Organizations
```
GET    /organizations/:slug                    # Public org info
PATCH  /admin/organizations/:id               # Update org (admin)
```

#### Tournaments
```
GET    /organizations/:slug/tournaments        # List public tournaments
GET    /tournaments/:id                        # Tournament details
POST   /admin/tournaments                      # Create tournament
PATCH  /admin/tournaments/:id                 # Update tournament
DELETE /admin/tournaments/:id                 # Archive tournament
```

#### Registration
```
POST   /tournaments/:id/register              # Register for tournament
GET    /admin/tournaments/:id/golfers         # List registrations
PATCH  /admin/golfers/:id                     # Update registration
DELETE /admin/golfers/:id                     # Cancel registration
POST   /admin/golfers/:id/check-in           # Check in golfer
POST   /admin/golfers/:id/refund             # Process refund
```

#### Groups
```
GET    /admin/tournaments/:id/groups          # List groups
POST   /admin/tournaments/:id/groups          # Create group
PATCH  /admin/groups/:id                      # Update group
POST   /admin/tournaments/:id/auto-group     # Auto-generate groups
```

#### Scoring
```
GET    /tournaments/:id/scores                # All scores (public)
POST   /scorer/scores                         # Submit score (token auth)
PATCH  /scorer/scores/:id                     # Update score
GET    /tournaments/:id/leaderboard          # Calculated leaderboard
```

#### Raffle
```
GET    /tournaments/:id/raffle               # Raffle info + prizes
POST   /tournaments/:id/raffle/tickets       # Purchase tickets
POST   /admin/tournaments/:id/raffle/draw   # Draw winner
PATCH  /admin/raffle-prizes/:id/claim       # Mark claimed
```

---

## 8. Real-Time Architecture

### ActionCable Channels

#### ScoresChannel
```ruby
# app/channels/scores_channel.rb
class ScoresChannel < ApplicationCable::Channel
  def subscribed
    tournament = Tournament.find(params[:tournament_id])
    stream_for tournament
  end
end

# Broadcasting
ScoresChannel.broadcast_to(tournament, {
  type: 'score_update',
  group_id: score.group_id,
  hole: score.hole_number,
  strokes: score.strokes,
  leaderboard: tournament.calculate_leaderboard
})
```

#### TournamentChannel
```ruby
# app/channels/tournament_channel.rb
class TournamentChannel < ApplicationCable::Channel
  def subscribed
    tournament = Tournament.find(params[:tournament_id])
    stream_for tournament
  end
end

# Broadcasts for:
# - New registrations
# - Check-ins
# - Raffle draws
# - Status changes
```

### Frontend Subscription
```typescript
// hooks/useLeaderboard.ts
export function useLeaderboard(tournamentId: string) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  useEffect(() => {
    const cable = createConsumer(WS_URL);
    const subscription = cable.subscriptions.create(
      { channel: 'ScoresChannel', tournament_id: tournamentId },
      {
        received(data: ScoreUpdate) {
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

### Leaderboard Calculation
```ruby
# app/services/leaderboard_calculator.rb
class LeaderboardCalculator
  def initialize(tournament)
    @tournament = tournament
  end

  def calculate
    case @tournament.format
    when 'scramble'
      calculate_scramble_leaderboard
    when 'stroke'
      calculate_stroke_leaderboard
    when 'stableford'
      calculate_stableford_leaderboard
    end
  end

  private

  def calculate_scramble_leaderboard
    @tournament.groups.includes(:scores).map do |group|
      total = group.scores.sum(:strokes)
      holes_played = group.scores.distinct.count(:hole_number)
      relative = group.scores.sum(:relative_to_par)
      
      {
        position: nil,  # calculated after sorting
        group_id: group.id,
        team_name: group.team_name || "Group #{group.group_number}",
        total_strokes: total,
        relative_to_par: relative,
        holes_played: holes_played
      }
    end.sort_by { |e| [e[:total_strokes], -e[:holes_played]] }
       .each_with_index { |e, i| e[:position] = i + 1 }
  end
end
```

---

## 9. PWA & Offline

### PWA Manifest
```json
{
  "name": "Pacific Golf Scorer",
  "short_name": "PG Scorer",
  "description": "Live golf tournament scoring",
  "start_url": "/score",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#16a34a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Offline Strategy (Phase 2)

```typescript
// Service Worker Strategy
// 1. Cache app shell on install
// 2. Cache tournament data on first load
// 3. Store scores in IndexedDB when offline
// 4. Sync to server when reconnected

// IndexedDB Schema
interface PendingScore {
  id: string;
  tournamentId: string;
  groupId: string;
  hole: number;
  strokes: number;
  timestamp: string;
  synced: boolean;
}

// Sync Logic
async function syncPendingScores() {
  const pending = await db.pendingScores.filter(s => !s.synced).toArray();
  for (const score of pending) {
    try {
      await api.post('/scorer/scores', score);
      await db.pendingScores.update(score.id, { synced: true });
    } catch (e) {
      // Will retry on next sync
    }
  }
}
```

---

## 10. Payment Flow

### Registration Payment

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │  Rails API  │     │   Stripe    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ 1. Submit Registration               │
       │──────────────────▶│                   │
       │                   │                   │
       │                   │ 2. Create PaymentIntent
       │                   │──────────────────▶│
       │                   │                   │
       │                   │ 3. client_secret  │
       │                   │◀──────────────────│
       │                   │                   │
       │ 4. client_secret  │                   │
       │◀──────────────────│                   │
       │                   │                   │
       │ 5. Confirm Payment (Stripe.js)        │
       │───────────────────────────────────────▶
       │                   │                   │
       │ 6. Payment Result │                   │
       │◀──────────────────────────────────────│
       │                   │                   │
       │                   │ 7. Webhook: payment_intent.succeeded
       │                   │◀──────────────────│
       │                   │                   │
       │                   │ 8. Update golfer.payment_status = 'paid'
       │                   │                   │
```

### Webhook Handler
```ruby
# app/controllers/webhooks/stripe_controller.rb
class Webhooks::StripeController < ApplicationController
  def create
    event = Stripe::Webhook.construct_event(
      request.body.read,
      request.headers['Stripe-Signature'],
      ENV['STRIPE_WEBHOOK_SECRET']
    )

    case event.type
    when 'payment_intent.succeeded'
      handle_payment_success(event.data.object)
    when 'payment_intent.payment_failed'
      handle_payment_failure(event.data.object)
    end

    head :ok
  end

  private

  def handle_payment_success(payment_intent)
    golfer = Golfer.find_by(stripe_payment_intent_id: payment_intent.id)
    return unless golfer

    golfer.update!(
      payment_status: 'paid',
      payment_amount_cents: payment_intent.amount
    )
    
    GolferMailer.payment_confirmation(golfer).deliver_later
  end
end
```

---

## 11. Email & Notifications

### Email Templates

| Email | Trigger | Recipient |
|-------|---------|-----------|
| Registration Confirmation | After registration | Golfer |
| Payment Confirmation | After payment | Golfer |
| Tournament Reminder | 1 day before | All golfers |
| Check-in Instructions | Morning of | All golfers |
| Raffle Winner | After draw | Winner |
| Results Summary | After tournament | All golfers |

### Implementation
```ruby
# app/mailers/golfer_mailer.rb
class GolferMailer < ApplicationMailer
  def confirmation(golfer)
    @golfer = golfer
    @tournament = golfer.tournament
    @organization = @tournament.organization
    
    mail(
      to: golfer.email,
      subject: "Registration Confirmed: #{@tournament.name}"
    )
  end
end
```

### SMS (Phase 2)
```ruby
# app/services/sms_service.rb
class SmsService
  def self.send(to:, message:)
    Twilio::REST::Client.new(
      ENV['TWILIO_ACCOUNT_SID'],
      ENV['TWILIO_AUTH_TOKEN']
    ).messages.create(
      from: ENV['TWILIO_PHONE_NUMBER'],
      to: to,
      body: message
    )
  end
end
```

---

## 12. Deployment

### Render Configuration

**API Service:**
```yaml
# render.yaml (API)
services:
  - type: web
    name: pacific-golf-api
    env: ruby
    buildCommand: bundle install && rails db:migrate
    startCommand: bundle exec puma -C config/puma.rb
    envVars:
      - key: RAILS_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: pacific-golf-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: pacific-golf-redis
          type: redis
          property: connectionString
```

**Frontend:**
```yaml
# render.yaml (Web)
services:
  - type: static
    name: pacific-golf-web
    buildCommand: npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

### Environment Variables

```bash
# API
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
RAILS_MASTER_KEY=...

# Frontend
VITE_API_URL=https://api.pacificgolf.io
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
```

---

## 13. Security

### Data Protection

- **Encryption at rest:** PostgreSQL encryption
- **Encryption in transit:** TLS/HTTPS everywhere
- **Payment data:** Never stored, handled by Stripe
- **Sensitive data:** API keys in environment variables

### Input Validation

```ruby
# Strong parameters in controllers
def golfer_params
  params.require(:golfer).permit(
    :name, :email, :phone, :company, :handicap,
    :shirt_size, :dietary_restrictions
  )
end

# Model validations
class Golfer < ApplicationRecord
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :phone, presence: true
  validates :name, presence: true, length: { maximum: 100 }
end
```

### Rate Limiting

```ruby
# config/initializers/rack_attack.rb
Rack::Attack.throttle('registrations/ip', limit: 10, period: 1.minute) do |req|
  req.ip if req.path == '/api/v1/tournaments/:id/register' && req.post?
end
```

### Audit Logging

```ruby
# app/models/activity_log.rb
class ActivityLog < ApplicationRecord
  belongs_to :organization
  belongs_to :tournament, optional: true
  belongs_to :user, optional: true

  # Log sensitive actions
  def self.log(action:, target:, user: nil, details: nil)
    create!(
      organization: Current.organization,
      tournament: target.try(:tournament) || target,
      user: user || Current.user,
      action: action,
      target_type: target.class.name,
      target_id: target.id,
      details: details
    )
  end
end
```

---

## Appendix: Migration from GIAA

### What Changes

| Component | GIAA (Current) | Pacific Golf (New) |
|-----------|----------------|-------------------|
| Tenant Model | Single tenant | Multi-tenant (Organization) |
| Settings | Global Settings table | Per-org + per-tournament |
| Employee Numbers | GIAA-specific | Remove |
| Entry Fees | Hardcoded tiers | Configurable per-tournament |
| Formats | Individual Callaway only | Multiple formats |
| Scoring | None | Live scoring + leaderboard |
| Raffle | None | Full raffle system |
| Sponsors | None | Sponsor management |

### Migration Path

1. **Add Organization model** — New table, seed default org
2. **Add organization_id to tournaments** — Migration + backfill
3. **Remove employee_numbers table** — Not needed for SaaS
4. **Remove Settings singleton** — Move to org/tournament settings
5. **Add Score model** — New table
6. **Add Raffle models** — New tables
7. **Add Sponsor model** — New table
8. **Update User model** — Add org memberships

---

*End of Architecture Document*
