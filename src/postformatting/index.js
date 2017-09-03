import apartment from 'apartment'
import cssAstFormatter from 'css-fork-pocketjoso'

import embeddedbase64Remover from './embedded-base64-remover'
import ffRemover from './unused-fontface-remover'
import unusedKeyframeRemover from './unused-keyframe-remover'

export default function postformatting ({
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
