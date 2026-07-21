export const THEME = {
    colors: {
      // Aapke exact colors
      background: '#E7ECEF',      // e7ecef
      gray: '#8B8C89',             // 8b8c89  
      medium: '#6096BA',           // 6096ba
      light: '#A3CEF1',            // a3cef1
      primary: '#274C77',          // 274c77
      
      // Status colors
      success: '#10B981',
      warning: '#F59E0B', 
      error: '#EF4444',
      info: '#3B82F6',
      
      // Neutral colors
      white: '#FFFFFF',
      black: '#000000',
    },
    
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem', 
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
    
    borderRadius: {
      sm: '0.375rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
    },
    
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    }
  } as const;