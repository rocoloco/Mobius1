# Color Usage Guidelines

## General Principles

### Hierarchy
- **Primary color**: Main actions, key interactive elements (buttons, links)
- **Secondary color**: Accents, highlights, secondary actions
- **Accent color**: Success states, progress indicators
- **Neutrals**: Text, backgrounds, borders, structure

### Consistency
- Use the same color for the same purpose throughout the app
- Primary buttons always use primary color
- Success messages always use success color
- Error states always use error color

### Accessibility
- Always use text color variants that meet 4.5:1 contrast ratio
- Never rely on color alone to convey information
- Provide additional indicators (icons, text, patterns)

---

## Component Color Mapping

### Buttons

**Primary Button**
```
Background: Primary color (e.g., blue-600)
Text: White
Hover: Darker shade (e.g., blue-700)
Disabled: gray-300 background, gray-500 text
```

**Secondary Button**
```
Background: Transparent
Border: Primary color
Text: Primary color
Hover: Light primary background (e.g., blue-50)
```

**Danger Button**
```
Background: Error color (red-600)
Text: White
Hover: Darker red (red-700)
```

### Status Badges

**Success**
```
Background: green-100
Text: green-700
Border: green-200
Icon: green-600
```

**Warning**
```
Background: amber-100
Text: amber-900
Border: amber-200
Icon: amber-600
```

**Error**
```
Background: red-100
Text: red-700
Border: red-200
Icon: red-600
```

**Info**
```
Background: blue-100
Text: blue-700
Border: blue-200
Icon: blue-600
```

**In Progress**
```
Background: gray-100
Text: gray-700
Border: gray-200
Icon: gray-600
```

### Forms

**Input Fields**
```
Background: white
Border: gray-300
Text: gray-900
Placeholder: gray-400
Focus border: Primary color
Error border: red-500
```

**Labels**
```
Text: gray-700
Required indicator (*): red-500
```

**Helper Text**
```
Normal: gray-500
Error: red-600
Success: green-600
```

### Cards

**Default Card**
```
Background: white or gray-50
Border: gray-200
Shadow: subtle gray
```

**Hover Card**
```
Border: gray-300
Shadow: elevated
```

**Selected Card**
```
Border: Primary color
Background: Primary-50 (very light)
```

### Navigation

**Sidebar**
```
Background: white or gray-50
Active item background: Primary-50
Active item text: Primary-700
Inactive item text: gray-600
Hover background: gray-100
```

**Top Nav**
```
Background: white
Border bottom: gray-200
Text: gray-700
Icons: gray-600
Active: Primary color
```

### Progress Indicators

**Progress Bar**
```
Background: gray-200
Fill: Primary color or accent color
Text: gray-700
```

**Completion Badge**
```
Background: green-100
Text: green-700
Icon: green-600
```

### Alerts & Notifications

**Success Alert**
```
Background: green-50
Border: green-200
Text: green-800
Icon: green-600
```

**Warning Alert**
```
Background: amber-50
Border: amber-200
Text: amber-900
Icon: amber-600
```

**Error Alert**
```
Background: red-50
Border: red-200
Text: red-800
Icon: red-600
```

**Info Alert**
```
Background: blue-50
Border: blue-200
Text: blue-800
Icon: blue-600
```

### Links

**Default Link**
```
Text: Primary color
Hover: Darker primary
Underline: Optional (on hover)
Visited: Slightly darker primary
```

**External Link**
```
Text: Primary color
Icon: gray-500 (external link icon)
```

### Data Visualization

**Charts & Graphs**
```
Primary data: Primary color
Secondary data: Secondary color
Tertiary data: Accent color
Additional series: Use neutral colors (gray-400, gray-500, gray-600)
Grid lines: gray-200
Axis labels: gray-600
```

---

## Dark Mode Considerations

If implementing dark mode in the future:

**Background Colors**
- Primary background: gray-900
- Card background: gray-800
- Border: gray-700

**Text Colors**
- Primary text: gray-100
- Secondary text: gray-400
- Disabled text: gray-600

**Interactive Colors**
- Use lighter shades of primary colors
- Ensure 4.5:1 contrast on dark backgrounds

---

## Color Don'ts

❌ **Don't** use red for anything other than errors or destructive actions
❌ **Don't** use green for anything other than success or positive states
❌ **Don't** use color as the only way to convey information
❌ **Don't** use low-contrast color combinations
❌ **Don't** use too many colors in one view (max 3-4 colors per screen)
❌ **Don't** use bright, saturated colors for large areas
❌ **Don't** use color for decoration only - every color should have meaning

---

## Testing Checklist

Before finalizing color usage:

- [ ] All text meets 4.5:1 contrast ratio (or 3:1 for large text)
- [ ] UI components meet 3:1 contrast ratio
- [ ] Color meanings are consistent throughout the app
- [ ] Information is not conveyed by color alone
- [ ] Colors work well together (no clashing)
- [ ] Tested with color blindness simulators
- [ ] Tested in different lighting conditions
- [ ] Documented all color tokens in Tailwind config

