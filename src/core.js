import pruneNonCriticalCss from './browser-sandbox/pruneNonCriticalCss'

async function blockJsRequests (page) {
  await page.setRequestInterceptionEnabled(true)
  page.on('request', interceptedRequest => {
    if (/\.js(\?.*)?$/.test(interceptedRequest.url)) {
      interceptedRequest.abort()
    } else {
      interceptedRequest.continue()
    }
  })
}

async function pruneNonCriticalCssLauncher ({
  browser,
  url,
  astRules,
  width,
  height,
  forceInclude,
  userAgent,
  timeout,
  renderWaitTime,
  blockJSRequests,
  customPageHeaders,
  debuglog
}) {
  let _hasExited = false

  return new Promise(async (resolve, reject) => {
    debuglog('Penthouse core start (with timeout: ' + timeout)
    let page
    let killTimeout
    async function cleanupAndExit ({ error, returnValue }) {
      if (_hasExited) {
        return
      }
      _hasExited = true

      clearTimeout(killTimeout)
      if (page) {
        await page.close()
      }
      if (error) {
        reject(error)
        return
      }
      resolve(returnValue)
    }
    killTimeout = setTimeout(() => {
      cleanupAndExit({
        error: new Error('Penthouse timed out after ' + timeout / 1000 + 's. ')
      })
    }, timeout)

    try {
      page = await browser.newPage()
      debuglog('new page opened in browser')

      await page.setViewport({ width, height })
      debuglog('viewport set')

      await page.setUserAgent(userAgent)

      if (customPageHeaders) {
        // Convert Object to the required Map
        // NOTE: Puppeteer are changing this type back to Object,
        // so this will be unnecessary in future
        try {
          const customPageHeadersMap = new Map(
            Object.entries(customPageHeaders)
          )
          await page.setExtraHTTPHeaders(customPageHeadersMap)
        } catch (e) {
          debuglog('failed setting extra http headers: ' + e)
        }
      }

      if (blockJSRequests) {
        // currently does not work together with page.evaluate calls:
        // https://github.com/GoogleChrome/puppeteer/issues/562
        // await page.setJavaScriptEnabled(false)
        await blockJsRequests(page)
        debuglog('blocking js requests')
      }
      page.on('console', msg => {
        // pass through log messages
        // - the ones sent by penthouse for debugging has 'debug: ' prefix.
        if (/^debug: /.test(msg)) {
          debuglog(msg.replace(/^debug: /, ''))
        }
      })

      // NOTE: have to set a timeout here,
      // even though we have our own timeout above,
      // just to override the default puppeteer timeout of 30s
      await page.goto(url, { timeout })
      debuglog('page loaded')

      if (!page) {
        // in case we timed out
        return
      }
      const criticalRules = await page.evaluate(pruneNonCriticalCss, {
        astRules,
        forceInclude,
        renderWaitTime
      })

      debuglog('GENERATION_DONE')
      cleanupAndExit({ returnValue: criticalRules })
    } catch (e) {
      cleanupAndExit({ error: e })
    }
  })
}

export default pruneNonCriticalCssLauncher
