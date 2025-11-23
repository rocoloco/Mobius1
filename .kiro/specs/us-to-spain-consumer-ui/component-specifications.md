# Component Specifications
## US to Spain Migration Consumer UI

This document provides detailed specifications for all UI components in the design system, ready for implementation in React/Next.js.

## Button Components

### Primary Button

**Visual Specifications**
- Background: `bg-primary` (#008B8B)
- Text: `text-white`, 16px, Medium (500)
- Padding: `px-6 py-3` (24px horizontal, 12px vertical)
- Border Radius: `rounded-md` (6px)
- Height: 44px
- Shadow: `shadow-md`
- Hover: `hover:bg-primary-600` with `transition-colors duration-200`
- Active: `active:bg-primary-700`
- Disabled: `disabled:bg-neutral-300 disabled:cursor-not-allowed`

**React Component Interface**
```typescript
interface PrimaryButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  className?: string
  loading?: boolean
}
```

**Usage Example**
```jsx
<PrimaryButton onClick={handleSubmit}>
  Continue
</PrimaryButton>
```

### Secondary Button

**Visual Specifications**
- Background: `bg-transparent`
- Border: `border-2 border-primary`
- Text: `text-primary`, 16px, Medium (500)
- Padding: `px-6 py-2.5` (adjusted for border)
- Border Radius: `rounded-md` (6px)
- Height: 44px
- Hover: `hover:bg-cream-100`
- Active: `active:bg-cream-200`
- Disabled: `disabled:border-neutral-300 disabled:text-neutral-400`

### Accent Button

**Visual Specifications**
- Background: `bg-accent` (#FF7F50)
- Text: `text-white`, 16px, Medium (500)
- Padding: `px-6 py-3`
- Border Radius: `rounded-md` (6px)
- Height: 44px
- Shadow: `shadow-md`
- Hover: `hover:bg-accent-600`
- Active: `active:bg-accent-700`

### Text Button

**Visual Specifications**
- Background: `bg-transparent`
- Text: `text-primary`, 16px, Medium (500)
- Padding: `px-4 py-2`
- Hover: `hover:underline`
- Active: `active:text-primary-700`

## Card Components

### Standard Card

**Visual Specifications**
- Background: `bg-white` or `bg-cream`
- Border: `border border-neutral-200`
- Border Radius: `rounded-lg` (8px)
- Padding: `p-6` (24px)
- Shadow: `shadow-md`
- Hover: `hover:shadow-lg transition-shadow duration-200`

**React Component Interface**
```typescript
interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'white' | 'cream'
  hoverable?: boolean
  onClick?: () => void
}
```

### Workflow Card

**Visual Specifications**
- Background: `bg-white`
- Border: `border border-neutral-200`
- Border Radius: `rounded-xl` (12px)
- Padding: `p-6` (24px)
- Shadow: `shadow-md`
- Hover: `hover:scale-102 hover:shadow-lg transition-all duration-200`

**Structure**
```
┌─────────────────────────┐
│ [Icon Circle]           │
│                         │
│ Workflow Title (H4)     │
│ Description (Body Small)│
│                         │
│ [Progress Bar]          │
│ X of Y steps • ~Z weeks │
│                         │
│ [Primary Button]        │
└─────────────────────────┘
```

**React Component Interface**
```typescript
interface WorkflowCardProps {
  icon: React.ReactNode
  title: string
  description: string
  progress: number
  totalSteps: number
  estimatedTime: string
  status: 'not_started' | 'in_progress' | 'completed'
  onStart: () => void
}
```

### Document Card

**Visual Specifications**
- Background: `bg-cream`
- Border: `border border-neutral-200`
- Border Radius: `rounded-lg` (8px)
- Padding: `p-4` (16px)
- Shadow: `shadow-sm`

**Structure**
```
┌─────────────────────────────────┐
│ [Doc Icon] Document Name   [✓]  │
│            Uploaded: Nov 15     │
│            Status: Verified     │
│ [View] [Download] [Delete]      │
└─────────────────────────────────┘
```

## Form Components

### Text Input

**Visual Specifications**
- Background: `bg-white`
- Border: `border border-neutral-300`
- Border Radius: `rounded` (4px)
- Padding: `px-4 py-3` (16px horizontal, 12px vertical)
- Height: 44px
- Font: 16px, Normal (400), `text-neutral-900`
- Placeholder: `placeholder:text-neutral-400`
- Focus: `focus:border-primary focus:ring-2 focus:ring-primary/10`
- Error: `border-accent-600 focus:ring-accent-600/10`

**React Component Interface**
```typescript
interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  required?: boolean
  disabled?: boolean
  type?: 'text' | 'email' | 'password' | 'tel' | 'url'
  helperText?: string
}
```

**Usage Example**
```jsx
<TextInput
  label="Full Name"
  value={name}
  onChange={setName}
  placeholder="Enter your full name"
  required
  error={errors.name}
/>
```

### Select/Dropdown

**Visual Specifications**
- Same as Text Input
- Arrow Icon: `text-neutral-500`, 16px, right side
- Dropdown Menu: `bg-white shadow-lg rounded-md border border-neutral-200`
- Option Hover: `hover:bg-cream-100`
- Option Selected: `bg-primary-50 text-primary-700`

**React Component Interface**
```typescript
interface SelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  error?: string
  required?: boolean
  disabled?: boolean
}
```

### Checkbox

**Visual Specifications**
- Size: 20px × 20px
- Border: `border-2 border-neutral-400 rounded`
- Checked: `bg-primary border-primary` with white checkmark
- Focus: `focus:ring-2 focus:ring-primary/10`
- Label: 16px, Normal, `text-neutral-900`, `ml-2`

**React Component Interface**
```typescript
interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  error?: string
}
```

### Radio Button

**Visual Specifications**
- Size: 20px × 20px
- Border: `border-2 border-neutral-400 rounded-full`
- Selected: `bg-primary border-primary` with white inner circle (8px)
- Focus: `focus:ring-2 focus:ring-primary/10`
- Label: 16px, Normal, `text-neutral-900`, `ml-2`

## Navigation Components

### Top Navigation Bar

**Visual Specifications**
- Background: `bg-white`
- Height: 64px
- Border Bottom: `border-b border-neutral-200`
- Shadow: `shadow-sm`
- Padding: `px-6`

**Structure**
```
┌────────────────────────────────────────────────────┐
│ [Logo] US→Spain    [Search]    [🔔] [👤 Profile ▼] │
└────────────────────────────────────────────────────┘
```

**React Component Interface**
```typescript
interface TopNavProps {
  user: {
    name: string
    avatar?: string
  }
  notificationCount: number
  onSearch: (query: string) => void
  onNotificationClick: () => void
  onProfileClick: () => void
}
```

### Sidebar Navigation

**Visual Specifications**
- Background: `bg-cream`
- Width: 256px (desktop), full width drawer (mobile)
- Border Right: `border-r border-neutral-200`
- Item Height: 44px
- Item Padding: `px-4 py-3`
- Icon: 20px, `text-neutral-600`
- Text: 16px, Medium, `text-neutral-700`
- Active Item: `bg-primary-50 text-primary-700 border-l-4 border-primary`
- Hover: `hover:bg-cream-200`

**React Component Interface**
```typescript
interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  badge?: number
}

interface SidebarNavProps {
  items: NavItem[]
  activeItemId: string
  onItemClick: (id: string) => void
}
```

## Status Components

### Badge

**Visual Specifications**

**Completed Badge**
- Background: `bg-secondary-100`
- Text: `text-secondary-700`, 12px, Medium
- Border: `border border-secondary-300`
- Padding: `px-2 py-1` (8px horizontal, 4px vertical)
- Border Radius: `rounded-full` (pill shape)
- Icon: ✓ checkmark

**In Progress Badge**
- Background: `bg-primary-50`
- Text: `text-primary-700`, 12px, Medium
- Border: `border border-primary-300`
- Icon: ⏳ or spinner

**Pending Badge**
- Background: `bg-neutral-100`
- Text: `text-neutral-700`, 12px, Medium
- Border: `border border-neutral-300`
- Icon: ○ circle

**Overdue Badge**
- Background: `bg-accent-50`
- Text: `text-accent-700`, 12px, Medium
- Border: `border border-accent-300`
- Icon: ⚠️ warning

**React Component Interface**
```typescript
type BadgeVariant = 'completed' | 'in_progress' | 'pending' | 'overdue'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  icon?: React.ReactNode
}
```

### Progress Bar

**Visual Specifications**
- Height: 8px
- Background: `bg-neutral-200`
- Fill: `bg-primary`
- Border Radius: `rounded-full`
- Animation: `transition-all duration-300 ease-out`

**React Component Interface**
```typescript
interface ProgressBarProps {
  value: number // 0-100
  max?: number
  showLabel?: boolean
  variant?: 'primary' | 'secondary' | 'accent'
  size?: 'sm' | 'md' | 'lg'
}
```

### Circular Progress

**Visual Specifications**
- Size: 48px diameter
- Stroke Width: 4px
- Background: `stroke-neutral-200`
- Fill: `stroke-primary`
- Center Text: Percentage, 14px, Medium, `text-neutral-900`

## Modal Components

### Standard Modal

**Visual Specifications**
- Background: `bg-white`
- Max Width: 600px
- Border Radius: `rounded-xl` (12px)
- Padding: `p-8` (32px)
- Shadow: `shadow-2xl`
- Backdrop: `bg-black/50`
- Close Button: Top right, 24px icon, `text-neutral-500 hover:text-neutral-700`

**Structure**
```
┌─────────────────────────────────┐
│ Modal Title (H3)           [✕]  │
│                                 │
│ Modal content goes here...      │
│                                 │
│                                 │
│              [Cancel] [Confirm] │
└─────────────────────────────────┘
```

**React Component Interface**
```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}
```

## Notification Components

### Toast Notification

**Visual Specifications**

**Success Toast**
- Background: `bg-secondary-100`
- Border Left: `border-l-4 border-secondary`
- Icon: ✓ checkmark, `text-secondary`
- Text: `text-neutral-900`, 14px
- Padding: `p-4` (16px)
- Border Radius: `rounded-lg` (8px)
- Shadow: `shadow-lg`
- Position: Top right
- Animation: Slide in from right

**Error Toast**
- Background: `bg-accent-50`
- Border Left: `border-l-4 border-accent-600`
- Icon: ✗ X, `text-accent-600`

**Info Toast**
- Background: `bg-primary-50`
- Border Left: `border-l-4 border-primary`
- Icon: ℹ️ info, `text-primary`

**React Component Interface**
```typescript
type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  variant: ToastVariant
  title: string
  message?: string
  duration?: number // milliseconds
  onClose: () => void
}
```

## Empty State Components

### Empty State

**Visual Specifications**
- Container: Centered, max-width 400px
- Illustration: 200px × 200px, centered
- Title: H3, `text-neutral-700`, centered
- Description: Body, `text-neutral-500`, centered
- Button: Primary button, centered, `mt-6`

**Structure**
```
┌─────────────────────────┐
│                         │
│    [Illustration]       │
│                         │
│    No items yet         │
│    Get started by...    │
│                         │
│   [Primary Button]      │
│                         │
└─────────────────────────┘
```

**React Component Interface**
```typescript
interface EmptyStateProps {
  illustration: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}
```

## Loading Components

### Skeleton Loader

**Visual Specifications**
- Background: `bg-neutral-200`
- Animation: Shimmer effect with gradient
- Border Radius: Matches content shape
- Pulse: `animate-pulse`

**React Component Interface**
```typescript
interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'circular' | 'rectangular'
  className?: string
}
```

### Spinner

**Visual Specifications**
- Size: 24px (default), 16px (small), 32px (large)
- Color: `text-primary`
- Animation: `animate-spin`
- Border: `border-2 border-current border-t-transparent rounded-full`

**React Component Interface**
```typescript
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: string
  className?: string
}
```

## Accessibility Guidelines

### Focus States
- All interactive elements must have visible focus indicators
- Focus ring: `focus:ring-2 focus:ring-primary/10 focus:outline-none`
- Focus should be visible with 2px offset

### ARIA Labels
- All buttons should have descriptive labels
- Form inputs should have associated labels
- Icons should have `aria-label` or `aria-labelledby`
- Modals should have `role="dialog"` and `aria-modal="true"`

### Keyboard Navigation
- All interactive elements accessible via Tab
- Modals should trap focus
- Dropdowns should support arrow key navigation
- Forms should support Enter to submit

### Color Contrast
- All text meets WCAG AA standards (4.5:1 minimum)
- Interactive elements meet 3:1 contrast ratio
- Never use color alone to convey information

## Responsive Behavior

### Mobile (< 768px)
- Full-width buttons
- Stack form fields vertically
- Larger touch targets (minimum 44px)
- Simplified navigation (hamburger menu)
- Reduced padding (16px instead of 24px)

### Tablet (768px - 1024px)
- Flexible layouts
- 2-column grids where appropriate
- Medium padding (20px)

### Desktop (> 1024px)
- Multi-column layouts
- Hover states active
- Full sidebar visible
- Generous padding (24px)

## Animation Guidelines

### Transitions
- Duration: 200ms for most interactions
- Timing: `ease-in-out` for natural feel
- Properties: `transition-colors`, `transition-shadow`, `transition-transform`

### Micro-interactions
- Button hover: Scale 1.02 or shadow increase
- Card hover: Shadow increase and slight lift
- Input focus: Border color change and ring
- Toast: Slide in from right, fade out

### Loading States
- Skeleton: Pulse animation
- Spinner: Continuous rotation
- Progress bar: Smooth fill animation

## Implementation Notes

### Component Library Structure
```
components/
├── ui/
│   ├── Button/
│   │   ├── PrimaryButton.tsx
│   │   ├── SecondaryButton.tsx
│   │   ├── AccentButton.tsx
│   │   └── TextButton.tsx
│   ├── Card/
│   │   ├── Card.tsx
│   │   ├── WorkflowCard.tsx
│   │   └── DocumentCard.tsx
│   ├── Form/
│   │   ├── TextInput.tsx
│   │   ├── Select.tsx
│   │   ├── Checkbox.tsx
│   │   └── RadioButton.tsx
│   ├── Navigation/
│   │   ├── TopNav.tsx
│   │   └── SidebarNav.tsx
│   ├── Status/
│   │   ├── Badge.tsx
│   │   ├── ProgressBar.tsx
│   │   └── CircularProgress.tsx
│   ├── Modal/
│   │   └── Modal.tsx
│   ├── Notification/
│   │   └── Toast.tsx
│   ├── EmptyState/
│   │   └── EmptyState.tsx
│   └── Loading/
│       ├── Skeleton.tsx
│       └── Spinner.tsx
└── ...
```

### Styling Approach
- Use Tailwind CSS utility classes
- Create reusable component variants
- Use `clsx` or `cn` utility for conditional classes
- Extract common patterns into custom Tailwind classes if needed

### Testing
- Unit tests for all components
- Accessibility tests (jest-axe)
- Visual regression tests (Chromatic or Percy)
- Interaction tests (Testing Library)

---

**Status**: Ready for implementation
**Last Updated**: Task 1.4 in progress
**Next Step**: Begin component development in Task 2.1
