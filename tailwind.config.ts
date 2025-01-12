import { nextui } from '@nextui-org/react'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
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
    },
  },
  plugins: [
    nextui({
      themes: {
        light: {
          colors: {
            // Light theme background set to "paper"
            background: '#FFFCF0',

            // Use "base" scale for default (in normal order)
            default: {
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

            // Primary: Green (normal order)
            primary: {
              DEFAULT: '#879A39',
              50: '#EDEECF',
              100: '#DDE2B2',
              200: '#BEC97E',
              300: '#A0AF54',
              400: '#879A39',
              500: '#768D21',
              600: '#66800B',
              700: '#536907',
              800: '#3D4C07',
              900: '#252D09',
            },

            // Secondary: Cyan (normal order)
            secondary: {
              DEFAULT: '#3AA99F',
              50: '#DDF1E4',
              100: '#BFE8D9',
              200: '#87D3C3',
              300: '#5ABDAC',
              400: '#3AA99F',
              500: '#2F968D',
              600: '#24837B',
              700: '#1C6C66',
              800: '#164F4A',
              900: '#122F2C',
            },

            // Warning: Blue (normal order)
            warning: {
              DEFAULT: '#4385BE',
              50: '#E1ECEB',
              100: '#C6DDE8',
              200: '#92BFDB',
              300: '#66A0C8',
              400: '#4385BE',
              500: '#3171B2',
              600: '#205EA6',
              700: '#1A4F8C',
              800: '#163B66',
              900: '#12253B',
            },

            // Danger: Magenta (normal order)
            danger: {
              DEFAULT: '#CE5D97',
              50: '#FEE4E5',
              100: '#FCCFDA',
              200: '#F4A4C2',
              300: '#E47DA8',
              400: '#CE5D97',
              500: '#B74583',
              600: '#A02F6F',
              700: '#87285E',
              800: '#641F46',
              900: '#39172B',
            },
          }
        },

        dark: {
          colors: {
            // Dark theme background set to "black"
            background: '#100F0F',

            // Use "base" scale for default (reversed order)
            default: {
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

            // Primary: Green (reversed order)
            primary: {
              DEFAULT: '#768D21',
              50: '#252D09',
              100: '#3D4C07',
              200: '#536907',
              300: '#66800B',
              400: '#768D21',
              500: '#879A39',
              600: '#A0AF54',
              700: '#BEC97E',
              800: '#DDE2B2',
              900: '#EDEECF',
            },

            // Secondary: Cyan (reversed order)
            secondary: {
              DEFAULT: '#2F968D',
              50: '#122F2C',
              100: '#164F4A',
              200: '#1C6C66',
              300: '#24837B',
              400: '#2F968D',
              500: '#3AA99F',
              600: '#5ABDAC',
              700: '#87D3C3',
              800: '#BFE8D9',
              900: '#DDF1E4',
            },

            // Warning: Blue (reversed order)
            warning: {
              DEFAULT: '#3171B2',
              50: '#12253B',
              100: '#163B66',
              200: '#1A4F8C',
              300: '#205EA6',
              400: '#3171B2',
              500: '#4385BE',
              600: '#66A0C8',
              700: '#92BFDB',
              800: '#C6DDE8',
              900: '#E1ECEB',
            },

            // Danger: Magenta (reversed order)
            danger: {
              DEFAULT: '#B74583',
              50: '#39172B',
              100: '#641F46',
              200: '#87285E',
              300: '#A02F6F',
              400: '#B74583',
              500: '#CE5D97',
              600: '#E47DA8',
              700: '#F4A4C2',
              800: '#FCCFDA',
              900: '#FEE4E5',
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

