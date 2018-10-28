// Take control of the browser instance used by Penthouse.
// Can be used to setup custom configuration, and more.
// See puppeteer docs for more options:
// https://github.com/GoogleChrome/puppeteer).
const penthouse = require('penthouse')
const puppeteer = require('puppeteer') // installed by penthouse

const browserPromise = puppeteer.launch({
  ignoreHTTPSErrors: true,
  args: ['--disable-setuid-sandbox', '--no-sandbox'],
  // not required to specify here, but saves Penthouse some work if you will
  // re-use the same viewport for most penthouse calls.
  defaultViewport: {
    width: 1300,
    height: 900
  }
})
penthouse({
  url: 'https://google.com',
  cssString: 'body { color: red }',
  puppeteer: {
    getBrowser: () => browserPromise
  }
})
  .then(criticalCss => {
    // use it
    console.log('got critical css with nr chars:', criticalCss.length)
  })

// NOTE: by default Penthouse closes the browser it uses as soon as there are no ongoing jobs,
// even when a custom `getBrowser` function is used. You can currently override this behavior
// (f.e. to avoid open/close browser) via:
// `unstableKeepBrowserAlive` prop - which as the name suggests is subject to change in the future.
// If you do you have to call ~ `browserPromise.close()` yourself to avoid memory leaks!
