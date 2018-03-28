import csstree from 'css-tree'
import debug from 'debug'
import pruneNonCriticalSelectors from './browser-sandbox/pruneNonCriticalSelectors'
import pageLoadSkipTimeoutFunc from './browser-sandbox/pageLoadSkipTimeout'
import replacePageCss from './browser-sandbox/replacePageCss'
import cleanupAst from './postformatting'
import buildSelectorProfile from './selectors-profile'
import nonMatchingMediaQueryRemover from './non-matching-media-query-remover'

const debuglog = debug('penthouse:core')

function blockinterceptedRequests (interceptedRequest) {
  const isJsRequest = /\.js(\?.*)?$/.test(interceptedRequest.url)
  if (isJsRequest) {
    interceptedRequest.abort()
  } else {
    interceptedRequest.continue()
  }
}

async function loadPage (page, url, timeout, pageLoadSkipTimeout) {
  debuglog('page load start')
  // set a higher number than the timeout option, in order to make
  // puppeteer’s timeout _never_ happen
  let _hasLoaded = false
  let pageLoadSkipTimeoutPromise = null
  const loadPagePromise = new Promise((resolve, reject) => {
    page
      .goto(url, {
        timeout: timeout + 1000
      })
      .then(response => {
        // Reject exits the Promise.all call immediately and ensures that the pageload is always higher prio than timout
        _hasLoaded = true
        return resolve('loadPageResponse')
      })
      .catch(err => {
        // Reject when error because we don't want an errored page
        console.error(err)
        return reject(err)
      })
  })

  if (pageLoadSkipTimeout) {
    pageLoadSkipTimeoutPromise = new Promise((resolve, reject) => {
      // enables us to control requests(stop, continue, modify)
      page.on('response', async response => {
        if (response.url === url) {
          debuglog('RESPONSE URL: ' + response.url) // TODO: interceptedRequest.url is a function in puppeteer > 0.12
          if (pageLoadSkipTimeout) {
            debuglog('pageLoadSkipTimeout injected on dom creation')
            // This is crucial for the evaluate to work. If this is not set we got an error:
            // ERROR Error: Protocol error (Runtime.callFunctionOn): Cannot find context with specified id undefined
            // Maybe this should be evaluated on low power machines if they need 100ms
            await page.waitFor(500)
            page
              .evaluate(pageLoadSkipTimeoutFunc, {
                pageLoadSkipTimeout
              })
              .then(message => {
                if (!_hasLoaded) {
                  // when pageLoadSkipTimeout is reached after dom request
                  // don't resolve when page already loaded completely
                  debuglog(
                    'pageLoadSkipTimeout - page load waiting ABORTED after ' +
                      pageLoadSkipTimeout / 1000 +
                      's. '
                  )
                  return resolve('pageLoadSkipTimeout')
                }
              })
              .catch(err => {
                if (!err.message.includes('Target closed')) {
                  debuglog('page.evaluate - ERROR', err)
                  return reject(err)
                }
              })
          }
        }
      })
    })

    try {
      let raceResult = await Promise.race([
        pageLoadSkipTimeoutPromise,
        loadPagePromise
      ])
      debuglog('RACE RESULT: ', raceResult)
    } catch (err) {
      debuglog('RACE RESULT ERROR: ', err)
      throw new Error(err)
    }

    await Promise.race([pageLoadSkipTimeoutPromise, loadPagePromise])
  } else {
    await loadPagePromise
  }
  debuglog('page load DONE')
}

function setupBlockJsRequests (page) {
  page.on('request', blockinterceptedRequests)
  return page.setRequestInterception(true)
}

async function astFromCss ({ cssString, strict }) {
  // breaks puppeteer
  const css = cssString.replace(/￿/g, '\f042')

  let parsingErrors = []
  debuglog('parse ast START')
  let ast = csstree.parse(css, {
    onParseError: error => parsingErrors.push(error.formattedMessage)
  })
  debuglog(`parse ast DONE (with ${parsingErrors.length} errors)`)

  if (parsingErrors.length && strict === true) {
    // NOTE: only informing about first error, even if there were more than one.
    const parsingErrorMessage = parsingErrors[0]
    throw new Error(
      `AST parser (css-tree) found ${parsingErrors.length} errors in CSS.
      Breaking because in strict mode.
      The first error was:
      ` + parsingErrorMessage
    )
  }
  return ast
}

async function preparePage ({
  page,
  width,
  height,
  browser,
  userAgent,
  customPageHeaders,
  blockJSRequests,
  cleanupAndExit,
  getHasExited
}) {
  debuglog('preparePage START')
  try {
    page = await browser.newPage()
  } catch (e) {
    if (getHasExited()) {
      // we already exited (strict mode css parsing erros)
      // - ignore
    } else {
      debuglog('unexpted: could not open browser page' + e)
    }
    return
  }
  debuglog('new page opened in browser')

  const setViewportPromise = page
    .setViewport({ width, height })
    .then(() => debuglog('viewport set'))
  const setUserAgentPromise = page
    .setUserAgent(userAgent)
    .then(() => debuglog('userAgent set'))

  let setCustomPageHeadersPromise
  if (customPageHeaders) {
    try {
      setCustomPageHeadersPromise = page
        .setExtraHTTPHeaders(customPageHeaders)
        .then(() => debuglog('customPageHeaders set'))
    } catch (e) {
      debuglog('failed setting extra http headers: ' + e)
    }
  }

  let blockJSRequestsPromise
  if (blockJSRequests) {
    // NOTE: with JS disabled we cannot use JS timers inside page.evaluate
    // (setTimeout, setInterval), however requestAnimationFrame works.
    blockJSRequestsPromise = Promise.all([
      page.setJavaScriptEnabled(false),
      setupBlockJsRequests(page)
    ]).then(() => {
      debuglog('blocking js requests DONE')
    })
  }

  page.on('error', error => {
    debuglog('page crashed: ' + error)
    cleanupAndExit({ error })
  })
  page.on('console', msg => {
    const text = msg.text || msg
    // pass through log messages
    // - the ones sent by penthouse for debugging has 'debug: ' prefix.
    if (/^debug: /.test(text)) {
      debuglog(text.replace(/^debug: /, ''))
    }
  })
  debuglog('page event listeners set')

  return Promise.all([
    setViewportPromise,
    setUserAgentPromise,
    setCustomPageHeadersPromise,
    blockJSRequestsPromise
  ]).then(() => {
    debuglog('preparePage DONE')
    return page
  })
}

async function grabPageScreenshot ({
  type,
  page,
  screenshots,
  screenshotExtension,
  debuglog
}) {
  const path = screenshots.basePath + `-${type}` + screenshotExtension
  debuglog(`take ${type} screenshot, START`)
  return page
    .screenshot({
      ...screenshots,
      path
    })
    .then(() => debuglog(`take ${type} screenshot DONE, path: ${path}`))
}

async function pruneNonCriticalCssLauncher ({
  browser,
  url,
  cssString,
  width,
  height,
  forceInclude,
  strict,
  userAgent,
  renderWaitTime,
  timeout,
  pageLoadSkipTimeout,
  blockJSRequests,
  customPageHeaders,
  screenshots,
  propertiesToRemove,
  maxEmbeddedBase64Length,
  keepLargerMediaQueries,
  unstableKeepBrowserAlive
}) {
  let _hasExited = false

  // hacky to get around _hasExited only available in the scope of this function
  const getHasExited = () => _hasExited

  const takeScreenshots = screenshots && screenshots.basePath
  const screenshotExtension =
    takeScreenshots && screenshots.type === 'jpeg' ? '.jpg' : '.png'

  return new Promise(async (resolve, reject) => {
    debuglog('Penthouse core start')
    let page
    let killTimeout

    async function cleanupAndExit ({ error, returnValue }) {
      if (_hasExited) {
        return
      }
      debuglog('cleanupAndExit start')
      _hasExited = true

      clearTimeout(killTimeout)
      // page.close will error if page/browser has already been closed;
      // try to avoid
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
      debuglog('cleanupAndExit end')
      if (error) {
        return reject(error)
      }
      return resolve(returnValue)
    }

    killTimeout = setTimeout(() => {
      cleanupAndExit({
        error: new Error('Penthouse timed out after ' + timeout / 1000 + 's. ')
      })
    }, timeout)

    // 1. start preparing a browser page (tab) [NOT BLOCKING]
    const updatedPagePromise = preparePage({
      page,
      width,
      height,
      browser,
      userAgent,
      customPageHeaders,
      blockJSRequests,
      cleanupAndExit,
      getHasExited
    })

    // 2. parse ast
    // -> [BLOCK FOR] AST parsing
    let ast
    try {
      ast = await astFromCss({
        cssString,
        strict
      })
    } catch (e) {
      cleanupAndExit({ error: e })
      return
    }

    // 3. Further process the ast [BLOCKING]
    // Strip out non matching media queries.
    // Need to be done before buildSelectorProfile;
    // (very fast but could be done together/in parallel in future)
    nonMatchingMediaQueryRemover(ast, width, height, keepLargerMediaQueries)
    debuglog('stripped out non matching media queries')

    // -> [BLOCK FOR] page preparation
    page = await updatedPagePromise

    // load the page (slow) [NOT BLOCKING]
    let loadPagePromise = null
    try {
      loadPagePromise = loadPage(page, url, timeout, pageLoadSkipTimeout)
    } catch (err) {
      cleanupAndExit({ error: err })
    }

    // turn css to formatted selectorlist [NOT BLOCKING]
    debuglog('turn css to formatted selectorlist START')
    const buildSelectorProfilePromise = buildSelectorProfile(
      ast,
      forceInclude
    ).then(res => {
      debuglog('turn css to formatted selectorlist DONE')
      return res
    })

    // -> [BLOCK FOR] page load
    try {
      await loadPagePromise
    } catch (e) {
      cleanupAndExit({ error: e })
      return
    }
    if (!page) {
      // in case we timed out
      debuglog('page load TIMED OUT')
      cleanupAndExit({ error: new Error('Page load timed out') })
      return
    }

    // take before screenshot (optional) [NOT BLOCKING]
    const beforeScreenshotPromise = takeScreenshots
      ? grabPageScreenshot({
        type: 'before',
        page,
        screenshots,
        screenshotExtension,
        debuglog
      })
      : Promise.resolve()

    // -> [BLOCK FOR] css into formatted selectors list with "sourcemap"
    // latter used to map back to full css rule
    const { selectors, selectorNodeMap } = await buildSelectorProfilePromise

    // -> [BLOCK FOR] critical css selector pruning (in browser)
    let criticalSelectors
    try {
      await page.waitFor(500)
      criticalSelectors = await page
        .evaluate(pruneNonCriticalSelectors, {
          selectors,
          renderWaitTime
        })
        .then(criticalSelectors => {
          debuglog('pruneNonCriticalSelectors done')
          return criticalSelectors
        })
    } catch (err) {
      debuglog('pruneNonCriticalSelector threw an error: ' + err)
      cleanupAndExit({ error: err })
      return
    }

    // take after screenshot (optional) [NOT BLOCKING]
    let afterScreenshotPromise
    if (takeScreenshots) {
      // wait for the before screenshot, before start modifying the page
      afterScreenshotPromise = beforeScreenshotPromise.then(() => {
        debuglog('inline critical styles for after screenshot')
        return page.evaluate(replacePageCss, { css }).then(() => {
          return grabPageScreenshot({
            type: 'after',
            page,
            screenshots,
            screenshotExtension,
            debuglog
          })
        })
      })
    }

    // -> [BLOCK FOR] clean up final ast for critical css
    debuglog('AST cleanup START')
    // NOTE: this function mutates the AST
    cleanupAst({
      ast,
      selectorNodeMap,
      criticalSelectors,
      propertiesToRemove,
      maxEmbeddedBase64Length
    })
    debuglog('AST cleanup DONE')

    // -> [BLOCK FOR] generate final critical css from critical ast
    const css = csstree.generate(ast)
    debuglog('generated CSS from AST')

    // -> [BLOCK FOR] take after screenshot (optional)
    await afterScreenshotPromise
    debuglog('generateCriticalCss DONE')

    cleanupAndExit({ returnValue: css })
  })
}

export default pruneNonCriticalCssLauncher
