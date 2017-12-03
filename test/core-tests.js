'use strict'

import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import normaliseCssAst from './util/normaliseCssAst'
import chai from 'chai'
chai.should() // binds globally on Object

process.setMaxListeners(0)

function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

describe('penthouse core tests', function () {
  var page1FileUrl = staticServerFileUrl('page1.html')

  it('should match exactly the css in the yeoman test', function (done) {
    var yeomanFullCssFilePath = path.join(__dirname, 'static-server', 'yeoman-full.css'),
      yeomanExpectedCssFilePath = path.join(__dirname, 'static-server', 'yeoman-medium--expected.css'),
      yeomanExpectedCss = read(yeomanExpectedCssFilePath).toString()

    penthouse({
      url: staticServerFileUrl('yeoman.html'),
      css: yeomanFullCssFilePath,
      width: 800,
      height: 450
    })
    .then(result => {
      var resultAst = normaliseCssAst(result)
      var expectedAst = normaliseCssAst(yeomanExpectedCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })
  it('should keep :before, :after, :visited rules (because el above fold)', function (done) {
    var pusedoRemainCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remain.css'),
      pusedoRemainCss = read(pusedoRemainCssFilePath).toString()

    penthouse({
      url: page1FileUrl,
      css: pusedoRemainCssFilePath
    })
    .then(result => {
      var resultAst = normaliseCssAst(result)
      var expectedAst = normaliseCssAst(pusedoRemainCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })

  it('should remove :hover, :active, etc rules - always', function (done) {
    var pusedoRemoveCssFilePath = path.join(__dirname, 'static-server', 'psuedo--remove.css')

    penthouse({
      url: page1FileUrl,
      css: pusedoRemoveCssFilePath
    })
    .then(result => {
      result.trim().should.equal('')
      done()
    })
    .catch(done)
  })

  /* ==@-rule handling==*/
  /* - Case 0 : Non nested @-rule [REMAIN]
   (@charset, @import, @namespace)
   */
  it('should keep complete case 0 @-rules (@import, @charset, @namespace)', function (done) {
    var atRuleCase0RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-0--remain.css'),
      atRuleCase0RemainCss = read(atRuleCase0RemainCssFilePath).toString()

    penthouse({
      url: page1FileUrl,
      css: atRuleCase0RemainCssFilePath
    })
    .then(result => {
      var resultAst = normaliseCssAst(result)
      var expectedAst = normaliseCssAst(atRuleCase0RemainCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })

  /*	- Case 1: @-rule with CSS properties inside [REMAIN]
   (NOTE: @font-face, @keyframes are removed later in code, unless they are used.
   Therefor currently this test has to include CSS 'using' the @font-face|@keyframes)
   */
  it('should keep complete case 1 @-rules (@font-face, @keyframes)', function (done) {
    var atRuleCase1RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-1--remain.css'),
      atRuleCase1RemainCss = read(atRuleCase1RemainCssFilePath).toString()

    penthouse({
      url: page1FileUrl,
      css: atRuleCase1RemainCssFilePath
    })
    .then(result => {
      var resultAst = normaliseCssAst(result)
      var expectedAst = normaliseCssAst(atRuleCase1RemainCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })

  /* Case 2: @-rule with CSS properties inside [REMOVE]
   @page
   */
  it('should remove complete case 2 @-rules (@page..)', function (done) {
    var atRuleCase2RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-2--remove.css')

    penthouse({
      url: page1FileUrl,
      css: atRuleCase2RemoveCssFilePath
    })
    .then(result => {
      result.trim().should.equal('')
      done()
    })
    .catch(done)
  })

  /*Case 3: @-rule with full CSS (rules) inside [REMAIN]
   @media, @document, @supports..
   */
  // TODO: handle @document, @supports also in invalid css (normalising)
  it('should keep case 3 @-rules (@media, @document..)', function (done) {
    var atRuleCase3RemainCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-3--remain.css'),
      atRuleCase3RemainCss = read(atRuleCase3RemainCssFilePath).toString()

    penthouse({
      url: page1FileUrl,
      css: atRuleCase3RemainCssFilePath,
      strict: true
    })
    .then(result => {
      var resultAst = normaliseCssAst(result)
      var expectedAst = normaliseCssAst(atRuleCase3RemainCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })

  /* Case 4: @-rule with full CSS (rules) inside [REMOVE]
   - @media print|speech|arual
   (removed via non-matching-media-query-remover in preformatting tests
   */
  it('should remove case 4 @-rules (@media print|speech)', function (done) {
    var atRuleCase4RemoveCssFilePath = path.join(__dirname, 'static-server', 'at-rule-case-4--remove.css')

    penthouse({
      url: page1FileUrl,
      css: atRuleCase4RemoveCssFilePath
    })
    .then(result => {
      result.trim().should.equal('')
      done()
    })
    .catch(done)
  })

  it('should keep self clearing rules when needed to stay outside the fold', function (done) {
    var clearSelfRemainCssFilePath = path.join(__dirname, 'static-server', 'clearSelf--remain.css'),
      clearSelfRemainCss = read(clearSelfRemainCssFilePath).toString()

    penthouse({
      url: staticServerFileUrl('clearSelf.html'),
      css: clearSelfRemainCssFilePath
    })
    .then(result => {
      var resultAst = normaliseCssAst(result)
      var expectedAst = normaliseCssAst(clearSelfRemainCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })

  it('should force include specified selectors', function (done) {
    var forceIncludeCssFilePath = path.join(__dirname, 'static-server', 'forceInclude.css'),
      forceIncludeCss = read(forceIncludeCssFilePath).toString()
    penthouse({
      url: page1FileUrl,
      css: forceIncludeCssFilePath,
      forceInclude: [
        '.myLoggedInSelectorRemainsEvenThoughNotFoundOnPage',
        '#box1:hover',
        /^\.COMPONENT/i // intentionally mismatching case to test regex flags
      ]
    })
    .then(result => {
      var resultAst = normaliseCssAst(result)
      var expectedAst = normaliseCssAst(forceIncludeCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })

  // non essential
  it('should remove empty rules', function (done) {
    var emptyRemoveCssFilePath = path.join(__dirname, 'static-server', 'empty-rules--remove.css')

    penthouse({
      url: page1FileUrl,
      css: emptyRemoveCssFilePath
    })
    .then(result => {
      result.trim().should.equal('')
      done()
    })
    .catch(done)
  })
})
