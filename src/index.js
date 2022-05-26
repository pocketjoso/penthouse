import fs from 'fs'
import debug from 'debug'

import generateCriticalCss from './core'
import {
  launchBrowserIfNeeded,
  closeBrowser,
  restartBrowser,
  browserIsRunning,
  getOpenBrowserPage,
  closeBrowserPage,
  addJob,
  removeJob
} from './browser'

const debuglog = debug('penthouse')

const DEFAULT_VIEWPORT_WIDTH = 1300 // px
const DEFAULT_VIEWPORT_HEIGHT = 900 // px
const DEFAULT_TIMEOUT = 30000 // ms
const DEFAULT_MAX_EMBEDDED_BASE64_LENGTH = 1000 // chars
const DEFAULT_USER_AGENT = 'Penthouse Critical Path CSS Generator'
const DEFAULT_RENDER_WAIT_TIMEOUT = 100
const DEFAULT_BLOCK_JS_REQUESTS = true
const DEFAULT_PROPERTIES_TO_REMOVE = [
  '(.*)transition(.*)',
  'cursor',
  'pointer-events',
  '(-webkit-)?tap-highlight-color',
  '(.*)user-select'
]
const _UNSTABLE_KEEP_ALIVE_MAX_KEPT_OPEN_PAGES = 4

function exitHandler (exitCode) {
  closeBrowser({ forceClose: true })
  process.exit(typeof exitCode === 'number' ? exitCode : 0)
}

function readFilePromise (filepath, encoding) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, encoding, (err, content) => {
      if (err) {
        return reject(err)
      }
      resolve(content)
    })
  })
}

function prepareForceSelectorsForSerialization (forceSelectors = []) {
  // need to annotate forceInclude values to allow RegExp to pass through JSON serialization
  return forceSelectors.map(function (forceSelectorValue) {
    if (
      typeof forceSelectorValue === 'object' &&
      forceSelectorValue.constructor.name === 'RegExp'
    ) {
      return {
        type: 'RegExp',
        source: forceSelectorValue.source,
        flags: forceSelectorValue.flags
      }
    }
    return { value: forceSelectorValue }
  })
}

// const so not hoisted, so can get regeneratorRuntime inlined above, needed for Node 4
const generateCriticalCssWrapped = async function generateCriticalCssWrapped (
  options,
  { forceTryRestartBrowser } = {}
) {
  const width = parseInt(options.width || DEFAULT_VIEWPORT_WIDTH, 10)
  const height = parseInt(options.height || DEFAULT_VIEWPORT_HEIGHT, 10)
  const timeoutWait = options.timeout || DEFAULT_TIMEOUT
  // Merge properties with default ones
  const propertiesToRemove =
    options.propertiesToRemove || DEFAULT_PROPERTIES_TO_REMOVE

  // always forceInclude '*', 'html', and 'body' selectors;
  // yields slight performance improvement
  const forceInclude = prepareForceSelectorsForSerialization(
    ['*', '*:before', '*:after', 'html', 'body'].concat(
      options.forceInclude || []
    )
  )
  const forceExclude = prepareForceSelectorsForSerialization(
    options.forceExclude || []
  )

  debuglog('call generateCriticalCssWrapped')
  let formattedCss
  let pagePromise
  try {
    pagePromise = getOpenBrowserPage()

    formattedCss = await generateCriticalCss({
      pagePromise,
      url: options.url,
      pageGotoOptions: (options.puppeteer && options.puppeteer.pageGotoOptions) || {},
      cssString: options.cssString,
      width,
      height,
      forceInclude,
      forceExclude,
      strict: options.strict,
      userAgent: options.userAgent || DEFAULT_USER_AGENT,
      renderWaitTime: options.renderWaitTime || DEFAULT_RENDER_WAIT_TIMEOUT,
      timeout: timeoutWait,
      pageLoadSkipTimeout: options.pageLoadSkipTimeout,
      blockJSRequests:
        typeof options.blockJSRequests !== 'undefined'
          ? options.blockJSRequests
          : DEFAULT_BLOCK_JS_REQUESTS,
      customPageHeaders: options.customPageHeaders,
      cookies: options.cookies,
      screenshots: options.screenshots,
      keepLargerMediaQueries: options.keepLargerMediaQueries,
      maxElementsToCheckPerSelector: options.maxElementsToCheckPerSelector,
      // postformatting
      propertiesToRemove,
      maxEmbeddedBase64Length:
        typeof options.maxEmbeddedBase64Length === 'number'
          ? options.maxEmbeddedBase64Length
          : DEFAULT_MAX_EMBEDDED_BASE64_LENGTH,
      debuglog,
      unstableKeepBrowserAlive: options.unstableKeepBrowserAlive,
      allowedResponseCode: options.allowedResponseCode,
      unstableKeepOpenPages:
        options.unstableKeepOpenPages ||
        _UNSTABLE_KEEP_ALIVE_MAX_KEPT_OPEN_PAGES,
      tryParentsDisplayNone: options.tryParentsDisplayNone || false
    })
  } catch (e) {
    const page = await pagePromise.then(({ page }) => page)
    await closeBrowserPage({
      page,
      error: e,
      unstableKeepBrowserAlive: options.unstableKeepBrowserAlive,
      unstableKeepOpenPages: options.unstableKeepOpenPages
    })

    const runningBrowswer = await browserIsRunning()
    if (!forceTryRestartBrowser && !runningBrowswer) {
      debuglog(
        'Browser unexpecedly not opened - crashed? ' +
          '\nurl: ' +
          options.url +
          '\ncss length: ' +
          options.cssString.length
      )
      await restartBrowser({
        width,
        height,
        getBrowser: options.puppeteer && options.puppeteer.getBrowser
      })
      // retry
      return generateCriticalCssWrapped(options, {
        forceTryRestartBrowser: true
      })
    }
    throw e
  }

  const page = await pagePromise.then(({ page }) => page)
  await closeBrowserPage({
    page,
    unstableKeepBrowserAlive: options.unstableKeepBrowserAlive,
    unstableKeepOpenPages: options.unstableKeepOpenPages
  })

  debuglog('generateCriticalCss done')
  if (formattedCss.trim().length === 0) {
    // TODO: would be good to surface this to user, always
    debuglog('Note: Generated critical css was empty for URL: ' + options.url)
    return ''
  }

  return formattedCss
}

module.exports = async function (options, callback) {
  process.on('exit', exitHandler)
  process.on('SIGTERM', exitHandler)
  process.on('SIGINT', exitHandler)

  addJob()
  function cleanupAndExit ({ returnValue, error = null }) {
    process.removeListener('exit', exitHandler)
    process.removeListener('SIGTERM', exitHandler)
    process.removeListener('SIGINT', exitHandler)
    removeJob()

    closeBrowser({
      unstableKeepBrowserAlive: options.unstableKeepBrowserAlive
    })

    // still supporting legacy callback way of calling Penthouse
    if (callback) {
      callback(error, returnValue)
      return
    }
    if (error) {
      throw error
    } else {
      return returnValue
    }
  }

  // support legacy mode of passing in css file path instead of string
  if (!options.cssString && options.css) {
    try {
      const cssString = await readFilePromise(options.css, 'utf8')
      options = Object.assign({}, options, { cssString })
    } catch (err) {
      debuglog('error reading css file: ' + options.css + ', error: ' + err)
      return cleanupAndExit({ error: err })
    }
  }
  if (!options.cssString) {
    debuglog('Passed in css is empty')
    return cleanupAndExit({ error: new Error('css should not be empty') })
  }

  const width = parseInt(options.width || DEFAULT_VIEWPORT_WIDTH, 10)
  const height = parseInt(options.height || DEFAULT_VIEWPORT_HEIGHT, 10)
  try {
    // launch the browser
    await launchBrowserIfNeeded({
      getBrowser: options.puppeteer && options.puppeteer.getBrowser,
      width,
      height
    })
    const criticalCss = await generateCriticalCssWrapped(options)
    return cleanupAndExit({ returnValue: criticalCss })
  } catch (err) {
    return cleanupAndExit({ error: err })
  }
}
