'use strict'

import css from 'css-fork-pocketjoso'
import { readFileSync as read } from 'fs'
import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import chai from 'chai'
chai.should() // binds globally on Object

// becasuse dont want to fail tests on white space differences
function normalisedCssAst (cssString) {
  return css.parse(css.stringify(css.parse(cssString), { compress: true }))
}
function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

describe('extra tests for penthouse node module', function () {
  var page1FileUrl = staticServerFileUrl('page1.html')
  var page1cssPath = path.join(__dirname, 'static-server', 'page1.css')

  // module handles both callback (legacy), and promise
  it('module invocation should return promise', function (done) {
    var originalCss = read(page1cssPath).toString()

    penthouse({
      url: page1FileUrl,
      css: page1cssPath
    })
    .then(result => {
      var resultAst = normalisedCssAst(result)
      var expectedAst = normalisedCssAst(originalCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })

  it('error should not contain debug info', function (done) {
    // callback
    penthouse({
      url: 'http://localhost.does.not.exist',
      css: page1cssPath
    })
    .catch(err => {
      if (err) {
        if (/^Error: time: 0/.test(err)) {
          done(err)
        } else {
          done()
        }
        return
      }
      done(new Error('did not return expected error'))
    })
  })

  it('error should contain debug info in debug mode', function (done) {
    penthouse.DEBUG = true
    penthouse({
      url: 'http://localhost.does.not.exist',
      css: page1cssPath
    })
    .catch(err => {
      if (err) {
        // err should have format like:
        // time: 0 | opened css file
        // time: 2 | parsed ast (without errors)
        if (/^Error: time: /.test(err)) {
          done()
        } else {
          done(err)
        }
        return
      }
      done(new Error('did not throw any error, which was expected'))
    })
  })
})
