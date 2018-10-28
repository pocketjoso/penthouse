const penthouse = require('penthouse')
const fs = require('fs')

penthouse({
  url: 'https://google.com',
  cssString: 'body { color: red }'
})
  .then(criticalCss => {
    // use the critical css
    fs.writeFileSync('outfile.css', criticalCss)
  })
