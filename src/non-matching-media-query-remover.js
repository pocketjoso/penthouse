import csstree from 'css-tree'
import cssMediaQuery from 'css-mediaquery'
import debug from 'debug'

const debuglog = debug('penthouse:preformatting:nonMatchingMediaQueryRemover')

// only filters out:
//  - @print
//  - min-width > width OR min-height > height
//    (the latter only if !keepLargerMediaQueries -- which is the default)
//  - min-width > width AND max-width > width
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

    /*
    costructing the test to match against the mediaquery
    if the mediaquery (mq) has "AND" conditions, mq.expressions is an array of feature objects { modifier, feature, value }
      mq.expressions.length > 1
    if the mediaquery (mq) has "OR"  conditions, the mediaquery is split in _n_ mq objects,
      each having an expressions array of 1 feature objects { modifier, feature, value }
    */
    return mq.expressions.some(function ({ modifier, feature, value }) {
      if (modifier === 'min') {
        const constructedQuery = `${
          isInverse ? 'not ' : ''
        }(min-${feature}: ${value})`
        return cssMediaQuery.match(constructedQuery, matchConfig)
      } else {
        if (mq.expressions.length > 1) {
          const constructedQuery = mq.expressions
            .map(
              ({ modifier, feature, value }) =>
                `${isInverse ? 'not ' : ''}(${modifier}-${feature}: ${value})`
            )
            .join(' and ')
          return cssMediaQuery.match(constructedQuery, matchConfig)
        } else {
          return true
        }
      }
    })
  })

  return keep
}

function nonMatchingMediaQueryRemover (
  ast,
  width,
  height,
  keepLargerMediaQueries = false
) {
  debuglog('BEFORE')
  const matchConfig = {
    type: 'screen',
    width: width + 'px',
    height: height + 'px'
  }
  const matchLargerMQConfig = {
    type: 'screen',
    width: '99999px',
    height: '99999px'
  }
  debuglog(
    'matchConfig: ' +
      JSON.stringify(matchConfig, null, 2) +
      '\n' +
      'keepLargerMediaQueries: ' +
      keepLargerMediaQueries
  )

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
      // ismatching true when mq must be kept
      // if keep larger mq, keep if matching OR matching matchKeepLargeConfig
      const isMatching = keepLargerMediaQueries
        ? _isMatchingMediaQuery(mediaQuery, matchConfig) ||
          _isMatchingMediaQuery(mediaQuery, matchLargerMQConfig)
        : _isMatchingMediaQuery(mediaQuery, matchConfig)
      if (!isMatching) {
        debuglog('DROP: ' + `(${mediaQuery}), `)
        list.remove(item)
      } else {
        debuglog('KEEP: ' + `(${mediaQuery}), `)
      }
    }
  })

  return ast
}

module.exports = nonMatchingMediaQueryRemover
