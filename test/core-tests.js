'use strict'

import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import normaliseCss from './util/normaliseCss'
import chai from 'chai'
chai.should() // binds globally on Object

process.setMaxListeners(0)

function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

describe('penthouse core tests', function () {
  var page1FileUrl = staticServerFileUrl('page1.html')

  // some of these tests take longer than default timeout
  this.timeout(10000)

  it('should match exactly the css in the yeoman test', function () {
    var yeomanFullCssFilePath = path.join(__dirname, 'static-server', 'yeoman-full.css')
    var yeomanExpectedCssFilePath = path.join(__dirname, 'static-server', 'yeoman-medium--expected.css')
    var yeomanExpectedCss = read(yeomanExpectedCssFilePath).toString()

    return penthouse({
      url: staticServerFileUrl('yeoman.html'),
      css: yeomanFullCssFilePath,
      width: 800,
      height: 450
    })
      .then(result => {
        result.should.eql(normaliseCss(yeomanExpectedCss))
      })
  })

  it('should remove non critical selectors from individual rules', function () {
    var testFixtureCss = read(path.join(__dirname, 'static-server', 'rm-non-critical-selectors.css')).toString()
    var expected = read(path.join(__dirname, 'static-server', 'rm-non-critical-selectors--expected.css')).toString()

    return penthouse({
      url: page1FileUrl,
      cssString: testFixtureCss
    })
      .then(result => {
        result.should.eql(normaliseCss(expected))
      })
  })

  it('should keep :before, :after, :visited rules (because el above fold)', function () {
    var pseudoRemainCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remain.css')
    var pseudoRemainCss = read(pseudoRemainCssFilePath).toString()

    return penthouse({
      url: page1FileUrl,
      css: pseudoRemainCssFilePath
    })
      .then(result => {
        result.should.eql(normaliseCss(pseudoRemainCss))
      })
  })

  it('should remove :hover, :active, etc rules - always', function () {
    var pusedoRemoveCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remove.css')

    return penthouse({
      url: page1FileUrl,
      css: pusedoRemoveCssFilePath
    })
      .then(result => {
        result.trim().should.equal('')
      })
  })

  /* ==@-rule handling== */
  /* - Case 0 : Non nested @-rule [REMAIN]
   (@charset, @import, @namespace)
   */
  it('should keep complete case 0 @-rules (@import, @charset, @namespace)', function () {
    var atRuleCase0RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-0--remain.css')
    var atRuleCase0RemainCss = read(atRuleCase0RemainCssFilePath).toString()

    return penthouse({
      url: page1FileUrl,
      css: atRuleCase0RemainCssFilePath
    })
      .then(result => {
        result.should.eql(normaliseCss(atRuleCase0RemainCss))
      })
  })

  /* - Case 1: @-rule with CSS properties inside [REMAIN]
   (NOTE: @font-face, @keyframes are removed later in code, unless they are used.
   Therefor currently this test has to include CSS 'using' the @font-face|@keyframes)
   */
  it('should keep complete case 1 @-rules (@font-face, @keyframes)', function () {
    var atRuleCase1RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-1--remain.css')
    var atRuleCase1RemainCss = read(atRuleCase1RemainCssFilePath).toString()

    return penthouse({
      url: page1FileUrl,
      css: atRuleCase1RemainCssFilePath
    })
      .then(result => {
        result.should.eql(normaliseCss(atRuleCase1RemainCss))
      })
  })

  /* Case 2: @-rule with CSS properties inside [REMOVE]
   @page
   */
  it('should remove complete case 2 @-rules (@page..)', function () {
    var atRuleCase2RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-2--remove.css')

    return penthouse({
      url: page1FileUrl,
      css: atRuleCase2RemoveCssFilePath
    })
      .then(result => {
        result.trim().should.equal('')
      })
  })

  /* Case 3: @-rule with full CSS (rules) inside [REMAIN]
   @media, @document, @supports..
   */
  // TODO: handle @document, @supports also in invalid css (normalising)
  it('should keep case 3 @-rules (@media, @document..)', function () {
    var atRuleCase3RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-3--remain.css')
    var atRuleCase3RemainCss = read(atRuleCase3RemainCssFilePath).toString()

    return penthouse({
      url: page1FileUrl,
      cssString: atRuleCase3RemainCss,
      strict: true
    })
      .then(result => {
        result.should.eql(normaliseCss(atRuleCase3RemainCss))
      })
  })

  /* Case 4: @-rule with full CSS (rules) inside [REMOVE]
   - @media print|speech|arual
   (removed via non-matching-media-query-remover in preformatting tests
   */
  it('should remove case 4 @-rules (@media print|speech)', function () {
    var atRuleCase4RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-4--remove.css')

    return penthouse({
      url: page1FileUrl,
      css: atRuleCase4RemoveCssFilePath
    })
      .then(result => {
        result.trim().should.equal('')
      })
  })

  it('should keep self clearing rules when needed to stay outside the fold', function () {
    var clearSelfRemainCssFilePath = path.join(__dirname, 'static-server', 'clearSelf--remain.css')
    var clearSelfRemainCss = read(clearSelfRemainCssFilePath).toString()

    return penthouse({
      url: staticServerFileUrl('clearSelf.html'),
      css: clearSelfRemainCssFilePath
    })
      .then(result => {
        result.should.eql(normaliseCss(clearSelfRemainCss))
      })
  })

  it('should force include specified selectors', function () {
    var forceIncludeCssFilePath = path.join(__dirname, 'static-server', 'forceInclude.css')
    var forceIncludeCss = read(forceIncludeCssFilePath).toString()

    return penthouse({
      url: page1FileUrl,
      css: forceIncludeCssFilePath,
      forceInclude: [
        '.myLoggedInSelectorRemainsEvenThoughNotFoundOnPage',
        '#box1:hover',
        /^\.COMPONENT/i // intentionally mismatching case to test regex flags
      ]
    })
      .then(result => {
        result.should.eql(normaliseCss(forceIncludeCss))
      })
  })

  // non essential
  it('should remove empty rules', function () {
    var emptyRemoveCssFilePath = path.join(__dirname, 'static-server', 'empty-rules--remove.css')

    return penthouse({
      url: page1FileUrl,
      css: emptyRemoveCssFilePath
    })
      .then(result => {
        result.trim().should.equal('')
      })
  })
})
