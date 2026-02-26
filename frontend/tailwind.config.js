/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Source Serif 4', 'Georgia', 'serif'],
      },
      colors: {
        claude: {
          bg: '#F9F8F6',
          sidebar: '#F0EDE9',
          surface: '#FFFFFF',
          text: '#1D1D1D',
          muted: '#6B6B6B',
          border: '#E5E5E5',
          accent: '#D97757', // Subtle Claude-ish accent
          darkBg: '#1A1A1A',
          darkSidebar: '#212121',
          darkSurface: '#262626',
          darkText: '#E5E5E5',
          darkMuted: '#A0A0A0',
          darkBorder: '#333333'
        }
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 8px -2px rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}
