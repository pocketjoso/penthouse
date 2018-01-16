'use strict'

import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import chai from 'chai'
import csstree from 'css-tree'

import normaliseCss from './util/normaliseCss'

chai.should() // binds globally on Object

function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

describe('basic tests of penthouse functionality', function () {
  var page1FileUrl = staticServerFileUrl('page1.html')
  var page1cssPath = path.join(__dirname, 'static-server', 'page1.css')
  var originalCss = read(page1cssPath).toString()

  // some of these tests take longer than default timeout
  this.timeout(10000)

  it('should return css', function () {
    return penthouse({
      url: page1FileUrl,
      css: page1cssPath
    })
      .then(result => {
        result.should.have.length.greaterThan(0)
      })
  })

  it('should return a css file whose parsed AST is equal to the the original\'s AST when the viewport is large', function () {
    var widthLargerThanTotalTestCSS = 1000
    var heightLargerThanTotalTestCSS = 1000

    return penthouse({
      url: page1FileUrl,
      css: page1cssPath,
      width: widthLargerThanTotalTestCSS,
      height: heightLargerThanTotalTestCSS
    })
      .then(result => {
        result.should.eql(normaliseCss(originalCss))
      })
  })

  it('should return a subset of the original AST rules when the viewport is small', function () {
    var widthLargerThanTotalTestCSS = 1000
    var heightSmallerThanTotalTestCSS = 100

    return penthouse({
      url: page1FileUrl,
      css: page1cssPath,
      width: widthLargerThanTotalTestCSS,
      height: heightSmallerThanTotalTestCSS
    })
      .then(result => {
        const resultRules = csstree.toPlainObject(csstree.parse(result)).children
        const originalRules = csstree.toPlainObject(csstree.parse(originalCss)).children
        resultRules.should.have.length.lessThan(originalRules.length)
        // not be empty
      })
  })

  it('should not crash on invalid css', function () {
    return penthouse({
      url: page1FileUrl,
      css: path.join(__dirname, 'static-server', 'invalid.css')
    })
      .then(result => {
        if (result.length === 0) {
          throw new Error('length should be > 0')
        }
        result.should.have.length.greaterThan(0)
      })
  })

  it('should not crash on invalid media query', function () {
    return penthouse({
      url: page1FileUrl,
      css: path.join(__dirname, 'static-server', 'invalid-media.css')
    })
      .then(result => {
        result.should.have.length.greaterThan(0)
      })
  })

  it('should crash with errors in strict mode on invalid css', function (done) {
    penthouse({
      url: page1FileUrl,
      css: path.join(__dirname, 'static-server', 'invalid.css'),
      strict: true
    })
      .then(() => done(new Error('Did not get error')))
      .catch(() => done())
  })

  it('should not crash or hang on special chars', function () {
    return penthouse({
      url: page1FileUrl,
      css: path.join(__dirname, 'static-server', 'special-chars.css')
    })
      .then(result => {
        result.should.have.length.greaterThan(0)
      })
  })

  it('should surface parsing errors to the end user', function (done) {
    penthouse({
      css: 'missing.css'
    })
      .then(() => done(new Error('Did not get error')))
      .catch(() => done())
  })

  it('should exit after timeout', function (done) {
    penthouse({
      url: page1FileUrl,
      css: page1cssPath,
      timeout: 100
    })
      .then(() => done(new Error('Got no timeout error')))
      .catch(err => {
        if (err && /Penthouse timed out/.test(err)) {
          done()
        } else {
          done(new Error('Did not get timeout error, got: ' + err))
        }
      })
  })
})
