# Mobius One Logo Component

React component for displaying the Mobius One logo with automatic theme switching.

## Usage

```tsx
import { MobiusLogo } from './components/MobiusLogo';

// Auto-detect system theme
<MobiusLogo />

// Force light theme
<MobiusLogo theme="light" width={300} />

// Force dark theme
<MobiusLogo theme="dark" width={300} />

// Custom sizing
<MobiusLogo width="100%" height={60} />

// With custom class
<MobiusLogo className="my-logo" />
```

## Props

- `theme`: `'light' | 'dark' | 'auto'` - Theme mode (default: 'auto')
- `width`: `string | number` - Width in pixels or CSS unit (default: 200)
- `height`: `string | number` - Height in pixels or CSS unit (default: 'auto')
- `className`: `string` - Additional CSS class

## Theme Behavior

- `auto`: Automatically switches based on system preference (`prefers-color-scheme`)
- `light`: Always shows logo optimized for light backgrounds
- `dark`: Always shows logo optimized for dark backgrounds
