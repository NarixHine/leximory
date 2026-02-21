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
        growShrink: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
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
      grow: 'growShrink 0.5s ease-in-out infinite',
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

            primary: {
              DEFAULT: '#1f2125',
              50: '#f9fafb',
              100: '#f3f4f6',
              200: '#e5e7eb',
              300: '#d1d5db',
              400: '#9ca3af',
              500: '#6b7280',
              600: '#4b5563',
              700: '#374151',
              800: '#1f2937',
              900: '#030712',
            },

            secondary: {
              DEFAULT: '#67787c',
              50: '#f9fbfb',
              100: '#f1f3f3',
              200: '#e3e7e8',
              300: '#d0d6d8',
              400: '#9ca8ab',
              500: '#67787c',
              600: '#4b585b',
              700: '#394447',
              800: '#22292b',
              900: '#161b1d',
            },
          }
        },

        dark: {
          colors: {
            background: '#100F0F',
            foreground: '#CECDC3',

            focus: {
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

            default: {
              DEFAULT: '#71717A',
              foreground: '#FAFAFA',
              50: '#18181B',
              100: '#27272A',
              200: '#3F3F46',
              300: '#52525B',
              400: '#71717A',
              500: '#A1A1AA',
              600: '#D4D4D8',
              700: '#E4E4E7',
              800: '#F4F4F5',
              900: '#FAFAFA',
            },

            primary: {
              DEFAULT: '#6B6F72',
              50: '#171717',
              100: '#262626',
              200: '#404040',
              300: '#525252',
              400: '#737373',
              500: '#a3a3a3',
              600: '#c4c4c4',
              700: '#d4d4d4',
              800: '#e5e5e5',
              900: '#fafafa',
            },

            secondary: {
              DEFAULT: '#67787C',
              50: '#161B1D',
              100: '#22292B',
              200: '#394447',
              300: '#4B585B',
              400: '#67787C',
              500: '#9CA8AB',
              600: '#D0D6D8',
              700: '#E3E7E8',
              800: '#F1F3F3',
              900: '#F9FBFB',
            },
          }
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
