import csstree from 'css-tree'
import debug from 'debug'
import pruneNonCriticalSelectors from './browser-sandbox/pruneNonCriticalSelectors'
import pageLoadSkipTimeoutFunc from './browser-sandbox/pageLoadSkipTimeout'
import replacePageCss from './browser-sandbox/replacePageCss'
import cleanupAst from './postformatting'
import buildSelectorProfile from './selectors-profile'

const debuglog = debug('penthouse:core')

function blockinterceptedRequests (interceptedRequest) {
  const isJsRequest = /\.js(\?.*)?$/.test(interceptedRequest.url)
  if (isJsRequest) {
    interceptedRequest.abort()
  } else {
    interceptedRequest.continue()
  }
}

async function blockJsRequests (page) {
  await page.setRequestInterceptionEnabled(true) // TODO: Rename to "setRequestInterception" when updating puppeteer > 0.12
  page.on('request', blockinterceptedRequests)
}

async function pruneNonCriticalCssLauncher ({
  browser,
  url,
  ast,
  width,
  height,
  forceInclude,
  userAgent,
  renderWaitTime,
  timeout,
  pageLoadSkipTimeout,
  blockJSRequests,
  customPageHeaders,
  screenshots,
  propertiesToRemove,
  maxEmbeddedBase64Length
}) {
  let _hasError = false
  let _hasExited = false
  let _hasLoaded = false
  const takeScreenshots = screenshots && screenshots.basePath
  const screenshotExtension =
    takeScreenshots && screenshots.type === 'jpeg' ? '.jpg' : '.png'

  return new Promise(async (resolve, reject) => {
    debuglog('Penthouse core start')
    let page
    let killTimeout
    async function cleanupAndExit ({ error, returnValue }) {
      debuglog('cleanupAndExit start')
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
        debuglog('cleanupAndExit -> Target not closed -> closing page')
        // Without try catch we are crashing penthouse and
        // being unable to restart
        try {
          await page.close()
        } catch (err) {
          // console.error(err) // Information is not needed at all
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

    try {
      page = await browser.newPage()
      debuglog('new page opened in browser')

      await page.setViewport({ width, height })
      debuglog('viewport set')

      await page.setUserAgent(userAgent)

      page.on('error', error => {
        console.error('Chromium Tab CRASHED', error)
        page.close()
      })

      page.on('console', msg => {
        const text = msg.text || msg
        // pass through log messages
        // - the ones sent by penthouse for debugging has 'debug: ' prefix.
        if (/^debug: /.test(text)) {
          debuglog(text.replace(/^debug: /, ''))
        }
      })

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

      // Handle requests of pages and block the page from going away and losing context
      // https://github.com/pocketjoso/penthouse/issues/202
      let pageLoadSkipPromise = new Promise((resolve, reject) => {
        if (pageLoadSkipTimeout) {
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
                      _hasError = err
                      return reject(err)
                    }
                  })
              }
            }
          })
        }
      })

      debuglog('page load start')
      // set a higher number than the timeout option, in order to make
      // puppeteer’s timeout _never_ happen
      const loadPageResponse = new Promise((resolve, reject) => {
        page
          .goto(url, {
            timeout: timeout + 1000,
            waitUntil: 'networkidle'
          })
          .then(response => {
            // Reject exits the Promise.all call immediately and ensures that the pageload is always higher prio than timout
            _hasLoaded = true
            return resolve('loadPageResponse')
          })
          .catch(err => {
            _hasError = err
            // Reject when error because we don't want an errored page
            console.error(err)
            return reject(err)
          })
      })

      try {
        // Instead of race we want to use all for better workflow. Race is evil
        let raceResult = await Promise.race([
          pageLoadSkipPromise,
          loadPageResponse
        ])
        debuglog('RACE RESULT: ', raceResult)
      } catch (err) {
        debuglog('RACE RESULT ERROR: ', err)
        _hasError = err
      }

      try {
        // still waiting for the page to load
        // if we run into pageLoadSkipTimout then there will be a window.stop()
        // so this will be resolved aswell
        await loadPageResponse
        debuglog('page load DONE')
      } catch (err) {
        _hasError = err
      }

      if (!page) {
        // in case we timed out
        debuglog('page load TIMED OUT')
        return
      }

      if (_hasError) {
        debuglog('page load error')
        reject(_hasError)
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

      const { selectorNodeMap, selectors } = buildSelectorProfile(
        ast,
        forceInclude
      )
      debuglog('build selector profile')

      await page.waitFor(500)
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
