# Pacific Golf Release Gate (Fast + Repeatable)

Use this before saying "live".

## 1) Deploy status
- Render latest deploy = `live`
- Netlify latest deploy = from `main` branch

## 2) Environment check
Run:

```bash
./scripts/check-prod-env.sh
```

Must pass with all ✅.

## 3) Read-only smoke test
Run:

```bash
./scripts/smoke-prod.sh
```

Must pass with all ✅.

## 4) Browser sanity (fresh tab)
Open a **fresh tab** (or hard refresh) and verify:
- `/`
- `/make-a-wish-guam`
- `/make-a-wish-guam/tournaments/golf-for-wishes-2026/leaderboard`
- `/admin/login`

## 5) If anything fails
- Stop release announcement
- Fix env/deploy
- Re-run steps 2-4

---

Goal: no heroics, no guessing, just a clean green gate.
