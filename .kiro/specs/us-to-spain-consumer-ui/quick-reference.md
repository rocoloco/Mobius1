# Quick Reference Guide
## US to Spain Migration Consumer UI

Quick reference for designers and developers working on the project.

## Colors

### Primary Palette
```
Teal (Primary)    #008B8B  rgb(0, 139, 139)
Coral (Accent)    #FF7F50  rgb(255, 127, 80)
Sandy Brown       #F4A460  rgb(244, 164, 96)
Charcoal          #2F4F4F  rgb(47, 79, 79)
Cornsilk (Cream)  #FFF8DC  rgb(255, 248, 220)
```

### Usage
- **Buttons**: Teal (primary), Coral (accent)
- **Text**: Charcoal
- **Backgrounds**: Cornsilk, White
- **Success**: Sandy Brown
- **Warning/Error**: Coral

## Typography

### Font
**Inter** - `font-family: Inter, system-ui, -apple-system, sans-serif`

### Scale
```
H1:    36px / Bold (700)      - Page titles
H2:    30px / Semibold (600)  - Section headings
H3:    24px / Semibold (600)  - Subsection headings
H4:    20px / Medium (500)    - Card titles
Body:  16px / Normal (400)    - Primary content
Small: 14px / Normal (400)    - Secondary content
```

## Spacing (8px Grid)

```
4px   - Micro spacing (icon + text)
8px   - Small gaps
16px  - Standard spacing
24px  - Section spacing
32px  - Large spacing
48px  - Page margins
64px  - Extra large spacing
```

## Components

### Buttons
```css
Primary:   bg-primary text-white px-6 py-3 rounded-md shadow-md
Secondary: border-2 border-primary text-primary px-6 py-2.5 rounded-md
Accent:    bg-accent text-white px-6 py-3 rounded-md shadow-md
Height:    44px minimum
```

### Cards
```css
Standard: bg-white border border-neutral-200 rounded-lg p-6 shadow-md
Hover:    hover:shadow-lg transition-shadow duration-200
```

### Inputs
```css
Input:  bg-white border border-neutral-300 rounded px-4 py-3 h-44
Focus:  focus:border-primary focus:ring-2 focus:ring-primary/10
Error:  border-accent-600 focus:ring-accent-600/10
```

### Badges
```css
Success:     bg-secondary-100 text-secondary-700 border-secondary-300
In Progress: bg-primary-50 text-primary-700 border-primary-300
Pending:     bg-neutral-100 text-neutral-700 border-neutral-300
Overdue:     bg-accent-50 text-accent-700 border-accent-300
Padding:     px-2 py-1 rounded-full text-xs font-medium
```

## Shadows

```css
sm:   0 1px 2px rgba(0,0,0,0.05)      - Inputs
md:   0 1px 3px rgba(0,0,0,0.1)       - Cards, buttons
lg:   0 4px 6px rgba(0,0,0,0.1)       - Dropdowns, hover
xl:   0 10px 15px rgba(0,0,0,0.1)     - Modals
2xl:  0 25px 50px rgba(0,0,0,0.25)    - Important modals
```

## Border Radius

```css
sm:   2px  - Subtle rounding
base: 4px  - Inputs
md:   6px  - Buttons
lg:   8px  - Cards
xl:   12px - Modals
full: 9999px - Pills, avatars
```

## Breakpoints

```css
Mobile:  < 768px   - Single column, 16px padding
Tablet:  768-1024  - 2 columns, 20px padding
Desktop: > 1024px  - 3-4 columns, 24px padding
```

## Transitions

```css
Fast:     150ms ease-in-out  - Hover states
Standard: 200ms ease-in-out  - Most transitions
Slow:     300ms ease-in-out  - Modals, page transitions
```

## Accessibility

### Contrast Ratios
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

### Touch Targets
- Minimum: 44px × 44px
- Mobile: 48px × 48px recommended

### Focus States
- Ring: 2px solid primary
- Offset: 2px from element

## Common Patterns

### Page Layout
```
┌─────────────────────────────┐
│ Top Nav (64px)              │
├──────────┬──────────────────┤
│ Sidebar  │ Main Content     │
│ (256px)  │ (max 1440px)     │
│          │                  │
└──────────┴──────────────────┘
```

### Card Structure
```
┌─────────────────────────┐
│ [Icon] Title       [✓]  │
│                         │
│ Description text...     │
│                         │
│ Metadata • Status       │
│                         │
│ [Primary] [Secondary]   │
└─────────────────────────┘
```

### Form Field
```
Label *
[_________________________]
Helper text or error message
```

## Tailwind Classes

### Common Combinations
```jsx
// Primary Button
className="bg-primary hover:bg-primary-600 text-white px-6 py-3 rounded-md shadow-md transition-colors duration-200"

// Card
className="bg-white border border-neutral-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow duration-200"

// Input
className="w-full bg-white border border-neutral-300 rounded px-4 py-3 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none"

// Badge
className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-300"
```

## File Locations

### Documentation
- Design System: `design-system.md`
- Color Palette: `selected-color-palette.md`
- Visual Style Guide: `visual-style-guide.md`
- Component Specs: `component-specifications.md`
- Mockup Guide: `high-fidelity-mockup-guide.md`

### Configuration
- Design Tokens: `design-tokens.json`
- Tailwind Config: `tailwind.config.example.js`

### Mockups
- High-Fidelity: `wireframes/high-fidelity/`
- Low-Fidelity: `wireframes/low-fidelity/`

## Resources

### Fonts
- Inter: https://fonts.google.com/specimen/Inter

### Icons
- Heroicons: https://heroicons.com/ (recommended)
- Lucide: https://lucide.dev/ (alternative)

### Tools
- Figma: Design and prototyping
- Tailwind CSS: https://tailwindcss.com/
- Next.js: https://nextjs.org/

## Design Philosophy

**Simple**: Generous whitespace, limited colors, clear hierarchy
**Magical**: Smooth animations, smart defaults, delightful interactions
**Functional**: High contrast, clear affordances, consistent patterns

---

**Last Updated**: Task 1.4 complete
**Version**: 1.0
