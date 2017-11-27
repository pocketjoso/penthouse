'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

let blockJsRequests = (() => {
  var _ref = _asyncToGenerator(function* (page) {
    yield page.setRequestInterception(true);
    page.on('request', blockinterceptedRequests);
  });

  return function blockJsRequests(_x) {
    return _ref.apply(this, arguments);
  };
})();

let pruneNonCriticalCssLauncher = (() => {
  var _ref2 = _asyncToGenerator(function* ({
    browser,
    url,
    astRules,
    width,
    height,
    forceInclude,
    userAgent,
    renderWaitTime,
    timeout,
    pageLoadSkipTimeout,
    blockJSRequests,
    customPageHeaders,
    screenshots,
    propertiesToRemove,
    maxEmbeddedBase64Length,
    debuglog
  }) {
    let _hasExited = false;
    const takeScreenshots = screenshots && screenshots.basePath;
    const screenshotExtension = takeScreenshots && screenshots.type === 'jpeg' ? '.jpg' : '.png';

    return new Promise((() => {
      var _ref3 = _asyncToGenerator(function* (resolve, reject) {
        let cleanupAndExit = (() => {
          var _ref4 = _asyncToGenerator(function* ({ error, returnValue }) {
            if (_hasExited) {
              return;
            }
            _hasExited = true;

            clearTimeout(killTimeout);
            // page.close will error if page/browser has already been closed;
            // try to avoid
            if (page && !(error && error.toString().indexOf('Target closed') > -1)) {
              // must await here, otherwise will receive errors if closing
              // browser before page is properly closed
              yield page.close();
            }
            if (error) {
              reject(error);
              return;
            }
            resolve(returnValue);
          });

          return function cleanupAndExit(_x5) {
            return _ref4.apply(this, arguments);
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
          page = yield browser.newPage();
          debuglog('new page opened in browser');

          yield page.setViewport({ width, height });
          debuglog('viewport set');

          yield page.setUserAgent(userAgent);

          if (customPageHeaders) {
            try {
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
            // pass through log messages
            // - the ones sent by penthouse for debugging has 'debug: ' prefix.
            if (/^debug: /.test(msg)) {
              debuglog(msg.replace(/^debug: /, ''));
            }
          });

          debuglog('page load start');
          // set a higher number than the timeout option, in order to make
          // puppeteer’s timeout _never_ happen
          const loadPagePromise = page.goto(url, { timeout: timeout + 1000 });
          if (pageLoadSkipTimeout) {
            yield Promise.race([loadPagePromise, new Promise(function (resolve) {
              // instead we manually _abort_ page load after X time,
              // in order to deal with spammy pages that keep sending non-critical requests
              // (tracking etc), which would otherwise never load.
              // With JS disabled it just shouldn't take that many seconds to load what's needed
              // for critical viewport.
              setTimeout(function () {
                debuglog('page load waiting ABORTED after ' + pageLoadSkipTimeout / 1000 + 's. ');
                resolve();
              }, pageLoadSkipTimeout);
            })]);
          } else {
            yield loadPagePromise;
          }
          debuglog('page load DONE');

          if (!page) {
            // in case we timed out
            return;
          }

          // grab a "before" screenshot - of the page fully loaded, without JS
          // TODO: could potentially do in parallel with the page.evaluate
          if (takeScreenshots) {
            debuglog('take before screenshot');
            const beforePath = screenshots.basePath + '-before' + screenshotExtension;
            yield page.screenshot(_extends({}, screenshots, {
              path: beforePath
            }));
            debuglog('take before screenshot DONE: ' + beforePath);
          }

          const criticalAstRules = yield page.evaluate(_pruneNonCriticalCss2.default, {
            astRules,
            forceInclude,
            renderWaitTime
          });
          debuglog('generateCriticalCss done, now postformat');

          const formattedCss = (0, _postformatting2.default)({
            criticalAstRules,
            propertiesToRemove,
            maxEmbeddedBase64Length,
            debuglog
          });
          debuglog('postformatting done');

          if (takeScreenshots) {
            debuglog('inline critical styles for after screenshot');
            yield page.evaluate(_replacePageCss2.default, {
              css: formattedCss
            });
            debuglog('take after screenshot');
            const afterPath = screenshots.basePath + '-after' + screenshotExtension;
            yield page.screenshot(_extends({}, screenshots, {
              path: afterPath
            }));
            debuglog('take after screenshot DONE: ' + afterPath);
          }

          cleanupAndExit({ returnValue: formattedCss });
        } catch (e) {
          cleanupAndExit({ error: e });
        }
      });

      return function (_x3, _x4) {
        return _ref3.apply(this, arguments);
      };
    })());
  });

  return function pruneNonCriticalCssLauncher(_x2) {
    return _ref2.apply(this, arguments);
  };
})();

var _pruneNonCriticalCss = require('./browser-sandbox/pruneNonCriticalCss');

var _pruneNonCriticalCss2 = _interopRequireDefault(_pruneNonCriticalCss);

var _replacePageCss = require('./browser-sandbox/replacePageCss');

var _replacePageCss2 = _interopRequireDefault(_replacePageCss);

var _postformatting = require('./postformatting/');

var _postformatting2 = _interopRequireDefault(_postformatting);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function blockinterceptedRequests(interceptedRequest) {
  const isJsRequest = /\.js(\?.*)?$/.test(interceptedRequest.url);
  if (isJsRequest) {
    interceptedRequest.abort();
  } else {
    interceptedRequest.continue();
  }
}

exports.default = pruneNonCriticalCssLauncher;