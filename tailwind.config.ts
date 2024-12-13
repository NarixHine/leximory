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
            background: '#FAFDF6',
            primary: {
              DEFAULT: '#7D9161',
              100: '#F8FAF0',
              200: '#F1F6E1',
              300: '#DCE5C8',
              400: '#C0CBAB',
              500: '#9CA986',
              600: '#7D9161',
              700: '#617943',
              800: '#47622A',
              900: '#345119'
            },
            secondary: {
              DEFAULT: '#9ABB8B',
              100: '#FAFDF6',
              200: '#F5FBEE',
              300: '#EAF3E1',
              400: '#DCE8D3',
              500: '#C9DABF',
              600: '#9ABB8B',
              700: '#6F9C60',
              800: '#497E3C',
              900: '#2D6824'
            },
            danger: {
              DEFAULT: '#5F6F65',
              100: '#F0F7F0',
              200: '#E2F0E3',
              300: '#C1D3C4',
              400: '#96A89B',
              500: '#5F6F65',
              600: '#455F51',
              700: '#2F4F42',
              800: '#1E4035',
              900: '#12352D'
            },
            warning: {
              DEFAULT: '#808D7C',
              100: '#F6F9F3',
              200: '#EDF3E7',
              300: '#BDC9C3',
              400: '#AEBAA9',
              500: '#808D7C',
              600: '#5F795A',
              700: '#42653E',
              800: '#285127',
              900: '#17431A'
            }
          }
        },
        dark: {
          colors: {
            background: '#15202B',
            content1: '#1B2D48',
            default: {
              DEFAULT: '#495463',
              100: '#272d37',
              200: '#3a414e',
              300: '#495463',
              400: '#5a677a',
              500: '#67758b',
              600: '#7e899c',
              700: '#949eae',
              800: '#b2bac5',
              900: '#d0d5dd',
            },
            primary: {
              DEFAULT: '#7697a6',
              900: '#d6e1e6',
              800: '#bdcdd5',
              700: '#a2b8c3',
              600: '#8ca7b4',
              500: '#7697a6',
              400: '#698693',
              300: '#59717c',
              200: '#4b5d66',
              100: '#39474e',
            },
            secondary: {
              DEFAULT: '#7893a3',
              900: '#dae8e4',
              800: '#becbd3',
              700: '#a3b5c1',
              600: '#8da4b1',
              500: '#7893a3',
              400: '#6b8391',
              300: '#5a6e7a',
              200: '#4b5a64',
              100: '#39444b'
            },
            danger: {
              DEFAULT: '#384d80',
              900: '#c1c7d5',
              800: '#9aa3b9',
              700: '#75809c',
              600: '#596689',
              500: '#384d80',
              400: '#324577',
              300: '#293c6d',
              200: '#213362',
              100: '#112350'
            },
            warning: {
              DEFAULT: '#6198d3',
              900: '#c3def2',
              800: '#a1cbea',
              700: '#83b6df',
              600: '#70a6d9',
              500: '#6198d3',
              400: '#598bc6',
              300: '#4f79b3',
              200: '#4669a1',
              100: '#384c80'
            }
          }
        },
      }
    }),
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
  ],
}

export default config

