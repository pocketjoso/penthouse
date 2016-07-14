import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import normaliseCssAst from './util/normaliseCssAst'
import chai from 'chai'
chai.should() // binds globally on Object

process.setMaxListeners(0)

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
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(yeomanExpectedCss)
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
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(pusedoRemainCss)
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
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(atRuleCase0RemainCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  /*	- Case 1: @-rule with CSS properties inside [REMAIN]
   (NOTE: @font-face, @keyframes are removed later in code, unless they are used.
   Therefor currently this test has to include CSS 'using' the @font-face|@keyframes)
   */
  it('should keep complete case 1 @-rules (@font-face, @keyframes)', function (done) {
    var atRuleCase1RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-1--remain.css'),
      atRuleCase1RemainCss = read(atRuleCase1RemainCssFilePath).toString()

    penthouse({
      url: page1,
      css: atRuleCase1RemainCssFilePath
    }, function (err, result) {
      try {
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(atRuleCase1RemainCss)
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
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(atRuleCase3RemainCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  /* Case 4: @-rule with full CSS (rules) inside [REMOVE]
   - @media print|speech|arual
   */
  it('should remove case 4 @-rules (@media print|speech)', function (done) {
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
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(clearSelfRemainCss)
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
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(forceIncludeCss)
        resultAst.should.eql(expectedAst)
        done()
      } catch (ex) {
        done(ex)
      }
    })
  })

  // non essential
  it('should remove empty rules', function (done) {
    var page1 = path.join(__dirname, 'static-server', 'page1.html')
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
})
