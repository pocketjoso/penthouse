import puppeteer from 'puppeteer'

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
  debuglog('Penthouse core start')

  // launch browser - todo - consider reusing instances
  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    args: ['--disable-setuid-sandbox', '--no-sandbox']
  })
  debuglog('browser launched')

  const page = await browser.newPage()
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

  await page.goto(url, {
    timeout
  })
  debuglog('page loaded')

  const criticalRules = await page.evaluate(pruneNonCriticalCss, {
    astRules,
    forceInclude,
    renderWaitTime
  })

  debuglog('GENERATION_DONE')

  // cleanup
  browser.close()

  return criticalRules
}

export default pruneNonCriticalCssLauncher
