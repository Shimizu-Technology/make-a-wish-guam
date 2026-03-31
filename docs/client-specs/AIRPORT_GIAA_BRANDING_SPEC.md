# Pacific Golf — Client Branding Spec (Prefilled)
## Guam International Airport Authority (GIAA) / Airport Week

## 1) Client Identity
- **Organization name:** Guam International Airport Authority
- **Short display name (header/nav):** GIAA
- **Org slug:** `giaa` (legacy implementation was single-tenant)
- **Tagline / event slogan:** Airport Week Golf Tournament
- **Brand personality (3 words):** Official, Commemorative, Proud

## 2) Visual Brand System
- **Primary color:** `#1e3a5f` (navy)
- **Secondary color:** `#2c5282`
- **Accent color:** `#c9a227` (gold)
- **Preferred background style:** Light with subtle pattern, ceremonial feel
- **Typography preference:** Strong sans-serif headlines + serif italic subtitle treatment
- **Button style:** Rounded, solid navy primary CTA

## 3) Logo + Hero Assets
- **Primary logo:** GIAA official logo (`/images/giaa-logo.png`)
- **Alternate logo:** N/A in current implementation
- **Hero/banner image:** Not heavy-photo hero; identity driven by logo + typography stack
- **Special marks:**
  - 50th anniversary context support
  - Honoree silhouette (`/images/pete-silhouette.png`)
- **Asset notes:** Keep silhouette and title grouped; avoid cropping on mobile

## 4) Voice & Messaging
- **Tone:** Formal, respectful, commemorative
- **Organization story (short):** Airport authority-hosted annual tournament tied to Airport Week programming
- **Event story (short):** Annual memorial tournament honoring Edward A.P. Muna II
- **Must-include phrases:**
  - "Airport Week"
  - "Edward A.P. Muna II Memorial Golf Tournament"
  - "Xth Annual"
- **Words/phrases to avoid:** Slangy or playful copy
- **Primary CTA label:** Register Now
- **Secondary CTA label:** Dashboard (when authenticated)

## 5) Page Modules (toggle on/off)
- [x] Hero intro (logo + annual title stack)
- [x] Event details card
- [ ] Honoree spotlight (implicit via silhouette; no dedicated section card)
- [ ] Anniversary/history block (recommended add)
- [ ] Sponsor wall (not prominent in original page)
- [ ] Leaderboard teaser
- [ ] Raffle teaser
- [ ] FAQ
- [x] Contact block
- [x] Custom section: Memorial title composition with silhouette

## 6) Event Configuration
- **Event name:** Edward A.P. Muna II Memorial Golf Tournament
- **Edition/year:** 5th Annual (example from working implementation)
- **Date/time/check-in/start:** Styled from registration status API values
- **Venue + address + map link:** Country Club of the Pacific (legacy config)
- **Format/team size:** Individual Callaway (legacy)
- **Entry fee + capacity:** Display from API (legacy showed $125 + capacity limits)
- **Payment methods allowed:** Stripe + pay-on-day/check (depending on config)
- **Contact person + role + phone/email:** Config-driven, prominently displayed in footer contact pill/card

## 7) Sponsor Presentation Rules
- **Tier names:** Not a key visual element in original airport public page
- **Tier order:** N/A
- **Logo treatment by tier:** N/A
- **Hole sponsor format:** N/A
- **Sponsor links open:** New tab recommended

## 8) Compliance & Approvals
- **Required legal/waiver text:** Registration waiver required before payment
- **Who approves copy:** GIAA tournament committee/owner
- **Who approves visuals:** GIAA brand/marketing stakeholder
- **Approval date:** TBD per event cycle

## 9) Branding QA Acceptance
- [ ] GIAA logo displays crisp on desktop/mobile
- [ ] Navy + gold palette applied consistently
- [ ] Annual subtitle + memorial heading hierarchy looks ceremonial
- [ ] Silhouette aligns correctly across breakpoints
- [ ] Contact block shows correct person/phone
- [ ] No generic/default organization copy remains
- [ ] Stakeholder sign-off received

## 10) Handoff Metadata
- **Spec version:** `v1`
- **Owner:** Shimizu Technology
- **Last updated:** 2026-03-01
- **Related org slug(s):** `giaa` (legacy), future multi-tenant slug TBD
- **Related tournament slug(s):** legacy single-tournament flow
- **Notes for future events:** Preserve memorial identity pattern as reusable "Commemorative" preset

---

## What worked best in the tried/tested airport implementation
1. **Strong identity above the fold** (logo + event title + memorial mark)
2. **Ceremonial typography hierarchy** (annual subtitle + memorial lockup)
3. **Clear event details card** with date/location/format in one place
4. **Simple conversion path**: one strong CTA and low-friction registration
