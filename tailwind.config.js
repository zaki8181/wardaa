/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf3f7',
          100: '#fbe7f0',
          200: '#f7d1e3',
          300: '#f1aecf',
          400: '#e87fb2',
          500: '#d94f8e',
          600: '#c43676',
          700: '#a32961',
          800: '#882553',
          900: '#732249',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        display: ['Tajawal', 'Cairo', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
