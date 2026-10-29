import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f2",
          100: "#d5ecdf",
          200: "#aed9c2",
          300: "#7fbe9f",
          400: "#4f9d78",
          500: "#2f7f5c",
          600: "#1f6649",
          700: "#18513b",
          800: "#123f2e",
          900: "#0c2f22",
          950: "#072018",
        },
        gold: {
          400: "#d9b25f",
          500: "#c99b3f",
          600: "#a87c2c",
        },
        sand: "#f6f4ee",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(12,47,34,.06), 0 4px 16px rgba(12,47,34,.06)",
      },
    },
  },
  plugins: [],
};

export default config;
