import cssMediaQuery from 'css-mediaquery'
import debug from 'debug'

const debuglog = debug('penthouse:preformatting:nonMatchingMediaQueryRemover')

// only filters out:
//  - @print
//  - min-width > width OR min-height > height
// and the latter only if !keepLargerMediaQueries (which is the default)
function _isMatchingMediaQuery (rule, matchConfig) {
  if (rule.type !== 'Atrule' || rule.name !== 'media') {
    // ignore (keep) all non media query rules
    return true
  }

  // TODO: use the media query parsing from css-tree instead
  let mediaAST
  try {
    mediaAST = cssMediaQuery.parse(rule.prelude.value)
  } catch (e) {
    // cant parse, most likely browser cant either
    return false
  }

  var keep = mediaAST.some(function (mq) {
    // not sure why css-mediaquery library sometimes flags the inverse as type,
    // rather than the inverse field, but for our purposes we want to treat
    // them the same.
    const isInverse = mq.inverse || mq.type === 'not'
    if (
      (!isInverse && mq.type === 'print') ||
      (isInverse && mq.type === 'screen')
    ) {
      return false
    }
    // f.e. @media all {}
    // go for false positives over false negatives,
    // i.e. accept @media randomThing {}
    if (mq.expressions.length === 0) {
      return true
    }
    return mq.expressions.some(function ({ modifier, feature, value }) {
      if (modifier === 'min') {
        const constructedQuery = `${isInverse ? 'not ' : ''}(min-${feature}: ${value})`
        return cssMediaQuery.match(constructedQuery, matchConfig)
      } else {
        return true
      }
    })
  })
  if (!keep) {
    debuglog('DROP: ' + `(${rule.prelude.value}), `)
  }
  return keep
}

function nonMatchingMediaQueryRemover (
  rules,
  width,
  height,
  keepLargerMediaQueries
) {
  debuglog('BEFORE')
  const matchConfig = {
    type: 'screen',
    width: (keepLargerMediaQueries ? 9999999999 : width) + 'px',
    height: (keepLargerMediaQueries ? 9999999999 : height) + 'px'
  }
  debuglog('matchConfig: ' + JSON.stringify(matchConfig, null, 2))
  const filtered = rules.filter(function (rule) {
    const isMatching = _isMatchingMediaQuery(rule, matchConfig)
    return isMatching
  })
  debuglog('AFTER')
  return filtered
}

if (typeof module !== 'undefined') {
  module.exports = nonMatchingMediaQueryRemover
}
