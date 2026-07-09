import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Couleur de marque (bleu SAIM, dérivée du logo #4BB8E8 → #1A7DB5).
        brand: {
          50: "#eef8fd", 100: "#d6eefb", 200: "#b0e0f5", 300: "#7fceee",
          400: "#4bb8e8", 500: "#2a9fd6", 600: "#1a7db5", 700: "#176a9a",
          800: "#175a82", 900: "#123f5c",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto",
          "Helvetica Neue", "Arial", "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
