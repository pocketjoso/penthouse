import csstree from 'css-tree'
import debug from 'debug'

const debuglog = debug('penthouse:css-cleanup:unused-font-face-remover')

function decodeFontName(node) {
  let name = csstree.generate(node)
  // TODO: use string decode
  if (name[0] === '"' || name[0] === "'") {
    name = name.substr(1, name.length - 2)
  }
  return name
}

function getAllFontNameValues(ast) {
  const fontNameValues = new Set()

  debuglog('getAllFontNameValues')
  csstree.walk(ast, {
    visit: 'Declaration',
    enter: function(node) {
      // walker pass through `font-family` declarations inside @font-face too
      // this condition filters them, to walk through declarations inside a rules only
      if (this.rule) {
        csstree.lexer
          .findDeclarationValueFragments(node, 'Type', 'family-name')
          .forEach(entry => {
            const familyName = decodeFontName({
              type: 'Value',
              children: entry.nodes
            })
            if (!fontNameValues.has(familyName)) {
              debuglog('found used font-family: ' + familyName)
              fontNameValues.add(familyName)
            }
          })
      }
    }
  })
  debuglog('getAllFontNameValues AFTER')

  return fontNameValues
}

export default function unusedFontfaceRemover(ast) {
  const fontNameValues = getAllFontNameValues(ast)

  // remove @font-face at-rule when:
  // - it's never unused
  // - has no a `src` descriptor
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, atruleItem, atruleList) => {
      if (csstree.keyword(atrule.name).basename !== 'font-face') {
        return
      }

      let hasSrc = false
      let used = true

      csstree.walk(atrule, {
        visit: 'Declaration',
        enter: declaration => {
          const name = csstree.property(declaration.property).name

          if (name === 'font-family') {
            const familyName = decodeFontName(declaration.value)

            // was this @font-face used?
            if (!fontNameValues.has(familyName)) {
              debuglog('drop unused @font-face: ' + familyName)
              used = false
            }
          } else if (name === 'src') {
            hasSrc = true
          }
        }
      })

      if (!used || !hasSrc) {
        if (used && !hasSrc) {
          debuglog('drop @font-face with no src descriptor')
        }
        atruleList.remove(atruleItem)
      }
    }
  })
}
