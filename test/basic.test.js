'use strict'

import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import csstree from 'css-tree'

import normaliseCss from './util/normaliseCss'

function staticServerFileUrl (file) {
  return 'file://' + path.join(process.env.PWD, 'test', 'static-server', file)
}

describe('basic tests of penthouse functionality', () => {
  var page1FileUrl = staticServerFileUrl('page1.html')
  var page1cssPath = path.join(process.env.PWD, 'test', 'static-server', 'page1.css')
  var originalCss = read(page1cssPath).toString()

  it('should return css', () => {
    return penthouse({
      url: page1FileUrl,
      css: page1cssPath
    })
      .then(result => {
        expect(result.length).toBeGreaterThan(0)
      })
  })

  it('should return a css file whose parsed AST is equal to the the original\'s AST when the viewport is large', () => {
    var widthLargerThanTotalTestCSS = 1000
    var heightLargerThanTotalTestCSS = 1000

    return penthouse({
      url: page1FileUrl,
      css: page1cssPath,
      width: widthLargerThanTotalTestCSS,
      height: heightLargerThanTotalTestCSS
    })
      .then(result => {
        expect(result).toEqual(normaliseCss(originalCss))
      })
  })

  it('should return a subset of the original AST rules when the viewport is small', () => {
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
        expect(resultRules.length).toBeLessThan(originalRules.length)
        // not be empty
      })
  })

  it('should not crash on invalid css', () => {
    return penthouse({
      url: page1FileUrl,
      css: path.join(process.env.PWD, 'test', 'static-server', 'invalid.css')
    })
      .then(result => {
        if (result.length === 0) {
          throw new Error('length should be > 0')
        }
        expect(result.length).toBeGreaterThan(0)
      })
  })

  it('should not crash on invalid media query', () => {
    return penthouse({
      url: page1FileUrl,
      css: path.join(process.env.PWD, 'test', 'static-server', 'invalid-media.css')
    })
      .then(result => {
        expect(result.length).toBeGreaterThan(0)
      })
  })

  it('should crash with errors in strict mode on invalid css', done => {
    penthouse({
      url: page1FileUrl,
      css: path.join(process.env.PWD, 'test', 'static-server', 'invalid.css'),
      strict: true
    })
      .then(() => done(new Error('Did not get error')))
      .catch(() => done())
  })

  it('should not crash or hang on special chars', () => {
    return penthouse({
      url: page1FileUrl,
      css: path.join(process.env.PWD, 'test', 'static-server', 'special-chars.css')
    })
      .then(result => {
        expect(result.length).toBeGreaterThan(0)
      })
  })

  it('should surface parsing errors to the end user', done => {
    penthouse({
      css: 'missing.css'
    })
      .then(() => done(new Error('Did not get error')))
      .catch(() => done())
  })

  it('should exit after timeout', done => {
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
