import puppeteer from 'puppeteer'
import debug from 'debug'

const debuglog = debug('penthouse:browser')

// shared between penthouse calls
let browser = null
let _browserLaunchPromise = null
// browser.pages is not implemented, so need to count myself to not close browser
// until all pages used by penthouse are closed (i.e. individual calls are done)
let _browserPagesOpen = 0

const DEFAULT_PUPPETEER_LAUNCH_ARGS = [
  '--disable-setuid-sandbox',
  '--no-sandbox',
  '--ignore-certificate-errors'
  // better for Docker:
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
  // (however caused memory leaks in Penthouse when testing in Ubuntu, hence disabled)
  // '--disable-dev-shm-usage'
]

export async function launchBrowserIfNeeded ({ getBrowser, width, height }) {
  if (browser) {
    return
  }
  if (
    getBrowser &&
    typeof getBrowser === 'function' &&
    !_browserLaunchPromise
  ) {
    _browserLaunchPromise = getBrowser()
  }
  if (!_browserLaunchPromise) {
    debuglog('no browser instance, launching new browser..')

    _browserLaunchPromise = puppeteer
      .launch({
        ignoreHTTPSErrors: true,
        args: DEFAULT_PUPPETEER_LAUNCH_ARGS,
        defaultViewport: {
          width,
          height
        }
      })
      .then(browser => {
        debuglog('new browser launched')
        return browser
      })
  }
  browser = await _browserLaunchPromise
  _browserLaunchPromise = null
}

export async function closeBrowser ({ unstableKeepBrowserAlive }) {
  debuglog('closeBrowser')
  if (browser && !unstableKeepBrowserAlive) {
    if (_browserPagesOpen > 0) {
      debuglog(
        'keeping browser open as _browserPagesOpen: ' + _browserPagesOpen
      )
    } else if (browser && browser.close) {
      browser.close()
      browser = null
      _browserLaunchPromise = null
      debuglog('closed browser')
    }
  }
}

export async function restartBrowser ({ getBrowser, width, height }) {
  debuglog(
    'restartBrowser called' + '\n_browserPagesOpen: ' + (_browserPagesOpen + 1)
  )
  // for some reason Chromium is no longer opened;
  // perhaps it crashed
  if (_browserLaunchPromise) {
    // in this case the browser is already restarting
    await _browserLaunchPromise
    // if getBrowser is specified the user is managing the puppeteer browser themselves,
    // so we do nothing.
  } else if (!getBrowser) {
    console.log('now restarting chrome after crash')
    browser = null
    await launchBrowserIfNeeded({ width, height })
  }
}

export async function browserIsRunning () {
  try {
    // will throw 'Not opened' error if browser is not running
    await browser.version()
    return true
  } catch (e) {
    return false
  }
}

export async function getOpenBrowserPage ({ unstableKeepBrowserAlive }) {
  // TODO: in unstableKeepBrowserAlive, start reusing browser pages.
  // avoids repeated cost of page open/close
  _browserPagesOpen++
  debuglog(
    'adding browser page for generateCriticalCss, now: ' + _browserPagesOpen
  )
  return browser.newPage()
}

export async function closeBrowserPage ({
  page,
  error,
  unstableKeepBrowserAlive
}) {
  // page.close will error if page/browser has already been closed;
  // try to avoid
  _browserPagesOpen--
  debuglog(
    'remove browser page for generateCriticalCss, now: ' + _browserPagesOpen
  )

  if (page && !(error && error.toString().indexOf('Target closed') > -1)) {
    debuglog('cleanupAndExit -> try to close browser page')
    // Without try/catch if error penthouse will crash if error here,
    // and wont restart properly
    try {
      // must await here, otherwise will receive errors if closing
      // browser before page is properly closed,
      // however in unstableKeepBrowserAlive browser is never closed by penthouse.
      if (unstableKeepBrowserAlive) {
        page.close()
      } else {
        await page.close()
      }
    } catch (err) {
      debuglog('cleanupAndExit -> failed to close browser page (ignoring)')
    }
  }
}
