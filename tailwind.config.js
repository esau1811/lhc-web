/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#050505',
        'gold-lhc': '#ffb300',
        'orange-lhc': '#ff8f00',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(to right, #ffb300, #ff8f00)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
