import apartment from 'apartment'
import csstree from 'css-tree'
import debug from 'debug'

import embeddedbase64Remover from './embedded-base64-remover'
import ffRemover from './unused-fontface-remover'
import unusedKeyframeRemover from './unused-keyframe-remover'

const debuglog = debug('penthouse:postformatting')

export default function postformatting ({
  astRulesCritical,
  propertiesToRemove,
  maxEmbeddedBase64Length
}) {
  debuglog('start')
  const usedCriticalRules = unusedKeyframeRemover(astRulesCritical)
  debuglog('unusedKeyframeRemover AFTER, length: ' + usedCriticalRules.length)

  const finalAst = csstree.fromPlainObject({
    type: 'StyleSheet',
    children: usedCriticalRules
  })
  let finalCss = csstree.translate(finalAst)
  debuglog('stringify from ast')

  // remove data-uris that are too long
  // ..faster if this removal can be combined with @font-face one into same iteration..
  finalCss = embeddedbase64Remover(finalCss, maxEmbeddedBase64Length)
  debuglog('embeddedbase64Remover')

  // remove unused @fontface rules
  finalCss = ffRemover(finalCss)
  debuglog('ffRemover')

  debuglog('propertiesToRemove')
  // remove irrelevant css properties
  try {
    finalCss = apartment(finalCss, {
      properties: propertiesToRemove,
      // TODO: move into pruneNonCriticalCss script
      selectors: ['::(-moz-)?selection']
    })
    debuglog('cleaned css via apartment')
  } catch (e) {
    debuglog('FAILED to clean css via apartment: ' + e)
  }

  return finalCss
}
