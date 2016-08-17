/*
 * Node module wrapper for the PhantomJS script
 */

var fs = require('fs')
var tmp = require('tmp')
var path = require('path')
var spawn = require('child_process').spawn
var phantomjs = require('phantomjs-prebuilt')
var phantomJsBinPath = phantomjs.path
var apartment = require('apartment')
var cssAstFormatter = require('css')
var osTmpdir = require('os-tmpdir')
var postformatting = require('./postformatting/')
var normalizeCss = require('./normalize-css')

// for phantomjs
var configString = ('--config=' + path.join(__dirname, 'phantomjs', 'config.json'))
var script = path.join(__dirname, 'phantomjs', 'core.js')

var DEFAULT_VIEWPORT_WIDTH = 1300 // px
var DEFAULT_VIEWPORT_HEIGHT = 900 // px
var DEFAULT_TIMEOUT = 30000 // ms
var DEFAULT_MAX_EMBEDDED_BASE64_LENGTH = 1000 // chars
var DEFAULT_USER_AGENT = 'Penthouse Critical Path CSS Generator'
var TMP_DIR = osTmpdir()

var toPhantomJsOptions = function (maybeOptionsHash) {
  if (typeof maybeOptionsHash !== 'object') {
    return [];
  }
  return Object.keys(maybeOptionsHash).map(function (optName) {
    return '--' + optName + '=' + maybeOptionsHash[optName];
  })
}

function penthouseScriptArgs (options, ast) {
  // need to annotate forceInclude values to allow RegExp to pass through JSON serialization
  var forceInclude = (options.forceInclude || []).map(function (forceIncludeValue) {
    if (typeof forceIncludeValue === 'object' && forceIncludeValue.constructor.name === 'RegExp') {
      return { type: 'RegExp', value: forceIncludeValue.source }
    }
    return { value: forceIncludeValue }
  })
  return [
    options.url || '',
    writeAstToFile(ast),
    options.width || DEFAULT_VIEWPORT_WIDTH,
    options.height || DEFAULT_VIEWPORT_HEIGHT,
    JSON.stringify(forceInclude), // stringify to maintain array
    options.userAgent || DEFAULT_USER_AGENT,
    m.DEBUG
  ]
}

function writeAstToFile (ast) {
  // save ast to file
  var tmpobj = tmp.fileSync({dir: TMP_DIR})
  fs.writeFileSync(tmpobj.name, JSON.stringify(ast))
  return tmpobj.name
}

var m = module.exports = function (options, callback) {
  var stdOut = ''
  var stdErr = ''
  // debugging
  var START_TIME = Date.now()
  var debuglog = function (msg, isError) {
    if (m.DEBUG) {
      var errMsg = 'time: ' + (Date.now() - START_TIME) + ' | ' + (isError ? 'ERR: ' : '') + msg
      stdErr += errMsg
      console.error(errMsg)
    }
  }

  function generateCriticalCss (ast) {
    var debuggingHelp = '',
      cp,
      killTimeout

    var timeoutWait = options.timeout || DEFAULT_TIMEOUT

    var scriptArgs = penthouseScriptArgs(options, ast)

    var phantomJsArgs = [configString].concat(toPhantomJsOptions(options.phantomJsOptions))
    phantomJsArgs.push(script)
    phantomJsArgs = phantomJsArgs.concat(scriptArgs)

    cp = spawn(phantomJsBinPath, phantomJsArgs)

    // Errors arise before the process starts
    cp.on('error', function (err) {
      debuggingHelp += 'Error executing penthouse using ' + phantomJsBinPath
      debuggingHelp += err.stack
      err.debug = debuggingHelp
      callback(err)
    })

    cp.stdout.on('data', function (data) {
      stdOut += data
    })

    cp.stderr.on('data', function (data) {
      stdErr += data
      debuglog('' + data)
    })

    cp.on('close', function (code) {
      if (code !== 0) {
        debuggingHelp += 'PhantomJS process closed with code ' + code
      }
    })

    // kill after timeout
    killTimeout = setTimeout(function () {
      var msg = 'Penthouse timed out after ' + timeoutWait / 1000 + 's. '
      debuggingHelp += msg
      stdErr += msg
      cp.kill('SIGTERM')
    }, timeoutWait)

    cp.on('exit', function (code) {
      if (code === 0) {
        // promise purely for catching errors,
        // that otherwise exit node
        new Promise(function (resolve, reject) {
          var finalCss = postformatting(stdOut, {
            maxEmbeddedBase64Length: typeof options.maxEmbeddedBase64Length === 'number' ? options.maxEmbeddedBase64Length : DEFAULT_MAX_EMBEDDED_BASE64_LENGTH,
          }, m.DEBUG, START_TIME)

          if (finalCss.trim().length === 0) {
            // TODO: this error should surface to user
            debuglog('Note: Generated critical css was empty for URL: ' + options.url)
          } else {
            // remove irrelevant css properties
            finalCss = apartment(finalCss, {
              properties: [
                '(.*)transition(.*)',
                'cursor',
                'pointer-events',
                '(-webkit-)?tap-highlight-color',
                '(.*)user-select'
              ],
              // TODO: move into core phantomjs script
              selectors: [
                '::(-moz-)?selection'
              ]
            })
          }
          callback(null, finalCss)
          resolve()
          return
        })
        .catch(function (err) {
          console.log('caught err', err)
          callback(err)
        })
      } else {
        debuggingHelp += 'PhantomJS process exited with code ' + code
        var err = new Error(stdErr + stdOut)
        err.code = code
        err.debug = debuggingHelp
        err.stdout = stdOut
        err.stderr = stdErr
        callback(err)
      }
      // we're done here - clean up
      clearTimeout(killTimeout)
      // can't rely on that the parent process will be terminated any time soon,
      // need to rm listeners and kill child process manually
      process.removeListener('exit', exitHandler)
      process.removeListener('SIGTERM', sigtermHandler)
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
  }

  function generateAstFromCssFile(cssfilepath) {
    // read the css and parse the ast
    // if errors, normalize css and try again
    // only then pass css to penthouse
    return new Promise(function (resolve, reject) {
      var css
      try {
        css = fs.readFileSync(cssfilepath, 'utf8')
      } catch (e) {
        reject(e.message)
        return
      }
      debuglog('opened css file')

      var ast = cssAstFormatter.parse(css, { silent: true })
      var parsingErrors = ast.stylesheet.parsingErrors.filter(function (err) {
        // the forked version of the astParser used fixes these errors itself
        return err.reason !== 'Extra closing brace'
      })
      if (!parsingErrors.length > 0) {
        debuglog('parsed ast (without errors)')
        resolve(ast)
        return
      }

      // had breaking parsing errors
      // NOTE: only informing about first error, even if there were more than one.
      var parsingErrorMessage = parsingErrors[0].message
      if (!!options.strict) {
        reject(parsingErrorMessage)
        return
      }

      debuglog("Failed ast formatting css '" + parsingErrorMessage + "': ")
      var normalizeScriptArgs = [
        options.url || '',
        options.css || '',
        options.userAgent || DEFAULT_USER_AGENT,
        m.DEBUG
      ]
      normalizeCss(
        normalizeScriptArgs,
        function (err, normalizedCss) {
          debuglog('normalized css: ' + normalizedCss.length)
          ast = cssAstFormatter.parse(normalizedCss)
          debuglog('parsed normalised css into ast')
          resolve(ast)
          return
        }
      )
    })
  }

  generateAstFromCssFile(options.css)
  .then(generateCriticalCss)
  .catch(callback)
}
