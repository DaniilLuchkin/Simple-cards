/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Soft pastel tones, used at low opacity over a white background
        // so everything reads as gently translucent.
        peach: "#ffd9c2",
        mint: "#c9f0e1",
        sky: "#cfe6ff",
        lilac: "#e3d6ff",
        blush: "#ffd6e6",
        butter: "#fff3c4",
        ink: "#3a3a45",
        muted: "#8b8b96",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
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
