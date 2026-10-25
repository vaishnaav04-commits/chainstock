
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#e9fdf7",
          100: "#c9fae8",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
        },
      },
      boxShadow: {
        soft: "0 15px 45px rgba(0,0,0,0.08)",
        glow: "0 0 35px rgba(20,184,166,0.10)",
      },
    },
  },
  plugins: [],
};
