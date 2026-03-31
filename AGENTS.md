# AGENTS.md — Make-A-Wish Guam & CNMI Events Platform

## Project Context

**Make-A-Wish Guam & CNMI Events Platform** — Event registration and management for Make-A-Wish Guam charity events.

**Origin:** Forked from Pacific Golf (multi-tenant golf tournament SaaS), customized for a single organization.

**Client:** Eric Tydingco (etydingco@guam.wish.org)

**BOG Contact:** Lesley-Anne Leon Guerrero (lesley-anne.leonguerrero@bankofguam.com)

**First Event:** Golf for Wishes, May 2, 2026, LeoPalace Resort, Yona, Guam

**Payment:**
- Interim: SwipeSimple link redirect (https://swipesimple.com/links/lnk_e1c8f45f9c401c93552781ef3d52fdfc)
- Future: CardPointe API (after April 3 BOG meeting)

## Repository

- **Repo:** https://github.com/Shimizu-Technology/make-a-wish-guam
- **API:** Render (Singapore region) — make-a-wish-api.onrender.com
- **Web:** Netlify — make-a-wish-web.netlify.app

## Monorepo Structure

```
make-a-wish-guam/
├── api/          # Rails 8.1 API
├── web/          # React + TypeScript frontend
├── docs/         # Documentation
└── packages/     # Shared code (future)
```

## Development Servers

- API: `http://localhost:3000`
- Web: `http://localhost:5173`

## Key Architecture Notes

- **Single-org app** — MAW is the organization. No multi-tenant SaaS flows.
- **Team registration** — Golf for Wishes uses 2-person teams ($300/team)
- **Real-time** — ActionCable WebSockets for check-in, raffle, scoring
- **Auth** — Clerk
- **Payments** — SwipeSimple redirect (interim), Stripe (existing), CardPointe (future)
- **Email** — Resend

## Key Decisions

| Decision | Choice |
|----------|--------|
| Multi-tenancy | Removed — single org (MAW) |
| Payments | SwipeSimple redirect (interim) → CardPointe API (future) |
| Teams | 2-person teams for golf events |
| Real-time | ActionCable WebSockets |
| Auth | Clerk |
| Deployment | Render (API) + Netlify (Web) |

## Coding Standards

Follow the starter-app guides in `docs/starter-app/`:
- FRONTEND_DESIGN_GUIDE.md — UI patterns
- TESTING_GUIDE.md — Test coverage
- CLERK_AUTH_SETUP_GUIDE.md — Auth patterns
- WEBSOCKETS_GUIDE.md — Real-time features

## Design Principles

1. **No emojis in UI** — Use Lucide icons (SVGs)
2. **Mobile-first** — Design for phone use first
3. **Simple by default** — Don't overwhelm charity event organizers
