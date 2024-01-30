/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "*.*",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./*/*.*",
    "./public/*.*",
  ],
  theme: {
    extend: {
      fontFamily: {
        Roboto: ["Roboto", "sans-serif"],
      }
    },
  },
  plugins: [],
}

