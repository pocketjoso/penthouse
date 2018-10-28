import puppeteer from 'puppeteer'
import debug from 'debug'

const debuglog = debug('penthouse:browser')

// shared between penthouse calls
let browser = null
let _browserLaunchPromise = null
let reusableBrowserPages = []
// keep track of when we can close the browser penthouse uses;
// kept open by continuous use
let ongoingJobs = 0
export function addJob () {
  ongoingJobs = ongoingJobs + 1
}
export function removeJob () {
  ongoingJobs = ongoingJobs - 1
}

const _UNSTABLE_KEEP_ALIVE_MAX_KEPT_OPEN_PAGES = 4

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
  const usingCustomGetBrowser = getBrowser && typeof getBrowser === 'function'
  if (usingCustomGetBrowser && !_browserLaunchPromise) {
    debuglog('using browser provided via getBrowser option')
    _browserLaunchPromise = Promise.resolve(getBrowser())
  }
  if (!_browserLaunchPromise) {
    debuglog('no browser instance, launching new browser..')

    _browserLaunchPromise = puppeteer.launch({
      args: DEFAULT_PUPPETEER_LAUNCH_ARGS,
      ignoreHTTPSErrors: true,
      defaultViewport: {
        width,
        height
      }
    })
  }
  _browserLaunchPromise.then(async browser => {
    debuglog('browser ready')
    const browserPages = await browser.pages()
    if (browserPages.length > 0) {
      debuglog('re-using the page browser launched with')
      browserPages.forEach(Page => {
        if (!reusableBrowserPages.includes(Page)) {
          Page.notSetupForPenthouse = true
          reusableBrowserPages.push(Page)
        } else {
          debuglog('ignoring browser page already inside reusableBrowserPages')
        }
      })
    }
    return browser
  })

  browser = await _browserLaunchPromise
  _browserLaunchPromise = null
}

export async function closeBrowser ({ forceClose, unstableKeepBrowserAlive }) {
  if (browser && (forceClose || !unstableKeepBrowserAlive)) {
    if (ongoingJobs > 0) {
      debuglog('keeping browser open as ongoingJobs: ' + ongoingJobs)
    } else if (browser && browser.close) {
      browser.close()
      browser = null
      _browserLaunchPromise = null
      debuglog('closed browser')
    }
  }
}

export async function restartBrowser ({ getBrowser, width, height }) {
  let browserPages
  if (browser) {
    browserPages = await browser.pages()
  }
  debuglog(
    'restartBrowser called' + browser &&
      browserPages &&
      '\n_browserPagesOpen: ' + browserPages.length
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

export async function getOpenBrowserPage () {
  const browserPages = await browser.pages()

  // if any re-usable pages to use, avoid unnecessary page open/close calls
  if (reusableBrowserPages.length > 0) {
    debuglog(
      're-using browser page for generateCriticalCss, remaining at: ' +
        browserPages.length
    )
    const reusedPage = reusableBrowserPages.pop()
    let reused = true
    // if we haven't yet run any penthouse jobs with this page,
    // don't consider it reused - i.e. it will need to be configured.
    if (reusedPage.notSetupForPenthouse) {
      reused = false
      // but only once
      delete reusedPage.notSetupForPenthouse
    }
    return Promise.resolve({
      page: reusedPage,
      reused
    })
  }

  debuglog(
    'adding browser page for generateCriticalCss, before adding was: ' +
      browserPages.length
  )
  return browser.newPage().then(page => {
    return { page }
  })
}

export async function closeBrowserPage ({
  page,
  error,
  unstableKeepBrowserAlive
}) {
  if (!browser || !page) {
    return
  }
  const browserPages = await browser.pages()
  debuglog(
    'remove (maybe) browser page for generateCriticalCss, before removing was: ' +
      browserPages.length
  )

  const badErrors = ['Target closed', 'Page crashed']
  if (
    page &&
    !(
      error &&
      badErrors.some(badError => error.toString().indexOf(badError) > -1)
    )
  ) {
    // Without try/catch if error penthouse will crash if error here,
    // and wont restart properly
    try {
      // must await here, otherwise will receive errors if closing
      // browser before page is properly closed,
      // however in unstableKeepBrowserAlive browser is never closed by penthouse.
      if (unstableKeepBrowserAlive) {
        if (browserPages.length > _UNSTABLE_KEEP_ALIVE_MAX_KEPT_OPEN_PAGES) {
          page.close()
        } else {
          debuglog('saving page for re-use, instead of closing')
          if (error) {
            // When a penthouse job execution errors,
            // in some conditions when later re-use the page
            // certain methods don't work,
            // such as Page.setUserAgent never resolving.
            // "resetting" the page by navigation to about:blank first fixes this.
            debuglog('Reset page first..')
            await page.goto('about:blank').then(() => {
              debuglog('... page reset DONE')
            })
          }
          reusableBrowserPages.push(page)
        }
      } else {
        debuglog('now try to close browser page')
        await page.close()
      }
    } catch (err) {
      debuglog('failed to close browser page (ignoring)')
    }
  }
}
