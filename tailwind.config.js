/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  // HAPUS darkMode: 'class', kita tidak pakai lagi
  theme: {
    fontFamily: {
      sans: ["Quicksand", "sans-serif"],
      display: ["Baloo 2", "cursive"],
    },
    extend: {
      colors: {
        // Kita petakan ke Variable CSS
        cozy: {
          bg: "var(--c-bg)", // Latar belakang utama
          card: "var(--c-card)", // Latar kartu/elemen
          text: "var(--c-text)", // Warna teks utama
          muted: "var(--c-muted)", // Warna teks pudar
          border: "var(--c-border)", // Garis pinggir
          primary: "var(--c-primary)", // Warna Utama (Pink/Biru/dll)
          accent: "var(--c-accent)", // Warna kedua
          shadow: "var(--c-shadow)", // Bayangan
        },
      },
      animation: {
        wiggle: "wiggle 1s ease-in-out infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
      },
    },
  },
  plugins: [],
};
