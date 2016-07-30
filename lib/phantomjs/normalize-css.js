'use strict'
var fs = require('fs')
// phantom js related
var system = require('system')
var webpage = require('webpage')
var jsesc = require('jsesc')

var START_TIME = new Date().getTime()

var stdout = system.stdout // for using this as a file
var page // initiated by prepareNewPage

var args = system.args
if (args.length < 2) {
  errorlog('Not enough arguments.')
  phantomExit(1)
}


var options = {
  url: args[1],
  css: args[2],
  userAgent: args[3],
  debugMode: args[4] === 'true'
}


var debuglog = function (msg, isError) {
  if (options.debugMode) {
    system.stderr.write('time: ' + (new Date().getTime() - START_TIME) + ' | ' + (isError ? 'ERR: ' : '') + msg)
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


function prepareNewPage () {
  debuglog('prepareNewPage')
  page = webpage.create()
  // don't confuse analytics more than necessary when visiting websites
  page.settings.userAgent = options.userAgent

  /* prevent page JS errors from being output to final CSS */
  page.onError = function (msg, trace) {
    // do nothing
  }

  page.onConsoleMessage = function (msg) {
    debuglog(msg)
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
    stdout.write(callbackObject.css)
    debuglog('normalization: DONE!')
    phantomExit(0)
  }
}

// executed inside PhantomJS sandbox environment
function extractFullCssFromPage (originalCss) {
  console.log('extractFullCssFromPage')

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
  console.log('extractFullCssFromPage :' + originalCss.length)
  var css = Array.prototype.map.call(document.styleSheets, function (stylesheet, idx) {
    return handleCssRules(stylesheet.cssRules)
  }).join(' ')

  console.log('extractFullCssFromPage, css extracted :' + css.length)

  // Chrome returns all strings as single quotes, so don't need to look for double quotes
  css = css.replace(/'\\\\/g, '\'\\')

  // these (case 0) @-rules are not part of document.styleSheets, so need to be preserved manually
  var metaMatches = originalCss.match(/(@(import|namespace)[^;]*;)/g)
  if (metaMatches) {
    console.log('extractFullCssFromPage, metamatches')
    // preserve order
    var metaCss = ''
    metaMatches.forEach(function (metaMatch) {
      metaCss += metaMatch
    })
    css = metaCss + css
  }
  console.log('extractFullCssFromPage, metamatches DONE')

  window.callPhantom({ css: css })
}

function normalizeCss (css) {
  debuglog('normalizeCss: ' + css.length)
  // need to escape hex referenced unicode chars in content:'' declarations,
  // otherwise they get lost when extracting from browser in normalising step.
  // Using jsesc library for this.
  // NOTE: alternative solution:
  // check length of matched innerContent,
  // if 1, just take charcodeAt(0).toString(16) and prepend '\'
  // otherwise if starts with `\`, add another one
  css = css.replace(/(content\s*:\s*)(['"])([^'"]*)(['"])/g, function (match, pre, quote, innerContent, quote2) {
    if (quote !== quote2) {
      return
    }
    return pre + quote + jsesc(innerContent) + quote
  })
  // .. however it's not perfect for our needs,
  // as we need to be able to convert back to CSS acceptable format.
  // i.e. need to go from `\f` to `\\f` (and then back afterwards),
  // and need to use `\2022` rather than `u2022`...
  // this is not rigourously tested and not following any spec, needs to be improved.
  .replace(/(['"])(\\)([^\\])/g, function (match, quote, slash, firstInnerContentChar) {
    if (firstInnerContentChar === 'u') {
      return quote + slash + slash
    }
    return quote + slash + slash + firstInnerContentChar
  })

  debuglog('escaped hex in normalizeCss')
  prepareNewPage()
  page.content = '<html><head><style>' + css + '</style></head><body></body></html>'
  page.evaluate(extractFullCssFromPage, encodeURIComponent(css))
}


// main
if (options.debugMode) {
  system.stderr.write('NORMALIZATION')
}

var css
try {
  var f = fs.open(options.css, 'r')
  css = f.read()
  debuglog('opened css')
} catch (e) {
  errorlog(e)
  phantomExit(1)
}

normalizeCss(css)
