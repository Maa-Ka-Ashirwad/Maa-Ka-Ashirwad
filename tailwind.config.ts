import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: "#101B1A",
        surface: "#182625",
        "surface-elevated": "#1F302E",
        border: "#243733",
        accent: "#F2A93B",
        "accent-red": "#C1443A",
        ink: "#F3F0E7",
        muted: "#8FA39E",
        good: "#7FBF9E",
        bad: "#E08B7D",
      },
      fontFamily: {
        display: ["Poppins", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
