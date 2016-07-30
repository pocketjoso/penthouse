import css from 'css'
import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import chai from 'chai'
chai.should() // binds globally on Object

describe('extra tests for penthouse node module', function () {
  var page1cssPath = path.join(__dirname, 'static-server', 'page1.css'),
    page1 = path.join(__dirname, 'static-server', 'page1.html')

  // phantomjs takes a while to start up
  this.timeout(5000)

  it('error should not contain debug info', function (done) {
    penthouse({
      url: 'http://localhost.does.not.exist',
      css: page1cssPath
    }, function (err, result) {
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
    }, function (err, result) {
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
