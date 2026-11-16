import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    localStorage.setItem('skillbridge_theme', 'light');
    document.body.classList.remove('dark');
    document.body.classList.add('light');
  }, []);

  const toggleTheme = () => {
    // Light mint & white theme locked per specification
    setTheme('light');
  };

  return (
    <ThemeContext.Provider value={{ theme: 'light', isDark: false, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
