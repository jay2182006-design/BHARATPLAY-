import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type { ThemeMode } from '../types/bharatplay';

const THEME_STORAGE_KEY = 'bharatplay_theme';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (next: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage access errors
  }
  return 'dark';
}

function applyDocumentTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota errors
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, privateAccount, updatePrivateSettings } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);
  const syncedUidRef = useRef<string | null>(null);

  // Sync DOM <html> class and localStorage immediately whenever theme changes
  useEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  // On user login, restore persisted themePreference from Firestore private account if set
  useEffect(() => {
    if (!user) {
      syncedUidRef.current = null;
      return;
    }
    if (!privateAccount) return;
    if (syncedUidRef.current === user.uid) return;
    syncedUidRef.current = user.uid;

    const remote = privateAccount.themePreference;
    if (remote === 'dark' || remote === 'light') {
      setThemeState(remote);
      applyDocumentTheme(remote);
    } else {
      // Seed account preference with current local theme on first migration
      updatePrivateSettings({ themePreference: theme }).catch(() => {});
    }
  }, [user, privateAccount, theme, updatePrivateSettings]);

  const setTheme = useCallback(
    async (next: ThemeMode) => {
      setThemeState(next);
      applyDocumentTheme(next);
      if (user && privateAccount) {
        try {
          await updatePrivateSettings({ themePreference: next });
        } catch {
          // Local storage remains updated even if offline or unverified
        }
      }
    },
    [user, privateAccount, updatePrivateSettings]
  );

  const toggleTheme = useCallback(async () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
