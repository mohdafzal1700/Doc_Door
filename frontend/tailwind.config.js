/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Clean, standard colors without CSS variables
        border: "#e2e8f0", // slate-200
        input: "#f1f5f9",  // slate-100
        ring: "#3b82f6",   // blue-500
        background: "#ffffff", // white
        foreground: "#0f172a", // slate-900
        primary: {
          DEFAULT: "#3b82f6", // blue-500
          foreground: "#ffffff", // white
        },
        secondary: {
          DEFAULT: "#f1f5f9", // slate-100
          foreground: "#0f172a", // slate-900
        },
        destructive: {
          DEFAULT: "#ef4444", // red-500
          foreground: "#ffffff", // white
        },
        muted: {
          DEFAULT: "#f8fafc", // slate-50
          foreground: "#64748b", // slate-500
        },
        accent: {
          DEFAULT: "#f1f5f9", // slate-100
          foreground: "#0f172a", // slate-900
        },
        popover: {
          DEFAULT: "#ffffff", // white
          foreground: "#0f172a", // slate-900
        },
        card: {
          DEFAULT: "#ffffff", // white
          foreground: "#0f172a", // slate-900
        },
      },
      borderRadius: {
        lg: "0.5rem",    // 8px
        md: "0.375rem",  // 6px
        sm: "0.25rem",   // 4px
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        "fade-in-right": "fade-in-right 0.6s ease-out forwards",
        float: "float 3s ease-in-out infinite",
        "float-delayed": "float-delayed 3s ease-in-out infinite 1.5s",
        "pulse-slow": "pulse-slow 4s ease-in-out infinite",
      },
      keyframes: {
        "fade-in-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(30px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-in-right": {
          "0%": {
            opacity: "0",
            transform: "translateX(30px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        float: {
          "0%, 100%": {
            transform: "translateY(0px)",
          },
          "50%": {
            transform: "translateY(-10px)",
          },
        },
        "float-delayed": {
          "0%, 100%": {
            transform: "translateY(0px)",
          },
          "50%": {
            transform: "translateY(-15px)",
          },
        },
        "pulse-slow": {
          "0%, 100%": {
            transform: "scale(1)",
            opacity: "1",
          },
          "50%": {
            transform: "scale(1.05)",
            opacity: "0.8",
          },
        },
      },
    },
  },
  plugins: [],
}