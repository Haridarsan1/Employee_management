import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ThemeType = 'light' | 'dark' | 'midnight' | 'neon';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    if (savedTheme) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  const applyTheme = (themeName: ThemeType) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeName);

    switch (themeName) {
      case 'light':
        root.style.setProperty('--bg-primary', '248 250 252');
        root.style.setProperty('--bg-secondary', '255 255 255');
        root.style.setProperty('--text-primary', '15 23 42');
        root.style.setProperty('--text-secondary', '71 85 105');
        root.style.setProperty('--border-color', '226 232 240');
        root.style.setProperty('--card-bg', '255 255 255');
        break;
      case 'dark':
        root.style.setProperty('--bg-primary', '15 23 42');
        root.style.setProperty('--bg-secondary', '30 41 59');
        root.style.setProperty('--text-primary', '248 250 252');
        root.style.setProperty('--text-secondary', '203 213 225');
        root.style.setProperty('--border-color', '51 65 85');
        root.style.setProperty('--card-bg', '30 41 59');
        break;
      case 'midnight':
        root.style.setProperty('--bg-primary', '0 0 0');
        root.style.setProperty('--bg-secondary', '10 10 10');
        root.style.setProperty('--text-primary', '255 255 255');
        root.style.setProperty('--text-secondary', '203 213 225');
        root.style.setProperty('--border-color', '38 38 38');
        root.style.setProperty('--card-bg', '15 15 15');
        break;
      case 'neon':
        root.style.setProperty('--bg-primary', '15 23 42');
        root.style.setProperty('--bg-secondary', '30 41 59');
        root.style.setProperty('--text-primary', '248 250 252');
        root.style.setProperty('--text-secondary', '203 213 225');
        root.style.setProperty('--border-color', '139 92 246');
        root.style.setProperty('--card-bg', '30 41 59');
        break;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
