/*
 * Node module wrapper for the PhantomJS script
 */

var path = require('path')
var spawn = require('child_process').spawn
var phantomjs = require('phantomjs')
var phantomJsBinPath = phantomjs.path
var configString = ('--config=' + path.join(__dirname, 'phantomjs', 'config.json'))
var script = path.join(__dirname, 'phantomjs', 'core.js')

var DEFAULT_VIEWPORT_WIDTH = 1300 // px
var DEFAULT_VIEWPORT_HEIGHT = 900 // px
var DEFAULT_TIMEOUT = 30000 // ms
var DEFAULT_MAX_EMBEDDED_BASE64_LENGTH = 1000 // chars

var removePhantomJSSecurityErrors = function (stdOut) {
  stdOut = stdOut.replace('Unsafe JavaScript attempt to access frame with URL about:blank from frame with URL ', '')
  stdOut = stdOut.replace(/file:\/\/.*core.js\./, '')
  stdOut = stdOut.replace(' Domains, protocols and ports must match.', '')
  return stdOut
}

var m = module.exports = function (options, callback) {
  var stdOut = '',
    stdErr = '',
    debuggingHelp = '',
    cp

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
    typeof options.maxEmbeddedBase64Length === 'number' ? options.maxEmbeddedBase64Length : DEFAULT_MAX_EMBEDDED_BASE64_LENGTH
  ]

  cp = spawn(phantomJsBinPath, [configString, script].concat(scriptArgs))

  // Errors arise before the process starts
  cp.on('error', function (err) {
    debuggingHelp += 'Error executing penthouse using ' + phantomJsBinPath
    debuggingHelp += err.stack
    err.debug = debuggingHelp
    callback(err)
  })

  cp.stdout.on('data', function (data) {
    stdOut += data
    if (m.DEBUG) { console.log('' + data) }
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
  var timeout = options.timeout || DEFAULT_TIMEOUT
  var killTimeout = setTimeout(function () {
    var msg = 'Penthouse timed out after ' + timeout / 1000 + 's. '
    debuggingHelp += msg
    stdErr += msg
    cp.kill('SIGTERM')
  }, timeout)

  cp.on('exit', function (code) {
    if (killTimeout) {
      clearTimeout(killTimeout);
    }
    if (code === 0) {
      if (m.DEBUG) {
        console.log('stdout: ' + stdOut)
        console.log('stderr: ' + stdErr)
      }
      stdOut = removePhantomJSSecurityErrors(stdOut)
      callback(null, stdOut)
    } else {
      debuggingHelp += 'PhantomJS process exited with code ' + code
      var err = new Error(stdErr + stdOut)
      err.code = code
      err.debug = debuggingHelp
      err.stdout = stdOut
      err.stderr = stdErr
      callback(err)
    }
  })

  process.on('exit', function () {
    cp.kill('SIGTERM')
  })

  process.on('SIGTERM', function () {
    cp.kill('SIGTERM')
    process.exit(0)
  })

}
