import fs from 'fs'
import puppeteer from 'puppeteer'
import debug from 'debug'

import generateCriticalCss from './core'

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
const DEFAULT_PUPPETEER_LAUNCH_ARGS = [
  '--disable-setuid-sandbox',
  '--no-sandbox',
  '--ignore-certificate-errors'
  // better for Docker:
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
  // (however caused memory leaks in Penthouse when testing in Ubuntu, hence disabled)
  // '--disable-dev-shm-usage'
]

function exitHandler () {
  if (browser && browser.close) {
    browser.close()
    browser = null
  }
  process.exit(0)
}

// shared between penthouse calls
let browser = null
let _browserLaunchPromise = null
// browser.pages is not implemented, so need to count myself to not close browser
// until all pages used by penthouse are closed (i.e. individual calls are done)
let _browserPagesOpen = 0
const launchBrowserIfNeeded = async function ({ getBrowser }) {
  if (browser) {
    return
  }
  if (
    getBrowser &&
    typeof getBrowser === 'function' &&
    !_browserLaunchPromise
  ) {
    _browserLaunchPromise = getBrowser()
  }
  if (!_browserLaunchPromise) {
    debuglog('no browser instance, launching new browser..')
    _browserLaunchPromise = puppeteer
      .launch({
        ignoreHTTPSErrors: true,
        args: DEFAULT_PUPPETEER_LAUNCH_ARGS
      })
      .then(browser => {
        debuglog('new browser launched')
        return browser
      })
  }
  browser = await _browserLaunchPromise
  _browserLaunchPromise = null
}

async function browserIsRunning () {
  try {
    // will throw 'Not opened' error if browser is not running
    await browser.version()
    return true
  } catch (e) {
    return false
  }
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

function prepareForceIncludeForSerialization (forceInclude = []) {
  // need to annotate forceInclude values to allow RegExp to pass through JSON serialization
  return forceInclude.map(function (forceIncludeValue) {
    if (
      typeof forceIncludeValue === 'object' &&
      forceIncludeValue.constructor.name === 'RegExp'
    ) {
      return {
        type: 'RegExp',
        source: forceIncludeValue.source,
        flags: forceIncludeValue.flags
      }
    }
    return { value: forceIncludeValue }
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
  const forceInclude = prepareForceIncludeForSerialization(
    ['*', 'html', 'body'].concat(options.forceInclude || [])
  )

  // promise so we can handle errors and reject,
  // instead of throwing what would otherwise be uncaught errors in node process
  return new Promise(async (resolve, reject) => {
    const cleanupAndExit = ({ returnValue, error }) => {
      process.removeListener('exit', exitHandler)
      process.removeListener('SIGTERM', exitHandler)
      process.removeListener('SIGINT', exitHandler)

      if (error) {
        reject(error)
      } else {
        resolve(returnValue)
      }
    }

    debuglog('call generateCriticalCssWrapped')
    let formattedCss
    try {
      _browserPagesOpen++
      debuglog(
        'adding browser page for generateCriticalCss, now: ' + _browserPagesOpen
      )
      formattedCss = await generateCriticalCss({
        browser,
        url: options.url,
        cssString: options.cssString,
        width,
        height,
        forceInclude,
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
        screenshots: options.screenshots,
        keepLargerMediaQueries: options.keepLargerMediaQueries,
        // postformatting
        propertiesToRemove,
        maxEmbeddedBase64Length:
          typeof options.maxEmbeddedBase64Length === 'number'
            ? options.maxEmbeddedBase64Length
            : DEFAULT_MAX_EMBEDDED_BASE64_LENGTH,
        debuglog,
        unstableKeepBrowserAlive: options.unstableKeepBrowserAlive
      })
      _browserPagesOpen--
      debuglog(
        'remove browser page for generateCriticalCss, now: ' + _browserPagesOpen
      )
    } catch (e) {
      _browserPagesOpen--
      debuglog(
        'remove browser page for generateCriticalCss after ERROR, now: ' +
          _browserPagesOpen
      )
      const runningBrowswer = await browserIsRunning()
      if (!forceTryRestartBrowser && !runningBrowswer) {
        debuglog(
          'Chromium unexpecedly not opened - crashed? ' +
            '\n_browserPagesOpen: ' +
            (_browserPagesOpen + 1) +
            '\nurl: ' +
            options.url +
            '\ncss length: ' +
            options.cssString.length
        )
        // for some reason Chromium is no longer opened;
        // perhaps it crashed
        if (_browserLaunchPromise) {
          // in this case the browser is already restarting
          await _browserLaunchPromise
        } else if (!(options.puppeteer && options.puppeteer.getBrowser)) {
          console.log(
            'restarting chrome after crash, current job url is: ' + options.url
          )
          browser = null
          await launchBrowserIfNeeded({})
        }
        // retry
        resolve(
          generateCriticalCssWrapped(options, {
            forceTryRestartBrowser: true
          })
        )
        return
      }
      cleanupAndExit({ error: e })
      return
    }
    debuglog('generateCriticalCss done')
    if (formattedCss.trim().length === 0) {
      // TODO: would be good to surface this to user, always
      debuglog('Note: Generated critical css was empty for URL: ' + options.url)
      cleanupAndExit({ returnValue: '' })
      return
    }

    cleanupAndExit({ returnValue: formattedCss })
  })
}

module.exports = function (options, callback) {
  process.on('exit', exitHandler)
  process.on('SIGTERM', exitHandler)
  process.on('SIGINT', exitHandler)

  return new Promise(async (resolve, reject) => {
    const cleanupAndExit = ({ returnValue, error = null }) => {
      if (browser && !options.unstableKeepBrowserAlive) {
        if (_browserPagesOpen > 0) {
          debuglog(
            'keeping browser open as _browserPagesOpen: ' + _browserPagesOpen
          )
        } else {
          browser.close()
          browser = null
          _browserLaunchPromise = null
          debuglog('closed browser')
        }
      }

      // still supporting legacy callback way of calling Penthouse
      if (callback) {
        callback(error, returnValue)
        return
      }
      if (error) {
        reject(error)
      } else {
        resolve(returnValue)
      }
    }

    // support legacy mode of passing in css file path instead of string
    if (!options.cssString && options.css) {
      try {
        const cssString = await readFilePromise(options.css, 'utf8')
        options = Object.assign({}, options, { cssString })
      } catch (err) {
        debuglog('error reading css file: ' + options.css + ', error: ' + err)
        cleanupAndExit({ error: err })
        return
      }
    }
    if (!options.cssString) {
      debuglog('Passed in css is empty')
      cleanupAndExit({ error: new Error('css should not be empty') })
      return
    }

    await launchBrowserIfNeeded({
      getBrowser: options.puppeteer && options.puppeteer.getBrowser
    })
    try {
      const criticalCss = await generateCriticalCssWrapped(options)
      cleanupAndExit({ returnValue: criticalCss })
    } catch (err) {
      cleanupAndExit({ error: err })
    }
  })
}
