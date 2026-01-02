// src/tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        lexend: ["Lexend", "sans-serif"],
        comfortaa: ["Comfortaa", "cursive"],
        label: ['"Montserrat"', "sans-serif"],
        opensans: ['"Open Sans"', "sans-serif"],
      },
      scale: {
        '175': '1.75',
        '200': '2',
        '250': '2.5'
      },
      backgroundImage: {
        'mexico-gradient': 'linear-gradient(to right, #006847, white, #C90016)',
        'usa-gradient': 'linear-gradient(to right, #3C3B6E, white, #B22234)'
      }
    }
  }
};