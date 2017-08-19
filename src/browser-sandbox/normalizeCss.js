// executed inside sandboxed browser environment,
// no access to scrope outside of function
export default function normalizeCss (cssToNormalize) {
  function handleCssRule (rule) {
    if (!rule.selectorText) {
      if (!rule.media) {
        if (rule.cssText.indexOf('@font-face') !== -1) {
          return rule.cssText.replace(/format\(([^'")]*)\)/g, "format('$1')")
        }
        return rule.cssText
      }
      const mediaContent = handleCssRules(rule.cssRules)
      return '@media ' + rule.media.mediaText + '{' + mediaContent + '}'
    }
    return rule.cssText
  }
  function handleCssRules (cssRulesList) {
    return Array.prototype.map.call(cssRulesList || [], handleCssRule).join(' ')
  }

  cssToNormalize = decodeURIComponent(cssToNormalize)
  const fullPageCss = Array.prototype.map
    .call(document.styleSheets, function (stylesheet) {
      return handleCssRules(stylesheet.cssRules)
    })
    .join(' ')

  console.log('extractFullCssFromPage, css extracted: ' + fullPageCss.length)

  // these (case 0) @-rules are not part of document.styleSheets, so need to be preserved manually
  // NOTE: @import's are not expanded by Penthouse; hopefully not needed for critical css content
  var metaMatches = cssToNormalize.match(/(@(import|namespace)[^;]*;)/g)
  if (metaMatches) {
    console.log('normalizeCss, had metamatches to preserve')
  }
  // place meta matches at top
  return (metaMatches || []).join('') + fullPageCss
}
