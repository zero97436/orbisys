/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Palette pilotée par variables CSS (voir index.css) -> thème clair/sombre.
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          soft: "rgb(var(--bg-soft) / <alpha-value>)",
          elevated: "rgb(var(--card) / <alpha-value>)",
        },
        card: "rgb(var(--card) / <alpha-value>)",
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          soft: "rgb(var(--border-soft) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        // Statuts : variables par thème (lisibles en sombre et en clair, voir index.css).
        status: {
          ok: "rgb(var(--st-ok) / <alpha-value>)",
          warning: "rgb(var(--st-warning) / <alpha-value>)",
          critical: "rgb(var(--st-critical) / <alpha-value>)",
          unknown: "rgb(var(--st-unknown) / <alpha-value>)",
          info: "rgb(var(--st-info) / <alpha-value>)",
          maintenance: "rgb(var(--st-maintenance) / <alpha-value>)",
        },
        accent: {
          cyan: "rgb(var(--cyan) / <alpha-value>)",
          violet: "rgb(var(--violet) / <alpha-value>)",
        },
        brand: {
          // Surchargeable par le branding (plan Professional) via variables CSS.
          DEFAULT: "rgb(var(--brand-rgb, 59 130 246) / <alpha-value>)",
          soft: "rgb(var(--brand-soft-rgb, 29 78 216) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Schibsted Grotesk", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0,0,0,0.4), 0 1px 3px 0 rgba(0,0,0,0.3)",
        glow: "0 0 0 1px rgba(59,130,246,0.4), 0 8px 30px -8px rgba(59,130,246,0.35)",
        pop: "0 20px 50px -20px rgba(0,0,0,0.7), 0 0 0 1px rgb(var(--border))",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(16,185,129,0.5)" },
          "70%": { boxShadow: "0 0 0 6px rgba(16,185,129,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s infinite",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
