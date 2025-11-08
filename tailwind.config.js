/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'theme-bg-primary': 'rgb(var(--bg-primary) / <alpha-value>)',
        'theme-bg-secondary': 'rgb(var(--bg-secondary) / <alpha-value>)',
        'theme-text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'theme-text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'theme-border': 'rgb(var(--border-color) / <alpha-value>)',
        'theme-card': 'rgb(var(--card-bg) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
