import css from 'css'
import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import chai from 'chai'
chai.should() // binds globally on Object

import ffRemover from '../lib/phantomjs/unused-fontface-remover'
import embeddedbase64Remover from '../lib/phantomjs/embedded-base64-remover'
import nonMatchingMediaQueryRemover from '../lib/phantomjs/non-matching-media-query-remover'

process.setMaxListeners(0)

// becasuse dont want to fail tests on white space differences
function normalisedCssAst (cssString) {
  return css.parse(css.stringify(css.parse(cssString), { compress: true }))
}

describe('penthouse core tests', function () {
  var page1cssPath = path.join(__dirname, 'static-server', 'page1.css'),
    page1 = path.join(__dirname, 'static-server', 'page1.html')

  // phantomjs takes a while to start up
  this.timeout(5000)

  it('should match exactly the css in the yeoman test', function (done) {
    var yeomanFullCssFilePath = path.join(__dirname, 'static-server', 'yeoman-full.css'),
      yeomanExpectedCssFilePath = path.join(__dirname, 'static-server', 'yeoman-medium--expected.css'),
      yeomanExpectedCss = read(yeomanExpectedCssFilePath).toString()

    penthouse({
      url: path.join(__dirname, 'static-server', 'yeoman.html'),
      css: yeomanFullCssFilePath,
      width: 800,
      height: 450
    }, function (err, result) {
      if (err) {
        done(err)
      }
      try {
        var resultAst = normalisedCssAst(result)
        var expectedAst = normalisedCssAst(yeomanExpectedCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  it('should keep :before, :after rules (because el above fold)', function (done) {
    var pusedoRemainCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remain.css'),
      pusedoRemainCss = read(pusedoRemainCssFilePath).toString()

    penthouse({
      url: page1,
      css: pusedoRemainCssFilePath
    }, function (err, result) {
      try {
        var resultAst = normalisedCssAst(result)
        var expectedAst = normalisedCssAst(pusedoRemainCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  it('should remove :hover, :active, etc rules - always', function (done) {
    var pusedoRemoveCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remove.css')

    penthouse({
      url: page1,
      css: pusedoRemoveCssFilePath
    }, function (err, result) {
      try {
        result.trim().should.equal('')
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  /* ==@-rule handling==*/
  /* - Case 0 : Non nested @-rule [REMAIN]
   (@charset, @import, @namespace)
   */
  it('should keep complete case 0 @-rules (@import, @charset, @namespace)', function (done) {
    var atRuleCase0RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-0--remain.css'),
      atRuleCase0RemainCss = read(atRuleCase0RemainCssFilePath).toString()

    penthouse({
      url: page1,
      css: atRuleCase0RemainCssFilePath
    }, function (err, result) {
      try {
        var resultAst = normalisedCssAst(result)
        var expectedAst = normalisedCssAst(atRuleCase0RemainCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  /*	- Case 1: @-rule with CSS properties inside [REMAIN]
   (NOTE: @font-face is removed later in code, unless it is used.
   Therefor currently this test has to include CSS 'using' the @font-face)
   */
  it('should keep complete case 1 @-rules (@font-face)', function (done) {
    var atRuleCase1RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-1--remain.css'),
      atRuleCase1RemainCss = read(atRuleCase1RemainCssFilePath).toString()

    penthouse({
      url: page1,
      css: atRuleCase1RemainCssFilePath
    }, function (err, result) {
      try {
        var resultAst = normalisedCssAst(result)
        var expectedAst = normalisedCssAst(atRuleCase1RemainCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  /* Case 2: @-rule with CSS properties inside [REMOVE]
   @page
   */
  it('should remove complete case 2 @-rules (@page..)', function (done) {
    var atRuleCase2RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-2--remove.css')

    penthouse({
      url: page1,
      css: atRuleCase2RemoveCssFilePath
    }, function (err, result) {
      try {
        result.trim().should.equal('')
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  /*Case 3: @-rule with full CSS (rules) inside [REMAIN]
   @media, @document, @supports..
   */
  // TODO: handle @document, @supports also in invalid css (normalising)
  it('should keep case 3 @-rules (@media, @document..)', function (done) {
    var atRuleCase3RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-3--remain.css'),
      atRuleCase3RemainCss = read(atRuleCase3RemainCssFilePath).toString()

    penthouse({
      url: page1,
      css: atRuleCase3RemainCssFilePath,
      strict: true
    }, function (err, result) {
      try {
        var resultAst = normalisedCssAst(result)
        var expectedAst = normalisedCssAst(atRuleCase3RemainCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  /* Case 4: @-rule with full CSS (rules) inside [REMOVE]
   - @keyframes, @media print|speech|arual
   */
  it('should remove case 4 @-rules (@media print|speech, @keyframes..)', function (done) {
    var atRuleCase4RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-4--remove.css')

    penthouse({
      url: page1,
      css: atRuleCase4RemoveCssFilePath
    }, function (err, result) {
      try {
        result.trim().should.equal('')
        done()
      } catch (ex) {
        done(ex)
      }

    })
  })

  it('should keep self clearing rules when needed to stay outside the fold', function (done) {
    var clearSelfRemainCssFilePath = path.join(__dirname, 'static-server', 'clearSelf--remain.css'),
      clearSelfRemainCss = read(clearSelfRemainCssFilePath).toString()

    penthouse({
      url: path.join(__dirname, 'static-server', 'clearSelf.html'),
      css: clearSelfRemainCssFilePath
    }, function (err, result) {
      try {
        var resultAst = normalisedCssAst(result)
        var expectedAst = normalisedCssAst(clearSelfRemainCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  it('should force include specified selectors', function (done) {
    var forceIncludeCssFilePath = path.join(__dirname, 'static-server', 'forceInclude.css'),
      forceIncludeCss = read(forceIncludeCssFilePath).toString()
    penthouse({
      url: path.join(__dirname, 'static-server', 'page1.html'),
      css: forceIncludeCssFilePath,
      forceInclude: [
        '.myLoggedInSelectorRemainsEvenThoughNotFoundOnPage',
        '#box1:hover',
        /^\.component/
      ]
    }, function (err, result) {
      try {
        var resultAst = normalisedCssAst(result)
        var expectedAst = normalisedCssAst(forceIncludeCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  /* non core (non breaking) functionality tests */
  it('should remove empty rules', function (done) {
    var emptyRemoveCssFilePath = path.join(__dirname, 'static-server', 'empty-rules--remove.css')

    penthouse({
      url: page1,
      css: emptyRemoveCssFilePath
    }, function (err, result) {
      try {
        result.trim().should.equal('')
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

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
      fontFaceRemoveCss = read(fontFaceRemoveCssFilePath).toString()

    var result = ffRemover(fontFaceRemoveCss)

    try {
      var resultAst = normalisedCssAst(result)
      var expectedAst = normalisedCssAst(fontFaceRemoveCss)
      resultAst.stylesheet.rules.should.have.length.lessThan(expectedAst.stylesheet.rules.length)
      done()
    } catch (ex) {
      done(ex)
    }
  })

  it('should remove non matching media queries', function (done) {
    const originalCss = read(path.join(__dirname, 'static-server', 'non-matching-mq--remove.css'), 'utf8')
    const defaultViewportRules = nonMatchingMediaQueryRemover(css.parse(originalCss).stylesheet.rules, 1300, 900)
    defaultViewportRules.should.have.length(1)

    const smallViewportRules = nonMatchingMediaQueryRemover(css.parse(originalCss).stylesheet.rules, 600, 600)
    smallViewportRules.should.have.length(0)
    done()
  })

  it('should wait for requested time before generating critical css', function (done) {
    penthouse({
      url: path.join(__dirname, 'static-server', 'page-taking-too-long-to-display.html'),
      css: page1cssPath,
      generateCssAfter: {
        delay: 300
      }
    }, function (err, result) {
      if (err) {
        done(err);
      }
      try {
        result.should.contain('#box22')
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  it('should wait for some element to be present before generating critical css', function (done) {
    penthouse({
      url: path.join(__dirname, 'static-server', 'page-taking-too-long-to-display.html'),
      css: page1cssPath,
      generateCssAfter: {
        elementIsPresent: '#box22'
      }
    }, function (err, result) {
      if (err) {
        done(err);
      }
      try {
        result.should.contain('#box22')
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  it('should wait for an arbitrary condition before generating critical css', function (done) {
    penthouse({
      url: path.join(__dirname, 'static-server', 'page-taking-too-long-to-display.html'),
      css: page1cssPath,
      generateCssAfter: {
        condition: function () {
          return document.getElementById('box22') !== null
        }
      }
    }, function (err, result) {
      if (err) {
        done(err);
      }
      try {
        result.should.contain('#box22')
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })
})
