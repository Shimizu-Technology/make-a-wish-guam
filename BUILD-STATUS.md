# Make-A-Wish Guam — Build Status

## Golf for Wishes (May 2, 2026)

### Inherited from Pacific Golf (working)
- Multi-tenant org model (MAW is the single org)
- Tournament management
- Admin dashboard
- Check-in system (WebSocket, real-time)
- Group/hole assignment (drag-and-drop)
- Raffle system (prizes, tickets, auto-draw, WebSocket)
- Sponsor management (tiers, logos)
- Clerk auth
- Resend email

### Modified (this PR)
- SwipeSimple payment redirect endpoint
- Team of 2 registration (partner fields added)
- Stripped SaaS super-admin flows
- MAW-specific AGENTS.md / README

### Still Needs Building
- [ ] Sponsor self-service portal (sponsors manage their own player slots)
- [ ] SwipeSimple redirect in registration flow (frontend)
- [ ] Team registration form (2 players, both sign waiver)
- [ ] MAW branding (colors, logo, landing page)
- [ ] Manual payment reconciliation flow in admin
- [ ] Walk-in surcharge pricing tier
- [ ] Day-of raffle purchase via SwipeSimple or cash
- [ ] Push notifications for raffle

### Future (Gala Aug 22+)
- Table/seating management
- Dietary tracking
- Live donation counter
- 501c3 tax receipts
- CardPointe API (replaces SwipeSimple interim)
