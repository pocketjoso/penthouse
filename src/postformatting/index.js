import csstree from 'css-tree'
import debug from 'debug'

import embeddedbase64Remover from './embedded-base64-remover'
import ffRemover from './unused-fontface-remover'
import unusedKeyframeRemover from './unused-keyframe-remover'
import unwantedPropertiesRemover from './unwanted-properties-remover'

const debuglog = debug('penthouse:postformatting')

export default function postformatting ({
  astRulesCritical,
  propertiesToRemove,
  maxEmbeddedBase64Length
}) {
  debuglog('start')

  let filteredCriticalRules = unusedKeyframeRemover(astRulesCritical)
  debuglog('unusedKeyframeRemover')

  // remove data-uris that are too long
  filteredCriticalRules = embeddedbase64Remover(
    filteredCriticalRules,
    maxEmbeddedBase64Length
  )
  debuglog('embeddedbase64Remover')

  // remove irrelevant css properties via rule walking
  filteredCriticalRules = unwantedPropertiesRemover(
    filteredCriticalRules,
    propertiesToRemove
  )
  debuglog('propertiesToRemove')

  const finalAst = csstree.fromPlainObject({
    type: 'StyleSheet',
    children: filteredCriticalRules
  })
  let finalCss = csstree.translate(finalAst)
  debuglog('stringify from ast')

  // remove unused @fontface rules
  finalCss = ffRemover(finalCss)
  debuglog('ffRemover')

  return finalCss
}
