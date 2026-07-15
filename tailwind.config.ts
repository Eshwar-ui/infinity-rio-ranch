import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        cream: 'var(--cream)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        brass: 'var(--brass)',
        brass2: 'var(--brass2)',
        onbrass: 'var(--onbrass)',
      },
      fontFamily: {
        sans: ['Jost', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        script: ['"Dancing Script"', 'cursive'],
      },
      maxWidth: {
        content: '1240px',
        wide: '1320px',
      },
      keyframes: {
        twinkle: {
          '0%,100%': { opacity: '0.3', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        kenburns: {
          '0%': { transform: 'scale(1.02) translate(0, 0)' },
          '100%': { transform: 'scale(1.14) translate(-1.6%, -2%)' },
        },
        floatY: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-22px)' },
        },
        scrolldot: {
          '0%': { transform: 'translateY(-2px)', opacity: '0' },
          '30%': { opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'translateY(16px)', opacity: '0' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        twinkle: 'twinkle 2.5s ease-in-out infinite',
        floatY: 'floatY 9s ease-in-out infinite',
        scrolldot: 'scrolldot 2s ease-in-out infinite',
        'rise-in': 'riseIn 1.1s cubic-bezier(0.22,0.61,0.36,1) forwards',
        'accordion-down': 'accordion-down 0.25s ease-out',
        'accordion-up': 'accordion-up 0.25s ease-out',
      },
    },
  },
  plugins: [animate],
}

export default config
