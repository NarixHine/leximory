import { heroui } from '@heroui/react'
import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
    },
  },
  darkMode: 'class',
  plugins: [
    require('@tailwindcss/typography'),
    heroui({
      "themes": {
        "light": {
          "colors": {
            "primary": {
              "50": "#e8e7e6",
              "100": "#c8c5c2",
              "200": "#a8a39f",
              "300": "#87817c",
              "400": "#675f58",
              "500": "#473d35",
              "600": "#3b322c",
              "700": "#2e2822",
              "800": "#221d19",
              "900": "#151210",
              "foreground": "#fff",
              "DEFAULT": "#473d35"
            },
          }
        },
        "dark": {
          "colors": {
            "primary": {
              "50": "#332f2b",
              "100": "#665d56",
              "200": "#998c80",
              "300": "#ccbaab",
              "400": "#ffe9d6",
              "500": "#ffedde",
              "600": "#fff2e6",
              "700": "#fff6ef",
              "800": "#fffbf7",
              "900": "#ffffff",
              "foreground": "#000",
              "DEFAULT": "#ffe9d6"
            },
          }
        }
      },
      "layout": {
        "disabledOpacity": "0.5"
      }
    }),
  ],
} satisfies Config
