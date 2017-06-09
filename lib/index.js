/*
 * Node module wrapper for the PhantomJS script
 */

'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

require('regenerator-runtime/runtime'); // support Node 4

var fs = require('fs');
var tmp = require('tmp');
var path = require('path');
var spawn = require('child_process').spawn;
var phantomjs = require('phantomjs-prebuilt');
var phantomJsBinPath = phantomjs.path;
var apartment = require('apartment');
var cssAstFormatter = require('css');
var osTmpdir = require('os-tmpdir');
var postformatting = require('./postformatting/');
var normalizeCss = require('./normalize-css-module');

// for phantomjs
var configString = '--config=' + path.join(__dirname, 'phantomjs', 'config.json');
var script = path.join(__dirname, 'phantomjs', 'core.js');

var DEFAULT_VIEWPORT_WIDTH = 1300; // px
var DEFAULT_VIEWPORT_HEIGHT = 900; // px
var DEFAULT_TIMEOUT = 30000; // ms
var DEFAULT_MAX_EMBEDDED_BASE64_LENGTH = 1000; // chars
var DEFAULT_USER_AGENT = 'Penthouse Critical Path CSS Generator';
var TMP_DIR = osTmpdir();
var DEFAULT_RENDER_WAIT_TIMEOUT = 100;
var DEFAULT_BLOCK_JS_REQUESTS = true;

function readFilePromise(filepath, encoding) {
  return new Promise(function (resolve, reject) {
    fs.readFile(filepath, encoding, function (err, content) {
      if (err) {
        return reject(err);
      }
      resolve(content);
    });
  });
}

var toPhantomJsOptions = function toPhantomJsOptions(maybeOptionsHash) {
  if (typeof maybeOptionsHash !== 'object') {
    return [];
  }
  return Object.keys(maybeOptionsHash).map(function (optName) {
    return '--' + optName + '=' + maybeOptionsHash[optName];
  });
};

function penthouseScriptArgs(options, astFilename) {
  // need to annotate forceInclude values to allow RegExp to pass through JSON serialization
  var forceInclude = (options.forceInclude || []).map(function (forceIncludeValue) {
    if (typeof forceIncludeValue === 'object' && forceIncludeValue.constructor.name === 'RegExp') {
      return { type: 'RegExp', value: forceIncludeValue.source };
    }
    return { value: forceIncludeValue };
  });
  // TODO: should just stringify the whole thing and parse inside, rather than doing like this,
  // since the command line util no longer used
  return [options.url || '', astFilename, options.width || DEFAULT_VIEWPORT_WIDTH, options.height || DEFAULT_VIEWPORT_HEIGHT, JSON.stringify(forceInclude), // stringify to maintain array
  options.userAgent || DEFAULT_USER_AGENT, options.renderWaitTime || DEFAULT_RENDER_WAIT_TIMEOUT, typeof options.blockJSRequests !== 'undefined' ? options.blockJSRequests : DEFAULT_BLOCK_JS_REQUESTS,
  // object, needs to be stringified
  JSON.stringify(options.customPageHeaders || {}), m.DEBUG];
}

function writeToTmpFile(string) {
  return new Promise(function (resolve, reject) {
    tmp.file({ dir: TMP_DIR }, function (err, path, fd, cleanupCallback) {
      if (err) {
        return reject(err);
      }

      fs.writeFile(path, string, function (err) {
        if (err) {
          return reject(err);
        }
        resolve({ path, cleanupCallback });
      });
    });
  });
}

// const so not hoisted, so can get regeneratorRuntime inlined above, needed for Node 4
var generateAstFromCssFile = function () {
  var _ref2 = _asyncToGenerator(regeneratorRuntime.mark(function _callee(options, _ref) {
    var debuglog = _ref.debuglog,
        stdErr = _ref.stdErr;
    var css, ast, parsingErrors, parsingErrorMessage;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            // read the css and parse the ast
            // if errors, normalize css and try again
            // only then pass css to penthouse
            css = void 0;
            _context.prev = 1;
            _context.next = 4;
            return readFilePromise(options.css, 'utf8');

          case 4:
            css = _context.sent;
            _context.next = 10;
            break;

          case 7:
            _context.prev = 7;
            _context.t0 = _context['catch'](1);
            throw _context.t0;

          case 10:
            stdErr += debuglog('opened css file');

            ast = cssAstFormatter.parse(css, { silent: true });
            parsingErrors = ast.stylesheet.parsingErrors.filter(function (err) {
              // the forked version of the astParser used fixes these errors itself
              return err.reason !== 'Extra closing brace';
            });

            if (!(parsingErrors.length === 0)) {
              _context.next = 16;
              break;
            }

            stdErr += debuglog('parsed ast (without errors)');
            return _context.abrupt('return', ast);

          case 16:

            // had breaking parsing errors
            // NOTE: only informing about first error, even if there were more than one.
            parsingErrorMessage = parsingErrors[0].message;

            if (!(options.strict === true)) {
              _context.next = 19;
              break;
            }

            throw parsingErrorMessage;

          case 19:

            stdErr += debuglog("Failed ast formatting css '" + parsingErrorMessage + "': ");
            return _context.abrupt('return', new Promise(function (resolve, reject) {
              normalizeCss({
                url: options.url || '',
                css: options.css || '',
                userAgent: options.userAgent || DEFAULT_USER_AGENT,
                timeout: options.timeout,
                debug: m.DEBUG
              }, function (err, normalizedCss) {
                if (err) {
                  reject(err);
                  return;
                }
                stdErr += debuglog('normalized css: ' + (normalizedCss ? normalizedCss.length : typeof normalizedCss));
                if (!normalizedCss) {
                  reject(new Error("Failed to normalize CSS errors. Run Penthouse with 'strict: true' option to see these css errors."));
                  return;
                }
                ast = cssAstFormatter.parse(normalizedCss, { silent: true });
                stdErr += debuglog('parsed normalised css into ast');
                var parsingErrors = ast.stylesheet.parsingErrors.filter(function (err) {
                  // the forked version of the astParser used fixes these errors itself
                  return err.reason !== 'Extra closing brace';
                });
                if (parsingErrors.length > 0) {
                  stdErr += debuglog('..with parsingErrors: ' + parsingErrors[0].reason);
                }
                resolve(ast);
              });
            }));

          case 21:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[1, 7]]);
  }));

  function generateAstFromCssFile(_x, _x2) {
    return _ref2.apply(this, arguments);
  }

  return generateAstFromCssFile;
}();

// const so not hoisted, so can get regeneratorRuntime inlined above, needed for Node 4
var generateCriticalCss = function () {
  var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2(options, ast, _ref3) {
    var debuglog = _ref3.debuglog,
        stdErr = _ref3.stdErr,
        START_TIME = _ref3.START_TIME;

    var timeoutWait, debuggingHelp, stdOut, _ref5, astFilePath, astFileCleanupCallback, scriptArgs, phantomJsArgs, cp;

    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            timeoutWait = options.timeout || DEFAULT_TIMEOUT;
            debuggingHelp = '';
            stdOut = '';
            _context2.next = 5;
            return writeToTmpFile(JSON.stringify(ast));

          case 5:
            _ref5 = _context2.sent;
            astFilePath = _ref5.path;
            astFileCleanupCallback = _ref5.cleanupCallback;
            scriptArgs = penthouseScriptArgs(options, astFilePath);
            phantomJsArgs = [configString].concat(_toConsumableArray(toPhantomJsOptions(options.phantomJsOptions)), [script], _toConsumableArray(scriptArgs));
            cp = spawn(phantomJsBinPath, phantomJsArgs);
            return _context2.abrupt('return', new Promise(function (resolve, reject) {
              // Errors arise before the process starts
              cp.on('error', function (err) {
                debuggingHelp += 'Error executing penthouse using ' + phantomJsBinPath;
                debuggingHelp += err.stack;
                err.debug = debuggingHelp;
                reject(err);
                // remove the tmp file we created
                // library would clean up after process ends, but this is better for long living proccesses
                astFileCleanupCallback();
              });

              cp.stdout.on('data', function (data) {
                stdOut += data;
              });

              cp.stderr.on('data', function (data) {
                stdErr += debuglog(String(data)) || data;
              });

              cp.on('close', function (code) {
                if (code !== 0) {
                  debuggingHelp += 'PhantomJS process closed with code ' + code;
                }
              });

              // kill after timeout
              var killTimeout = setTimeout(function () {
                var msg = 'Penthouse timed out after ' + timeoutWait / 1000 + 's. ';
                debuggingHelp += msg;
                stdErr += msg;
                cp.kill('SIGTERM');
              }, timeoutWait);

              cp.on('exit', function (code) {
                if (code === 0) {
                  stdErr += debuglog('recevied (good) exit signal; process stdOut');
                  var formattedCss = void 0;
                  try {
                    formattedCss = postformatting(stdOut, {
                      maxEmbeddedBase64Length: typeof options.maxEmbeddedBase64Length === 'number' ? options.maxEmbeddedBase64Length : DEFAULT_MAX_EMBEDDED_BASE64_LENGTH
                    }, m.DEBUG, START_TIME);
                  } catch (e) {
                    reject(e);
                    return;
                  }

                  if (formattedCss.trim().length === 0) {
                    // TODO: this error should surface to user
                    stdErr += debuglog('Note: Generated critical css was empty for URL: ' + options.url);
                    resolve(formattedCss);
                    return;
                  }

                  // remove irrelevant css properties
                  var cleanedCss = apartment(formattedCss, {
                    properties: ['(.*)transition(.*)', 'cursor', 'pointer-events', '(-webkit-)?tap-highlight-color', '(.*)user-select'],
                    // TODO: move into core phantomjs script
                    selectors: ['::(-moz-)?selection']
                  });
                  resolve(cleanedCss);
                } else {
                  debuggingHelp += 'PhantomJS process exited with code ' + code;
                  var err = new Error(stdErr + stdOut);
                  err.code = code;
                  err.debug = debuggingHelp;
                  err.stdout = stdOut;
                  err.stderr = stdErr;
                  reject(err);
                }
                // we're done here - clean up
                clearTimeout(killTimeout);
                // can't rely on that the parent process will be terminated any time soon,
                // need to rm listeners and kill child process manually
                process.removeListener('exit', exitHandler);
                process.removeListener('SIGTERM', sigtermHandler);
                // remove the tmp file we created
                // library would clean up after process ends, but this is better for long living proccesses
                astFileCleanupCallback();
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
            }));

          case 12:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function generateCriticalCss(_x3, _x4, _x5) {
    return _ref4.apply(this, arguments);
  }

  return generateCriticalCss;
}();

var m = module.exports = function (options, callback) {
  // init logging and debug output
  normalizeCss.DEBUG = m.DEBUG;
  var START_TIME = Date.now();
  var debuglog = function debuglog(msg, isError) {
    if (m.DEBUG) {
      var errMsg = 'time: ' + (Date.now() - START_TIME) + ' | ' + (isError ? 'ERR: ' : '') + msg;
      console.error(errMsg);
      return errMsg;
    }
    return '';
  };
  var logging = {
    debuglog,
    stdErr: '',
    START_TIME
  };

  return generateAstFromCssFile(options, logging).then(function (ast) {
    return generateCriticalCss(options, ast, logging);
  }).then(function (criticalCss) {
    if (callback) {
      callback(null, criticalCss);
    }
    return criticalCss;
  }).catch(function (err) {
    if (callback) {
      callback(err);
      return;
    }
    throw err;
  });
};