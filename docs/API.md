# Pacific Golf API Documentation

**Version:** 1.0  
**Base URL:** `/api/v1`  
**Authentication:** Clerk JWT tokens (Bearer)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Public Endpoints](#public-endpoints)
3. [Admin Endpoints](#admin-endpoints)
4. [Live Scoring](#live-scoring)
5. [Raffle System](#raffle-system)
6. [Sponsors](#sponsors)
7. [Webhooks](#webhooks)
8. [Error Handling](#error-handling)

---

## Authentication

Most admin endpoints require authentication via Clerk JWT tokens.

```http
Authorization: Bearer <clerk_jwt_token>
```

### Obtaining Tokens

The frontend uses `@clerk/clerk-react` to obtain tokens:

```typescript
import { useAuth } from '@clerk/clerk-react';

const { getToken } = useAuth();
const token = await getToken();
```

### User Roles

- `super_admin` — Full access to all organizations
- `org_admin` — Full access to assigned organizations
- `tournament_admin` — Limited access to assigned tournaments

---

## Public Endpoints

### Organization Info

**GET** `/organizations/:slug`

Returns organization details for public pages.

**Response:**
```json
{
  "id": "uuid",
  "name": "Rotary Club of Guam",
  "slug": "rotary-guam",
  "description": "...",
  "logoUrl": "...",
  "primaryColor": "#1e40af"
}
```

### Tournament List

**GET** `/organizations/:slug/tournaments`

Lists public tournaments for an organization.

**Query Parameters:**
- `status` — Filter by status (`open`, `closed`, `archived`)

### Tournament Details

**GET** `/organizations/:slug/tournaments/:tournament_slug`

Returns tournament details and registration info.

**Response:**
```json
{
  "id": 123,
  "name": "Annual Charity Classic",
  "slug": "charity-classic-2026",
  "year": 2026,
  "status": "open",
  "eventDate": "March 15, 2026",
  "registrationTime": "10:00 AM",
  "startTime": "12:00 PM",
  "locationName": "Country Club of the Pacific",
  "locationAddress": "...",
  "maxCapacity": 144,
  "currentCount": 89,
  "entryFee": 15000,
  "formatName": "4-Person Scramble",
  "feeIncludes": "Green fee, cart, lunch",
  "registrationOpen": true,
  "sponsors": [...]
}
```

### Check Registration

**GET** `/golfers/registration_status`

Check if an email is already registered.

**Query Parameters:**
- `email` — Email to check
- `tournament_id` — Tournament ID

**Response:**
```json
{
  "registered": true,
  "status": "confirmed"
}
```

### Register Golfer

**POST** `/golfers`

Submit a new registration.

**Request Body:**
```json
{
  "golfer": {
    "tournament_id": 123,
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "671-555-1234",
    "company": "Acme Corp",
    "address": "123 Golf Lane",
    "payment_type": "stripe"
  }
}
```

**Response:** Golfer object with `stripeCheckoutUrl` for redirect.

---

## Admin Endpoints

All admin endpoints require authentication.

### Organizations

**GET** `/admin/organizations`

List organizations the user has access to.

**POST** `/admin/organizations`

Create new organization (super_admin only).

**PATCH** `/admin/organizations/:id`

Update organization settings.

### Tournaments

**GET** `/admin/organizations/:slug/tournaments`

List all tournaments for an organization.

**POST** `/admin/organizations/:slug/tournaments`

Create a new tournament.

**Request Body:**
```json
{
  "tournament": {
    "name": "Spring Classic 2026",
    "slug": "spring-classic-2026",
    "year": 2026,
    "eventDate": "April 10, 2026",
    "registrationTime": "10:00 AM",
    "startTime": "12:00 PM",
    "locationName": "...",
    "locationAddress": "...",
    "maxCapacity": 144,
    "entryFee": 15000,
    "formatName": "4-Person Scramble",
    "feeIncludes": "...",
    "paymentMode": "production"
  }
}
```

**GET** `/admin/organizations/:slug/tournaments/:tournament_slug`

Get tournament with full admin details.

**PATCH** `/tournaments/:id`

Update tournament settings.

### Tournament Status Actions

**POST** `/tournaments/:id/open` — Open registration  
**POST** `/tournaments/:id/close` — Close registration  
**POST** `/tournaments/:id/archive` — Archive tournament  
**POST** `/tournaments/:id/copy` — Clone tournament for next year

### Golfer Management

**GET** `/golfers`

List golfers with filtering.

**Query Parameters:**
- `tournament_id` — Required
- `status` — Filter by registration status
- `payment_status` — Filter by payment status
- `search` — Search by name/email

**POST** `/admin/organizations/:slug/tournaments/:slug/golfers`

Manual registration (admin adds golfer).

**PATCH** `/admin/organizations/:slug/tournaments/:slug/golfers/:id`

Update golfer details.

### Golfer Actions

**POST** `/golfers/:id/check_in` — Check in golfer  
**POST** `/golfers/:id/undo_check_in` — Undo check-in  
**POST** `/golfers/:id/update_payment_status` — Mark as paid  
**POST** `/golfers/:id/promote` — Move from waitlist to confirmed  
**POST** `/golfers/:id/demote` — Move to waitlist  
**POST** `/golfers/:id/cancel` — Cancel registration  
**POST** `/golfers/:id/refund` — Process Stripe refund  
**POST** `/golfers/:id/mark_refunded` — Mark cash refund  
**POST** `/golfers/:id/send_payment_link` — Send payment email

### Payment Links

**GET** `/payment_links/:token`

Get payment link details (public).

**POST** `/payment_links/:token/checkout`

Create Stripe checkout session for payment link.

### Statistics

**GET** `/golfers/stats`

Get registration statistics.

**Response:**
```json
{
  "confirmed": 89,
  "waitlist": 12,
  "cancelled": 3,
  "paid": 75,
  "unpaid": 14,
  "checked_in": 45
}
```

---

## Live Scoring

### Leaderboard

**GET** `/tournaments/:tournament_id/scores/leaderboard`

Get live leaderboard data.

**Response:**
```json
{
  "tournament": {...},
  "leaderboard": [
    {
      "position": 1,
      "golfer": { "id": 1, "name": "John Smith" },
      "totalStrokes": 72,
      "relativeScore": 0,
      "holesCompleted": 18,
      "scores": { "1": 4, "2": 5, ... }
    }
  ],
  "coursePar": 72,
  "lastUpdated": "2026-03-15T14:30:00Z"
}
```

### Scorecard

**GET** `/tournaments/:tournament_id/scores/scorecard`

Get scorecard for a golfer.

**Query Parameters:**
- `golfer_id` — Golfer ID

### Submit Scores

**POST** `/tournaments/:tournament_id/scores`

Submit a score for a hole.

**Request Body:**
```json
{
  "score": {
    "golfer_id": 123,
    "hole": 5,
    "strokes": 4,
    "par": 4
  }
}
```

**POST** `/tournaments/:tournament_id/scores/batch`

Submit multiple scores at once.

**Request Body:**
```json
{
  "scores": [
    { "golfer_id": 123, "hole": 5, "strokes": 4, "par": 4 },
    { "golfer_id": 123, "hole": 6, "strokes": 3, "par": 3 }
  ]
}
```

### Verify Score

**POST** `/tournaments/:tournament_id/scores/:id/verify`

Admin verifies a score.

---

## Raffle System

### Public Board

**GET** `/tournaments/:tournament_id/raffle/board`

Get public raffle board showing prizes and winners.

**Response:**
```json
{
  "prizes": [
    {
      "id": 1,
      "name": "Grand Prize Package",
      "tier": "grand",
      "valueCents": 100000,
      "position": 1,
      "won": true,
      "winnerName": "John S.",
      "claimed": false
    }
  ],
  "stats": {
    "totalTickets": 250,
    "totalValue": 500000
  }
}
```

### Prize Management

**GET** `/tournaments/:tournament_id/raffle/prizes`

List all prizes (admin).

**POST** `/tournaments/:tournament_id/raffle/prizes`

Create a prize.

**Request Body:**
```json
{
  "prize": {
    "name": "Weekend Getaway",
    "tier": "platinum",
    "valueCents": 50000,
    "description": "...",
    "donorName": "Travel Agency"
  }
}
```

**PATCH** `/tournaments/:tournament_id/raffle/prizes/:id`

Update a prize.

**DELETE** `/tournaments/:tournament_id/raffle/prizes/:id`

Delete a prize.

### Drawing

**POST** `/tournaments/:tournament_id/raffle/prizes/:id/draw`

Draw a winner for a prize.

**POST** `/tournaments/:tournament_id/raffle/prizes/:id/reset`

Reset winner (allow re-draw).

**POST** `/tournaments/:tournament_id/raffle/prizes/:id/claim`

Mark prize as claimed.

**POST** `/tournaments/:tournament_id/raffle/draw_all`

Draw all remaining prizes at once.

### Ticket Management

**GET** `/tournaments/:tournament_id/raffle/admin/tickets`

List all tickets (admin).

**POST** `/tournaments/:tournament_id/raffle/tickets`

Create tickets for a golfer.

**Request Body:**
```json
{
  "golfer_id": 123,
  "quantity": 5
}
```

**POST** `/tournaments/:tournament_id/raffle/tickets/:id/mark_paid`

Mark ticket as paid.

**DELETE** `/tournaments/:tournament_id/raffle/tickets/:id`

Delete a ticket.

---

## Sponsors

**GET** `/tournaments/:tournament_id/sponsors`

List sponsors.

**Query Parameters:**
- `active` — Only active sponsors (default: true)

**POST** `/tournaments/:tournament_id/sponsors`

Create sponsor.

**Request Body:**
```json
{
  "sponsor": {
    "name": "Bank of Guam",
    "tier": "title",
    "websiteUrl": "https://...",
    "logoUrl": "https://...",
    "holeNumber": null
  }
}
```

**Tiers:** `title`, `platinum`, `gold`, `silver`, `bronze`, `hole`

**GET** `/tournaments/:tournament_id/sponsors/by_hole`

Get hole sponsors indexed by hole number.

**POST** `/tournaments/:tournament_id/sponsors/reorder`

Reorder sponsors.

---

## Webhooks

### Stripe

**POST** `/webhooks/stripe`

Handles Stripe webhook events.

**Handled Events:**
- `checkout.session.completed` — Mark golfer as paid
- `charge.refunded` — Mark refund complete

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Validation failed",
  "details": ["Email is required", "Phone is invalid"]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

### Rate Limiting

API calls are rate-limited to:
- 100 requests/minute for authenticated users
- 20 requests/minute for public endpoints

---

## WebSocket Channels

### Leaderboard Channel

Subscribe to real-time leaderboard updates:

```javascript
cable.subscriptions.create(
  { channel: "LeaderboardChannel", tournament_id: 123 },
  {
    received(data) {
      // data.type: 'score_update', 'leaderboard_refresh'
    }
  }
);
```

### Raffle Channel

Subscribe to raffle events:

```javascript
cable.subscriptions.create(
  { channel: "RaffleChannel", tournament_id: 123 },
  {
    received(data) {
      // data.type: 'winner_drawn', 'prize_claimed'
    }
  }
);
```

---

## SDK / Client Examples

### TypeScript API Client

```typescript
// Example using the provided adminClient

import adminClient from '@/api/adminClient';

// Fetch golfers
const golfers = await adminClient.get('/golfers', {
  params: { tournament_id: 123 }
});

// Check in a golfer
await adminClient.post(`/golfers/${id}/check_in`);
```

See `web/src/api/adminClient.ts` for the full implementation.
