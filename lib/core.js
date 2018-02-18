'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

let loadPage = (() => {
  var _ref = _asyncToGenerator(function* (page, url, timeout, pageLoadSkipTimeout) {
    debuglog('page load start');
    // set a higher number than the timeout option, in order to make
    // puppeteer’s timeout _never_ happen
    let waitingForPageLoad = true;
    const loadPagePromise = page.goto(url, { timeout: timeout + 1000 });
    if (pageLoadSkipTimeout) {
      yield Promise.race([loadPagePromise, new Promise(function (resolve) {
        // instead we manually _abort_ page load after X time,
        // in order to deal with spammy pages that keep sending non-critical requests
        // (tracking etc), which would otherwise never load.
        // With JS disabled it just shouldn't take that many seconds to load what's needed
        // for critical viewport.
        setTimeout(function () {
          if (waitingForPageLoad) {
            debuglog('page load waiting ABORTED after ' + pageLoadSkipTimeout / 1000 + 's. ');
            resolve();
          }
        }, pageLoadSkipTimeout);
      })]);
    } else {
      yield loadPagePromise;
    }
    waitingForPageLoad = false;
    debuglog('page load DONE');
  });

  return function loadPage(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

let blockJsRequests = (() => {
  var _ref2 = _asyncToGenerator(function* (page) {
    yield page.setRequestInterception(true);
    page.on('request', blockinterceptedRequests);
  });

  return function blockJsRequests(_x5) {
    return _ref2.apply(this, arguments);
  };
})();

let astFromCss = (() => {
  var _ref3 = _asyncToGenerator(function* ({ cssString, strict }) {
    // breaks puppeteer
    const css = cssString.replace(/￿/g, '\f042');

    let parsingErrors = [];
    debuglog('parse ast START');
    let ast = _cssTree2.default.parse(css, {
      onParseError: function onParseError(error) {
        return parsingErrors.push(error.formattedMessage);
      }
    });
    debuglog(`parsed ast (with ${parsingErrors.length} errors)`);

    if (parsingErrors.length && strict === true) {
      // NOTE: only informing about first error, even if there were more than one.
      const parsingErrorMessage = parsingErrors[0];
      throw new Error(`AST parser (css-tree) found ${parsingErrors.length} errors in CSS.
      Breaking because in strict mode.
      The first error was:
      ` + parsingErrorMessage);
    }
    return ast;
  });

  return function astFromCss(_x6) {
    return _ref3.apply(this, arguments);
  };
})();

let preparePage = (() => {
  var _ref4 = _asyncToGenerator(function* ({
    page,
    width,
    height,
    browser,
    userAgent,
    customPageHeaders,
    blockJSRequests,
    cleanupAndExit
  }) {
    debuglog('preparePage START');
    page = yield browser.newPage();
    debuglog('new page opened in browser');

    yield page.setViewport({ width, height });
    debuglog('viewport set');

    yield page.setUserAgent(userAgent);

    page.on('error', function (error) {
      debuglog('page crashed: ' + error);
      cleanupAndExit({ error });
    });

    if (customPageHeaders) {
      try {
        debuglog('set custom headers');
        yield page.setExtraHTTPHeaders(customPageHeaders);
      } catch (e) {
        debuglog('failed setting extra http headers: ' + e);
      }
    }

    if (blockJSRequests) {
      // NOTE: with JS disabled we cannot use JS timers inside page.evaluate
      // (setTimeout, setInterval), however requestAnimationFrame works.
      yield page.setJavaScriptEnabled(false);
      yield blockJsRequests(page);
      debuglog('blocking js requests');
    }
    page.on('console', function (msg) {
      const text = msg.text || msg;
      // pass through log messages
      // - the ones sent by penthouse for debugging has 'debug: ' prefix.
      if (/^debug: /.test(text)) {
        debuglog(text.replace(/^debug: /, ''));
      }
    });
    debuglog('preparePage DONE');
    return page;
  });

  return function preparePage(_x7) {
    return _ref4.apply(this, arguments);
  };
})();

let grabPageScreenshot = (() => {
  var _ref5 = _asyncToGenerator(function* ({
    type,
    page,
    screenshots,
    screenshotExtension,
    debuglog
  }) {
    const path = screenshots.basePath + `-${type}` + screenshotExtension;
    debuglog(`take ${type} screenshot, path: ${path}`);
    return page.screenshot(_extends({}, screenshots, {
      path
    })).then(function () {
      return debuglog(`take ${type} screenshot DONE`);
    });
  });

  return function grabPageScreenshot(_x8) {
    return _ref5.apply(this, arguments);
  };
})();

let pruneNonCriticalCssLauncher = (() => {
  var _ref6 = _asyncToGenerator(function* ({
    browser,
    url,
    cssString,
    width,
    height,
    forceInclude,
    strict,
    userAgent,
    renderWaitTime,
    timeout,
    pageLoadSkipTimeout,
    blockJSRequests,
    customPageHeaders,
    screenshots,
    propertiesToRemove,
    maxEmbeddedBase64Length,
    keepLargerMediaQueries,
    unstableKeepBrowserAlive
  }) {
    let _hasExited = false;
    const takeScreenshots = screenshots && screenshots.basePath;
    const screenshotExtension = takeScreenshots && screenshots.type === 'jpeg' ? '.jpg' : '.png';

    return new Promise((() => {
      var _ref7 = _asyncToGenerator(function* (resolve, reject) {
        let cleanupAndExit = (() => {
          var _ref8 = _asyncToGenerator(function* ({ error, returnValue }) {
            if (_hasExited) {
              return;
            }
            debuglog('cleanupAndExit start');
            _hasExited = true;

            clearTimeout(killTimeout);
            // page.close will error if page/browser has already been closed;
            // try to avoid
            if (page && !(error && error.toString().indexOf('Target closed') > -1)) {
              debuglog('cleanupAndExit -> try to close browser page');
              // Without try/catch if error penthouse will crash if error here,
              // and wont restart properly
              try {
                // must await here, otherwise will receive errors if closing
                // browser before page is properly closed,
                // however in unstableKeepBrowserAlive browser is never closed by penthouse.
                if (unstableKeepBrowserAlive) {
                  page.close();
                } else {
                  yield page.close();
                }
              } catch (err) {
                debuglog('cleanupAndExit -> failed to close browser page (ignoring)');
              }
            }
            debuglog('cleanupAndExit end');
            if (error) {
              return reject(error);
            }
            return resolve(returnValue);
          });

          return function cleanupAndExit(_x12) {
            return _ref8.apply(this, arguments);
          };
        })();

        debuglog('Penthouse core start');
        let page;
        let killTimeout;

        killTimeout = setTimeout(function () {
          cleanupAndExit({
            error: new Error('Penthouse timed out after ' + timeout / 1000 + 's. ')
          });
        }, timeout);

        try {
          // prepare (puppeteer) page in parallel with ast parsing,
          // as operations are independent and both expensive
          // (ast parsing primarily on larger stylesheets)
          var _ref9 = yield Promise.all([preparePage({
            page,
            width,
            height,
            browser,
            userAgent,
            customPageHeaders,
            blockJSRequests,
            cleanupAndExit
          }), astFromCss({
            cssString,
            strict
          })]),
              _ref10 = _slicedToArray(_ref9, 2);

          const updatedPage = _ref10[0],
                ast = _ref10[1];

          page = updatedPage;

          // first strip out non matching media queries.
          // Need to be done before buildSelectorProfile;
          // although could shave of further time via doing it as part of buildSelectorProfile..
          (0, _nonMatchingMediaQueryRemover2.default)(ast, width, height, keepLargerMediaQueries);
          debuglog('stripped out non matching media queries');

          // load the page (slow)
          // in parallel with preformatting the css
          // - for improved performance

          var _ref11 = yield Promise.all([loadPage(page, url, timeout, pageLoadSkipTimeout), (0, _selectorsProfile2.default)(ast, forceInclude)]),
              _ref12 = _slicedToArray(_ref11, 2),
              _ref12$ = _ref12[1];

          const selectorNodeMap = _ref12$.selectorNodeMap,
                selectors = _ref12$.selectors;


          if (!page) {
            // in case we timed out
            debuglog('page load TIMED OUT');
            cleanupAndExit({ error: new Error('Page load timed out') });
            return;
          }

          let criticalSelectors;
          try {
            ;
            var _ref13 = yield Promise.all([
            // grab a "before" screenshot (if takeScreenshots) - of the page fully loaded (without JS in default settings)
            // in parallel with...
            takeScreenshots && grabPageScreenshot({
              type: 'before',
              page,
              screenshots,
              screenshotExtension,
              debuglog
            }),
            // ...prunning the critical css (selector list)
            page.evaluate(_pruneNonCriticalSelectors2.default, {
              selectors,
              renderWaitTime
            }).then(function (criticalSelectors) {
              debuglog('pruneNonCriticalSelectors done');
              return criticalSelectors;
            })]);

            var _ref14 = _slicedToArray(_ref13, 2);

            criticalSelectors = _ref14[1];
          } catch (err) {
            debuglog('grabPageScreenshot OR pruneNonCriticalSelector threw an error: ' + err);
            cleanupAndExit({ error: err });
            return;
          }

          debuglog('AST cleanup start');
          // NOTE: this function mutates the AST
          (0, _postformatting2.default)({
            ast,
            selectorNodeMap,
            criticalSelectors,
            propertiesToRemove,
            maxEmbeddedBase64Length
          });
          debuglog('AST cleanup done');

          const css = _cssTree2.default.generate(ast);
          debuglog('generated CSS from AST');

          if (takeScreenshots) {
            debuglog('inline critical styles for after screenshot');
            yield page.evaluate(_replacePageCss2.default, { css });
            yield grabPageScreenshot({
              type: 'after',
              page,
              screenshots,
              screenshotExtension,
              debuglog
            });
          }

          debuglog('generateCriticalCss DONE');

          cleanupAndExit({ returnValue: css });
        } catch (e) {
          cleanupAndExit({ error: e });
        }
      });

      return function (_x10, _x11) {
        return _ref7.apply(this, arguments);
      };
    })());
  });

  return function pruneNonCriticalCssLauncher(_x9) {
    return _ref6.apply(this, arguments);
  };
})();

var _cssTree = require('css-tree');

var _cssTree2 = _interopRequireDefault(_cssTree);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _pruneNonCriticalSelectors = require('./browser-sandbox/pruneNonCriticalSelectors');

var _pruneNonCriticalSelectors2 = _interopRequireDefault(_pruneNonCriticalSelectors);

var _replacePageCss = require('./browser-sandbox/replacePageCss');

var _replacePageCss2 = _interopRequireDefault(_replacePageCss);

var _postformatting = require('./postformatting');

var _postformatting2 = _interopRequireDefault(_postformatting);

var _selectorsProfile = require('./selectors-profile');

var _selectorsProfile2 = _interopRequireDefault(_selectorsProfile);

var _nonMatchingMediaQueryRemover = require('./non-matching-media-query-remover');

var _nonMatchingMediaQueryRemover2 = _interopRequireDefault(_nonMatchingMediaQueryRemover);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const debuglog = (0, _debug2.default)('penthouse:core');

function blockinterceptedRequests(interceptedRequest) {
  const isJsRequest = /\.js(\?.*)?$/.test(interceptedRequest.url);
  if (isJsRequest) {
    interceptedRequest.abort();
  } else {
    interceptedRequest.continue();
  }
}

exports.default = pruneNonCriticalCssLauncher;