/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: ["animate-pulse-glow"],
  theme: {
    extend: {
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(var(--pulse-glow-color), 0.6)" },
          "50%":      { boxShadow: "0 0 15px 6px rgba(var(--pulse-glow-color), 0.45)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
