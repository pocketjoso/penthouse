var cssMediaQuery = require('css-mediaquery')
// only filter out: print, min-width > width and min-height > height

function _isMatchingMediaQuery (rule, matchConfig) {
  if (rule.type !== 'media') {
    // ignore (keep) all non media query rules
    return true
  }

  try {
    var mediaAST = cssMediaQuery.parse(rule.media)
  } catch (e) {
    // cant parse, most likely browser cant either
    return false
  }
  var keep = mediaAST.some(function (mq) {
    if (mq.type === 'print') {
      return false
    }
    // f.e. @media all {}
    // go for false positives over false negatives,
    // i.e. accept @media randomThing {}
    if (mq.expressions.length === 0) {
      return true
    }
    return mq.expressions.some(function (expression, index) {
      if (expression.modifier === 'min') {
        return cssMediaQuery.match('(min-' + expression.feature + ':' + expression.value + ')', matchConfig)
      } else {
        return true
      }
    })
  })
  return keep
}

function nonMatchingMediaQueryRemover (rules, width, height) {
  var matchConfig = { type: 'screen', width: width + 'px', height: height + 'px' }
  return rules.filter(function (rule) {
    return _isMatchingMediaQuery(rule, matchConfig)
  })
}

if (typeof module !== 'undefined') {
  module.exports = nonMatchingMediaQueryRemover
}
