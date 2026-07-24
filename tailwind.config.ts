import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "axis-core": "#201C1A",
        "axis-signal": "#E3F464",
        "axis-base": "#CEC1A9",
        "axis-light": "#F2F2F2",
      },
      fontFamily: {
        head: ["var(--font-eurostile)", "Eurostile", "Univers", "Helvetica Neue", "Arial", "sans-serif"],
        sans: ["var(--font-inter)", "Inter", "Helvetica Neue", "Arial", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(32, 28, 26, 0.06), 0 1px 1px rgba(32, 28, 26, 0.04)",
        "card-hover": "0 4px 16px rgba(32, 28, 26, 0.10)",
        modal: "0 20px 60px rgba(32, 28, 26, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
