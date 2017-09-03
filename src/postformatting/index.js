const cssAstFormatter = require('css-fork-pocketjoso')
const embeddedbase64Remover = require('./embedded-base64-remover')
const ffRemover = require('./unused-fontface-remover')
const unusedKeyframeRemover = require('./unused-keyframe-remover')
import apartment from 'apartment'

module.exports = function postformatting ({
  criticalAstRules,
  maxEmbeddedBase64Length,
  debuglog
}) {
  const usedCriticalRules = unusedKeyframeRemover(criticalAstRules)
  debuglog('postformatting: unusedKeyframeRemover')

  let finalCss = cssAstFormatter.stringify({
    stylesheet: {
      rules: usedCriticalRules
    }
  })
  debuglog('postformatting: stringify from ast')

  // remove data-uris that are too long
  // ..faster if this removal can be combined with @font-face one into same iteration..
  finalCss = embeddedbase64Remover(finalCss, maxEmbeddedBase64Length)
  debuglog('postformatting: embeddedbase64Remover')

  // remove unused @fontface rules
  finalCss = ffRemover(finalCss)
  debuglog('postformatting: ffRemover')

  // remove irrelevant css properties
  finalCss = apartment(finalCss, {
    properties: [
      '(.*)transition(.*)',
      'cursor',
      'pointer-events',
      '(-webkit-)?tap-highlight-color',
      '(.*)user-select'
    ],
    // TODO: move into pruneNonCriticalCss script
    selectors: ['::(-moz-)?selection']
  })
  debuglog('postformatting: cleaned css via apartment')

  return finalCss
}
