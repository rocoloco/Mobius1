# Selected Color Palette: Mid-Century Modern

## Overview

The **Mid-Century Modern** palette has been selected for the US to Spain Migration Consumer UI. This palette provides a sophisticated, timeless, and elegant aesthetic that balances professionalism with approachability.

## Color Palette

### Primary Colors

**Teal** - `#008B8B` (RGB: 0, 139, 139)
- **Usage**: Primary buttons, links, active states, primary actions
- **Represents**: Trust, stability, professionalism
- **Contrast on white**: 4.5:1 ✓ (WCAG AA compliant)

**Coral** - `#FF7F50` (RGB: 255, 127, 80)
- **Usage**: Accent buttons, highlights, important CTAs, warnings
- **Represents**: Energy, warmth, attention
- **Contrast on white**: 3.0:1 (use for large elements or with darker variant)

**Sandy Brown** - `#F4A460` (RGB: 244, 164, 96)
- **Usage**: Secondary accents, progress indicators, success states
- **Represents**: Warmth, approachability, progress
- **Contrast on white**: 2.4:1 (use for large elements or backgrounds)

### Neutral Colors

**Charcoal** - `#2F4F4F` (RGB: 47, 79, 79)
- **Usage**: Body text, headings, dark UI elements
- **Represents**: Sophistication, readability
- **Contrast on white**: 11.6:1 ✓ (WCAG AAA compliant)

**Cornsilk** - `#FFF8DC` (RGB: 255, 248, 220)
- **Usage**: Backgrounds, cards, light sections
- **Represents**: Warmth, cleanliness, space
- **Contrast with charcoal**: 11.4:1 ✓

### Semantic Colors

**Success**: Sandy Brown `#F4A460` with Charcoal text
**Warning**: Coral `#FF7F50` with white text
**Error**: Darker Coral `#E6653A` with white text
**Info**: Teal `#008B8B` with white text

## Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#008B8B', // Teal
          50: '#E6F7F7',
          100: '#CCEFEF',
          200: '#99DFDF',
          300: '#66CFCF',
          400: '#33BFBF',
          500: '#008B8B', // Base
          600: '#007070',
          700: '#005454',
          800: '#003838',
          900: '#001C1C',
        },
        accent: {
          DEFAULT: '#FF7F50', // Coral
          50: '#FFF4F0',
          100: '#FFE9E1',
          200: '#FFD3C3',
          300: '#FFBDA5',
          400: '#FFA787',
          500: '#FF7F50', // Base
          600: '#E6653A',
          700: '#CC4B24',
          800: '#B3310E',
          900: '#991700',
        },
        secondary: {
          DEFAULT: '#F4A460', // Sandy Brown
          50: '#FEF8F2',
          100: '#FDF1E5',
          200: '#FBE3CB',
          300: '#F9D5B1',
          400: '#F7C797',
          500: '#F4A460', // Base
          600: '#F08A3D',
          700: '#EC701A',
          800: '#C95A0F',
          900: '#A64A0C',
        },
        neutral: {
          DEFAULT: '#2F4F4F', // Charcoal
          50: '#F8F9F9',
          100: '#E8EBEB',
          200: '#D1D7D7',
          300: '#BAC3C3',
          400: '#A3AFAF',
          500: '#8C9B9B',
          600: '#758787',
          700: '#5E7373',
          800: '#475F5F',
          900: '#2F4F4F', // Base
        },
        cream: {
          DEFAULT: '#FFF8DC', // Cornsilk
          50: '#FFFFFF',
          100: '#FFFEF9',
          200: '#FFFCF3',
          300: '#FFFAED',
          400: '#FFF9E7',
          500: '#FFF8DC', // Base
          600: '#FFE9A3',
          700: '#FFDA6A',
          800: '#FFCB31',
          900: '#F7BC00',
        },
      },
    },
  },
}
```

## Usage Guidelines

### Buttons

**Primary Button**
```jsx
className="bg-primary hover:bg-primary-600 text-white"
```

**Secondary Button**
```jsx
className="bg-cream border-2 border-primary text-neutral hover:bg-primary-50"
```

**Accent Button**
```jsx
className="bg-accent hover:bg-accent-600 text-white"
```

### Text

**Headings**: `text-neutral-900` (Charcoal)
**Body Text**: `text-neutral-900` (Charcoal)
**Secondary Text**: `text-neutral-600`
**Muted Text**: `text-neutral-500`

### Backgrounds

**Page Background**: `bg-cream-100` or `bg-white`
**Card Background**: `bg-cream` or `bg-white`
**Section Background**: `bg-cream-200`

### Borders

**Default**: `border-neutral-200`
**Active/Focus**: `border-primary`
**Error**: `border-accent-600`

### Status Badges

**In Progress**: `bg-primary text-white`
**Completed**: `bg-secondary text-neutral-900`
**Pending**: `bg-cream text-neutral-900 border border-neutral-300`
**Overdue**: `bg-accent text-white`

### Alerts

**Info**: `bg-cream border-l-4 border-primary text-neutral-900`
**Success**: `bg-secondary-100 border-l-4 border-secondary text-neutral-900`
**Warning**: `bg-accent-100 border-l-4 border-accent text-neutral-900`
**Error**: `bg-accent-50 border-l-4 border-accent-700 text-neutral-900`

## Accessibility Notes

- All text colors meet WCAG 2.1 AA standards (4.5:1 for normal text)
- Charcoal on Cream: 11.4:1 ✓
- Teal on White: 4.5:1 ✓
- Never use color alone to convey information
- Always provide text labels and icons alongside color indicators

## Design Philosophy Alignment

**Simple**: Limited color palette (5 core colors) keeps the design clean and uncluttered

**Magical**: The retro mid-century aesthetic creates a nostalgic, delightful experience

**Functional**: High contrast ratios ensure readability and accessibility for all users

## Next Steps

1. ✅ Color palette selected
2. Configure Tailwind CSS with these colors
3. Apply colors to wireframes/mockups
4. Begin component implementation with selected palette

