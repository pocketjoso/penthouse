'use strict'

const cssAstFormatter = require('css-fork-pocketjoso')
const embeddedbase64Remover = require('./embedded-base64-remover')
const ffRemover = require('./unused-fontface-remover')
const unusedKeyframeRemover = require('./unused-keyframe-remover')

// PhantomJS spits out these messages straight into stdOut,
// causing it to mix with our critical css.
// AFAIK no better way to handle this than to hard code and filter them out here
const removePhantomJSSecurityErrors = function (stdOut) {
  stdOut = stdOut.replace(
    'Unsafe JavaScript attempt to access frame with URL about:blank from frame with URL ',
    ''
  )
  stdOut = stdOut.replace(/file:\/\/.*core.js\./, '')
  stdOut = stdOut.replace(' Domains, protocols and ports must match.', '')
  return stdOut
}

module.exports = function postformatting (
  stdOutString,
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

  const cssAstRulesJsonString = removePhantomJSSecurityErrors(stdOutString)
  debuglog('remove phantom js security errors')

  let criticalRules = JSON.parse(cssAstRulesJsonString)
  debuglog('JSON parse')

  criticalRules = unusedKeyframeRemover(criticalRules)
  debuglog('unusedKeyframeRemover')

  let finalCss = cssAstFormatter.stringify({
    stylesheet: {
      rules: criticalRules
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
