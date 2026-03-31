# GIAA Tournament Frontend

React frontend for the Golf Tournament Registration System.

## Prerequisites

- **Node.js 18+** (use [nvm](https://github.com/nvm-sh/nvm) or [asdf](https://asdf-vm.com/))
- **npm** (comes with Node.js)

## Quick Start

```bash
# 1. Enter the directory
cd giaa-tournament-frontend

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# ⚠️ Ask Lead for the actual .env values (Clerk key)

# 4. Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`

## Team Onboarding

**Do NOT create your own Clerk account.** We share one Clerk application.

1. **Get the `.env` file** - Ask Lead for `VITE_CLERK_PUBLISHABLE_KEY`
2. **Add yourself as Admin** - See backend README (`rails c` → `Admin.create!`)
3. **Sign up at `/admin/login`** - Creates your Clerk user

### What's Shared vs Local

| What | Where | Shared? |
|------|-------|---------|
| Clerk users (login/password) | Clerk cloud | ✅ Yes |
| Golfers, Tournaments, Groups | Your local PostgreSQL | ❌ No |
| Admin whitelist | Your local PostgreSQL | ❌ No |

Your database is 100% local. Clerk just handles login instead of bcrypt.

## How Clerk Works

Unlike bcrypt/JWT, Clerk provides ready-made React components:

```tsx
// Clerk wraps the app
<ClerkProvider publishableKey={CLERK_KEY}>
  <App />
</ClerkProvider>

// Pre-built sign-in (no forms to build!)
<SignIn />

// Check if logged in
const { isSignedIn } = useUser();

// Get JWT for API calls
const { getToken } = useAuth();
const token = await getToken();
```

**Key Files:**
- `src/main.tsx` - ClerkProvider wraps app
- `src/components/ProtectedRoute.tsx` - Redirects if not signed in
- `src/services/api.ts` - Attaches JWT to API requests

---

## 📖 Reference

Everything below is reference material - read when you need it.

### Tech Stack

- **React 18** with TypeScript
- **Vite** (build tool)
- **Tailwind CSS** (styling)
- **Clerk** (authentication)
- **React Router** (navigation)
- **@dnd-kit** (drag-and-drop)

### Environment Variables

```env
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
```

### Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/register` | Multi-step registration |
| `/admin/login` | Staff sign-in |
| `/admin/dashboard` | Golfer list & management |
| `/admin/groups` | Drag-and-drop groups |
| `/admin/checkin` | Tournament day check-in |
| `/admin/reports` | View & export reports |

### Project Structure

```
src/
├── components/     # UI components
├── contexts/       # React contexts (TournamentContext)
├── pages/          # Page components
├── services/api.ts # API client
└── App.tsx         # Routes
```

### Development Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run typecheck  # Type checking
npm run lint       # Linting
```

### Deployment

Deploy to Netlify:
1. Build command: `npm run build`
2. Publish directory: `dist`
3. Add `VITE_*` environment variables
