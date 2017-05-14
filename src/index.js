/*
 * Node module wrapper for the PhantomJS script
 */

'use strict'

const fs = require('fs')
const tmp = require('tmp')
const path = require('path')
const spawn = require('child_process').spawn
const phantomjs = require('phantomjs-prebuilt')
const phantomJsBinPath = phantomjs.path
const apartment = require('apartment')
const cssAstFormatter = require('css')
const osTmpdir = require('os-tmpdir')
const postformatting = require('./postformatting/')
const normalizeCss = require('./normalize-css-module')

// for phantomjs
const configString =
  '--config=' + path.join(__dirname, 'phantomjs', 'config.json')
const script = path.join(__dirname, 'phantomjs', 'core.js')

const DEFAULT_VIEWPORT_WIDTH = 1300 // px
const DEFAULT_VIEWPORT_HEIGHT = 900 // px
const DEFAULT_TIMEOUT = 30000 // ms
const DEFAULT_MAX_EMBEDDED_BASE64_LENGTH = 1000 // chars
const DEFAULT_USER_AGENT = 'Penthouse Critical Path CSS Generator'
const TMP_DIR = osTmpdir()
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

const toPhantomJsOptions = function (maybeOptionsHash) {
  if (typeof maybeOptionsHash !== 'object') {
    return []
  }
  return Object.keys(maybeOptionsHash).map(function (optName) {
    return '--' + optName + '=' + maybeOptionsHash[optName]
  })
}

function penthouseScriptArgs (options, astFilename) {
  // need to annotate forceInclude values to allow RegExp to pass through JSON serialization
  const forceInclude = (options.forceInclude || [])
    .map(function (forceIncludeValue) {
      if (
        typeof forceIncludeValue === 'object' &&
        forceIncludeValue.constructor.name === 'RegExp'
      ) {
        return { type: 'RegExp', value: forceIncludeValue.source }
      }
      return { value: forceIncludeValue }
    })
  // TODO: should just stringify the whole thing and parse inside, rather than doing like this,
  // since the command line util no longer used
  return [
    options.url || '',
    astFilename,
    options.width || DEFAULT_VIEWPORT_WIDTH,
    options.height || DEFAULT_VIEWPORT_HEIGHT,
    JSON.stringify(forceInclude), // stringify to maintain array
    options.userAgent || DEFAULT_USER_AGENT,
    options.renderWaitTime || DEFAULT_RENDER_WAIT_TIMEOUT,
    typeof options.blockJSRequests !== 'undefined'
      ? options.blockJSRequests
      : DEFAULT_BLOCK_JS_REQUESTS,
    // object, needs to be stringified
    JSON.stringify(options.customPageHeaders || {}),
    m.DEBUG
  ]
}

function writeAstToFile (ast) {
  return new Promise((resolve, reject) => {
    tmp.file({ dir: TMP_DIR }, (err, path, fd, cleanupCallback) => {
      if (err) {
        return reject(err)
      }

      fs.writeFile(path, JSON.stringify(ast), err => {
        if (err) {
          return reject(err)
        }
        resolve({ path, cleanupCallback })
      })
    })
  })
}

async function generateAstFromCssFile (options, { debuglog, stdErr }) {
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

async function generateCriticalCss (
  options,
  ast,
  { debuglog, stdErr, START_TIME }
) {
  const timeoutWait = options.timeout || DEFAULT_TIMEOUT
  let debuggingHelp = ''
  let stdOut = ''

  const {
    path: astFilePath,
    cleanupCallback: astFileCleanupCallback
  } = await writeAstToFile(ast)

  const scriptArgs = penthouseScriptArgs(options, astFilePath)
  const phantomJsArgs = [
    configString,
    ...toPhantomJsOptions(options.phantomJsOptions),
    script,
    ...scriptArgs
  ]

  const cp = spawn(phantomJsBinPath, phantomJsArgs)

  return new Promise((resolve, reject) => {
    // Errors arise before the process starts
    cp.on('error', function (err) {
      debuggingHelp += 'Error executing penthouse using ' + phantomJsBinPath
      debuggingHelp += err.stack
      err.debug = debuggingHelp
      reject(err)
      // remove the tmp file we created
      // library would clean up after process ends, but this is better for long living proccesses
      astFileCleanupCallback()
    })

    cp.stdout.on('data', function (data) {
      stdOut += data
    })

    cp.stderr.on('data', function (data) {
      stdErr += debuglog(String(data)) || data
    })

    cp.on('close', function (code) {
      if (code !== 0) {
        debuggingHelp += 'PhantomJS process closed with code ' + code
      }
    })

    // kill after timeout
    const killTimeout = setTimeout(function () {
      const msg = 'Penthouse timed out after ' + timeoutWait / 1000 + 's. '
      debuggingHelp += msg
      stdErr += msg
      cp.kill('SIGTERM')
    }, timeoutWait)

    cp.on('exit', function (code) {
      if (code === 0) {
        const formattedCss = postformatting(
          stdOut,
          {
            maxEmbeddedBase64Length: typeof options.maxEmbeddedBase64Length ===
              'number'
              ? options.maxEmbeddedBase64Length
              : DEFAULT_MAX_EMBEDDED_BASE64_LENGTH
          },
          m.DEBUG,
          START_TIME
        )

        if (formattedCss.trim().length === 0) {
          // TODO: this error should surface to user
          stdErr += debuglog(
            'Note: Generated critical css was empty for URL: ' + options.url
          )
          resolve(formattedCss)
          return
        }

        // remove irrelevant css properties
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
        resolve(cleanedCss)
      } else {
        debuggingHelp += 'PhantomJS process exited with code ' + code
        const err = new Error(stdErr + stdOut)
        err.code = code
        err.debug = debuggingHelp
        err.stdout = stdOut
        err.stderr = stdErr
        reject(err)
      }
      // we're done here - clean up
      clearTimeout(killTimeout)
      // can't rely on that the parent process will be terminated any time soon,
      // need to rm listeners and kill child process manually
      process.removeListener('exit', exitHandler)
      process.removeListener('SIGTERM', sigtermHandler)
      // remove the tmp file we created
      // library would clean up after process ends, but this is better for long living proccesses
      astFileCleanupCallback()
      cp.kill('SIGTERM')
    })

    function exitHandler () {
      cp.kill('SIGTERM')
    }
    function sigtermHandler () {
      cp.kill('SIGTERM')
      process.exit(0)
    }
    process.on('exit', exitHandler)
    process.on('SIGTERM', sigtermHandler)
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

  return generateAstFromCssFile(options, logging)
    .then(ast => generateCriticalCss(options, ast, logging))
    .then(criticalCss => {
      if (callback) {
        callback(null, criticalCss)
      }
      return criticalCss
    })
    .catch(err => {
      if (callback) {
        callback(err)
        return
      }
      throw err
    })
})
