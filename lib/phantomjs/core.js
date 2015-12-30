'use strict'

var cssAstFormatter = require('css'),
  embeddedbase64Remover = require('./embedded-base64-remover'),
  ffRemover = require('./unused-fontface-remover'),
  fs = require('fs'),
  nonMatchingMediaQueryRemover = require('./non-matching-media-query-remover'),
  system = require('system'),
  stdout = system.stdout, // for using this as a file
  webpage = require('webpage'),
  page // initialised in prepareNewPage

var args = system.args
if (args.length < 4) {
  errorlog('Not enough arguments.')
  phantomExit(1)
}

var criticalCssOptions = {
  url: args[1],
  css: args[2],
  width: args[3],
  height: args[4],
  // always forceInclude '*' selector
  forceInclude: [{ value: '*' }].concat(JSON.parse(args[5]) || []),
  strict: args[6] === 'true',
  maxEmbeddedBase64Length: args[7]
}

var NORMALIZATION_DONE = 'NORMALIZATION_DONE'
var GENERATION_DONE = 'GENERATION_DONE'

var combineArgsString = function (argsArr) {
  return [].join.call(argsArr, ' ') + '\n'
}

// monkey patch for directing errors to stderr
// https://github.com/ariya/phantomjs/issues/10150#issuecomment-28707859
var errorlog = function () {
  system.stderr.write(combineArgsString(arguments))
}

function prepareNewPage () {
  page = webpage.create()
  // don't confuse analytics more than necessary when visiting websites
  page.settings.userAgent = 'Penthouse Critical Path CSS Generator'

  /* prevent page JS errors from being output to final CSS */
  page.onError = function (msg, trace) {
    // do nothing
  }

  page.onResourceRequested = function (requestData, request) {
    if (/\.js(\?.*)?$/.test(requestData.url)) {
      request.abort()
    }
  }

  page.onResourceError = function (resourceError) {
    page.reason = resourceError.errorString
    page.reason_url = resourceError.url
  }
  page.onCallback = function (callbackObject) {
    if (callbackObject.status === NORMALIZATION_DONE) {
      // because otherwise the actual url we want to open a page with will open with
      // content set in normalizeCss..
      prepareNewPage()
      criticalCssOptions.ast = cssAstFormatter.parse(callbackObject.css, { silent: true })
      getCriticalPathCss(criticalCssOptions)
      return
    }

    if (callbackObject.status === GENERATION_DONE) {
      returnCssFromAstRules(callbackObject.rules)
    }
  }
}

function returnCssFromAstRules (criticalRules) {
  try {
    if (criticalRules && criticalRules.length > 0) {
      var finalCss = cssAstFormatter.stringify({
        stylesheet: {
          rules: criticalRules
        }
      })

      // remove data-uris that are too long
      // ..faster if this removal can be combined with @font-face one into same iteration..
      finalCss = embeddedbase64Remover(finalCss, criticalCssOptions.maxEmbeddedBase64Length)

      // remove unused @fontface rules
      finalCss = ffRemover(finalCss)

      if (finalCss.trim().length === 0) {
        errorlog('Note: Generated critical css was empty for URL: ' + criticalCssOptions.url)
      }

      // return the critical css!
      stdout.write(finalCss)
      phantomExit(0)
    } else {
      // No css. This is not an error on our part
      // but still safer to warn the end user, in case they made a mistake
      errorlog('Note: Generated critical css was empty for URL: ' + criticalCssOptions.url)
      // for consisteny, still generate output (will be empty)
      stdout.write('')
      phantomExit(0)
    }
  } catch (ex) {
    errorlog('error: ' + ex)
    phantomExit(1)
  }
}

// discard stdout from phantom exit
function phantomExit (code) {
  if (page) {
    page.close()
  }
  setTimeout(function () {
    phantom.exit(code)
  }, 0)
}

function extractFullCssFromPage (doneStatus, originalCss) {
  var getOriginalSelectorCase = function (selector) {
    var sanitizedSelector = selector.replace(/[#-.]|[[-^]|[?|{}]/g, '\\$&')
    var pattern = new RegExp('(' + sanitizedSelector + ')[ ,{]?', 'i') // }
    var match = originalCss.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
    return selector
  }
  // can't just return rule.cssText here, because these selectors are forced lowercase (in Chrome),
  // but querySelectorAll is case sensitive (for selectors containing certain reserved words, such as float)
  // therefor need to go back to original styles and grab original (case) name for each selector..
  var handleRuleSelectorCase = function (cssStyleRule) {
    var selectors = cssStyleRule.selectorText.split(',').map(getOriginalSelectorCase).join(',')
    return selectors + '{' + cssStyleRule.style.cssText + '}'
  }

  var handleCssRule = function (rule) {
    if (!rule.selectorText) {
      if (!rule.media) {
        return rule.cssText
      }
      var mediaContent = handleCssRules(rule.cssRules)
      return '@media ' + rule.media.mediaText + '{' + mediaContent + '}'
    }
    return handleRuleSelectorCase(rule)
  }
  var handleCssRules = function (cssRulesList) {
    return Array.prototype.map.call(cssRulesList || [], handleCssRule).join(' ')
  }

  originalCss = decodeURIComponent(originalCss)
  var css = Array.prototype.map.call(document.styleSheets, function (stylesheet) {
    return handleCssRules(stylesheet.cssRules)
  }).join(' ')

  // these (case 0) @-rules are not part of document.styleSheets, so need to be preserved manually
  var metaMatches = originalCss.match(/(@(import|namespace)[^;]*;)/g)
  if (metaMatches) {
    // preserve order
    var metaCss = ''
    metaMatches.forEach(function (metaMatch) {
      metaCss += metaMatch
    })
    css = metaCss + css
  }
  window.callPhantom({
    status: doneStatus,
    css: css
  })
}

function normalizeCss (css) {
  page.content = '<html><head><style>' + css + '</style></head><body></body></html>'
  page.evaluate(extractFullCssFromPage, NORMALIZATION_DONE, encodeURIComponent(css))
}

// called inside a sandboxed environment inside phantomjs - no outside references
// arguments and return value must be primitives
// @see http://phantomjs.org/api/webpage/method/evaluate.html
function pruneNonCriticalCss (astRules, forceInclude, doneStatus) {
  var h = window.innerHeight
  var renderWaitTime = 100 // ms TODO: user specifiable through options object

  var isElementAboveFold = function (element) {
    // temporarily force clear none in order to catch elements that clear previous content themselves and who w/o their styles could show up unstyled in above the fold content (if they rely on f.e. 'clear:both;' to clear some main content)
    var originalClearStyle = element.style.clear || ''
    element.style.clear = 'none'
    var aboveFold = element.getBoundingClientRect().top < h

    // set clear style back to what it was
    element.style.clear = originalClearStyle
    return aboveFold
  }

  var matchesForceInclude = function (selector) {
    return forceInclude.some(function (includeSelector) {
      if (includeSelector.type === 'RegExp') {
        var pattern = new RegExp(includeSelector.value)
        return pattern.test(selector)
      }
      return includeSelector.value === selector
    })
  }

  var isSelectorCritical = function (selector) {
    if (matchesForceInclude(selector.trim())) {
      return true
    }

    // Case 3: @-rule with full CSS (rules) inside [REMAIN]
    // @viewport, @-ms-viewport. AST parser classifies these as "regular" rules
    if (/^@/.test(selector)) {
      return true
    }

    // some selectors can't be matched on page.
    // In these cases we test a slightly modified selectors instead, modifiedSelector.
    var modifiedSelector = selector
    if (modifiedSelector.indexOf(':') > -1) {
      // handle special case selectors, the ones that contain a semi colon (:)
      // many of these selectors can't be matched to anything on page via JS,
      // but that still might affect the above the fold styling

      // these psuedo selectors depend on an element, so test element instead
      // (:hover, :focus, :active would be treated same
      // IF we wanted to keep them for critical path css, but we don't)
      modifiedSelector = modifiedSelector.replace(/(:?:before|:?:after)*/g, '')

      // if selector is purely psuedo (f.e. ::-moz-placeholder), just keep as is.
      // we can't match it to anything on page, but it can impact above the fold styles
      if (modifiedSelector.replace(/:[:]?([a-zA-Z0-9\-\_])*/g, '').trim().length === 0) {
        return true
      }

      // handle browser specific psuedo selectors bound to elements,
      // Example, button::-moz-focus-inner, input[type=number]::-webkit-inner-spin-button
      // remove browser specific pseudo and test for element
      modifiedSelector = modifiedSelector.replace(/:?:-[a-z-]*/g, '')
    }

    // now we have a selector to test, first grab any matching elements
    var elements
    try {
      elements = document.querySelectorAll(modifiedSelector)
    } catch (e) {
      // not a valid selector, remove it.
      return false
    }

    // some is not supported on Arrays in this version of QT browser,
    // meaning have to write much less terse code here.
    var elementIndex = 0
    var aboveFold = false
    while (!aboveFold && elementIndex < elements.length) {
      aboveFold = isElementAboveFold(elements[elementIndex])
      elementIndex++
    }
    return aboveFold
  }

  var isCssRuleCritical = function (rule) {
    if (rule.type === 'rule') {
      // check what, if any selectors are found above fold
      rule.selectors = rule.selectors.filter(isSelectorCritical)
      return rule.selectors.length > 0
    }
    /* ==@-rule handling==*/
    /* - Case 0 : Non nested @-rule [REMAIN]
     (@charset, @import, @namespace)
     */
    if (
      rule.type === 'charset' ||
      rule.type === 'import' ||
      rule.type === 'namespace'
    ) {
      return true
    }

    /* Case 1: @-rule with CSS properties inside [REMAIN]
    	@font-face - keep here, but remove later in code, unless it is used.
    */
    if (rule.type === 'font-face') {
      return true
    }

    /* Case 3: @-rule with full CSS (rules) inside [REMAIN]
    */
    if (
      // non matching media queries are stripped out in non-matching-media-query-remover.js
      rule.type === 'media' ||
      rule.type === 'document' ||
      rule.type === 'supports'
    ) {
      rule.rules = rule.rules.filter(isCssRuleCritical)
      return rule.rules.length > 0
    }

    return false
  }

  var processCssRules = function () {
    var criticalRules = astRules.filter(isCssRuleCritical)

    // we're done - call final function to exit outside of phantom evaluate scope
    window.callPhantom({
      status: doneStatus,
      rules: criticalRules
    })
  }

  // give some time (renderWaitTime) for sites like facebook that build their page dynamically,
  // otherwise we can miss some selectors (and therefor rules)
  // --tradeoff here: if site is too slow with dynamic content,
  //	it doesn't deserve to be in critical path.
  setTimeout(processCssRules, renderWaitTime)
}

/*
 * Tests each selector in css file at specified resolution,
 * to see if any such elements appears above the fold on the page
 * calls callPhantom when done, with an updated AST rules list
 *
 * @param options.url the url as a string
 * @param options.ast the css as an AST object
 * @param options.width the width of viewport
 * @param options.height the height of viewport
 ---------------------------------------------------------*/
function getCriticalPathCss (options) {
  page.viewportSize = {
    width: options.width,
    height: options.height
  }
  // first strip out non matching media queries
  var astRules = nonMatchingMediaQueryRemover(options.ast.stylesheet.rules, options.width, options.height)

  page.open(options.url, function (status) {
    if (status !== 'success') {
      errorlog("Error opening url '" + page.reason_url + "': " + page.reason)
      phantomExit(1)
    } else {
      page.evaluate(pruneNonCriticalCss, astRules, options.forceInclude, GENERATION_DONE)
    }
  })
}

var css
try {
  var f = fs.open(criticalCssOptions.css, 'r')
  css = f.read()
} catch (e) {
  errorlog(e)
  phantomExit(1)
}

prepareNewPage()
var ast
try {
  ast = cssAstFormatter.parse(css)
} catch (e) {
  if (criticalCssOptions.strict) {
    errorlog(e.message)
    phantomExit(1)
  }
  normalizeCss(css)
}

if (ast) {
  criticalCssOptions.ast = ast
  getCriticalPathCss(criticalCssOptions)
}
