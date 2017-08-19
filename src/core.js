import puppeteer from 'puppeteer'

function pruneNonCriticalCss ({ astRules, forceInclude }) {
  console.log('debug: pruneNonCriticalCss')
  var h = window.innerHeight
  // TODO: bind with forceInclude argument instead
  var matchesForceInclude = function (selector) {
    return forceInclude.some(function (includeSelector) {
      if (includeSelector.type === 'RegExp') {
        const { source, flags } = includeSelector
        const re = new RegExp(source, flags)
        return re.test(selector)
      }
      return includeSelector.value === selector
    })
  }

  var psuedoSelectorsToKeep = [
    ':before',
    ':after',
    ':visited',
    ':first-letter',
    ':first-line'
  ]
  // detect these selectors regardless of whether one or two semi-colons are used
  var psuedoSelectorsToKeepRegex = psuedoSelectorsToKeep
    .map(function (s) {
      return ':?' + s
    })
    .join('|') // separate in regular expression
  // we will replace all instances of these psuedo selectors; hence global flag
  var PSUEDO_SELECTOR_REGEXP = new RegExp(psuedoSelectorsToKeepRegex, 'g')

  // cache whether elements are above fold,
  // primarily because getBoundingClientRect() can be slow to query,
  // and some stylesheets have lots of generic selectors (like '.button', '.fa' etc)
  var isElementAboveFoldCache = []
  var isElementAboveFold = function (element) {
    // no support for Array.find
    var matching = isElementAboveFoldCache.filter(c => c.element === element)
    var cached = matching && matching[0]
    if (cached) {
      return cached.aboveFold
    }
    // temporarily force clear none in order to catch elements that clear previous content themselves and who w/o their styles could show up unstyled in above the fold content (if they rely on f.e. 'clear:both;' to clear some main content)
    var originalClearStyle = element.style.clear || ''
    element.style.clear = 'none'
    var aboveFold = element.getBoundingClientRect().top < h
    // cache so we dont have to re-query dom for this value
    isElementAboveFoldCache.push({
      element: element,
      aboveFold: aboveFold
    })

    // set clear style back to what it was
    element.style.clear = originalClearStyle

    if (!aboveFold) {
      // phantomJS/QT browser has some bugs regarding fixed position;
      // sometimes positioning elements outside of screen incorrectly.
      // just keep all fixed position elements - normally very few in a stylesheet anyway
      var styles = window.getComputedStyle(element, null)
      if (styles.position === 'fixed') {
        console.log('debug: force keeping fixed position styles')
        return true
      }
    }
    return aboveFold
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
      modifiedSelector = modifiedSelector.replace(PSUEDO_SELECTOR_REGEXP, '')

      // if selector is purely psuedo (f.e. ::-moz-placeholder), just keep as is.
      // we can't match it to anything on page, but it can impact above the fold styles
      if (
        modifiedSelector.replace(/:[:]?([a-zA-Z0-9\-_])*/g, '').trim()
          .length === 0
      ) {
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
    /* ==@-rule handling== */
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
    if (rule.type === 'font-face' || rule.type === 'keyframes') {
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

  var processCssRules = function (astRules) {
    console.log('debug: processCssRules BEFORE')
    var criticalRules = astRules.filter(isCssRuleCritical)
    console.log('debug: processCssRules AFTER')

    // we're done - call final function to exit outside of phantom evaluate scope

    return criticalRules
    // window.callPhantom({
    //   status: doneStatus,
    //   rules: criticalRules
    // })
  }

  return processCssRules(astRules)
}

async function blockJsRequests (page) {
  await page.setRequestInterceptionEnabled(true)
  page.on('request', interceptedRequest => {
    if (interceptedRequest.url.endsWith('.js')) {
      interceptedRequest.abort()
    } else {
      interceptedRequest.continue()
    }
  })
}

async function generateCriticalCss ({
  url,
  astRules,
  width,
  height,
  forceInclude,
  userAgent,
  renderWaitTime,
  blockJSRequests,
  customPageHeaders = {},
  debuglog
}) {
  debuglog('Penthouse core start')

  // launch browser - todo - consider reusing instances
  const browser = await puppeteer.launch()
  debuglog('browser launched')

  const page = await browser.newPage()
  debuglog('new page opened in browser')

  await page.setViewport({ width, height })
  debuglog('viewport set')

  if (blockJSRequests) {
    await blockJsRequests(page)
    debuglog('blocking js requests')
  }
  page.on('console', msg => {
    // pass through log messages
    // - the ones sent by penthouse for debugging has 'debug: ' prefix.
    if (/^debug: /.test(msg)) {
      debuglog(msg.replace(/^debug: /, ''))
    }
  })
  // load page
  // TODO: customize via options
  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagegotourl-options
  // add renderWaitTime (old comment below)
  // give some time (renderWaitTime) for sites like facebook that build their page dynamically,
  // otherwise we can miss some selectors (and therefor rules)
  // --tradeoff here: if site is too slow with dynamic content,
  // it doesn't deserve to be in critical path.
  await page.goto(url)
  debuglog('page loaded')

  const criticalRules = await page.evaluate(pruneNonCriticalCss, {
    astRules,
    forceInclude
  })

  debuglog('GENERATION_DONE')

  // cleanup
  browser.close()

  return criticalRules
}

export default generateCriticalCss
