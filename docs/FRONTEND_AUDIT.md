# Pacific Golf Frontend Design Audit

**Date:** February 10, 2026  
**Auditor:** Jerry (AI)  
**Guides Referenced:** FRONTEND_DESIGN_GUIDE.md, FRONTEND_DESIGN_SKILL.md

---

## Executive Summary

Pacific Golf has a **functional but generic** frontend. The codebase is clean and well-organized, using lucide-react for most icons (good), but has several violations of the Shimizu design standards that make it look like a typical "AI-generated" or template-based application.

**Overall Grade: B-** (Functional, needs polish for production)

---

## 🚨 Critical Issues (Must Fix)

### 1. Emoji Characters in UI (HARD RULE VIOLATION)

**Rule Violated:** "No Emojis — SVGs Only"

Found **30+ instances** of emoji/unicode characters used instead of SVG icons:

| File | Line | Issue |
|------|------|-------|
| `OrganizationProvider.tsx` | 72 | `⚠️` warning emoji |
| `OrgRegistrationSuccessPage.tsx` | 128 | `✓ Payment Complete` |
| `CheckInPage.tsx` | 201, 927 | `⚠️` warning emojis |
| `CheckInPage.tsx` | 337 | `✓ Applied` |
| `OrgTournamentPage.tsx` | 194 | `✓ Early bird pricing active` |
| `OrgTournamentPage.tsx` | 248-258 | `✓` for payment options |
| `RaffleBoardPage.tsx` | 323 | `✓ Claimed` |
| `AdminSettingsPage.tsx` | 214, 283, 291 | `✓`, `✕`, `⚠️` |
| `OrgCheckInPage.tsx` | 130, 298 | `✓`, `🎉` |
| `ReportsPage.tsx` | 228, 229, 612, 908 | `✓` checkmarks |
| `RegistrationPage.tsx` | 508 | `✓ Employee discount` |
| `LandingPage.tsx` | 198 | `✓` checkmarks |
| `AdminDashboard.tsx` | Multiple | `✓`, `⚠️` |
| `GroupManagementPage.tsx` | 817 | `✓ Drop here` |
| `PaymentLinkPage.tsx` | 218 | `✓ Paid` |

**Fix:** Replace all with lucide-react icons:
- `✓` → `<Check className="w-4 h-4 text-green-500" />`
- `✕` → `<X className="w-4 h-4 text-red-500" />`
- `⚠️` → `<AlertTriangle className="w-4 h-4 text-yellow-500" />`
- `🎉` → `<PartyPopper className="w-4 h-4" />`

---

### 2. No Custom Typography

**Issue:** Using system default fonts (no custom fonts loaded)

The `index.html` has `preconnect` to Google Fonts but no actual font imports. The app uses browser defaults.

**Fix:** Add distinctive fonts to `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

And update `tailwind.config.js`:
```js
theme: {
  extend: {
    fontFamily: {
      sans: ['DM Sans', 'system-ui', 'sans-serif'],
      display: ['Space Grotesk', 'system-ui', 'sans-serif'],
    },
  },
}
```

---

### 3. Generic Color Palette

**Issue:** Heavy reliance on Tailwind default colors (`blue-500`, `gray-50`, etc.)

Found **235 instances** of `blue-*` classes. While the app uses organization `primary_color` for headers, the rest uses generic Tailwind blue.

**Fix:** 
1. Create a custom color palette in `tailwind.config.js`
2. Use CSS variables for theming
3. Add an accent color (e.g., amber/gold for golf theme)

```js
// tailwind.config.js
colors: {
  brand: {
    50: '#f0fdf4',
    500: '#16a34a', // Golf green
    600: '#15803d',
    900: '#14532d',
  },
  accent: {
    400: '#fbbf24',
    500: '#f59e0b',
  },
}
```

---

## ⚠️ Medium Issues (Should Fix)

### 4. Overuse of `rounded-lg`

**Issue:** 316 instances of `rounded-lg` across the codebase

**From Design Guide:** "rounded-lg on literally everything" is on the blacklist.

**Fix:** Vary border radius intentionally:
- Cards: `rounded-xl` or `rounded-2xl`
- Buttons: `rounded-xl` for primary, `rounded-lg` for secondary
- Badges: `rounded-full`
- Inputs: `rounded-lg` (keep)

### 5. Missing Hover States & Micro-interactions

**Issue:** Buttons have basic hover colors but lack:
- Subtle transform (`hover:-translate-y-0.5`)
- Shadow transitions
- Active states

**Fix for Button.tsx:**
```tsx
const variantStyles = {
  primary: `
    bg-brand-600 text-white 
    hover:bg-brand-500 hover:-translate-y-0.5 hover:shadow-lg
    active:translate-y-0 active:shadow-md
    transition-all duration-200
  `,
  // ...
};
```

### 6. No Page Transitions

**Issue:** Pages load abruptly with no entrance animation

**Fix:** Add Framer Motion page transitions:
```tsx
import { motion } from 'framer-motion';

const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);
```

### 7. Loading States Could Be Better

**Issue:** Generic spinners used everywhere

**Good:** LoadingStates.tsx has skeleton components  
**Issue:** Not used consistently across all pages

**Fix:** Use skeleton loading for all data-fetching pages

---

## ✅ What's Good

### Icons (Mostly)
- Uses `lucide-react` SVG icons throughout
- Consistent icon sizing (`w-4 h-4`, `w-5 h-5`, etc.)
- Good icon choices (Trophy, Calendar, Users, etc.)

### Responsive Design
- Mobile-first approach
- Proper grid breakpoints (`md:`, `lg:`)
- Touch-friendly button sizes

### Dark Mode Support
- Leaderboard page has excellent dark mode
- RaffleBoardPage uses dark gradients well

### Component Structure
- Clean UI component library (`src/components/ui/`)
- Reusable Button, Card, Input, Modal components
- Consistent patterns

### Organization Branding
- Dynamic `primary_color` from organization
- Logo support
- Flexible theming foundation

---

## 📋 Recommended Fixes (Priority Order)

### Phase 1: Critical (Do First)
1. **Replace all emoji characters with SVG icons**
   - Create a reusable `<CheckIcon />`, `<WarningIcon />` etc.
   - Global find/replace across all files

2. **Add custom fonts**
   - Import Space Grotesk + DM Sans
   - Apply to headings vs body text

### Phase 2: Visual Polish
3. **Update color palette**
   - Define brand colors in Tailwind config
   - Replace raw `blue-*` with semantic colors

4. **Improve button interactions**
   - Add transforms and shadows
   - Better active/focus states

5. **Vary border radius**
   - Cards: `rounded-2xl`
   - Primary buttons: `rounded-xl`

### Phase 3: Delight
6. **Add page transitions**
   - Install Framer Motion
   - Wrap routes in AnimatePresence

7. **Skeleton loading everywhere**
   - Use existing LoadingStates components
   - Apply to all data-fetching pages

8. **Scroll animations**
   - Fade-up on scroll for sections
   - Staggered lists

---

## Mobile/Desktop Verification

### Mobile (375px) ✅
- [x] Navigation works
- [x] Forms are usable
- [x] Tables scroll horizontally
- [x] Buttons are touch-friendly (min 44px)
- [x] Text is readable (16px base)

### Tablet (768px) ✅
- [x] Grid layouts adapt
- [x] Sidebar collapses appropriately
- [x] Stats cards reflow

### Desktop (1280px) ✅
- [x] Content is centered with max-width
- [x] Proper use of whitespace
- [x] Multi-column layouts work

---

## Files to Modify

| Priority | File | Changes |
|----------|------|---------|
| 🔴 | `tailwind.config.js` | Add fonts, colors, radius tokens |
| 🔴 | `index.html` | Add Google Fonts import |
| 🔴 | Multiple pages | Replace emoji with icons |
| 🟡 | `Button.tsx` | Add hover transforms |
| 🟡 | `Card.tsx` | Update to `rounded-2xl` |
| 🟢 | `App.tsx` | Add page transitions |
| 🟢 | All pages | Use skeleton loading |

---

## Conclusion

Pacific Golf is **85% of the way there**. The core functionality is solid, responsive design works, and the component structure is clean. The main issues are:

1. **Emoji violations** — Easy fix, just needs global replacement
2. **Generic typography** — Add 2 fonts
3. **Vanilla Tailwind colors** — Needs custom palette

Fixing these issues would elevate the app from "looks like a template" to "feels like a polished product."

**Estimated time to fix all issues:** 4-6 hours
