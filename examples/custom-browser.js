// Take control of the browser instance used by Penthouse.
// Can be used to setup custom configuration,
// to avoid browser open/close calls for improved performance, and more.
// See puppeteer docs for more options:
// https://github.com/GoogleChrome/puppeteer).

import penthouse from 'penthouse'
import puppeteer from 'puppeteer' // installed by penthouse

const browserPromise = puppeteer.launch()
penthouse({
  url: 'http://google.com',
  cssString: 'body { color; red }',
  puppeteer: {
    getBrowser: () => browserPromise
  }
})
.then(criticalCss => {
  // _after_ you are done with _all_ of your Penthouse calls
  // - NOT just this single one -
  // close the browser you started:
  browserPromise.then(browser => browser.close())
})
