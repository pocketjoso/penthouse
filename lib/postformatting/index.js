var cssAstFormatter = require('css')
var embeddedbase64Remover = require('./embedded-base64-remover')
var ffRemover = require('./unused-fontface-remover')
var unusedKeyframeRemover = require('./unused-keyframe-remover')

var removePhantomJSSecurityErrors = function (stdOut) {
  stdOut = stdOut.replace('Unsafe JavaScript attempt to access frame with URL about:blank from frame with URL ', '')
  stdOut = stdOut.replace(/file:\/\/.*core.js\./, '')
  stdOut = stdOut.replace(' Domains, protocols and ports must match.', '')
  return stdOut
}

module.exports = function postformatting (stdOutString, criticalCssOptions, debugMode, START_TIME) {
  var debuglog = function (msg, isError) {
    if (debugMode) {
      console.error('time: ' + (Date.now() - START_TIME) + ' | ' + (isError ? 'ERR: ' : '') + 'postformatting: ' + msg)
    }
  }

  var cssAstRulesJsonString = removePhantomJSSecurityErrors(stdOutString)
  debuglog('remove phantom js security errors')

  var criticalRules = JSON.parse(cssAstRulesJsonString)
  debuglog('JSON parse')

  criticalRules = unusedKeyframeRemover(criticalRules)
  debuglog('unusedKeyframeRemover')


  var finalCss = cssAstFormatter.stringify({
    stylesheet: {
      rules: criticalRules
    }
  })
  debuglog('stringify from ast')

  // remove data-uris that are too long
  // ..faster if this removal can be combined with @font-face one into same iteration..
  finalCss = embeddedbase64Remover(finalCss, criticalCssOptions.maxEmbeddedBase64Length)
  debuglog('embeddedbase64Remover')

  // remove unused @fontface rules
  finalCss = ffRemover(finalCss)
  debuglog('ffRemover')

  return finalCss
}
