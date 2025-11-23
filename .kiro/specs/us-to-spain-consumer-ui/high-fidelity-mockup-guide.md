# High-Fidelity Mockup Guide
## US to Spain Migration Consumer UI

This guide provides detailed specifications for creating high-fidelity mockups in Figma with the approved Mid-Century Modern color palette and design system.

## Overview

High-fidelity mockups transform the low-fidelity wireframes into polished, branded designs that are ready for development. These mockups include:

- **Applied color palette** (Mid-Century Modern)
- **Typography and visual hierarchy**
- **Component library** for reusable elements
- **Design tokens** (colors, spacing, typography)
- **Visual polish** (shadows, borders, hover states)
- **Responsive layouts** for mobile, tablet, and desktop

## Design Philosophy: Simple, Magical, Functional

### Visual Principles

**Simplicity**
- Generous whitespace (minimum 24px between major sections)
- Limited color palette (5 core colors)
- Clear visual hierarchy through size and weight
- Minimal decorative elements
- Focus on content over chrome

**Magical Experience**
- Smooth transitions and micro-interactions
- Delightful illustrations for empty states
- Purposeful animations that guide attention
- Smart defaults and intelligent recommendations
- Subtle gradients and shadows for depth

**Functionality**
- High contrast for readability (WCAG AA minimum)
- Touch-friendly targets (44px minimum)
- Clear affordances (buttons look clickable)
- Consistent patterns across all pages
- Accessible color combinations

## Applied Color Palette

### Primary Colors

**Teal** - `#008B8B`
- Primary buttons and CTAs
- Active navigation items
- Links and interactive elements
- Progress indicators
- Focus states

**Coral** - `#FF7F50`
- Accent buttons and highlights
- Important notifications
- Warning states
- Attention-grabbing elements

**Sandy Brown** - `#F4A460`
- Secondary accents
- Success states
- Progress completion
- Warm highlights

### Neutral Colors

**Charcoal** - `#2F4F4F`
- Headings (H1-H6)
- Body text
- Icons
- Dark UI elements

**Cornsilk** - `#FFF8DC`
- Page backgrounds
- Card backgrounds
- Light sections
- Subtle highlights

### Semantic Colors

- **Success**: Sandy Brown `#F4A460` with Charcoal text
- **Warning**: Coral `#FF7F50` with white text
- **Error**: Darker Coral `#E6653A` with white text
- **Info**: Teal `#008B8B` with white text

## Typography System

### Font Selection

**Primary Font**: **Inter** (sans-serif)
- Clean, modern, highly readable
- Excellent for UI and body text
- Wide range of weights available
- Open source and web-friendly

**Alternative**: **Poppins** (sans-serif)
- Geometric, friendly appearance
- Good for headings
- Pairs well with Inter

### Type Scale

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| **H1** | 36px (2.25rem) | Bold (700) | 1.2 | Page titles |
| **H2** | 30px (1.875rem) | Semibold (600) | 1.3 | Section headings |
| **H3** | 24px (1.5rem) | Semibold (600) | 1.4 | Subsection headings |
| **H4** | 20px (1.25rem) | Medium (500) | 1.4 | Card titles |
| **Body Large** | 18px (1.125rem) | Normal (400) | 1.6 | Intro text, important content |
| **Body** | 16px (1rem) | Normal (400) | 1.5 | Primary content |
| **Body Small** | 14px (0.875rem) | Normal (400) | 1.5 | Secondary content |
| **Caption** | 12px (0.75rem) | Normal (400) | 1.4 | Labels, metadata |

### Typography Usage Examples

**Page Header**
```
H1: "Dashboard" (36px, Bold, Charcoal)
Subtitle: "Track your migration progress" (18px, Normal, Charcoal-600)
```

**Card Title**
```
H4: "Active Workflows" (20px, Medium, Charcoal)
```

**Body Text**
```
Body: "You have 3 active workflows..." (16px, Normal, Charcoal)
```

**Button Text**
```
Button: "Continue" (16px, Medium, White on Teal)
```

## Component Library

### Buttons

#### Primary Button
- **Background**: Teal `#008B8B`
- **Text**: White, 16px, Medium
- **Padding**: 12px 24px
- **Border Radius**: 6px
- **Height**: 44px
- **Hover**: Teal-600 `#007070`
- **Active**: Teal-700 `#005454`
- **Shadow**: `0 2px 4px rgba(0,0,0,0.1)`

#### Secondary Button
- **Background**: Transparent
- **Border**: 2px solid Teal `#008B8B`
- **Text**: Teal, 16px, Medium
- **Padding**: 10px 22px (adjusted for border)
- **Border Radius**: 6px
- **Height**: 44px
- **Hover**: Cream-100 background
- **Active**: Cream-200 background

#### Accent Button
- **Background**: Coral `#FF7F50`
- **Text**: White, 16px, Medium
- **Padding**: 12px 24px
- **Border Radius**: 6px
- **Height**: 44px
- **Hover**: Coral-600 `#E6653A`
- **Shadow**: `0 2px 4px rgba(0,0,0,0.1)`

#### Text Button
- **Background**: Transparent
- **Text**: Teal, 16px, Medium
- **Padding**: 8px 16px
- **Hover**: Underline
- **Active**: Teal-700

### Cards

#### Standard Card
- **Background**: White or Cream `#FFF8DC`
- **Border**: 1px solid Neutral-200 `#D1D7D7`
- **Border Radius**: 8px
- **Padding**: 24px
- **Shadow**: `0 1px 3px rgba(0,0,0,0.1)`
- **Hover**: Shadow increases to `0 4px 6px rgba(0,0,0,0.1)`

#### Workflow Card
- **Background**: White
- **Border**: 1px solid Neutral-200
- **Border Radius**: 12px
- **Padding**: 24px
- **Icon Area**: 48px circle with Teal-100 background
- **Title**: H4, Charcoal
- **Description**: Body Small, Neutral-600
- **Progress Bar**: Teal fill, Neutral-200 background
- **Button**: Primary button at bottom

#### Document Card
- **Background**: Cream `#FFF8DC`
- **Border**: 1px solid Neutral-200
- **Border Radius**: 8px
- **Padding**: 16px
- **Icon**: 32px document icon, Teal
- **Title**: Body, Charcoal, truncate with ellipsis
- **Metadata**: Caption, Neutral-500
- **Status Badge**: Top right corner
- **Actions**: Icon buttons on hover

### Form Elements

#### Text Input
- **Background**: White
- **Border**: 1px solid Neutral-300 `#BAC3C3`
- **Border Radius**: 4px
- **Padding**: 12px 16px
- **Height**: 44px
- **Font**: 16px, Normal, Charcoal
- **Placeholder**: Neutral-400
- **Focus**: Border changes to Teal, 2px shadow `0 0 0 3px rgba(0,139,139,0.1)`
- **Error**: Border changes to Coral-600, error message below in Coral-600

#### Dropdown/Select
- **Same as text input** with dropdown arrow icon on right
- **Arrow**: Neutral-500, 16px
- **Dropdown Menu**: White background, shadow `0 4px 6px rgba(0,0,0,0.1)`
- **Option Hover**: Cream-100 background
- **Option Selected**: Teal-50 background

#### Checkbox
- **Size**: 20px × 20px
- **Border**: 2px solid Neutral-400
- **Border Radius**: 4px
- **Checked**: Teal background, white checkmark
- **Focus**: 2px shadow `0 0 0 3px rgba(0,139,139,0.1)`

#### Radio Button
- **Size**: 20px × 20px
- **Border**: 2px solid Neutral-400
- **Border Radius**: 50% (circle)
- **Selected**: Teal background with white inner circle (8px)
- **Focus**: 2px shadow `0 0 0 3px rgba(0,139,139,0.1)`

### Navigation

#### Top Navigation Bar
- **Background**: White
- **Height**: 64px
- **Border Bottom**: 1px solid Neutral-200
- **Logo**: Left side, 32px height
- **Search**: Center, max-width 400px
- **Icons**: Right side, 24px, Neutral-600
- **Profile**: Avatar 36px circle, dropdown on click
- **Shadow**: `0 1px 3px rgba(0,0,0,0.05)`

#### Sidebar Navigation
- **Background**: Cream `#FFF8DC`
- **Width**: 256px (desktop), full width drawer (mobile)
- **Border Right**: 1px solid Neutral-200
- **Item Height**: 44px
- **Item Padding**: 12px 16px
- **Icon**: 20px, Neutral-600
- **Text**: 16px, Medium, Neutral-700
- **Active Item**: Teal-50 background, Teal text and icon
- **Hover**: Cream-200 background

### Status Badges

#### Completed
- **Background**: Sandy Brown-100 `#FDF1E5`
- **Text**: Sandy Brown-700 `#EC701A`, 12px, Medium
- **Border**: 1px solid Sandy Brown-300
- **Padding**: 4px 8px
- **Border Radius**: 12px (pill shape)
- **Icon**: ✓ checkmark

#### In Progress
- **Background**: Teal-50 `#E6F7F7`
- **Text**: Teal-700 `#005454`, 12px, Medium
- **Border**: 1px solid Teal-300
- **Icon**: ⏳ hourglass or spinner

#### Pending
- **Background**: Neutral-100 `#E8EBEB`
- **Text**: Neutral-700 `#5E7373`, 12px, Medium
- **Border**: 1px solid Neutral-300
- **Icon**: ○ circle

#### Overdue
- **Background**: Coral-50 `#FFF4F0`
- **Text**: Coral-700 `#CC4B24`, 12px, Medium
- **Border**: 1px solid Coral-300
- **Icon**: ⚠️ warning

### Progress Indicators

#### Progress Bar
- **Height**: 8px
- **Background**: Neutral-200 `#D1D7D7`
- **Fill**: Teal `#008B8B`
- **Border Radius**: 4px (fully rounded ends)
- **Animation**: Smooth fill transition (300ms)

#### Circular Progress
- **Size**: 48px diameter
- **Stroke Width**: 4px
- **Background**: Neutral-200
- **Fill**: Teal
- **Center Text**: Percentage, 14px, Medium, Charcoal

### Modals

#### Standard Modal
- **Background**: White
- **Max Width**: 600px
- **Border Radius**: 12px
- **Padding**: 32px
- **Shadow**: `0 20px 25px rgba(0,0,0,0.15)`
- **Backdrop**: Black with 50% opacity
- **Close Button**: Top right, 24px icon, Neutral-500
- **Header**: H3, Charcoal, margin-bottom 16px
- **Content**: Body text, Charcoal
- **Actions**: Bottom, right-aligned, 16px gap between buttons

### Notifications/Toasts

#### Success Toast
- **Background**: Sandy Brown-100
- **Border Left**: 4px solid Sandy Brown
- **Icon**: ✓ checkmark, Sandy Brown
- **Text**: Charcoal, 14px
- **Padding**: 16px
- **Border Radius**: 8px
- **Shadow**: `0 4px 6px rgba(0,0,0,0.1)`
- **Position**: Top right, slide in animation

#### Error Toast
- **Background**: Coral-50
- **Border Left**: 4px solid Coral-600
- **Icon**: ✗ X, Coral-600
- **Text**: Charcoal, 14px

#### Info Toast
- **Background**: Teal-50
- **Border Left**: 4px solid Teal
- **Icon**: ℹ️ info, Teal
- **Text**: Charcoal, 14px

## Design Tokens

### Spacing Scale (8px base)
```
spacing-1: 4px
spacing-2: 8px
spacing-3: 12px
spacing-4: 16px
spacing-5: 20px
spacing-6: 24px
spacing-8: 32px
spacing-10: 40px
spacing-12: 48px
spacing-16: 64px
spacing-20: 80px
spacing-24: 96px
```

### Border Radius
```
radius-sm: 4px (inputs)
radius-md: 6px (buttons)
radius-lg: 8px (cards)
radius-xl: 12px (modals, large cards)
radius-full: 9999px (pills, avatars)
```

### Shadows
```
shadow-sm: 0 1px 2px rgba(0,0,0,0.05)
shadow-md: 0 1px 3px rgba(0,0,0,0.1)
shadow-lg: 0 4px 6px rgba(0,0,0,0.1)
shadow-xl: 0 10px 15px rgba(0,0,0,0.1)
shadow-2xl: 0 20px 25px rgba(0,0,0,0.15)
```

### Transitions
```
transition-fast: 150ms ease-in-out
transition-base: 200ms ease-in-out
transition-slow: 300ms ease-in-out
```

## Page-Specific Mockup Guidelines

### 1. Dashboard Page

**Visual Hierarchy**
1. Welcome header with user name (H1)
2. Overall progress bar (prominent, Teal)
3. Active workflows (3-column grid, cards)
4. Upcoming appointments (list, right sidebar)
5. Recent activity (timeline, bottom)

**Color Application**
- Background: Cream-100 `#FFFEF9`
- Cards: White with shadow-md
- Progress bar: Teal fill on Neutral-200
- Workflow status badges: Use semantic colors
- Primary CTA: Teal buttons

**Visual Polish**
- Add subtle gradient to welcome header (Cream to White)
- Use icons for workflow types (visa, document, calendar)
- Animate progress bar on load
- Add hover states to workflow cards (lift effect)

### 2. User Profile Setup Page

**Visual Hierarchy**
1. Step indicator (centered, top)
2. Form title (H2)
3. Form fields (stacked, generous spacing)
4. Navigation buttons (bottom)

**Color Application**
- Background: White
- Step indicator: Teal for active, Neutral-300 for inactive
- Form fields: White with Neutral-300 borders
- Primary button: Teal
- Secondary button: Outlined Teal

**Visual Polish**
- Add progress line connecting step dots
- Use smooth transitions between steps
- Add field validation icons (✓ for valid, ✗ for invalid)
- Subtle shadow on form container

### 3. Workflow Selection Page

**Visual Hierarchy**
1. Page title and description
2. Recommended workflows (highlighted section)
3. Category headers
4. Workflow cards (grid)

**Color Application**
- Background: Cream-100
- Recommended section: Teal-50 background with Teal border
- Workflow cards: White with shadow-md
- Category headers: Charcoal, H3
- Start buttons: Teal primary

**Visual Polish**
- Add workflow icons (custom illustrations)
- Use Sandy Brown for "Recommended" badge
- Add hover effect to cards (scale 1.02, shadow-lg)
- Show workflow difficulty with colored dots

### 4. Workflow Stepper Page

**Visual Hierarchy**
1. Back navigation
2. Workflow name and step indicator
3. Progress bar
4. Step content card (centered)
5. Navigation buttons
6. Help widget

**Color Application**
- Background: Cream-100
- Progress dots: Teal for completed, Neutral-300 for upcoming
- Content card: White with shadow-lg
- Checkboxes: Teal when checked
- Help widget: Teal-50 background

**Visual Polish**
- Animate progress bar as steps complete
- Add checkmark animation for completed items
- Use icons for different step types
- Subtle pulse on "Next" button to guide user

### 5. Document Vault Page

**Visual Hierarchy**
1. Page title and upload button
2. Search and filters
3. Category sections (collapsible)
4. Document cards (list)

**Color Application**
- Background: Cream-100
- Upload button: Coral accent
- Document cards: Cream background
- Status badges: Semantic colors
- Category headers: Charcoal, H4

**Visual Polish**
- Add document type icons (passport, certificate, etc.)
- Use Sandy Brown for verified documents
- Add upload progress animation
- Show OCR extraction with subtle highlight

### 6. Form Generator Page

**Visual Hierarchy**
1. Form type selection (cards)
2. Form preview (centered)
3. Field status indicators
4. Completion progress
5. Action buttons

**Color Application**
- Background: Cream-100
- Form preview: White card with shadow-lg
- Auto-filled fields: Teal-50 background
- Missing fields: Coral-50 background with warning icon
- Download button: Teal primary (disabled if incomplete)

**Visual Polish**
- Add form type icons
- Use checkmarks for completed fields
- Add warning icons for missing fields
- Show completion percentage with circular progress

### 7. AI Assistant Chat Page

**Visual Hierarchy**
1. Chat history (scrollable)
2. Message bubbles (user vs assistant)
3. Input area (sticky bottom)
4. Quick actions

**Color Application**
- Background: Cream-100
- User messages: Teal background, white text
- Assistant messages: White background, Charcoal text
- Input area: White with shadow-lg
- Send button: Teal

**Visual Polish**
- Add bot avatar (friendly icon)
- Use typing indicator (animated dots)
- Add source citation badges (Teal-50)
- Smooth scroll to new messages
- Add suggested questions as chips (Teal-50 background)

### 8. Appointment Calendar Page

**Visual Hierarchy**
1. View toggle and new appointment button
2. Calendar widget
3. Appointment list
4. Appointment cards

**Color Application**
- Background: Cream-100
- Calendar: White with shadow-md
- Appointment days: Teal-100 background
- Today: Teal-500 border
- Appointment cards: White with shadow-md
- Reminder icons: Sandy Brown

**Visual Polish**
- Add appointment type icons
- Use color coding for appointment types
- Add hover effect on calendar days
- Show mini preview on day hover

### 9. Cost Tracker Page

**Visual Hierarchy**
1. Currency selector and add expense button
2. Total summary card (prominent)
3. Category breakdown (accordion)
4. Expense items (list)

**Color Application**
- Background: Cream-100
- Summary card: White with shadow-lg, Teal accent
- Progress bars: Teal fill on Neutral-200
- Paid items: Sandy Brown checkmark
- Pending items: Coral warning icon
- Category cards: White with shadow-md

**Visual Polish**
- Add currency icons ($ and €)
- Use large, bold numbers for totals
- Animate progress bars on load
- Add sparkline charts for spending trends
- Use color coding: green for under budget, red for over

### 10. Regional Resources Page

**Visual Hierarchy**
1. Region selector (cards)
2. Search bar
3. Category sections
4. Resource cards

**Color Application**
- Background: Cream-100
- Selected region: Teal-500 background, white text
- Unselected regions: White with Neutral-300 border
- Resource cards: White with shadow-md
- Category headers: Charcoal, H4
- Map markers: Teal

**Visual Polish**
- Add region illustrations or photos
- Use icons for resource types (building, hospital, bank)
- Add map integration (optional)
- Show "last updated" in Caption style

## Responsive Design Guidelines

### Mobile (< 768px)
- Single column layout
- Stack all cards vertically
- Collapse sidebar to hamburger menu
- Full-width buttons
- Larger touch targets (minimum 44px)
- Reduce padding to 16px
- Smaller font sizes (scale down by 2px)

### Tablet (768px - 1024px)
- 2-column grid for cards
- Sidebar can toggle
- Flexible layouts
- Medium padding (20px)
- Standard font sizes

### Desktop (> 1024px)
- 3-4 column grids
- Full sidebar visible
- Maximum content width: 1440px
- Generous padding (24px)
- Hover states active
- Full font sizes

## Figma Organization

### File Structure
```
US to Spain Migration UI
├── 📄 Cover Page
├── 🎨 Design System
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   ├── Shadows
│   └── Icons
├── 🧩 Component Library
│   ├── Buttons
│   ├── Forms
│   ├── Cards
│   ├── Navigation
│   ├── Modals
│   └── Badges
├── 📱 Mobile Mockups
│   ├── Dashboard
│   ├── Profile Setup
│   ├── Workflows
│   └── ... (all pages)
├── 💻 Desktop Mockups
│   ├── Dashboard
│   ├── Profile Setup
│   ├── Workflows
│   └── ... (all pages)
└── 🔄 User Flows
    ├── Onboarding Flow
    ├── Document Upload Flow
    └── Workflow Completion Flow
```

### Component Organization
- Create components for all reusable elements
- Use variants for button states (default, hover, active, disabled)
- Use auto-layout for responsive components
- Name components clearly: `Button/Primary/Default`
- Create component sets for related variants

### Design Tokens in Figma
- Create color styles for all palette colors
- Create text styles for all typography scales
- Create effect styles for shadows
- Use consistent naming: `Primary/Teal/500`, `Text/Heading/H1`

## Export Specifications

### Export Settings
- **Format**: PNG (for mockups), SVG (for icons)
- **Scale**: 2x for retina displays
- **Naming**: `page-name-viewport.png` (e.g., `dashboard-desktop.png`)
- **Location**: `.kiro/specs/us-to-spain-consumer-ui/wireframes/high-fidelity/`

### Deliverables
1. **Design System Page** - All tokens and components documented
2. **Component Library** - All components with variants
3. **Desktop Mockups** - All 10 pages at 1440px width
4. **Mobile Mockups** - All 10 pages at 375px width
5. **Tablet Mockups** (optional) - Key pages at 768px width
6. **User Flow Diagrams** - Visual flows for key journeys
7. **Design Specifications** - Exported as PDF with measurements
8. **Developer Handoff** - Figma inspect mode enabled

## Next Steps

1. ✅ Review this guide
2. Open Figma and create new file
3. Set up design system (colors, typography, components)
4. Apply branding to wireframes
5. Create component library
6. Build high-fidelity mockups for all pages
7. Export mockups and specifications
8. Share with team for review
9. Iterate based on feedback
10. Prepare for development handoff

---

**Status**: Ready for implementation
**Last Updated**: Task 1.4 in progress
**Next Task**: 2.1 Initialize Next.js project
