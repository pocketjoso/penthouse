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

  let formattedCriticalRules = unusedKeyframeRemover(astRulesCritical)
  debuglog('unusedKeyframeRemover')

  // remove unused @fontface rules
  formattedCriticalRules = ffRemover(formattedCriticalRules)
  debuglog('ffRemover')

  // remove data-uris that are too long
  formattedCriticalRules = embeddedbase64Remover(
    formattedCriticalRules,
    maxEmbeddedBase64Length
  )
  debuglog('embeddedbase64Remover')

  // remove irrelevant css properties via rule walking
  formattedCriticalRules = unwantedPropertiesRemover(
    formattedCriticalRules,
    propertiesToRemove
  )
  debuglog('propertiesToRemove')

  return formattedCriticalRules
}
