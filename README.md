# Make-A-Wish Guam & CNMI Events Platform

Event registration platform for Make-A-Wish Guam charity events.

[![Rails](https://img.shields.io/badge/Rails-8.1-red.svg)](https://rubyonrails.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-gray.svg)]()

## Features

- **Online Registration** — Public signup with team-based registration
- **Admin Dashboard** — Event management, check-in, participant management
- **Live Scoring** — Mobile-optimized scorecard entry (golf events)
- **Real-time Leaderboard** — WebSocket-powered updates
- **Digital Raffle** — Prize management with automated drawings
- **Sponsor Management** — Tiered sponsor display (title, platinum, gold, etc.)
- **Payments** — SwipeSimple (interim), CardPointe (future)

## Tech Stack

| Layer | Technology |
|-------|------------|
| **API** | Rails 8.1, PostgreSQL, ActionCable |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Auth** | Clerk |
| **Payments** | SwipeSimple (interim) / CardPointe (future) |
| **Email** | Resend |
| **Deployment** | Render (API, Singapore) + Netlify (Web) |

## Project Structure

```
make-a-wish-guam/
├── api/              # Rails API server
│   ├── app/
│   │   ├── controllers/api/v1/
│   │   ├── models/
│   │   └── channels/
│   └── config/
├── web/              # React frontend
│   ├── src/
│   │   ├── api/      # API client
│   │   ├── components/
│   │   └── pages/
│   └── public/
├── docs/             # Documentation
└── packages/         # Shared code (future)
```

## Quick Start

### Prerequisites

- Ruby 3.3.4
- Node.js 20+
- PostgreSQL 15+
- pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/Shimizu-Technology/make-a-wish-guam.git
cd make-a-wish-guam

# Install dependencies
pnpm install
cd api && bundle install && cd ..

# Setup database
cd api
cp .env.example .env  # Configure your environment
rails db:create db:migrate db:seed
cd ..

# Start development servers
pnpm dev
```

The API runs on `http://localhost:3000` and frontend on `http://localhost:5173`.

## Development

### Running Tests

```bash
# API tests
cd api
bundle exec rails test

# Frontend tests
cd web
pnpm test
```

### Code Style

- Ruby: Standard Ruby style
- TypeScript: ESLint + Prettier
- CSS: Tailwind CSS utilities

## Documentation

| Document | Description |
|----------|-------------|
| [BUILD-STATUS.md](BUILD-STATUS.md) | Current build progress |
| [AGENTS.md](AGENTS.md) | AI agent context |
| [docs/PRD.md](docs/PRD.md) | Product requirements document |

## Origin

Forked from Pacific Golf tournament SaaS, customized as a single-org platform for Make-A-Wish Guam & CNMI.

## License

Proprietary — Shimizu Technology LLC

---

Built in Guam for Make-A-Wish Guam & CNMI
