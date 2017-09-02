import fs from 'fs'
import apartment from 'apartment'
import cssAstFormatter from 'css-fork-pocketjoso'
import puppeteer from 'puppeteer'

import generateCriticalCss from './core'
import normalizeCss from './normalize-css'
import nonMatchingMediaQueryRemover from './non-matching-media-query-remover'
import postformatting from './postformatting/'

const DEFAULT_VIEWPORT_WIDTH = 1300 // px
const DEFAULT_VIEWPORT_HEIGHT = 900 // px
const DEFAULT_TIMEOUT = 30000 // ms
const DEFAULT_MAX_EMBEDDED_BASE64_LENGTH = 1000 // chars
const DEFAULT_USER_AGENT = 'Penthouse Critical Path CSS Generator'
const DEFAULT_RENDER_WAIT_TIMEOUT = 100
const DEFAULT_BLOCK_JS_REQUESTS = true

// shared between penthouse calls
let browser = null
let _browserLaunchPromise = null
// browser.pages is not implemented, so need to count myself to not close browser
// until all pages used by penthouse are closed (i.e. individual calls are done)
let _browserPagesOpen = 0
const launchBrowserIfNeeded = async function (debuglog) {
  if (browser) {
    return
  }
  if (!_browserLaunchPromise) {
    debuglog('no browser instance, launching new browser..')
    _browserLaunchPromise = puppeteer
      .launch({
        ignoreHTTPSErrors: true,
        args: ['--disable-setuid-sandbox', '--no-sandbox']
      })
      .then(browser => {
        debuglog('new browser launched')
        return browser
      })
  }
  browser = await _browserLaunchPromise
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

const astFromCss = async function astFromCss (options, { debuglog, stdErr }) {
  const css = options.cssString
  let ast = cssAstFormatter.parse(css, { silent: true })
  const parsingErrors = ast.stylesheet.parsingErrors.filter(function (err) {
    // the forked version of the astParser used fixes these errors itself
    return err.reason !== 'Extra closing brace'
  })
  if (parsingErrors.length === 0) {
    stdErr += debuglog('parsed ast (without errors)')
    return ast
  }

  // had breaking parsing errors
  // NOTE: only informing about first error, even if there were more than one.
  const parsingErrorMessage = parsingErrors[0].message
  if (options.strict === true) {
    // TODO: filename will be 'undefined', could enhance this error message
    throw new Error(parsingErrorMessage)
  }

  stdErr += debuglog(
    "Failed ast formatting css '" + parsingErrorMessage + "': "
  )

  let normalizedCss
  try {
    _browserPagesOpen++
    debuglog('adding browser page for normalize, now: ' + _browserPagesOpen)
    normalizedCss = await normalizeCss({
      css,
      browser,
      debuglog
    })
    _browserPagesOpen--
    debuglog('removing browser page for normalize, now: ' + _browserPagesOpen)
  } catch (e) {
    _browserPagesOpen--
    debuglog(
      'removing browser page for normalize after error, now: ' +
        _browserPagesOpen
    )
    throw e
  }

  stdErr += debuglog(
    'normalized css: ' +
      (normalizedCss ? normalizedCss.length : typeof normalizedCss)
  )
  if (!normalizedCss) {
    throw new Error(
      "Failed to normalize CSS errors. Run Penthouse with 'strict: true' option to see these css errors."
    )
  }
  ast = cssAstFormatter.parse(normalizedCss, { silent: true })
  stdErr += debuglog('parsed normalised css into ast')
  const finalParsingErrors = ast.stylesheet.parsingErrors.filter(function (err) {
    // the forked version of the astParser used fixes these errors itself
    return err.reason !== 'Extra closing brace'
  })
  if (finalParsingErrors.length > 0) {
    stdErr += debuglog('..with parsingErrors: ' + finalParsingErrors[0].reason)
  }
  return ast
}

// const so not hoisted, so can get regeneratorRuntime inlined above, needed for Node 4
const generateCriticalCssWrapped = async function generateCriticalCssWrapped (
  options,
  ast,
  { debuglog, stdErr, START_TIME, forceTryRestartBrowser }
) {
  const width = parseInt(options.width || DEFAULT_VIEWPORT_WIDTH, 10)
  const height = parseInt(options.height || DEFAULT_VIEWPORT_HEIGHT, 10)
  const timeoutWait = options.timeout || DEFAULT_TIMEOUT

  // first strip out non matching media queries
  const astRules = nonMatchingMediaQueryRemover(
    ast.stylesheet.rules,
    width,
    height
  )
  stdErr += debuglog('stripped out non matching media queries')

  // always forceInclude '*', 'html', and 'body' selectors
  const forceInclude = prepareForceIncludeForSerialization(
    [{ value: '*' }, { value: 'html' }, { value: 'body' }].concat(
      options.forceInclude || []
    )
  )

  // promise so we can handle errors and reject,
  // instead of throwing what would otherwise be uncaught errors in node process
  return new Promise(async (resolve, reject) => {
    const cleanupAndExit = ({ returnValue, error }) => {
      if (error) {
        reject(error)
      } else {
        resolve(returnValue)
      }
    }

    stdErr += debuglog('call generateCriticalCssWrapped')
    let criticalAstRules
    try {
      _browserPagesOpen++
      debuglog(
        'adding browser page for generateCriticalCss, now: ' + _browserPagesOpen
      )
      criticalAstRules = await generateCriticalCss({
        browser,
        url: options.url,
        astRules,
        width,
        height,
        forceInclude,
        // TODO: make use of again
        userAgent: options.userAgent || DEFAULT_USER_AGENT,
        renderWaitTime: options.renderWaitTime || DEFAULT_RENDER_WAIT_TIMEOUT,
        timeout: timeoutWait,
        blockJSRequests: options.blockJSRequests || DEFAULT_BLOCK_JS_REQUESTS,
        // TODO: make use of again
        // object, needs to be stringified
        // JSON.stringify(options.customPageHeaders || {}),
        customPageHeaders: options.customPageHeaders,
        debuglog
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
      if (!forceTryRestartBrowser && e.message.indexOf('not opened') > -1) {
        debuglog('Chrominium unexpecedly not opened - restart')
        // for some reason Chrominium is no longer opened;
        // perhaps it crashed
        browser = null
        _browserLaunchPromise = null
        await launchBrowserIfNeeded(debuglog)
        // retry
        return generateCriticalCssWrapped(options, ast, {
          debuglog,
          stdErr,
          START_TIME,
          forceTryRestartBrowser
        })
      }
      stdErr += e
      const err = new Error(stdErr)
      err.stderr = stdErr
      cleanupAndExit({ error: err })
      return
    }

    stdErr += debuglog('generateCriticalCss done, now postformat')
    let formattedCss
    try {
      formattedCss = postformatting(
        criticalAstRules,
        {
          maxEmbeddedBase64Length: typeof options.maxEmbeddedBase64Length ===
            'number'
            ? options.maxEmbeddedBase64Length
            : DEFAULT_MAX_EMBEDDED_BASE64_LENGTH
        },
        m.DEBUG,
        START_TIME
      )
    } catch (e) {
      cleanupAndExit({ error: e })
      return
    }

    if (formattedCss.trim().length === 0) {
      // TODO: this error should surface to user
      stdErr += debuglog(
        'Note: Generated critical css was empty for URL: ' + options.url
      )
      cleanupAndExit({ returnValue: '' })
      return
    }

    // remove irrelevant css properties
    try {
      const cleanedCss = apartment(formattedCss, {
        properties: [
          '(.*)transition(.*)',
          'cursor',
          'pointer-events',
          '(-webkit-)?tap-highlight-color',
          '(.*)user-select'
        ],
        // TODO: move into pruneNonCriticalCss script
        selectors: ['::(-moz-)?selection']
      })
      cleanupAndExit({ returnValue: cleanedCss })
      return
    } catch (e) {
      cleanupAndExit({ error: e })
    }
  })
}

const m = (module.exports = function (options, callback) {
  // init logging and debug output
  normalizeCss.DEBUG = m.DEBUG
  const START_TIME = Date.now()
  const debuglog = function (msg, isError) {
    if (m.DEBUG) {
      const errMsg =
        'time: ' +
        (Date.now() - START_TIME) +
        ' | ' +
        (isError ? 'ERR: ' : '') +
        msg
      console.error(errMsg)
      return errMsg
    }
    return ''
  }
  const logging = {
    debuglog,
    stdErr: '',
    START_TIME
  }

  return new Promise(async (resolve, reject) => {
    // still supporting legacy callback way of calling Penthouse
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

      if (callback) {
        callback(error, returnValue)
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

    await launchBrowserIfNeeded(debuglog)
    try {
      const ast = await astFromCss(options, logging)
      const criticalCss = await generateCriticalCssWrapped(
        options,
        ast,
        logging
      )
      cleanupAndExit({ returnValue: criticalCss })
    } catch (err) {
      cleanupAndExit({ error: err })
    }
  })
})
