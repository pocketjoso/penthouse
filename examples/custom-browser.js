// Take control of the browser instance used by Penthouse.
// Can be used to setup custom configuration, and more.
// See puppeteer docs for more options:
// https://github.com/GoogleChrome/puppeteer).
import penthouse from 'penthouse'
import puppeteer from 'puppeteer' // installed by penthouse

const browserPromise = puppeteer.launch({
  ignoreHTTPSErrors: true,
  args: ['--disable-setuid-sandbox', '--no-sandbox']
})
penthouse({
  url: 'http://google.com',
  cssString: 'body { color: red }',
  puppeteer: {
    getBrowser: () => browserPromise
  }
})
.then(criticalCss => {
  // use it
})

// NOTE: by default Penthouse closes the browser it uses as soon as there are no ongoing jobs,
// even when a custom `getBrowser` function is used. You can currently override this behavior
// (f.e. to avoid open/close browser) via:
// `unstableKeepBrowserAlive` prop - which as the name suggests is subject to change in the future.
// If you do you have to call ~ `browserPromise.close()` yourself to avoid memory leaks!
