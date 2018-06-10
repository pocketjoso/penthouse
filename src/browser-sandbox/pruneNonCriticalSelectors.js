// executed inside sandboxed browser environment,
// no access to scrope outside of function
export default function pruneNonCriticalSelectors ({
  selectors,
  renderWaitTime,
  maxElementsToCheckPerSelector
}) {
  console.log('debug: pruneNonCriticalSelectors init')
  var h = window.innerHeight

  // cache whether elements are above fold,
  // primarily because getBoundingClientRect() can be slow to query,
  // and some stylesheets have lots of generic selectors (like '.button', '.fa' etc)
  var isElementAboveFoldCache = new Map()

  function isElementAboveFold (element) {
    if (isElementAboveFoldCache.has(element)) {
      return isElementAboveFoldCache.get(element)
    }

    // temporarily force clear none in order to catch elements that clear previous
    // content themselves and who w/o their styles could show up unstyled in above
    // the fold content (if they rely on f.e. 'clear:both;' to clear some main content)
    var originalClearStyle = element.style.clear || ''
    element.style.clear = 'none'
    var aboveFold = element.getBoundingClientRect().top < h
    // cache so we dont have to re-query DOM for this value
    isElementAboveFoldCache.set(element, aboveFold)

    // set clear style back to what it was
    element.style.clear = originalClearStyle

    // Should not be needed anymore with Chrome Headless:
    // do some monitoring before complete removing the code (below)
    // if (!aboveFold) {
    //   // phantomJS/QT browser has some bugs regarding fixed position;
    //   // sometimes positioning elements outside of screen incorrectly.
    //   // just keep all fixed position elements - normally very few in a stylesheet anyway
    //   var styles = window.getComputedStyle(element, null)
    //   if (styles.position === 'fixed') {
    //     console.log('debug: force keeping fixed position styles')
    //     return true
    //   }
    // }
    return aboveFold
  }

  function isSelectorCritical (selector) {
    // we have a selector to test, first grab any matching elements
    let elements
    try {
      elements = document.querySelectorAll(selector)
    } catch (e) {
      // not a valid selector, remove it.
      return false
    }

    let nrElementsToCheck = elements.length
    if (
      maxElementsToCheckPerSelector &&
      nrElementsToCheck > maxElementsToCheckPerSelector
    ) {
      console.log(
        `debug: isSelectorCritical, selector: ${selector} appearing ${nrElementsToCheck} time on page, ONLY checking first ${maxElementsToCheckPerSelector}...`
      )
      nrElementsToCheck = maxElementsToCheckPerSelector
    }

    // only keep selectors that match at least one elements on the page above the fold
    for (let idx = 0; idx < nrElementsToCheck; idx++) {
      if (isElementAboveFold(elements[idx])) {
        return true
      }
    }

    return false
  }

  function filterSelectors (selectors) {
    console.log('debug: filterSelectors START')

    selectors = selectors.filter(isSelectorCritical)

    console.log('debug: filterSelectors DONE')
    return selectors
  }

  function pollUntilTimePassed (start, timeToPass, callback) {
    window.requestAnimationFrame(() => {
      const timePassed = Date.now() - start
      if (timePassed >= timeToPass) {
        callback()
      } else {
        pollUntilTimePassed(start, timeToPass, callback)
      }
    })
  }
  // not using timeout because does not work with JS disabled
  function sleep (time) {
    return new Promise(resolve =>
      pollUntilTimePassed(Date.now(), time, resolve)
    )
  }

  // give some time (renderWaitTime) for sites like facebook that build their page dynamically,
  // otherwise we can miss some selectors (and therefor rules)
  // --tradeoff here: if site is too slow with dynamic content,
  // it doesn't deserve to be in critical path.
  return sleep(renderWaitTime).then(() => {
    console.log('debug: waited for renderWaitTime: ' + renderWaitTime)
    return filterSelectors(selectors)
  })
}
