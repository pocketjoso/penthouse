import debug from 'debug'
const debuglog = debug('penthouse:postformatting:unused-font-face-remover')

function getAllFontNameValues (rules) {
  let fontNameValues = []
  function handleRule (rule) {
    if (rule.type === 'Rule') {
      rule.block.children.forEach(({ property, value }) => {
        if (property === 'font-family' || property === 'font') {
          fontNameValues.push(value.value)
        }
      })
    } else if (rule.type === 'Atrule' && rule.name === 'media') {
      rule.block.children.forEach(handleRule)
    }
  }
  rules.forEach(handleRule)
  return fontNameValues
}

function unusedFontfaceRemover (rules) {
  debuglog('getAllFontNameValues')
  const fontNameValues = getAllFontNameValues(rules)
  debuglog('getAllFontNameValues AFTER')

  function filterUnusedFontFaceRule (rule) {
    if (!(rule.type === 'Atrule' && rule.name === 'font-face')) {
      return true
    }
    // was this @font-face used?
    return rule.block.children.some(({ property, value }) => {
      let toKeep = false
      let font
      if (property === 'font-family') {
        font = value.value
      }
      if (font) {
        toKeep = fontNameValues.some(value => value.indexOf(font) !== -1)
        if (!toKeep) {
          debuglog('drop unused font-face rule: ' + font)
        }
      }
      return toKeep
    })
  }

  // remove all unused font-face declarations
  return rules.filter(filterUnusedFontFaceRule)
}

if (typeof module !== 'undefined') {
  module.exports = unusedFontfaceRemover
}
