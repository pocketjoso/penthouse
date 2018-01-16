import csstree from 'css-tree'
import debug from 'debug'
const debuglog = debug('penthouse:postformatting:unused-font-face-remover')

function decodeFontName (node) {
  let name = csstree.generate(node)
  // TODO: use string decode
  if (name[0] === '"' || name[0] === "'") {
    name = name.substr(1, name.length - 2)
  }
  return name
}

function getAllFontNameValues (ast) {
  const fontNameValues = new Set()

  csstree.walk(ast, {
    visit: 'Declaration',
    enter: function (node) {
      // walker pass through `font-family` declarations inside @font-face too
      // this condition filter them, to walk through declarations inside a rules only
      if (this.rule) {
        csstree.lexer
          .findDeclarationValueFragments(node, 'Type', 'family-name')
          .forEach(entry => {
            const familyName = decodeFontName({
              type: 'Value',
              children: entry.nodes
            })
            debuglog('found used keyframe animation: ' + familyName)
            fontNameValues.add(familyName)
          })
      }
    }
  })

  return fontNameValues
}

function unusedFontfaceRemover (ast) {
  debuglog('getAllFontNameValues')
  // NOTE: we grabp the full declaration everywhere a font name is used,
  // and just do a simple index of on these lines to see if each @font-face
  // is used anywhere. Could in theory yield false positives, but is quite unlikely,
  // unless people use css keywords in their custom font names.
  const fontNameValues = getAllFontNameValues(ast)
  debuglog('getAllFontNameValues AFTER')

  // remove all unused font-face declarations
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, atruleItem, atruleList) => {
      if (csstree.keyword(atrule.name).basename !== 'font-face') {
        return
      }

      csstree.walk(atrule, {
        visit: 'Declaration',
        enter: declaration => {
          if (csstree.property(declaration.property).name === 'font-family') {
            const familyName = decodeFontName(declaration.value)

            // was this @font-face used?
            if (!fontNameValues.has(familyName)) {
              debuglog('drop unused font-face rule: ' + familyName)
              atruleList.remove(atruleItem)
            }
          }
        }
      })
    }
  })

  return ast
}

if (typeof module !== 'undefined') {
  module.exports = unusedFontfaceRemover
}
