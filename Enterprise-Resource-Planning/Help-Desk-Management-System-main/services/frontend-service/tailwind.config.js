/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // SIS Color Palette
        'sis-primary-dark': '#274c77',
        'sis-primary-medium': '#365486',
        'sis-primary-light': '#6096ba',
        'sis-accent': '#a3cef1',
        'sis-background': '#e7ecef',
        'sis-sidebar-open': '#e7ecef',
        'sis-sidebar-closed': '#a3cef1',
        'sis-sidebar-border': '#1c3f67',
        'sis-border-gray': '#8b8c89',
        'sis-destructive': '#ef4444',
        
        // Legacy support
        background: '#e7ecef',
        primary: '#365486',
        'primary-dark': '#274c77',
        'primary-light': '#6096ba',
      },
      boxShadow: {
        'sis-sidebar': '0 8px 32px 0 rgba(173, 208, 231, 0.74)',
        'sis-sidebar-closed': '0 2px 8px 0 rgba(163, 206, 241, 0.91)',
      },
      borderRadius: {
        'sis-xl': '1rem',
        'sis-2xl': '1.5rem',
        'sis-3xl': '1.875rem',
      },
    },
  },
  plugins: [],
}


