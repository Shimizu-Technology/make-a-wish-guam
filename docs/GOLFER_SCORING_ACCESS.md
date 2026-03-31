# Golfer Scoring Access - Implementation Plan

**Created:** February 11, 2026  
**Updated:** February 11, 2026  
**Status:** Phase 4 Complete ✅ (All Core Features Done!)  
**Target Tournaments:** Make-A-Wish Guam (May 2026), Father Duenas Alumni, Rotary

---

## Overview

This document outlines the implementation plan for allowing golfers to access and enter their own scores on tournament day, without requiring admin privileges.

### Goals
- ✅ Easy for golfers (no account required, but optional)
- ✅ Easy for admins (minimal setup)
- ✅ Secure (only registered golfers can access)
- ✅ Configurable (supports 2-person scramble, 4-person foursomes, etc.)

---

## Current State

### What Works Now
- Golfer registration with Stripe payments
- Admin group management
- Admin-only scorecard entry
- Public leaderboard (30-second polling)
- Team size configurable in database (`team_size` field)
- Tournament format configurable (`tournament_format` field)

### What's Missing
- Golfer authentication/access
- Golfer dashboard
- Magic link system for passwordless access
- Frontend respecting `team_size` setting dynamically

---

## The Whitelist Approach

### Concept
The **Golfer table IS the whitelist**. When someone registers for a tournament, their email is automatically "whitelisted" for that tournament.

### Auth Flow
```
1. Golfer registers → email saved in Golfer table
2. Tournament day → golfer visits /score or /login
3. Two options:
   a) Sign in with existing Clerk account
   b) Request magic link (no account needed)
4. Backend checks: "Is this email in Golfer table for active tournament?"
5. If yes → grant access, show Golfer Dashboard
6. From dashboard → access scorecard for their group
```

### Why This Works
- No separate whitelist to maintain
- Registration = automatic whitelist
- Works with or without full accounts
- Same pattern as admin whitelist (proven in GIAA)

---

## Implementation Phases

### Phase 1: Magic Link System ✅ COMPLETE
**Goal:** Allow golfers to access the system without creating an account

**Completed:** February 11, 2026

#### Database Changes ✅
```ruby
# Migration: 20260211071000_add_magic_link_to_golfers.rb
add_column :golfers, :magic_link_token, :string
add_column :golfers, :magic_link_expires_at, :datetime
add_index :golfers, :magic_link_token, unique: true, where: "magic_link_token IS NOT NULL"
```

#### API Endpoints ✅
```
POST /api/v1/golfer_auth/request_link
  - Body: { email: "golfer@example.com" }
  - Finds golfer by email for active tournament
  - Generates magic link token (24-hour expiry)
  - Sends email with link
  - Returns: { success: true, message: "Check your email" }

GET /api/v1/golfer_auth/verify?token=xxxxx
  - Validates token and expiry
  - Returns golfer info + JWT for session
  - Clears magic link (one-time use)
  - Returns: { success: true, token: "jwt...", golfer: {...}, tournament: {...}, group: {...} }

GET /api/v1/golfer_auth/me
  - Requires: Authorization: Bearer <session_token>
  - Returns current golfer info

POST /api/v1/golfer_auth/refresh
  - Requires: Authorization: Bearer <session_token>
  - Returns new session token
```

#### Files Created ✅
- `api/db/migrate/20260211071000_add_magic_link_to_golfers.rb`
- `api/app/controllers/api/v1/golfer_auth_controller.rb`
- `api/app/services/golfer_auth.rb` - JWT generation/verification
- `api/app/views/golfer_mailer/scoring_access_email.html.erb`

#### Tests ✅ (52 tests, 107 assertions)
- `api/test/models/golfer_magic_link_test.rb` - 24 tests
- `api/test/services/golfer_auth_test.rb` - 11 tests
- `api/test/controllers/api/v1/golfer_auth_controller_test.rb` - 17 tests

#### Frontend Pages (TODO - Phase 2)
- `/score` - Landing page with two options:
  - "Sign in with account" → Clerk login
  - "Quick access" → Enter email, get magic link
- `/score/verify?token=xxx` - Validates token, stores session, redirects to dashboard

---

### Phase 2: Golfer Dashboard ✅ COMPLETE
**Goal:** Give golfers a home base on tournament day

**Completed:** February 11, 2026

#### Files Created ✅
- `web/src/contexts/GolferAuthContext.tsx` - Session management, localStorage, API calls
- `web/src/pages/GolferLoginPage.tsx` - Email form for magic link request
- `web/src/pages/GolferVerifyPage.tsx` - Magic link verification handler
- `web/src/pages/GolferDashboardPage.tsx` - Golfer home with group/tournament info

#### Routes Added ✅
- `/score` - GolferLoginPage
- `/score/verify` - GolferVerifyPage
- `/golfer/dashboard` - GolferDashboardPage

#### Original Plan

#### New Page: `/golfer/dashboard`

**Shows:**
- Tournament name and date
- Their group number and teammates
- Starting hole
- "Enter Scores" button → links to scorecard
- "View Leaderboard" button
- Check-in status

**Wireframe:**
```
┌─────────────────────────────────────────┐
│  🏌️ Make-A-Wish Golf Tournament 2026   │
├─────────────────────────────────────────┤
│                                         │
│  Welcome, John Smith!                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ YOUR GROUP: 7A                  │   │
│  │ Starting Hole: 7                │   │
│  │                                 │   │
│  │ Teammates:                      │   │
│  │ • John Smith (you)              │   │
│  │ • Jane Doe                      │   │
│  │                                 │   │
│  │ [  Enter Scores  ]              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [ View Leaderboard ]                   │
│                                         │
└─────────────────────────────────────────┘
```

#### Access Control
- Golfer can only see/edit scores for their own group
- Golfer cannot access admin functions
- Session stored in localStorage (JWT from magic link or Clerk)

---

### Phase 3: Update Scorecard for Golfer Access ✅ COMPLETE
**Goal:** Allow golfers to enter scores, not just admins

**Completed:** February 11, 2026

#### Files Created/Modified ✅
- `api/app/controllers/concerns/golfer_or_admin_auth.rb` - Dual auth concern
- `api/app/controllers/api/v1/scores_controller.rb` - Updated for dual auth
- `api/app/models/golfer.rb` - Added `has_many :scores`
- `web/src/hooks/useAuthToken.ts` - Unified auth token hook
- `web/src/pages/ScorecardPage.tsx` - Updated for dual auth
- `web/src/pages/GolferDashboardPage.tsx` - Link to golfer scorecard
- `web/src/App.tsx` - Added `/golfer/scorecard` route

#### Security Features ✅
- Golfers can ONLY access their own group's scorecard
- Golfers can ONLY submit scores for their own group
- Attempting to access other groups returns 403 Forbidden
- Admin auth still works for all endpoints

#### Tests ✅ (8 new tests, 60 total for feature)
- `api/test/controllers/api/v1/scores_controller_golfer_auth_test.rb`

#### Original Plan

#### Changes to ScorecardPage.tsx
- Accept both Clerk token AND magic link JWT
- Verify user has access to the requested group
- Same UI, just different auth

#### API Changes
```ruby
# scores_controller.rb - update authentication
before_action :authenticate_golfer_or_admin!, only: [:create, :batch, :scorecard]

def authenticate_golfer_or_admin!
  # Try admin auth first
  if admin_authenticated?
    return true
  end
  
  # Try golfer auth (magic link JWT)
  if golfer_authenticated?
    # Verify golfer belongs to the requested group
    unless current_golfer.group_id == params[:group_id].to_i
      render json: { error: "Access denied to this group" }, status: :forbidden
      return false
    end
    return true
  end
  
  render json: { error: "Authentication required" }, status: :unauthorized
end
```

---

### Phase 4: Team Size Configuration ✅ COMPLETE
**Goal:** Make sure team_size flows through the entire system

**Completed:** February 11, 2026

#### Files Modified ✅
- `web/src/pages/GroupManagementPage.tsx` - Dynamic team size from tournament
- `web/src/pages/CreateTournamentPage.tsx` - Added max=4 constraint

#### Changes Made ✅
1. **GroupManagementPage** now uses `useTournament()` hook
2. Created `maxTeamSize = currentTournament?.team_size || 4`
3. Replaced all 8 hardcoded `4`s with `maxTeamSize`
4. Added team size indicator in header: "X groups • Y unassigned • 2-person teams"

#### What Works Now ✅
- 2-person groups display correctly for Make-A-Wish scramble
- 4-person groups display correctly for standard foursomes
- Groups show "Complete" at the correct size
- Drop zones hide when groups are full

#### Tournament Settings
```ruby
# For Make-A-Wish (2-person scramble)
tournament.team_size = 2
tournament.tournament_format = "scramble"
tournament.scoring_type = "team"  # One score per group

# For GIAA (4-person, individual Callaway)
tournament.team_size = 4
tournament.tournament_format = "stroke"  # or "callaway"
tournament.scoring_type = "individual"  # One score per golfer
```

---

### Phase 5: Real-Time Leaderboard (Optional Enhancement)
**Goal:** True WebSocket updates instead of polling

#### Current State
- LeaderboardPage polls every 30 seconds
- Works fine but not instant

#### Enhancement
- Add ScoresChannel for WebSocket
- Broadcast leaderboard update when scores saved
- Remove polling, use push updates

**Priority:** Low - polling works fine for MVP

---

## File Changes Summary

### New Files
```
api/
├── app/controllers/api/v1/golfer_auth_controller.rb
├── app/mailers/golfer_access_mailer.rb
├── app/views/golfer_access_mailer/magic_link.html.erb
└── db/migrate/xxx_add_magic_link_to_golfers.rb

web/
├── src/pages/GolferDashboard.tsx
├── src/pages/GolferLoginPage.tsx
├── src/pages/MagicLinkVerifyPage.tsx
├── src/contexts/GolferAuthContext.tsx
└── src/hooks/useGolferAuth.ts
```

### Modified Files
```
api/
├── app/controllers/api/v1/scores_controller.rb  # Add golfer auth
├── app/models/golfer.rb                          # Add magic link methods
└── config/routes.rb                              # Add golfer_auth routes

web/
├── src/pages/ScorecardPage.tsx                   # Accept golfer auth
├── src/pages/GroupManagementPage.tsx             # Dynamic team_size
├── src/App.tsx                                   # Add golfer routes
└── src/services/api.ts                           # Add golfer auth endpoints
```

---

## Testing Checklist

### Magic Link Flow
- [ ] Golfer can request magic link with registered email
- [ ] Unregistered email gets appropriate error
- [ ] Magic link email is delivered
- [ ] Magic link works and creates session
- [ ] Expired link shows error
- [ ] Session persists across page refresh

### Golfer Dashboard
- [ ] Shows correct group and hole
- [ ] Shows teammates
- [ ] Links to scorecard
- [ ] Links to leaderboard
- [ ] Cannot access admin pages

### Scorecard Access
- [ ] Golfer can access their group's scorecard
- [ ] Golfer cannot access other groups
- [ ] Scores save correctly
- [ ] Leaderboard updates after save

### Team Size
- [ ] 2-person groups display correctly
- [ ] 4-person groups display correctly
- [ ] Group management respects team_size
- [ ] Scorecard shows correct number of players

---

## Tournament-Specific Notes

### Make-A-Wish Guam (May 2, 2026)
- **Format:** 2-person scramble
- **Team Size:** 2
- **Scoring:** Team (one score per group per hole)
- **Location:** LeoPalace Resort Country Club
- **Start:** 8:00am shotgun

### Father Duenas Alumni
- **Format:** TBD (likely 4-person scramble or best ball)
- **Team Size:** 4 (typical)
- **Scoring:** TBD
- **Need:** More info on specific event

### GIAA/Airport (Reference)
- **Format:** Individual Callaway
- **Team Size:** 4
- **Scoring:** Individual
- **Note:** Original system, no live scoring

---

## Timeline Estimate

| Phase | Effort | Priority | Status |
|-------|--------|----------|--------|
| Phase 1: Magic Link | 2-3 days | 🔴 High | ✅ Complete |
| Phase 2: Golfer Dashboard | 1-2 days | 🔴 High | ✅ Complete |
| Phase 3: Scorecard Auth | 1 day | 🔴 High | ✅ Complete |
| Phase 4: Team Size Config | 1-2 days | 🟡 Medium | ✅ Complete |
| Phase 5: WebSocket | 1 day | 🟢 Low | ⏳ Optional |

**Total:** All core features complete! 🎉

---

## Questions to Resolve

1. **One scorer per group or all golfers can score?**
   - Recommendation: Any golfer in the group can enter scores
   - They all see the same scorecard, last save wins

2. **What if golfer isn't assigned to a group yet?**
   - Show message: "Groups will be assigned before tournament day"
   - Dashboard still shows tournament info

3. **Magic link expiry - 24 hours or tournament day only?**
   - Recommendation: 24 hours from request
   - Can request new link anytime

4. **Should golfers be able to see other groups' detailed scores?**
   - Recommendation: No, just leaderboard (public)
   - Keeps focus on their own play

---

## References

- [Pacific Golf README](/docs/README.md)
- [API Documentation](/docs/API.md)
- [GIAA Original System](/work/giaa-tournament-api)
- [Make-A-Wish Guam](https://wish.org/guamcnmi/golf-wishes)

---

*Last Updated: February 11, 2026*
