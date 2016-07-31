'use strict'

var fs = require('fs')
// phantom js related
var system = require('system')
var webpage = require('webpage')
var jsesc = require('jsesc')

var nonMatchingMediaQueryRemover = require('./non-matching-media-query-remover')

var NORMALIZATION_DONE = 'NORMALIZATION_DONE'
var GENERATION_DONE = 'GENERATION_DONE'

var stdout = system.stdout // for using this as a file
var page // initialised in prepareNewPage

var args = system.args
if (args.length < 4) {
  errorlog('Not enough arguments.')
  phantomExit(1)
}

var criticalCssOptions = {
  url: args[1],
  ast: args[2],
  width: args[3],
  height: args[4],
  // always forceInclude '*' selector
  forceInclude: [{ value: '*' }].concat(JSON.parse(args[5]) || []),
  userAgent: args[6],
  debugMode: args[7] === 'true'
}

// monkey patch for directing errors to stderr
// https://github.com/ariya/phantomjs/issues/10150#issuecomment-28707859
var errorlog = function (msg) {
  if (criticalCssOptions.debugMode) {
    debuglog(msg, true)
  } else {
    system.stderr.write(msg)
  }
}

var debuglog = function (msg, isError) {
  if (criticalCssOptions.debugMode) {
    system.stderr.write((isError ? 'ERR: ' : '') + msg)
  }
}

function prepareNewPage () {
  debuglog('prepareNewPage')
  page = webpage.create()
  // don't confuse analytics more than necessary when visiting websites
  page.settings.userAgent = criticalCssOptions.userAgent

  /* prevent page JS errors from being output to final CSS */
  page.onError = function (msg, trace) {
    // do nothing
  }

  page.onConsoleMessage = function (msg) {
    // filter out console messages from the page
    // - the ones sent by penthouse for debugging has 'debug: ' prefix.
    if (/^debug: /.test(msg)) {
      debuglog(msg.replace(/^debug: /, ''))
    }
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
    if (callbackObject.status === GENERATION_DONE) {
      debuglog('GENERATION_DONE')
      returnCssFromAstRules(callbackObject.rules)
    }
  }
}

function returnCssFromAstRules (criticalRules) {
  debuglog('returnCssFromAstRules')
  try {
    if (criticalRules && criticalRules.length > 0) {
      stdout.write(JSON.stringify(criticalRules))
      debuglog('finalCss: write - DONE!')
      phantomExit(0)
    } else {
      // No css. Warning will be raised later in process.
      // for consisteny, still generate output (will be empty)
      stdout.write([JSON.stringify([])])
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
  console.log('debug: extractFullCssFromPage')

  var handleCssRule = function (rule) {
    if (!rule.selectorText) {
      if (!rule.media) {
        return rule.cssText
      }
      var mediaContent = handleCssRules(rule.cssRules)
      return '@media ' + rule.media.mediaText + '{' + mediaContent + '}'
    }
    return rule.cssText
  }
  var handleCssRules = function (cssRulesList) {
    return Array.prototype.map.call(cssRulesList || [], handleCssRule).join(' ')
  }

  originalCss = decodeURIComponent(originalCss)
  console.log('debug: extractFullCssFromPage :' + originalCss.length)
  var css = Array.prototype.map.call(document.styleSheets, function (stylesheet, idx) {
    return handleCssRules(stylesheet.cssRules)
  }).join(' ')

  console.log('debug: extractFullCssFromPage, css extracted :' + css.length)

  // Chrome returns all strings as single quotes, so don't need to look for double quotes
  css = css.replace(/'\\\\/g, '\'\\')

  // these (case 0) @-rules are not part of document.styleSheets, so need to be preserved manually
  var metaMatches = originalCss.match(/(@(import|namespace)[^;]*;)/g)
  if (metaMatches) {
    console.log('debug: extractFullCssFromPage, metamatches')
    // preserve order
    var metaCss = ''
    metaMatches.forEach(function (metaMatch) {
      metaCss += metaMatch
    })
    css = metaCss + css
  }
  console.log('debug: extractFullCssFromPage, metamatches DONE, callPhantom')
  window.callPhantom({
    status: doneStatus,
    css: css
  })
}

// called inside a sandboxed environment inside phantomjs - no outside references
// arguments and return value must be primitives
// @see http://phantomjs.org/api/webpage/method/evaluate.html
function pruneNonCriticalCss (astRules, forceInclude, doneStatus) {
  console.log('debug: pruneNonCriticalCss')
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
      @font-face, @keyframes - keep here, but remove later in code, unless it is used.
    */
    if (
        rule.type === 'font-face' ||
        rule.type === 'keyframes'
    ) {
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
    console.log('debug: processCssRules BEFORE')
    var criticalRules = astRules.filter(isCssRuleCritical)
    console.log('debug: processCssRules AFTER')

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
  debuglog('getCriticalPathCss')
  prepareNewPage()
  page.viewportSize = {
    width: options.width,
    height: options.height
  }
  // first strip out non matching media queries
  var astRules = nonMatchingMediaQueryRemover(options.ast.stylesheet.rules, options.width, options.height)
  debuglog('stripped out non matching media queries')

  page.open(options.url, function (status) {
    if (status !== 'success') {
      errorlog("Error opening url '" + page.reason_url + "': " + page.reason)
      phantomExit(1)
    } else {
      debuglog('page opened')
      page.evaluate(pruneNonCriticalCss, astRules, options.forceInclude, GENERATION_DONE)
    }
  })
}

debuglog('Penthouse core start')
var ast
try {
  var f = fs.open(criticalCssOptions.ast, 'r')
  ast = f.read()
  debuglog('opened ast from file')
  ast = JSON.parse(ast)
  debuglog('parsed ast from json')
} catch (e) {
  errorlog(e)
  phantomExit(1)
}

criticalCssOptions.ast = ast
getCriticalPathCss(criticalCssOptions)
