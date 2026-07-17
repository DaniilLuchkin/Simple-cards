/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Static pastels for small translucent controls (buttons, chips).
        peach: "#ffd9c2",
        mint: "#c9f0e1",
        sky: "#cfe6ff",
        lilac: "#e3d6ff",
        blush: "#ffd6e6",
        butter: "#fff3c4",
        // Theme-aware colors, driven by CSS variables (see styles/index.css):
        // light = pastel-on-white, dark = soft navy blues. Card faces must be
        // opaque so stacked cards don't show through each other.
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        "sky-fill": "rgb(var(--c-sky-fill) / <alpha-value>)",
        "lilac-fill": "rgb(var(--c-lilac-fill) / <alpha-value>)",
        "mint-fill": "rgb(var(--c-mint-fill) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        page: "rgb(var(--c-bg) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        // Meaning layer (headword + sentence). Sans stays the UI/metadata layer.
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: {
        soft: "0 8px 30px -8px rgba(58, 58, 69, 0.12)",
      },
      borderRadius: {
        card: "28px",
      },
    },
  },
  plugins: [],
};
