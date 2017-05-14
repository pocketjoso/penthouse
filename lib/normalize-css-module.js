/*
 * normalize css wrapper for PhantomJS
 * only called if original css cannot be parsed by the css ast parser
 */

'use strict';

const path = require('path');
const spawn = require('child_process').spawn;
const phantomjs = require('phantomjs-prebuilt');
const phantomJsBinPath = phantomjs.path;
const script = path.join(__dirname, 'phantomjs', 'normalize-css.js');
const configString = '--config=' + path.join(__dirname, 'phantomjs', 'config.json');
const DEFAULT_TIMEOUT = 30000;
const START_TIME = new Date().getTime();

// TODO: export from postformatting
const removePhantomJSSecurityErrors = function (stdOut) {
  stdOut = stdOut.replace('Unsafe JavaScript attempt to access frame with URL about:blank from frame with URL ', '');
  stdOut = stdOut.replace(/file:\/\/.*core.js\./, '');
  stdOut = stdOut.replace(' Domains, protocols and ports must match.', '');
  return stdOut;
};

const m = module.exports = function (options, callback) {
  let stdOut = '';
  let stdErr = '';
  let debuggingHelp = '';
  const timeoutWait = options.timeout || DEFAULT_TIMEOUT;

  const debuglog = function (msg, isError) {
    if (m.DEBUG) {
      const errMsg = 'time: ' + (Date.now() - START_TIME) + ' | ' + (isError ? 'ERR: ' : '') + msg;
      stdErr += errMsg;
      console.error(errMsg);
    }
  };
  const scriptArgs = [options.url, options.css, options.userAgent, m.DEBUG];

  const phantomJsArgs = [configString, script].concat(scriptArgs).concat([m.DEBUG]);

  const cp = spawn(phantomJsBinPath, phantomJsArgs);

  // Errors arise before the process starts
  cp.on('error', function (err) {
    debuggingHelp += 'Error executing penthouse using ' + phantomJsBinPath;
    debuggingHelp += err.stack;
    err.debug = debuggingHelp;
    callback(err);
  });

  cp.stdout.on('data', function (data) {
    stdOut += data;
  });

  cp.stderr.on('data', function (data) {
    stdErr += data;
    debuglog(String(data));
  });

  cp.on('close', function (code) {
    if (code !== 0) {
      debuggingHelp += 'PhantomJS process closed with code ' + code;
    }
  });

  // kill after timeout
  const killTimeout = setTimeout(function () {
    const msg = 'Penthouse normalization step timed out after ' + timeoutWait / 1000 + 's. ';
    debuglog('Penthouse normalization step timed out after ' + timeoutWait / 1000 + 's. ');
    debuggingHelp += msg;
    stdErr += msg;
    cp.kill('SIGTERM');
  }, timeoutWait);

  cp.on('exit', function (code) {
    if (code === 0) {
      const finalCss = removePhantomJSSecurityErrors(stdOut);
      callback(null, finalCss);
    } else {
      debuggingHelp += 'PhantomJS process exited with code ' + code;
      const err = new Error(stdErr + stdOut);
      err.code = code;
      err.debug = debuggingHelp;
      err.stdout = stdOut;
      err.stderr = stdErr;
      callback(err);
    }
    // we're done here - clean up
    clearTimeout(killTimeout);
    // can't rely on that the parent process will be terminated any time soon,
    // need to rm listeners and kill child process manually
    process.removeListener('exit', exitHandler);
    process.removeListener('SIGTERM', sigtermHandler);
    cp.kill('SIGTERM');
  });

  function exitHandler() {
    cp.kill('SIGTERM');
  }
  function sigtermHandler() {
    cp.kill('SIGTERM');
    process.exit(0);
  }
  process.on('exit', exitHandler);
  process.on('SIGTERM', sigtermHandler);
};