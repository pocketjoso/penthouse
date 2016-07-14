/*
 * Node module wrapper for the PhantomJS script
 */

var path = require('path')
var spawn = require('child_process').spawn
var phantomjs = require('phantomjs-prebuilt')
var phantomJsBinPath = phantomjs.path
var apartment = require('apartment')
var configString = ('--config=' + path.join(__dirname, 'phantomjs', 'config.json'))
var script = path.join(__dirname, 'phantomjs', 'core.js')

var DEFAULT_VIEWPORT_WIDTH = 1300 // px
var DEFAULT_VIEWPORT_HEIGHT = 900 // px
var DEFAULT_TIMEOUT = 30000 // ms
var DEFAULT_MAX_EMBEDDED_BASE64_LENGTH = 1000 // chars
var DEFAULT_USER_AGENT = 'Penthouse Critical Path CSS Generator'

var removePhantomJSSecurityErrors = function (stdOut) {
  stdOut = stdOut.replace('Unsafe JavaScript attempt to access frame with URL about:blank from frame with URL ', '')
  stdOut = stdOut.replace(/file:\/\/.*core.js\./, '')
  stdOut = stdOut.replace(' Domains, protocols and ports must match.', '')
  return stdOut
}

var toPhantomJsOptions = function (maybeOptionsHash) {
  if (typeof maybeOptionsHash !== 'object') {
    return [];
  }
  return Object.keys(maybeOptionsHash).map(function (optName) {
    return '--' + optName + '=' + maybeOptionsHash[optName];
  })
}

var m = module.exports = function (options, callback) {
  var stdOut = '',
    stdErr = '',
    debuggingHelp = '',
    cp,
    killTimeout

  var timeoutWait = options.timeout || DEFAULT_TIMEOUT
  // need to annotate forceInclude values to allow RegExp to pass through JSON serialization
  var forceInclude = (options.forceInclude || []).map(function (forceIncludeValue) {
    if (typeof forceIncludeValue === 'object' && forceIncludeValue.constructor.name === 'RegExp') {
      return { type: 'RegExp', value: forceIncludeValue.source }
    }
    return { value: forceIncludeValue }
  })
  // set the options, falling back to defaults
  var scriptArgs = [
    options.url || '',
    options.css || '',
    options.width || DEFAULT_VIEWPORT_WIDTH,
    options.height || DEFAULT_VIEWPORT_HEIGHT,
    JSON.stringify(forceInclude), // stringify to maintain array
    !!options.strict,
    typeof options.maxEmbeddedBase64Length === 'number' ? options.maxEmbeddedBase64Length : DEFAULT_MAX_EMBEDDED_BASE64_LENGTH,
    options.userAgent || DEFAULT_USER_AGENT,
    m.DEBUG
  ]

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
    if (m.DEBUG) console.error('' + data)
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
      stdOut = removePhantomJSSecurityErrors(stdOut)
      // remove irrelevant css properties
      var finalCss = apartment(stdOut, {
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
      callback(null, finalCss)
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
