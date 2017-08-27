import pruneNonCriticalCss from './browser-sandbox/pruneNonCriticalCss'

async function blockJsRequests (page) {
  await page.setRequestInterceptionEnabled(true)
  page.on('request', interceptedRequest => {
    if (interceptedRequest.url.endsWith('.js')) {
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
  customPageHeaders = {},
  debuglog
}) {
  return new Promise(async (resolve, reject) => {
    debuglog('Penthouse core start')
    let page
    let killTimeout
    async function cleanupAndExit ({error, returnValue}) {
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
      cleanupAndExit({error: new Error('Penthouse timed out after ' + timeout / 1000 + 's. ')})
    }, timeout)

    try {
      page = await browser.newPage()
      debuglog('new page opened in browser')

      await page.setViewport({ width, height })
      debuglog('viewport set')

      if (blockJSRequests) {
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

      await page.goto(url, {timeout})
      debuglog('page loaded')

      const criticalRules = await page.evaluate(pruneNonCriticalCss, {
        astRules,
        forceInclude,
        renderWaitTime
      })

      debuglog('GENERATION_DONE')
      cleanupAndExit({returnValue: criticalRules})
    } catch (e) {
      cleanupAndExit({error: e})
    }
  })
}

export default pruneNonCriticalCssLauncher
