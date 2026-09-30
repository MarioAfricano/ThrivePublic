/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0b0b0f',
          secondary: '#14141a',
          card: '#1a1a22',
          hover: '#20202a',
        },
        accent: {
          DEFAULT: '#818cf8',
          dim: 'rgba(129,140,248,0.12)',
          glow: 'rgba(129,140,248,0.25)',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          strong: 'rgba(255,255,255,0.12)',
        },
        profit: '#4ade80',
        loss: '#f87171',
        warn: '#fbbf24',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
