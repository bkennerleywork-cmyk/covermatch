import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}', './.storybook/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        paper: '#f4f3ec',
        surface: '#fbfaf6',
        line: { DEFAULT: '#d5d8cc', strong: '#7f8c82' },
        ink: { DEFAULT: '#14211c', soft: '#46564f' },
        pine: {
          50: '#e8f1ec',
          100: '#d3e5db',
          600: '#17654e',
          700: '#10523f',
          800: '#0e4a39',
          900: '#0b3a2d',
        },
        marigold: { DEFAULT: '#f2b632', soft: '#f9dd9c' },
        danger: { DEFAULT: '#a8261c', soft: '#fbeae7' },
      },
      fontFamily: {
        sans: [
          '"Hanken Grotesk Variable"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
      boxShadow: {
        panel: '0 18px 40px -22px rgba(11, 58, 45, 0.55)',
        bar: '0 -10px 30px -14px rgba(11, 58, 45, 0.5)',
        dialog: '0 28px 70px -24px rgba(20, 33, 28, 0.55)',
      },
    },
  },
  plugins: [],
} satisfies Config
