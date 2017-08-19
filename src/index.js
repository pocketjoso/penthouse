const fs = require('fs')
const apartment = require('apartment')
const cssAstFormatter = require('css-fork-pocketjoso')
const generateCriticalCss = require('./core').default

const nonMatchingMediaQueryRemover = require('./non-matching-media-query-remover')
const postformatting = require('./postformatting/')
const normalizeCss = require('./normalize-css-module')

const DEFAULT_VIEWPORT_WIDTH = 1300 // px
const DEFAULT_VIEWPORT_HEIGHT = 900 // px
const DEFAULT_TIMEOUT = 30000 // ms
const DEFAULT_MAX_EMBEDDED_BASE64_LENGTH = 1000 // chars
const DEFAULT_USER_AGENT = 'Penthouse Critical Path CSS Generator'
const DEFAULT_RENDER_WAIT_TIMEOUT = 100
const DEFAULT_BLOCK_JS_REQUESTS = true

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
const generateAstFromCssFile = async function generateAstFromCssFile (
  options,
  { debuglog, stdErr }
) {
  // read the css and parse the ast
  // if errors, normalize css and try again
  // only then pass css to penthouse
  let css
  try {
    css = await readFilePromise(options.css, 'utf8')
  } catch (e) {
    throw e
  }
  stdErr += debuglog('opened css file')

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
    throw parsingErrorMessage
  }

  stdErr += debuglog(
    "Failed ast formatting css '" + parsingErrorMessage + "': "
  )
  return new Promise((resolve, reject) => {
    normalizeCss(
      {
        url: options.url || '',
        css: options.css || '',
        userAgent: options.userAgent || DEFAULT_USER_AGENT,
        timeout: options.timeout,
        debug: m.DEBUG
      },
      function (err, normalizedCss) {
        if (err) {
          reject(err)
          return
        }
        stdErr += debuglog(
          'normalized css: ' +
            (normalizedCss ? normalizedCss.length : typeof normalizedCss)
        )
        if (!normalizedCss) {
          reject(
            new Error(
              "Failed to normalize CSS errors. Run Penthouse with 'strict: true' option to see these css errors."
            )
          )
          return
        }
        ast = cssAstFormatter.parse(normalizedCss, { silent: true })
        stdErr += debuglog('parsed normalised css into ast')
        const parsingErrors = ast.stylesheet.parsingErrors.filter(function (
          err
        ) {
          // the forked version of the astParser used fixes these errors itself
          return err.reason !== 'Extra closing brace'
        })
        if (parsingErrors.length > 0) {
          stdErr += debuglog('..with parsingErrors: ' + parsingErrors[0].reason)
        }
        resolve(ast)
      }
    )
  })
}

// const so not hoisted, so can get regeneratorRuntime inlined above, needed for Node 4
const generateCriticalCssWrapped = async function generateCriticalCssWrapped (
  options,
  ast,
  { debuglog, stdErr, START_TIME }
) {
  // TODO
  // let debuggingHelp = ''
  const width = options.width || DEFAULT_VIEWPORT_WIDTH
  const height = options.height || DEFAULT_VIEWPORT_HEIGHT
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
    const killTimeout = setTimeout(() => {
      reject(
        new Error('Penthouse timed out after ' + timeoutWait / 1000 + 's. ')
      )
    }, timeoutWait)
    const cleanupAndExit = ({ returnValue, error }) => {
      clearTimeout(killTimeout)
      if (error) {
        reject(error)
      } else {
        resolve(returnValue)
      }
    }

    stdErr += debuglog('call generateCriticalCssWrapped')
    let criticalAstRules
    try {
      criticalAstRules = await generateCriticalCss({
        url: options.url,
        astRules,
        width,
        height,
        forceInclude,
        userAgent: options.userAgent || DEFAULT_USER_AGENT,
        renderWaitTime: options.renderWaitTime || DEFAULT_RENDER_WAIT_TIMEOUT,
        timeout: timeoutWait,
        blockJSRequests: options.blockJSRequests || DEFAULT_BLOCK_JS_REQUESTS,
        // object, needs to be stringified
        // JSON.stringify(options.customPageHeaders || {}),
        customPageHeaders: options.customPageHeaders,
        debuglog
      })
    } catch (e) {
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
        // TODO: move into core phantomjs script
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
    try {
      const ast = await generateAstFromCssFile(options, logging)
      const criticalCss = await generateCriticalCssWrapped(
        options,
        ast,
        logging
      )
      if (callback) {
        callback(null, criticalCss)
        return
      }
      resolve(criticalCss)
    } catch (err) {
      if (callback) {
        callback(err)
        return
      }
      reject(err)
    }
  })
})
