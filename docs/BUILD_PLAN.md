# Pacific Golf — Build Plan

**Version:** 1.0  
**Last Updated:** February 10, 2026  
**Status:** Ready to Execute

---

## Overview

This document outlines the phased development plan for Pacific Golf, transforming the GIAA Tournament Software into a multi-tenant SaaS platform.

**Estimated Total Duration:** 6-8 weeks  
**Target:** Ready for Rotary pilot tournament

---

## Phase 0: Project Setup (Day 1)
*Foundation and cleanup*

### 0.1 Repository Setup
- [x] Fork GIAA repos into `pacific-golf` monorepo
- [x] Set up monorepo structure (api/, web/, docs/)
- [x] Create PRD.md
- [x] Create ARCHITECTURE.md
- [x] Create BUILD_PLAN.md
- [x] Copy starter-app docs
- [x] Push to GitHub

### 0.2 Development Environment
- [ ] Update api/README.md with setup instructions
- [ ] Update web/README.md with setup instructions
- [x] Create `.env.example` files with all required vars
- [ ] Verify local development works (api + web)
- [ ] Set up database locally

### 0.3 Cleanup GIAA-Specific Code
- [x] Remove `employee_numbers` table and model
- [x] Remove employee discount logic from registration
- [x] Remove GIAA branding/images from frontend (index.html done, components pending)
- [ ] Remove hardcoded GIAA settings
- [ ] Update email templates to be generic
- [ ] Clean up unused GIAA-specific components

**Checkpoint:** Clean codebase ready for multi-tenant transformation

---

## Phase 1: Multi-Tenancy Foundation (Week 1)
*Core multi-tenant architecture*

### 1.1 Organization Model
- [ ] Create `organizations` table migration
- [ ] Create `Organization` model with validations
- [ ] Add slug generation (friendly URLs)
- [ ] Add logo_url, primary_color, settings fields
- [ ] Create `Current.organization` context
- [ ] Seed a default organization for testing

### 1.2 Tournament Scoping
- [ ] Add `organization_id` to tournaments table
- [ ] Update `Tournament` model with `belongs_to :organization`
- [ ] Add default scope for organization isolation
- [ ] Update tournament routes to include org slug
- [ ] Update controllers to set current organization
- [ ] Test data isolation between orgs

### 1.3 User & Membership System
- [ ] Create `organization_memberships` table
- [ ] Update `User` model (rename from Admin)
- [ ] Add `role` field (super_admin, org_admin, tournament_admin)
- [ ] Create `OrganizationMembership` model
- [ ] Update Clerk auth to handle org context
- [ ] Create membership management endpoints

### 1.4 API Route Restructure
- [ ] Create `/api/v1/organizations/:slug` routes
- [ ] Create `/api/v1/admin/*` routes (authenticated)
- [ ] Create `/api/v1/public/*` routes (no auth)
- [ ] Update existing controllers to new structure
- [ ] Add organization context middleware
- [ ] Update API documentation

### 1.5 Frontend Multi-Tenant Support
- [ ] Create organization context provider
- [ ] Update API client to include org slug
- [ ] Create org-aware routing (`/:orgSlug/...`)
- [ ] Update auth flow for org context
- [ ] Create org branding provider (colors, logo)
- [ ] Apply dynamic branding to components

**Checkpoint:** Multiple organizations can exist with isolated data

---

## Phase 2: Tournament Configuration (Week 2)
*Flexible tournament setup*

### 2.1 Tournament Formats
- [ ] Add `format` enum to tournaments (scramble, stroke, stableford, best_ball, match)
- [ ] Add `scoring_type` enum (gross, net, both)
- [ ] Add `team_size` field (default 4)
- [ ] Add `allow_partial_teams` boolean
- [ ] Create format-specific validation rules
- [ ] Update tournament form with format selection

### 2.2 Tournament Settings
- [ ] Move hardcoded settings to tournament.settings JSONB
- [ ] Add registration time windows
- [ ] Add venue information fields
- [ ] Add contact information fields
- [ ] Add fee configuration (entry_fee_cents, early_bird)
- [ ] Create tournament settings UI

### 2.3 Tournament Creation Wizard
- [ ] Design multi-step wizard UI
- [ ] Step 1: Basic Info (name, date, venue)
- [ ] Step 2: Format & Rules
- [ ] Step 3: Capacity & Fees
- [ ] Step 4: Schedule
- [ ] Step 5: Review & Create
- [ ] Add tournament edit mode

### 2.4 Tournament Status Flow
- [ ] Implement status machine (draft → open → closed → in_progress → completed → archived)
- [ ] Add status transition validations
- [ ] Create status badge component
- [ ] Add "Open Registration" action
- [ ] Add "Close Registration" action
- [ ] Add "Start Tournament" action

**Checkpoint:** Tournaments can be created with various formats and configurations

---

## Phase 3: Registration Flow (Week 2-3)
*Adapt existing registration for multi-tenant*

### 3.1 Public Tournament Pages
- [ ] Create organization landing page (`/:orgSlug`)
- [ ] Create tournament list page
- [ ] Create tournament detail page
- [ ] Display tournament info, schedule, fees
- [ ] Show registration status (open/closed/full)
- [ ] Apply organization branding

### 3.2 Registration Form Updates
- [ ] Remove GIAA-specific fields (employee number)
- [ ] Make fields configurable per tournament
- [ ] Add handicap field (optional based on format)
- [ ] Add shirt size field (optional)
- [ ] Add dietary restrictions (optional)
- [ ] Add custom fields support (tournament.settings)

### 3.3 Team Registration
- [ ] Create team registration flow
- [ ] Team captain creates team
- [ ] Option to add members directly
- [ ] Option to invite members via email
- [ ] Team management page (captain view)
- [ ] Join existing team flow

### 3.4 Payment Integration
- [ ] Update Stripe integration for multi-tenant
- [ ] Support per-tournament Stripe keys (future)
- [ ] Update payment confirmation flow
- [ ] Update refund flow
- [ ] Test full payment cycle

### 3.5 Waitlist
- [ ] Implement waitlist when at capacity
- [ ] Auto-promote when spot opens (optional)
- [ ] Waitlist notification emails
- [ ] Admin waitlist management

**Checkpoint:** Full registration flow working for any tournament

---

## Phase 4: Admin Dashboard (Week 3)
*Organization and tournament management*

### 4.1 Organization Dashboard
- [ ] Create org dashboard layout
- [ ] Show all tournaments (past, current, upcoming)
- [ ] Quick stats (total registrations, revenue)
- [ ] Recent activity feed
- [ ] Organization settings page

### 4.2 Tournament Dashboard
- [ ] Registration summary (count, revenue)
- [ ] Recent registrations list
- [ ] Quick actions (check-in, groups, etc.)
- [ ] Status controls

### 4.3 Registration Management
- [ ] Registrations list with search/filter
- [ ] Registration detail view
- [ ] Edit registration
- [ ] Cancel/refund registration
- [ ] Manual registration (admin adds golfer)
- [ ] CSV export

### 4.4 Check-In System
- [ ] Check-in dashboard
- [ ] Search by name
- [ ] Quick check-in toggle
- [ ] Payment status display
- [ ] Collect payment on check-in
- [ ] Check-in stats

### 4.5 Group Management
- [ ] Groups list view
- [ ] Create/edit groups
- [ ] Drag-and-drop golfer assignment
- [ ] Auto-generate groups button
- [ ] Hole assignment interface
- [ ] Print pairing sheets

**Checkpoint:** Full admin experience for managing tournaments

---

## Phase 5: Live Scoring (Week 4-5)
*Mobile scoring PWA and real-time leaderboard*

### 5.1 Score Model & API
- [ ] Create `scores` table migration
- [ ] Create `Score` model
- [ ] Score validation (1-18 holes, positive strokes)
- [ ] Create scorer authentication (token-based)
- [ ] POST /scorer/scores endpoint
- [ ] GET /tournaments/:id/scores endpoint

### 5.2 Leaderboard Calculation
- [ ] Create `LeaderboardCalculator` service
- [ ] Implement scramble leaderboard
- [ ] Implement stroke play leaderboard
- [ ] Implement stableford leaderboard
- [ ] Handle ties / tie-breakers
- [ ] Cache leaderboard results

### 5.3 ActionCable Setup
- [ ] Create `ScoresChannel`
- [ ] Broadcast on score create/update
- [ ] Include leaderboard in broadcast
- [ ] Create `TournamentChannel` for general updates
- [ ] Frontend WebSocket connection
- [ ] Connection status indicator

### 5.4 Mobile Scorer PWA
- [ ] Create scorer entry page (find name / enter PIN)
- [ ] Create scorer home (show group, starting hole)
- [ ] Create hole scoring UI
  - [ ] Large score display
  - [ ] +/- buttons for increment
  - [ ] Swipe between holes
  - [ ] Hole info (par, yardage)
- [ ] Auto-save scores
- [ ] Score confirmation feedback
- [ ] PWA manifest for installability

### 5.5 Public Leaderboard
- [ ] Create leaderboard page
- [ ] Real-time updates via WebSocket
- [ ] Position, team/name, score, thru holes
- [ ] Filter by flight/division
- [ ] Movement indicators (↑↓)
- [ ] Mobile-responsive design

### 5.6 TV Display Mode
- [ ] Create full-screen leaderboard view
- [ ] Large fonts, high contrast
- [ ] Auto-scroll through standings
- [ ] Sponsor logo rotation
- [ ] Tournament branding
- [ ] `/leaderboard/tv` route

**Checkpoint:** Live scoring working with real-time leaderboard

---

## Phase 6: Digital Raffle (Week 5-6)
*Ticket purchase and auto-draw*

### 6.1 Raffle Models
- [ ] Create `raffle_prizes` table
- [ ] Create `raffle_tickets` table
- [ ] Create `RafflePrize` model
- [ ] Create `RaffleTicket` model
- [ ] Add `raffle_enabled` to tournaments

### 6.2 Prize Management
- [ ] Create prize CRUD endpoints
- [ ] Admin prize management UI
- [ ] Prize tiers (grand prize, 2nd, 3rd)
- [ ] Prize images
- [ ] Sponsor attribution

### 6.3 Ticket Purchase
- [ ] Add raffle tickets to registration (add-on)
- [ ] Standalone ticket purchase page
- [ ] Stripe payment for tickets
- [ ] Purchase confirmation email

### 6.4 Drawing System
- [ ] Create `RaffleDrawer` service
- [ ] Random winner selection
- [ ] Manual draw trigger (admin)
- [ ] Scheduled auto-draw (optional)
- [ ] Drawing animation (frontend)
- [ ] Winner display

### 6.5 Winner Notification
- [ ] Email winner immediately
- [ ] SMS winner (Phase 2 - Twilio)
- [ ] Display winner on raffle board
- [ ] Mark prize as claimed

### 6.6 Raffle Board Display
- [ ] Create raffle board page
- [ ] Show prizes with images
- [ ] Countdown to draw time
- [ ] Winner reveals
- [ ] Sponsor logos

**Checkpoint:** Full raffle system working

---

## Phase 7: Sponsors (Week 6)
*Sponsor management and display*

### 7.1 Sponsor Model
- [ ] Create `sponsors` table
- [ ] Create `Sponsor` model
- [ ] Sponsor tiers (title, platinum, gold, silver, bronze, hole)
- [ ] Logo upload to S3/Imgix

### 7.2 Admin Management
- [ ] Sponsor CRUD endpoints
- [ ] Admin sponsor management UI
- [ ] Logo upload
- [ ] Tier assignment
- [ ] Hole assignment (for hole sponsors)

### 7.3 Sponsor Display
- [ ] Sponsor section on tournament page
- [ ] Sponsor logos on leaderboard
- [ ] Sponsor rotation on TV display
- [ ] Sponsor attribution on raffle prizes
- [ ] Sponsor wall page

**Checkpoint:** Sponsors can be managed and displayed

---

## Phase 8: Polish & Testing (Week 7)
*Quality assurance and refinement*

### 8.1 Email Templates
- [ ] Registration confirmation
- [ ] Payment confirmation
- [ ] Tournament reminder (1 day before)
- [ ] Day-of instructions
- [ ] Raffle winner notification
- [ ] Results summary

### 8.2 Error Handling
- [ ] API error responses standardized
- [ ] Frontend error boundaries
- [ ] Form validation messages
- [ ] Network error handling
- [ ] Offline indicator (scorer)

### 8.3 Loading States
- [ ] Skeleton loaders for lists
- [ ] Button loading states
- [ ] Page transition loading
- [ ] Score submission feedback

### 8.4 Responsive Design
- [ ] Mobile registration flow
- [ ] Mobile admin (basic)
- [ ] Tablet admin (full)
- [ ] TV display mode
- [ ] Print stylesheets

### 8.5 Testing
- [x] Model validation tests (Organization, Sponsor, RafflePrize)
- [x] Fix test fixtures (Admin → User, add organizations)
- [x] RafflePrize draw/reset/claim tests
- [ ] API endpoint tests
- [ ] Leaderboard calculation tests
- [ ] E2E registration flow test
- [ ] E2E scoring flow test

### 8.6 Documentation
- [x] API documentation (docs/API.md)
- [x] README.md with full setup instructions
- [ ] Admin user guide
- [ ] Scorer user guide
- [ ] Deployment guide

**Checkpoint:** Production-ready quality

---

## Phase 9: Deployment (Week 8)
*Production environment setup*

### 9.1 Infrastructure
- [ ] Create Render account/project
- [ ] Set up PostgreSQL database
- [ ] Set up Redis instance
- [ ] Configure environment variables
- [ ] Set up Cloudflare DNS

### 9.2 API Deployment
- [ ] Deploy Rails API to Render
- [ ] Run migrations
- [ ] Verify health check
- [ ] Test API endpoints

### 9.3 Frontend Deployment
- [ ] Build frontend for production
- [ ] Deploy to Render static site
- [ ] Configure SPA routing
- [ ] Verify all pages load

### 9.4 Domain Setup
- [ ] Purchase domain (pacificgolf.io or similar)
- [ ] Configure DNS
- [ ] Set up SSL
- [ ] Verify HTTPS everywhere

### 9.5 Monitoring
- [ ] Set up Sentry error tracking
- [ ] Set up Plausible analytics
- [ ] Configure alerting

### 9.6 Seed Production Data
- [ ] Create Rotary organization
- [ ] Create test tournament
- [ ] Invite Leon as org admin
- [ ] Verify full flow in production

**Checkpoint:** Live in production, ready for pilot

---

## Phase 10: Pilot Tournament
*First real tournament*

### 10.1 Pre-Tournament
- [ ] Create actual Rotary tournament
- [ ] Configure all settings
- [ ] Set up sponsors
- [ ] Set up raffle prizes
- [ ] Open registration
- [ ] Send announcement

### 10.2 Tournament Day
- [ ] Monitor check-ins
- [ ] Monitor scoring
- [ ] Watch leaderboard
- [ ] Run raffle
- [ ] Handle any issues

### 10.3 Post-Tournament
- [ ] Gather feedback
- [ ] Document issues/improvements
- [ ] Send results email
- [ ] Create case study

**Checkpoint:** Successful pilot, ready to onboard more customers

---

## Future Phases (V2+)

### Offline Scoring (Phase 2)
- [ ] Service worker implementation
- [ ] IndexedDB storage
- [ ] Offline score entry
- [ ] Background sync
- [ ] Conflict resolution

### SMS Notifications
- [ ] Twilio integration
- [ ] Raffle winner SMS
- [ ] Tournament reminders
- [ ] Tee time notifications

### Stripe Connect
- [ ] Multi-merchant setup
- [ ] Automatic platform fee collection
- [ ] Org payout dashboard

### Advanced Formats
- [ ] Match play scoring
- [ ] Skins game
- [ ] Nassau
- [ ] Best ball (individual)

### Special Competitions
- [ ] Closest to pin tracking
- [ ] Longest drive tracking
- [ ] Hole-in-one alerts

### Analytics Dashboard
- [ ] Revenue reports
- [ ] Registration trends
- [ ] Year-over-year comparison
- [ ] Player database

### Marketing Site
- [ ] Landing page (pacificgolf.io)
- [ ] Features page
- [ ] Pricing page
- [ ] Contact form
- [ ] SEO optimization

---

## Timeline Summary

| Phase | Duration | Milestone |
|-------|----------|-----------|
| 0: Setup | Day 1 | Clean codebase |
| 1: Multi-Tenancy | Week 1 | Data isolation working |
| 2: Tournament Config | Week 2 | Flexible tournaments |
| 3: Registration | Week 2-3 | Full registration flow |
| 4: Admin Dashboard | Week 3 | Management UI |
| 5: Live Scoring | Week 4-5 | Real-time leaderboard |
| 6: Digital Raffle | Week 5-6 | Raffle system |
| 7: Sponsors | Week 6 | Sponsor display |
| 8: Polish | Week 7 | Production quality |
| 9: Deployment | Week 8 | Live in production |
| 10: Pilot | TBD | First real tournament |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scope creep | Strict phase boundaries, defer nice-to-haves |
| Timeline slip | Start with MVP features, add polish later |
| Integration issues | Test Stripe/Clerk early in Phase 1 |
| Performance | Load test leaderboard with 100+ scores |
| Mobile UX | Test scoring on real phones early |

---

## Success Criteria

**MVP Complete When:**
1. ✅ Multiple organizations can be created
2. ✅ Tournaments can be configured with different formats
3. ✅ Registration and payment works
4. ✅ Check-in system works
5. ✅ Live scoring works on mobile
6. ✅ Real-time leaderboard updates
7. ✅ Basic raffle system works
8. ✅ Sponsors can be displayed
9. ✅ Deployed to production
10. ✅ One real tournament completed successfully

---

*End of Build Plan*
