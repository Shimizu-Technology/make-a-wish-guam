# Make-A-Wish Guam — Build Status

## Golf for Wishes (May 2, 2026)

### Core Features (working)
- Single-org model (MAW is the organization)
- Tournament management with configurable settings
- Admin dashboard with registration/payment stats
- Check-in system (WebSocket, real-time)
- Group/hole assignment (drag-and-drop)
- Raffle system (prizes, tickets, draw/claim, public board, admin quick-sell)
- Sponsor management (tiers, logos, slot counts)
- Sponsor self-service portal (magic-link login, slot editing, deadline enforcement)
- Clerk auth (admin), magic-link auth (golfers, sponsors)
- Resend email notifications
- SMS notifications via ClickSend
- SwipeSimple payment redirect (team registration + walk-in)
- Team of 2 registration with partner fields
- Manual payment reconciliation (pending/paid/summary, mark-as-paid, CSV export)
- Walk-in registration (admin quick-add, configurable walk-in fee)
- MAW branding (blue palette, star logo, landing page, admin/public pages)
- Configurable tournament settings (payment URLs, deadlines, fees, raffle, sponsor deadline)

### Recently Completed
- [x] Fixed tournament settings strong params (all fields now persist correctly)
- [x] Serializer updated to expose all tournament config fields in API responses
- [x] Sponsor edit deadline enforcement (backend lockout + frontend locked state)
- [x] Raffle quick-sell presets for day-of sales (1/5/10/20 ticket buttons)
- [x] Public raffle board "Check My Tickets" (email lookup for digital ticket ownership)
- [x] Raffle ticket price configurable from admin settings
- [x] Branding polish pass (green → brand-blue across golfer/admin pages)

### Nice-to-Have / Post-Launch
- [ ] Configurable raffle bundles (deeper model beyond quantity presets)
- [ ] Push notifications for raffle ("closing soon", "last chance")
- [ ] Self-service raffle ticket purchase (public-facing, via SwipeSimple or similar)

### Future (Gala Aug 22+)
- Table/seating management
- Dietary tracking
- Live donation counter
- 501c3 tax receipts
- CardPointe API (replaces SwipeSimple interim)
