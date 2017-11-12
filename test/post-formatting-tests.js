'use strict'

import css from 'css-fork-pocketjoso'
import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import normaliseCssAst from './util/normaliseCssAst'
import chai from 'chai'
chai.should() // binds globally on Object

import ffRemover from '../lib/postformatting/unused-fontface-remover'
import unusedKeyframeRemover from '../lib/postformatting/unused-keyframe-remover'
import embeddedbase64Remover from '../lib/postformatting/embedded-base64-remover'
import nonMatchingMediaQueryRemover from '../lib/non-matching-media-query-remover'

function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

function testMediaQueryRemoval (tests, width, height, keepLargerMediaQueries) {
  return [].concat(...tests.map(({rules, remove}) => {
    return rules.map(ruleCss => {
      const matchingRules = nonMatchingMediaQueryRemover(css.parse(ruleCss).stylesheet.rules, width, height, keepLargerMediaQueries)
      if (remove && matchingRules.length) {
        return `❌ media query should have been removed: \n${ruleCss}`
      } else if (!remove && !matchingRules.length) {
        return `❌ media query should have been kept: \n${ruleCss}`
      }
    }).filter(Boolean)
  }))
}

process.setMaxListeners(0)

describe('penthouse post formatting tests', function () {

  it('should remove embedded base64', function (done) {
    const originalCss = read(path.join(__dirname, 'static-server', 'embedded-base64--remove.css')).toString()
    // NOTE: penthouse's default max uri length is 1000.
    const result = embeddedbase64Remover(originalCss, 250)
    try {
      result.trim().should.equal('@media (min-width: 10px) {\n\n}')
      done()
    } catch (ex) {
      done(ex)
    }
  })

  it('should remove @fontface rule, because it is not used', function (done) {
    var fontFaceRemoveCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove.css'),
      fontFaceRemoveExpectedCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove--expected.css'),
      fontFaceRemoveCss = read(fontFaceRemoveCssFilePath).toString(),
      fontFaceRemoveExpectedCss = read(fontFaceRemoveExpectedCssFilePath).toString()

    var result = ffRemover(fontFaceRemoveCss)

    try {
      var resultAst = normaliseCssAst(result)
      var expectedAst = normaliseCssAst(fontFaceRemoveExpectedCss)
      resultAst.should.eql(expectedAst)
      done()
    } catch (ex) {
      done(ex)
    }
  })

  it('should remove non matching media queries', function (done) {
    const mediaToAlwaysKeep = [
      `@media all {}`,
      // going for false positives over false negatives
      `@media oiasjdoiasd {}`
    ]
    const mediaToRemoveAlways = [
      `@media print {}`,
      `@media not screen {}`
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

  it('should only keep @keyframe rules used in critical css', function (done) {
    const originalCss = read(path.join(__dirname, 'static-server', 'unused-keyframes.css'), 'utf8')
    const expextedCss = read(path.join(__dirname, 'static-server', 'unused-keyframes--expected.css'), 'utf8')

    try {
      var resultRules = unusedKeyframeRemover(css.parse(originalCss).stylesheet.rules)
      var resultAst = normaliseCssAst(css.stringify({
        stylesheet: {
          rules: resultRules
        }
      }))
      var expectedAst = normaliseCssAst(expextedCss)
      resultAst.should.eql(expectedAst)
      done()
    } catch (ex) {
      done(ex)
    }
  })

  it('should not remove transitions but still remove cursor from css', function (done) {
    var fullCssFilePath = path.join(__dirname, 'static-server', 'transition-full.css')
    var expectedCssFilePath = path.join(__dirname, 'static-server', 'transition-crit--expected.css')
    var expectedCss = read(expectedCssFilePath).toString()

    penthouse({
      url: staticServerFileUrl('transition.html'),
      css: fullCssFilePath,
      width: 800,
      height: 450,
      propertiesToRemove: [
        'cursor',
        'pointer-events',
        '(-webkit-)?tap-highlight-color',
        '(.*)user-select'
      ]
    })
      .then(result => {
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(expectedCss)

        resultAst.should.eql(expectedAst)
        done()
      })
      .catch(done)
  })
})
