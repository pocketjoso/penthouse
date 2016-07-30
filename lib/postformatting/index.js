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

module.exports = function postformatting (stdOutString, criticalCssOptions, debugMode) {
  var debuglog = function (msg, isError) {
    if (debugMode) {
      console.error('time: ' + (new Date().getTime() - START_TIME) + ' | ' + (isError ? 'ERR: ' : '') + msg)
    }
  }
  var START_TIME = Date.now()
  debuglog('POSTFORMATTING')

  var cssAstRulesJsonString = removePhantomJSSecurityErrors(stdOutString)
  debuglog('postformatting: remove phantom js security errors' + criticalRules)

  var criticalRules = JSON.parse(cssAstRulesJsonString)
  debuglog('postformatting JSON parse')

  criticalRules = unusedKeyframeRemover(criticalRules)
  debuglog('postformatting: unusedKeyframeRemover')


  var finalCss = cssAstFormatter.stringify({
    stylesheet: {
      rules: criticalRules
    }
  })
  debuglog('postformatting: stringify from ast')

  // remove data-uris that are too long
  // ..faster if this removal can be combined with @font-face one into same iteration..
  finalCss = embeddedbase64Remover(finalCss, criticalCssOptions.maxEmbeddedBase64Length)
  debuglog('postformatting: embeddedbase64Remover')

  // remove unused @fontface rules
  finalCss = ffRemover(finalCss)
  debuglog('postformatting: ffRemover')

  return finalCss
}
