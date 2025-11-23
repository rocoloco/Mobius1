# Wireframe Creation Guide

## Quick Start

This guide will help you create low-fidelity wireframes in Figma for the US to Spain Migration Consumer UI.

## Setup

1. **Open Figma Desktop App**
2. **Create a new page** called "Wireframes"
3. **Set up artboards** for each page (1440x1024 for desktop views)

## Design System Basics

### Grid
- 12-column grid
- 24px gutters
- Max width: 1440px

### Spacing
Use 8px increments: 8, 16, 24, 32, 48, 64, 96

### Typography (Low-Fi)
- Headings: 24px, 20px, 18px
- Body: 16px
- Small: 14px
- Use system fonts for wireframes

### Colors (Grayscale Only)
- Background: #FFFFFF
- Cards: #F5F5F5
- Borders: #E0E0E0
- Text: #333333
- Secondary text: #666666

## Pages to Create

### 1. Dashboard (Priority: High)
**Artboard**: 1440x1024px
**Key Elements**:
- Top nav (64px height)
- Sidebar (256px width)
- Welcome header with progress bar
- 3 workflow cards (grid)
- Upcoming appointments list
- Recent activity timeline

### 2. User Profile Setup (Priority: High)
**Artboard**: 1440x1024px (centered form, 600px max-width)
**Key Elements**:
- Step indicator (4 steps)
- Form fields (stacked)
- Back/Continue buttons

### 3. Workflow Selection (Priority: High)
**Artboard**: 1440x1024px
**Key Elements**:
- Recommended workflows (3 cards)
- All workflows (grid, grouped by category)
- Search and filter

### 4. Workflow Stepper (Priority: High)
**Artboard**: 1440x1024px
**Key Elements**:
- Progress indicator
- Step content card (centered, 800px max-width)
- Checklist or form
- Navigation buttons
- Help widget

### 5. Document Vault (Priority: Medium)
**Artboard**: 1440x1024px
**Key Elements**:
- Upload button + search
- Filters
- Document cards (grouped by category)
- Status badges

### 6. Form Generator (Priority: Medium)
**Artboard**: 1440x1024px
**Key Elements**:
- Form type selection (cards)
- Form preview with fields
- Completion indicator
- Edit/Download buttons

### 7. AI Assistant Chat (Priority: Medium)
**Artboard**: 1440x1024px
**Key Elements**:
- Chat history (scrollable)
- Message bubbles (user vs assistant)
- Input area (bottom, sticky)
- Suggested questions

### 8. Appointment Calendar (Priority: Medium)
**Artboard**: 1440x1024px
**Key Elements**:
- Calendar widget (month view)
- Appointment list
- Appointment cards with details

### 9. Cost Tracker (Priority: Low)
**Artboard**: 1440x1024px
**Key Elements**:
- Total summary card
- Category breakdown (accordion)
- Progress bars
- Expense items

### 10. Regional Resources (Priority: Low)
**Artboard**: 1440x1024px
**Key Elements**:
- Region selector (cards)
- Search bar
- Resource cards (grouped by category)

## Wireframe Components to Create

### Reusable Components
1. **Navigation Bar**
   - Logo + app name
   - Search icon
   - Notifications icon
   - User profile dropdown

2. **Sidebar**
   - Logo
   - Navigation links with icons
   - Settings/Help at bottom

3. **Card**
   - Container with padding
   - Title, description, metadata
   - Action buttons

4. **Button**
   - Primary (filled)
   - Secondary (outline)
   - Sizes: small, medium, large

5. **Form Field**
   - Label
   - Input box
   - Helper text

6. **Status Badge**
   - Small pill shape
   - Different states (use grayscale)

## Wireframing Tips

### Keep It Low-Fidelity
- Use rectangles for images
- Use lines for text (or simple placeholder text)
- No colors (grayscale only)
- No detailed styling
- Focus on layout and hierarchy

### Show Hierarchy
- Use size to indicate importance
- Use spacing to group related items
- Use alignment to create order

### Annotate
- Add notes for interactions
- Explain dynamic content
- Call out important features

### Use Placeholders
- [Logo] for logo
- [Image] for images
- Lorem ipsum or "Heading text" for text
- Icons can be simple shapes

## Export Settings

Once wireframes are complete:

1. **Select all artboards**
2. **Export as PNG**
   - 1x resolution
   - Save to: `.kiro/specs/us-to-spain-consumer-ui/wireframes/`
3. **Naming convention**:
   - `01-dashboard.png`
   - `02-profile-setup.png`
   - `03-workflow-selection.png`
   - etc.

## Review Checklist

Before finalizing:
- [ ] All 10 pages created
- [ ] Consistent spacing (8px increments)
- [ ] Clear visual hierarchy
- [ ] Generous whitespace
- [ ] Responsive considerations noted
- [ ] Key interactions annotated
- [ ] Exported to wireframes folder

## Reference

See `wireframe-specifications.md` for detailed layouts and component descriptions.

