import csstree from 'css-tree'
import debug from 'debug'
import pruneNonCriticalSelectors
  from './browser-sandbox/pruneNonCriticalSelectors'
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
  let waitingForPageLoad = true
  const loadPagePromise = page.goto(url, { timeout: timeout + 1000 })
  if (pageLoadSkipTimeout) {
    await Promise.race([
      loadPagePromise,
      new Promise(resolve => {
        // instead we manually _abort_ page load after X time,
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
  } else {
    await loadPagePromise
  }
  waitingForPageLoad = false
  debuglog('page load DONE')
}

async function blockJsRequests (page) {
  await page.setRequestInterceptionEnabled(true)
  page.on('request', blockinterceptedRequests)
}

async function astFromCss ({ cssString, strict }) {
  // breaks puppeteer
  const css = cssString.replace(/￿/g, '\f042')

  let parsingErrors = []
  debuglog('parse ast START')
  let ast = csstree.parse(css, {
    onParseError: error => parsingErrors.push(error.formattedMessage)
  })
  debuglog(`parsed ast (with ${parsingErrors.length} errors)`)

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
  blockJSRequests
}) {
  debuglog('preparePage START')
  page = await browser.newPage()
  debuglog('new page opened in browser')

  await page.setViewport({ width, height })
  debuglog('viewport set')

  await page.setUserAgent(userAgent)

  if (customPageHeaders) {
    try {
      debuglog('set custom headers')
      await page.setExtraHTTPHeaders(customPageHeaders)
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
    const text = msg.text || msg
    // pass through log messages
    // - the ones sent by penthouse for debugging has 'debug: ' prefix.
    if (/^debug: /.test(text)) {
      debuglog(text.replace(/^debug: /, ''))
    }
  })
  debuglog('preparePage DONE')
  return page
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
  keepLargerMediaQueries
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
      // page.close will error if page/browser has already been closed;
      // try to avoid
      if (page && !(error && error.toString().indexOf('Target closed') > -1)) {
        // must await here, otherwise will receive errors if closing
        // browser before page is properly closed
        await page.close()
      }
      debuglog('cleanupAndExit')
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
      // prepare (puppeteer) page in parallel with ast parsing,
      // as operations are independent and both expensive
      // (ast parsing primarily on larger stylesheets)
      const [updatedPage, ast] = await Promise.all([
        preparePage({
          page,
          width,
          height,
          browser,
          userAgent,
          customPageHeaders,
          blockJSRequests
        }),
        astFromCss({
          cssString,
          strict
        })
      ])
      page = updatedPage

      // first strip out non matching media queries.
      // Need to be done before buildSelectorProfile;
      // although could shave of further time via doing it as part of buildSelectorProfile..
      nonMatchingMediaQueryRemover(ast, width, height, keepLargerMediaQueries)
      debuglog('stripped out non matching media queries')

      // load the page (slow)
      // in parallel with preformatting the css
      // - for improved performance
      const [, { selectorNodeMap, selectors }] = await Promise.all([
        loadPage(page, url, timeout, pageLoadSkipTimeout),
        buildSelectorProfile(ast, forceInclude)
      ])

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

      const criticalSelectors = await page.evaluate(pruneNonCriticalSelectors, {
        selectors,
        renderWaitTime
      })

      debuglog('pruneNonCriticalSelectors done, now cleanup AST')

      cleanupAst({
        ast,
        selectorNodeMap,
        criticalSelectors,
        propertiesToRemove,
        maxEmbeddedBase64Length
      })
      debuglog('AST cleanup done')

      const css = csstree.generate(ast)
      debuglog('generate CSS from AST')

      if (takeScreenshots) {
        debuglog('inline critical styles for after screenshot')
        await page.evaluate(replacePageCss, { css })
        debuglog('take after screenshot')
        const afterPath = screenshots.basePath + '-after' + screenshotExtension
        await page.screenshot({
          ...screenshots,
          path: afterPath
        })
        debuglog('take after screenshot DONE: ' + afterPath)
      }

      debuglog('generateCriticalCss DONE')

      cleanupAndExit({ returnValue: css })
    } catch (e) {
      cleanupAndExit({ error: e })
    }
  })
}

export default pruneNonCriticalCssLauncher
