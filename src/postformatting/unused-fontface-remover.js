/*
module for removing unused fontface rules
*/

'use strict'

// extract full @font-face rules
const fontFaceRegex = /(@font-face[ \s\S]*?\{([\s\S]*?)\})/gm

function unusedFontfaceRemover (css) {
  const toDeleteSections = []

  let ff = null

  while ((ff = fontFaceRegex.exec(css)) !== null) {
    // grab the font name declared in the @font-face rule
    // (can still be in quotes, f.e. 'Lato Web'
    const t = /font-family[^:]*?:[ ]*([^;]*)/.exec(ff[1])
    if (!t || typeof t[1] === 'undefined') {
      continue // no font-family in @fontface rule!
    }

    // rm quotes
    const fontName = t[1].replace(/['"]/gm, '')

    // does this fontname appear as a font-family or font (shorthand) value?
    const fontNameRegex = new RegExp(
      '([^{}]*?){[^}]*?font(-family)?[^:}]*?:[^;}]*' + fontName + '[^,;]*[,;]',
      'gmi'
    )

    let fontFound = false
    let m = null

    while ((m = fontNameRegex.exec(css)) !== null) {
      if (m[1].indexOf('@font-face') === -1) {
        // log('FOUND, keep rule')
        fontFound = true
        break
      }
    }
    if (!fontFound) {
      // NOT FOUND, rm!

      // can't remove rule here as it will screw up ongoing while (exec ...) loop.
      // instead: save indices and delete AFTER for loop
      const closeRuleIndex = css.indexOf('}', ff.index)
      // unshift - add to beginning of array - we need to remove rules in reverse order,
      // otherwise indeces will become incorrect again.
      toDeleteSections.unshift({
        start: ff.index,
        end: closeRuleIndex + 1
      })
    }
  }
  // now delete the @fontface rules we registed as having no matches in the css
  for (let i = 0; i < toDeleteSections.length; i++) {
    const start = toDeleteSections[i].start
    const end = toDeleteSections[i].end
    css = css.substring(0, start) + css.substring(end)
  }

  return css
}

if (typeof module !== 'undefined') {
  module.exports = unusedFontfaceRemover
}
