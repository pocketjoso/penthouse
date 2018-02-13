import debug from 'debug'

import commentRemover from './comment-remover'
import embeddedbase64Remover from './embedded-base64-remover'
import unusedKeyframeRemover from './unused-keyframe-remover'
import unusedFontFaceRemover from './unused-fontface-remover'
import unwantedPropertiesRemover from './unwanted-properties-remover'
import ruleSelectorRemover from './rule-selector-remover'
import finalRuleRemover from './final-rule-remover'

const debuglog = debug('penthouse:css-cleanup')

// NOTE: mutates the ast
export default function cleanup ({
  ast,
  selectorNodeMap,
  criticalSelectors,
  propertiesToRemove,
  maxEmbeddedBase64Length
}) {
  debuglog('start')

  commentRemover(ast)
  debuglog('commentRemover')

  ruleSelectorRemover(ast, selectorNodeMap, criticalSelectors)
  debuglog('ruleSelectorRemover')

  unusedKeyframeRemover(ast)
  debuglog('unusedKeyframeRemover')

  // remove data-uris that are too long
  embeddedbase64Remover(ast, maxEmbeddedBase64Length)
  debuglog('embeddedbase64Remover')

  // remove bad and unused @fontface rules
  unusedFontFaceRemover(ast)
  debuglog('unusedFontFaceRemover')

  // remove irrelevant css properties via rule walking
  unwantedPropertiesRemover(ast, propertiesToRemove)
  debuglog('propertiesToRemove')

  // remove empty and unwanted rules and at-rules
  finalRuleRemover(ast)
  debuglog('finalRuleRemover')
}
