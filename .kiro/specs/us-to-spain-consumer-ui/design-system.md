# Design System Foundations
## US to Spain Migration Consumer UI

This document defines the foundational design system for the US to Spain Migration Consumer UI, following the "simple, magical, functional" design philosophy.

## Design Philosophy

### Simplicity
- Remove unnecessary complexity and cognitive load
- Focus on essential features that deliver maximum value
- Use progressive disclosure to reveal complexity only when needed
- Minimize the number of steps required to complete tasks
- Clear visual hierarchy guides users naturally through workflows

### Magical Experience
- Anticipate user needs before they ask (intelligent recommendations)
- Provide smart defaults based on user context
- Use smooth, purposeful animations that enhance understanding
- Make complex processes feel effortless through automation
- Delight users with thoughtful micro-interactions

### Functionality
- Every feature must serve a clear purpose
- Prioritize reliability and correctness over feature quantity
- Ensure the application works flawlessly for core use cases
- Focus on doing a few things exceptionally well

## Grid System

### Layout Grid
- **Desktop (> 1024px)**: 12-column grid with 24px gutters
- **Tablet (768-1024px)**: 8-column grid with 20px gutters
- **Mobile (< 768px)**: 4-column grid with 16px gutters

### Container Widths
- **Max Width**: 1280px (centered)
- **Content Width**: 1024px (for reading content)
- **Narrow Width**: 768px (for forms and focused content)

### Breakpoints
```typescript
const breakpoints = {
  sm: '640px',   // Small devices (phones)
  md: '768px',   // Medium devices (tablets)
  lg: '1024px',  // Large devices (desktops)
  xl: '1280px',  // Extra large devices
  '2xl': '1536px' // 2X Extra large devices
}
```

## Spacing Scale

Following an 8px base unit for consistent spacing:

```typescript
const spacing = {
  0: '0px',
  1: '4px',    // 0.5 * base
  2: '8px',    // 1 * base
  3: '12px',   // 1.5 * base
  4: '16px',   // 2 * base
  5: '20px',   // 2.5 * base
  6: '24px',   // 3 * base
  8: '32px',   // 4 * base
  10: '40px',  // 5 * base
  12: '48px',  // 6 * base
  16: '64px',  // 8 * base
  20: '80px',  // 10 * base
  24: '96px',  // 12 * base
  32: '128px', // 16 * base
}
```

### Spacing Usage Guidelines
- **Micro spacing (4-8px)**: Between related elements (icon + text, form label + input)
- **Small spacing (12-16px)**: Between form fields, list items
- **Medium spacing (24-32px)**: Between sections within a card, between paragraphs
- **Large spacing (48-64px)**: Between major sections, page margins
- **Extra large spacing (80-128px)**: Between page sections, hero spacing

## Typography Scale

### Font Families (Placeholder - to be defined with branding)
```typescript
const fontFamily = {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  serif: ['Georgia', 'serif'],
  mono: ['JetBrains Mono', 'monospace']
}
```

### Type Scale
Based on a modular scale with 1.25 ratio:

```typescript
const fontSize = {
  xs: '0.75rem',    // 12px - Small labels, captions
  sm: '0.875rem',   // 14px - Body small, secondary text
  base: '1rem',     // 16px - Body text
  lg: '1.125rem',   // 18px - Large body, subheadings
  xl: '1.25rem',    // 20px - H4
  '2xl': '1.5rem',  // 24px - H3
  '3xl': '1.875rem', // 30px - H2
  '4xl': '2.25rem',  // 36px - H1
  '5xl': '3rem',     // 48px - Display
  '6xl': '3.75rem',  // 60px - Hero
}
```

### Line Heights
```typescript
const lineHeight = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
}
```

### Font Weights
```typescript
const fontWeight = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}
```

### Typography Usage
- **H1 (4xl, bold)**: Page titles
- **H2 (3xl, semibold)**: Major section headings
- **H3 (2xl, semibold)**: Subsection headings
- **H4 (xl, medium)**: Card titles, minor headings
- **Body (base, normal)**: Primary content
- **Body Small (sm, normal)**: Secondary content, descriptions
- **Caption (xs, normal)**: Labels, metadata, timestamps

## Color Palette (Placeholder)

This is a placeholder palette. The final palette will be defined during Task 1.3 based on user preferences and accessibility requirements.

### Primary Colors
```typescript
const colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Base primary
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  secondary: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',  // Base secondary
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  // Additional colors to be defined...
}
```

### Semantic Colors
- **Success**: Green tones
- **Warning**: Orange/amber tones
- **Error**: Red tones
- **Info**: Blue tones

### Neutral Colors
- Gray scale from 50 to 950 for backgrounds, borders, and text

## Border Radius

```typescript
const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',   // Fully rounded
}
```

### Border Radius Usage
- **sm**: Input fields, small buttons
- **md**: Cards, panels, default buttons
- **lg**: Modals, large cards
- **xl**: Feature cards, hero sections
- **full**: Pills, avatars, icon buttons

## Shadows

```typescript
const boxShadow = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: 'none',
}
```

### Shadow Usage
- **sm**: Subtle elevation (form inputs)
- **DEFAULT**: Cards, buttons
- **md**: Dropdowns, popovers
- **lg**: Modals, drawers
- **xl**: Hero sections, feature highlights

## Animation & Transitions

### Duration
```typescript
const transitionDuration = {
  75: '75ms',
  100: '100ms',
  150: '150ms',
  200: '200ms',
  300: '300ms',
  500: '500ms',
  700: '700ms',
  1000: '1000ms',
}
```

### Timing Functions
```typescript
const transitionTimingFunction = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
}
```

### Animation Principles
- **Purposeful**: Animations should guide attention and provide feedback
- **Fast**: Most transitions should be 150-300ms
- **Smooth**: Use easing functions for natural motion
- **Consistent**: Similar actions should have similar animations

### Common Animations
- **Fade in/out**: Modals, tooltips, notifications
- **Slide in/out**: Drawers, side panels
- **Scale**: Buttons on hover, cards on interaction
- **Skeleton loading**: Content placeholders during loading

## Accessibility

### Color Contrast
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text (18px+ or 14px+ bold)**: Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

### Focus States
- Visible focus indicators on all interactive elements
- Focus ring: 2px solid primary color with 2px offset
- Never remove focus styles without providing alternatives

### Touch Targets
- Minimum 44x44px for all interactive elements
- Adequate spacing between touch targets (8px minimum)

## Component Patterns

### Cards
- Background: White (light mode) / Dark gray (dark mode)
- Border: 1px solid gray-200
- Border radius: md (6px)
- Padding: 24px
- Shadow: DEFAULT

### Buttons
- **Primary**: Solid background, primary color
- **Secondary**: Outlined, primary color border
- **Tertiary**: Text only, no background
- Height: 40px (default), 32px (small), 48px (large)
- Padding: 16px horizontal
- Border radius: md (6px)

### Form Inputs
- Height: 40px
- Padding: 12px horizontal
- Border: 1px solid gray-300
- Border radius: sm (4px)
- Focus: Primary color border, shadow

### Modals
- Max width: 600px (default)
- Padding: 32px
- Border radius: lg (8px)
- Shadow: xl
- Backdrop: Semi-transparent black (0.5 opacity)

## Responsive Design

### Mobile-First Approach
- Design for mobile first, then enhance for larger screens
- Use progressive enhancement
- Test on actual devices

### Breakpoint Strategy
- **Mobile (< 768px)**: Single column, stacked layout
- **Tablet (768-1024px)**: 2-column layout where appropriate
- **Desktop (> 1024px)**: Multi-column layout, sidebars

### Responsive Typography
- Scale font sizes appropriately for each breakpoint
- Maintain readability at all sizes
- Adjust line heights for optimal reading

## Next Steps

1. **Task 1.2**: Create low-fidelity wireframes using these foundations
2. **Task 1.3**: Define final color palette and branding
3. **Task 1.4**: Create high-fidelity mockups with approved branding
4. **Implementation**: Configure Tailwind CSS with finalized design tokens

---

**Last Updated**: Initial creation
**Status**: Foundation established, awaiting color palette and branding decisions
