import csstree from 'css-tree'
import cssMediaQuery from 'css-mediaquery'
import debug from 'debug'

const debuglog = debug('penthouse:preformatting:nonMatchingMediaQueryRemover')

// only filters out:
//  - @print
//  - min-width > width OR min-height > height
// and the latter only if !keepLargerMediaQueries (which is the default)
function _isMatchingMediaQuery (mediaQuery, matchConfig) {
  // TODO: use the media query parsing from css-tree instead
  let mediaAST
  try {
    mediaAST = cssMediaQuery.parse(mediaQuery)
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

  return keep
}

function nonMatchingMediaQueryRemover (
  ast,
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

  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, item, list) => {
      // ignore (keep) all non media query rules
      if (csstree.keyword(atrule.name).name !== 'media') {
        return
      }
      // this can happen - why? (atrule.prelude === null)
      // and should we remove this rule here, or keep it?
      if (!atrule.prelude) {
        return
      }
      const mediaQuery = csstree.generate(atrule.prelude)
      const isMatching = _isMatchingMediaQuery(mediaQuery, matchConfig)
      if (!isMatching) {
        debuglog('DROP: ' + `(${mediaQuery}), `)
        list.remove(item)
      }
    }
  })

  return ast
}

module.exports = nonMatchingMediaQueryRemover
