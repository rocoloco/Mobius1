import React from 'react';

interface MobiusLogoProps {
  /** Theme mode - 'light' or 'dark'. If not provided, uses system preference */
  theme?: 'light' | 'dark' | 'auto';
  /** Width in pixels or CSS unit */
  width?: string | number;
  /** Height in pixels or CSS unit */
  height?: string | number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Mobius One logo component with automatic theme switching
 * Displays appropriate logo variant based on theme (light/dark background)
 */
export const MobiusLogo: React.FC<MobiusLogoProps> = ({
  theme = 'auto',
  width = 200,
  height = 'auto',
  className = '',
}) => {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDark(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      setIsDark(theme === 'dark');
    }
  }, [theme]);

  const logoSrc = isDark
    ? '/assets/logos/Mobius One Logo_darkbackground.svg'
    : '/assets/logos/Mobius One Logo_lightbackground.svg';

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <img
      src={logoSrc}
      alt="Mobius One"
      className={className}
      style={style}
    />
  );
};
