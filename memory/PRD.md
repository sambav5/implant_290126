# ImplantFlow - Clinical Decision Support for Dental Implant Planning

## Original Problem Statement
Build a mobile-first clinical decision support web application for dental implant planning. A case-centric implant planning assistant that helps dentists think through implant cases systematically, reduce missed steps, document reasoning, and learn from past cases over time.

**Key Constraints:**
- NOT a patient management system
- No scheduling, billing, insurance, or PMS functionality
- Decision support only - "Final responsibility lies with the clinician"

## Architecture

### Backend (FastAPI + MongoDB)
- **server.py**: Main API with all endpoints
- **MongoDB Collections**: cases (main data store)
- **Key Services**: Case CRUD, Planning Engine, Checklist Management, Feedback/Learning Loop

### Frontend (React + Tailwind + Shadcn UI)
- **Pages**: Dashboard, NewCase, CaseDetail, PlanningWizard, ProstheticChecklist, Checklists, LearningLoop
- **Services**: api.js (API calls), pdfService.js (PDF generation)
- **Design System**: EndoPilot - Lora serif for headings, Inter for body, JetBrains Mono for labels

## EndoPilot Design System

### CSS Variables (defined in index.css)
- `--bg`: #F4F2EE (warm background)
- `--card`: #FAFAF8 (card surfaces)
- `--border`: #E3E0D8 (light borders)
- `--border2`: #CCCAB8 (medium borders)
- `--t1`: #1A1917 (primary text)
- `--t2`: #6A6860 (secondary text)
- `--t3`: #A9A79F (tertiary text)
- `--green`: #1A6B4A (success/primary action)
- `--amber`: #D97706 (warning/in-progress)
- `--red`: #8B2112 (error/high-risk)
- `--blue`: #1A3F6F (info/planning)

### Core CSS Classes
- `.card-clinical`: Standard card styling
- `.btn-clinical`, `.btn-primary-endo`, `.btn-secondary-endo`, `.btn-green-endo`: Button variants
- `.input-clinical`: Form input styling
- `.label-endo`: Monospace uppercase labels
- `.glass-header`: Sticky header with backdrop blur
- `.page-container`: Responsive container with max-widths
- `.risk-badge-low/moderate/high`: Risk level badges
- `.status-planning/in-progress/completed`: Status badges

## User Personas
1. **Primary**: Dentists placing implants (general dentists, implantologists, prosthodontists)
2. **Usage Context**: Mobile-first, chairside usage

## Core Requirements (Static)

### Must Have ✓
- [x] Quick Case Creation (<30 seconds)
- [x] Pre-Treatment Planning Engine with risk stratification
- [x] Interactive Checklists (Pre/Treatment/Post phases)
- [x] Learning Loop for personalized clinical memory
- [x] PDF Generation (Dentist & Lab copies)
- [x] Timeline/Audit logging
- [x] Clinical disclaimers throughout

### Must NOT Have ❌
- Patient scheduling
- Billing / insurance
- PMS integrations
- Automatic treatment decisions
- AI diagnosis
- Voice recording storage

## What's Been Implemented

### December 2025 - EndoPilot Design System Refactor
**Global UI Refactoring Completed:**
- All pages refactored to use EndoPilot design system CSS variables
- Consistent typography: Lora for headings, Inter for body, JetBrains Mono for labels
- Replaced all hardcoded Tailwind colors with CSS variables
- Fixed JSX structure issues in NewCase.jsx
- Applied `.card-clinical`, `.btn-primary-endo`, `.btn-secondary-endo`, `.btn-green-endo` consistently
- Updated all input fields to use `.input-clinical`
- Applied proper `.glass-header` to all page headers
- Consistent spacing and layout patterns across all pages

**Pages Refactored:**
- Dashboard.jsx - Already consistent
- CaseDetail.jsx - Already consistent
- NewCase.jsx - Fixed structure and updated styling
- PlanningWizard.jsx - Updated complexity/risk config to use CSS variables
- ProstheticChecklist.jsx - Already consistent
- Checklists.jsx - Full refactor to EndoPilot styles
- LearningLoop.jsx - Full refactor to EndoPilot styles

**Components Updated:**
- RoleBadge.jsx - Already consistent
- RoleSwitcher.jsx - Already consistent

### January 23, 2026 - MVP Complete
**Backend:**
- Case CRUD operations (create, read, update, delete)
- Planning engine with SAC-inspired risk stratification
- Checklist management (pre/treatment/post phases)
- Learning loop/feedback system
- Attachment handling
- Status management
- Timeline/audit logging

**Frontend:**
- Dashboard with case listing and statistics
- Quick case creation form
- Case detail page with action cards
- Step-by-step planning wizard (4 steps)
- Interactive checklists with notes
- Treatment Blueprint with tab-based navigation
- Learning reflection page
- PDF generation (client-side with jspdf)
- Mobile-first responsive design
- Role-based collaboration (Clinician, Implantologist, Prosthodontist, Assistant)

## Prioritized Backlog

### P0 (Critical) - Done
- [x] Case creation and management
- [x] Planning engine
- [x] Checklists
- [x] Risk assessment
- [x] EndoPilot design system consistency

### P1 (High Priority) - Future
- [ ] Image/CBCT attachment uploads
- [ ] Case search and filtering
- [ ] Export/import case data
- [ ] PWA offline support

### P2 (Medium Priority) - Future
- [ ] Voice-assisted input (Whisper integration)
- [ ] Case templates
- [ ] Multi-user support with authentication
- [ ] Case sharing/collaboration

### P3 (Low Priority) - Future
- [ ] Dark mode
- [ ] Advanced analytics dashboard
- [ ] Case comparison tools

## Next Tasks
1. Add image upload functionality for attachments
2. Implement case export/backup feature
3. Add PWA manifest for offline capability
4. Consider adding user authentication for multi-user scenario
