import fs from 'fs'
import csstree from 'css-tree'
import debug from 'debug'
import pruneNonCriticalCss from './browser-sandbox/pruneNonCriticalCss'
import replacePageCss from './browser-sandbox/replacePageCss'
import postformatting from './postformatting/'

const debuglog = debug('penthouse:core')

const CSSTREE_DIST_PATH = require.resolve('css-tree/dist/csstree')

const cssTreeContentPromise = new Promise(resolve => {
  fs.readFile(CSSTREE_DIST_PATH, 'utf8', (err, content) => {
    if (err) {
      throw err
    }
    resolve(content)
  })
})

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
  renderWaitTime,
  timeout,
  pageLoadSkipTimeout,
  blockJSRequests,
  customPageHeaders,
  screenshots,
  propertiesToRemove,
  maxEmbeddedBase64Length
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

      if (!page) {
        // in case we timed out
        return
      }

      await cssTreeContentPromise.then(content => {
        page.evaluate(content)
      })
      debuglog('added css-tree library to page')

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

      const astRulesCritical = await page.evaluate(pruneNonCriticalCss, {
        astRules,
        forceInclude,
        renderWaitTime
      })
      debuglog('generateCriticalCss done, now postformat')

      const formattedAstRules = postformatting({
        astRulesCritical,
        propertiesToRemove,
        maxEmbeddedBase64Length
      })
      debuglog('postformatting done')

      const finalAst = csstree.fromPlainObject({
        type: 'StyleSheet',
        children: formattedAstRules
      })
      const formattedCss = csstree.translate(finalAst)
      debuglog('stringify from ast')

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
