import debug from 'debug'

import embeddedbase64Remover from './embedded-base64-remover'
import ffRemover from './unused-fontface-remover'
import unusedKeyframeRemover from './unused-keyframe-remover'
import unwantedPropertiesRemover from './unwanted-properties-remover'

const debuglog = debug('penthouse:postformatting')

export default function postformatting ({
  ast,
  propertiesToRemove,
  maxEmbeddedBase64Length
}) {
  debuglog('start')

  unusedKeyframeRemover(ast)
  debuglog('unusedKeyframeRemover')

  // remove unused @fontface rules
  ffRemover(ast)
  debuglog('ffRemover')

  // remove data-uris that are too long
  embeddedbase64Remover(ast, maxEmbeddedBase64Length)
  debuglog('embeddedbase64Remover')

  // remove irrelevant css properties via rule walking
  unwantedPropertiesRemover(ast, propertiesToRemove)
  debuglog('propertiesToRemove')

  return ast
}
