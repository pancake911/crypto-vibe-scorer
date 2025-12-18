/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bloomberg-dark': '#0d1117',
        'bloomberg-darker': '#010409',
        'bloomberg-border': '#21262d',
        'bloomberg-text': '#c9d1d9',
        'bloomberg-text-dim': '#8b949e',
        'bloomberg-green': '#3fb950',
        'bloomberg-red': '#f85149',
        'bloomberg-yellow': '#d29922',
        'bloomberg-blue': '#58a6ff',
      },
    },
  },
  plugins: [],
}
