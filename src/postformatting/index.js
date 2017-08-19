'use strict'

const cssAstFormatter = require('css-fork-pocketjoso')
const embeddedbase64Remover = require('./embedded-base64-remover')
const ffRemover = require('./unused-fontface-remover')
const unusedKeyframeRemover = require('./unused-keyframe-remover')

module.exports = function postformatting (
  criticalAstRules,
  criticalCssOptions,
  debugMode,
  START_TIME
) {
  const debuglog = function (msg, isError) {
    if (debugMode) {
      console.error(
        'time: ' +
          (Date.now() - START_TIME) +
          ' | ' +
          (isError ? 'ERR: ' : '') +
          'postformatting: ' +
          msg
      )
    }
  }

  const usedCriticalRules = unusedKeyframeRemover(criticalAstRules)
  debuglog('unusedKeyframeRemover')

  let finalCss = cssAstFormatter.stringify({
    stylesheet: {
      rules: usedCriticalRules
    }
  })
  debuglog('stringify from ast')

  // remove data-uris that are too long
  // ..faster if this removal can be combined with @font-face one into same iteration..
  finalCss = embeddedbase64Remover(
    finalCss,
    criticalCssOptions.maxEmbeddedBase64Length
  )
  debuglog('embeddedbase64Remover')

  // remove unused @fontface rules
  finalCss = ffRemover(finalCss)
  debuglog('ffRemover')

  return finalCss
}
