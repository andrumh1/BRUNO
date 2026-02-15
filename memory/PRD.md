# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a highly polished, visually appealing PWA with extensive customization and social features.

## User Personas
1. **Individual Professionals** - Need personal digital business cards
2. **Small Business Owners** - Need business/negocio cards for their services
3. **Corporate Teams** - Need branded corporate cards for employees
4. **Tour/Place Managers** - Need location-based cards (lugares)
5. **Guardians** - Need cards for children, elderly, or special needs individuals
6. **Job Seekers** - Need curriculum/resume-style cards

## Core Requirements

### Card Types
1. ✅ Personal - Personal presentation card
2. ✅ Empresarial/Corporate - Corporate presentation
3. ✅ Negocio/Business - Company or business information
4. ✅ Lugares/Places - Tourism, information, warnings
5. ✅ Guardian - For children, elderly, or people with special needs
6. ✅ Curriculum - Professional resume with experience, education, skills

### Visual Design
- ✅ Color Palette: #FFFFF3 (off-white), #F5E7CA (cream beige), #FF5A00 (bright orange), #2C2C27 (grayish black)
- ✅ Glassmorphism/bubble design with glowing borders
- ✅ Backdrop-blur effects on cards, modals, dropdowns
- ✅ Card animation option (is_animated flag)
- ✅ Hover lift effects on cards

### Card Features
- ✅ Multiple templates per card type
- ✅ Avatar and banner image uploads
- ✅ Social links selector
- ✅ Location support with map
- ✅ Custom colors (background, text)
- ✅ Privacy controls (is_public, show_in_feed)
- ✅ QR code generation

### CURRICULUM Card Specific
- ✅ Work Experience section (company, position, dates, description)
- ✅ Education section (institution, degree, dates)
- ✅ Skills section (name, level percentage)
- ✅ Languages section (name, proficiency level)
- ✅ Documents section (attachments like diplomas, certificates)

### Internationalization (i18n)
- ✅ Spanish and English support
- ✅ Auto-detection from browser language
- ✅ Manual switcher with persistence

### Feed & Navigation
- ✅ Public feed as main page
- ✅ Grid/List view toggle
- ✅ Search and filter by card type
- ✅ User dashboard with stats

### Payments (Stripe Integration)
- ✅ Backend checkout endpoints
- ✅ Frontend PricingPage with 4 plans
- ✅ Subscription support (Personal, Business, Corporate)
- ✅ One-time purchases (NFC packs)

## What's Been Implemented

### Date: 2026-02-15
**Session Summary:**
- Implemented i18n system with LanguageContext and LanguageSwitcher
- Added Grid/List view toggle to Feed and Dashboard
- Created CURRICULUM card type with all sections
- Built ImageEditor component for avatar/banner editing
- Enhanced CSS with glassmorphism effects
- Connected PricingPage to Stripe checkout
- Applied consistent styling across all pages

### Key Files Modified
- `/app/frontend/src/contexts/LanguageContext.js` - NEW
- `/app/frontend/src/components/LanguageSwitcher.jsx` - NEW
- `/app/frontend/src/components/ImageEditor.jsx` - NEW
- `/app/frontend/src/pages/CreateCardPage.jsx` - UPDATED
- `/app/frontend/src/pages/EditCardPage.jsx` - UPDATED
- `/app/frontend/src/pages/FeedPage.jsx` - UPDATED
- `/app/frontend/src/pages/Dashboard.jsx` - UPDATED
- `/app/frontend/src/pages/PricingPage.jsx` - UPDATED
- `/app/frontend/src/index.css` - UPDATED
- `/app/frontend/src/App.js` - UPDATED

## Prioritized Backlog

### P0 (Must Have - In Progress)
- [ ] PDF export for CURRICULUM cards
- [ ] Document attachment upload to cloud storage
- [ ] CURRICULUM detail view with bubble overlays

### P1 (Should Have)
- [ ] Social features (likes, comments, share count)
- [ ] Card collections/album (saved, scanned, visited)
- [ ] Enhanced QR with logo in center
- [ ] SEO meta tags for public cards

### P2 (Nice to Have)
- [ ] Corporate account management panel
- [ ] Deepen questions for Guardian and other types
- [ ] Analytics dashboard for card owners

### P3 (Future)
- [ ] Super-admin panel
- [ ] Native app conversion (iOS/Android)
- [ ] Advanced card templates designer

## Technical Stack
- **Frontend:** React, React Router, Tailwind CSS, shadcn/ui, lucide-react
- **Backend:** FastAPI, MongoDB (motor), Pydantic
- **Auth:** JWT + Emergent-managed Google OAuth
- **Storage:** Cloudinary for images
- **Payments:** Stripe (subscriptions + one-time)

## Test Credentials
- Email: `newtest@bruno.com`
- Password: `Test1234!`

## Test Results
- Frontend: 100% pass rate
- Backend: Previously tested, all endpoints working

---
*Last Updated: 2026-02-15*
