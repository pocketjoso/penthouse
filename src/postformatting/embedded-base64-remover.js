import csstree from 'css-tree'
import debug from 'debug'

const debuglog = debug('penthouse:css-cleanup:embeddedbase64Remover')

const BASE64_ENCODE_PATTERN = /data:[^,]*;base64,/

export default function embeddedbase64Remover (ast, maxEmbeddedBase64Length) {
  debuglog('config: maxEmbeddedBase64Length = ' + maxEmbeddedBase64Length)
  csstree.walk(ast, {
    visit: 'Declaration',
    enter: (declaration, item, list) => {
      let tooLong = false

      csstree.walk(declaration, {
        visit: 'Url',
        enter: function (url) {
          const value = url.value.value
          if (
            BASE64_ENCODE_PATTERN.test(value) &&
            value.length > maxEmbeddedBase64Length
          ) {
            tooLong = true
          }
        }
      })

      if (tooLong) {
        const value = csstree.generate(declaration.value)
        debuglog(
          'DROP: ' +
            `${declaration.property}: ${value.slice(0, 50)}..., (${value.length} chars)`
        )
        list.remove(item)
      }
    }
  })
}
