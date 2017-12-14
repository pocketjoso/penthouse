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
  let usedCriticalRules = unusedKeyframeRemover(astRulesCritical)
  debuglog('unusedKeyframeRemover AFTER, length: ' + usedCriticalRules.length)

  // remove data-uris that are too long
  // ..faster if this removal can be combined with @font-face one into same iteration..
  usedCriticalRules = embeddedbase64Remover(
    usedCriticalRules,
    maxEmbeddedBase64Length
  )
  debuglog('embeddedbase64Remover')

  const finalAst = csstree.fromPlainObject({
    type: 'StyleSheet',
    children: usedCriticalRules
  })

  let finalCss = csstree.translate(finalAst)
  debuglog('stringify from ast')

  // remove unused @fontface rules
  finalCss = ffRemover(finalCss)
  debuglog('ffRemover')

  debuglog('propertiesToRemove')
  // remove irrelevant css properties
  try {
    finalCss = apartment(finalCss, {
      properties: propertiesToRemove
    })
    debuglog('removed properties via apartment')
  } catch (e) {
    debuglog('FAILED to remove properties via apartment: ' + e)
  }

  return finalCss
}
