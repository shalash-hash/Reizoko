import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type ResolvedTheme,
  type ThemeMode,
  applyTheme,
  persistThemeMode,
  resolveTheme,
} from './theme-utils.js';
import { ThemeContext } from './theme-context.js';

interface ThemeProviderProps {
  mode: ThemeMode;
  onModeChange?: (mode: ThemeMode) => void;
  children: ReactNode;
}

export function ThemeProvider({ mode, onModeChange, children }: ThemeProviderProps) {
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode));

  useEffect(() => {
    const next = resolveTheme(mode);
    setResolved(next);
    applyTheme(next);
    persistThemeMode(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next = resolveTheme('system');
      setResolved(next);
      applyTheme(next);
    };

    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [mode]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      onModeChange?.(next);
    },
    [onModeChange],
  );

  const value = useMemo(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
