'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 bg-gray-200 dark:bg-gray-800 transition-colors duration-200 rounded-full shadow-sm"
    >
      {theme === 'light' ? (
        <Sun className="h-6 w-6 text-yellow-500" />
      ) : (
        <Moon className="h-6 w-6 text-SeaGrean " />
      )}
    </button>
  );
}
