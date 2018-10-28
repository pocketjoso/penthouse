// Can be used to verify that critical css generation works as intended for your pages.
// Takes two screenshots, `-before` and `-after`:
// `-before`, of original page
// `-after`, with all css on page replaced by the generated critical css

const penthouse = require('penthouse')

// These settings will produce two screenshots:
// 'homepage-before.jpg'
// 'homepage-after.jpg'
penthouse({
  url: 'https://google.com',
  cssString: 'body { color: red }',
  screenshots: {
    basePath: 'homepage', // absolute or relative; excluding file extension
    type: 'jpeg', // jpeg or png, png default
    quality: 20 // only applies for jpeg type
  }
})
