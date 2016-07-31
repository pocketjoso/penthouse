/*
 * normalize css wrapper for PhantomJS
 * only called if original css cannot be parsed by the css ast parser
 */

var path = require('path')
var spawn = require('child_process').spawn
var phantomjs = require('phantomjs-prebuilt')
var phantomJsBinPath = phantomjs.path
var script = path.join(__dirname, 'phantomjs', 'normalize-css.js')
var configString = ('--config=' + path.join(__dirname, 'phantomjs', 'config.json'))
var DEFAULT_TIMEOUT = 30000

// TODO: export from postformatting
var removePhantomJSSecurityErrors = function (stdOut) {
  stdOut = stdOut.replace('Unsafe JavaScript attempt to access frame with URL about:blank from frame with URL ', '')
  stdOut = stdOut.replace(/file:\/\/.*core.js\./, '')
  stdOut = stdOut.replace(' Domains, protocols and ports must match.', '')
  return stdOut
}

var m = module.exports = function (scriptArgs, callback) {
  var stdOut = '',
    stdErr = '',
    debuggingHelp = '',
    cp,
    killTimeout
  var timeoutWait = DEFAULT_TIMEOUT

  phantomJsArgs = [configString, script].concat(scriptArgs).concat([m.DEBUG])


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
    var msg = 'Penthouse normalization step timed out after ' + timeoutWait / 1000 + 's. '
    debuggingHelp += msg
    stdErr += msg
    cp.kill('SIGTERM')
  }, timeoutWait)

  cp.on('exit', function (code) {
    if (code === 0) {
      var finalCss = removePhantomJSSecurityErrors(stdOut)
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
