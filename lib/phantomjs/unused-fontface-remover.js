/*
module for removing unused fontface rules - can be used both for the standalone node binary and the phantomjs script
*/
/*jshint unused:false*/

function unusedFontfaceRemover (css) {
  var toDeleteSections = []

  // extract full @font-face rules
  var fontFaceRegex = /(@font-face[ \s\S]*?\{([\s\S]*?)\})/gm,
    ff

  while ((ff = fontFaceRegex.exec(css)) !== null) {
    // grab the font name declared in the @font-face rule
    // (can still be in quotes, f.e. 'Lato Web'
    var t = /font-family[^:]*?:[ ]*([^;]*)/.exec(ff[1])
    if (!t || typeof t[1] === 'undefined')
      continue; // no font-family in @fontface rule!

    // rm quotes
    var fontName = t[1].replace(/['"]/gm, '')

    // does this fontname appear as a font-family or font (shorthand) value?
    var fontNameRegex = new RegExp('([^{}]*?){[^}]*?font(-family)?[^:]*?:[^;]*' + fontName + '[^,;]*[,;]', 'gmi')

    var fontFound = false,
      m

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
      var closeRuleIndex = css.indexOf('}', ff.index)
      // unshift - add to beginning of array - we need to remove rules in reverse order,
      // otherwise indeces will become incorrect again.
      toDeleteSections.unshift({
        start: ff.index,
        end: closeRuleIndex + 1
      })
    }
  }
  // now delete the @fontface rules we registed as having no matches in the css
  for (var i = 0; i < toDeleteSections.length; i++) {
    var start = toDeleteSections[i].start,
      end = toDeleteSections[i].end
    css = css.substring(0, start) + css.substring(end)
  }

  return css
}

if (typeof module !== 'undefined') {
  module.exports = unusedFontfaceRemover
}
