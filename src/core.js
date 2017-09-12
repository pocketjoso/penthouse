import pruneNonCriticalCss from './browser-sandbox/pruneNonCriticalCss'
import replacePageCss from './browser-sandbox/replacePageCss'
import postformatting from './postformatting/'

function blockinterceptedRequests (interceptedRequest) {
  const isJsRequest = /\.js(\?.*)?$/.test(interceptedRequest.url)
  if (isJsRequest) {
    interceptedRequest.abort()
  } else {
    interceptedRequest.continue()
  }
}

async function blockJsRequests (page) {
  await page.setRequestInterceptionEnabled(true)
  page.on('request', blockinterceptedRequests)
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
  maxEmbeddedBase64Length,
  screenshots,
  debuglog
}) {
  let _hasExited = false
  const takeScreenshots = screenshots && screenshots.basePath
  const screenshotExtension = takeScreenshots && screenshots.type === 'jpeg'
    ? '.jpg'
    : '.png'

  return new Promise(async (resolve, reject) => {
    debuglog('Penthouse core start')
    let page
    let killTimeout
    async function cleanupAndExit ({ error, returnValue }) {
      if (_hasExited) {
        return
      }
      _hasExited = true

      clearTimeout(killTimeout)
      if (page) {
        if (blockJSRequests) {
          // page request listener will continue to emit interceptedRequest
          // even after page.close, but now the continue/abort calls will throw
          // and error that cannot be caught.
          // issue on github:
          // https://github.com/GoogleChrome/puppeteer/issues/695
          // does not work
          // page.removeListener('request', blockinterceptedRequests)
        }
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
        try {
          await page.setExtraHTTPHeaders(customPageHeadersMap)
        } catch (e) {
          debuglog('failed setting extra http headers: ' + e)
        }
      }

      if (blockJSRequests) {
        // NOTE: with JS disabled we cannot use JS timers inside page.evaluate
        // (setTimeout, setInterval), however requestAnimationFrame works.
        await page.setJavaScriptEnabled(false)
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
      debuglog('page load start')
      await page.goto(url, { timeout })
      debuglog('page load DONE')

      if (!page) {
        // in case we timed out
        return
      }

      // grab a "before" screenshot - of the page fully loaded, without JS
      // TODO: could potentially do in parallel with the page.evaluate
      if (takeScreenshots) {
        debuglog('take before screenshot')
        const beforePath =
          screenshots.basePath + '-before' + screenshotExtension
        await page.screenshot({
          ...screenshots,
          path: beforePath
        })
        debuglog('take before screenshot DONE: ' + beforePath)
      }

      const criticalAstRules = await page.evaluate(pruneNonCriticalCss, {
        astRules,
        forceInclude,
        renderWaitTime
      })
      debuglog('generateCriticalCss done, now postformat')

      const formattedCss = postformatting({
        criticalAstRules,
        maxEmbeddedBase64Length,
        debuglog
      })
      debuglog('postformatting done')

      if (takeScreenshots) {
        debuglog('inline critical styles for after screenshot')
        await page.evaluate(replacePageCss, {
          css: formattedCss
        })
        debuglog('take after screenshot')
        const afterPath = screenshots.basePath + '-after' + screenshotExtension
        await page.screenshot({
          ...screenshots,
          path: afterPath
        })
        debuglog('take after screenshot DONE: ' + afterPath)
      }

      cleanupAndExit({ returnValue: formattedCss })
    } catch (e) {
      cleanupAndExit({ error: e })
    }
  })
}

export default pruneNonCriticalCssLauncher
