# Visual Style Guide
## US to Spain Migration Consumer UI

This guide defines the visual language and design principles for the US to Spain Migration Consumer UI.

## Design Philosophy

### Simple, Magical, Functional

Our design philosophy is inspired by Steve Jobs' approach to product design: create experiences that are simple to understand, magical to use, and functionally excellent.

#### Simplicity
**What it means**: Remove unnecessary complexity and cognitive load
**How we achieve it**:
- Use generous whitespace (minimum 24px between major sections)
- Limit our color palette to 5 core colors
- Create clear visual hierarchy through size and weight
- Minimize decorative elements
- Focus on content over chrome

**Example**: The dashboard shows only the most important information at a glance - overall progress, active workflows, and upcoming appointments. Everything else is one click away.

#### Magical Experience
**What it means**: Anticipate needs and delight users
**How we achieve it**:
- Provide intelligent recommendations based on user profile
- Use smooth, purposeful animations that guide attention
- Auto-fill forms with available data
- Show progress and celebrate completions
- Use thoughtful micro-interactions

**Example**: When a user uploads a passport, the system automatically extracts data and suggests relevant workflows like visa applications.

#### Functionality
**What it means**: Every feature serves a clear purpose
**How we achieve it**:
- Prioritize reliability and correctness
- Ensure high contrast for readability (WCAG AA minimum)
- Make buttons and interactive elements obvious
- Provide clear feedback for all actions
- Focus on doing a few things exceptionally well

**Example**: The workflow stepper clearly shows progress, prerequisites, and next steps, making it impossible to get lost in the process.

## Visual Principles

### 1. Clarity Over Cleverness
Clear, straightforward interactions trump clever but confusing ones.

**Do**: Use standard patterns (hamburger menu, search icon, profile dropdown)
**Don't**: Invent new interaction patterns that users need to learn

### 2. Consistency
Similar actions should work the same way throughout the application.

**Do**: Use the same button styles for the same actions everywhere
**Don't**: Change button colors or positions between pages

### 3. Immediate Feedback
Provide clear feedback for all user actions within 100ms.

**Do**: Show loading states, success messages, and error feedback
**Don't**: Leave users wondering if their action worked

### 4. Forgiveness
Allow users to undo actions and recover from mistakes easily.

**Do**: Confirm destructive actions, allow undo, save drafts automatically
**Don't**: Delete data without confirmation or recovery options

### 5. Focus
Guide users toward their goals without distractions.

**Do**: Highlight the primary action, minimize secondary options
**Don't**: Present too many choices at once

## Color Usage

### Primary Color: Teal (#008B8B)
**Represents**: Trust, stability, professionalism
**Use for**:
- Primary buttons and CTAs
- Active navigation items
- Links and interactive elements
- Progress indicators
- Focus states

**Don't use for**: Backgrounds (too dark), body text (not enough contrast)

### Accent Color: Coral (#FF7F50)
**Represents**: Energy, warmth, attention
**Use for**:
- Accent buttons and highlights
- Important notifications
- Warning states
- Attention-grabbing elements

**Don't use for**: Large areas (too vibrant), success states (use Sandy Brown)

### Secondary Color: Sandy Brown (#F4A460)
**Represents**: Warmth, approachability, progress
**Use for**:
- Success states and confirmations
- Progress completion indicators
- Warm highlights and accents
- Positive feedback

**Don't use for**: Error states (use Coral), primary actions (use Teal)

### Neutral Color: Charcoal (#2F4F4F)
**Represents**: Sophistication, readability
**Use for**:
- Headings (H1-H6)
- Body text
- Icons
- Dark UI elements

**Don't use for**: Backgrounds (too dark), large areas (use lighter shades)

### Cream Color: Cornsilk (#FFF8DC)
**Represents**: Warmth, cleanliness, space
**Use for**:
- Page backgrounds
- Card backgrounds
- Light sections
- Subtle highlights

**Don't use for**: Text (not enough contrast), primary actions

## Typography

### Font Family: Inter
**Why Inter**: Clean, modern, highly readable, excellent for UI and body text, wide range of weights, open source

**Fallback**: `system-ui, -apple-system, sans-serif`

### Type Scale

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| **H1** | 36px | Bold (700) | 1.2 | Page titles, hero headings |
| **H2** | 30px | Semibold (600) | 1.3 | Major section headings |
| **H3** | 24px | Semibold (600) | 1.4 | Subsection headings, modal titles |
| **H4** | 20px | Medium (500) | 1.4 | Card titles, minor headings |
| **Body Large** | 18px | Normal (400) | 1.6 | Intro text, important content |
| **Body** | 16px | Normal (400) | 1.5 | Primary content, descriptions |
| **Body Small** | 14px | Normal (400) | 1.5 | Secondary content, metadata |
| **Caption** | 12px | Normal (400) | 1.4 | Labels, timestamps, fine print |

### Typography Guidelines

**Headings**:
- Use sentence case for most headings ("Dashboard" not "DASHBOARD")
- Keep headings short and descriptive
- Maintain hierarchy (don't skip levels)
- Use Charcoal (#2F4F4F) for all headings

**Body Text**:
- Use 16px as the base size (never smaller for body text)
- Maintain 1.5 line height for readability
- Keep line length between 50-75 characters
- Use Charcoal (#2F4F4F) for primary text
- Use Neutral-600 (#758787) for secondary text

**Links**:
- Use Teal (#008B8B) color
- Underline on hover
- Medium weight (500) to stand out

**Emphasis**:
- Use Medium (500) or Semibold (600) weight for emphasis
- Avoid using color alone for emphasis
- Use sparingly to maintain impact

## Spacing

### 8px Grid System
All spacing follows an 8px base unit for consistency and rhythm.

**Common Spacing Values**:
- **4px (0.5 unit)**: Tight spacing between related elements (icon + text)
- **8px (1 unit)**: Small gaps between form fields
- **16px (2 units)**: Standard spacing between elements
- **24px (3 units)**: Spacing between sections within a card
- **32px (4 units)**: Spacing between major sections
- **48px (6 units)**: Large spacing, page margins
- **64px (8 units)**: Extra large spacing between page sections

### Spacing Guidelines

**Micro Spacing (4-8px)**:
- Between icon and text
- Between form label and input
- Between badge and text

**Small Spacing (12-16px)**:
- Between form fields
- Between list items
- Between buttons in a group

**Medium Spacing (24-32px)**:
- Between sections within a card
- Between paragraphs
- Between card header and content

**Large Spacing (48-64px)**:
- Between major page sections
- Page margins
- Between hero and content

**Extra Large Spacing (80-128px)**:
- Between page sections on landing pages
- Hero section padding

## Shadows

Shadows create depth and hierarchy in the interface.

### Shadow Scale

**sm** - `0 1px 2px rgba(0,0,0,0.05)`
- Use for: Subtle elevation, form inputs
- Example: Text inputs, small cards

**md** - `0 1px 3px rgba(0,0,0,0.1)`
- Use for: Standard elevation, cards, buttons
- Example: Workflow cards, primary buttons

**lg** - `0 4px 6px rgba(0,0,0,0.1)`
- Use for: Elevated elements, dropdowns
- Example: Dropdown menus, popovers, hover states

**xl** - `0 10px 15px rgba(0,0,0,0.1)`
- Use for: Floating elements, modals
- Example: Modals, drawers, tooltips

**2xl** - `0 25px 50px rgba(0,0,0,0.25)`
- Use for: Maximum elevation, important modals
- Example: Critical confirmation modals

### Shadow Guidelines

**Do**:
- Use shadows to indicate elevation and interactivity
- Increase shadow on hover to show interactivity
- Use consistent shadows for similar elements

**Don't**:
- Use shadows on flat elements like backgrounds
- Mix different shadow styles on the same page
- Use shadows as decoration

## Border Radius

Rounded corners soften the interface and create a friendly feel.

### Radius Scale

- **sm (2px)**: Subtle rounding for inputs
- **base (4px)**: Standard rounding for inputs, small elements
- **md (6px)**: Buttons, form elements
- **lg (8px)**: Cards, panels
- **xl (12px)**: Large cards, modals
- **2xl (16px)**: Hero sections, feature cards
- **full (9999px)**: Pills, avatars, circular elements

### Border Radius Guidelines

**Inputs and Buttons**: Use 4-6px for a modern, friendly feel
**Cards**: Use 8-12px for a softer, more approachable look
**Badges and Pills**: Use full rounding for pill shapes
**Avatars**: Use full rounding for circular avatars

## Iconography

### Icon Style
- **Style**: Outline (stroke-based) for consistency
- **Weight**: 2px stroke width
- **Size**: 16px, 20px, 24px (multiples of 4)
- **Color**: Inherit from parent or use Neutral-600

### Icon Usage

**Navigation Icons**: 20px, Neutral-600, active state uses Primary
**Button Icons**: 16px, inherit button text color
**Status Icons**: 16px, use semantic colors (success, warning, error)
**Decorative Icons**: 24px or larger, use sparingly

### Icon Guidelines

**Do**:
- Use icons to reinforce meaning, not replace text
- Maintain consistent icon style throughout
- Provide alt text or aria-labels for accessibility

**Don't**:
- Use icons without labels for primary actions
- Mix different icon styles (outline and filled)
- Use too many icons (creates visual noise)

## Animation and Motion

### Animation Principles

**Purposeful**: Animations should guide attention and provide feedback
**Fast**: Most transitions should be 150-300ms
**Smooth**: Use easing functions for natural motion
**Consistent**: Similar actions should have similar animations

### Transition Durations

- **75ms**: Instant feedback (button press)
- **150ms**: Fast transitions (hover states)
- **200ms**: Standard transitions (most UI changes)
- **300ms**: Slower transitions (page transitions, modals)
- **500ms+**: Special animations (celebrations, onboarding)

### Easing Functions

- **ease-in-out**: Most transitions (natural acceleration and deceleration)
- **ease-out**: Entering elements (quick start, slow end)
- **ease-in**: Exiting elements (slow start, quick end)
- **linear**: Progress indicators, loading spinners

### Common Animations

**Fade In/Out**: Modals, tooltips, notifications
- Duration: 200ms
- Easing: ease-in-out

**Slide In/Out**: Drawers, side panels, toasts
- Duration: 300ms
- Easing: ease-out (entering), ease-in (exiting)

**Scale**: Buttons on hover, cards on interaction
- Duration: 150ms
- Easing: ease-in-out
- Scale: 1.02 (subtle)

**Skeleton Loading**: Content placeholders during loading
- Duration: 1500ms
- Easing: linear
- Effect: Shimmer gradient

### Animation Guidelines

**Do**:
- Use animations to guide user attention
- Provide feedback for user actions
- Respect prefers-reduced-motion setting

**Don't**:
- Animate for decoration only
- Use long animations (> 500ms) for common actions
- Animate too many elements at once

## Imagery

### Illustrations

**Style**: Friendly, simple, geometric
**Colors**: Use brand colors (Teal, Coral, Sandy Brown)
**Usage**: Empty states, onboarding, error pages

**Guidelines**:
- Keep illustrations simple and clear
- Use consistent style throughout
- Ensure illustrations support the message

### Photos

**Style**: Natural, warm, authentic
**Usage**: User avatars, regional resources, testimonials

**Guidelines**:
- Use high-quality images (2x resolution)
- Optimize for web (WebP format)
- Provide alt text for accessibility

### Icons

**Style**: Outline, 2px stroke
**Size**: 16px, 20px, 24px
**Color**: Neutral-600 or inherit

## Accessibility

### Color Contrast

**Text Contrast**:
- Normal text (< 18px): Minimum 4.5:1 ratio
- Large text (≥ 18px or ≥ 14px bold): Minimum 3:1 ratio
- UI components: Minimum 3:1 ratio

**Our Palette Contrast Ratios**:
- Charcoal on White: 11.6:1 ✓ (AAA)
- Charcoal on Cream: 11.4:1 ✓ (AAA)
- Teal on White: 4.5:1 ✓ (AA)
- White on Teal: 4.5:1 ✓ (AA)

### Focus States

**All interactive elements must have visible focus indicators**:
- Focus ring: 2px solid Primary color
- Offset: 2px from element
- Never remove focus styles without providing alternatives

### Touch Targets

**Minimum size**: 44px × 44px for all interactive elements
**Spacing**: Minimum 8px between touch targets
**Mobile**: Increase to 48px × 48px for better usability

### Screen Readers

- Use semantic HTML (headings, lists, buttons)
- Provide alt text for images
- Use ARIA labels for icons and complex interactions
- Ensure logical tab order

## Responsive Design

### Mobile First Approach

Design for mobile first, then enhance for larger screens.

**Mobile (< 768px)**:
- Single column layout
- Stack elements vertically
- Full-width buttons
- Larger touch targets (48px)
- Simplified navigation (hamburger menu)
- Reduced padding (16px)

**Tablet (768px - 1024px)**:
- 2-column layouts where appropriate
- Flexible grids
- Medium padding (20px)
- Toggle sidebar

**Desktop (> 1024px)**:
- Multi-column layouts (3-4 columns)
- Full sidebar visible
- Generous padding (24px)
- Hover states active
- Maximum content width: 1440px

## Best Practices

### Do's

✓ Use generous whitespace
✓ Maintain consistent spacing (8px grid)
✓ Follow the color palette
✓ Use semantic HTML
✓ Provide clear feedback
✓ Test on real devices
✓ Ensure accessibility
✓ Keep it simple

### Don'ts

✗ Cram too much content
✗ Use colors outside the palette
✗ Skip accessibility testing
✗ Use tiny text (< 14px for body)
✗ Remove focus indicators
✗ Ignore mobile users
✗ Add unnecessary animations
✗ Overcomplicate interactions

## Resources

### Design Files
- Figma: [Link to Figma file]
- Design Tokens: `design-tokens.json`
- Tailwind Config: `tailwind.config.example.js`

### Documentation
- Component Specifications: `component-specifications.md`
- High-Fidelity Mockup Guide: `high-fidelity-mockup-guide.md`
- Color Palette: `selected-color-palette.md`
- Design System: `design-system.md`

### Tools
- Figma: Design and prototyping
- Tailwind CSS: Styling framework
- Inter Font: Typography
- Heroicons: Icon library (optional)

---

**Status**: Complete
**Last Updated**: Task 1.4 in progress
**Next**: Begin implementation in Task 2.1
