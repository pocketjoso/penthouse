import csstree from 'css-tree'
import debug from 'debug'
import pruneNonCriticalSelectors from './browser-sandbox/pruneNonCriticalSelectors'
import replacePageCss from './browser-sandbox/replacePageCss'
import cleanupAst from './postformatting'
import buildSelectorProfile from './selectors-profile'
import nonMatchingMediaQueryRemover from './non-matching-media-query-remover'

const debuglog = debug('penthouse:core')

const PUPPETEER_PAGE_UNLOADED_DURING_EXECUTION_ERROR_REGEX = /(Cannot find context with specified id|Execution context was destroyed)/
export const PAGE_UNLOADED_DURING_EXECUTION_ERROR_MESSAGE =
  'PAGE_UNLOADED_DURING_EXECUTION: Critical css generation script could not be executed.\n\nThis can happen if Penthouse was killed during execution, OR otherwise most commonly if the page navigates away after load, via setting window.location, meta tag refresh directive or similar. For the critical css generation to work the loaded page must stay: remove any redirects or move them to the server. You can also disable them on your end just for the critical css generation, for example via a query parameter.'

function blockinterceptedRequests (interceptedRequest) {
  const isJsRequest = /\.js(\?.*)?$/.test(interceptedRequest.url)
  if (isJsRequest) {
    interceptedRequest.abort()
  } else {
    interceptedRequest.continue()
  }
}

function loadPage (page, url, timeout, pageLoadSkipTimeout) {
  debuglog('page load start')
  let waitingForPageLoad = true
  let loadPagePromise = page.goto(url)
  if (pageLoadSkipTimeout) {
    loadPagePromise = Promise.race([
      loadPagePromise,
      new Promise(resolve => {
        // _abort_ page load after X time,
        // in order to deal with spammy pages that keep sending non-critical requests
        // (tracking etc), which would otherwise never load.
        // With JS disabled it just shouldn't take that many seconds to load what's needed
        // for critical viewport.
        setTimeout(() => {
          if (waitingForPageLoad) {
            debuglog(
              'page load waiting ABORTED after ' +
                pageLoadSkipTimeout / 1000 +
                's. '
            )
            resolve()
          }
        }, pageLoadSkipTimeout)
      })
    ])
  }
  return loadPagePromise.then(() => {
    waitingForPageLoad = false
    debuglog('page load DONE')
  })
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
  pagePromise,
  width,
  height,
  userAgent,
  customPageHeaders,
  blockJSRequests,
  cleanupAndExit,
  getHasExited
}) {
  let reusedPage
  try {
    const pagePromiseResult = await pagePromise
    page = pagePromiseResult.page
    reusedPage = pagePromiseResult.reused
  } catch (e) {
    debuglog('unexpected: could not get an open browser page' + e)
    return
  }
  // we already exited while page was opening, stop execution
  // (strict mode ast css parsing erros)
  if (getHasExited()) {
    return
  }
  debuglog('open page ready in browser')

  // We set the viewport size in the browser when it launches,
  // and then re-use it for each page (to avoid extra work).
  // Only if later pages use a different viewport size do we need to
  // update it here.
  let setViewportPromise = Promise.resolve()
  const currentViewport = page.viewport()
  if (currentViewport.width !== width || currentViewport.height !== height) {
    setViewportPromise = page
      .setViewport({ width, height })
      .then(() => debuglog('viewport size updated'))
  }

  const setUserAgentPromise = page
    .setUserAgent(userAgent)
    .then(() => debuglog('userAgent set'))

  let setCustomPageHeadersPromise = Promise.resolve()
  if (customPageHeaders) {
    try {
      setCustomPageHeadersPromise = page
        .setExtraHTTPHeaders(customPageHeaders)
        .then(() => debuglog('customPageHeaders set'))
    } catch (e) {
      debuglog('failed setting extra http headers: ' + e)
    }
  }

  // assumes the page was already configured from previous call!
  if (reusedPage) {
    return Promise.all([
      setViewportPromise,
      setUserAgentPromise,
      setCustomPageHeadersPromise
    ]).then(() => {
      debuglog('preparePage DONE')
      return page
    })
  }

  // disable Puppeteer navigation timeouts;
  // Penthouse tracks these internally instead.
  page.setDefaultNavigationTimeout(0)

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
    const text = msg.text
      ? typeof msg.text === 'function'
        ? msg.text()
        : msg.text
      : msg
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
  pagePromise,
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
  maxElementsToCheckPerSelector,
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
      debuglog('cleanupAndExit')
      _hasExited = true
      clearTimeout(killTimeout)

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
      pagePromise,
      width,
      height,
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
    if (!page) {
      cleanupAndExit({ error: 'Could not open page in browser' })
      return
    }

    // load the page (slow) [NOT BLOCKING]
    const loadPagePromise = loadPage(page, url, timeout, pageLoadSkipTimeout)
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

    // give some time (renderWaitTime) for sites like facebook that build their page dynamically,
    // otherwise we can miss some selectors (and therefor rules)
    // --tradeoff here: if site is too slow with dynamic content,
    // it doesn't deserve to be in critical path.
    const renderWaitPromise = new Promise(resolve => {
      setTimeout(() => {
        debuglog('waited for renderWaitTime: ' + renderWaitTime)
        resolve()
      }, renderWaitTime)
    })

    // -> [BLOCK FOR] css into formatted selectors list with "sourcemap"
    // latter used to map back to full css rule
    const { selectors, selectorNodeMap } = await buildSelectorProfilePromise

    // -> [BLOCK FOR] renderWaitTime
    await renderWaitPromise

    if (getHasExited()) {
      return
    }

    // -> [BLOCK FOR] critical css selector pruning (in browser)
    let criticalSelectors
    try {
      criticalSelectors = await page
        .evaluate(pruneNonCriticalSelectors, {
          selectors,
          renderWaitTime,
          maxElementsToCheckPerSelector
        })
        .then(criticalSelectors => {
          debuglog('pruneNonCriticalSelectors done')
          return criticalSelectors
        })
    } catch (err) {
      debuglog('pruneNonCriticalSelector threw an error: ' + err)
      const errorDueToPageUnloaded = PUPPETEER_PAGE_UNLOADED_DURING_EXECUTION_ERROR_REGEX.test(
        err
      )
      cleanupAndExit({
        error: errorDueToPageUnloaded
          ? new Error(PAGE_UNLOADED_DURING_EXECUTION_ERROR_MESSAGE)
          : err
      })
      return
    }
    if (getHasExited()) {
      return
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

    // take after screenshot (optional) [BLOCKING]
    if (takeScreenshots) {
      // wait for the before screenshot, before start modifying the page
      await beforeScreenshotPromise
      debuglog('inline critical styles for after screenshot')
      await page.evaluate(replacePageCss, { css }).then(() => {
        return grabPageScreenshot({
          type: 'after',
          page,
          screenshots,
          screenshotExtension,
          debuglog
        })
      })
    }
    debuglog('generateCriticalCss DONE')

    cleanupAndExit({ returnValue: css })
  })
}

export default pruneNonCriticalCssLauncher
