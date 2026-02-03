import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        robin: {
          50: "#f0fbff",
          100: "#e3f7fd",
          200: "#c5ecf7",
          300: "#aeeaf2",
          400: "#8fdde9",
          500: "#6ecddf",
          600: "#49b4cb",
          700: "#3b90a3",
          800: "#326f7e",
          900: "#2b5966",
        },
      },
      borderRadius: { pill: "9999px" },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
