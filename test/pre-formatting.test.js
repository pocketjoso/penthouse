import csstree from 'css-tree'

import nonMatchingMediaQueryRemover from '../lib/non-matching-media-query-remover'

function testMediaQueryRemoval (tests, width, height, keepLargerMediaQueries) {
  return [].concat(...tests.map(({rules, remove}) => {
    return rules.map(ruleCss => {
      const ast = csstree.parse(ruleCss)
      const matchingRules = nonMatchingMediaQueryRemover(
        ast,
        width,
        height,
        keepLargerMediaQueries
      ).children.toArray()

      if (remove && matchingRules.length) {
        return `❌ media query should have been removed: \n${ruleCss}`
      } else if (!remove && !matchingRules.length) {
        return `❌ media query should have been kept: \n${ruleCss}`
      }
    }).filter(Boolean)
  }))
}

process.setMaxListeners(0)

describe('penthouse pre formatting tests', () => {
  it('should remove non matching media queries', done => {
    const mediaToAlwaysKeep = [
      `@media all {}`,
      // going for false positives over false negatives
      `@media oiasjdoiasd {}`
    ]
    const mediaToRemoveAlways = [
      `@media print {}`,
      `@media not screen {}`,
      `@media not (min-width: 1px) {}`
    ]
    const mediaToRemoveUnlessLarge = [
      `@media (min-width: 1500px) {}`,
      `@media screen and (min-width: 93.75em) {}`,
      `@media screen and (min-width: 93.75rem) {}`
    ]
    const mediaToRemoveUnlessKeepLarge = [
      `@media (min-width: 99999px) {}`
    ]

    // test default settings
    const defaultTest = [
      {
        rules: [
          ...mediaToRemoveAlways,
          ...mediaToRemoveUnlessLarge,
          ...mediaToRemoveUnlessKeepLarge
        ],
        remove: true
      },
      {
        rules: mediaToAlwaysKeep,
        remove: false
      }
    ]
    const defaultErrors = testMediaQueryRemoval(defaultTest, 1300, 900)
    if (defaultErrors.length) {
      done(new Error('defaultErrors:\n' + defaultErrors.join('\n')))
      return
    }

    // test larger screen size settings
    const largeTest = [
      {
        rules: [
          ...mediaToRemoveAlways,
          ...mediaToRemoveUnlessKeepLarge
        ],
        remove: true
      },
      {
        rules: [...mediaToRemoveUnlessLarge, ...mediaToAlwaysKeep],
        remove: false
      }
    ]
    const largeErrors = testMediaQueryRemoval(largeTest, 1600, 1200)
    if (largeErrors.length) {
      done(new Error('largeErrors:\n' + largeErrors.join('\n')))
      return
    }

    // test keepLargeMediaQueries - to be moved
    const keepLargeMediaQueriesTest = [
      {
        rules: mediaToRemoveAlways,
        remove: true
      },
      {
        rules: [...mediaToRemoveUnlessLarge, ...mediaToRemoveUnlessKeepLarge, ...mediaToAlwaysKeep],
        remove: false
      }
    ]
    let keepLargeMediaQueriesErrors = testMediaQueryRemoval(keepLargeMediaQueriesTest, 1300, 900, true)
    if (keepLargeMediaQueriesErrors.length) {
      done(new Error('keepLargeMediaQueriesErrors:\n' + keepLargeMediaQueriesErrors.join('\n')))
      return
    }

    done()
  })
})
