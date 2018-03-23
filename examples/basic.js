import penthouse from 'penthouse'
import fs from 'fs'

penthouse({
  url: 'http://google.com',
  cssString: 'body { color: red }'
})
.then(criticalCss => {
  // use the critical css
  fs.writeFileSync('outfile.css', criticalCss);
})
