import { heroui } from '@heroui/react'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        hide: {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        pulse: {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '0.3' },
        },
        slideDownAndFade: {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideLeftAndFade: {
          from: { opacity: "0", transform: "translateX(6px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideUpAndFade: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideRightAndFade: {
          from: { opacity: "0", transform: "translateX(-6px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        accordionOpen: {
          from: { height: "0px" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        accordionClose: {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: { height: "0px" },
        },
        dialogOverlayShow: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        dialogContentShow: {
          from: {
            opacity: "0",
            transform: "translate(-50%, -45%) scale(0.95)",
          },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        drawerSlideLeftAndFade: {
          from: { opacity: "0", transform: "translateX(100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        drawerSlideRightAndFade: {
          from: { opacity: "1", transform: "translateX(0)" },
          to: { opacity: "0", transform: "translateX(100%)" },
        },
      },
    },
    animation: {
      hide: "hide 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      slideDownAndFade: "slideDownAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      slideLeftAndFade: "slideLeftAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      slideUpAndFade: "slideUpAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      slideRightAndFade:
        "slideRightAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      // Accordion
      accordionOpen: "accordionOpen 150ms cubic-bezier(0.87, 0, 0.13, 1)",
      accordionClose: "accordionClose 150ms cubic-bezier(0.87, 0, 0.13, 1)",
      // Dialog
      dialogOverlayShow:
        "dialogOverlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      dialogContentShow:
        "dialogContentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      // Drawer
      drawerSlideLeftAndFade:
        "drawerSlideLeftAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      drawerSlideRightAndFade: "drawerSlideRightAndFade 150ms ease-in",
      pulse: "pulse 2s ease-in-out infinite",
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            focus: {
              DEFAULT: '#9F9D96',
              50: '#F2F0E5',
              100: '#E6E4D9',
              200: '#CECDC3',
              300: '#B7B5AC',
              400: '#9F9D96',
              500: '#878580',
              600: '#6F6E69',
              700: '#575653',
              800: '#403E3C',
              900: '#282726',
            },

            // Morandi green
            default: {
              "DEFAULT": "#e7ece7",
              "foreground": "#5a715a",
              "50": "#f8faf8",
              "100": "#f1f5f1",
              "200": "#e7ece7",
              "300": "#d6dbd6",
              "400": "#9caea1",
              "500": "#768c75",
              "600": "#5a715a",
              "700": "#455745",
              "800": "#2f3e2f",
              "900": "#202c20"
            },

            // Neutral
            primary: {
              DEFAULT: '#575653',
              50: '#F2F0E5',
              100: '#E6E4D9',
              200: '#CECDC3',
              300: '#B7B5AC',
              400: '#9F9D96',
              500: '#878580',
              600: '#6F6E69',
              700: '#575653',
              800: '#403E3C',
              900: '#282726',
            },

            // Faded neutral
            secondary: {
              DEFAULT: '#9F9D96',
              50: '#F8F7F2',
              100: '#EEEDEA',
              200: '#DDDCD7',
              300: '#C8C6BF',
              400: '#B0AEA6',
              500: '#9F9D96',
              600: '#85837D',
              700: '#6B6A65',
              800: '#52514D',
              900: '#393836',
            },
          }
        },

        dark: {
          colors: {
            background: '#100F0F',
            foreground: '#CECDC3',

            focus: {
              DEFAULT: '#878580',
              50: '#282726',
              100: '#403E3C',
              200: '#575653',
              300: '#6F6E69',
              400: '#878580',
              500: '#9F9D96',
              600: '#B7B5AC',
              700: '#CECDC3',
              800: '#E6E4D9',
              900: '#F2F0E5',
            },

            // Morandi green (dark mode — reversed scale)
            default: {
              DEFAULT: 'oklch(0.55 0.05 150)',
              50: 'oklch(0.18 0.03 150)',
              100: 'oklch(0.25 0.04 150)',
              200: 'oklch(0.35 0.05 150)',
              300: 'oklch(0.45 0.06 150)',
              400: 'oklch(0.55 0.05 150)',
              500: 'oklch(0.70 0.04 150)',
              600: 'oklch(0.90 0.025 150)',
              700: 'oklch(0.94 0.015 150)',
              800: 'oklch(0.965 0.008 150)',
              900: 'oklch(0.98 0.005 150)',
            },

            // Neutral (dark mode — reversed scale)
            primary: {
              DEFAULT: '#9F9D96',
              50: '#282726',
              100: '#403E3C',
              200: '#575653',
              300: '#6F6E69',
              400: '#878580',
              500: '#9F9D96',
              600: '#B7B5AC',
              700: '#CECDC3',
              800: '#E6E4D9',
              900: '#F2F0E5',
            },

            // Faded neutral (dark mode — reversed scale)
            secondary: {
              DEFAULT: '#85837D',
              50: '#393836',
              100: '#52514D',
              200: '#6B6A65',
              300: '#85837D',
              400: '#9F9D96',
              500: '#B0AEA6',
              600: '#C8C6BF',
              700: '#DDDCD7',
              800: '#EEEDEA',
              900: '#F8F7F2',
            },
          },
        }
      },
    }),
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
  ],
}

export default config
