import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1C3557",
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#b6c7d8",
          300: "#8ba7c1",
          400: "#5f86a8",
          500: "#3d6890",
          600: "#2d5179",
          700: "#1C3557",
          800: "#152a45",
          900: "#0f1f33",
          950: "#091422",
        },
        gold: {
          DEFAULT: "#C9A84C",
          50: "#fdf9ef",
          100: "#f9f0d4",
          200: "#f2dea5",
          300: "#E8D48B",
          400: "#d4b85e",
          500: "#C9A84C",
          600: "#b8953a",
          700: "#997830",
          800: "#7d612a",
          900: "#674f26",
        },
        charcoal: {
          DEFAULT: "#2D2D2D",
          50: "#f7f7f7",
          100: "#e3e3e3",
          200: "#c8c8c8",
          300: "#a4a4a4",
          400: "#818181",
          500: "#666666",
          600: "#515151",
          700: "#434343",
          800: "#2D2D2D",
          900: "#1a1a1a",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      boxShadow: {
        "premium": "0 4px 24px -2px rgba(28, 53, 87, 0.08), 0 2px 8px -2px rgba(28, 53, 87, 0.04)",
        "premium-lg": "0 8px 40px -4px rgba(28, 53, 87, 0.12), 0 4px 16px -4px rgba(28, 53, 87, 0.06)",
        "gold": "0 4px 24px -2px rgba(201, 168, 76, 0.2)",
        "gold-lg": "0 8px 40px -4px rgba(201, 168, 76, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
