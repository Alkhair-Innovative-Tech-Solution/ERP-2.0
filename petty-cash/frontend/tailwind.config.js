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
        navy: {
          50:  '#f0f2f5',
          100: '#d9dee5',
          200: '#b3bcc9',
          300: '#8d9aad',
          400: '#667892',
          500: '#4a5b73',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#0a0f1d',
          950: '#050810',
        },
        emerald: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        surface: '#f0f2f5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        'medium': '0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
        'strong': '0 10px 15px -3px rgb(15 23 42 / 0.10), 0 4px 6px -4px rgb(15 23 42 / 0.05)',
      },
    },
  },
  plugins: [],
}
