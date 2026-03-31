# Make-A-Wish Guam — Build Status

## Golf for Wishes (May 2, 2026)

### Inherited from Pacific Golf (working)
- Single-org model (MAW is the organization)
- Tournament management
- Admin dashboard
- Check-in system (WebSocket, real-time)
- Group/hole assignment (drag-and-drop)
- Raffle system (prizes, tickets, auto-draw, WebSocket)
- Sponsor management (tiers, logos)
- Clerk auth
- Resend email

### Modified
- SwipeSimple payment redirect endpoint
- Team of 2 registration (partner fields added)
- Stripped SaaS super-admin flows

### Completed
- [x] SMS notifications via ClickSend (registration confirmation to both players, E.164 format)
- [x] Manual payment reconciliation flow in admin (3-tab: pending/paid/summary, mark-as-paid modal, CSV export)
- [x] Walk-in registration (admin quick-add modal, walk_in payment type, day-of flow)
- [x] Configurable tournament settings (SwipeSimple URLs, walk-in fee, registration deadline, entry fee display, raffle settings)
- [x] Raffle prize image upload (Active Storage S3, file upload + URL input, preview)
- [x] Sponsor self-service portal (sponsors manage their own player slots)
- [x] Codebase cleanup: fixed admin routing, removed dead code, updated branding, dropped unused DB tables

### Still Needs Building
- [ ] Day-of raffle purchase via SwipeSimple or cash
- [ ] Push notifications for raffle
- [ ] MAW branding (colors, logo, landing page)

### Future (Gala Aug 22+)
- Table/seating management
- Dietary tracking
- Live donation counter
- 501c3 tax receipts
- CardPointe API (replaces SwipeSimple interim)
