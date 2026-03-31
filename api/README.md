# GIAA Tournament API

Rails API backend for the Golf Tournament Registration System.

## Prerequisites

- **Ruby 3.3.4** (use [rbenv](https://github.com/rbenv/rbenv) or [asdf](https://asdf-vm.com/))
- **PostgreSQL 14+** (install via Homebrew: `brew install postgresql@16`)
- **Bundler** (`gem install bundler`)

## Quick Start

```bash
# 1. Enter the directory
cd giaa-tournament-api

# 2. Install dependencies
bundle install

# 3. Create .env file
cp .env.example .env
# ⚠️ Ask Lead for the actual .env values (Clerk, Resend, Stripe keys)

# 4. Setup database
rails db:create db:migrate db:seed

# 5. Start the server
rails s
```

The API will be available at `http://localhost:3000`

## Team Onboarding

**Do NOT create your own accounts for Clerk, Resend, or Stripe.** We share one set of API keys.

1. **Get the `.env` file** - Ask Lead for the real values
2. **Add yourself as an Admin:**
   ```bash
   rails c
   Admin.create!(email: "your-email@example.com", name: "Your Name")
   ```
3. **Sign up at `/admin/login`** on the frontend to create your Clerk user

### What's Shared vs Local

| What | Where | Shared? |
|------|-------|---------|
| Clerk users (login/password) | Clerk's cloud | ✅ Yes |
| Golfers, Tournaments, Groups | Your local PostgreSQL | ❌ No |
| Admin whitelist | Your local PostgreSQL | ❌ No |

Your database is 100% local. Clerk just handles password verification instead of bcrypt.

## How Authentication Works

If you learned auth with bcrypt + JWT, here's how Clerk is different:

| Traditional (bcrypt/JWT) | Clerk |
|--------------------------|-------|
| You build login/signup UI | Clerk provides pre-built UI |
| You hash passwords with bcrypt | Clerk handles passwords |
| You create/sign JWT tokens | Clerk issues JWTs automatically |
| You verify with your secret | We verify with Clerk's public keys |

**The Flow:**
```
1. User signs in → Clerk handles it
2. Clerk issues JWT → Frontend stores it
3. Frontend sends: Authorization: Bearer <token>
4. Backend verifies JWT with Clerk's public keys
5. Backend checks if email is in Admin whitelist
6. If whitelisted → Access granted!
```

**Key Files:**
- `app/services/clerk_auth.rb` - Verifies JWT tokens
- `app/controllers/concerns/authenticated.rb` - Auth check + admin whitelist
- `app/models/admin.rb` - Admin whitelist

---

## 📖 Reference

Everything below is reference material - read when you need it.

### Tech Stack

- **Ruby on Rails 8.1** (API mode)
- **PostgreSQL** (database)
- **Clerk** (authentication via JWT)
- **Resend** (email delivery)
- **Stripe** (payment processing)
- **ActionCable** (WebSocket real-time updates)

### Environment Variables

```env
CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
RESEND_API_KEY=re_xxxxxxxxxxxxx
MAILER_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=http://localhost:5173
```

### Key Models

| Model | Description |
|-------|-------------|
| `Tournament` | Tournament with settings, dates, capacity |
| `Golfer` | Registered player with payment/check-in status |
| `Group` | Foursome with hole assignment |
| `Admin` | Whitelisted admin user |
| `EmployeeNumber` | Valid employee numbers for discounts |
| `ActivityLog` | Audit trail of all admin actions |

### API Endpoints

#### Public (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tournaments/current` | Get current open tournament |
| GET | `/api/v1/golfers/registration_status` | Registration capacity info |
| POST | `/api/v1/golfers` | Register a new golfer |
| POST | `/api/v1/checkout/embedded` | Create Stripe checkout session |
| POST | `/api/v1/employee_numbers/validate` | Validate employee number |

#### Protected (Clerk JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/golfers` | List golfers (with filters) |
| PATCH | `/api/v1/golfers/:id` | Update golfer |
| POST | `/api/v1/golfers/:id/check_in` | Toggle check-in |
| POST | `/api/v1/golfers/:id/payment_details` | Record payment |
| POST | `/api/v1/golfers/:id/promote` | Promote from waitlist |
| POST | `/api/v1/golfers/:id/cancel` | Cancel registration |
| POST | `/api/v1/golfers/:id/refund` | Process Stripe refund |
| GET | `/api/v1/groups` | List groups |
| POST | `/api/v1/groups/:id/add_golfer` | Add golfer to group |
| GET | `/api/v1/tournaments` | List all tournaments |

### Testing

```bash
rails test              # Run all tests
rails test -v           # Verbose output
```

### Deployment

Deploy to Render with:
- `DATABASE_URL` - PostgreSQL connection string
- `RAILS_MASTER_KEY` - From `config/master.key`
- `CLERK_JWKS_URL`, `RESEND_API_KEY`, `FRONTEND_URL`
