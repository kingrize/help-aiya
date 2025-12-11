/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "sans-serif"],
        display: ["Quicksand", "sans-serif"],
      },
      colors: {
        cozy: {
          bg: "var(--c-bg)",
          card: "var(--c-card)",
          text: "var(--c-text)",
          muted: "var(--c-text-muted)", // Tambahan baru
          primary: "var(--c-primary)",
          secondary: "var(--c-secondary)",
          accent: "var(--c-accent)",
          border: "var(--c-border)",
        },
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [],
};
